import { session, shell, WebContentsView } from "electron"
import type { BrowserWindow, Session } from "electron"
import { randomUUID } from "node:crypto"
import { appDockURL, appDockZoom, panelBoundsToContent, type DockBounds } from "./app-dock-utils"
export type { DockBounds } from "./app-dock-utils"

export type AppDockIdentity = Readonly<{ tabID: string; generation: number }>
export type AppDockTab = AppDockIdentity & { url: string }
export type AppDockState = AppDockIdentity & { url: string; title: string; favicon?: string; loading: boolean; audible: boolean; error?: { code: "blocked" | "failed"; url: string } }
export type AppDockFindResult = AppDockIdentity & { requestID: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }
export type AppDockDownload = AppDockIdentity & { id: string; filename: string; receivedBytes: number; totalBytes: number; state: "progressing" | "paused" | "completed" | "cancelled" | "interrupted" }
type AppDockRecord = { view: WebContentsView; storageKey: string; generation: number; state: () => AppDockState; notify: (state: AppDockState) => void; notifyDownload: (download: AppDockDownload) => void; notifyFullscreen: (identity: AppDockIdentity, enabled: boolean) => void; cleanups: (() => void)[] }

const storagePartition = (storageKey: string) => {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(storageKey)) throw new Error("Invalid App Dock storage key")
  return `persist:app-dock-${storageKey}`
}

export { panelBoundsToContent }

const validBounds = (bounds: DockBounds) =>
  [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isSafeInteger) && bounds.width > 0 && bounds.height > 0

export function createAppDock() {
  const browserSessions = new Map<string, Session>()
  const configuredPartitions = new Set<string>()
  const retiredStorageKeys = new Set<string>()
  const tabs = new Map<number, Map<string, AppDockRecord>>()
  const tabByContents = new Map<number, { senderID: number; tabID: string; generation: number }>()
  const downloads = new Map<string, { senderID: number; storageKey: string; item: Electron.DownloadItem; state: AppDockDownload }>()
  const active = new Map<number, string>()
  const inactive = new Map<string, { senderID: number; tabID: string }>()
  let generation = 0
  const identity = (tabID: string, tabGeneration: number): AppDockIdentity => Object.freeze({ tabID, generation: tabGeneration })
  const isCurrent = (senderID: number, tabID: string, tabGeneration: number) => tabs.get(senderID)?.get(tabID)?.generation === tabGeneration
  const markInactive = (senderID: number, tabID: string, record: AppDockRecord) => {
    record.view.webContents.setBackgroundThrottling(true)
    inactive.delete(`${senderID}:${tabID}`)
    inactive.set(`${senderID}:${tabID}`, { senderID, tabID })
  }
  const remove = (senderID: number, tabID: string, win?: BrowserWindow) => {
    const record = tabs.get(senderID)?.get(tabID)
    if (!record) return
    win?.contentView.removeChildView(record.view)
    inactive.delete(`${senderID}:${tabID}`)
    tabByContents.delete(record.view.webContents.id)
    record.cleanups.forEach((cleanup) => cleanup())
    for (const [downloadID, download] of downloads) {
      if (download.senderID === senderID && download.state.tabID === tabID && download.state.generation === record.generation) {
        download.item.cancel()
        downloads.delete(downloadID)
      }
    }
    record.view.webContents.close()
    tabs.get(senderID)?.delete(tabID)
    generation++
    if (active.get(senderID) === tabID) active.delete(senderID)
  }
  const close = (senderID: number, win?: BrowserWindow, tabID?: string) => {
    const ids = tabID ? [tabID] : [...(tabs.get(senderID)?.keys() ?? [])]
    ids.forEach((id) => remove(senderID, id, win))
    if ((tabs.get(senderID)?.size ?? 0) === 0) tabs.delete(senderID)
  }
  const open = async (
      senderID: number,
      win: BrowserWindow,
      address: string,
      bounds: DockBounds,
      notify: (state: AppDockState) => void,
      storageKey?: string,
      onTabOpened?: (tab: AppDockTab) => void,
      onDownload?: (download: AppDockDownload) => void,
      onFullscreen?: (identity: AppDockIdentity, enabled: boolean) => void,
    ): Promise<AppDockTab> => {
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const id = randomUUID()
      const tabGeneration = ++generation
      let target: string
      try {
        target = appDockURL(address)
      } catch {
        notify(Object.freeze({ ...identity(id, tabGeneration), url: address, title: address, loading: false, audible: false, error: { code: "blocked", url: address } }))
        throw new Error("App Dock only supports HTTPS URLs")
      }
      if (!storageKey) throw new Error("App Dock storage key is required")
      if (retiredStorageKeys.has(storageKey)) throw new Error("App Dock storage key is retired")
      const partition = storagePartition(storageKey)
      const browserSession = browserSessions.get(partition) ?? session.fromPartition(partition)
      browserSessions.set(partition, browserSession)
      if (!configuredPartitions.has(partition)) {
        browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
        browserSession.setPermissionCheckHandler(() => false)
        browserSession.on("will-download", (_event, item, webContents) => {
          const source = tabByContents.get(webContents.id)
          const record = source && tabs.get(source.senderID)?.get(source.tabID)
          if (!source || !record || record.generation !== source.generation) return item.cancel()
          const id = randomUUID()
          const updateDownload = (state: AppDockDownload["state"]) => {
            if (!isCurrent(source.senderID, source.tabID, source.generation)) return
            const download = Object.freeze({ ...identity(source.tabID, source.generation), id, filename: item.getFilename(), receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes(), state })
            downloads.set(id, { senderID: source.senderID, storageKey: record.storageKey, item, state: download })
            record.notifyDownload(download)
          }
          item.on("updated", () => updateDownload(item.isPaused() ? "paused" : "progressing"))
          item.once("done", (_doneEvent, state) => updateDownload(state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted"))
          updateDownload("progressing")
        })
        configuredPartitions.add(partition)
      }
      const view = new WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, session: browserSession, backgroundThrottling: true } })
      let state: Omit<AppDockState, "tabID" | "generation"> = { url: target, title: target, loading: true, audible: false }
      const snapshot = (): AppDockState => Object.freeze({ ...identity(id, tabGeneration), ...state })
      const update = (patch: Partial<Omit<AppDockState, "tabID" | "generation">>) => {
        if (!isCurrent(senderID, id, tabGeneration)) return
        state = { ...state, ...patch }
        notify(snapshot())
      }
      const cleanups: (() => void)[] = []
      const listen = <T extends Parameters<typeof view.webContents.on>[0]>(event: T, listener: (...args: any[]) => void) => {
        view.webContents.on(event, listener)
        cleanups.push(() => view.webContents.removeListener(event, listener))
      }
      listen("page-title-updated", (_event, title) => update({ title }))
      listen("page-favicon-updated", (_event, favicons) => update({ favicon: favicons[0] }))
      listen("did-start-loading", () => update({ loading: true }))
      listen("did-stop-loading", () => update({ loading: false, url: view.webContents.getURL() || target }))
      listen("did-fail-load", (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return
        update({ loading: false, url: validatedURL || state.url, error: { code: "failed", url: validatedURL || state.url } })
      })
      listen("did-navigate", (_event, navigatedURL) => update({ url: navigatedURL }))
      listen("did-navigate-in-page", (_event, navigatedURL) => update({ url: navigatedURL }))
      listen("media-started-playing", () => update({ audible: true }))
      listen("media-paused", () => update({ audible: false }))
      view.webContents.setWindowOpenHandler(({ url }) => {
        try {
          const popupURL = appDockURL(url)
          void open(senderID, win, popupURL, bounds, notify, storageKey, onTabOpened, onDownload, onFullscreen).then(onTabOpened)
        } catch {
          update({ loading: false, error: { code: "blocked", url } })
        }
        return { action: "deny" }
      })
      listen("will-navigate", (event, url) => {
        if (URL.canParse(url) && new URL(url).protocol === "https:") return
        event.preventDefault()
        update({ loading: false, error: { code: "blocked", url } })
      })
      listen("will-redirect", (event, url) => {
        if (URL.canParse(url) && new URL(url).protocol === "https:") return
        event.preventDefault()
        update({ loading: false, error: { code: "blocked", url } })
      })
      listen("enter-html-full-screen", () => (onFullscreen ?? (() => {}))(identity(id, tabGeneration), true))
      listen("leave-html-full-screen", () => (onFullscreen ?? (() => {}))(identity(id, tabGeneration), false))
      win.contentView.addChildView(view)
      view.setBounds(bounds)
      view.setVisible(true)
      view.webContents.setBackgroundThrottling(false)
      const senderTabs = tabs.get(senderID) ?? new Map<string, AppDockRecord>()
      for (const [tabID, other] of senderTabs) {
        if (tabID !== id) {
          win.contentView.removeChildView(other.view)
          markInactive(senderID, tabID, other)
        }
      }
      senderTabs.set(id, { view, storageKey, generation: tabGeneration, state: snapshot, notify, notifyDownload: onDownload ?? (() => {}), notifyFullscreen: onFullscreen ?? (() => {}), cleanups })
      tabByContents.set(view.webContents.id, { senderID, tabID: id, generation: tabGeneration })
      tabs.set(senderID, senderTabs)
      active.set(senderID, id)
      while (inactive.size > 20) {
        const oldest = inactive.values().next().value
        if (!oldest) break
        remove(oldest.senderID, oldest.tabID)
      }
      void view.webContents.loadURL(target).catch(() => update({ loading: false, error: { code: "failed", url: target } }))
      update({})
      return Object.freeze({ ...identity(id, tabGeneration), url: target })
    }
  return {
    open,
    resize(senderID: number, bounds: DockBounds) {
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const tabID = active.get(senderID)
      if (tabID) tabs.get(senderID)?.get(tabID)?.view.setBounds(bounds)
    },
    hide(senderID: number, win: BrowserWindow) {
      for (const [tabID, record] of tabs.get(senderID) ?? []) {
        win.contentView.removeChildView(record.view)
        markInactive(senderID, tabID, record)
      }
      active.delete(senderID)
    },
    select(senderID: number, win: BrowserWindow, tabID: string, bounds: DockBounds) {
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      for (const [id, other] of tabs.get(senderID) ?? []) {
        if (id === tabID) {
          win.contentView.addChildView(other.view)
          other.view.webContents.setBackgroundThrottling(false)
          inactive.delete(`${senderID}:${id}`)
        } else {
          win.contentView.removeChildView(other.view)
          markInactive(senderID, id, other)
        }
      }
      record.view.setBounds(bounds)
      active.set(senderID, tabID)
    },
    navigate(senderID: number, tabID: string, address: string) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      let target: string
      try {
        target = appDockURL(address)
      } catch {
        record.notify(Object.freeze({ ...record.state(), loading: false, error: { code: "blocked", url: address } }))
        throw new Error("App Dock only supports HTTPS URLs")
      }
      return record.view.webContents.loadURL(target).catch(() => {
        record.notify(Object.freeze({ ...record.state(), loading: false, error: { code: "failed", url: target } }))
        throw new Error("Navigation failed")
      })
    },
    command(senderID: number, tabID: string, command: "back" | "forward" | "reload") {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      if (command === "back" && record.view.webContents.canGoBack()) return record.view.webContents.goBack()
      if (command === "forward" && record.view.webContents.canGoForward()) return record.view.webContents.goForward()
      if (command === "reload") return record.view.webContents.reload()
    },
    find(senderID: number, tabID: string, text: string, forward: boolean, notify: (result: AppDockFindResult) => void) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      const query = text.trim()
      if (!query) throw new Error("Find text is required")
      let requestID = -1
      const listener = (_event: Electron.Event, result: Electron.FoundInPageResult) => {
        if (result.requestId !== requestID || !isCurrent(senderID, tabID, record.generation)) return
        notify(Object.freeze({ ...identity(tabID, record.generation), requestID, activeMatchOrdinal: result.activeMatchOrdinal, matches: result.matches, finalUpdate: result.finalUpdate }))
        if (result.finalUpdate) record.view.webContents.removeListener("found-in-page", listener)
      }
      record.view.webContents.on("found-in-page", listener)
      record.cleanups.push(() => record.view.webContents.removeListener("found-in-page", listener))
      requestID = record.view.webContents.findInPage(query, { forward, findNext: true })
      return requestID
    },
    stopFind(senderID: number, tabID: string) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      record.view.webContents.stopFindInPage("clearSelection")
    },
    zoom(senderID: number, tabID: string, factor?: number) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      if (factor !== undefined) record.view.webContents.setZoomFactor(appDockZoom(factor))
      return record.view.webContents.getZoomFactor()
    },
    fullscreen(senderID: number, win: BrowserWindow, tabID: string, enabled: boolean) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      win.setFullScreen(enabled)
      record.notifyFullscreen(identity(tabID, record.generation), enabled)
    },
    cancelDownload(senderID: number, id: string) {
      const download = downloads.get(id)
      if (!download || download.senderID !== senderID) throw new Error("Unknown App Dock download")
      download.item.cancel()
    },
    openDownload(senderID: number, id: string) {
      const download = downloads.get(id)
      if (!download || download.senderID !== senderID || download.state.state !== "completed") throw new Error("Unknown App Dock download")
      return shell.openPath(download.item.getSavePath())
    },
    async deleteStorage(storageKey: string) {
      const partition = storagePartition(storageKey)
      if (retiredStorageKeys.has(storageKey)) throw new Error("App Dock storage key is retired")
      retiredStorageKeys.add(storageKey)
      for (const [senderID, senderTabs] of tabs) {
        for (const [tabID, record] of senderTabs) if (record.storageKey === storageKey) remove(senderID, tabID)
      }
      for (const [downloadID, download] of downloads) {
        if (download.storageKey === storageKey) {
          download.item.cancel()
          downloads.delete(downloadID)
        }
      }
      const browserSession = browserSessions.get(partition) ?? session.fromPartition(partition)
      await browserSession.clearStorageData()
      await browserSession.clearCache()
      browserSessions.delete(partition)
    },
    close,
  }
}

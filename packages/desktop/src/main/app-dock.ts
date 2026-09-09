import { session, shell, WebContentsView } from "electron"
import type { BrowserWindow, Session } from "electron"
import { randomUUID } from "node:crypto"
import { appDockURL, appDockZoom, panelBoundsToContent, type DockBounds } from "./app-dock-utils"
export type { DockBounds } from "./app-dock-utils"

export type AppDockTab = { id: string; url: string }
export type AppDockState = AppDockTab & { title: string; favicon?: string; loading: boolean; audible: boolean; error?: string }
export type AppDockFindResult = { tabID: string; requestID: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }
export type AppDockDownload = { id: string; tabID: string; filename: string; receivedBytes: number; totalBytes: number; state: "progressing" | "paused" | "completed" | "cancelled" | "interrupted" }
type AppDockRecord = { view: WebContentsView; profile: string; notify: (state: AppDockState) => void; notifyDownload: (download: AppDockDownload) => void; notifyFullscreen: (tabID: string, enabled: boolean) => void }

const profilePartition = (profile: string) => {
  const name = profile.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(name)) throw new Error("Invalid App Dock profile")
  return `persist:app-dock-${name}`
}

export { panelBoundsToContent }

const validBounds = (bounds: DockBounds) =>
  [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isSafeInteger) && bounds.width > 0 && bounds.height > 0

export function createAppDock() {
  const browserSessions = new Map<string, Session>()
  const configuredPartitions = new Set<string>()
  const tabs = new Map<number, Map<string, AppDockRecord>>()
  const tabByContents = new Map<number, { senderID: number; tabID: string }>()
  const downloads = new Map<string, { senderID: number; item: Electron.DownloadItem; state: AppDockDownload }>()
  const active = new Map<number, string>()
  const remove = (senderID: number, tabID: string, win?: BrowserWindow) => {
    const record = tabs.get(senderID)?.get(tabID)
    if (!record) return
    win?.contentView.removeChildView(record.view)
    tabByContents.delete(record.view.webContents.id)
    record.view.webContents.close()
    tabs.get(senderID)?.delete(tabID)
    if (active.get(senderID) === tabID) active.delete(senderID)
  }
  const close = (senderID: number, win?: BrowserWindow, tabID?: string) => {
    const ids = tabID ? [tabID] : [...(tabs.get(senderID)?.keys() ?? [])]
    ids.forEach((id) => remove(senderID, id, win))
    if ((tabs.get(senderID)?.size ?? 0) === 0) tabs.delete(senderID)
  }
  return {
    async open(
      senderID: number,
      win: BrowserWindow,
      address: string,
      bounds: DockBounds,
      notify: (state: AppDockState) => void,
      profile = "default",
      onTabOpened?: (tab: AppDockTab) => void,
      onDownload?: (download: AppDockDownload) => void,
      onFullscreen?: (tabID: string, enabled: boolean) => void,
    ): Promise<AppDockTab> {
      const target = appDockURL(address)
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const partition = profilePartition(profile)
      const browserSession = browserSessions.get(partition) ?? session.fromPartition(partition)
      browserSessions.set(partition, browserSession)
      if (!configuredPartitions.has(partition)) {
        browserSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false))
        browserSession.on("will-download", (_event, item, webContents) => {
          const source = tabByContents.get(webContents.id)
          const record = source && tabs.get(source.senderID)?.get(source.tabID)
          if (!source || !record) return item.cancel()
          const id = randomUUID()
          const updateDownload = (state: AppDockDownload["state"]) => {
            const download = { id, tabID: source.tabID, filename: item.getFilename(), receivedBytes: item.getReceivedBytes(), totalBytes: item.getTotalBytes(), state }
            downloads.set(id, { senderID: source.senderID, item, state: download })
            record.notifyDownload(download)
          }
          item.on("updated", () => updateDownload(item.isPaused() ? "paused" : "progressing"))
          item.once("done", (_doneEvent, state) => updateDownload(state === "completed" ? "completed" : state === "cancelled" ? "cancelled" : "interrupted"))
          updateDownload("progressing")
        })
        configuredPartitions.add(partition)
      }
      const id = randomUUID()
      const view = new WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, session: browserSession, backgroundThrottling: true } })
      let state: AppDockState = { id, url: target, title: target, loading: true, audible: false }
      const update = (patch: Partial<AppDockState>) => {
        state = { ...state, ...patch }
        notify(state)
      }
      view.webContents.on("page-title-updated", (_event, title) => update({ title }))
      view.webContents.on("page-favicon-updated", (_event, favicons) => update({ favicon: favicons[0] }))
      view.webContents.on("did-start-loading", () => update({ loading: true }))
      view.webContents.on("did-stop-loading", () => update({ loading: false, url: view.webContents.getURL() || target }))
      view.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (!isMainFrame || errorCode === -3) return
        update({ loading: false, url: validatedURL || state.url, error: `${errorCode}: ${errorDescription}` })
      })
      view.webContents.on("did-navigate", (_event, navigatedURL) => update({ url: navigatedURL }))
      view.webContents.on("did-navigate-in-page", (_event, navigatedURL) => update({ url: navigatedURL }))
      view.webContents.on("media-started-playing", () => update({ audible: true }))
      view.webContents.on("media-paused", () => update({ audible: false }))
      view.webContents.setWindowOpenHandler(({ url }) => {
        try {
          const popupURL = appDockURL(url)
          void this.open(senderID, win, popupURL, bounds, notify, profile, onTabOpened, onDownload, onFullscreen).then(onTabOpened)
        } catch {
          // App Dock blocks non-HTTPS popup targets before Chromium can create a window.
        }
        return { action: "deny" }
      })
      view.webContents.on("will-navigate", (event, url) => {
        if (URL.canParse(url) && new URL(url).protocol === "https:") return
        event.preventDefault()
      })
      view.webContents.on("will-redirect", (event, url) => {
        if (URL.canParse(url) && new URL(url).protocol === "https:") return
        event.preventDefault()
      })
      view.webContents.on("enter-html-full-screen", () => (onFullscreen ?? (() => {}))(id, true))
      view.webContents.on("leave-html-full-screen", () => (onFullscreen ?? (() => {}))(id, false))
      win.contentView.addChildView(view)
      view.setBounds(bounds)
      view.setVisible(true)
      const senderTabs = tabs.get(senderID) ?? new Map<string, AppDockRecord>()
      for (const [tabID, other] of senderTabs) {
        if (tabID !== id) win.contentView.removeChildView(other.view)
      }
      senderTabs.set(id, { view, profile, notify, notifyDownload: onDownload ?? (() => {}), notifyFullscreen: onFullscreen ?? (() => {}) })
      tabByContents.set(view.webContents.id, { senderID, tabID: id })
      tabs.set(senderID, senderTabs)
      active.set(senderID, id)
      void view.webContents.loadURL(target).catch((error) => update({ loading: false, error: error instanceof Error ? error.message : "Navigation failed" }))
      notify(state)
      return { id, url: target }
    },
    resize(senderID: number, bounds: DockBounds) {
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const tabID = active.get(senderID)
      if (tabID) tabs.get(senderID)?.get(tabID)?.view.setBounds(bounds)
    },
    hide(senderID: number, win: BrowserWindow) {
      for (const record of tabs.get(senderID)?.values() ?? []) win.contentView.removeChildView(record.view)
      active.delete(senderID)
    },
    select(senderID: number, win: BrowserWindow, tabID: string, bounds: DockBounds) {
      if (!validBounds(bounds)) throw new Error("Invalid App Dock bounds")
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      for (const [id, other] of tabs.get(senderID) ?? []) {
        if (id === tabID) win.contentView.addChildView(other.view)
        else win.contentView.removeChildView(other.view)
      }
      record.view.setBounds(bounds)
      active.set(senderID, tabID)
    },
    navigate(senderID: number, tabID: string, address: string) {
      const record = tabs.get(senderID)?.get(tabID)
      if (!record) throw new Error("Unknown App Dock tab")
      return record.view.webContents.loadURL(appDockURL(address)).catch((error) => {
        throw error instanceof Error ? error : new Error("Navigation failed")
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
        if (result.requestId !== requestID) return
        notify({ tabID, requestID, activeMatchOrdinal: result.activeMatchOrdinal, matches: result.matches, finalUpdate: result.finalUpdate })
        if (result.finalUpdate) record.view.webContents.removeListener("found-in-page", listener)
      }
      record.view.webContents.on("found-in-page", listener)
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
      record.notifyFullscreen(tabID, enabled)
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
    close,
  }
}

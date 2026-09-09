import { createEffect, createSignal, onCleanup, onMount } from "solid-js"
import "./apps-panel.css"

type Bounds = { x: number; y: number; width: number; height: number }
type AppDockAPI = {
  appDockOpen: (url: string, bounds: Bounds, profile?: string) => Promise<{ id: string; url: string }>
  appDockResize: (bounds: Bounds) => Promise<void>
  appDockHide: () => Promise<void>
  appDockClose: () => Promise<void>
  appDockCloseTab: (id: string) => Promise<void>
  appDockSelect: (id: string, bounds: Bounds) => Promise<void>
  appDockNavigate: (id: string, url: string) => Promise<void>
  appDockCommand: (id: string, command: "back" | "forward" | "reload") => Promise<void>
  appDockState: (callback: (state: { id: string; url: string; title: string; favicon?: string; loading: boolean; audible: boolean; error?: string }) => void) => () => void
  appDockTabOpened: (callback: (tab: { id: string; url: string }) => void) => () => void
  appDockFind: (id: string, text: string, forward: boolean) => Promise<number>
  appDockStopFind: (id: string) => Promise<void>
  appDockFindResult: (callback: (result: { tabID: string; requestID: number; activeMatchOrdinal: number; matches: number; finalUpdate: boolean }) => void) => () => void
  appDockZoom: (id: string, factor?: number) => Promise<number>
  appDockCancelDownload: (id: string) => Promise<void>
  appDockOpenDownload: (id: string) => Promise<string>
  appDockDownload: (callback: (download: Download) => void) => () => void
  appDockFullscreen: (id: string, enabled: boolean) => Promise<void>
  appDockFullscreenChanged: (callback: (state: { tabID: string; enabled: boolean }) => void) => () => void
}
type Tab = { id: string; url: string; title?: string; favicon?: string; loading?: boolean; audible?: boolean; pinned?: boolean }
type Profile = { id: string; name: string }
type Bookmark = { url: string; title: string }
type HistoryEntry = Bookmark & { visitedAt: number }
type Download = { id: string; tabID: string; filename: string; receivedBytes: number; totalBytes: number; state: "progressing" | "paused" | "completed" | "cancelled" | "interrupted" }

const profilesKey = "opencode.app-dock.profiles"
const activeProfileKey = "opencode.app-dock.profile"
const profileTabsKey = (profile: string) => `opencode.app-dock.tabs.${profile}`
const profileBookmarksKey = (profile: string) => `opencode.app-dock.bookmarks.${profile}`
const profileHistoryKey = (profile: string) => `opencode.app-dock.history.${profile}`
const defaultProfiles: Profile[] = [{ id: "default", name: "Personal" }]

const storedProfiles = (): Profile[] => {
  try {
    const value = JSON.parse(localStorage.getItem(profilesKey) ?? "null")
    if (!Array.isArray(value)) return defaultProfiles
    const valid = value.filter((profile) => /^[a-z0-9][a-z0-9-]{0,31}$/.test(profile?.id) && typeof profile.name === "string")
    return valid.length > 0 ? valid : defaultProfiles
  } catch {
    return defaultProfiles
  }
}

const storedTabs = (profile: string): Omit<Tab, "id">[] => {
  try {
    const value = JSON.parse(localStorage.getItem(profileTabsKey(profile)) ?? "[]")
    return Array.isArray(value)
      ? value.filter((tab) => {
          if (typeof tab?.url !== "string" || !URL.canParse(tab.url)) return false
          return new URL(tab.url).protocol === "https:"
        })
      : []
  } catch {
    return []
  }
}

const tabLabel = (tab: Tab) => tab.title || new URL(tab.url).hostname

const storedList = <T,>(key: string): T[] => {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "[]")
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

const bounds = (element: HTMLElement): Bounds => {
  const rect = element.getBoundingClientRect()
  // Inactive side-panel tabs can mount at 0x0 before layout settles. Native view
  // needs valid bounds now; ResizeObserver supplies real dimensions afterward.
  return { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) }
}

export function AppsPanel() {
  const [profiles, setProfiles] = createSignal<Profile[]>(storedProfiles())
  const [profile, setProfile] = createSignal(profiles().some((item) => item.id === localStorage.getItem(activeProfileKey)) ? localStorage.getItem(activeProfileKey)! : "default")
  const [profileCreating, setProfileCreating] = createSignal(false)
  const [profileDraft, setProfileDraft] = createSignal("")
  const [url, setURL] = createSignal("https://opencode.ai")
  const [tabs, setTabs] = createSignal<Tab[]>(storedTabs(profile()).map((tab, index) => ({ ...tab, id: `restore-${index}` })))
  const [active, setActive] = createSignal<string>()
  const [error, setError] = createSignal<string>()
  const [bookmarks, setBookmarks] = createSignal<Bookmark[]>(storedList(profileBookmarksKey(profile())))
  const [history, setHistory] = createSignal<HistoryEntry[]>(storedList(profileHistoryKey(profile())))
  const [libraryOpen, setLibraryOpen] = createSignal<"bookmarks" | "history">()
  const [findOpen, setFindOpen] = createSignal(false)
  const [findText, setFindText] = createSignal("")
  const [findResult, setFindResult] = createSignal<{ requestID: number; activeMatchOrdinal: number; matches: number }>()
  const [downloads, setDownloads] = createSignal<Download[]>([])
  const [downloadsOpen, setDownloadsOpen] = createSignal(false)
  const [fullscreen, setFullscreen] = createSignal(false)
  let findRequestID: number | undefined
  let host: HTMLDivElement | undefined
  let addressInput: HTMLInputElement | undefined
  let resizeFrame: number | undefined
  let persistTimer: ReturnType<typeof setTimeout> | undefined
  const [switching, setSwitching] = createSignal(false)
  let restoreGeneration = 0
  let disposed = false
  const profileRuntime = new Map<string, { tabs: Tab[]; active?: string; url: string }>()
  const api = () => window.api as AppDockAPI | undefined
  createEffect(() => {
    const currentProfile = profile()
    const value = JSON.stringify(tabs().map(({ id, loading, audible, ...tab }) => tab))
    if (switching()) return
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      localStorage.setItem(profileTabsKey(currentProfile), value)
      localStorage.setItem(profilesKey, JSON.stringify(profiles()))
    }, 250)
  })
  const resize = () => {
    if (resizeFrame !== undefined) return
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = undefined
      if (active() && host) void api()?.appDockResize(bounds(host))
    })
  }
  const restoreProfile = async (profileID: string, generation: number) => {
    const saved = storedTabs(profileID)
    setTabs([])
    setActive(undefined)
    setURL("https://opencode.ai")
    const restored: Tab[] = []
    for (const tab of saved) {
      if (disposed || generation !== restoreGeneration) return
      try {
        const opened = await api()?.appDockOpen(tab.url, bounds(host!), profileID)
        if (disposed || generation !== restoreGeneration) {
          if (opened) await api()?.appDockCloseTab(opened.id)
          return
        }
        if (opened) restored.push({ ...tab, ...opened })
      } catch {
        // Skip stale or unavailable URLs during startup restore.
      }
    }
    if (disposed || generation !== restoreGeneration) return
    setTabs(restored)
    const first = restored[0]
    if (first) {
      setActive(first.id)
      setURL(first.url)
      await api()?.appDockSelect(first.id, bounds(host!))
    }
  }
  onMount(() => {
    const unsubscribe = api()?.appDockState?.((state) => {
       const known = tabs().some((tab) => tab.id === state.id)
       if (!known) return
       setTabs((items) => items.map((tab) => tab.id === state.id ? { ...tab, ...state } : tab))
       if (state.id === active()) setURL(state.url)
       if (state.id === active()) setError(state.error)
       if (!state.error && !state.loading) {
         const entry = { url: state.url, title: state.title || new URL(state.url).hostname, visitedAt: Date.now() }
         setHistory((items) => {
           const next = [entry, ...items.filter((item) => item.url !== entry.url)].slice(0, 100)
           localStorage.setItem(profileHistoryKey(profile()), JSON.stringify(next))
           return next
         })
       }
    })
    const unsubscribePopup = api()?.appDockTabOpened?.((tab) => {
      setTabs((items) => items.some((item) => item.id === tab.id) ? items : [...items, tab])
      setActive(tab.id)
      setURL(tab.url)
    })
    const unsubscribeFind = api()?.appDockFindResult?.((result) => {
      if (result.tabID === active() && result.requestID === findRequestID) setFindResult(result)
    })
    const unsubscribeDownloads = api()?.appDockDownload?.((download) => {
      setDownloads((items) => [download, ...items.filter((item) => item.id !== download.id)].slice(0, 20))
    })
    const unsubscribeFullscreen = api()?.appDockFullscreenChanged?.((state) => {
      if (state.tabID === active()) setFullscreen(state.enabled)
    })
    const observer = new ResizeObserver(resize)
    if (host) observer.observe(host)
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key.toLowerCase() === "l") {
        event.preventDefault()
        addressInput?.focus()
        addressInput?.select()
      } else if (event.key.toLowerCase() === "t") {
        event.preventDefault()
        void openNewTab()
      } else if (event.key.toLowerCase() === "w" && active()) {
        event.preventDefault()
        void close()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    const generation = ++restoreGeneration
    setSwitching(true)
    void restoreProfile(profile(), generation).finally(() => {
      if (generation === restoreGeneration) setSwitching(false)
    })
    onCleanup(() => {
      disposed = true
      observer.disconnect()
      if (resizeFrame !== undefined) cancelAnimationFrame(resizeFrame)
      if (persistTimer) clearTimeout(persistTimer)
      window.removeEventListener("keydown", onKeyDown)
      unsubscribe?.()
      unsubscribePopup?.()
      unsubscribeFind?.()
      unsubscribeDownloads?.()
      unsubscribeFullscreen?.()
      void api()?.appDockClose()
    })
  })
  const launch = async () => {
    if (!host || !api()) return
    setError(undefined)
    try {
      const current = active()
      if (current) {
        setError(undefined)
        await api()!.appDockNavigate(current, url())
        setTabs((items) => items.map((tab) => tab.id === current ? { ...tab, url: url() } : tab))
        return
      }
      const tab = await api()!.appDockOpen(url(), bounds(host), profile())
      setTabs((current) => [...current, tab])
      setActive(tab.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open App Dock")
    }
  }
  const openNewTab = async () => {
    if (!host || !api()) return
    setError(undefined)
    try {
      const tab = await api()!.appDockOpen("https://opencode.ai", bounds(host), profile())
      setTabs((current) => [...current, tab])
      setActive(tab.id)
      setURL(tab.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open App Dock")
    }
  }
  const close = async () => {
    const id = active()
    if (!id) return
    const items = tabs()
    const index = items.findIndex((tab) => tab.id === id)
    const next = items[index + 1] ?? items[index - 1]
    await api()?.appDockCloseTab(id)
    setTabs((current) => current.filter((tab) => tab.id !== id))
    setActive(next?.id)
    setURL(next?.url ?? "https://opencode.ai")
    if (next && host) await api()?.appDockSelect(next.id, bounds(host))
  }
  const createProfile = (event: SubmitEvent) => {
    event.preventDefault()
    const name = profileDraft().trim()
    if (!name) return
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32)
    if (!id || profiles().some((item) => item.id === id)) return
    const next = [...profiles(), { id, name }]
    setProfiles(next)
    localStorage.setItem(profilesKey, JSON.stringify(next))
    setProfileDraft("")
    setProfileCreating(false)
  }
  const switchProfile = (next: string) => {
    if (next === profile() || switching()) return
    const previous = profile()
    if (persistTimer) clearTimeout(persistTimer)
    const previousTabs = tabs()
    profileRuntime.set(previous, { tabs: previousTabs, active: active(), url: url() })
    localStorage.setItem(profileTabsKey(previous), JSON.stringify(previousTabs.map(({ id, loading, audible, ...tab }) => tab)))
    localStorage.setItem(profilesKey, JSON.stringify(profiles()))
    localStorage.setItem(activeProfileKey, next)
    setSwitching(true)
    const generation = ++restoreGeneration
    setProfile(next)
    setBookmarks(storedList<Bookmark>(profileBookmarksKey(next)))
    setHistory(storedList<HistoryEntry>(profileHistoryKey(next)))
    setLibraryOpen(undefined)
    void (async () => {
      await api()?.appDockHide()
      if (disposed || generation !== restoreGeneration) return
      const cached = profileRuntime.get(next)
      if (cached) {
        setTabs(cached.tabs)
        setActive(cached.active)
        setURL(cached.url)
        if (cached.active && host) await api()?.appDockSelect(cached.active, bounds(host))
        if (generation === restoreGeneration) setSwitching(false)
        return
      }
      await restoreProfile(next, generation)
      if (generation === restoreGeneration) {
        profileRuntime.set(next, { tabs: tabs(), active: active(), url: url() })
        setSwitching(false)
        localStorage.setItem(profileTabsKey(next), JSON.stringify(tabs().map(({ id, loading, audible, ...tab }) => tab)))
      }
    })()
  }
  const activeTab = () => tabs().find((tab) => tab.id === active())
  const bookmarked = () => !!activeTab() && bookmarks().some((item) => item.url === activeTab()!.url)
  const toggleBookmark = () => {
    const tab = activeTab()
    if (!tab) return
    const current = bookmarks()
    const next = current.some((item) => item.url === tab.url)
      ? current.filter((item) => item.url !== tab.url)
      : [{ url: tab.url, title: tabLabel(tab) }, ...current]
    setBookmarks(next)
    localStorage.setItem(profileBookmarksKey(profile()), JSON.stringify(next))
  }
  const find = async (forward: boolean) => {
    const id = active()
    if (!id || !findText().trim()) return
    setFindResult(undefined)
    findRequestID = await api()?.appDockFind(id, findText(), forward)
  }
  const closeFind = () => {
    const id = active()
    if (id) void api()?.appDockStopFind(id)
    findRequestID = undefined
    setFindOpen(false)
    setFindResult(undefined)
  }
  const zoom = (delta: number) => {
    const id = active()
    if (!id) return
    void api()?.appDockZoom(id).then((factor) => api()?.appDockZoom(id, factor + delta))
  }
  const toggleFullscreen = () => {
    const id = active()
    if (id) void api()?.appDockFullscreen(id, !fullscreen())
  }
  const openLibraryItem = async (entry: Bookmark) => {
    setLibraryOpen(undefined)
    setURL(entry.url)
    if (!host || !api()) return
    const tab = await api()!.appDockOpen(entry.url, bounds(host), profile())
    setTabs((items) => [...items, tab])
    setActive(tab.id)
  }
  return (
    <div class="zen-browser-shell">
      <aside class="zen-browser-sidebar" aria-label="Browser workspaces">
        <div class="zen-workspace-indicator" aria-label="Current workspace">
          <span class="zen-workspace-indicator-dot" aria-hidden="true" />
            <select class="zen-workspace-indicator-name" value={profile()} aria-label="Browser profile" disabled={switching()} onChange={(event) => switchProfile(event.currentTarget.value)}>
            {profiles().map((item) => <option value={item.id}>{item.name}</option>)}
          </select>
          <button class="zen-profile-add" type="button" aria-label="Create browser profile" onClick={() => setProfileCreating(true)}>+</button>
        </div>
        {profileCreating() && <form class="zen-profile-form" onSubmit={createProfile}>
          <input autofocus value={profileDraft()} onInput={(event) => setProfileDraft(event.currentTarget.value)} placeholder="Profile name" aria-label="New profile name" />
          <button type="submit" aria-label="Save profile">+</button>
          <button type="button" aria-label="Cancel profile creation" onClick={() => setProfileCreating(false)}>x</button>
        </form>}
        <div class="zen-tabs" aria-label="Tabs">
          {tabs().filter((tab) => tab.pinned).length > 0 && <div class="zen-tab-section-label">Pinned</div>}
          {tabs().filter((tab) => tab.pinned).map((tab) => <TabButton tab={tab} active={active} setActive={setActive} setURL={setURL} host={host} api={api} close={close} setTabs={setTabs} />)}
          {tabs().filter((tab) => !tab.pinned).map((tab) => <TabButton tab={tab} active={active} setActive={setActive} setURL={setURL} host={host} api={api} close={close} setTabs={setTabs} />)}
          <button class="zen-new-tab" type="button" onClick={() => void openNewTab()}>+ New tab</button>
        </div>
      </aside>
      <main class="zen-browser-content">
        <form class="zen-urlbar" onSubmit={(event) => { event.preventDefault(); void launch() }}>
           <button class="zen-nav-button" type="button" aria-label="Back" onClick={() => { const id = active(); if (id) void api()?.appDockCommand(id, "back") }}>&#8592;</button>
            <button class="zen-nav-button" type="button" aria-label="Forward" onClick={() => { const id = active(); if (id) void api()?.appDockCommand(id, "forward") }}>&#8594;</button>
            <button class={`zen-nav-button ${bookmarked() ? "is-active" : ""}`} type="button" aria-label={bookmarked() ? "Remove bookmark" : "Add bookmark"} onClick={toggleBookmark}>&#9733;</button>
            <input ref={addressInput} value={url()} onInput={(event) => setURL(event.currentTarget.value)} aria-label="Address" />
            <button class="zen-nav-button" type="button" aria-label="Bookmarks" onClick={() => setLibraryOpen(libraryOpen() === "bookmarks" ? undefined : "bookmarks")}>&#9734;</button>
           <button class="zen-nav-button" type="button" aria-label="History" onClick={() => setLibraryOpen(libraryOpen() === "history" ? undefined : "history")}>&#8986;</button>
           <button class="zen-nav-button" type="button" aria-label="Find in page" onClick={() => setFindOpen(true)}>&#8981;</button>
            <button class="zen-nav-button" type="button" aria-label="Zoom out" onClick={() => zoom(-0.1)}>A-</button>
            <button class="zen-nav-button" type="button" aria-label="Zoom in" onClick={() => zoom(0.1)}>A+</button>
            <button class="zen-nav-button" type="button" aria-label="Downloads" onClick={() => setDownloadsOpen(!downloadsOpen())}>&#8595;</button>
            <button class="zen-nav-button" type="button" aria-label={fullscreen() ? "Exit fullscreen" : "Enter fullscreen"} onClick={toggleFullscreen}>{fullscreen() ? "Exit" : "Full"}</button>
          <button class="zen-open-button" type="button" onClick={() => { const id = active(); if (id) void api()?.appDockCommand(id, "reload") }}>Reload</button>
          <button class="zen-open-button" type="submit">Open</button>
          {active() && <button class="zen-nav-button" type="button" onClick={() => void close()} aria-label="Close tab">x</button>}
        </form>
         {error() && <div class="zen-error">{error()}</div>}
         {libraryOpen() && <div class="zen-library" role="dialog" aria-label={libraryOpen() === "bookmarks" ? "Bookmarks" : "History"}>
           <div class="zen-library-title">{libraryOpen() === "bookmarks" ? "Bookmarks" : "History"}</div>
           {(libraryOpen() === "bookmarks" ? bookmarks() : history()).map((entry) => <button type="button" onClick={() => void openLibraryItem(entry)}><span>{entry.title}</span><small>{new URL(entry.url).hostname}</small></button>)}
           {(libraryOpen() === "bookmarks" ? bookmarks() : history()).length === 0 && <p>Nothing here yet.</p>}
         </div>}
          {findOpen() && <form class="zen-findbar" onSubmit={(event) => { event.preventDefault(); void find(true) }}>
           <input autofocus value={findText()} onInput={(event) => setFindText(event.currentTarget.value)} aria-label="Find in page" placeholder="Find in page" />
           <span>{findResult() ? `${findResult()!.activeMatchOrdinal}/${findResult()!.matches}` : ""}</span>
           <button type="button" aria-label="Previous match" onClick={() => void find(false)}>&#8593;</button>
           <button type="submit" aria-label="Next match">&#8595;</button>
           <button type="button" aria-label="Close find" onClick={closeFind}>x</button>
          </form>}
          {downloadsOpen() && <div class="zen-library" role="dialog" aria-label="Downloads">
            <div class="zen-library-title">Downloads</div>
            {downloads().map((download) => <div class="zen-download"><span>{download.filename}</span><small>{download.state === "progressing" && download.totalBytes > 0 ? `${Math.round(download.receivedBytes / download.totalBytes * 100)}%` : download.state}</small>{download.state === "completed" ? <button type="button" onClick={() => void api()?.appDockOpenDownload(download.id)}>Open</button> : download.state === "progressing" || download.state === "paused" ? <button type="button" onClick={() => void api()?.appDockCancelDownload(download.id)}>Cancel</button> : null}</div>)}
            {downloads().length === 0 && <p>No downloads yet.</p>}
          </div>}
         {!api() && <div class="zen-empty-state"><strong>Browser needs OpenCode Desktop.</strong><span>Native browser tabs are unavailable in web app.</span></div>}
         <div ref={host} class="zen-browser-host" />
      </main>
    </div>
  )
}

function TabButton(props: {
  tab: Tab
  active: () => string | undefined
  setActive: (id: string) => void
  setURL: (url: string) => void
  host: HTMLDivElement | undefined
  api: () => AppDockAPI | undefined
  close: () => Promise<void>
  setTabs: (update: (tabs: Tab[]) => Tab[]) => void
}) {
  const togglePinned = (event: MouseEvent) => {
    event.stopPropagation()
    props.setTabs((tabs) => tabs.map((tab) => tab.id === props.tab.id ? { ...tab, pinned: !tab.pinned } : tab))
  }
  const select = () => {
    props.setActive(props.tab.id)
    props.setURL(props.tab.url)
    if (props.host) void props.api()?.appDockSelect(props.tab.id, bounds(props.host))
  }
  const keydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      select()
    }
  }
  return <div class={`zen-tab ${props.active() === props.tab.id ? "is-active" : ""}`} role="tab" tabindex="0" aria-selected={props.active() === props.tab.id} onClick={select} onKeyDown={keydown}><span class={`zen-tab-icon ${props.tab.loading ? "is-loading" : ""}`}>{props.tab.favicon ? <img src={props.tab.favicon} alt="" /> : new URL(props.tab.url).hostname.slice(0, 1).toUpperCase()}</span><span class="zen-tab-title">{tabLabel(props.tab)}</span>{props.tab.pinned ? <button class="zen-tab-pin" type="button" onClick={togglePinned} title="Unpin tab">&#9733;</button> : <button class="zen-tab-pin zen-tab-pin-hidden" type="button" onClick={togglePinned} title="Pin tab">&#9734;</button>}{props.tab.audible && <span class="zen-tab-audio">&#9835;</span>}<button class="zen-tab-close" type="button" aria-label={`Close ${tabLabel(props.tab)}`} onClick={(event) => { event.stopPropagation(); props.setActive(props.tab.id); void props.close() }}>x</button></div>
}

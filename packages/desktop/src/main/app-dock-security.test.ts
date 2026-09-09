import { execFileSync, spawn } from "node:child_process"
import { mkdir, mkdtemp, rename, rm, writeFile, access, readFile } from "node:fs/promises"
import { createServer } from "node:https"
import type { ServerResponse } from "node:http"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { createRequire } from "node:module"

const required = [
  "U01",
  "U02",
  "U03",
  "U04",
  "U05",
  "U06",
  "U07",
  "U08",
  "U09",
  "U10",
  "U11",
  "U12",
  "U13",
  "U14",
  "U15",
  "U16",
  "U17",
  "U18",
  "U19",
  "U20",
]
const root = resolve(import.meta.dir, "../..")
const artifact = join(process.env.APP_DOCK_ARTIFACT_ROOT ?? root, "artifacts/app-dock/s1.json")
const schemes = ["http://127.0.0.1/", "file:///etc/passwd", "javascript:document.title='pwned'", "data:text/html,pwned"]
const cacheableBody = `cacheable fixture${"x".repeat(1_000_000)}`
type Case = { id: string; status: "pass"; detail: string }
const cases: Case[] = []

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const pass = (id: string, detail: string) => cases.push({ id, status: "pass", detail })
const rejects = async (fn: () => unknown | Promise<unknown>, text: string) => {
  try {
    await fn()
  } catch (error) {
    check(String(error).includes(text), `Expected ${text}, got ${error}`)
    return
  }
  throw new Error(`Expected rejection: ${text}`)
}

async function parent() {
  const startupOnly = process.env.APP_DOCK_STARTUP_ONLY === "1"
  const loadOnly = process.env.APP_DOCK_LOAD_ONLY === "1"
  const buildDir = await mkdtemp(join(tmpdir(), "app-dock-e2e-"))
  let output = ""
  if (!startupOnly) {
    const result = await Bun.build({
      entrypoints: [import.meta.path],
      outdir: buildDir,
      naming: "[name].cjs",
      target: "node",
      format: "cjs",
      external: ["electron", "node:sqlite"],
      write: true,
    })
    output = result.outputs[0]?.path ?? ""
    if (!result.success || !output)
      throw new Error(
        JSON.stringify({
          phase: "build-failure",
          output,
          outputs: result.outputs.map((item) => item.path),
          logs: result.logs.map(String),
        }),
      )
    try {
      await access(output)
    } catch {
      throw new Error(
        JSON.stringify({
          phase: "build-output-missing",
          output,
          outputs: result.outputs.map((item) => item.path),
          logs: result.logs.map(String),
        }),
      )
    }
  }
  const electronModule = createRequire(join(process.cwd(), "package.json")).resolve("electron")
  const electron = join(dirname(electronModule), "dist/Electron.app/Contents/MacOS/Electron")
  await access(electron)
  await rm(artifact, { force: true })
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, NODE_OPTIONS, APP_DOCK_LOAD_ONLY: _loadOnly, ...env } = process.env
  const safeNodeOptions = NODE_OPTIONS?.includes("ELECTRON_RUN_AS_NODE") ? undefined : NODE_OPTIONS
  const entry = join(import.meta.dir, "app-dock-security.child.cjs")
  const child = spawn(
    electron,
    startupOnly ? [entry, "--startup-only"] : [entry, output, "--app-dock-electron-child"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...env,
        ...(safeNodeOptions ? { NODE_OPTIONS: safeNodeOptions } : {}),
        ...(loadOnly ? { APP_DOCK_LOAD_ONLY: "1" } : {}),
        APP_DOCK_ARTIFACT_ROOT: root,
        ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
      },
    },
  )
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk) => {
    stdout += chunk
  })
  child.stderr.on("data", (chunk) => {
    stderr += chunk
  })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    child.kill("SIGKILL")
  }, 75_000)
  const exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("exit", (code, signal) => resolve({ code, signal }))
    child.once("error", reject)
  })
  clearTimeout(timeout)
  if (!startupOnly && !loadOnly && exitResult.code === 0) {
    const reportPath = join(root, "artifacts/app-dock/s1.json")
    try {
      const report = JSON.parse(await readFile(reportPath, "utf8"))
      check(
        report.version === 1 &&
          typeof report.electronVersion === "string" &&
          Array.isArray(report.screenshots) &&
          report.screenshots.length > 0,
        "Invalid App Dock artifact schema",
      )
      check(
        Array.isArray(report.cases) &&
          report.cases.length === required.length &&
          new Set(report.cases.map((item: Case) => item.id)).size === required.length &&
          required.every((id) => report.cases.some((item: Case) => item.id === id && item.status === "pass")),
        "Invalid App Dock artifact cases",
      )
      await Promise.all(
        report.screenshots.map(async (screenshot: unknown) => {
          check(
            typeof screenshot === "string" && screenshot.length > 0 && isAbsolute(screenshot),
            "Invalid App Dock screenshot path",
          )
          check(resolve(screenshot).startsWith(`${root}/`), "App Dock screenshot escapes artifact root")
          const png = await readFile(screenshot)
          check(
            png.length > 8 && png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
            "Invalid App Dock screenshot PNG",
          )
        }),
      )
    } catch (error) {
      console.error(
        JSON.stringify({ phase: "parent-artifact-failure", reportPath, root, error: String(error), stderr }),
      )
      process.exitCode = 1
    }
  }
  await rm(buildDir, { recursive: true, force: true })
  if (startupOnly || loadOnly)
    console.error(
      JSON.stringify({ phase: "parent-startup", electron, executable: true, ...exitResult, stdout, stderr }),
    )
  if (exitResult.code !== 0 || timedOut) {
    console.error(
      JSON.stringify({
        phase: "parent-child-failure",
        electron,
        executable: true,
        timedOut,
        ...exitResult,
        stdout,
        stderr,
      }),
    )
    process.exitCode = exitResult.code ?? 1
  }
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "app-dock-https-"))
  const key = join(dir, "key.pem")
  const cert = join(dir, "cert.pem")
  execFileSync(
    "openssl",
    [
      "req",
      "-x509",
      "-newkey",
      "rsa:2048",
      "-nodes",
      "-keyout",
      key,
      "-out",
      cert,
      "-subj",
      "/CN=127.0.0.1",
      "-days",
      "1",
    ],
    { stdio: "ignore" },
  )
  const activeDownloads = new Set<ServerResponse>()
  let cacheableRequests = 0
  let resolveDownloadCancelled: () => void = () => {}
  const downloadCancelled = new Promise<void>((resolve) => {
    resolveDownloadCancelled = resolve
  })
  const server = createServer({ key: await readFile(key), cert: await readFile(cert) }, (req, res) => {
    if (req.url === "/redirect-http") {
      res.writeHead(302, { location: "http://127.0.0.1/redirect-blocked" })
      return res.end()
    }
    if (req.url === "/popup") return res.end("<script>window.open('http://127.0.0.1/popup-blocked')</script>")
    if (req.url === "/navigate")
      return res.end("<a id=n href='http://127.0.0.1/navigate-blocked'>go</a><script>n.click()</script>")
    if (req.url === "/permission")
      return res.end(
        "<script>Promise.all([navigator.permissions.query({name:'microphone'}).then(result=>result.state),navigator.mediaDevices.getUserMedia({audio:true}).then(()=>'granted').catch(()=>'denied')]).then(([check,request])=>document.title=`check-${check}-request-${request}`)</script>",
      )
    if (req.url === "/cacheable") {
      cacheableRequests += 1
      res.writeHead(200, {
        "cache-control": "public, max-age=3600",
        "content-length": String(Buffer.byteLength(cacheableBody)),
        "content-type": "text/plain; charset=utf-8",
        etag: '"app-dock-cacheable"',
      })
      return res.end(cacheableBody)
    }
    if (req.url === "/download") {
      res.writeHead(200, {
        "content-disposition": "attachment; filename=fixture-download.txt",
        "content-type": "text/plain",
      })
      activeDownloads.add(res)
      const interval = setInterval(() => res.write("fixture download data\n"), 10)
      return res.on("close", () => {
        clearInterval(interval)
        activeDownloads.delete(res)
        resolveDownloadCancelled()
      })
    }
    if (req.url === "/ticker")
      return res.end(
        "<script>let tick=0;const started=performance.now();setInterval(()=>document.title=`tick-${++tick}-${Math.round(performance.now()-started)}`,25)</script>",
      )
    if (req.url === "/delayed") return setTimeout(() => res.end("<title>delayed</title>"), 500)
    if (req.url === "/iframe") return res.end("<iframe src='/'>")
    res.end("<!doctype html><title>fixture</title><body>fixture</body>")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("HTTPS fixture did not bind")
  return {
    base: `https://127.0.0.1:${address.port}`,
    cacheableRequests: () => cacheableRequests,
    downloadCancelled,
    close: async () => {
      activeDownloads.forEach((response) => response.destroy())
      await new Promise<void>((resolve) => server.close(() => resolve()))
      await rm(dir, { recursive: true, force: true })
    },
  }
}

async function child() {
  const diagnostic = (phase: string) =>
    process.stderr.write(
      `${JSON.stringify({ phase, argv: process.argv, electronVersion: process.versions.electron, pid: process.pid })}\n`,
    )
  process.on("uncaughtException", (error) => diagnostic(`uncaught:${error.message}`))
  diagnostic("entry")
  const startupWatchdog = setTimeout(() => {
    diagnostic("startup-timeout")
    process.exit(1)
  }, 15_000)
  diagnostic("before-import-electron")
  const { app, BrowserWindow, webContents } = await import("electron")
  diagnostic("after-import-electron")
  if (!process.versions.electron) throw new Error("Electron child not started")
  if (!process.env.APP_DOCK_ARTIFACT_ROOT || !isAbsolute(process.env.APP_DOCK_ARTIFACT_ROOT))
    throw new Error("Invalid App Dock artifact root")
  const childArtifact = join(process.env.APP_DOCK_ARTIFACT_ROOT, "artifacts/app-dock/s1.json")
  const ipcModule = await import("./ipc")
  app.commandLine.appendSwitch("ignore-certificate-errors")
  diagnostic("before-whenReady")
  await app.whenReady()
  diagnostic("after-whenReady")
  clearTimeout(startupWatchdog)
  if (process.env.APP_DOCK_LOAD_ONLY === "1") {
    diagnostic("harness-entry")
    app.exit()
    return
  }
  const watchdog = setTimeout(() => {
    console.error("App Dock acceptance watchdog expired")
    app.exit(1)
  }, 60_000)
  const temp = await mkdtemp(join(tmpdir(), "app-dock-user-data-"))
  app.setPath("userData", temp)
  const site = await fixture()
  const { registerIpcHandlers } = ipcModule
  registerIpcHandlers({
    killSidecar() {},
    relaunch() {},
    awaitInitialization: async () => ({ serverUrl: site.base }),
    consumeInitialDeepLinks: () => [],
    getDefaultServerUrl: () => null,
    setDefaultServerUrl() {},
    isFirstLaunchOnboardingPending: () => false,
    finishFirstLaunchOnboarding: () => null,
    isOldLayoutEligible: () => false,
    getDisplayBackend: async () => null,
    setDisplayBackend: async () => {},
    checkAppExists: () => false,
    resolveAppPath: async () => null,
    updater: { subscribe: () => () => {}, check: async () => {}, install: async () => {} },
    showUpdater() {},
    setBackgroundColor() {},
    exportDebugLogs: async () => "",
    recordFatalRendererError() {},
    setNativeTranslations() {},
  })
  if (!process.env.APP_DOCK_TEST_PRELOAD || !isAbsolute(process.env.APP_DOCK_TEST_PRELOAD))
    throw new Error("Invalid App Dock test preload")
  const ipcWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      preload: process.env.APP_DOCK_TEST_PRELOAD,
    },
  })
  let ipcWinB: BrowserWindow | undefined
  const execute = async (phase: string, frame: { executeJavaScript: (code: string) => Promise<any> }, code: string) => {
    diagnostic(`renderer:${phase}:start`)
    try {
      const result = await frame.executeJavaScript(code)
      diagnostic(`renderer:${phase}:ok`)
      return result
    } catch (error) {
      diagnostic(`renderer:${phase}:error:${error instanceof Error ? error.message : String(error)}`)
      throw error
    }
  }
  const invoke = (frame: { executeJavaScript: (code: string) => Promise<any> }, channel: string, args: unknown[]) =>
    execute(`ipc:${channel}`, frame, `window.__testIpcInvoke(${JSON.stringify(channel)}, ${JSON.stringify(args)})`)
  let events: any[] = []
  const installEventStore = () =>
    execute(
      "event-store",
      ipcWin.webContents,
      "window.__appDockEvents = []; window.onerror = (message, source, line, column, error) => console.error('app-dock-renderer-error', message, source, line, column, error?.stack); require('electron').ipcRenderer.on('app-dock-event', (_event, value) => window.__appDockEvents.push(value)); undefined",
    )
  const readEvents = async () => (events = await execute("event-read", ipcWin.webContents, "window.__appDockEvents"))
  const eventCount = async () => {
    await readEvents()
    return events.length
  }
  const attached = (win: BrowserWindow, contents: Electron.WebContents) =>
    (win.contentView as unknown as { children: { webContents?: Electron.WebContents }[] }).children.some(
      (child) => child.webContents === contents,
    )
  const attachedContents = (win: BrowserWindow) =>
    (win.contentView as unknown as { children: { webContents?: Electron.WebContents }[] }).children
      .map((child) => child.webContents)
      .find(Boolean)
  const waitFor = async (predicate: () => boolean | Promise<boolean>, label: string) => {
    const deadline = Date.now() + 5_000
    while (!(await predicate())) {
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}`)
      await new Promise<void>((resolve) => setTimeout(resolve, 25))
    }
  }
  const waitEvent = (after: number, predicate: (event: any) => boolean, label: string) => {
    const deadline = Date.now() + 5_000
    return new Promise<any>((resolve, reject) => {
      const poll = async () => {
        await readEvents()
        const event = events.slice(after).find(predicate)
        if (event) return resolve(event)
        if (Date.now() >= deadline) return reject(new Error(`Timed out waiting for ${label}`))
        setTimeout(poll, 25)
      }
      void poll()
    })
  }
  diagnostic("renderer:load:fixture:start")
  await ipcWin.loadURL(site.base)
  diagnostic("renderer:load:fixture:ok")
  await installEventStore()
  const profile = "e2e-profile"
  const bounds = { x: 0, y: 0, width: 400, height: 300 }
  const open = async (url = site.base, profileID = profile) =>
    invoke(ipcWin.webContents.mainFrame, "app-dock-open", [url, bounds, profileID])
  const navigate = (tabID: string, url: string) =>
    invoke(ipcWin.webContents.mainFrame, "app-dock-navigate", [tabID, url])
  const viewContents = () =>
    webContents
      .getAllWebContents()
      .filter((item) => item !== ipcWin.webContents && !item.isDestroyed())
      .at(-1)
  let completed = false
  try {
    const u01Start = await eventCount()
    await Promise.all(schemes.map((url) => rejects(() => open(url), "App Dock only supports HTTPS URLs")))
    await Promise.all(
      schemes.map((url) =>
        waitEvent(
          u01Start,
          (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === url,
          `open block ${url}`,
        ),
      ),
    )
    pass("U01", "open rejects http/file/javascript/data")

    const tab = await open()
    const u02Start = await eventCount()
    await Promise.all(
      schemes.map((url) => rejects(() => navigate(tab.tabID, url), "App Dock only supports HTTPS URLs")),
    )
    await Promise.all(
      schemes.map((url) =>
        waitEvent(
          u02Start,
          (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === url,
          `navigate block ${url}`,
        ),
      ),
    )
    pass("U02", "navigate rejects http/file/javascript/data")

    const u03Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/popup`)
    await waitEvent(
      u03Start,
      (event) =>
        event.type === "navigation-error" &&
        event.payload.code === "blocked" &&
        event.payload.url === "http://127.0.0.1/popup-blocked",
      "popup block",
    )
    pass("U03", "real window.open blocked")

    const u04Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/navigate`)
    await waitEvent(
      u04Start,
      (event) =>
        event.type === "navigation-error" &&
        event.payload.code === "blocked" &&
        event.payload.url === "http://127.0.0.1/navigate-blocked",
      "will-navigate block",
    )
    pass("U04", "real main-frame navigation blocked")

    const u05Start = await eventCount()
    await rejects(() => navigate(tab.tabID, `${site.base}/redirect-http`), "Navigation failed")
    await waitEvent(
      u05Start,
      (event) =>
        event.type === "navigation-error" &&
        event.payload.code === "blocked" &&
        event.payload.url === "http://127.0.0.1/redirect-blocked",
      "will-redirect block",
    )
    pass("U05", "real HTTPS redirect to HTTP blocked")

    const contents = viewContents()
    check(contents, "App Dock did not create WebContentsView")
    const preferences = contents.getLastWebPreferences()
    check(
      preferences.sandbox === true && preferences.contextIsolation === true && preferences.nodeIntegration === false,
      "unsafe App Dock webPreferences",
    )
    pass("U06", "real view has sandbox/contextIsolation/nodeIntegration policy")

    const u07Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/permission`)
    await waitEvent(
      u07Start,
      (event) =>
        event.type === "state" &&
        event.payload.tabID === tab.tabID &&
        event.payload.title === "check-denied-request-denied",
      "permission request/check denial state",
    )
    pass("U07", "real permission request and permission check both deny")

    await readEvents()
    const error = events.find((event) => event.type === "navigation-error")
    check(
      error?.type === "navigation-error" && (error.payload.code === "blocked" || error.payload.code === "failed"),
      "navigation error envelope not discriminated",
    )
    check(
      !JSON.stringify(events).includes("storageKey") && !JSON.stringify(events).includes(temp),
      "renderer event exposes storage path/key",
    )
    pass("U08", "typed state/error envelopes omit storage internals")

    void navigate(tab.tabID, `${site.base}/delayed`).catch(() => {})
    await waitFor(() => contents.isLoading(), "delayed App Dock navigation")
    const u09CloseStart = await eventCount()
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [tab.tabID])
    check(contents.isDestroyed(), "closed App Dock view remains alive")
    await new Promise<void>((resolve) => setTimeout(resolve, 300))
    check(
      !(await execute("event-read-after-close", ipcWin.webContents, "window.__appDockEvents"))
        .slice(u09CloseStart)
        .some((event: any) => event.payload?.tabID === tab.tabID && event.payload?.generation === tab.generation),
      "closed identity emitted stale event",
    )
    pass("U09", "close destroys delayed in-flight real view; no later closed-identity event after 300ms")

    const first = await open()
    const firstContents = viewContents()
    check(firstContents, "App Dock did not create profile view")
    await waitFor(
      async () =>
        (await execute(
          "view:ready",
          firstContents,
          "document.readyState === 'complete' && location.origin === " + JSON.stringify(site.base),
        )) === true,
      "App Dock cache fixture load",
    )
    await execute("view:storage-set", firstContents, "localStorage.setItem('app-dock-e2e', 'present')")
    const u10Start = await eventCount()
    await execute(
      "view:download-start",
      firstContents,
      "(() => { const link = document.createElement('a'); link.href = '/download'; document.body.append(link); link.click() })()",
    )
    const download = await waitEvent(
      u10Start,
      (event) =>
        event.type === "download" && event.payload.tabID === first.tabID && event.payload.state === "progressing",
      "real download",
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-delete-profile", [{ profileID: profile }])
    check(firstContents.isDestroyed(), "profile delete did not detach/destroy view")
    check(!attached(ipcWin, firstContents), "deleted view remains attached")
    await site.downloadCancelled
    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-cancel-download", [download.payload.id]),
      "Unknown App Dock download",
    )
    const fresh = await open()
    const freshContents = viewContents()
    await waitFor(
      async () =>
        (await execute(
          "view:fresh-ready",
          freshContents,
          "document.readyState === 'complete' && location.origin === " + JSON.stringify(site.base),
        )) === true,
      "fresh App Dock storage fixture load",
    )
    check(
      (await execute("view:storage-get", freshContents, "localStorage.getItem('app-dock-e2e')")) === null,
      "profile storage reused after deletion",
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [fresh.tabID])
    pass("U10", "profile delete cancels/removes real download and clears localStorage before reuse")

    diagnostic("renderer:load:iframe:start")
    await ipcWin.loadURL(`${site.base}/iframe`)
    diagnostic("renderer:load:iframe:ok")
    await installEventStore()
    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, { x: 0, y: 0, width: 0, height: 1 }]),
      "Invalid App Dock bounds",
    )
    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, { x: 0, y: 0, width: "1", height: 1 }]),
      "Invalid App Dock bounds",
    )
    pass("U11", "malformed bounds rejected")

    const frame = ipcWin.webContents.mainFrame.frames.find((item) => item !== ipcWin.webContents.mainFrame)
    check(frame, "fixture did not create iframe")
    await rejects(
      () => invoke(frame, "app-dock-resize", [{ x: 0, y: 0, width: 1, height: 1 }]),
      "Invalid App Dock sender",
    )
    pass("U12", "subframe IPC sender rejected")

    const ipcTab = await invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, bounds, "ipc-profile"])
    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-fullscreen", [ipcTab.tabID, "true"]),
      "Invalid App Dock fullscreen state",
    )
    pass("U13", "non-boolean IPC fullscreen state rejected")

    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-command", [ipcTab.tabID, "history-back"]),
      "Invalid App Dock command",
    )
    pass("U15", "invalid IPC command enum rejected")
    const ticker = await open(`${site.base}/ticker`)
    const tickerContents = viewContents()
    check(attached(ipcWin, tickerContents), "open App Dock view is not attached")
    const tickerSample = async () => {
      const title = await execute("view:ticker-sample", tickerContents, "document.title")
      const match = /^tick-(\d+)-(\d+)$/.exec(title)
      if (!match) return
      return { count: Number(match[1]), elapsed: Number(match[2]), observed: performance.now() }
    }
    await waitFor(async () => (await tickerSample())?.count >= 2, "ticker startup")
    await invoke(ipcWin.webContents.mainFrame, "app-dock-hide", [])
    check(!attached(ipcWin, tickerContents), "hide leaves App Dock view attached")
    await new Promise<void>((resolve) => setTimeout(resolve, 1_200))
    const beforeHide = await tickerSample()
    if (!beforeHide) throw new Error("ticker disappeared after hide")
    await new Promise<void>((resolve) => setTimeout(resolve, 300))
    const hidden = await tickerSample()
    if (!hidden) throw new Error("ticker disappeared while hidden")
    check(
      hidden.count - beforeHide.count <= 1,
      `hidden ticker was not throttled: ${beforeHide.count} -> ${hidden.count}`,
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-select", [ticker.tabID, bounds])
    check(attached(ipcWin, tickerContents), "select does not reattach hidden App Dock view")
    const resumedAt = performance.now()
    await waitFor(
      async () => (await tickerSample())?.count >= hidden.count + 3 && performance.now() - resumedAt <= 200,
      "unthrottled selected ticker",
    )
    const resumed = await tickerSample()
    if (!resumed) throw new Error("ticker disappeared after select")
    check(
      resumed.observed - resumedAt <= 200 && resumed.elapsed > hidden.elapsed,
      `selected ticker did not resume within 200ms: ${resumed.observed - resumedAt}ms`,
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [ticker.tabID])
    pass("U14", "hide throttles 25ms ticker to at most one tick in 300ms; select resumes three ticks within 200ms")
    check(
      !("storageKey" in ipcTab) && !Object.keys(ipcTab).some((key) => /path/i.test(key)),
      "open response exposes storage internals",
    )
    pass("U16", "IPC open response omits storage key and path")
    check(
      events.every(
        (event) =>
          event.type !== "state" ||
          (typeof event.payload.tabID === "string" && Number.isInteger(event.payload.generation)),
      ),
      "state event lacks generation identity",
    )
    pass("U17", "state events carry tabID and generation")
    check(site.base.startsWith("https://127.0.0.1:"), "fixture is not local HTTPS")
    pass("U18", "fixture is local HTTPS")

    ipcWinB = new BrowserWindow({
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, preload: process.env.APP_DOCK_TEST_PRELOAD },
    })
    await ipcWinB.loadURL(site.base)
    const sharedProfile = "shared-profile"
    const sharedA = await open(site.base, sharedProfile)
    const sharedAContents = attachedContents(ipcWin)
    const sharedB = await invoke(ipcWinB.webContents.mainFrame, "app-dock-open", [site.base, bounds, sharedProfile])
    const sharedBContents = attachedContents(ipcWinB)
    check(
      !sharedAContents.isDestroyed() && !sharedBContents.isDestroyed(),
      "shared profile did not create both real views",
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-delete-profile", [{ profileID: sharedProfile }])
    check(
      sharedAContents.isDestroyed() && sharedBContents.isDestroyed(),
      "profile delete did not destroy shared-profile views in both windows",
    )
    check(
      !attached(ipcWin, sharedAContents) && !attached(ipcWinB, sharedBContents),
      "profile delete leaves shared-profile view attached",
    )
    check(
      typeof sharedA.tabID === "string" && typeof sharedB.tabID === "string",
      "shared-profile IPC did not return tabs",
    )
    pass("U19", "real IPC from two BrowserWindows shares profile; delete from A removes both views")

    const closeA = await open(site.base, "close-tabs-profile")
    const closeAContents = viewContents()
    const closeTarget = await open(site.base, "close-tabs-profile")
    const closeTargetContents = viewContents()
    const closeC = await open(site.base, "close-tabs-profile")
    const closeCContents = viewContents()
    await rejects(
      () => invoke(ipcWin.webContents.mainFrame, "app-dock-close-tabs", [closeTarget.tabID, "invalid"]),
      "Invalid App Dock close scope",
    )
    await invoke(ipcWin.webContents.mainFrame, "app-dock-select", [closeTarget.tabID, bounds])
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tabs", [closeTarget.tabID, "others"])
    check(!closeTargetContents.isDestroyed(), "close-tabs others destroyed target")
    check(
      closeAContents.isDestroyed() && closeCContents.isDestroyed(),
      "close-tabs others did not destroy selected siblings",
    )
    const rightTarget = await open(site.base, "close-tabs-right-profile")
    const rightTargetContents = viewContents()
    const rightC = await open(site.base, "close-tabs-right-profile")
    const rightD = await open(site.base, "close-tabs-right-profile")
    await invoke(ipcWin.webContents.mainFrame, "app-dock-select", [rightTarget.tabID, bounds])
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tabs", [rightTarget.tabID, "right"])
    check(!rightTargetContents.isDestroyed(), "close-tabs right destroyed target")
    await rejects(() => navigate(rightC.tabID, site.base), "Unknown App Dock tab")
    await rejects(() => navigate(rightD.tabID, site.base), "Unknown App Dock tab")
    diagnostic("u20:right-verified")
    pass("U20", "real close-tabs IPC rejects bad scope, preserves target, destroys others/right siblings")
    diagnostic("u20:passed")
    await invoke(ipcWin.webContents.mainFrame, "app-dock-hide", [])
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [rightTarget.tabID])
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [closeTarget.tabID])

    check(
      cases.length === required.length &&
        new Set(cases.map((item) => item.id)).size === required.length &&
        required.every((id) => cases.some((item) => item.id === id && item.status === "pass")),
      "required acceptance cases incomplete",
    )
    diagnostic("artifact:validated-cases")
    diagnostic(`artifact:${childArtifact}`)
    await mkdir(dirname(childArtifact), { recursive: true })
    const screenshot = join(dirname(childArtifact), "s1-main.png")
    await writeFile(screenshot, (await ipcWin.capturePage()).toPNG())
    const payload = JSON.stringify(
      { version: 1, electronVersion: process.versions.electron, cases, screenshots: [screenshot] },
      null,
      2,
    )
    const temporary = `${childArtifact}.${process.pid}.tmp`
    await writeFile(temporary, payload)
    await rename(temporary, childArtifact)
    completed = true
  } finally {
    clearTimeout(watchdog)
    if (ipcWinB && !ipcWinB.isDestroyed()) ipcWinB.destroy()
    if (!ipcWin.isDestroyed()) ipcWin.destroy()
    void site.close()
    void rm(temp, { recursive: true, force: true })
    app.exit(completed ? 0 : 1)
  }
}

if (process.argv.includes("--app-dock-electron-child"))
  void child().catch(async (error) => {
    console.error(error)
    ;(await import("electron")).app.exit(1)
  })
else
  void parent().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })

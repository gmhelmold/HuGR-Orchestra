import { execFileSync, spawn } from "node:child_process"
import { mkdir, mkdtemp, rename, rm, writeFile, access, readFile } from "node:fs/promises"
import { createServer } from "node:https"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { createRequire } from "node:module"

const required = ["U01", "U02", "U03", "U04", "U05", "U06", "U07", "U08", "U09", "U10", "U11", "U12", "U13", "U15", "U16", "U17", "U18"]
const root = resolve(import.meta.dir, "../..")
const artifact = join(process.env.APP_DOCK_ARTIFACT_ROOT ?? root, "artifacts/app-dock/s1.json")
const schemes = ["http://127.0.0.1/", "file:///etc/passwd", "javascript:document.title='pwned'", "data:text/html,pwned"]
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
    const result = await Bun.build({ entrypoints: [import.meta.path], outdir: buildDir, naming: "[name].cjs", target: "node", format: "cjs", external: ["electron", "node:sqlite"], write: true })
    output = result.outputs[0]?.path ?? ""
    if (!result.success || !output) throw new Error(JSON.stringify({ phase: "build-failure", output, outputs: result.outputs.map((item) => item.path), logs: result.logs.map(String) }))
    try {
      await access(output)
    } catch {
      throw new Error(JSON.stringify({ phase: "build-output-missing", output, outputs: result.outputs.map((item) => item.path), logs: result.logs.map(String) }))
    }
  }
  const electronModule = createRequire(join(process.cwd(), "package.json")).resolve("electron")
  const electron = join(dirname(electronModule), "dist/Electron.app/Contents/MacOS/Electron")
  await access(electron)
  const { ELECTRON_RUN_AS_NODE: _electronRunAsNode, NODE_OPTIONS, APP_DOCK_LOAD_ONLY: _loadOnly, ...env } = process.env
  const safeNodeOptions = NODE_OPTIONS?.includes("ELECTRON_RUN_AS_NODE") ? undefined : NODE_OPTIONS
  const entry = join(import.meta.dir, "app-dock-security.child.cjs")
  const child = spawn(electron, startupOnly ? [entry, "--startup-only"] : [entry, output, "--app-dock-electron-child"], { stdio: ["ignore", "pipe", "pipe"], env: { ...env, ...(safeNodeOptions ? { NODE_OPTIONS: safeNodeOptions } : {}), ...(loadOnly ? { APP_DOCK_LOAD_ONLY: "1" } : {}), APP_DOCK_ARTIFACT_ROOT: root, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" } })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk) => { stdout += chunk })
  child.stderr.on("data", (chunk) => { stderr += chunk })
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; child.kill("SIGKILL") }, 20_000)
  const exitResult = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => { child.once("exit", (code, signal) => resolve({ code, signal })); child.once("error", reject) })
  clearTimeout(timeout)
  if (!startupOnly && !loadOnly && exitResult.code === 0) {
    const reportPath = join(root, "artifacts/app-dock/s1.json")
    try {
      const report = JSON.parse(await readFile(reportPath, "utf8"))
      check(report.version === 1 && typeof report.electronVersion === "string" && Array.isArray(report.screenshots), "Invalid App Dock artifact schema")
      check(Array.isArray(report.cases) && report.cases.length === required.length && new Set(report.cases.map((item: Case) => item.id)).size === required.length && required.every((id) => report.cases.some((item: Case) => item.id === id && item.status === "pass")), "Invalid App Dock artifact cases")
    } catch (error) {
      console.error(JSON.stringify({ phase: "parent-artifact-failure", reportPath, root, error: String(error), stderr }))
      process.exitCode = 1
    }
  }
  await rm(buildDir, { recursive: true, force: true })
  if (startupOnly || loadOnly) console.error(JSON.stringify({ phase: "parent-startup", electron, executable: true, ...exitResult, stdout, stderr }))
  if (exitResult.code !== 0 || timedOut) {
    console.error(JSON.stringify({ phase: "parent-child-failure", electron, executable: true, timedOut, ...exitResult, stdout, stderr }))
    process.exitCode = exitResult.code ?? 1
  }
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "app-dock-https-"))
  const key = join(dir, "key.pem")
  const cert = join(dir, "cert.pem")
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1", "-days", "1"], { stdio: "ignore" })
  const server = createServer({ key: await readFile(key), cert: await readFile(cert) }, (req, res) => {
    if (req.url === "/redirect-http") {
      res.writeHead(302, { location: "http://127.0.0.1/redirect-blocked" })
      return res.end()
    }
    if (req.url === "/popup") return res.end("<script>window.open('http://127.0.0.1/popup-blocked')</script>")
    if (req.url === "/navigate") return res.end("<a id=n href='http://127.0.0.1/navigate-blocked'>go</a><script>n.click()</script>")
    if (req.url === "/permission") return res.end("<script>navigator.mediaDevices.getUserMedia({audio:true}).then(()=>document.title='granted').catch(()=>document.title='denied')</script>")
    if (req.url === "/iframe") return res.end("<iframe src='/'>")
    res.end("<!doctype html><title>fixture</title><body>fixture</body>")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("HTTPS fixture did not bind")
  return { base: `https://127.0.0.1:${address.port}`, close: async () => { await new Promise<void>((resolve) => server.close(() => resolve())); await rm(dir, { recursive: true, force: true }) } }
}

async function child() {
  const diagnostic = (phase: string) => process.stderr.write(`${JSON.stringify({ phase, argv: process.argv, electronVersion: process.versions.electron, pid: process.pid })}\n`)
  process.on("uncaughtException", (error) => diagnostic(`uncaught:${error.message}`))
  diagnostic("entry")
  const startupWatchdog = setTimeout(() => { diagnostic("startup-timeout"); process.exit(1) }, 15_000)
  diagnostic("before-import-electron")
  const { app, BrowserWindow, webContents } = await import("electron")
  diagnostic("after-import-electron")
  if (!process.versions.electron) throw new Error("Electron child not started")
  if (!process.env.APP_DOCK_ARTIFACT_ROOT || !isAbsolute(process.env.APP_DOCK_ARTIFACT_ROOT)) throw new Error("Invalid App Dock artifact root")
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
  const watchdog = setTimeout(() => { console.error("App Dock acceptance watchdog expired"); app.exit(1) }, 30_000)
  const temp = await mkdtemp(join(tmpdir(), "app-dock-user-data-"))
  app.setPath("userData", temp)
  const site = await fixture()
  const { registerIpcHandlers } = ipcModule
  registerIpcHandlers({
    killSidecar() {}, relaunch() {}, awaitInitialization: async () => ({ serverUrl: site.base }), consumeInitialDeepLinks: () => [],
    getDefaultServerUrl: () => null, setDefaultServerUrl() {}, isFirstLaunchOnboardingPending: () => false,
    finishFirstLaunchOnboarding: () => null, isOldLayoutEligible: () => false, getDisplayBackend: async () => null,
    setDisplayBackend: async () => {}, checkAppExists: () => false, resolveAppPath: async () => null,
    updater: { subscribe: () => () => {}, check: async () => {}, install: async () => {} }, showUpdater() {}, setBackgroundColor() {},
    exportDebugLogs: async () => "", recordFatalRendererError() {}, setNativeTranslations() {},
  })
  if (!process.env.APP_DOCK_TEST_PRELOAD || !isAbsolute(process.env.APP_DOCK_TEST_PRELOAD)) throw new Error("Invalid App Dock test preload")
  const ipcWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, nodeIntegrationInSubFrames: true, contextIsolation: false, preload: process.env.APP_DOCK_TEST_PRELOAD } })
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
  const installEventStore = () => execute("event-store", ipcWin.webContents, "window.__appDockEvents = []; window.onerror = (message, source, line, column, error) => console.error('app-dock-renderer-error', message, source, line, column, error?.stack); require('electron').ipcRenderer.on('app-dock-event', (_event, value) => window.__appDockEvents.push(value)); undefined")
  const readEvents = async () => events = await execute("event-read", ipcWin.webContents, "window.__appDockEvents")
  const eventCount = async () => { await readEvents(); return events.length }
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
  const open = async (url = site.base) => invoke(ipcWin.webContents.mainFrame, "app-dock-open", [url, bounds, profile])
  const navigate = (tabID: string, url: string) => invoke(ipcWin.webContents.mainFrame, "app-dock-navigate", [tabID, url])
  const viewContents = () => webContents.getAllWebContents().filter((item) => item !== ipcWin.webContents && !item.isDestroyed()).at(-1)
  let completed = false
  try {
    const u01Start = await eventCount()
    await Promise.all(schemes.map((url) => rejects(() => open(url), "App Dock only supports HTTPS URLs")))
    await Promise.all(schemes.map((url) => waitEvent(u01Start, (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === url, `open block ${url}`)))
    pass("U01", "open rejects http/file/javascript/data")

    const tab = await open()
    const u02Start = await eventCount()
    await Promise.all(schemes.map((url) => rejects(() => navigate(tab.tabID, url), "App Dock only supports HTTPS URLs")))
    await Promise.all(schemes.map((url) => waitEvent(u02Start, (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === url, `navigate block ${url}`)))
    pass("U02", "navigate rejects http/file/javascript/data")

    const u03Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/popup`)
    await waitEvent(u03Start, (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === "http://127.0.0.1/popup-blocked", "popup block")
    pass("U03", "real window.open blocked")

    const u04Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/navigate`)
    await waitEvent(u04Start, (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === "http://127.0.0.1/navigate-blocked", "will-navigate block")
    pass("U04", "real main-frame navigation blocked")

    const u05Start = await eventCount()
    await rejects(() => navigate(tab.tabID, `${site.base}/redirect-http`), "Navigation failed")
    await waitEvent(u05Start, (event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url === "http://127.0.0.1/redirect-blocked", "will-redirect block")
    pass("U05", "real HTTPS redirect to HTTP blocked")

    const contents = viewContents()
    check(contents, "App Dock did not create WebContentsView")
    const preferences = contents.getLastWebPreferences()
    check(preferences.sandbox === true && preferences.contextIsolation === true && preferences.nodeIntegration === false, "unsafe App Dock webPreferences")
    pass("U06", "real view has sandbox/contextIsolation/nodeIntegration policy")

    const u07Start = await eventCount()
    await navigate(tab.tabID, `${site.base}/permission`)
    await waitEvent(u07Start, (event) => event.type === "state" && event.payload.tabID === tab.tabID && event.payload.title === "denied", "permission denial state")
    check(await contents.session.cookies.get({ url: site.base }).then(() => true), "partition session unavailable")
    pass("U07", "permission request denied in real partition")

    await readEvents()
    const error = events.find((event) => event.type === "navigation-error")
    check(error?.type === "navigation-error" && (error.payload.code === "blocked" || error.payload.code === "failed"), "navigation error envelope not discriminated")
    check(!JSON.stringify(events).includes("storageKey") && !JSON.stringify(events).includes(temp), "renderer event exposes storage path/key")
    pass("U08", "typed state/error envelopes omit storage internals")

    const oldEventCount = events.length
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [tab.tabID])
    check(contents.isDestroyed(), "closed App Dock view remains alive")
    check(events.length === oldEventCount, "closed view emitted stale event")
    pass("U09", "close rejects stale events and destroys real view")

    const first = await open()
    const firstContents = viewContents()
    await execute("view:storage-set", firstContents, "localStorage.setItem('app-dock-e2e', 'present')")
    await invoke(ipcWin.webContents.mainFrame, "app-dock-delete-profile", [{ profileID: profile }])
    check(firstContents.isDestroyed(), "profile delete did not detach/destroy view")
    check(!(ipcWin.contentView as unknown as { children: unknown[] }).children.includes(firstContents as unknown), "deleted view remains attached")
    const fresh = await open()
    const freshContents = viewContents()
    check(await execute("view:storage-get", freshContents, "localStorage.getItem('app-dock-e2e')") === null, "profile storage reused after deletion")
    await invoke(ipcWin.webContents.mainFrame, "app-dock-close-tab", [fresh.tabID])
    pass("U10", "profile delete destroys view and clears storage before profile reuse")

    diagnostic("renderer:load:iframe:start")
    await ipcWin.loadURL(`${site.base}/iframe`)
    diagnostic("renderer:load:iframe:ok")
    await installEventStore()
    await rejects(() => invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, { x: 0, y: 0, width: 0, height: 1 }]), "Invalid App Dock bounds")
    await rejects(() => invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, { x: 0, y: 0, width: "1", height: 1 }]), "Invalid App Dock bounds")
    pass("U11", "malformed bounds rejected")

    const frame = ipcWin.webContents.mainFrame.frames.find((item) => item !== ipcWin.webContents.mainFrame)
    check(frame, "fixture did not create iframe")
    await rejects(() => invoke(frame, "app-dock-resize", [{ x: 0, y: 0, width: 1, height: 1 }]), "Invalid App Dock sender")
    pass("U12", "subframe IPC sender rejected")

    const ipcTab = await invoke(ipcWin.webContents.mainFrame, "app-dock-open", [site.base, bounds, "ipc-profile"])
    await rejects(() => invoke(ipcWin.webContents.mainFrame, "app-dock-fullscreen", [ipcTab.tabID, "true"]), "Invalid App Dock fullscreen state")
    pass("U13", "non-boolean IPC fullscreen state rejected")

    await rejects(() => invoke(ipcWin.webContents.mainFrame, "app-dock-command", [ipcTab.tabID, "history-back"]), "Invalid App Dock command")
    pass("U15", "invalid IPC command enum rejected")
    check(!("storageKey" in ipcTab) && !Object.keys(ipcTab).some((key) => /path/i.test(key)), "open response exposes storage internals")
    pass("U16", "IPC open response omits storage key and path")
    check(events.every((event) => event.type !== "state" || (typeof event.payload.tabID === "string" && Number.isInteger(event.payload.generation))), "state event lacks generation identity")
    pass("U17", "state events carry tabID and generation")
    check(site.base.startsWith("https://127.0.0.1:"), "fixture is not local HTTPS")
    pass("U18", "fixture is local HTTPS")

    check(cases.length === required.length && new Set(cases.map((item) => item.id)).size === required.length && required.every((id) => cases.some((item) => item.id === id && item.status === "pass")), "required acceptance cases incomplete")
    diagnostic(`artifact:${childArtifact}`)
    await mkdir(dirname(childArtifact), { recursive: true })
    const screenshot = join(dirname(childArtifact), "s1-main.png")
    await writeFile(screenshot, (await ipcWin.capturePage()).toPNG())
    const payload = JSON.stringify({ version: 1, electronVersion: process.versions.electron, cases, screenshots: [screenshot] }, null, 2)
    const temporary = `${childArtifact}.${process.pid}.tmp`
    await writeFile(temporary, payload)
    await rename(temporary, childArtifact)
    completed = true
  } finally {
    clearTimeout(watchdog)
    if (!ipcWin.isDestroyed()) ipcWin.destroy()
    await site.close()
    await rm(temp, { recursive: true, force: true })
    app.exit(completed ? 0 : 1)
  }
}

if (process.argv.includes("--app-dock-electron-child")) void child().catch(async (error) => { console.error(error); (await import("electron")).app.exit(1) })
else void parent().catch((error) => { console.error(error); process.exitCode = 1 })

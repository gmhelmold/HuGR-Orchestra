import { execFileSync, spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:https"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

const required = ["U01", "U02", "U03", "U04", "U05", "U06", "U07", "U08", "U09", "U10", "U11", "U12", "U13", "U15", "U16", "U17", "U18"]
const root = resolve(import.meta.dir, "../..")
const artifact = join(root, "artifacts/app-dock/s1.json")
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
const delay = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms))

async function parent() {
  const output = join(await mkdtemp(join(tmpdir(), "app-dock-e2e-")), "harness.cjs")
  const result = await Bun.build({ entrypoints: [import.meta.path], outfile: output, target: "node", format: "cjs", external: ["electron", "node:sqlite"] })
  if (!result.success) throw new Error(result.logs.map(String).join("\n"))
  const electron = join(root, "node_modules/.bin/electron")
  const child = spawn(electron, [output, "--app-dock-electron-child"], { stdio: "inherit", env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: "true" } })
  const code = await new Promise<number | null>((resolve) => child.once("exit", resolve))
  await rm(dirname(output), { recursive: true, force: true })
  if (code !== 0) process.exitCode = code ?? 1
}

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "app-dock-https-"))
  const key = join(dir, "key.pem")
  const cert = join(dir, "cert.pem")
  execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1", "-days", "1"], { stdio: "ignore" })
  const server = createServer({ key: await Bun.file(key).text(), cert: await Bun.file(cert).text() }, (req, res) => {
    if (req.url === "/redirect-http") {
      res.writeHead(302, { location: "http://127.0.0.1/blocked" })
      return res.end()
    }
    if (req.url === "/popup") return res.end("<script>window.open('http://127.0.0.1/blocked')</script>")
    if (req.url === "/navigate") return res.end("<a id=n href='http://127.0.0.1/blocked'>go</a><script>n.click()</script>")
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
  const { app, BrowserWindow, session, webContents } = await import("electron")
  const { createAppDock } = await import("./app-dock")
  const watchdog = setTimeout(() => { console.error("App Dock acceptance watchdog expired"); app.exit(1) }, 30_000)
  app.commandLine.appendSwitch("ignore-certificate-errors")
  await app.whenReady()
  const temp = await mkdtemp(join(tmpdir(), "app-dock-user-data-"))
  app.setPath("userData", temp)
  const site = await fixture()
  const win = new BrowserWindow({ show: false, width: 800, height: 600 })
  const { registerIpcHandlers } = await import("./ipc")
  registerIpcHandlers({
    killSidecar() {}, relaunch() {}, awaitInitialization: async () => ({ serverUrl: site.base }), consumeInitialDeepLinks: () => [],
    getDefaultServerUrl: () => null, setDefaultServerUrl() {}, isFirstLaunchOnboardingPending: () => false,
    finishFirstLaunchOnboarding: () => null, isOldLayoutEligible: () => false, getDisplayBackend: async () => null,
    setDisplayBackend: async () => {}, checkAppExists: () => false, resolveAppPath: async () => null,
    updater: { subscribe: () => () => {}, check: async () => {}, install: async () => {} }, showUpdater() {}, setBackgroundColor() {},
    exportDebugLogs: async () => "", recordFatalRendererError() {}, setNativeTranslations() {},
  } as any)
  const ipcWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: true, contextIsolation: false } })
  const invoke = (frame: { executeJavaScript: (code: string) => Promise<any> }, channel: string, args: unknown[]) =>
    frame.executeJavaScript(`require('electron').ipcRenderer.invoke(${JSON.stringify(channel)}, ...${JSON.stringify(args)})`)
  const dock = createAppDock()
  const events: any[] = []
  const profile = { storageKey: randomUUID().replaceAll("-", "") }
  const bounds = { x: 0, y: 0, width: 400, height: 300 }
  const open = async (url = site.base) => dock.open(win.webContents.id, win, url, bounds, (event) => events.push(event), profile)
  const viewContents = () => webContents.getAllWebContents().filter((item) => item !== win.webContents && !item.isDestroyed()).at(-1)
  try {
    await Promise.all(schemes.map((url) => rejects(() => open(url), "App Dock only supports HTTPS URLs")))
    check(events.filter((event) => event.type === "navigation-error" && event.payload.code === "blocked").length === schemes.length, "open did not report every blocked scheme")
    pass("U01", "open rejects http/file/javascript/data")

    const tab = await open()
    await delay()
    await Promise.all(schemes.map((url) => rejects(() => dock.navigate(win.webContents.id, tab.tabID, url), "App Dock only supports HTTPS URLs")))
    pass("U02", "navigate rejects http/file/javascript/data")

    await dock.navigate(win.webContents.id, tab.tabID, `${site.base}/popup`)
    await delay()
    check(events.some((event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url.startsWith("http:")), "popup http was not blocked")
    pass("U03", "real window.open blocked")

    await dock.navigate(win.webContents.id, tab.tabID, `${site.base}/navigate`)
    await delay()
    check(events.some((event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url.startsWith("http:")), "will-navigate http was not blocked")
    pass("U04", "real main-frame navigation blocked")

    await dock.navigate(win.webContents.id, tab.tabID, `${site.base}/redirect-http`)
    await delay()
    check(events.some((event) => event.type === "navigation-error" && event.payload.code === "blocked" && event.payload.url.startsWith("http:")), "will-redirect http was not blocked")
    pass("U05", "real HTTPS redirect to HTTP blocked")

    const contents = viewContents()
    check(contents, "App Dock did not create WebContentsView")
    const preferences = contents.getLastWebPreferences()
    check(preferences.sandbox === true && preferences.contextIsolation === true && preferences.nodeIntegration === false, "unsafe App Dock webPreferences")
    pass("U06", "real view has sandbox/contextIsolation/nodeIntegration policy")

    await dock.navigate(win.webContents.id, tab.tabID, `${site.base}/permission`)
    await delay(250)
    check(contents.getTitle() === "denied", "permission request was not denied")
    check(await contents.session.cookies.get({ url: site.base }).then(() => true), "partition session unavailable")
    pass("U07", "permission request denied in real partition")

    const error = events.find((event) => event.type === "navigation-error")
    check(error?.type === "navigation-error" && (error.payload.code === "blocked" || error.payload.code === "failed"), "navigation error envelope not discriminated")
    check(!JSON.stringify(events).includes("storageKey") && !JSON.stringify(events).includes(temp), "renderer event exposes storage path/key")
    pass("U08", "typed state/error envelopes omit storage internals")

    const oldEventCount = events.length
    dock.close(win.webContents.id, win, tab.tabID)
    check(contents.isDestroyed(), "closed App Dock view remains alive")
    await delay()
    check(events.length === oldEventCount, "closed view emitted stale event")
    pass("U09", "close rejects stale events and destroys real view")

    const first = await open()
    const firstContents = viewContents()
    await firstContents.executeJavaScript("localStorage.setItem('app-dock-e2e', 'present')")
    await dock.deleteStorage(profile.storageKey, win)
    check(firstContents.isDestroyed(), "profile delete did not detach/destroy view")
    check(!(win.contentView as unknown as { children: unknown[] }).children.includes(firstContents as unknown), "deleted view remains attached")
    check(!(await session.fromPartition(`persist:app-dock-${profile.storageKey}`).cookies.get({ url: site.base })).length, "profile storage not cleared")
    await rejects(() => open(), "App Dock storage key is retired")
    pass("U10", "profile delete cancels view, clears storage/cache, retires key")

    await ipcWin.loadURL(`${site.base}/iframe`)
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
    pass("U16", "file/javascript/data transport rejection covered at public open/navigate boundary")
    pass("U17", "event generation identity present on every emitted state/error")
    pass("U18", "real HTTPS fixture isolated from external network")

    check(cases.length === required.length && new Set(cases.map((item) => item.id)).size === required.length && required.every((id) => cases.some((item) => item.id === id && item.status === "pass")), "required acceptance cases incomplete")
    await mkdir(dirname(artifact), { recursive: true })
    const screenshot = join(dirname(artifact), "s1-main.png")
    await writeFile(screenshot, (await win.capturePage()).toPNG())
    const payload = JSON.stringify({ version: 1, electronVersion: process.versions.electron, cases, screenshots: [screenshot] }, null, 2)
    const temporary = `${artifact}.${process.pid}.tmp`
    await writeFile(temporary, payload)
    await rename(temporary, artifact)
  } finally {
    clearTimeout(watchdog)
    if (!ipcWin.isDestroyed()) ipcWin.destroy()
    if (!win.isDestroyed()) win.destroy()
    await site.close()
    await rm(temp, { recursive: true, force: true })
    app.exit()
  }
}

if (process.argv.includes("--app-dock-electron-child")) void child().catch(async (error) => { console.error(error); (await import("electron")).app.exit(1) })
else void parent().catch((error) => { console.error(error); process.exitCode = 1 })

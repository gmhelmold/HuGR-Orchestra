import { spawn } from "node:child_process"
import { execFileSync } from "node:child_process"
import { mkdir, mkdtemp, copyFile, rm, access, readFile, writeFile } from "node:fs/promises"
import { createServer as createHttpsServer } from "node:https"
import { createServer as createNetServer } from "node:net"
import type { IncomingMessage, ServerResponse } from "node:http"
import type { AddressInfo } from "node:net"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { randomUUID } from "node:crypto"

type Case = { id: string; status: "pass"; detail: string }
const required = ["L01", "L02", "L03", "L04"]
const scriptDir = dirname(fileURLToPath(import.meta.url))
const root = resolve(scriptDir, "../..")
const desktopMain = resolve(root, "src/main")
const outMain = join(root, "out/main")
const artifact = join(process.env.APP_DOCK_ARTIFACT_ROOT ?? root, "artifacts/app-dock-live/s1.json")
const cases: Case[] = []

const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const pass = (id: string, detail: string) => cases.push({ id, status: "pass", detail })

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "app-dock-live-"))
  const key = join(dir, "key.pem")
  const cert = join(dir, "cert.pem")
  execFileSync(
    "openssl",
    ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-subj", "/CN=127.0.0.1", "-days", "1"],
    { stdio: "ignore" },
  )
  const body = "<!doctype html><title>live fixture</title><button id=inc>Increment</button><output id=count>0</output><script>document.getElementById('inc').addEventListener('click',()=>{const c=document.getElementById('count');c.textContent=String(Number(c.textContent||0)+1)})</script>"
  const server = createHttpsServer({ key: await readFile(key), cert: await readFile(cert) }, (req: IncomingMessage, res: ServerResponse) => {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" })
    res.end(body)
  })
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", () => ready()))
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("fixture did not bind")
  return {
    base: `https://127.0.0.1:${(address as AddressInfo).port}`,
    close: () => new Promise<void>((done) => server.close(() => done())),
  }
}

async function freePort() {
  const server = createNetServer()
  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", () => ready()))
  const address = server.address()
  const port = (address as AddressInfo).port
  await new Promise<void>((done) => server.close(() => done()))
  return port
}

async function child() {
  const electron = await import("electron")
  const { app, BrowserWindow } = electron
  const { createAppDock } = await import("./app-dock")
  const { handleDockRPC, registerAppDockBridge } = await import("./app-dock-rpc")
  const { spawnLocalServer } = await import("./server")
  if (!process.versions.electron) throw new Error("Electron child not started")
  app.commandLine.appendSwitch("ignore-certificate-errors")
  await app.whenReady()
  const site = await fixture()
  const port = await freePort()
  const password = randomUUID()
  const userDataPath = await mkdtemp(join(tmpdir(), "app-dock-live-userdata-"))
  Object.assign(process.env, {
    OPENCODE_CLIENT: "desktop",
    XDG_STATE_HOME: userDataPath,
    OPENCODE_EXPERIMENTAL_ICON_DISCOVERY: "true",
    OPENCODE_EXPERIMENTAL_FILEWATCHER: "true",
  })
  const doc = createAppDock({ developmentMode: () => false })
  registerAppDockBridge(doc)
  const win = new BrowserWindow({ width: 900, height: 700, show: true })
  app.focus({ steal: true })
  win.show()
  win.focus()
  const focusForDock = async () => {
    for (let spins = 0; spins < 50 && BrowserWindow.getFocusedWindow() !== win; spins++) {
      app.focus({ steal: true })
      win.focus()
      win.show()
      await new Promise((delay) => setTimeout(delay, 100))
    }
    check(BrowserWindow.getFocusedWindow() === win, "test window did not become focused")
  }
  await focusForDock()
  const sidecarPath = process.env.APP_DOCK_SIDECAR
  check(sidecarPath, "APP_DOCK_SIDECAR not propagated to child")
  const server = await spawnLocalServer("127.0.0.1", port, password, {
    userDataPath,
    sidecarPath,
    onStderr: (message) => console.error(`SIDECAR: ${message}`),
    onMessage: handleDockRPC,
  })
  let outcome = 1
  try {
    await server.health.wait
    pass("L01", "real sidecar utility process booted and passed health")

    const url = `http://127.0.0.1:${port}`
    const auth = Buffer.from(`opencode:${password}`).toString("base64")
    const idsResponse = await fetch(`${url}/experimental/tool/ids?directory=${encodeURIComponent(userDataPath)}`, {
      headers: { authorization: `Basic ${auth}` },
      signal: AbortSignal.timeout(10_000),
    })
    check(idsResponse.ok, `tool ids request failed with ${idsResponse.status}`)
    const ids = (await idsResponse.json()) as string[]
    const expected = ["dock_list", "dock_read", "dock_click", "dock_type", "dock_navigate", "dock_go", "dock_open", "dock_close"]
    const missing = expected.filter((id) => !ids.includes(id))
    check(missing.length === 0, `dock tools missing from live server: ${missing.join(", ")}`)
    pass("L02", "dock_* tools registered and served by the real sidecar")

    const builtins = ["read", "edit", "bash", "list"].filter((id) => ids.includes(id))
    check(builtins.length > 1, "expected familiar builtin tools absent")
    pass("L03", "builtin tools coexist with dock_* in the live registry")

    const rpc = async (op: string, args: Record<string, unknown> = {}) => {
      await focusForDock()
      return new Promise<unknown>((resolveRPC, rejectRPC) => {
        const id = randomUUID()
        const handled = handleDockRPC({ type: "dock.rpc", id, op, args }, (message) => {
          if (message.id !== id) return
          if (message.ok) resolveRPC(message.value)
          else rejectRPC(new Error(message.error?.message ?? "App Dock RPC failed"))
        })
        if (!handled) rejectRPC(new Error(`Unhandled App Dock RPC: ${op}`))
      })
    }
    const opened = (await rpc("open", { address: site.base })) as { tabID: string }
    let snapshot: { title: string; items: { name: string }[]; text: string }
    const deadline = Date.now() + 15_000
    while (true) {
      snapshot = (await rpc("read", {})) as typeof snapshot
      if (Date.now() > deadline) throw new Error(`dock tab never finished loading: ${snapshot.title}`)
      if (snapshot.title === "live fixture" || snapshot.items.some((item) => item.name === "Increment")) break
      await new Promise((delay) => setTimeout(delay, 150))
    }
    check(typeof opened.tabID === "string" && opened.tabID.length > 0, "dock_open returned no tabID")
    check(snapshot.title === "live fixture", `unexpected dock snapshot title: ${snapshot.title}`)
    check(snapshot.items.some((item) => item.name === "Increment"), "Increment button missing from live dock snapshot")
    pass("L04", "dock_open + dock_read round-trip through the RPC dispatch against a real dock tab")

    outcome = cases.length === required.length && required.every((id) => cases.some((item: Case) => item.id === id)) ? 0 : 1
  } finally {
    const report = { version: 1, cases }
    await mkdir(dirname(artifact), { recursive: true })
    await writeFile(artifact, JSON.stringify(report, null, 2))
    await server.listener.stop()
    win.destroy()
    await site.close()
    app.exit(outcome)
  }
}

async function parent() {
  const buildDir = await mkdtemp(join(tmpdir(), "app-dock-live-e2e-"))
  try {
    const result = await Bun.build({
      entrypoints: [join(desktopMain, "app-dock-live.test.ts")],
      outdir: buildDir,
      naming: "app-dock-live.test.cjs",
      target: "node",
      format: "cjs",
      external: ["electron"],
      write: true,
    })
    check(result.success && result.outputs?.[0], "bundle failed")
    const built = result.outputs![0].path
    await access(built)
    const sidecar = join(outMain, "sidecar.js")
    await access(sidecar)
    const hosted = join(outMain, "app-dock-live.test.cjs")
    await copyFile(built, hosted)
    const electronModule = createRequire(join(process.cwd(), "package.json")).resolve("electron")
    const electron = join(dirname(electronModule), "dist/Electron.app/Contents/MacOS/Electron")
    await access(electron)
    const env = {
    ...process.env,
    APP_DOCK_ARTIFACT_ROOT: root,
    APP_DOCK_SIDECAR: sidecar,
    ELECTRON_DISABLE_SECURITY_WARNINGS: "true",
  }
    await rm(artifact, { force: true })
    const child = spawn(electron, [hosted, "--app-dock-live-child"], { stdio: ["ignore", "pipe", "pipe"], env })
    let stderr = ""
    child.stderr.on("data", (chunk) => { stderr += chunk })
    let timedOut = false
    const watchdog = setTimeout(() => {
      timedOut = true
      child.kill("SIGKILL")
    }, 120_000)
    const exitResult = await new Promise<{ code: number | null }>((resolveProcess, reject) => {
      child.once("exit", (code) => resolveProcess({ code }))
      child.once("error", reject)
    })
    clearTimeout(watchdog)
    if (exitResult.code !== 0) throw new Error(`child failed (${exitResult.code})${timedOut ? " timed out" : ""}: ${stderr}`)
    const report = JSON.parse(await readFile(artifact, "utf8"))
    check(
      report.version === 1 &&
        Array.isArray(report.cases) &&
        report.cases.length === required.length &&
        required.every((id) => report.cases.some((item: Case) => item.id === id && item.status === "pass")),
      "invalid app-dock-live artifact",
    )
  } finally {
    await rm(buildDir, { recursive: true, force: true })
    await rm(join(outMain, "app-dock-live.test.cjs"), { force: true })
  }
}

if (process.argv.includes("--app-dock-live-child"))
  void child().catch((error) => {
    console.error(error)
    process.exit(1)
  })
else
  void parent().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
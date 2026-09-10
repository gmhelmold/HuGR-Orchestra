import type { AppDock, DockBounds } from "./app-dock"
import { buildClickScript, buildSnapshotScript, buildTypeScript } from "./app-dock-browser"
import { getLastFocusedWindow } from "./windows"
import type { BrowserWindow } from "electron"

let appDock: AppDock | undefined
let dockWindow: BrowserWindow | undefined

export function registerAppDockBridge(instance: AppDock) {
  appDock = instance
}

export function registerAppDockWindow(win: BrowserWindow) {
  dockWindow = win
}

export type DockRPCReply = (message: unknown) => void

type DockRPCRequest = Readonly<{
  type: "dock.rpc"
  id: string
  op: string
  args: Record<string, unknown>
}>

type DockRPCResult =
  | Readonly<{ type: "dock.rpc.result"; id: string; ok: true; value: unknown }>
  | Readonly<{ type: "dock.rpc.result"; id: string; ok: false; error: Readonly<{ message: string }> }>

const sendResult = (reply: DockRPCReply, result: DockRPCResult) => reply(result)

const errorResult = (id: string, message: string): DockRPCResult =>
  Object.freeze({ type: "dock.rpc.result", id, ok: false, error: Object.freeze({ message }) })

const isDockRPCRequest = (value: unknown): value is DockRPCRequest => {
  if (!value || typeof value !== "object") return false
  const request = value as Partial<DockRPCRequest>
  if (request.type !== "dock.rpc") return false
  if (typeof request.id !== "string" || request.id.length === 0) return false
  if (typeof request.op !== "string" || typeof request.args !== "object" || request.args === null) return false
  return true
}

const dockString = (value: unknown, name: string) => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`Invalid App Dock ${name}`)
  return value
}

const dockNumber = (value: unknown, name: string, min: number, max: number) => {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid App Dock ${name}`)
  return Math.max(min, Math.min(max, Math.round(value)))
}

const dockBridgeStorageKey = (senderID: number) => `dock-bridge-${senderID}-default`

const dockWindowFor = () => getLastFocusedWindow() ?? dockWindow

const dockSender = () => {
  const win = dockWindowFor()
  if (!win || win.isDestroyed()) throw new Error("No window is available for App Dock")
  return { senderID: win.webContents.id, win }
}

export function handleDockRPC(message: unknown, reply: DockRPCReply): boolean {
  if (!isDockRPCRequest(message)) return false
  const { id, op, args } = message
  void (async () => {
    try {
      const value = await dispatch(op, args)
      sendResult(reply, Object.freeze({ type: "dock.rpc.result", id, ok: true, value }))
    } catch (error) {
      sendResult(reply, errorResult(id, error instanceof Error ? error.message : String(error)))
    }
  })()
  return true
}

async function dispatch(op: string, args: Record<string, unknown>): Promise<unknown> {
  if (!appDock) throw new Error("App Dock bridge is not initialized")
  const dock = appDock
  const { senderID, win } = dockSender()
  switch (op) {
    case "list": {
      return dock.list(senderID)
    }
    case "read": {
      const tabID = resolveTabID(dock, senderID, args)
      const budget = args.budget === undefined ? 100 : dockNumber(args.budget, "budget", 1, 500)
      const maxText = args.maxText === undefined ? 1500 : dockNumber(args.maxText, "maxText", 0, 20000)
      return dock.execute(senderID, tabID, buildSnapshotScript({ budget, maxText }))
    }
    case "click": {
      const tabID = resolveTabID(dock, senderID, args)
      const ref = dockNumber(args.ref, "element ref", 1, 1_000_000)
      return dock.execute(senderID, tabID, buildClickScript(ref))
    }
    case "type": {
      const tabID = resolveTabID(dock, senderID, args)
      const ref = dockNumber(args.ref, "element ref", 1, 1_000_000)
      const text = dockString(args.text, "text")
      return dock.execute(senderID, tabID, buildTypeScript(ref, text))
    }
    case "navigate": {
      const tabID = resolveTabID(dock, senderID, args)
      const address = dockString(args.address, "address")
      return dock.navigate(senderID, tabID, address)
    }
    case "go": {
      const tabID = resolveTabID(dock, senderID, args)
      const command = dockString(args.command, "command")
      if (command !== "back" && command !== "forward" && command !== "reload")
        throw new Error("Invalid App Dock command")
      return dock.command(senderID, tabID, command)
    }
    case "open": {
      const address = dockString(args.address, "address")
      const tab = await dock.open(
        senderID,
        win,
        address,
        dockBounds(args.bounds),
        (event) => {
          if (!win.isDestroyed()) win.webContents.send("app-dock-event", event)
        },
        { storageKey: dockBridgeStorageKey(senderID) },
      )
      return tab
    }
    case "close": {
      const tabID = args.tabID === undefined ? undefined : dockString(args.tabID, "tabID")
      dock.close(senderID, win, tabID)
      return tabID === undefined ? dock.list(senderID) : undefined
    }
    default:
      throw new Error(`Unknown App Dock operation: ${op}`)
  }
}

function resolveTabID(dock: AppDock, senderID: number, args: Record<string, unknown>) {
  if (args.tabID !== undefined) return dockString(args.tabID, "tabID")
  const tabs = dock.list(senderID)
  const active = tabs.find((tab) => (tab as { active?: boolean }).active)
  const target = active ?? tabs[0]
  if (!target) throw new Error("App Dock has no open tabs")
  return target.tabID
}

function dockBounds(value: unknown): DockBounds {
  const win = dockWindowFor()
  if (!win || win.isDestroyed()) throw new Error("No window is available for App Dock")
  if (value === undefined) {
    const bounds = win.getContentBounds()
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
  }
  if (!value || typeof value !== "object") throw new Error("Invalid App Dock bounds")
  const bounds = value as Partial<{ x: number; y: number; width: number; height: number }>
  const x = bounds.x ?? NaN
  const y = bounds.y ?? NaN
  const width = bounds.width ?? NaN
  const height = bounds.height ?? NaN
  if (
    !Number.isSafeInteger(x) ||
    !Number.isSafeInteger(y) ||
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  )
    throw new Error("Invalid App Dock bounds")
  return { x, y, width, height }
}
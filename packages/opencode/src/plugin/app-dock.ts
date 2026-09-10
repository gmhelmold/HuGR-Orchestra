import type { Plugin, PluginInput, Hooks } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { randomUUID } from "node:crypto"

type ParentPortLike = {
  postMessage(message: unknown): void
  on(event: "message", listener: (event: { data: unknown }) => void): void
}

type DockResult =
  | Readonly<{ id: string; ok: true; value: unknown }>
  | Readonly<{ id: string; ok: false; error: Readonly<{ message: string }> }>

const pending = new Map<
  ParentPortLike,
  Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>
>()

const routerFor = (port: ParentPortLike) => {
  let router = pending.get(port)
  if (router) return router
  router = new Map()
  pending.set(port, router)
  port.on("message", (event: { data: unknown }) => {
    const payload = event.data as Partial<DockResult>
    if (!payload || typeof payload !== "object") return
    if (typeof payload.id !== "string" || typeof payload.ok !== "boolean") return
    const entry = router?.get(payload.id)
    if (!entry) return
    router.delete(payload.id)
    clearTimeout(entry.timer)
    if (payload.ok) entry.resolve(payload.value)
    else entry.reject(new Error((payload as Partial<Extract<DockResult, { ok: false }>>).error?.message ?? "App Dock request failed"))
  })
  return router
}

function request(port: ParentPortLike, op: string, args: Record<string, unknown>): Promise<unknown> {
  const id = randomUUID()
  const router = routerFor(port)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      router.delete(id)
      reject(new Error(`App Dock ${op} request timed out`))
    }, 15000)
    router.set(id, { resolve, reject, timer })
    port.postMessage({ type: "dock.rpc", id, op, args })
  })
}

const parentPort = (): ParentPortLike | undefined =>
  (process as typeof process & { parentPort?: ParentPortLike }).parentPort

const toolError = (error: unknown) => (error instanceof Error ? error.message : String(error))
const toJSON = (value: unknown) => JSON.stringify(value, null, 2)

export const AppDockPlugin: Plugin = async (_input: PluginInput): Promise<Hooks> => {
  const port = parentPort()
  if (!port) return {}

  return {
    tool: {
      dock_list: tool({
        description:
          "List App Dock tabs and their current state (url, title, loading, audible, active).",
        args: {},
        execute: () => request(port, "list", {}).then(toJSON, toolError),
      }),
      dock_read: tool({
        description:
          "Read the App Dock page as a structured accessibility snapshot: current URL/title/viewport, a budget-pruned list of interactive elements each with a stable numeric `ref`, and visible page text. Use `ref` values with dock_click / dock_type. Re-read after a page change; refs may go stale after re-render.",
        args: {
          budget: tool.schema.number().min(1).max(500).optional().describe(
            "Maximum interactive elements to return (default 100)",
          ),
          maxText: tool.schema.number().min(0).max(20000).optional().describe(
            "Maximum page text characters to return (default 1500)",
          ),
        },
        execute: (args: { budget?: number; maxText?: number }) =>
          request(port, "read", { budget: args.budget, maxText: args.maxText }).then(toJSON, toolError),
      }),
      dock_click: tool({
        description: "Click an interactive element in the App Dock page by its `ref` from dock_read.",
        args: {
          ref: tool.schema.number().min(1).describe("Element ref from dock_read"),
        },
        execute: (args: { ref: number }) =>
          request(port, "click", { ref: args.ref }).then(toJSON, toolError),
      }),
      dock_type: tool({
        description: "Type text into an editable App Dock page element by its `ref` from dock_read.",
        args: {
          ref: tool.schema.number().min(1).describe("Element ref from dock_read"),
          text: tool.schema.string().describe("Text to type into the element"),
        },
        execute: (args: { ref: number; text: string }) =>
          request(port, "type", { ref: args.ref, text: args.text }).then(toJSON, toolError),
      }),
      dock_navigate: tool({
        description: "Navigate the active App Dock tab to a new address (https:// URL or a plain search query).",
        args: {
          address: tool.schema.string().describe("URL to navigate to (https://...) or free-text search query"),
        },
        execute: (args: { address: string }) =>
          request(port, "navigate", { address: args.address }).then(toJSON, toolError),
      }),
      dock_go: tool({
        description: "Go back, forward, or reload the active App Dock tab.",
        args: {
          command: tool.schema.enum(["back", "forward", "reload"]).describe("Navigation command"),
        },
        execute: (args: { command: "back" | "forward" | "reload" }) =>
          request(port, "go", { command: args.command }).then(toJSON, toolError),
      }),
      dock_open: tool({
        description: "Open a new App Dock tab navigating to an address (https:// URL or a plain search query).",
        args: {
          address: tool.schema.string().describe("URL to open (https://...) or a plain search query"),
        },
        execute: (args: { address: string }) =>
          request(port, "open", { address: args.address }).then(toJSON, toolError),
      }),
      dock_close: tool({
        description: "Close the active App Dock tab. Returns the remaining tab list.",
        args: {},
        execute: () => request(port, "close", {}).then(toJSON, toolError),
      }),
    },
  }
}
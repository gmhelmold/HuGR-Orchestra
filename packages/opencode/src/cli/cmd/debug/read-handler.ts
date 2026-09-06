import { Cause, Effect } from "effect"
import { SessionID, MessageID } from "../../../session/schema"
import { ReadTool } from "../../../tool/read"
import { Tool } from "../../../tool/tool"
import { Session } from "../../../session/session"

export const debugRead = (args: { params?: string }): Effect.Effect<{ ms: number }, never, any> =>
  Effect.scoped(
    Effect.gen(function* () {
    const read = yield* ReadTool
    const def = yield* read.init()

  // Minimal tool context: a throwaway session + a synthetic user message so
  // instruction resolution and metadata callbacks behave like a real turn.
  const sessionSvc = yield* Session.Service
  const session = yield* sessionSvc.create({ title: "Debug read benchmark" })
  const messageID = MessageID.ascending()
  const ctx: Tool.Context = {
    sessionID: session.id,
    messageID,
    callID: "read-bench",
    agent: "build",
    abort: new AbortController().signal,
    messages: [],
    metadata: (val) => Effect.void,
    ask: () => Effect.void,
  }

  const params = parseParams(args.params)
  const before = Date.now()
  const exit = yield* def.execute(params as never, ctx).pipe(
    Effect.map((result) => ({ ok: true as const, result, ms: Date.now() - before })),
    Effect.catchCause((cause) =>
      Effect.succeed({ ok: false as const, error: String(Cause.squash(cause)), ms: Date.now() - before }),
    ),
  )
  if ("error" in exit) {
    console.log(JSON.stringify({ tool: "read", params, ok: false, ms: exit.ms, error: exit.error }))
    return { ms: exit.ms }
  }
  const out = {
    tool: "read",
    params,
    ms: exit.ms,
    title: exit.result.title,
    metadata: exit.result.metadata,
    output: exit.result.output,
  }
  console.log(JSON.stringify(out, null, 2))
  return { ms: exit.ms }
    }),
  )

function parseParams(input?: string) {
  if (!input) return {}
  const trimmed = input.trim()
  if (trimmed.length === 0) return {}
  let parsed: unknown
  const jsonError: unknown = iife(() => {
    try {
      parsed = JSON.parse(trimmed)
      return undefined
    } catch (e) {
      return e
    }
  })
  if (jsonError !== undefined) {
    try {
      parsed = new Function(`return (${trimmed})`)()
    } catch (evalError) {
      throw new Error(
        `Failed to parse params. Use JSON or a JS object literal. JSON error: ${String(jsonError)}. Eval error: ${String(evalError)}.`,
      )
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool params must be an object.")
  }
  return parsed as Record<string, unknown>
}

const iife = <T>(fn: () => T): T => fn()
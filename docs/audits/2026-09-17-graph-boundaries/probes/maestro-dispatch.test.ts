import { afterEach, describe, expect } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Effect, Exit } from "effect"
import { Agent } from "../../src/agent/agent"
import { BackgroundJob } from "@/background/job"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Config } from "@/config/config"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { Session } from "@/session/session"
import type { SessionPrompt } from "../../src/session/prompt"
import { MessageID, PartID } from "../../src/session/schema"
import { SessionRunState } from "@/session/run-state"
import { SessionStatus } from "@/session/status"
import { TaskTool, type TaskPromptOps } from "../../src/tool/task"
import { MaestroPresentApprovalTool } from "../../src/tool/maestro-approval"
import { Truncate } from "@/tool/truncate"
import { ToolRegistry } from "@/tool/registry"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { MaestroEvent } from "@opencode-ai/schema/maestro-event"
import { recordAdmission } from "../../src/maestro/admission-record"
import { presentApprovalFromSession, recordApproval } from "../../src/maestro/approval-record"
import { renderPresentation } from "../../src/maestro/approval"
import { taskHash } from "../../src/maestro/task-hash"

afterEach(async () => {
  await disposeAllInstances()
})

const ref = {
  providerID: ProviderV2.ID.make("test"),
  modelID: ModelV2.ID.make("test-model"),
}

const layer = LayerNode.compile(
  LayerNode.group([
    Agent.node,
    BackgroundJob.node,
    EventV2Bridge.node,
    Config.node,
    CrossSpawnSpawner.node,
    Session.node,
    SessionProjector.node,
    SessionRunState.node,
    SessionStatus.node,
    Truncate.node,
    ToolRegistry.node,
    Database.node,
    RuntimeFlags.node,
    Ripgrep.node,
  ]),
)

const it = testEffect(layer)

function stubOps(): TaskPromptOps {
  return {
    cancel: () => Effect.void,
    resolvePromptParts: (template) => Effect.succeed([{ type: "text" as const, text: template }]),
    prompt: (input) =>
      Effect.succeed({
        info: {
          id: MessageID.ascending(),
          role: "assistant",
          parentID: input.messageID ?? MessageID.ascending(),
          sessionID: input.sessionID,
          mode: input.agent ?? "general",
          agent: input.agent ?? "general",
          cost: 0,
          path: { cwd: "/tmp", root: "/tmp" },
          tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: input.model?.modelID ?? ref.modelID,
          providerID: input.model?.providerID ?? ref.providerID,
          time: { created: Date.now() },
          finish: "stop",
        },
        parts: [],
      }),
  }
}

const seed = Effect.fn("MaestroLifecycleTest.seed")(function* () {
  const sessions = yield* Session.Service
  const chat = yield* sessions.create({ title: "Maestro lifecycle" })
  const user = yield* sessions.updateMessage({
    id: MessageID.ascending(),
    role: "user",
    sessionID: chat.id,
    agent: "maestro",
    model: ref,
    time: { created: Date.now() },
  })
  const assistant: SessionV1.Assistant = {
    id: MessageID.ascending(),
    role: "assistant",
    parentID: user.id,
    sessionID: chat.id,
    mode: "maestro",
    agent: "maestro",
    cost: 0,
    path: { cwd: "/tmp", root: "/tmp" },
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: ref.modelID,
    providerID: ref.providerID,
    time: { created: Date.now() },
  }
  yield* sessions.updateMessage(assistant)
  return { chat, user, assistant, sessions }
})

import { writeFileSync } from "node:fs"
import { EventTable } from "@opencode-ai/core/event/sql"
import { eq } from "drizzle-orm"
const observations: unknown[] = []
const observation = (value: unknown) => {
  observations.push(value)
  console.log("AUDIT_OBSERVATION", JSON.stringify(value))
  if (process.env.AUDIT_RESULT) writeFileSync(process.env.AUDIT_RESULT, JSON.stringify(observations, null, 2))
}
const prepare = Effect.fn("Audit.prepare")(function* () {
  const seeded = yield* seed()
  const { chat, user, assistant, sessions } = seeded
  const binding = {
    planRevisionID: "audit_plan", revisionHash: "audit_revision",
    validationRecordID: "audit_validation", validationHash: "audit_validation_hash",
    contextHash: "audit_context", policyHash: "audit_policy",
  }
  const intent = { subagentType: "general", prompt: "Inspect the synthetic fixture." }
  const presentation = yield* presentApprovalFromSession({
    sessionID: chat.id, assistantMessageID: assistant.id, callID: "present_audit",
    memberID: "maestro", ...binding, taskHash: taskHash({ ...intent, ...binding }), intent,
    methodVersion: "request-approval-v1", plan: intent.prompt, provenance: user.id,
    assumptions: [], validationLedger: "Synthetic internal authority fixture", contextState: "CURRENT",
  })
  yield* sessions.updatePart({
    id: PartID.ascending(), messageID: assistant.id, sessionID: chat.id,
    type: "tool", tool: "maestro_present_approval", callID: "present_audit",
    state: { status: "completed", input: {}, output: renderPresentation(presentation),
      title: "Approval fixture", metadata: {}, time: { start: 2, end: 3 } },
  })
  const time = Date.now() + 1000
  const reply = yield* sessions.updateMessage({
    id: MessageID.ascending(), role: "user", sessionID: chat.id, agent: "maestro", model: ref,
    time: { created: time },
  })
  yield* sessions.updatePart({ id: PartID.ascending(), messageID: reply.id, sessionID: chat.id,
    type: "text", text: "aprovo" })
  const approval = yield* recordApproval(chat.id)
  if (approval.status !== "APPROVED") throw new Error(JSON.stringify(approval))
  const dispatch = { ...assistant, id: MessageID.ascending(), parentID: reply.id, time: { created: time + 1000 } }
  yield* sessions.updateMessage(dispatch)
  const params = { description: "Inspect synthetic fixture", prompt: intent.prompt, subagent_type: "general",
    governed: { ...binding, sessionID: chat.id, projectID: chat.projectID, memberID: "maestro",
      approvalMessageID: reply.id, taskHash: approval.decision.taskHash } }
  const context = { sessionID: chat.id, messageID: dispatch.id, callID: "dispatch_audit",
    agent: "maestro", abort: new AbortController().signal, extra: { promptOps: stubOps() },
    messages: [], metadata: () => Effect.void, ask: () => Effect.void }
  const tool = yield* TaskTool
  const def = yield* tool.init()
  return { ...seeded, def, params, context }
})
const consumed = Effect.fn("Audit.consumed")(function* (sessionID: string) {
  const database = yield* Database.Service
  const rows = yield* database.db.select().from(EventTable).where(eq(EventTable.aggregate_id, sessionID)).all()
  return rows.filter(row => row.type.startsWith("maestro.approval.consumed"))
})
describe("Audit: governed dispatch fault recovery (internal authority fixture)", () => {
  it.instance("positive control performs one prompt and refuses duplicate", () => Effect.gen(function* () {
    const { def, params, context, sessions, chat } = yield* prepare()
    let prompts = 0
    const ops = stubOps()
    context.extra.promptOps = { ...ops, prompt: input => Effect.gen(function* () { prompts++; return yield* ops.prompt(input) }) }
    const first = yield* Effect.exit(def.execute(params, context))
    const duplicate = yield* Effect.exit(def.execute(params, { ...context, callID: "retry_audit" }))
    expect(Exit.isSuccess(first)).toBe(true)
    expect(Exit.isFailure(duplicate)).toBe(true)
    expect(prompts).toBe(1)
    const children = yield* sessions.children(chat.id)
    expect(children).toHaveLength(1)
    observation({ case: "success-control", prompts, children: children.length, consumed: (yield* consumed(chat.id)).length,
      duplicate: String(duplicate) })
  }))
  it.instance("post-consumption metadata fault prevents prompt and cannot be retried", () => Effect.gen(function* () {
    const { def, params, context, sessions, chat } = yield* prepare()
    let prompts = 0
    const ops = stubOps()
    context.extra.promptOps = { ...ops, prompt: input => Effect.gen(function* () { prompts++; return yield* ops.prompt(input) }) }
    const fault = yield* Effect.exit(def.execute(params, { ...context,
      metadata: () => Effect.die(new Error("AUDIT metadata persistence fault")) }))
    const retry = yield* Effect.exit(def.execute(params, { ...context, callID: "retry_after_fault" }))
    expect(Exit.isFailure(fault)).toBe(true)
    expect(Exit.isFailure(retry)).toBe(true)
    expect(String(fault)).toContain("AUDIT metadata persistence fault")
    expect(String(retry)).toContain("approval-consumed")
    expect(prompts).toBe(0)
    const children = yield* sessions.children(chat.id)
    expect(children).toHaveLength(1)
    observation({ case: "metadata-fault", prompts, children: children.length,
      consumed: (yield* consumed(chat.id)).length, fault: String(fault), retry: String(retry) })
  }))
})

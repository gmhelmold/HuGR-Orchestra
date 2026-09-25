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

import { afterAll } from "bun:test"
import { writeFileSync } from "node:fs"
import { Cause } from "effect"
import { and, eq } from "drizzle-orm"
import { EventTable } from "@opencode-ai/core/event/sql"
import { EventV2 } from "@opencode-ai/core/event"

const observations: unknown[] = []
afterAll(() => {
  if (process.env.AUDIT_OUTPUT) writeFileSync(process.env.AUDIT_OUTPUT, JSON.stringify(observations, null, 2) + "\n")
})
const prepared = Effect.fn("Audit.prepared")(function* () {
  const seeded = yield* seed()
  const events = yield* EventV2Bridge.Service
  const { chat, assistant } = seeded
  const binding = {
    planRevisionID: "audit_plan", revisionHash: "audit_revision", validationRecordID: "audit_validation",
    validationHash: "audit_validation_hash", contextHash: "audit_context", policyHash: "audit_policy",
  }
  const intent = { subagentType: "general", prompt: "Count fixture execution only" }
  const governed = {
    sessionID: chat.id, projectID: chat.projectID, memberID: "maestro", approvalMessageID: "audit_user_approval",
    ...binding, taskHash: taskHash({ ...intent, ...binding }),
  }
  yield* events.publish(MaestroEvent.Approval.Presented, {
    id: "audit_presentation", sessionID: chat.id, assistantMessageID: assistant.id, callID: "audit_present",
    projectID: chat.projectID, memberID: "maestro", ...binding, taskHash: governed.taskHash, intent,
    methodVersion: "audit-v1", plan: intent.prompt, provenance: "seeded approved-record fixture",
    assumptions: [], validationLedger: "fixture", contextState: "CURRENT",
  })
  yield* events.publish(MaestroEvent.Approval.Decided, {
    ...governed, presentationID: "audit_presentation", presentationMessageID: assistant.id,
    methodVersion: "audit-v1", outcome: "APPROVED", decisionTime: Date.now(),
  })
  const executions: unknown[] = []
  const ops = stubOps()
  const promptOps: TaskPromptOps = {
    ...ops,
    prompt: (input) => Effect.gen(function* () {
      executions.push({ model: input.model, variant: input.variant, agent: input.agent, parts: input.parts })
      return yield* ops.prompt(input)
    }),
  }
  const params = { description: "fixture execution", prompt: intent.prompt, subagent_type: "general", governed }
  const ctx = {
    sessionID: chat.id, messageID: assistant.id, callID: "audit_task", agent: "maestro",
    abort: new AbortController().signal, extra: { promptOps }, messages: [],
    metadata: () => Effect.void, ask: () => Effect.void,
  }
  return { ...seeded, events, governed, params, ctx, executions }
})
const consumedCount = Effect.fn("Audit.consumedCount")(function* (sessionID: string) {
  const database = yield* Database.Service
  const rows = yield* database.db.select({ id: EventTable.id }).from(EventTable).where(and(
    eq(EventTable.aggregate_id, sessionID),
    eq(EventTable.type, EventV2.versionedType(MaestroEvent.Approval.Consumed.type, 1)),
  )).all().pipe(Effect.orDie)
  return rows.length
})

describe("Audit: original Maestro consumption boundary", () => {
  it.instance("normal original dispatch persists consumption and calls one counted executor", () => Effect.gen(function* () {
    const p = yield* prepared(); const tool = yield* TaskTool; const def = yield* tool.init()
    const exit = yield* Effect.exit(def.execute(p.params, p.ctx))
    const markers = yield* consumedCount(p.chat.id); const children = yield* p.sessions.children(p.chat.id)
    expect(Exit.isSuccess(exit)).toBe(true); expect(markers).toBe(1); expect(children.length).toBe(1); expect(p.executions.length).toBe(1)
    observations.push({ case: "normal", success: Exit.isSuccess(exit), markers, children: children.length, countedExecutions: p.executions.length })
  }))
  it.instance("an existing consumption record legitimately refuses another dispatch", () => Effect.gen(function* () {
    const p = yield* prepared()
    yield* p.events.publish(MaestroEvent.Approval.Consumed, {
      sessionID:p.chat.id, presentationID:"audit_presentation", approvalMessageID:p.governed.approvalMessageID,
      taskHash:p.governed.taskHash, callID:"prior_counted_call",
    })
    const tool = yield* TaskTool; const def = yield* tool.init()
    const exit = yield* Effect.exit(def.execute(p.params,p.ctx)); const cause = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : ""
    const markers = yield* consumedCount(p.chat.id); const children = yield* p.sessions.children(p.chat.id)
    expect(cause).toContain("approval-consumed"); expect(markers).toBe(1); expect(children.length).toBe(0); expect(p.executions.length).toBe(0)
    observations.push({case:"already-consumed", cause,markers,children:children.length,countedExecutions:p.executions.length})
  }))
  it.instance("pre-commit event-write fault is mislabeled consumed although durable marker is absent and clean retry works", () => Effect.gen(function* () {
    const p = yield* prepared(); let injectedCalls = 0
    const failing = EventV2Bridge.Service.of({ ...p.events, publish: (definition, data, options) => {
      if (definition.type === MaestroEvent.Approval.Consumed.type) {
        injectedCalls++; return Effect.die(new Error("AUDIT_CONSUME_WRITE_UNAVAILABLE"))
      }
      return p.events.publish(definition, data, options)
    } })
    const tool = yield* TaskTool.pipe(Effect.provideService(EventV2Bridge.Service, failing)); const def = yield* tool.init()
    const exit = yield* Effect.exit(def.execute(p.params,p.ctx)); const cause = Exit.isFailure(exit) ? Cause.pretty(exit.cause) : ""
    const markersBeforeRetry = yield* consumedCount(p.chat.id); const childrenBeforeRetry = (yield* p.sessions.children(p.chat.id)).length
    expect(injectedCalls).toBe(1); expect(cause).toContain("approval-consumed"); expect(cause).not.toContain("AUDIT_CONSUME_WRITE_UNAVAILABLE")
    expect(markersBeforeRetry).toBe(0); expect(childrenBeforeRetry).toBe(0); expect(p.executions.length).toBe(0)
    const restoredTool = yield* TaskTool; const restoredDef = yield* restoredTool.init()
    const retry = yield* Effect.exit(restoredDef.execute(p.params,{...p.ctx,callID:"audit_clean_retry"}))
    const markersAfterRetry = yield* consumedCount(p.chat.id); const childrenAfterRetry = (yield* p.sessions.children(p.chat.id)).length
    expect(Exit.isSuccess(retry)).toBe(true); expect(markersAfterRetry).toBe(1); expect(childrenAfterRetry).toBe(1); expect(p.executions.length).toBe(1)
    observations.push({case:"write-fault-before-consumption",injectedCalls,cause,markersBeforeRetry,childrenBeforeRetry,retrySuccess:Exit.isSuccess(retry),markersAfterRetry,childrenAfterRetry,countedExecutions:p.executions.length})
  }))
})

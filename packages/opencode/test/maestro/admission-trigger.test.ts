import { afterEach, describe, expect, test as bunTest } from "bun:test"
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
import { MessageID, PartID } from "../../src/session/schema"
import { SessionRunState } from "@/session/run-state"
import { SessionStatus } from "@/session/status"
import { Truncate } from "@/tool/truncate"
import { ToolRegistry } from "@/tool/registry"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { MaestroRecordAdmissionTool } from "../../src/tool/maestro-admission"
import { Tool } from "../../src/tool/tool"
import { readAdmission } from "../../src/maestro/admission-record"
import { ensureAdmission } from "../../src/maestro/admission-trigger"
import { selectDirectCandidate, DIRECT_SOURCE_KEY } from "../../src/maestro/admission-origin"

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

const workAssessment = {
  kind: "work" as const,
  goal: "Add dark mode to settings.",
  known: [{ text: "Settings page exists.", source: "orientation" as const }],
  proposals: [{ text: "Draft scope first.", source: "maestro" as const }],
  unknowns: [] as string[],
  uncertainty: "Persistence needs inspection.",
  activeWorkEffect: "none" as const,
  reason: "Goal is usable for a draft.",
}

const activeWorkAssessment = {
  ...workAssessment,
  activeWorkEffect: "new-scope-or-revision" as const,
}

function countingAssessor(assessment: unknown) {
  let calls = 0
  return {
    calls: () => calls,
    assess: (_message: SessionV1.WithParts) =>
      Effect.gen(function* () {
        calls++
        return assessment
      }),
  }
}

const createUserMessage = Effect.fn("AdmissionTriggerTest.createUserMessage")(function* (
  sessions: Session.Interface,
  sessionID: string,
  input: { agent?: string; time?: number } = {},
) {
  return yield* sessions.updateMessage({
    id: MessageID.ascending(),
    role: "user",
    sessionID,
    agent: input.agent ?? "maestro",
    model: ref,
    time: { created: input.time ?? Date.now() },
  })
})

describe("Maestro automatic admission trigger", () => {
  it.instance("records direct user once before model work, replay is immutable", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "direct admission" })
      const user = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      const assessor = countingAssessor(workAssessment)
      const first = yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })
      expect(first.status).toBe("RECORDED")
      if (first.status !== "RECORDED") throw new Error("expected recorded")
      expect(first.record.outcome).toBe("READY_TO_DRAFT")
      expect(first.sourceMessageID).toBe(user.id)
      expect(assessor.calls()).toBe(1)
      expect(yield* readAdmission({ sessionID: chat.id, messageID: user.id, methodVersion: "admit-request-v1" })).toEqual(
        first.record,
      )
      const replay = yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })
      expect(replay.status).toBe("REPLAYED")
      if (replay.status !== "REPLAYED") throw new Error("expected replay")
      expect(replay.record).toEqual(first.record)
      expect(assessor.calls()).toBe(1)
      expect(yield* sessions.children(chat.id)).toHaveLength(0)
    }),
  )

  it.instance("synthetic auto-continue holds, tool still binds direct request", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "synthetic regression" })
      const direct = yield* createUserMessage(sessions, chat.id, { time: Date.now() })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: direct.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      const synthetic = yield* createUserMessage(sessions, chat.id, { time: Date.now() + 1 })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: synthetic.id,
        sessionID: chat.id,
        type: "text",
        synthetic: true,
        metadata: { compaction_continue: true },
        text: "Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.",
        time: { start: Date.now(), end: Date.now() },
      })
      const assessor = countingAssessor(workAssessment)
      const held = yield* ensureAdmission({ sessionID: chat.id, messageID: synthetic.id, assess: assessor.assess })
      expect(held).toMatchObject({ status: "HOLD", reason: "synthetic-only" })
      expect(assessor.calls()).toBe(0)
      expect(
        yield* readAdmission({ sessionID: chat.id, messageID: synthetic.id, methodVersion: "admit-request-v1" }),
      ).toBeUndefined()
      const admitted = yield* ensureAdmission({ sessionID: chat.id, messageID: direct.id, assess: assessor.assess })
      expect(admitted.status).toBe("RECORDED")
      expect(assessor.calls()).toBe(1)
      const messages = yield* sessions.messages({ sessionID: chat.id })
      const info = yield* MaestroRecordAdmissionTool
      const def = yield* Tool.init(info)
      const result = yield* def.execute(
        { methodVersion: "admit-request-v1", assessment: workAssessment },
        {
          sessionID: chat.id,
          messageID: synthetic.id,
          callID: "call_admit_direct",
          agent: "maestro",
          abort: new AbortController().signal,
          messages,
          metadata: () => Effect.void,
          ask: () => Effect.void,
        },
      )
      expect(result.metadata.messageID).toBe(direct.id)
    }),
  )

  it.instance("synthetic-only session holds at tool boundary with no record", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "synthetic only" })
      const synthetic = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: synthetic.id,
        sessionID: chat.id,
        type: "text",
        synthetic: true,
        metadata: { compaction_continue: true },
        text: "Continue if you have next steps.",
        time: { start: Date.now(), end: Date.now() },
      })
      const assessor = countingAssessor(workAssessment)
      expect(yield* ensureAdmission({ sessionID: chat.id, messageID: synthetic.id, assess: assessor.assess })).toMatchObject(
        { status: "HOLD", reason: "synthetic-only" },
      )
      expect(assessor.calls()).toBe(0)
      const messages = yield* sessions.messages({ sessionID: chat.id })
      const info = yield* MaestroRecordAdmissionTool
      const def = yield* Tool.init(info)
      const exit = yield* Effect.exit(
        def.execute(
          { methodVersion: "admit-request-v1", assessment: workAssessment },
          {
            sessionID: chat.id,
            messageID: synthetic.id,
            callID: "call_admit_synthetic",
            agent: "maestro",
            abort: new AbortController().signal,
            messages,
            metadata: () => Effect.void,
            ask: () => Effect.void,
          },
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      expect(
        yield* readAdmission({ sessionID: chat.id, messageID: synthetic.id, methodVersion: "admit-request-v1" }),
      ).toBeUndefined()
    }),
  )

  it.instance("mixed real plus synthetic preserves direct content", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "mixed content" })
      const user = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "text",
        synthetic: true,
        text: "Called the Read tool with the following input.",
      })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "file",
        mime: "image/png",
        filename: "mock.png",
        url: "data:image/png;base64,AAA",
      })
      const assessor = countingAssessor(workAssessment)
      const result = yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })
      expect(result.status).toBe("RECORDED")
      if (result.status !== "RECORDED") throw new Error("expected recorded")
      expect(result.sourceMessageID).toBe(user.id)
      expect(result.record.outcome).toBe("READY_TO_DRAFT")
      expect(assessor.calls()).toBe(1)
    }),
  )

  it.instance("attachment-only genuine request qualifies", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "attachment only" })
      const user = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "file",
        mime: "image/png",
        filename: "mock.png",
        url: "data:image/png;base64,AAA",
      })
      const assessor = countingAssessor(workAssessment)
      const result = yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })
      expect(result.status).toBe("RECORDED")
      expect(assessor.calls()).toBe(1)
    }),
  )

  it.instance("explicit lineage binds continuation to original source", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "lineage" })
      const direct = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: direct.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      const continuation = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: continuation.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: continuation.id,
        sessionID: chat.id,
        type: "text",
        synthetic: true,
        metadata: { [DIRECT_SOURCE_KEY]: direct.id },
        text: `[Internal compaction replay of ${direct.id}]`,
        time: { start: Date.now(), end: Date.now() },
      })
      const assessor = countingAssessor(workAssessment)
      const first = yield* ensureAdmission({
        sessionID: chat.id,
        messageID: continuation.id,
        assess: assessor.assess,
      })
      expect(first.status).toBe("RECORDED")
      if (first.status !== "RECORDED") throw new Error("expected recorded")
      expect(first.sourceMessageID).toBe(direct.id)
      expect(first.record.messageID).toBe(direct.id)
      expect(assessor.calls()).toBe(1)
      expect(
        yield* readAdmission({ sessionID: chat.id, messageID: continuation.id, methodVersion: "admit-request-v1" }),
      ).toBeUndefined()
      const replay = yield* ensureAdmission({ sessionID: chat.id, messageID: direct.id, assess: assessor.assess })
      expect(replay.status).toBe("REPLAYED")
      expect(assessor.calls()).toBe(1)
    }),
  )

  it.instance("unavailable lineage holds without assessment", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "missing lineage" })
      const continuation = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: continuation.id,
        sessionID: chat.id,
        type: "text",
        synthetic: true,
        metadata: { [DIRECT_SOURCE_KEY]: "msg_missing" },
        text: "[Internal compaction replay of msg_missing]",
        time: { start: Date.now(), end: Date.now() },
      })
      const assessor = countingAssessor(workAssessment)
      expect(
        yield* ensureAdmission({ sessionID: chat.id, messageID: continuation.id, assess: assessor.assess }),
      ).toMatchObject({ status: "HOLD", reason: "lineage-unavailable" })
      expect(assessor.calls()).toBe(0)
    }),
  )

  it.instance("non-Maestro agent holds at trigger and tool boundaries", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "non-maestro" })
      const user = yield* createUserMessage(sessions, chat.id, { agent: "build" })
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "text",
        text: "Add dark mode to settings.",
      })
      const assessor = countingAssessor(workAssessment)
      expect(yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })).toMatchObject({
        status: "HOLD",
        reason: "non-maestro-agent",
      })
      expect(assessor.calls()).toBe(0)
      const messages = yield* sessions.messages({ sessionID: chat.id })
      const info = yield* MaestroRecordAdmissionTool
      const def = yield* Tool.init(info)
      const exit = yield* Effect.exit(
        def.execute(
          { methodVersion: "admit-request-v1", assessment: workAssessment },
          {
            sessionID: chat.id,
            messageID: user.id,
            callID: "call_admit_build",
            agent: "build",
            abort: new AbortController().signal,
            messages,
            metadata: () => Effect.void,
            ask: () => Effect.void,
          },
        ),
      )
      expect(Exit.isFailure(exit)).toBe(true)
      expect(
        yield* readAdmission({ sessionID: chat.id, messageID: user.id, methodVersion: "admit-request-v1" }),
      ).toBeUndefined()
    }),
  )

  it.instance("active approved work records CLARIFY without authorizing execution", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "active work" })
      const user = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "text",
        text: "Change the approved plan scope.",
      })
      const assessor = countingAssessor(activeWorkAssessment)
      const result = yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })
      expect(result.status).toBe("RECORDED")
      if (result.status !== "RECORDED") throw new Error("expected recorded")
      expect(result.record).toMatchObject({ outcome: "CLARIFY", reason: "active-work-conflict" })
      expect(assessor.calls()).toBe(1)
      expect(yield* sessions.children(chat.id)).toHaveLength(0)
    }),
  )

  it.instance("compaction control message holds", () =>
    Effect.gen(function* () {
      const sessions = yield* Session.Service
      const chat = yield* sessions.create({ title: "compaction control" })
      const user = yield* createUserMessage(sessions, chat.id)
      yield* sessions.updatePart({
        id: PartID.ascending(),
        messageID: user.id,
        sessionID: chat.id,
        type: "compaction",
        auto: true,
      })
      const assessor = countingAssessor(workAssessment)
      expect(yield* ensureAdmission({ sessionID: chat.id, messageID: user.id, assess: assessor.assess })).toMatchObject({
        status: "HOLD",
        reason: "compaction-control",
      })
      expect(assessor.calls()).toBe(0)
    }),
  )
})

describe("Maestro direct-request selection", () => {
  bunTest("selects latest direct with equal-timestamp tie-break", () => {
    const base = {
      sessionID: "ses_01",
      role: "user" as const,
      time: { created: 100 },
      agent: "maestro",
      model: { providerID: "test", modelID: "test-model" },
    }
    const direct = (id: string, time: number, text: string): SessionV1.WithParts => ({
      info: { ...base, id, time: { created: time } } as SessionV1.WithParts["info"],
      parts: [{ id: `prt_${id}`, sessionID: "ses_01", messageID: id, type: "text", text } as SessionV1.Part],
    })
    const synthetic = (id: string, time: number): SessionV1.WithParts => ({
      info: { ...base, id, time: { created: time } } as SessionV1.WithParts["info"],
      parts: [
        {
          id: `prt_${id}`,
          sessionID: "ses_01",
          messageID: id,
          type: "text",
          synthetic: true,
          metadata: { compaction_continue: true },
          text: "Continue",
        } as SessionV1.Part,
      ],
    })
    expect(selectDirectCandidate([direct("msg_a", 100, "first"), direct("msg_b", 100, "second")])?.info.id).toBe("msg_b")
    expect(
      selectDirectCandidate([direct("msg_a", 100, "first"), synthetic("msg_z", 200)])?.info.id,
    ).toBe("msg_a")
    expect(selectDirectCandidate([synthetic("msg_z", 200)])).toBeUndefined()
  })
})

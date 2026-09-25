import { afterEach, describe, expect } from "bun:test"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Database } from "@opencode-ai/core/database/database"
import { EventTable } from "@opencode-ai/core/event/sql"
import { EventV2 } from "@opencode-ai/core/event"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { MaestroEvent } from "@opencode-ai/schema/maestro-event"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import { MessageID, PartID, SessionID } from "@/session/schema"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { Effect, Exit, Schema } from "effect"
import { eq } from "drizzle-orm"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { presentApprovalFromSession, recordApproval } from "../../src/maestro/approval-record"
import { renderPresentation, type ApprovalPresentation } from "../../src/maestro/approval"

afterEach(async () => {
  await disposeAllInstances()
})

const it = testEffect(
  LayerNode.compile(LayerNode.group([Database.node, EventV2Bridge.node, Session.node, SessionProjector.node])),
)

const model = { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test-model") }

const planFields = {
  memberID: "maestro",
  planRevisionID: "plan_v1",
  validationRecordID: "val_v1",
  revisionHash: "revision-hash",
  validationHash: "validation-hash",
  contextHash: "context-hash",
  policyHash: "policy-hash",
  taskHash: "task-hash",
  intent: { subagentType: "general", prompt: "Add dark mode." },
  methodVersion: "request-approval-v1",
  plan: "Add dark mode.",
  provenance: "request msg_01",
  assumptions: [],
  validationLedger: "val_v1: VALID",
  contextState: "CURRENT",
} as const

function assistantMessage(sessionID: SessionID, parentID: MessageID, timeCreated: number): SessionV1.Assistant {
  return {
    id: MessageID.ascending(),
    role: "assistant",
    parentID,
    sessionID,
    mode: "maestro",
    agent: "maestro",
    cost: 0,
    path: { cwd: "/tmp", root: "/tmp" },
    tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.modelID,
    providerID: model.providerID,
    time: { created: timeCreated },
  }
}

function seed(presentationOutput?: (output: string) => string) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    const session = yield* sessions.create({ title: "Approval" })
    const user = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      role: "user",
      sessionID: session.id,
      agent: "maestro",
      model,
      time: { created: 1 },
    })
    const assistant = assistantMessage(session.id, user.id, 2)
    yield* sessions.updateMessage(assistant)
    const presentation = yield* presentApprovalFromSession({
      sessionID: session.id,
      assistantMessageID: assistant.id,
      callID: "call_present",
      ...planFields,
    })
    const output = renderPresentation(presentation)
    yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID: session.id,
      messageID: assistant.id,
      type: "tool",
      tool: "maestro_present_approval",
      callID: "call_present",
      state: {
        status: "completed",
        input: {},
        output: presentationOutput ? presentationOutput(output) : output,
        title: "Maestro plan approval",
        metadata: {},
        time: { start: 2, end: 3 },
      },
    })
    const reply = yield* sessions.updateMessage({
      id: MessageID.ascending(),
      role: "user",
      sessionID: session.id,
      agent: "maestro",
      model,
      time: { created: 4 },
    })
    return { session, sessions, assistant, reply, presentation }
  })
}

function presentOn(input: {
  sessionID: SessionID
  assistantMessageID: MessageID
  callID: string
  planRevisionID?: string
  validationRecordID?: string
  revisionHash?: string
  plan?: string
}) {
  return presentApprovalFromSession({
    sessionID: input.sessionID,
    assistantMessageID: input.assistantMessageID,
    callID: input.callID,
    ...planFields,
    ...(input.planRevisionID ? { planRevisionID: input.planRevisionID } : {}),
    ...(input.validationRecordID ? { validationRecordID: input.validationRecordID } : {}),
    ...(input.revisionHash ? { revisionHash: input.revisionHash } : {}),
    ...(input.plan ? { plan: input.plan } : {}),
  })
}

function visibleToolPart(input: {
  sessionID: SessionID
  messageID: MessageID
  callID: string
  presentation: ApprovalPresentation
  output?: string
}) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    return yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID: input.sessionID,
      messageID: input.messageID,
      type: "tool",
      tool: "maestro_present_approval",
      callID: input.callID,
      state: {
        status: "completed",
        input: {},
        output: input.output ?? renderPresentation(input.presentation),
        title: "Maestro plan approval",
        metadata: {},
        time: { start: 2, end: 3 },
      },
    })
  })
}

function userMessage(sessionID: SessionID, timeCreated: number) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    return yield* sessions.updateMessage({
      id: MessageID.ascending(),
      role: "user",
      sessionID,
      agent: "maestro",
      model,
      time: { created: timeCreated },
    })
  })
}

function userText(sessionID: SessionID, messageID: MessageID, text: string, synthetic = false) {
  return Effect.gen(function* () {
    const sessions = yield* Session.Service
    return yield* sessions.updatePart({
      id: PartID.ascending(),
      sessionID,
      messageID,
      type: "text",
      text,
      ...(synthetic ? { synthetic: true } : {}),
    })
  })
}

function countPresentedEvents(sessionID: SessionID) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    const rows = yield* db
      .select({ id: EventTable.id })
      .from(EventTable)
      .where(eq(EventTable.aggregate_id, sessionID))
      .all()
      .pipe(Effect.orDie)
    return rows.filter((row) => row.id.startsWith("evt_maestro_approval_presentation_")).length
  })
}

function presentedEvents(sessionID: SessionID) {
  return Effect.gen(function* () {
    const { db } = yield* Database.Service
    const rows = yield* db
      .select({ type: EventTable.type, data: EventTable.data })
      .from(EventTable)
      .where(eq(EventTable.aggregate_id, sessionID))
      .all()
      .pipe(Effect.orDie)
    return rows
      .filter((row) => row.type === EventV2.versionedType(MaestroEvent.Approval.Presented.type, 1))
      .map((row) => Schema.decodeUnknownSync(MaestroEvent.Approval.Presented.data)(row.data))
  })
}

describe("Maestro approval record", () => {
  it.instance("records direct approval from exact rendered tool evidence", () =>
    Effect.gen(function* () {
      const { session, reply } = yield* seed()
      yield* userText(session.id, reply.id, "aprovo")

      const first = yield* recordApproval(session.id)
      const replay = yield* recordApproval(session.id)

      expect(first.status).toBe("APPROVED")
      expect(replay).toEqual(first)
    }),
  )

  it.instance("holds when tool output differs from immutable presentation", () =>
    Effect.gen(function* () {
      const { session, reply } = yield* seed(() => "altered")
      yield* userText(session.id, reply.id, "approve")

      expect(yield* recordApproval(session.id)).toEqual({ status: "HOLD", reason: "presentation-message-mismatch" })
    }),
  )

  it.instance("holds when discussion intervenes before direct approval", () =>
    Effect.gen(function* () {
      const { session, reply, assistant } = yield* seed()
      const sessions = yield* Session.Service
      const intervening = assistantMessage(session.id, assistant.id, 3)
      yield* sessions.updateMessage(intervening)
      yield* userText(session.id, reply.id, "approve")

      expect(yield* recordApproval(session.id)).toEqual({ status: "HOLD", reason: "reply-not-immediate" })
    }),
  )

  it.instance("same-attempt retry replays one presentation and stays idempotent", () =>
    Effect.gen(function* () {
      const { session, assistant, presentation } = yield* seed()
      const retry = yield* presentOn({
        sessionID: session.id,
        assistantMessageID: assistant.id,
        callID: "call_present",
      })
      const retryAgain = yield* presentOn({
        sessionID: session.id,
        assistantMessageID: assistant.id,
        callID: "call_present",
      })

      expect(retry).toEqual(presentation)
      expect(retryAgain).toEqual(presentation)
      expect(yield* countPresentedEvents(session.id)).toBe(1)
    }),
  )

  it.instance("redisplay after question binds new message and accepts direct reply", () =>
    Effect.gen(function* () {
      const { session, assistant, presentation } = yield* seed()
      const sessions = yield* Session.Service
      const question = yield* userMessage(session.id, 5)
      yield* userText(session.id, question.id, "what changes after approval?")

      const redisplayMessage = assistantMessage(session.id, assistant.id, 6)
      yield* sessions.updateMessage(redisplayMessage)
      const redisplay = yield* presentOn({
        sessionID: session.id,
        assistantMessageID: redisplayMessage.id,
        callID: "call_redisplay",
      })
      yield* visibleToolPart({
        sessionID: session.id,
        messageID: redisplayMessage.id,
        callID: "call_redisplay",
        presentation: redisplay,
      })
      expect(redisplay.id).not.toBe(presentation.id)
      expect(redisplay.assistantMessageID).toBe(redisplayMessage.id)
      expect(yield* countPresentedEvents(session.id)).toBe(2)

      const reply = yield* userMessage(session.id, 7)
      yield* userText(session.id, reply.id, "aprovo")

      const result = yield* recordApproval(session.id)
      expect(result.status).toBe("APPROVED")
      if (result.status !== "APPROVED") throw new Error("expected approval")
      expect(result.decision.presentationID).toBe(redisplay.id)
      expect(result.decision.approvalMessageID).toBe(reply.id)
      expect(result.decision.planRevisionID).toBe("plan_v1")
      expect(result.decision.revisionHash).toBe("revision-hash")
    }),
  )

  it.instance("new revision presented at later message accepts direct reply", () =>
    Effect.gen(function* () {
      const { session, assistant } = yield* seed()
      const sessions = yield* Session.Service
      const revisionMessage = assistantMessage(session.id, assistant.id, 5)
      yield* sessions.updateMessage(revisionMessage)
      const revision = yield* presentOn({
        sessionID: session.id,
        assistantMessageID: revisionMessage.id,
        callID: "call_revision",
        planRevisionID: "plan_v2",
        validationRecordID: "val_v2",
        revisionHash: "revision-hash-v2",
        plan: "Add dark mode with settings page.",
      })
      yield* visibleToolPart({
        sessionID: session.id,
        messageID: revisionMessage.id,
        callID: "call_revision",
        presentation: revision,
      })

      const reply = yield* userMessage(session.id, 6)
      yield* userText(session.id, reply.id, "approve")

      const result = yield* recordApproval(session.id)
      expect(result.status).toBe("APPROVED")
      if (result.status !== "APPROVED") throw new Error("expected approval")
      expect(result.decision.presentationID).toBe(revision.id)
      expect(result.decision.planRevisionID).toBe("plan_v2")
      expect(result.decision.revisionHash).toBe("revision-hash-v2")
    }),
  )

  it.instance("holds synthetic approval reply", () =>
    Effect.gen(function* () {
      const { session, reply } = yield* seed()
      yield* userText(session.id, reply.id, "aprovo", true)

      expect(yield* recordApproval(session.id)).toEqual({ status: "HOLD", reason: "reply-synthetic" })
    }),
  )

  it.instance("old presentation reply cannot authorize redisplayed work", () =>
    Effect.gen(function* () {
      const { session, assistant, reply } = yield* seed()
      yield* userText(session.id, reply.id, "aprovo")
      const approved = yield* recordApproval(session.id)
      expect(approved.status).toBe("APPROVED")

      const sessions = yield* Session.Service
      const redisplayMessage = assistantMessage(session.id, assistant.id, 5)
      yield* sessions.updateMessage(redisplayMessage)
      const redisplay = yield* presentOn({
        sessionID: session.id,
        assistantMessageID: redisplayMessage.id,
        callID: "call_redisplay",
      })
      yield* visibleToolPart({
        sessionID: session.id,
        messageID: redisplayMessage.id,
        callID: "call_redisplay",
        presentation: redisplay,
      })

      expect(yield* recordApproval(session.id)).toEqual({
        status: "HOLD",
        reason: "reply-not-after-presentation",
      })
    }),
  )

  it.instance("holds altered payload under same revision identity", () =>
    Effect.gen(function* () {
      const { session, assistant } = yield* seed()
      const sessions = yield* Session.Service
      const clashMessage = assistantMessage(session.id, assistant.id, 5)
      yield* sessions.updateMessage(clashMessage)

      const exit = yield* Effect.exit(
        presentOn({
          sessionID: session.id,
          assistantMessageID: clashMessage.id,
          callID: "call_clash",
          plan: "Secretly different plan.",
        }),
      )
      expect(Exit.isFailure(exit)).toBe(true)
    }),
  )

  it.instance("redisplay keeps both presentations with distinct attempt identities", () =>
    Effect.gen(function* () {
      const { session, assistant } = yield* seed()
      const sessions = yield* Session.Service
      const redisplayMessage = assistantMessage(session.id, assistant.id, 5)
      yield* sessions.updateMessage(redisplayMessage)
      yield* presentOn({
        sessionID: session.id,
        assistantMessageID: redisplayMessage.id,
        callID: "call_redisplay",
      })

      const events = yield* presentedEvents(session.id)
      expect(events).toHaveLength(2)
      expect(new Set(events.map((event) => event.id)).size).toBe(2)
      expect(new Set(events.map((event) => event.assistantMessageID)).size).toBe(2)
      expect(events.every((event) => event.planRevisionID === "plan_v1")).toBe(true)
    }),
  )
})

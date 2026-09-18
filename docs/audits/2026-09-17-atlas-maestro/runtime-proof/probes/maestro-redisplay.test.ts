import { afterAll, afterEach, describe, expect } from "bun:test"
import { writeFileSync } from "node:fs"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import { MessageID, PartID } from "@/session/schema"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { Effect } from "effect"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { presentApprovalFromSession, recordApproval } from "../../src/maestro/approval-record"
import { renderPresentation } from "../../src/maestro/approval"

const observations: object[] = []
afterEach(async () => { await disposeAllInstances() })
afterAll(() => {
  const output = process.env.AUDIT_REDISPLAY_OUTPUT
  if (output) writeFileSync(output, JSON.stringify(observations, null, 2) + "\n")
})
const it = testEffect(LayerNode.compile(LayerNode.group([
  Database.node, EventV2Bridge.node, Session.node, SessionProjector.node,
])))
const model = { providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test-model") }
const variants = ["direct", "redisplay-same-revision", "new-revision", "synthetic", "tampered-output"] as const

describe("Audit: persisted approval redisplay boundary (public presentation remains disabled)", () => {
  for (const variant of variants) {
    it.instance(variant, () => Effect.gen(function* () {
      const sessions = yield* Session.Service
      const session = yield* sessions.create({ title: "Audit approval redisplay" })
      const initial = yield* sessions.updateMessage({
        id: MessageID.ascending(), role: "user", sessionID: session.id, agent: "maestro", model,
        time: { created: 1 },
      })
      const first = {
        id: MessageID.ascending(), role: "assistant" as const, parentID: initial.id,
        sessionID: session.id, mode: "maestro", agent: "maestro", cost: 0,
        path: { cwd: "/tmp", root: "/tmp" },
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        modelID: model.modelID, providerID: model.providerID, time: { created: 2 },
      }
      yield* sessions.updateMessage(first)
      const input = {
        sessionID: session.id, assistantMessageID: first.id, callID: "first-display", memberID: "maestro",
        planRevisionID: "plan-v1", validationRecordID: "validation-v1",
        revisionHash: "revision-hash", validationHash: "validation-hash", contextHash: "context-hash",
        policyHash: "policy-hash", taskHash: "task-hash",
        intent: { subagentType: "general", prompt: "Review the fixture." },
        methodVersion: "audit-method-v1", plan: "Review the fixture.", provenance: "direct fixture request",
        assumptions: [], validationLedger: "Fixture record is valid", contextState: "CURRENT" as const,
      }
      const presentation = yield* presentApprovalFromSession(input)
      yield* sessions.updatePart({
        id: PartID.ascending(), sessionID: session.id, messageID: first.id,
        type: "tool", tool: "maestro_present_approval", callID: input.callID,
        state: { status: "completed", input: {}, output: variant === "tampered-output" ? "altered" : renderPresentation(presentation),
          title: "Approval", metadata: {}, time: { start: 2, end: 3 } },
      })
      let displayedMessageID = first.id
      let returnedMessageID = presentation.assistantMessageID
      if (variant === "redisplay-same-revision" || variant === "new-revision") {
        const question = yield* sessions.updateMessage({
          id: MessageID.ascending(), role: "user", sessionID: session.id, agent: "maestro", model,
          time: { created: 4 },
        })
        yield* sessions.updatePart({id: PartID.ascending(),sessionID: session.id,messageID: question.id,type: "text",text: "What will be verified?"})
        const second = { ...first, id: MessageID.ascending(), parentID: question.id, time: { created: 5 } }
        yield* sessions.updateMessage(second)
        const replay = yield* presentApprovalFromSession({
          ...input, assistantMessageID: second.id, callID: "second-display",
          ...(variant === "new-revision" ? {planRevisionID: "plan-v2",validationRecordID: "validation-v2"} : {}),
        })
        yield* sessions.updatePart({
          id: PartID.ascending(), sessionID: session.id, messageID: second.id,
          type: "tool", tool: "maestro_present_approval", callID: "second-display",
          state: {status: "completed",input: {},output: renderPresentation(replay),title: "Approval",metadata: {},time: {start: 5,end: 6}},
        })
        displayedMessageID = second.id
        returnedMessageID = replay.assistantMessageID
      }
      const reply = yield* sessions.updateMessage({
        id: MessageID.ascending(), role: "user", sessionID: session.id, agent: "maestro", model,
        time: { created: 7 },
      })
      yield* sessions.updatePart({
        id: PartID.ascending(),sessionID: session.id,messageID: reply.id,type: "text",text: "aprovo",
        ...(variant === "synthetic" ? { synthetic: true } : {}),
      })
      const decision = yield* recordApproval(session.id)
      observations.push({variant,displayedMessageID,returnedMessageID,decision})
      if (variant === "redisplay-same-revision") {
        expect(returnedMessageID).toBe(first.id)
        expect(decision).toEqual({status: "HOLD",reason: "reply-not-immediate"})
      } else if (variant === "synthetic") {
        expect(decision).toEqual({status: "HOLD",reason: "reply-synthetic"})
      } else if (variant === "tampered-output") {
        expect(decision).toEqual({status: "HOLD",reason: "presentation-message-mismatch"})
      } else {
        expect(decision.status).toBe("APPROVED")
      }
    }))
  }
})

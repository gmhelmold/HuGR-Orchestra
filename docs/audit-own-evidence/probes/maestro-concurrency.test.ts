import { afterEach, describe, expect } from "bun:test"
import { writeFileSync } from "node:fs"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Effect, Exit, Cause } from "effect"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { recordAdmission, readAdmission } from "../../src/maestro/admission-record"
import { presentApproval } from "../../src/maestro/approval-record"
afterEach(async () => { await disposeAllInstances() })
const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, EventV2Bridge.node])))
const assessment = { kind: "work", goal: "Document the fixture.", known: [], proposals: [], unknowns: [],
  uncertainty: "None.", activeWorkEffect: "none", reason: "A bounded documentation request." }
const summary = (x: any) => Exit.isSuccess(x) ? { ok: true } : { ok: false, error: Cause.pretty(x.cause) }
describe("Round2: original durable producers under concurrent identical retry", () => {
  it.instance("preserves sequential and concurrent idempotence", () => Effect.gen(function* () {
    const results: any[] = []
    const seq = { sessionID: "ses_round2_seq", messageID: "msg_round2", methodVersion: "v1", assessment }
    const first = yield* recordAdmission(seq)
    const replay = yield* recordAdmission(seq)
    expect(first).toEqual(replay)
    results.push({ id: "sequential-admission", identical: true })
    for (let trial = 0; trial < 3; trial++) {
      const input = { ...seq, sessionID: `ses_round2_parallel_${trial}` }
      const exits = yield* Effect.all(Array.from({length: 8}, () => Effect.exit(recordAdmission(input))), {concurrency: "unbounded"})
      const saved = yield* readAdmission(input)
      results.push({ id: `concurrent-admission-${trial}`, returns: exits.map(summary), persisted: saved,
        desiredInvariant: exits.every(Exit.isSuccess) })
    }
    for (let trial = 0; trial < 3; trial++) {
      const input = { sessionID: `ses_round2_present_${trial}`, assistantMessageID: "msg_fixture", callID: "call_fixture",
        projectID: "project_fixture", memberID: "maestro", planRevisionID: "plan_fixture", validationRecordID: "validation_fixture",
        revisionHash: "revision", validationHash: "validation", contextHash: "context", policyHash: "policy", taskHash: "task",
        intent: {subagentType: "general", prompt: "Document the fixture."}, methodVersion: "v1", plan: "Document the fixture.",
        provenance: "controlled internal fixture", assumptions: [], validationLedger: "fixture", contextState: "CURRENT" as const }
      const exits = yield* Effect.all(Array.from({length: 8}, () => Effect.exit(presentApproval(input))), {concurrency: "unbounded"})
      const laterReplay = yield* presentApproval(input)
      results.push({ id: `concurrent-presentation-${trial}`, returns: exits.map(summary), replayID: laterReplay.id,
        desiredInvariant: exits.every(Exit.isSuccess) })
    }
    writeFileSync(process.env.AUDIT_OUT!, JSON.stringify(results, null, 2) + "\n")
    console.log(JSON.stringify(results.map(r => ({id:r.id, desiredInvariant:r.desiredInvariant,
      successes:r.returns?.filter((x:any)=>x.ok).length}))))
    expect(results.filter(r=>r.desiredInvariant === false)).toHaveLength(0)
  }), 60000)
})

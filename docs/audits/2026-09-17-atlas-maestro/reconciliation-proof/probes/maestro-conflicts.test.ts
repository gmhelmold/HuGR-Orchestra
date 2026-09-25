import { afterEach, describe, expect } from "bun:test"
import { writeFileSync } from "node:fs"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Cause, Effect, Exit } from "effect"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { recordAdmission, readAdmission } from "../../src/maestro/admission-record"
import { presentApproval } from "../../src/maestro/approval-record"

afterEach(async () => { await disposeAllInstances() })
const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, EventV2Bridge.node])))
const assessment = { kind: "work", goal: "Document component A.", known: [], proposals: [], unknowns: [],
  uncertainty: "No blocking uncertainty.", activeWorkEffect: "none", reason: "Bounded documentation work." }
const evidence: unknown[] = []

describe("Audit: immutable Maestro records under legitimate concurrent disagreement", () => {
  it.instance("observes sequential conflict controls and concurrent admission/presentation", () => Effect.gen(function* () {
    const firstInput = { sessionID: "ses_audit_sequential", messageID: "msg_audit", methodVersion: "v1", assessment }
    yield* recordAdmission(firstInput)
    const exact = yield* recordAdmission(firstInput)
    expect(exact.assessment?.goal).toBe(assessment.goal)
    const sequential = yield* Effect.exit(recordAdmission({ ...firstInput, assessment: { ...assessment, goal: "Document component B." } }))
    expect(Exit.isFailure(sequential)).toBe(true)
    evidence.push({case:"sequential-admission-control",conflictRejected:Exit.isFailure(sequential)})
    for (let trial=0; trial<3; trial++) {
      const a={...firstInput, sessionID:`ses_audit_concurrent_${trial}`}
      const b={...a, assessment:{...assessment,goal:"Document component B."}}
      const exits=yield* Effect.all([a,b].map(input=>Effect.exit(recordAdmission(input))),{concurrency:"unbounded"})
      const recorded=yield* readAdmission(a)
      const returns=exits.map((out,i)=> Exit.isSuccess(out)
        ? {requestGoal:i===0?a.assessment.goal:b.assessment.goal,ok:true,returnedGoal:out.value.assessment?.goal}
        : {requestGoal:i===0?a.assessment.goal:b.assessment.goal,ok:false,error:Cause.pretty(out.cause)})
      evidence.push({case:`concurrent-admission-${trial}`,returns,recorded,
        conflictPreserved:returns.filter(out=>out.ok).length===1})
    }
    for (let trial=0; trial<3; trial++) {
      const a={sessionID:`ses_audit_present_${trial}`,assistantMessageID:"msg_audit",callID:"call_audit",
        projectID:"project_fixture",memberID:"maestro",planRevisionID:"plan_fixture",validationRecordID:"validation_fixture",
        revisionHash:"revision",validationHash:"validation",contextHash:"context",policyHash:"policy",taskHash:"task",
        intent:{subagentType:"general",prompt:"Document component A."},methodVersion:"v1",plan:"Document component A.",
        provenance:"Internal persistence fixture, not authority for execution.",assumptions:[],validationLedger:"fixture",contextState:"CURRENT" as const}
      const b={...a,plan:"Document component B.",intent:{...a.intent,prompt:"Document component B."}}
      const exits=yield* Effect.all([a,b].map(input=>Effect.exit(presentApproval(input))),{concurrency:"unbounded"})
      const returns=exits.map((out,i)=>Exit.isSuccess(out)
        ? {requestPlan:i===0?a.plan:b.plan,ok:true,returnedPlan:out.value.plan}
        : {requestPlan:i===0?a.plan:b.plan,ok:false,error:Cause.pretty(out.cause)})
      evidence.push({case:`concurrent-presentation-${trial}`,returns,conflictPreserved:returns.filter(out=>out.ok).length===1})
    }
    writeFileSync(process.env.AUDIT_OUT!,JSON.stringify({scope:"Original durable producers, original EventV2 and database; no model execution or public approval activation",evidence},null,2)+"\n")
    console.log(JSON.stringify(evidence))
  }),60000)
})

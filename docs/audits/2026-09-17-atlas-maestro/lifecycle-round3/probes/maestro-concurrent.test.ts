import { afterAll, afterEach, describe, expect } from "bun:test"
import { writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { Effect, Exit, Cause } from "effect"
const root = process.env.AUDIT_PRODUCT_ROOT!
const load = (relative: string) => import(pathToFileURL(root + "/" + relative).href)
const { Database } = await load("packages/core/src/database/database.ts")
const { LayerNode } = await load("packages/core/src/effect/layer-node.ts")
const { EventV2Bridge } = await load("packages/opencode/src/event-v2-bridge.ts")
const { disposeAllInstances } = await load("packages/opencode/test/fixture/fixture.ts")
const { testEffect } = await load("packages/opencode/test/lib/effect.ts")
const { recordAdmission, readAdmission } = await load("packages/opencode/src/maestro/admission-record.ts")
const observations: unknown[] = []
afterEach(async () => { await disposeAllInstances() })
afterAll(() => { writeFileSync(process.env.AUDIT_CONCURRENCY_OUTPUT!, JSON.stringify(observations, null, 2)) })
const it = testEffect(LayerNode.compile(LayerNode.group([Database.node, EventV2Bridge.node])))
const assessment = {kind:"work",goal:"Review a fixture.",known:[],proposals:[],unknowns:[],uncertainty:"none",activeWorkEffect:"none",reason:"Clear review goal."}
describe("Diagnostic: Maestro exact retry under concurrency", () => {
 it.instance("eight identical concurrent requests and sequential control", () => Effect.gen(function* () {
   const rounds=[]
   for(let round=0;round<3;round++) {
    const input={sessionID:`ses_round3_${round}`,messageID:`msg_round3_${round}`,methodVersion:"audit-concurrency-v1",assessment}
    const exits=yield* Effect.forEach(Array.from({length:8}),()=>recordAdmission(input).pipe(Effect.exit),{concurrency:"unbounded"})
    const successes=exits.filter(Exit.isSuccess).length
    const errors=exits.filter(Exit.isFailure).map((x:any)=>Cause.pretty(x.cause))
    const stored=yield* readAdmission(input)
    const replay=yield* recordAdmission(input)
    expect(stored).toEqual(replay)
    expect(successes).toBeGreaterThan(0)
    rounds.push({round,attempts:8,successes,failures:errors.length,errors,stored,replayMatches:true})
   }
   observations.push({kind:"concurrent-identical",rounds,scope:"original admission recorder, Effect, SQLite, EventV2; no model or public approval",defectObserved:rounds.some((x:any)=>x.failures>0)})
 }))
 it.instance("different admission keys and changed-payload conflict controls",()=>Effect.gen(function* () {
   const first={sessionID:"ses_controls_r3",messageID:"msg_controls_r3",methodVersion:"audit-v1",assessment}
   yield* recordAdmission(first)
   const conflict=yield* recordAdmission({...first,assessment:{...assessment,goal:"A different goal."}}).pipe(Effect.exit)
   expect(Exit.isFailure(conflict)).toBe(true)
   const different=yield* Effect.forEach([0,1,2,3],(n)=>recordAdmission({...first,messageID:`msg_distinct_r3_${n}`}).pipe(Effect.exit),{concurrency:"unbounded"})
   expect(different.every(Exit.isSuccess)).toBe(true)
   observations.push({kind:"controls",alteredPayloadRejected:true,distinctKeySuccesses:different.length})
 }))
})

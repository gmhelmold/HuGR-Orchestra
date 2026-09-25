import { afterEach, describe, expect } from "bun:test"
import { Effect, Exit } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Agent } from "../../src/agent/agent"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import { MessageID, PartID } from "../../src/session/schema"
import { MaestroRecordAdmissionTool } from "../../src/tool/maestro-admission"
import { ToolRegistry } from "@/tool/registry"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { Truncate } from "@/tool/truncate"
import { BackgroundJob } from "@/background/job"
import { Config } from "@/config/config"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { SessionRunState } from "@/session/run-state"
import { SessionStatus } from "@/session/status"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { readAdmission } from "../../src/maestro/admission-record"
import { disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

afterEach(async () => { await disposeAllInstances() })
const it = testEffect(LayerNode.compile(LayerNode.group([
  Agent.node, EventV2Bridge.node, Session.node, SessionProjector.node, ToolRegistry.node, Database.node,
  Truncate.node, BackgroundJob.node, Config.node, CrossSpawnSpawner.node, Ripgrep.node,
  SessionRunState.node, SessionStatus.node, RuntimeFlags.node,
])))
const ref = {providerID: ProviderV2.ID.make("test"), modelID: ModelV2.ID.make("test-model")}
const assessment = {
  kind: "work", goal: "Document the fixture module.",
  known: [{text: "The stakeholder requested documentation.", source: "stakeholder"}],
  proposals: [], unknowns: [], uncertainty: "Code inspection remains necessary.",
  activeWorkEffect: "none", reason: "A documentation draft is requested.",
}

for (const scenario of ["direct-only", "direct-then-auto-continue", "auto-continue-only", "non-maestro"] as const) {
  it.instance(`admission preserves direct-user provenance: ${scenario}`, () => Effect.gen(function* () {
    const sessions = yield* Session.Service
    const chat = yield* sessions.create({title: `Audit admission ${scenario}`})
    const start = Date.now()
    const direct = scenario === "auto-continue-only" ? undefined : yield* sessions.updateMessage({
      id: MessageID.ascending(), role:"user", sessionID:chat.id, agent:"maestro", model:ref, time:{created:start},
    })
    if (direct) yield* sessions.updatePart({
      id:PartID.ascending(), messageID:direct.id, sessionID:chat.id, type:"text", text:"Document the fixture module.",
    })
    const synthetic = scenario === "direct-then-auto-continue" || scenario === "auto-continue-only"
      ? yield* sessions.updateMessage({id:MessageID.ascending(),role:"user",sessionID:chat.id,agent:"maestro",model:ref,time:{created:start+10}})
      : undefined
    if (synthetic) yield* sessions.updatePart({
      id:PartID.ascending(),messageID:synthetic.id,sessionID:chat.id,type:"text",
      text:"Continue if you have next steps, or stop and ask for clarification if you are unsure how to proceed.",
      synthetic:true, metadata:{compaction_continue:true},
    })
    const parent = synthetic ?? direct
    if (!parent) throw new Error("Invalid fixture: no parent")
    const assistant = yield* sessions.updateMessage({
      id:MessageID.ascending(),role:"assistant",parentID:parent.id,sessionID:chat.id,mode:"maestro",agent:"maestro",
      cost:0,path:{cwd:"/tmp",root:"/tmp"},tokens:{input:0,output:0,reasoning:0,cache:{read:0,write:0}},
      modelID:ref.modelID,providerID:ref.providerID,time:{created:start+20},
    })
    const messages = yield* sessions.messages({sessionID:chat.id})
    const tool = yield* MaestroRecordAdmissionTool
    const def = yield* tool.init()
    const result = yield* Effect.exit(def.execute({methodVersion:"audit-admission-v1",assessment},{
      sessionID:chat.id,messageID:assistant.id,callID:"audit-admit",agent:scenario === "non-maestro" ? "general" : "maestro",
      abort:new AbortController().signal,messages,metadata:()=>Effect.void,ask:()=>Effect.void,
    }))
    const syntheticRecord = synthetic ? yield* readAdmission({sessionID:chat.id,messageID:synthetic.id,methodVersion:"audit-admission-v1"}) : undefined
    const directRecord = direct ? yield* readAdmission({sessionID:chat.id,messageID:direct.id,methodVersion:"audit-admission-v1"}) : undefined
    console.log("AUDIT_ADMISSION " + JSON.stringify({scenario,succeeded:Exit.isSuccess(result),
      boundToDirect:directRecord !== undefined,boundToSynthetic:syntheticRecord !== undefined,
      syntheticOutcome:syntheticRecord?.outcome,directOutcome:directRecord?.outcome,
      fixtureSyntheticMarkers:messages.flatMap(m=>m.parts).filter(p=>p.type === "text" && p.synthetic).length,
    }))
    if (scenario === "direct-only") {
      expect(Exit.isSuccess(result)).toBe(true)
      expect(directRecord?.outcome).toBe("READY_TO_DRAFT")
    } else if (scenario === "non-maestro") {
      expect(Exit.isFailure(result)).toBe(true)
      expect(directRecord).toBeUndefined()
    } else {
      // A refusal or explicit continuity onto genuine input can be a valid policy;
      // attributing direct stakeholder intake to an internal auto-continue is not.
      expect(syntheticRecord).toBeUndefined()
    }
  }))
}

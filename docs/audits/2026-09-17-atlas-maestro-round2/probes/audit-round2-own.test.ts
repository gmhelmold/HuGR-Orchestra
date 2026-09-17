import { afterEach, describe, expect } from "bun:test"
import { writeFileSync, readFileSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { Effect } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { ToolRegistry } from "@/tool/registry"
import { SkillTool } from "../../src/tool/skill"
import { SessionID, MessageID } from "../../src/session/schema"
import { disposeAllInstances, TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
const atlas = process.env.ATLAS_ROOT!
const artifacts = await import(pathToFileURL(join(atlas, "packages/retrieval/dist/src/own-artifact.js")).href)
const results: any[] = []
const it = testEffect(LayerNode.compile(LayerNode.group([ToolRegistry.node, CrossSpawnSpawner.node, Ripgrep.node])))
afterEach(async () => { await disposeAllInstances(); writeFileSync(process.env.AUDIT_OUT!, JSON.stringify(results,null,2)+"\n") })
describe("Round2: static Own current-source contract at the real host skill tool", () => {
  for (const mode of ["fresh", "stale-cold", "stale-warm"]) {
    it.instance(mode, () => Effect.gen(function* () {
      const dir = (yield* TestInstance).directory
      const git=(...args:string[])=>execFileSync("git",args,{cwd:dir,encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim()
      git("init");git("config","user.email","audit@example.invalid");git("config","user.name","Audit fixture")
      mkdirSync(join(dir,"src"),{recursive:true});writeFileSync(join(dir,"src/a.ts"),"export const value = 1;\n")
      git("add","src/a.ts");git("commit","-m","Reviewed Own fixture")
      const rev=git("rev-parse","HEAD"),blob=git("hash-object","src/a.ts")
      const snapshot=JSON.parse(readFileSync(join(atlas,"OWN-SNAPSHOT.json"),"utf8"))
      snapshot.sourceRevision=rev;snapshot.snapshot="audit-fixture-v1"
      const u=snapshot.units[0];u.unit.id="src";u.sourceBlobs={"src/a.ts":blob}
      u.pack.unit="Fixture source ownership.";u.pack.shape.contents=["src/a.ts"]
      u.pack.invariants[0].claim="The fixture exports value = 1."
      const reviewed=join(dir,"reviewed.json");writeFileSync(reviewed,JSON.stringify(snapshot))
      execFileSync("node",[join(atlas,"scripts/materialize-own-snapshot.mjs"),reviewed],{
        cwd:dir,env:{...process.env,OWN_SNAPSHOT_MATERIALIZE_IMPL:join(atlas,"packages/retrieval/dist/src/own-snapshot.js")},stdio:["ignore","pipe","pipe"]})
      const skillName=artifacts.staticOwnSkillName("src")
      const content=readFileSync(join(dir,artifacts.staticOwnArtifactPath("src")),"utf8")
      const currentBlob=(p:string)=>git("hash-object","--",p)
      const fresh=artifacts.verifyStaticOwnFreshness(content,currentBlob)
      expect(fresh.status).toBe("READY")
      if(mode==="stale-cold")writeFileSync(join(dir,"src/a.ts"),"export const value = 2;\n")
      const home=process.env.OPENCODE_TEST_HOME;process.env.OPENCODE_TEST_HOME=dir
      yield* Effect.addFinalizer(()=>Effect.sync(()=>{process.env.OPENCODE_TEST_HOME=home}))
      const registry=yield* ToolRegistry.Service
      const tool=(yield* registry.tools({providerID:"test" as any,modelID:"test-model" as any,
        agent:{name:"maestro",mode:"primary" as const,permission:[],options:{}}})).find(t=>t.id===SkillTool.id)
      if(!tool)throw Error("Skill tool unavailable")
      const ctx={sessionID:SessionID.make("ses_own_test"),messageID:MessageID.make("msg_own_test"),callID:"call_own",
        agent:"maestro",abort:new AbortController().signal,messages:[],metadata:()=>Effect.void,ask:()=>Effect.void}
      const initial=yield* tool.execute({name:skillName},ctx)
      if(mode==="stale-warm")writeFileSync(join(dir,"src/a.ts"),"export const value = 2;\n")
      const checked=artifacts.verifyStaticOwnFreshness(content,currentBlob)
      const result=yield* tool.execute({name:skillName},ctx)
      const servedOldClaim=result.output.includes("The fixture exports value = 1.")
      results.push({mode,freshness:checked,title:result.title,servedOldClaim,
        identicalToInitial:result.output===initial.output,desiredInvariant:checked.status!=="HOLD" || !servedOldClaim})
      if(mode!=="fresh")expect(servedOldClaim).toBe(false)
      else expect(servedOldClaim).toBe(true)
    }),60000)
  }
})

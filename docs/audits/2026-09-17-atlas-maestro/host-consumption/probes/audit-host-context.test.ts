// Copy to packages/opencode/test/session in a disposable pinned checkout.
// Original session/tool/provider path; only provider responses and summarization are test substitutes.
import { afterAll, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, realpathSync } from "node:fs"
import { createHash } from "node:crypto"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { MessageV2 } from "../../src/session/message-v2"
import { Server } from "../../src/server/server"
import { disposeAllInstances } from "../fixture/fixture"
import { Session } from "../../src/session/session"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionSummary } from "../../src/session/summary"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Skill } from "../../src/skill"
import { ToolRegistry } from "../../src/tool/registry"
import { TestInstance } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { TestLLMServer } from "../lib/llm-server"

const atlas = realpathSync(process.env.ATLAS_ROOT!)
const output = process.env.AUDIT_OUT!
const artifacts = await import(pathToFileURL(path.join(atlas, "packages/retrieval/dist/src/own-artifact.js")).href)
const records: object[] = []
const llmNode = LayerNode.make({ service: TestLLMServer, layer: TestLLMServer.layer, deps: [] })
const it = testEffect(LayerNode.compile(LayerNode.group([
  SessionProjector.node, MessageV2.node, SessionPrompt.node, Session.node, Agent.node, Config.node, Skill.node, ToolRegistry.node, llmNode,
]), [
  [SessionSummary.node, Layer.mock(SessionSummary.Service, {
    summarize: () => Effect.void, diff: () => Effect.succeed([]), computeDiff: () => Effect.succeed([]),
  })],
  [RuntimeFlags.node, RuntimeFlags.layer({ experimentalEventSystem: true })],
]))
afterAll(async () => { await disposeAllInstances(); writeFileSync(output, JSON.stringify(records, null, 2) + "\n") })

const claim = "AUDIT_OWN_VALUE_ONE: src/a.ts exports value = 1."
const cases = ["fresh-tool", "dirty-cold-tool", "dirty-warm-tool", "committed-cold-tool", "deleted-cold-tool", "fresh-command", "dirty-command", "missing-tool", "ordinary-skill", "http-fresh-tool", "http-dirty-tool", "history-after-dirty"] as const

for (const mode of cases) {
  it.instance(mode, () => Effect.gen(function* () {
    const dir = (yield* TestInstance).directory
    const llm = yield* TestLLMServer
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
    const src = path.join(dir, "src/a.ts")
    mkdirSync(path.dirname(src), { recursive: true })
    writeFileSync(src, "export const value = 1;\n")
    git("add", "src/a.ts"); git("commit", "-m", "reviewed source")
    const reviewed = JSON.parse(readFileSync(path.join(atlas, "OWN-SNAPSHOT.json"), "utf8"))
    reviewed.sourceRevision = git("rev-parse", "HEAD")
    reviewed.snapshot = "host-audit-fixture"
    const unit = reviewed.units[0]
    unit.unit.id = "src"; unit.sourceBlobs = { "src/a.ts": git("hash-object", "src/a.ts") }
    unit.pack.unit = "Controlled ownership fixture."
    unit.pack.shape.contents = ["src/a.ts"]
    unit.pack.invariants[0].claim = claim
    const input = path.join(dir, "reviewed.json")
    writeFileSync(input, JSON.stringify(reviewed))
    execFileSync("node", [path.join(atlas, "scripts/materialize-own-snapshot.mjs"), input], {
      cwd: dir, stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OWN_SNAPSHOT_MATERIALIZE_IMPL: path.join(atlas, "packages/retrieval/dist/src/own-snapshot.js") },
    })
    const artifact = readFileSync(path.join(dir, artifacts.staticOwnArtifactPath("src")), "utf8")
    const currentBlob = (p: string) => {
      try { return git("hash-object", "--", p) } catch { return undefined }
    }
    expect(artifacts.verifyStaticOwnFreshness(artifact, currentBlob).status).toBe("READY")
    const provider = {
      model: "test/test-model", permission: { "*": "allow" },
      provider: { test: { name: "Test", id: "test", env: [], npm: "@ai-sdk/openai-compatible",
        models: { "test-model": { id: "test-model", name: "Test Model", attachment: false, reasoning: false,
          temperature: false, tool_call: true, release_date: "2025-01-01", limit: { context: 100000, output: 10000 },
          cost: { input: 0, output: 0 }, options: {} } }, options: { apiKey: "test-key", baseURL: llm.url } } },
    }
    writeFileSync(path.join(dir, "opencode.json"), JSON.stringify(provider))
    let name = artifacts.staticOwnSkillName("src") as string
    if (mode === "ordinary-skill") {
      name = "ordinary-audit"
      const target = path.join(dir, ".opencode/skills/ordinary-audit/SKILL.md")
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, "---\nname: ordinary-audit\ndescription: Ordinary fixture.\n---\nORDINARY_CONTEXT_CONTROL\n")
    }
    if (mode === "dirty-warm-tool") {
      const skills = yield* Skill.Service
      expect((yield* skills.require(name)).content).toContain(claim)
    }
    if (mode.startsWith("dirty") || mode.startsWith("committed") || mode === "http-dirty-tool") writeFileSync(src, "export const value = 2;\n")
    if (mode.startsWith("committed")) { git("add", "src/a.ts"); git("commit", "-m", "source changed") }
    if (mode.startsWith("deleted")) unlinkSync(src)
    if (mode === "missing-tool") name = "own_missing_audit"
    let verification = artifacts.verifyStaticOwnFreshness(artifact, currentBlob)
    const agents = yield* Agent.Service
    const selected = yield* agents.get("maestro")
    expect(selected.id).toBe("maestro")
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({ title: "WP-HOST-01", permission: [{ permission: "*", pattern: "*", action: "allow" }] })
    let httpStatus: object | undefined
    if (mode.startsWith("http-")) {
      const app = Server.Default().app
      const headers = { "x-opencode-directory": encodeURIComponent(dir), "content-type": "application/json" }
      const created = yield* Effect.promise(async () => {
        const response = await app.request("/session", { method: "POST", headers, body: JSON.stringify({ title: "HTTP audit", permission: [{ permission: "*", pattern: "*", action: "allow" }] }) })
        expect(response.status).toBe(200)
        return response.json()
      })
      yield* llm.tool("skill", { name })
      yield* llm.text("AUDIT_DONE")
      const result = yield* Effect.promise(async () => {
        const response = await app.request(`/session/${created.id}/message`, { method: "POST", headers, body: JSON.stringify({ agent: "maestro", model: { providerID: "test", modelID: "test-model" }, parts: [{ type: "text", text: "Load the requested audit skill." }] }) })
        const data = await response.json()
        return { status: response.status, agent: data.info?.agent, finish: data.info?.finish, error: data.info?.error }
      })
      httpStatus = result
      expect(result.status).toBe(200)
    } else if (mode.endsWith("command")) {
      yield* llm.text("AUDIT_DONE")
      yield* prompt.command({ sessionID: session.id, agent: "maestro", model: "test/test-model", command: name, arguments: "" })
    } else {
      yield* llm.tool("skill", { name })
      yield* llm.text("AUDIT_DONE")
      yield* prompt.prompt({ sessionID: session.id, agent: "maestro", parts: [{ type: "text", text: "Load the requested skill for this audit." }] })
    }
    if (mode === "history-after-dirty") {
      writeFileSync(src, "export const value = 2;\n")
      verification = artifacts.verifyStaticOwnFreshness(artifact, currentBlob)
      yield* llm.text("AUDIT_HISTORY_DONE")
      yield* prompt.prompt({ sessionID: session.id, agent: "maestro", parts: [{ type: "text", text: "Continue the audit without another tool call." }] })
    }
    const hits = yield* llm.hits
    const last = hits.at(-1)!
    const messages = JSON.stringify(last.body.messages)
    const tools = Array.isArray(hits[0]?.body.tools)
      ? hits[0].body.tools.map((tool: { function?: { name?: string }; name?: string }) => tool.function?.name ?? tool.name)
      : []
    const oldClaimDelivered = messages.includes(claim)
    const expected = verification.status !== "HOLD" || !oldClaimDelivered
    records.push({ mode, verified: verification, agent: selected.id, requestCount: hits.length,
      endpoint: last.url.pathname, httpStatus, tools, hasMaestroSystem: messages.includes("You are Maestro"),
      hasAdmissionTool: tools.includes("maestro_record_admission"), hasPresentationTool: tools.includes("maestro_present_approval"),
      oldClaimDelivered, ordinaryDelivered: messages.includes("ORDINARY_CONTEXT_CONTROL"),
      desiredFreshnessInvariant: expected, missingDelivered: messages.includes("not found"),
      requestBodyHash: createHash("sha256").update(JSON.stringify(last.body)).digest("hex"),
      messages: last.body.messages,
    })
    expect(messages).toContain("You are Maestro")
    expect(tools).toContain("maestro_record_admission")
    if (mode === "missing-tool") expect(oldClaimDelivered).toBe(false)
    else if (mode === "ordinary-skill") expect(messages).toContain("ORDINARY_CONTEXT_CONTROL")
    else expect(oldClaimDelivered).toBe(true) // Observation, NOT proof the desired invariant passes.
  }), { git: true }, 60000)
}

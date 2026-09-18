// Copy to packages/opencode/test/session/audit-own-literal.test.ts in a disposable checkout.
// Original materializer, Git, session, command/tool, serializer and local HTTP provider boundary.
import { afterAll, expect } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync, realpathSync, existsSync } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Effect, Layer } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Agent } from "../../src/agent/agent"
import { Config } from "../../src/config/config"
import { MessageV2 } from "../../src/session/message-v2"
import { Session } from "../../src/session/session"
import { SessionPrompt } from "../../src/session/prompt"
import { SessionSummary } from "../../src/session/summary"
import { RuntimeFlags } from "../../src/effect/runtime-flags"
import { Skill } from "../../src/skill"
import { ToolRegistry } from "../../src/tool/registry"
import { TestInstance, disposeAllInstances } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import { TestLLMServer } from "../lib/llm-server"

const atlas = realpathSync(process.env.ATLAS_ROOT!)
const output = process.env.AUDIT_OUT
if (!output) throw new Error("AUDIT_OUT must name a new output file outside the published evidence directory")
if (existsSync(output)) throw new Error("AUDIT_OUT already exists; refusing to overwrite evidence")
const assertionMode = process.env.AUDIT_EXPECT ?? "observed"
if (assertionMode !== "observed" && assertionMode !== "desired") throw new Error("AUDIT_EXPECT must be observed or desired")
const artifacts = await import(pathToFileURL(path.join(atlas, "packages/retrieval/dist/src/own-artifact.js")).href)
const snapshots = await import(pathToFileURL(path.join(atlas, "packages/retrieval/dist/src/own-snapshot.js")).href)
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
afterAll(async () => { await disposeAllInstances(); writeFileSync(output, JSON.stringify(records, null, 2) + "\n", { flag: "wx" }) })

const cases = [
  { mode: "own-tool-dollar", text: 'The module returns the literal "$1".', route: "tool", args: "", expected: 'The module returns the literal "$1".' },
  { mode: "own-command-dollar", text: 'The module returns the literal "$1".', route: "command", args: "", expected: 'The module returns the literal "".' },
  { mode: "own-command-arguments", text: 'The module returns the literal "$ARGUMENTS".', route: "command", args: "", expected: 'The module returns the literal "".' },
  { mode: "own-command-money", text: "The documented threshold is $100.", route: "command", args: "", expected: "The documented threshold is ." },
  { mode: "own-command-path", text: "The source path is src/cost$1.ts.", source: "src/cost$1.ts", route: "command", args: "", expected: "The source path is src/cost.ts." },
  { mode: "own-command-argument-value", text: 'The module returns the literal "$1".', route: "command", args: "review", expected: 'The module returns the literal "review".' },
  { mode: "own-command-plain", text: "The source exports a literal value.", route: "command", args: "", expected: "The source exports a literal value." },
  { mode: "own-tool-path", text: "The source path is src/cost$1.ts.", source: "src/cost$1.ts", route: "tool", args: "", expected: "The source path is src/cost$1.ts." },
  { mode: "ordinary-command-control", text: "Review $1: $ARGUMENTS", route: "ordinary", args: "sample", expected: "Review sample: sample" },
] as const

for (const scenario of cases) {
  it.instance(scenario.mode, () => Effect.gen(function* () {
    const dir = (yield* TestInstance).directory
    const llm = yield* TestLLMServer
    const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim()
    const source = "source" in scenario ? scenario.source : "src/a.ts"
    mkdirSync(path.dirname(path.join(dir, source)), { recursive: true })
    writeFileSync(path.join(dir, source), `export const literal = ${JSON.stringify(scenario.text)};\n`)
    git("add", "--", source); git("commit", "-m", "reviewed literal source")
    const reviewed = JSON.parse(readFileSync(path.join(atlas, "OWN-SNAPSHOT.json"), "utf8"))
    reviewed.sourceRevision = git("rev-parse", "HEAD"); reviewed.snapshot = "literal-fixture"
    const unit = reviewed.units[0]
    unit.unit.id = "src"; unit.sourceBlobs = { [source]: git("hash-object", "--", source) }
    unit.pack.unit = "Controlled literal fixture."
    unit.pack.shape.contents = [source]
    const marked = `AUDIT_LITERAL_BEGIN[${scenario.text}]AUDIT_LITERAL_END`
    unit.pack.invariants[0].claim = marked
    const input = path.join(dir, "reviewed.json")
    writeFileSync(input, JSON.stringify(reviewed))
    const materializeOutput = execFileSync("node", [path.join(atlas, "scripts/materialize-own-snapshot.mjs"), input], {
      cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, OWN_SNAPSHOT_MATERIALIZE_IMPL: path.join(atlas, "packages/retrieval/dist/src/own-snapshot.js") },
    })
    const artifactPath = artifacts.staticOwnArtifactPath("src") as string
    const artifact = readFileSync(path.join(dir, artifactPath), "utf8")
    const coveragePath = ".opencode/skills/own/OWN-COVERAGE.json"
    const readFiles = () => [{ path: artifactPath, content: readFileSync(path.join(dir, artifactPath), "utf8") }, { path: coveragePath, content: readFileSync(path.join(dir, coveragePath), "utf8") }]
    const currentBlob = (p: string) => { try { return git("hash-object", "--", p) } catch { return undefined } }
    const verify = () => snapshots.verifyStaticOwnSnapshot(snapshots.parseOwnSnapshot(readFileSync(path.join(dir, "OWN-SNAPSHOT.json"), "utf8")), readFiles(), currentBlob)
    const before = verify(); expect(before.status).toBe("READY")
    const configuration = {
      model: "test/test-model", permission: { "*": "allow" },
      ...(scenario.route === "ordinary" ? { command: { "ordinary-audit": { template: marked, description: "Parametrized command control" } } } : {}),
      provider: { test: { name: "Test", id: "test", env: [], npm: "@ai-sdk/openai-compatible",
        models: { "test-model": { id: "test-model", name: "Test Model", attachment: false, reasoning: false,
          temperature: false, tool_call: true, release_date: "2025-01-01", limit: { context: 100000, output: 10000 },
          cost: { input: 0, output: 0 }, options: {} } }, options: { apiKey: "test-key", baseURL: llm.url } } },
    }
    writeFileSync(path.join(dir, "opencode.json"), JSON.stringify(configuration))
    const name = scenario.route === "ordinary" ? "ordinary-audit" : artifacts.staticOwnSkillName("src") as string
    const sessions = yield* Session.Service
    const prompt = yield* SessionPrompt.Service
    const session = yield* sessions.create({ title: scenario.mode, permission: [{ permission: "*", pattern: "*", action: "allow" }] })
    if (scenario.route === "tool") {
      yield* llm.tool("skill", { name }); yield* llm.text("AUDIT_DONE")
      yield* prompt.prompt({ sessionID: session.id, agent: "maestro", parts: [{ type: "text", text: "Load the audit skill." }] })
    } else {
      yield* llm.text("AUDIT_DONE")
      yield* prompt.command({ sessionID: session.id, agent: "maestro", model: "test/test-model", command: name, arguments: scenario.args })
    }
    const hits = yield* llm.hits
    const last = hits.at(-1)!
    const messages = last.body.messages as { role: string; content: unknown }[]
    const nonSystem = messages.filter((m) => m.role !== "system")
    const texts = nonSystem.flatMap((m) => typeof m.content === "string" ? [m.content] : Array.isArray(m.content)
      ? m.content.flatMap((c) => typeof c?.text === "string" ? [c.text] : []) : [])
    const markedTexts = texts.filter((text) => text.includes("AUDIT_LITERAL_BEGIN["))
    const delivered = markedTexts.flatMap((text) => [...text.matchAll(/AUDIT_LITERAL_BEGIN\[([\s\S]*?)\]AUDIT_LITERAL_END/g)].map((m) => m[1]))
    expect(JSON.stringify(messages)).toContain("You are Maestro")
    const after = verify(); expect(after.status).toBe("READY")
    expect(readFileSync(path.join(dir, artifactPath), "utf8")).toBe(artifact)
    records.push({ assertionMode, mode: scenario.mode, route: scenario.route, args: scenario.args,
      original: scenario.text, observed: delivered, before, after, source,
      sourceBlob: currentBlob(source), materializeOutput: materializeOutput.trim(),
      artifactUnchanged: true, requestCount: hits.length, endpoint: last.url.pathname,
      desiredLiteralEquality: scenario.route === "ordinary" ? null : delivered[0] === scenario.text,
      expectedCommandSemantics: scenario.route === "ordinary" ? delivered[0] === scenario.expected : null,
      renderedArtifact: artifact, capturedMessages: nonSystem,
      sourceReadback: readFileSync(path.join(dir, source), "utf8"),
    })
    // Preserve the capture before the desired invariant fails on the audited product.
    const expected = assertionMode === "desired" && scenario.route !== "ordinary" ? scenario.text : scenario.expected
    expect(delivered).toEqual([expected])
  }), { git: true }, 60000)
}

// Copy to packages/core/test/audit-skill-replacement.test.ts in a disposable checkout.
// Original state, skill, registry and output serializers. Only permission is a named allow fixture.
import { afterAll, expect } from "bun:test"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "../src/effect/app-node-builder"
import { LayerNode } from "../src/effect/layer-node"
import { SkillV2 } from "../src/skill"
import { PermissionV2 } from "../src/permission"
import { ToolRegistry } from "../src/tool/registry"
import { SkillTool } from "../src/tool/skill"
import { ToolOutputStore } from "../src/tool-output-store"
import { SessionV2 } from "../src/session"
import { AbsolutePath } from "../src/schema"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { executeTool, toolIdentity } from "./lib/tool"

const records: object[] = []
const output = process.env.AUDIT_OUT!
const permission = Layer.mock(PermissionV2.Service, { assert: () => Effect.void })
const it = testEffect(AppNodeBuilder.build(LayerNode.group([
  SkillV2.node, ToolRegistry.node, ToolRegistry.toolsNode, SkillTool.node,
]), [
  [PermissionV2.node, permission],
  [ToolOutputStore.node, ToolOutputStore.nodeWithoutConfig],
]))
afterAll(() => writeFileSync(output, JSON.stringify(records, null, 2) + "\n"))

for (const mode of ["embedded-cached-replace", "embedded-uncached-replace", "embedded-new-name", "directory-reload", "directory-new-path"] as const) {
  it.live(mode, () => Effect.acquireRelease(
    Effect.promise(() => tmpdir()), (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
  ).pipe(Effect.flatMap((tmp) => Effect.gen(function* () {
    const skill = yield* SkillV2.Service
    const registry = yield* ToolRegistry.Service
    const embedded = mode.startsWith("embedded")
    const name = "audit-replace"
    const nextName = mode === "embedded-new-name" ? "audit-replace-new" : name
    const directory = path.join(tmp.path, "first")
    const nextDirectory = mode === "directory-new-path" ? path.join(tmp.path, "second") : directory
    const info = (n: string, content: string, root: string) => SkillV2.Info.make({
      name: n, description: content, content, location: AbsolutePath.make(path.join(root, `${n}.md`)),
    })
    const oldInfo = info(name, "AUDIT_VERSION_A", directory)
    const newInfo = info(nextName, "AUDIT_VERSION_B", nextDirectory)
    if (!embedded) {
      mkdirSync(directory, { recursive: true })
      writeFileSync(oldInfo.location, `---\nname: ${name}\ndescription: first\n---\nAUDIT_VERSION_A`)
    }
    const first = yield* skill.transform((draft) => draft.source(embedded
      ? { type: "embedded", skill: oldInfo }
      : { type: "directory", path: AbsolutePath.make(directory) }))
    const primed = mode !== "embedded-uncached-replace"
    if (primed) expect((yield* skill.list())[0]?.content).toBe("AUDIT_VERSION_A")
    yield* first.dispose
    const afterDisposal = yield* skill.list()
    expect(afterDisposal).toEqual([])
    if (!embedded) {
      mkdirSync(nextDirectory, { recursive: true })
      writeFileSync(newInfo.location, `---\nname: ${nextName}\ndescription: second\n---\nAUDIT_VERSION_B`)
    }
    yield* skill.transform((draft) => draft.source(embedded
      ? { type: "embedded", skill: newInfo }
      : { type: "directory", path: AbsolutePath.make(nextDirectory) }))
    const sources = yield* skill.sources()
    const listed = yield* skill.list()
    yield* skill.reload()
    const reloaded = yield* skill.list()
    const tool = yield* executeTool(registry, {
      sessionID: SessionV2.ID.make("ses_audit_replacement"), ...toolIdentity,
      call: { type: "tool-call", id: "call-audit-replacement", name: "skill", input: { name: nextName } },
    })
    records.push({ mode, primed, afterDisposal, sources, listed, reloaded, tool,
      expected: newInfo.content, currentDiskOrEmbeddedContent: newInfo.content,
      desiredSourceAgreement: listed[0]?.content === newInfo.content,
      desiredReloadAgreement: reloaded[0]?.content === newInfo.content })
    const observed = mode === "embedded-cached-replace" || mode === "directory-reload" ? "AUDIT_VERSION_A" : "AUDIT_VERSION_B"
    expect(listed[0]?.content).toBe(observed) // characterization, not an acceptance pass
    expect(reloaded[0]?.content).toBe(observed)
    expect(tool.type).toBe("text")
    expect(tool.value).toContain(observed)
    if (embedded) expect(sources).toEqual([{ type: "embedded", skill: newInfo }])
  }))), 60000)
}

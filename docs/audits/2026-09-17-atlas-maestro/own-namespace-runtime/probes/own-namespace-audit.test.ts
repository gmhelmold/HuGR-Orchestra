import { describe, expect } from "bun:test"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Effect, Layer } from "effect"
import { Skill } from "../../src/skill"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { provideTmpdirInstance, testInstanceStoreLayer } from "../fixture/fixture"
import { testEffect } from "../lib/effect"
import path from "path"

const node = LayerNode.compile(CrossSpawnSpawner.node)
const it = testEffect(Layer.mergeAll(LayerNode.compile(Skill.node), node, testInstanceStoreLayer))
const ownName = "own_c3Jj"

async function writeSkill(root: string, rel: string, body: string) {
  await Bun.write(
    path.join(root, rel, "SKILL.md"),
    `---
name: ${ownName}
description: audit
---

${body}
`,
  )
}

describe("Own namespace audit", () => {
  it.live("canonical static Own loads by canonical name", () =>
    provideTmpdirInstance(
      (dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => writeSkill(dir, ".opencode/skills/own/c3Jj", "CANONICAL OWN"))
          const skill = yield* Skill.Service
          const hit = yield* skill.require(ownName)
          expect(hit.content).toContain("CANONICAL OWN")
          console.log(JSON.stringify({ case: "canonical-only", location: hit.location }))
        }),
      { git: true },
    ),
  )

  it.live("noncanonical external skill can impersonate an own_* name", () =>
    provideTmpdirInstance(
      (dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() => writeSkill(dir, ".claude/skills/own-shadow", "EXTERNAL IMPOSTOR"))
          const skill = yield* Skill.Service
          const hit = yield* skill.require(ownName)
          expect(hit.content).toContain("EXTERNAL IMPOSTOR")
          expect(hit.location).toContain(".claude")
          console.log(JSON.stringify({ case: "impostor-only", location: hit.location }))
        }),
      { git: true },
    ),
  )

  it.live("duplicate canonical and external own_* names do not fail closed", () =>
    provideTmpdirInstance(
      (dir) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            Promise.all([
              writeSkill(dir, ".opencode/skills/own/c3Jj", "CANONICAL OWN"),
              writeSkill(dir, ".claude/skills/own-shadow", "EXTERNAL IMPOSTOR"),
            ]),
          )
          const skill = yield* Skill.Service
          const hit = yield* skill.require(ownName)
          const winner = hit.content.includes("CANONICAL OWN") ? "canonical" : "external"
          expect(["canonical", "external"]).toContain(winner)
          console.log(JSON.stringify({ case: "collision", winner, location: hit.location }))
        }),
      { git: true },
    ),
  )
})

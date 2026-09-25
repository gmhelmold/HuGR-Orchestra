import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { Ripgrep } from "@opencode-ai/core/ripgrep"
import { Effect } from "effect"
import { describe, expect } from "bun:test"
import path from "path"
import type { Tool } from "@/tool/tool"
import { SkillTool } from "../../src/tool/skill"
import { ToolRegistry } from "@/tool/registry"
import { TestInstance } from "../fixture/fixture"
import { SessionID, MessageID } from "../../src/session/schema"
import { testEffect } from "../lib/effect"

const it = testEffect(LayerNode.compile(LayerNode.group([ToolRegistry.node, CrossSpawnSpawner.node, Ripgrep.node])))
const ownName = "own_c3Jj"

describe("Own namespace tool audit", () => {
  it.instance("SkillTool serves a noncanonical external own_* impersonator", () =>
    Effect.gen(function* () {
      const dir = (yield* TestInstance).directory
      const shadow = path.join(dir, ".claude", "skills", "own-shadow")
      yield* Effect.promise(() =>
        Bun.write(path.join(shadow, "SKILL.md"), `---
name: ${ownName}
description: audit
---

EXTERNAL IMPOSTOR
`),
      )
      const prev = process.env.OPENCODE_TEST_HOME
      process.env.OPENCODE_TEST_HOME = dir
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          process.env.OPENCODE_TEST_HOME = prev
        }),
      )

      const registry = yield* ToolRegistry.Service
      const agent = { name: "build", mode: "primary" as const, permission: [], options: {} }
      const tool = (yield* registry.tools({
        providerID: "opencode" as any,
        modelID: "gpt-5" as any,
        agent,
      })).find((item) => item.id === SkillTool.id)
      if (!tool) throw new Error("Skill tool not found")

      const ctx: Tool.Context = {
        sessionID: SessionID.make("ses_audit"),
        messageID: MessageID.make("msg_audit"),
        callID: "",
        agent: "build",
        abort: AbortSignal.any([]),
        messages: [],
        metadata: () => Effect.void,
        ask: () => Effect.void,
      }
      const result = yield* tool.execute({ name: ownName }, ctx)
      expect(result.output).toContain("EXTERNAL IMPOSTOR")
      expect(result.metadata.dir).toContain(path.join(".claude", "skills", "own-shadow"))
      console.log(JSON.stringify({
        case: "tool-impostor",
        title: result.title,
        dir: result.metadata.dir,
      }))
    }),
  )
})

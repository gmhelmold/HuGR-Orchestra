import type { Plugin } from "@opencode-ai/plugin"
import { which } from "@opencode-ai/core/util/which"
import { HugrComposerClient } from "./client"
import { createHuGRTools } from "./tools"

export const HuGRComposerPlugin: Plugin = async (input) => {
  if (!which("hugr-composer")) return {}
  const client = new HugrComposerClient(input.directory, input.worktree)
  return {
    tool: createHuGRTools(client),
    dispose: () => client.dispose(),
  }
}

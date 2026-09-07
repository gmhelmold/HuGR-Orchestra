import type { Plugin } from "@opencode-ai/plugin"
import { HugrComposerClient } from "./client"
import { createHuGRTools } from "./tools"

export const HuGRComposerPlugin: Plugin = async (input) => {
  const command = process.env.OPENCODE_HUGR_COMPOSER_COMMAND
  if (!command && process.env.OPENCODE_HUGR_COMPOSER !== "1") return {}
  const client = new HugrComposerClient(input.directory, input.worktree, command ? { command } : undefined)
  return {
    tool: createHuGRTools(client),
    dispose: () => client.dispose(),
  }
}

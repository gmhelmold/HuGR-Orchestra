import { Effect } from "effect"
import { effectCmd } from "../../effect-cmd"
import { debugRead } from "./read-handler"

export const ReadCommand = effectCmd({
  command: "read",
  describe: "invoke the legacy read tool directly (benchmark harness)",
  builder: (yargs) =>
    yargs.option("params", {
      type: "string",
      description: 'Tool params as JSON (e.g. {"filePath":"...","symbol":"foo"})',
    }),
  handler: (args) => debugRead(args),
})
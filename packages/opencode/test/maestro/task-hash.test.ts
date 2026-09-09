import { describe, expect, test } from "bun:test"
import { taskHash } from "../../src/maestro/task-hash"

const binding = {
  subagentType: "general",
  prompt: "implement dark mode",
  model: "test/model",
  taskID: "ses_child",
  planRevisionID: "plan_v1",
  revisionHash: "revision-hash",
  validationRecordID: "val_v1",
  validationHash: "validation-hash",
  contextHash: "context-hash",
  policyHash: "policy-hash",
}

describe("Maestro task hash", () => {
  test("mutation probe: every governed task intent and evidence field changes hash", () => {
    const expected = taskHash(binding)
    for (const key of Object.keys(binding) as (keyof typeof binding)[]) {
      expect(taskHash({ ...binding, [key]: `${binding[key]}-mutated` })).not.toBe(expected)
    }
  })
})

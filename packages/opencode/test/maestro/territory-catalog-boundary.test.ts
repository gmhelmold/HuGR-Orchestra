import { describe, expect, test } from "bun:test"

const consumerURL = new URL("../../src/maestro/territory-catalog.ts", import.meta.url)
const producerURL = new URL("../../../atlas-territory-catalog/src/catalog.ts", import.meta.url)

const forbidden = [
  "foundation/atlas",
  "@atlas/contracts",
  "@atlas/retrieval",
  "@atlas/knowledge",
  "@atlas/index",
  "@atlas/adapter-io",
  "child_process",
  "node:fs",
  "node:child_process",
]

describe("territory catalog import boundary", () => {
  test("consumer uses installed boundary, never direct vendor import", async () => {
    const source = await Bun.file(consumerURL).text()
    expect(source).toContain("@opencode-ai/atlas-territory-catalog")
    for (const needle of forbidden) expect(source).not.toContain(needle)
  })

  test("producer stays pure, never reaches into vendored Atlas", async () => {
    const source = await Bun.file(producerURL).text()
    for (const needle of forbidden) expect(source).not.toContain(needle)
  })
})

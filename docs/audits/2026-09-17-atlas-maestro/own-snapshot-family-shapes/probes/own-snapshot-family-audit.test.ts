import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  exportOwnSnapshot,
  materializeStaticOwnSnapshot,
  parseOwnSnapshot,
  verifyStaticOwnSnapshot,
} from "../src/own-snapshot.js"

const real = JSON.parse(
  readFileSync(resolve(process.cwd(), "OWN-SNAPSHOT.json"), "utf8"),
)

function candidate(kind: string) {
  const value = structuredClone(real)
  value.units[0].pack.invariants = []
  value.units[0].pack.advisory = []
  value.units[0].pack.gotchas = [
    { id: `bad-${kind}`, kind, tier: "T1", freshness: "FRESH" },
  ]
  return value
}

describe("Own snapshot complex-family shape audit", () => {
  for (const kind of ["relation", "negation", "transition", "test-vacuity"]) {
    it(`accepts structurally incomplete ${kind} gotcha`, () => {
      const value = candidate(kind)
      const parsed = parseOwnSnapshot(JSON.stringify(value))
      expect(parsed).toBeDefined()

      const exported = exportOwnSnapshot({
        snapshot: value.snapshot,
        sourceRevision: value.sourceRevision,
        units: value.units,
      })
      const output = materializeStaticOwnSnapshot(exported)
      const skill = output.skills[0]!

      expect(skill.content).toContain(`bad-${kind}\`: `)
      expect(
        verifyStaticOwnSnapshot(
          exported,
          [...output.skills, output.coverage],
          (path) => exported.units[0]!.sourceBlobs[path],
        ),
      ).toEqual({ status: "READY" })

      console.log(JSON.stringify({
        kind,
        parsed: true,
        verified: "READY",
        renderedEmptyClaim: skill.content.includes(`bad-${kind}\`: `),
      }))
    })
  }
})

import { describe, expect, test } from "bun:test"
import { validateTerritoryCatalog } from "../src/catalog"
import type { Territory as AtlasTerritory } from "../../../foundation/atlas/packages/contracts/src/territory"

const alpha: AtlasTerritory = { name: "billing", owner: "seat-billing", tier: "T0", globs: ["src/billing/**"] }
const beta: AtlasTerritory = { name: "search", owner: "seat-search", tier: "T1", globs: ["src/search/**"] }

function response(overrides: Record<string, unknown> = {}) {
  return { projectId: "prj_01", catalogVersion: "cat_v3", territories: [alpha, beta], ...overrides }
}

describe("Atlas territory catalog producer", () => {
  test("accepts unique canonical names with project/version binding", () => {
    const result = validateTerritoryCatalog(response(), "prj_01")
    expect(result.status).toBe("READY")
    if (result.status !== "READY") return
    expect(result.catalog.projectId).toBe("prj_01")
    expect(result.catalog.catalogVersion).toBe("cat_v3")
    expect(result.catalog.territories.map((territory) => territory.name)).toEqual(["billing", "search"])
  })

  test("real Atlas Territory objects satisfy producer input", () => {
    const territories: AtlasTerritory[] = [alpha, beta]
    const result = validateTerritoryCatalog({ projectId: "prj_01", catalogVersion: "cat_v3", territories }, "prj_01")
    expect(result).toMatchObject({ status: "READY" })
  })

  test("rejects duplicates, empty catalog, and cross-project responses", () => {
    expect(validateTerritoryCatalog(response({ territories: [alpha, alpha] }), "prj_01")).toEqual({
      status: "HOLD",
      reason: "duplicate-name",
    })
    expect(validateTerritoryCatalog(response({ territories: [] }), "prj_01")).toEqual({
      status: "HOLD",
      reason: "empty-catalog",
    })
    expect(validateTerritoryCatalog(response({ projectId: "prj_02" }), "prj_01")).toEqual({
      status: "HOLD",
      reason: "wrong-project",
    })
  })

  test("rejects missing version, malformed territory, and unavailable responses", () => {
    expect(validateTerritoryCatalog(response({ catalogVersion: "  " }), "prj_01")).toEqual({
      status: "HOLD",
      reason: "missing-version",
    })
    expect(
      validateTerritoryCatalog(response({ territories: [{ ...alpha, tier: "T9" }] }), "prj_01"),
    ).toEqual({ status: "HOLD", reason: "malformed-territory" })
    expect(validateTerritoryCatalog(response({ territories: [{ ...alpha, name: " " }] }), "prj_01")).toEqual({
      status: "HOLD",
      reason: "malformed-territory",
    })
    expect(validateTerritoryCatalog(undefined, "prj_01")).toEqual({ status: "HOLD", reason: "unavailable" })
    expect(validateTerritoryCatalog(null, "prj_01")).toEqual({ status: "HOLD", reason: "unavailable" })
  })

  test("version replay binds same receipt; changed catalog yields new receipt", () => {
    const first = validateTerritoryCatalog(response(), "prj_01")
    const replay = validateTerritoryCatalog(response(), "prj_01")
    expect(first).toEqual(replay)
    const changed = validateTerritoryCatalog(response({ catalogVersion: "cat_v4", territories: [alpha] }), "prj_01")
    expect(changed.status).toBe("READY")
    if (changed.status !== "READY") return
    expect(changed.catalog.catalogVersion).toBe("cat_v4")
    expect(changed.catalog.territories.length).toBe(1)
  })
})

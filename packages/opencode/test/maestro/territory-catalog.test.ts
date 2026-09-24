import { describe, expect, test } from "bun:test"
import { readTerritoryCatalog, selectTerritories } from "../../src/maestro/territory-catalog"

const alpha = { name: "billing", owner: "seat-billing", tier: "T0" as const, globs: ["src/billing/**"] }
const beta = { name: "search", owner: "seat-search", tier: "T1" as const, globs: ["src/search/**"] }

function okResponse() {
  return { projectId: "prj_01", catalogVersion: "cat_v3", territories: [alpha, beta] }
}

describe("Maestro territory catalog consumer", () => {
  test("resolves approved canonical scope through installed boundary", async () => {
    const result = await readTerritoryCatalog("prj_01", async () => okResponse())
    expect(result.status).toBe("READY")
    if (result.status !== "READY") return
    expect(result.catalog.catalogVersion).toBe("cat_v3")
    const selection = selectTerritories(result.catalog, ["billing", "search"])
    expect(selection).toEqual({ status: "RESOLVED", territories: [alpha, beta] })
  })

  test("reader receives no ambient project argument", async () => {
    let received = -1
    await readTerritoryCatalog("prj_01", (...args: unknown[]) => {
      received = args.length
      return okResponse()
    })
    expect(received).toBe(0)
  })

  test("wrong project, missing version, empty, and malformed hold before plan", async () => {
    expect(await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), projectId: "prj_02" }))).toEqual({
      status: "HOLD",
      reason: "wrong-project",
    })
    expect(await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), catalogVersion: "" }))).toEqual({
      status: "HOLD",
      reason: "missing-version",
    })
    expect(await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), territories: [] }))).toEqual({
      status: "HOLD",
      reason: "empty-catalog",
    })
    expect(
      await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), territories: [{ ...alpha, tier: "T9" }] })),
    ).toEqual({ status: "HOLD", reason: "malformed-territory" })
    expect(
      await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), territories: [alpha, alpha] })),
    ).toEqual({ status: "HOLD", reason: "duplicate-name" })
  })

  test("unavailable service and missing project hold", async () => {
    expect(
      await readTerritoryCatalog("prj_01", () => {
        throw new Error("service down")
      }),
    ).toEqual({ status: "HOLD", reason: "unavailable" })
    expect(await readTerritoryCatalog("prj_01", () => undefined)).toEqual({
      status: "HOLD",
      reason: "unavailable",
    })
    expect(await readTerritoryCatalog("  ", () => okResponse())).toEqual({
      status: "HOLD",
      reason: "missing-project",
    })
  })

  test("version replay binds receipt; changed catalog yields new receipt", async () => {
    const first = await readTerritoryCatalog("prj_01", () => okResponse())
    const replay = await readTerritoryCatalog("prj_01", () => okResponse())
    expect(first).toEqual(replay)
    const changed = await readTerritoryCatalog("prj_01", () => ({ ...okResponse(), catalogVersion: "cat_v4" }))
    expect(changed.status).toBe("READY")
    if (changed.status !== "READY") return
    expect(changed.catalog.catalogVersion).toBe("cat_v4")
  })

  test("selection rejects unknown, duplicate, and empty requests", async () => {
    const result = await readTerritoryCatalog("prj_01", () => okResponse())
    if (result.status !== "READY") throw new Error("expected READY catalog")
    expect(selectTerritories(result.catalog, ["billing", "nope"])).toEqual({
      status: "HOLD",
      reason: "unknown-territory",
    })
    expect(selectTerritories(result.catalog, ["billing", "billing"])).toEqual({
      status: "HOLD",
      reason: "duplicate-request",
    })
    expect(selectTerritories(result.catalog, [])).toEqual({ status: "HOLD", reason: "empty-selection" })
    expect(selectTerritories(result.catalog, ["src/billing/**"])).toEqual({
      status: "HOLD",
      reason: "unknown-territory",
    })
  })
})

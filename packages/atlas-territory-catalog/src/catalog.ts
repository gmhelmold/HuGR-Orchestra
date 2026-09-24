export type TerritoryTier = "T0" | "T1" | "T2"

export interface Territory {
  readonly name: string
  readonly owner: string
  readonly tier: TerritoryTier
  readonly globs: readonly string[]
}

export interface TerritoryCatalog {
  readonly projectId: string
  readonly catalogVersion: string
  readonly territories: readonly Territory[]
}

export type CatalogRejection =
  | "missing-project"
  | "wrong-project"
  | "missing-version"
  | "empty-catalog"
  | "malformed-territory"
  | "duplicate-name"
  | "unavailable"

export type CatalogResult =
  | { status: "READY"; catalog: TerritoryCatalog }
  | { status: "HOLD"; reason: CatalogRejection }

/** Validates untrusted catalog response against expected project binding. Pure, read-only. */
export function validateTerritoryCatalog(input: unknown, expectedProjectId: string): CatalogResult {
  if (!nonEmpty(expectedProjectId)) return { status: "HOLD", reason: "missing-project" }
  if (typeof input !== "object" || input === null) return { status: "HOLD", reason: "unavailable" }
  const response = input as Record<string, unknown>
  if (response.projectId !== expectedProjectId) return { status: "HOLD", reason: "wrong-project" }
  if (!nonEmpty(response.catalogVersion)) return { status: "HOLD", reason: "missing-version" }
  if (!Array.isArray(response.territories)) return { status: "HOLD", reason: "malformed-territory" }
  if (response.territories.length === 0) return { status: "HOLD", reason: "empty-catalog" }
  const seen = new Set<string>()
  for (const item of response.territories) {
    if (!isTerritory(item)) return { status: "HOLD", reason: "malformed-territory" }
    if (seen.has(item.name)) return { status: "HOLD", reason: "duplicate-name" }
    seen.add(item.name)
  }
  return {
    status: "READY",
    catalog: {
      projectId: expectedProjectId,
      catalogVersion: response.catalogVersion as string,
      territories: response.territories as readonly Territory[],
    },
  }
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function isTerritory(value: unknown): value is Territory {
  if (typeof value !== "object" || value === null) return false
  const item = value as Record<string, unknown>
  return (
    nonEmpty(item.name) &&
    nonEmpty(item.owner) &&
    (item.tier === "T0" || item.tier === "T1" || item.tier === "T2") &&
    Array.isArray(item.globs) &&
    item.globs.every((glob) => typeof glob === "string")
  )
}

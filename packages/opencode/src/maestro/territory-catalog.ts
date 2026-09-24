import { validateTerritoryCatalog } from "@opencode-ai/atlas-territory-catalog"
import type {
  CatalogResult,
  Territory,
  TerritoryCatalog,
} from "@opencode-ai/atlas-territory-catalog"

export type { CatalogResult, Territory, TerritoryCatalog }

export type CatalogReader = () => Promise<unknown> | unknown

export type TerritorySelection =
  | { status: "RESOLVED"; territories: readonly Territory[] }
  | { status: "HOLD"; reason: "empty-selection" | "unknown-territory" | "duplicate-request" }

/** Reads catalog through injected reader only. No ambient project inference, no I/O. */
export async function readTerritoryCatalog(projectId: string, reader: CatalogReader): Promise<CatalogResult> {
  if (typeof projectId !== "string" || projectId.trim().length === 0) {
    return { status: "HOLD", reason: "missing-project" }
  }
  // Unavailable service/package must fail closed; thrown reader errors become HOLD.
  const raw = await readSafely(reader)
  if (raw === unavailable) return { status: "HOLD", reason: "unavailable" }
  return validateTerritoryCatalog(raw, projectId)
}

/** Selects exact catalog names. Unknown, empty, or duplicate requests hold. */
export function selectTerritories(catalog: TerritoryCatalog, names: readonly string[]): TerritorySelection {
  if (!Array.isArray(names) || names.length === 0) return { status: "HOLD", reason: "empty-selection" }
  const seen = new Set<string>()
  for (const name of names) {
    if (typeof name !== "string" || name.trim().length === 0) return { status: "HOLD", reason: "empty-selection" }
    if (seen.has(name)) return { status: "HOLD", reason: "duplicate-request" }
    seen.add(name)
  }
  const byName = new Map(catalog.territories.map((territory) => [territory.name, territory]))
  const selected: Territory[] = []
  for (const name of names) {
    const territory = byName.get(name)
    if (territory === undefined) return { status: "HOLD", reason: "unknown-territory" }
    selected.push(territory)
  }
  return { status: "RESOLVED", territories: selected }
}

const unavailable = Symbol("unavailable")

async function readSafely(reader: CatalogReader): Promise<unknown> {
  try {
    return await reader()
  } catch {
    return unavailable
  }
}

export * as TerritoryCatalogReader from "./territory-catalog"

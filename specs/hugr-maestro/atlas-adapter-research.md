# Atlas Adapter Research

Status: frozen for issue #112. Researched 2026-09-08 against vendored Atlas snapshot.

## Verified Source

| Need | Source | Result |
|---|---|---|
| Canonical territory identity | `foundation/atlas/packages/contracts/src/territory.ts` | `Territory.name` is governance key; path/glob is not consumer scope identity |
| Single territory pack | `foundation/atlas/packages/retrieval/src/pack.ts:105-115,224-231` | `Packer.pack(Territory)` returns `BoundedPack` with axis hash, freshness, truncation, tail |
| Shared-scope pack | `foundation/atlas/packages/retrieval/src/pack.ts:234-245` | `Packer.mergedPack(Territory[])` enforces one shared `PACK_CAP` budget |
| Cap source | `foundation/atlas/packages/retrieval/src/pack.ts:50-65,130-134` | `capFor('pack')` is current budget authority |
| Empty scope behavior | `foundation/atlas/packages/retrieval/src/pack.ts:204-206,234-241` | uncovered/malformed scope returns empty total pack; it is not `UN-SEEDED` |
| Package boundary | root `package.json`; `foundation/atlas/package.json`; retrieval `package.json` | Atlas is nested independent workspace; no `@atlas/*` dependency/export exists in OpenCode workspace |

## Blocker

ACE requires a catalog address/version resolving `Territory.name` exactly once. Current measured retrieval starts only at
`Packer.pack(Territory)`: it has no project-scoped catalog interface. OpenCode cannot obtain canonical `Territory`
objects or version without either:

1. A frozen Atlas catalog read API exported through installed package/runtime boundary.
2. A versioned read-only Atlas service client with exact catalog response contract.

Direct relative import from `foundation/atlas`, copying `Territory` into OpenCode, path/glob lookup, or creating an
OpenCode catalog store would violate ACE and `atlas-foundation-seam-register.md`.

## Required Next Contract

Atlas owner must expose read-only `territoryCatalog(projectId)`:

```text
{ projectId, catalogVersion, territories: readonly Territory[] }
```

Required properties:

1. One `Territory.name` resolves once; duplicate names reject at source.
2. Catalog version is immutable address for one response.
3. Returned `Territory` objects are valid inputs to `Packer.pack` and `Packer.mergedPack`.
4. No write, shell, network, model, or ambient current-project inference.

After this contract exists as an installable/current Atlas seam, implement ACE-1 through ACE-9 in OpenCode adapter.

## Frozen Contract (#112)

```text
territoryCatalog(projectId) -> { projectId, catalogVersion, territories: readonly Territory[] }
```

`Territory` is Atlas canonical `{ name, owner, tier: T0|T1|T2, globs: readonly string[] }`.
`Territory.name` is scope identity. Path/glob/prose never identify scope.

Producer: `@opencode-ai/atlas-territory-catalog` (workspace-installable, read-only, pure).
Consumer: `packages/opencode/src/maestro/territory-catalog.ts` imports producer by package
name only. Direct relative import from `foundation/atlas` and `@atlas/*` runtime import
in Maestro source fail the boundary gate.

Validation (fail closed, before plan/Task):

```text
READY  projectId exact match, catalogVersion non-empty, territories non-empty,
       every Territory well-formed, every Territory.name unique
HOLD   wrong-project | missing-version | empty-catalog | malformed-territory |
       duplicate-name | unavailable
```

Version/freshness receipt is response itself: `{ projectId, catalogVersion, territories }`.
Replay keys on `(projectId, catalogVersion)`. Changed catalog version yields new receipt,
never mutation. Empty catalog is HOLD, never all-repository scope.

Forbidden in catalog read: write, shell, network, model, ambient project inference.
Caller supplies explicit `projectId`; reader is injected, never inferred.

Operational installation path: workspace dependency
`"@opencode-ai/atlas-territory-catalog": "workspace:*"` in `packages/opencode/package.json`.
No `foundation/atlas` checkout needed at Maiden runtime; Atlas owner data enters only
through injected reader returning real `Territory` objects valid for
`Packer.pack` / `Packer.mergedPack`.

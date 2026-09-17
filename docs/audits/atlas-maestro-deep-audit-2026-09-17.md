# Atlas + Maestro Deep Audit Ledger

Audit date: 2026-09-17  
Repository: `gmhelmold/HuGR-Orchestra`  
Source branch: `maestro/rebuild-fork-dev-clean`  
Source commit: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`  
PR: #11

## Audit rule

This ledger records only claims that can be tied to source, tests, CI, or a reproducible experiment. Hypotheses remain explicitly labeled until independently checked. Findings are promoted to GitHub issues only after a second evidence path confirms the problem or the improvement gap.

## Investigation passes

1. Repository topology and version pinning.
2. Atlas identity / grounding / knowledge / retrieval / persistence architecture.
3. Maestro admission / approval / task fencing / session-event integration.
4. Static Own materialization / host skill loading / freshness / coverage.
5. Query/Own ranking, token budgets, hit/decay semantics, and cross-module invariants.
6. CI, tests, and public-entrypoint reachability.
7. Adversarial counterexamples and duplicate-issue check.

## Evidence states

- **PROVEN** — source + independent corroboration or executable reproduction.
- **SUPPORTED** — source evidence is strong but runtime consequence has not been reproduced.
- **HYPOTHESIS** — plausible, not yet issue-worthy.
- **INTENTIONAL** — behavior is explicitly documented as a deliberate fail-closed/open design choice.

## Current candidate findings

These are not yet issues until double-checked:

- Query usage accounting may happen before final result delivery.
- Static Own artifacts may be loadable by generic skill discovery without receipt/freshness validation at load time.
- Static Own snapshot materialization may label graph coverage COMPLETE without carrying an independent graph-completeness proof.
- Own/query budgeting may bound selected claims but not the complete injected artifact.
- Gotcha freshness may differ from governing/advisory freshness recomputation.
- Ratification's contested signal may be constant on some governed emit/check paths.
- Public governed approval presentation is intentionally unavailable until durable plan/validation readers exist; this is a blocker, not automatically a bug.

## Next checks

- Trace each candidate from producer to final consumer.
- Find existing tests that should fail if the candidate is real.
- Search open/closed issues for duplicates before filing.
- Confirm whether code comments/specs explicitly classify the behavior as intentional.


## Pass 8 — Kernel boundary audit (PROVEN)

### Coverage
- Full kernel source inventory: 10 source files, 19 test files identified.
- Original full kernel suite executed after a clean Atlas build: **100 passed, 1 todo, 17 files**.
- Persist merge baseline after the clean build: **12 passed, 2 files**.
- Real Git was used for merge-boundary verification; `lineMerge()` was not accepted as a substitute for Git behavior.

### Finding K-1 — mutable kernel aliases break identity and append-only history
Status: **PROVEN** — filed as #74.

`createStore` hashes a value and stores the same caller-owned reference. After mutating the input, `id(store.get(oldHash)) != oldHash`. The same failure is visible through default `createAttach()`. `createLog` likewise stores Event references and returns shallow Map snapshots; mutating either the original payload or a value reachable from a prior snapshot changes history observed later.

Scope note: this proves the in-memory kernel primitives and default persist attachment path. It does not assert that adapter-io's disk CAS shares the defect.

### Finding K-2 — documented Git safe-degrade model is not Git
Status: **PROVEN** — filed as #75.

A fresh exact-SHA clone had neither an Atlas `.gitattributes` rule nor `merge.orchestra-atlas.driver` configuration. `setupHook()` only returns descriptors; no production caller or `orchestra-atlas-merge` executable was found.

Two real-Git controls were executed with valid events produced by the original compiled kernel:
1. shared base + distinct append on each branch -> content conflict, `UU .atlas/log.jsonl`, conflict markers;
2. independent add/add log creation -> add/add conflict, `AA .atlas/log.jsonl`, conflict markers.

The resulting files are not valid JSONL. This falsifies the stronger KERNEL-12 claim that the unconfigured default text merge degrades to a lossless line union. The pure `lineMerge` helper remains a useful algebraic model but is not a valid oracle for Git's real 3-way behavior.

### Finding K-3 — JSONL entry points violate KERNEL-7 totality
Status: **PROVEN** — filed as #76.

`parseJsonl` is documented as total but calls raw `JSON.parse`. A torn line throws `SyntaxError`; `lineMerge` propagates it. The full kernel suite remains green because current KERNEL-7 tests cover store/log entry points but not the later JSONL surface.

Correction constraint: silently skipping malformed lines would satisfy no-throw at the cost of violating no-event-loss. The failure model must preserve explicit corruption evidence.

### Issue accounting
- #74 — mutable CAS/EventLog aliases.
- #75 — merge bootstrap + real-Git fallback mismatch.
- #76 — JSONL totality gap.
- Duplicate search covered both open and closed issues before publication; no equivalent issue found.

### Audit hygiene
Several diagnostic/setup mistakes were observed and **not** attributed to the product:
- persist tests initially failed to resolve `@atlas/kernel` before build artifacts existed;
- a direct compiled-module probe initially assumed the wrong `dist` path;
- a temporary adversarial test blocked `tsc -b` because of its own branded-type cast and was removed before the clean product build.

These remain excluded from product findings.


## Pass 9 — Persist boundary audit (PROVEN + reachability-qualified)

### Baseline
A clean, built Atlas checkout at the pinned product SHA ran the complete persist test directory:
- **24 test files passed**
- **268 tests passed**
- no failures

The suite is especially strong on scrub semantics, chunk independence, transcript door redaction, reconstruct/fold laws, abstract merge algebra, host-adapter models, and re-invoke models. The new findings below are therefore primarily **external-boundary / durability / reachability** gaps.

### Finding P-1 — TranscriptRef does not survive store recreation
Status: **PROVEN** — filed as #77.

PERSIST-10 requires the complete transcript body to be a durable, versioned, content-addressed large object that remains fetchable on demand across machine/clone boundaries. The current `createTranscriptStore()` is a fresh process-local `Map<Hash, Uint8Array>` with strong intra-instance semantics but no reopen backend.

Original compiled-module reproduction:
- `first.put(body)` -> pointer resolves on `first`;
- same pointer on a new `createTranscriptStore()` -> `transcript large-object not found`.

Repository-wide source search found no durable transcript backend and no production construction of `createTranscriptStore()`; current usages are tests/E2E/reference surface. This is therefore a **durability/integration gap**, not evidence of a currently emitted dangling product pointer.

### Finding P-2 — Notes push configuration is only an in-memory claim
Status: **PROVEN, LATENT** — filed as #78 and re-qualified after filing.

PERSIST-8 requires the adapter to configure note transport because Git does not push notes by default. The real `createForge.configurePush` appends a refspec to an in-memory array. Real-Git reproduction:
- adapter ledger after configuration: `refs/notes/*:refs/notes/*`;
- `remote.origin.push` before: absent;
- `remote.origin.push` after: still absent;
- `git push origin main`: remote still has no `refs/notes/orchestra`.

Post-filing reachability double check: the repository's own `reference-model-guard` states that the persist package is overwhelmingly reference-model-only. `wire.ts` retains `createForge` in a `void [createForge, ...]` DAG pin, not a handler leg. #78 was updated to state explicitly that this is **latent integration correctness**, not proof that a shipped CLI/MCP push has already lost a note.

### Reference-model boundary
The repository mechanically acknowledges this state:
- only `NOTES_REF` crosses as a value into `adapter-io/src/git-forge.ts`;
- persist `attach`, `diff`, `merge`, `metering`, `placement`, `provenance`, `reconstruct`, `reinvoke`, and `transcript-store` are ledgered with no production caller;
- `source.ts` is partly shipped through OKF export/import;
- scrub is additionally consumed by CLI mining paths.

This distinction is now an audit invariant: **a green reference-model test is never treated as evidence that the product entrypoint exercises that invariant.**

### Positive findings
- TranscriptStore makes defensive byte copies on both store and fetch; it does not share the kernel aliasing defect from #74.
- The whole-body transcript store applies `scrub(body)` at its own admission boundary; callers do not have to remember the scrub manually.
- The streaming `admitToBuffer` seam explicitly declares that it has no production caller; this is documented rather than hidden.
- Provenance JSON parsing and PR-body parsing are total on malformed JSON.
- Placement model defensively snapshots its simple trailer/note records.

### Issues added in this pass
- #77 — process-local transcript large-object authority.
- #78 — note refspec configuration does not configure Git; latent until the Forge path is composed.

### Open questions intentionally NOT promoted
- Four-family shape scrub does not cover JWT/PEM/AWS secret keys. This is already explicitly documented as a narrower shipped primary control with a scanner backstop requirement; no new issue until the scanner/backstop reachability is independently audited.
- Forge PR projection is process-local. This matches the low-level Forge's current modelling comments; whether it violates the intended shipped host adapter depends on the still-unwired composition. Track during host/transport pass rather than issue prematurely.


## Pass 10 — Grounding audit (PROVEN + intentional limits separated)

### Baseline
A clean built checkout at the pinned SHA ran the full grounding suite:
- **13 test files passed**
- **80 tests passed**

All nine grounding source files were read end-to-end:
`drift.ts`, `emit-guard.ts`, `freshness.ts`, `gate.ts`, `ground.ts`, `index.ts`, `span.ts`, `subtree.ts`, `types.ts`.

### Finding G-1 — GROUND-11 transitive freshness exists only as an isolated model
Status: **PROVEN / P1** — filed as #79.

The ratified GROUND-11 law requires freshness to fold the caller's own structural hash plus the forward closure's INTERFACE-level `rState`. `grounding/freshness.ts` correctly implements this and has visible/held-out/multiset tests, but the repository's own reference-model ledger marks it `shipped: null`.

Every wired path uses `driftDetect`, which implements only the local grounding-set leg. The historical WP already says so explicitly and recommends wiring it later.

Direct compiled differential:
- own anchor unchanged;
- callee interface changed;
- `driftDetect` => `FRESH`;
- GROUND-11 `freshness` => `DRIFTED`.

This is a contract/runtime mismatch, not a speculative feature request.

### Finding G-2 — GROUND-12 policy-artifact anchors are documented non-behavior
Status: **PROVEN capability gap / P2 improvement** — filed as #80.

`AnchorApi.resolveAnchor` is a public/frozen surface with no runtime implementation in the grounding package. The black-box product suite explicitly labels `block|repo|project` as **DOCUMENTED non-behavior** and proves only the correct fail-closed behavior: real `atlas emit` rejects each as `ungrounded`.

The missing positive capability is the ratified GROUND-12 path:
- parseable policy artifact -> heading/section block hash;
- unrelated section change -> remains FRESH;
- target section change -> DRIFTED;
- non-parseable artifact -> whole-file content hash.

### Suspects rejected after double check

#### Malformed non-`Grounding` values throwing in `isGrounded`/`driftDetect`
Direct calls with `null`, `{}`, `{entries:null}`, or `entries:[{}]` can throw. This is real behavior but not currently promoted to an issue:
- the valid API domain is `Grounding`;
- governed emit has a `groundingWellFormed` shape gate before truth evaluation;
- read paths over attacker/committed malformed CAS facts go through `resolveFreshness(...try/catch...)`, which fails closed to `DRIFTED`.

The product boundary already contains the malformed shape; no demonstrated uncaught product path remains.

#### GROUND-13 advisory -> STALE
Confirmed WIRED, not a gap. `knowledge.resolveFactFreshness` is imported by `adapter-io/wire.ts` and the family-aware read oracle maps structural advisory drift to `STALE`, predicates to `DRIFTED`.

#### GROUND-8 untrusted provenance
Confirmed WIRED through the governed emit shape/ratification chain. A `trusted:false` predicate-shaped payload is converted to advisory authority, cannot use the fast path, and requires ratification before persistence. Existing governed-emit tests pin this behavior.

### Intentional limits, not issues

#### Stored GroundingSpan is not integrity-protected
REQ-GROUND-1f explicitly records the limit and an end-to-end tamper measurement: `grounding` is excluded from the KERNEL-8 canonical preimage, so changing stored span offsets/hash does not move fact identity and shipped reads do not notice. This is owner-approved and documented, not an undisclosed defect.

The sole production span minter today is `adapter-io/prompt.ts`, and it mints the full shown source range `0..bytes.length`; the code explicitly says current granularity is file-level even when the anchor is a symbol. No interior-offset producer exists today.

#### Grounding ordering
The data-model comment says entries are sorted by anchor while `ground()` preserves input order. Current production callers of `ground()` do not make this a demonstrated identity defect:
- mine admission passes one citation;
- relation derivation has its own two-ended identity.
Keep as a latent contract-quality note until a multi-entry intrinsic fact is built through this path.

### Issues added in this pass
- #79 — GROUND-11 interface-fold freshness is not wired.
- #80 — implement GROUND-12 policy-artifact block/repo/project anchoring.

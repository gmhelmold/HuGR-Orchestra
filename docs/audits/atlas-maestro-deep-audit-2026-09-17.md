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

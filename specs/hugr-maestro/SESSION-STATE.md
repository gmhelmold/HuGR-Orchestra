# Maestro V2 Session State

Updated: 2026-09-09. Status: clean rebuild staged on `fork/dev`; Maestro governed runtime, Atlas Own snapshot pipeline, and CI gates integrated. No push, PR, or merge.

## Recovery Snapshot

- Integration worktree: `/Users/gustavoschneiter/Documents/HuGR/_worktrees/orchestra-maestro-rebuild-clean`
- Branch: `maestro/rebuild-fork-dev-clean`; base: `fork/dev` at `46ac922a88`.
- Canonical checkout `/Users/gustavoschneiter/Documents/HuGR/orchestra-canonical` remains on external dirty branch `perf-lazy-persist-gate`; do not modify it.
- Clean Atlas vendor commit `e03736f521` imports Atlas `b319723` while excluding root `foundation/atlas/.atlas/**` Genesis output. `git ls-tree -r HEAD -- foundation/atlas/.atlas` returns `0`.
- Own commits end at `4859d9effb`: snapshot provenance binds to reachable vendor commit `e03736f521`; `npm run typecheck`, materializer tests 10/10, focused Own tests 35/35, and guard tests 14/14 pass.
- Cold review found model-supplied plan/validation fields could forge governed approval. `maestro_present_approval` now refuses until durable plan-revision and validation readers exist; governed Task remains an internal exact-event fence, not a usable runtime authority. Approval reply now refuses intervening discussion; presentation retry deduplicates by contract key.
- Cold review found materializer tests absent from CI. Atlas job now runs `node --test scripts/materialize-own-snapshot.test.mjs` before gate tests.
- Mutation probe removed direct-reply fence: new intervening-discussion test failed `APPROVED`; restored fence passes. `packages/opencode` typecheck passes; focused Maestro suite 48/48, Atlas materializer 10/10, Own guard 14/14, and Godfile tests 9/9 pass.
- Atlas baseline test expectations corrected at `44216b11fe`; three formerly failing files now pass 22/22.
- Vendor whitespace corrected at `35d197bad8`; `git diff --check fork/dev..HEAD` passes.
- CI/Godfile commit `4035d51621`; explicit lifecycle waiver update `46210c7e9`. `GODFILE_BASE_REF=fork/dev bun run check:godfile` reports 0 errors; Godfile tests 9/9 pass.
- `atlas-b319-baseline` worktree/branch is absent. PR `#11` is open against `fork/dev`: `https://github.com/gmhelmold/HuGR-Orchestra/pull/11`. Final independent cold review APPROVED. Remote CI created 2026-09-09 04:37 UTC but all nontrivial jobs remain `QUEUED` after 20 minutes; no job has started, no test failed. Wait for CI and human review; do not self-approve or merge.

## Goal

Build Maestro V2 native inside HuGR-Orchestra. OpenCode is runtime; current Atlas foundation is read/evidence
foundation; Maestro V1 is evidence, never architecture.

## Ratified Decisions

1. Every development session starts under Maestro; product work delegates to named member.
2. Governed work needs explicit approval of exact plan revision, including small changes.
3. Maestro is fixed; roster stable IDs are separate from genesis-only display names.
4. Atlas source remains independent; Orquestra vendors snapshot `foundation/atlas` at `b319723`.
5. Methodology library: Frame, Ground, Contract, Slice, Delegate, Verify, Reconcile, Close.
6. Actor provenance is `projectId + sessionId + memberId`.
7. User approves directly in Maestro conversation: displayed plan hash + explicit user message + validation hash.
   GitHub commit/PR/review/merge is delivery provenance, never plan-approval gate.

## Contracts Written

```text
methods/admit-request.md
methods/clarify-decision.md
methods/resolve-scope.md
methods/draft-plan.md
methods/assemble-context.md
methods/validate-plan.md
methods/request-approval.md
methods/revise-plan.md
actor-identity-contract.md
atlas-context-envelope-contract.md
atlas-context-envelope-acceptance.md
atlas-foundation-seam-register.md
v1-portability-register.md
```

## Critical Architecture

```text
orient-session
  -> admit-request
  -> clarify-decision | resolve-scope -> draft-plan
  -> assemble-context -> validate-plan -> request-approval
  -> validate-plan(INVALID) -> resolve-scope -> revise-plan -> assemble-context
```

`PlanIntent` is never Atlas scope. `resolve-scope` proposes only current Atlas Territory names. Draft/revise bind
immutable ScopeProposal and leave context `PENDING`. `assemble-context` binds current Atlas only after scope
exists. Empty/uncovered Atlas Pack is `HOLD`, never `UN-SEEDED`.

## Evidence

V1 measured:

```text
approval/genesis/campaign: 41/41
plan/compile/driver:      31/31
V1 internal Atlas pack:   19/19
```

Current Atlas foundation measured after `npm ci && npm run build`:

```text
retrieval pack + Awareness + Orientation: 30/30
```

Current Atlas facts: `@atlas/retrieval` supplies deterministic `BoundedPack`; `@atlas/memory` supplies derived
Awareness/Orientation. V1 internal `atlas/` remains reference only.

## Adapter Boundary

`AtlasContextEnvelope` is proposed, read-only, and unimplemented. It binds ComposedActor, plan revision,
ScopeProposal/catalog, current Atlas merged pack, scope snapshot, freshness, budget, and truncation receipt.
`ACE-1..9` specifies positive/negative proof plus mutation probes. No direct Atlas import, write door, Task call,
or adapter runtime exists yet.

## Current Implementation

`packages/opencode/src/maestro/approval.ts` is pure, fail-closed approval evaluation. It renders exact plan,
provenance, ComposedActor, validation/context/policy hashes, then binds only an ordered direct user reply to that
presentation. Exact `approve`/`aprovo` approves; exact decline/cancel commands decline. Question/sentiment remains
`PENDING`; assistant/tool text, stale/duplicate presentation identity, invalid actor/timestamp, message
order/session mismatch, altered display, or reused reply holds. It has no DB write and cannot authorize Task yet.

`packages/opencode/test/maestro/approval.test.ts`: 10/10 pass, including ordering/self-approval/reuse/duplicate-ID
mutation probes.

`packages/schema/src/maestro-event.ts` defines durable approval presentation/decision plus admission events; no Maestro
table or new Session storage exists. `packages/opencode/src/maestro/governed-task.ts` is an exact-binding guard. It is
wired only into explicit governed `TaskTool` calls, before `sessions.create`.

`packages/opencode/src/agent/agent.ts` now provides optional native primary agent `maestro`. It has normal OpenCode
permissions for exploration, edit, and delegation. Approval event/guard applies only to an explicit future governed
Task flow; it does not constrain ordinary Maestro work.

`packages/opencode/src/maestro/admit-request.ts` now supplies pure fail-closed assessment validation and deterministic
`ORIENT` / `CLARIFY` / `READY_TO_DRAFT` selection. `frame-request` is an actual lazy-loaded OpenCode skill at
`.opencode/skills/frame-request/SKILL.md`; both classify only and never dispatch. Its 7/7 standalone tests pass.
`packages/opencode/src/maestro/admission-record.ts` now writes/replays one `maestro.admission.decided` EventV2 record
for `(sessionID, messageID, methodVersion)` without a new table. It is not yet called automatically from Session prompt
handling; `maestro_record_admission` calls it only from Maestro after controlled assessment, binding current real user
message. `TaskTool` now fences only explicit `governed` Tasks: Maestro caller, same parent Session/project, and one
exact approved durable event must all match before `sessions.create`; ordinary Tasks remain unchanged. Integration tests
cover admission replay/conflict plus governed Task deny/allow.

`maestro_present_approval` writes an immutable `maestro.approval.presented` event tied to its actual assistant Message
and tool-call IDs; its exact rendered tool output is presentation evidence. `maestro_record_approval` reads that event,
real Session messages, and real completed tool output, then records only direct `approve`/`aprovo` or decline replies as
`maestro.approval.decided`. It does not parse plan prose. Maestro prompt directs governed flow through both tools before
governed Task. Lifecycle tests cover exact approval/replay and altered tool output hold.

`bun install --frozen-lockfile` restored workspace dependencies. Scoped Maestro/Task suites and schema manifest pass.
Package typecheck reaches only pre-existing `src/session/compaction.ts:587` incompatibility, then exceeds 120s; no
Maestro type error remains.

`packages/opencode/test/tool/task.test.ts` proves one real Session/EventV2 lifecycle: admitted user request -> approval
presentation tool evidence -> direct `aprovo` -> durable decision -> exact governed child Task. Scoped OpenCode tests
pass 52/52; schema manifest passes 2/2.

Full package verification after Maestro fixes passes affected manifest, agent, parameter-snapshot, lifecycle, and Godfile
gates. The full `packages/opencode` suite does not close in this environment: PTY and non-interactive CLI subprocess
tests time out at 15-30s, and a 900s rerun is terminated while those failures are in progress. No remaining Maestro test
failure was observed.

## Next Slice

Do not add Maestro storage before first governed work exists:

1. Resolve pre-existing `src/session/compaction.ts:587` typecheck failure before claiming package typecheck green.
2. Atlas owner must expose versioned read-only `territoryCatalog(projectId)` across an installable runtime boundary.
   `atlas-adapter-research.md` proves current seam starts at `Packer.pack(Territory)`, so ACE adapter must not be
   guessed or directly import vendored `foundation/atlas`.

Then implement current Atlas territory-catalog and context-envelope read adapter against `ACE-1..9`.

## Worktree

```text
/Users/gustavoschneiter/Documents/HuGR/_worktrees/opencode-maestro
branch: maestro-core
target: dev
```

Current changes are uncommitted. `git diff --check` passes. Godfile checks `3346` source files with `285` warnings and
`0` errors. `godfile-waivers.json` records stakeholder-authorized fixed LOC maxima for 70 pre-existing files; any
further growth or stale waiver fails.

## Own/Atlas Recovery State

- User requires Atlas/Genesis remain model/provider-agnostic. No provider adapter, signing key, or model-specific
  code was added.
- Backed up local Atlas CAS/projection to
  `/var/folders/lt/z11pyzhj0m17vn798jkk69hh0000gn/T/opencode/atlas-pre-rebuild-20260908-153917`.
- `foundation/atlas/.atlas/cas` and `projection.json` are removed from Git index but preserved locally; the staged
  `foundation/atlas/.gitignore` denies future admission. `.atlas/policy.json` remains admitted.
- Ran real Atlas build and regenerated `foundation/atlas/.atlas/index.scip` using `scip-typescript`; log ended
  `done .../.atlas/index.scip`.
- Existing local facts are drifted. Static Own materialization correctly refuses them:
  `static Own materialization requires fresh facts: packages/cli`.
- `packages/cli/src/mine-proposer.ts` now has provider-neutral Task proposal adapter. `ATLAS_TASK_PROPOSALS` names
  JSON `{ "structural/site": { "claim": "..." } }`; `dispatchMine` injects it into Genesis. The adapter reattaches
  current ranked candidate, then existing admission/staging remains mandatory.
- `OWN-SNAPSHOT.json`, generated `.opencode/skills/own/**`, `packages/retrieval/src/own-snapshot.ts`, and
  `harness/gates/own-snapshot-guard.mjs` were added to make tracked snapshot facts/units/blobs recompose static Own
  skills without local CAS. CI and `package.json` run `npm run own-snapshot-guard`.
- Last measured non-test-runner checks: `npm run typecheck`, `npm run godfile-guard`, `npm run own-snapshot-guard`,
  `git diff --check`, and `git diff --cached --check` passed. Guard log:
  `own-snapshot-guard: OK — 1 Genesis unit(s), 2 static Own file(s), source blobs fresh. Snapshot facts/units/blobs exactly recompose committed skills.`
- User explicitly requested no Vitest/Pytest for latest verification. Do not claim those tests ran.
- Cold review found then fixed: Task bridge lacked production caller; Own coverage recomposition lacked CI caller;
  CAS deletion/ignore staging was non-atomic. Re-run cold review after next edits, especially snapshot gate source,
  CI registration, and staged-vs-unstaged diff.
- Follow-up 2026-09-08: snapshot guard now rejects a `sourceRevision` that is not a Git commit reachable from
  `HEAD`, and rejects each declared blob when it is absent from that revision. Revision paths use `:./<path>`:
  required because this Atlas foundation is vendored beneath a larger Git root. This caught a real false failure
  before fix (`foundation/atlas/...` is repository-root path while snapshot paths are Atlas-root relative).
  `npm run typecheck`, `npm run own-snapshot-guard`, `node --check harness/gates/own-snapshot-guard.mjs`, and
  `git diff --check` pass after fix. Added gate test for forged/unreachable `sourceRevision`; Vitest remains
  deliberately unrun per user instruction.
- Do not claim Task-produced facts have reached `OWN-SNAPSHOT.json`: Task proposals enter candidate staging via
  `atlas mine`; promotion and runtime Own-pack composition remain separate from snapshot authoring. Next design
  slice needs explicit, reviewed Genesis snapshot-export boundary rather than silently treating candidate staging
  as canonical fresh facts.

## Planned TechLead Wave: Reviewed Own Snapshot Export

Frozen contract: `exportOwnSnapshot({ snapshot, sourceRevision, units })` accepts only non-empty, unique
`OwnSnapshotUnit[]` whose packs are `FRESH`; `materializeStaticOwnSnapshot(snapshot)` deterministically emits
skills plus coverage. Candidate staging is forbidden input. Writer must atomically replace only
`OWN-SNAPSHOT.json` and `.opencode/skills/own/**`; no CAS/projection write and no new CLI command.

Acceptance matrix: fresh reviewed pack + commit/blob anchors -> bytes written -> `own-snapshot-guard` READY;
stale pack, duplicate unit, invalid/missing blob, non-HEAD-reachable revision, source-revision blob mismatch,
or altered generated bytes -> HOLD/refusal with named reason.

WP topology after acceptance tests land:

| WP | Owner files | Depends | Deliverable |
| --- | --- | --- | --- |
| W0 lead | `packages/retrieval/src/own-snapshot.ts` | none | frozen API/scaffold only |
| W1 Luna | `packages/retrieval/test/own-snapshot.test.ts` | W0 | red/green acceptance cases for exporter contract |
| W2 Luna | new `scripts/materialize-own-snapshot.mjs` | W0,W1 | atomic reviewed-input -> snapshot/skills writer; no CLI surface |
| W3 Luna | `harness/gates/own-snapshot-guard.test.mjs` | W0 | mutation cases: malformed revision/blob/output fails |
| W4 Luna | `specs/hugr-maestro/own-protocol.md` | W0 | exact lifecycle, forbidden staging path, operator transcript |
| W5 lead | `package.json`, CI, integration tests | W1,W2,W3,W4 | script wiring, cold review, mutation probes, gates |

Conflict map: W1/W3/W4 disjoint and may fan out after W0. W2 new file only, may run with them. W5 is lead-only
shared integration. No agent edits `package.json`, CI, `own-snapshot.ts`, generated Own output, or session state.

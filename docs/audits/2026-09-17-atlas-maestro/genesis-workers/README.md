# Atlas / Maestro audit — Genesis worker and publication boundaries

## Published issues

GW-01 is [#65](https://github.com/gmhelmold/HuGR-Orchestra/issues/65); GW-02 is [#66](https://github.com/gmhelmold/HuGR-Orchestra/issues/66); GW-03 is [#67](https://github.com/gmhelmold/HuGR-Orchestra/issues/67). All were relisted/read after publication and remain open. `evidence/published-issues.json` records that readback.

## Scope and execution identity

Product: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`. Documentation is published separately; no production fixes or merges are included. The source checkout was independently cloned from the local repository and kept detached at the product SHA. Atlas dependencies were installed with its own lockfile, and the original implementation was compiled with `bun run typecheck`.

Environment: macOS x64, Node 22.17.1, Bun 1.3.14. The three diagnostics below use original compiled modules and real worker threads. CLI cases use actual temporary Git repositories and a deliberately controlled SCIP protobuf, **not an external SCIP-indexer run**. An operator-configured local Node command records stdin and returns no answer. It has no network/model integration. These experiments incurred no model inference.

## Progressive investigation journal

| Iteration | Work and resulting distinction |
|---|---|
| 1 — Baseline and deduplication | Reconfirmed the feature SHA, inspected existing issue titles and PR #14, and identified Genesis worker execution as a separate uncovered boundary. Existing issues #15–#62 were not counted as new discoveries. |
| 2 — Production trace | Followed CLI dispatch through arm resolution, pass configuration, pool construction and worker-side proposer reconstruction. The main thread receives an explicit arm; the worker receives repository/environment only. |
| 3 — Test-contract comparison | Read arm-isolation/union tests and the compile-only pool availability check. Existing tests establish driver-level selection, but source-run tests do not enter the compiled worker path. Ran the original Genesis, selected CLI and Maestro suites. |
| 4 — Behavior | Ran the actual CLI under four independently constructed fixtures, then repeated all four. Compared recorded prompts with the per-arm receipts emitted by the original renderer. Exercised original pool liveness with healthy, closed and deliberately exited-worker controls, also repeated. |
| 5 — Adversarial recheck | Ruled out an absent model, missing index, a general parser failure and unsupported single-arm selection using controls. Separated a worker startup fault from a model timeout; recorded watchdog intervention rather than pretending the pool returned an error. Rechecked source blob identities and preserved unsuccessful fixture setup attempts. |

These are five focused investigative iterations on this pipeline, **not five complete semantic readings of every monorepo file**. A broad automated full-tree screening command was blocked by the tool and did not run. No repository-wide coverage claim is derived from it.

## GW-01 — default multi-arm mining reconstructs advisory proposers in every worker

Both independent runs of the original CLI produced:

| Invocation | Recorded command calls | Actual prompt grammar | Exit |
|---|---:|---|---:|
| `ATLAS_MINE_SLOT=advisory` | 2 | advisory block | 0 |
| `ATLAS_MINE_SLOT=dependency` | 2 | `DEPENDS-ON:` | 0 |
| `ATLAS_MINE_SLOT=count` | 2 | `COUNT:` | 0 |
| unset slot, default three-arm run | 6 | **all advisory block** | 0 |

The default report labels advisory/dependency/count separately and prints the three different template digests obtained on the main thread. Nevertheless, the recorded stdin at the actual command boundary contains only advisory prompts. This is also a provenance mismatch: the reported per-arm template is not the template those workers used.

Root trace: `mine-arms.ts` threads `slot` into `driveMinePass`; `withDefaults` uses it in `resolveProposer(repo, env, slot)`; `driveMinePass` constructs `createProposerPool(repo, env)` without the slot; `mine-worker.ts` reconstructs via `resolveProposer(repo, env)` without the override. An unset environment selects advisory there. The worker owns the parser as well as the prompt, so fixing a display label alone does not fix the execution.

The stand-in abstains intentionally. Therefore this diagnostic proves prompt selection and provenance mismatch, **not the exact number of missing proven facts for a real model**, not model quality, and not a permission bypass. The explicit single-arm controls are important: they select the correct grammar because that selection is present in the environment the workers receive.

Evidence: `evidence/worker-arms-first.json` and `worker-arms-second.json` preserve full original stdout/stderr and every recorded prompt. The SHA-256 fields identify the captured prompt text, **not** Atlas's template digest; the algorithms and preimages are deliberately not conflated.

## GW-02 — exited worker cannot break the synchronous pool wait

Both independent runs:

| Control / fault | Observed behavior |
|---|---|
| Healthy original worker, no configured model | Returns `ok:true`, `seed:null`, exit 0. |
| Pool explicitly closed before dispatch | Returns named closed-pool failure, exit 0 from the diagnostic. |
| Worker exits before serving its job | Worker writes its exit marker and exits 23; parent never prints its post-call result; independent six-second watchdog terminates the fixture process. |

Fault injection is a worker-only Node preload calling `process.exit(23)` before the original entrypoint attaches its listener. **No production file is modified.** This models worker startup loss; it is not a naturally observed incident, a live model failure, or a power-loss experiment. The watchdog kills only the diagnostic subprocess it created.

Root trace: `mine-pool.ts` increments `died` in parent-thread `exit`/`error` listeners but synchronously blocks that same thread in repeated `Atomics.wait`. The worker that has exited cannot increment the shared completion count. `WAIT_SLICE_MS=250` is a wait slice, not a total deadline or an event-loop yield. There is no independent shared liveness signal or total deadline in that loop. The six-second observation is the experiment's bound; the unbounded-wait conclusion also depends on this source trace.

Evidence: `evidence/worker-liveness-first.json` and `worker-liveness-second.json`, including process status, duration, timeout code, stdout and stderr. This is a reliability finding; no third-party target or remote exploit was used.

## GW-03 — a later staging failure erases already-completed progress from the report

Repeated in two fresh fixture sets through original `driveMinePass`, the original default composed gate, scan/ranking, kernel, staging and a reopened original store. The proposer is a deterministic synthetic seed provider, not a model. The store wrapper injects a named refusal or throw on the **second** commit attempt; the first commit and independent reopen/read are real. This is controlled fault injection, not a naturally observed contention rate or a live CLI invocation. The displayed text is obtained from the original `foldVerdict` renderer.

| Case | Proposals attempted | Reported seeded / modelCalls | Reopened readable staged rows | Result |
|---|---:|---|---:|---|
| Healthy | 2 | 2 / 2 | 2 | exit 0 |
| Second commit returns contended | 2 | **0 / 0** | **1** | exit 1, named refusal |
| Second commit throws | 2 | **0 / 0** | **1** | exit 1 |

In both failures the report additionally states `frontier: unavailable`, `planned: 0`, empty site ledger and resume cursor `-1`. The rendered coverage explanation says planning failed and no frontier was obtained, even though original ranking completed, two proposals were attempted and the first candidate is readable after reopening.

Root: `drive.ts` handles per-site visit failures through `dispatch`, but calls `ports.upsert` outside that boundary. A later staging refusal throws from `buildControllerDeps().upsert`. `run-controller.ts` catches the unwound exception around the entire fresh run, clears `pending`, and returns the same empty report used for planning failure. The successful prefix, call accounting and actual completed cursor are discarded from the returned evidence.

**Counterevidence:** the failed run is correctly nonzero, and the first committed candidate is retained. This is an accounting/checkpoint/diagnostic loss, not deletion of durable candidate bytes, not clean-success reporting, and not proof of incorrect billing by a real provider. The injected proposer made two calls; no paid model was called.

Evidence: `partial-publication-first.json`, `partial-publication-second.json`, and `probes/partial-publication.mjs`. Required correction: retain the actual completed prefix and classify the failed site/publication separately, with truthful call accounting and recovery state. Never turn a failed publication into a completed site or pretend the whole run had no frontier. Replaying proposals after storage failure needs its own explicit budget/retry semantics.

## Original tests executed in this round

- Atlas lockfile installation and `bun run typecheck`: exit 0.
- Genesis tests: **264 passed in 32 files**.
- Selected CLI arm/budget/contention tests: **24 passed in 6 files**, including the original real-subprocess contention test.
- Maestro tests: **32 passed in 7 files**, 69 assertions.

`probes/check-invariants.mjs` separately asserts desired properties against each set of recorded original-runtime outputs: **6 positive controls pass and 4 desired-invariant checks fail in each set**. The four failures cover default arm selection, worker-loss termination, and the two partial-publication variants. It exits 1 intentionally when those defects are present. These are evidence assertions, not a replacement for product regression tests. Outputs are `desired-invariants-first.json` and `desired-invariants-second.json`.

This is **320 passing existing tests**, not 320 new regressions. Their passing does not negate the additional defective scenarios. The diagnostics record observed outcomes; their process exit 0 means evidence collection completed, not that the desired product invariants passed. This round did not run the complete monorepo suite or live LLM/UI workflow. Host dependencies were reused read-only from the pristine same-SHA checkout; Atlas has a separately installed dependency tree.

## Setup mistakes retained, not attributed to the product

The first CLI diagnostic omitted the command's required repository positional argument. The original CLI correctly refused before calling the stand-in. The corrected invocations use `mine .`; only those support GW-01. The first liveness control placed an explicit model-config path inside its disposable repository and correctly received a configuration refusal. The corrected healthy case uses an external empty configuration home. Both preliminary JSON files are retained as `*-setup-attempt.json`; neither is counted as a product defect.

## Reproduction

From a checkout pinned to the product SHA, compile Atlas using its lockfile and `bun run typecheck`. Copy this entire directory to a fresh temporary directory; create a `node_modules` symlink there to the checkout's `foundation/atlas/node_modules`. Export `ATLAS_AUDIT_ROOT` as the absolute path to that `foundation/atlas` directory, then run:

```sh
node probes/worker-arms.mjs first
node probes/worker-arms.mjs second
node probes/worker-liveness.mjs first
node probes/worker-liveness.mjs second
node probes/partial-publication.mjs first
node probes/partial-publication.mjs second
```

The scripts create only disposable fixture repositories, their own operator configurations, and JSON evidence. They do not use the real operator's model configuration. Keep the `evidence/` directory present. Successful product remediation must add desired-invariant regressions, not simply keep these observation collectors green.

## Remediation acceptance boundaries

GW-01 must propagate one authoritative resolved arm through prompt, parser, frontier and worker reconstruction; compare actual command inputs under default multi-arm and explicit-single-arm execution. Preserve operator-config trust boundaries and do not mutate global process environment to communicate per-pass state.

GW-02 must represent death/deadline in a mechanism visible while the caller is blocked, or change the waiting arrangement coherently. Validate startup exit, module-load error, post-dispatch exit, successful job, ordinary model timeout, cleanup and repeated close. Do not merely change the wait slice or turn unknown failure into a model abstention.

No issue is fixed by this evidence publication. The public Maestro approval-presentation guard remains unchanged; its intentionally unavailable journey is not claimed exercised by the passing internal suite.

## Evidence formatting

Copied baseline logs preserve output text, with trailing empty lines normalized to a single final newline for repository whitespace checks. Raw local logs remain unchanged. JSON evidence preserves the original observed output strings. This formatting is not a rerun.

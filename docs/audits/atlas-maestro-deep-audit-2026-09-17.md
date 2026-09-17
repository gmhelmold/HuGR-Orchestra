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

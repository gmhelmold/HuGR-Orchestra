# Published findings and verification map

All findings refer to product `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. They are OPEN findings, not corrections. Each issue contains scope, observed result, positive controls, source trace, smallest correction direction, success criteria, completeness criteria, quality standards, definition of done and invariants.

| Issue | Boundary | Execution level | Evidence |
|---|---|---|---|
| [#68](https://github.com/gmhelmold/HuGR-Orchestra/issues/68) | Content-state identity versus historical occurrence | Original CLI writes + reopened composed reads; real Git revert/reapply | `identity-runtime-round*.json`, `transitions` |
| [#69](https://github.com/gmhelmold/HuGR-Orchestra/issues/69) | Test display name versus unique subject | Original parser, producer, CLI, governed CAS/projection, readback | `identity-runtime-round*.json`, `testVacuity` |
| [#70](https://github.com/gmhelmold/HuGR-Orchestra/issues/70) | Moving Git ref versus immutable cache key | Original RevIndex and retained composed producer; no live MCP claim | `failure-boundaries-round*.json`, `movingProducer`; `identity-runtime-round*.json`, `movingRev` |
| [#71](https://github.com/gmhelmold/HuGR-Orchestra/issues/71) | Evaluation failure versus absence of findings | Original producer structured result compared to public CLI output | `failure-boundaries-round*.json`, `parse` |
| [#72](https://github.com/gmhelmold/HuGR-Orchestra/issues/72) | Failed publication versus confirmed consumption | Original Maestro services/Task; approved-event fixtures; one named publisher fault; counted executor | `maestro-consume-boundary-round*.json` |

All five observations repeated in three independent runs, with controls. A separate check of the documented portable identity-probe invocation also succeeded. The issue evidence links are immutable commits, not references that depend on a temporary folder staying alive.

## Deduplication decisions

- #68 is related to #37 but concerns the public historical transition producer, not Orientation's label-keyed log.
- #70 is related to #18 but concerns arbitrary-revision ref resolution/cache identity, not captured HEAD axes and publication watermarks. Passing an explicit new SHA to the SAME retained producer is the distinguishing control.
- #72 is related to #49 but occurs BEFORE any consumption row exists. The original database confirms absence; a clean retry works. #49's tested case has an existing durable row and a different recovery obligation.
- #69 and #71 share a feature but not a root cause: the first loses identity after successful parsing; the second discards a correctly recorded parse failure.

## What the audit does not close

No issue is marked fixed. The original 194 targeted tests pass, but the added characterizations demonstrate conditions missing from those tests. No full monorepo suite, live model, public approval-presentation journey or exhaustive fivefold source review is claimed. The public approval blocker remains intact.

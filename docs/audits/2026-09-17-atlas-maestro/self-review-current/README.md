# Adversarial self-review — current Atlas/Maestro audit head

Product under audit: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.
Audit head reviewed before this corrective commit: `eca0aa8161b1423cc27544e39a135b2891f56fa0`.

This is a review of the audit itself. It does not modify product code, close findings, enable public approval, or claim whole-repository certification.

## Scope

The review covers the work added from `a360219b` through `eca0aa8`: the host literal/cache publication and its first review, #83/#84, the Own namespace and governed background-binding rounds (#85/#86), and the complex GroundedFact-family extension of #24. It also checks the current PR #14 audit-only diff boundary.

## Corrections found

1. `host-literal-runtime/README.md` claimed temporary paths were normalized, but raw evidence intentionally preserved disposable `/private/tmp/opencode-*` paths. The claim is corrected; no personal HOME path was found in the reviewed evidence.
2. The same README said the two V2 runs had “the same results”. Semantic outcomes match, but raw JSON differs by generated temporary paths. The wording is narrowed to semantic equality.
3. Direct provider-payload inspection shows #83 reaches the textual Own receipt too: in the `src/cost$1.ts` command case, `sourceBlobs` is delivered as `src/cost.ts` while the on-disk verified artifact remains unchanged. This strengthens the same root cause rather than creating another issue.
4. The original complex-family #24 probe supplied `currentBlob` from the snapshot's own `sourceBlobs`. Current Git blobs were independently checked and match, but the proof was unnecessarily self-referential. This review reruns the probe with `git hash-object` as the current-blob authority; all four malformed families still verify READY.
5. The original #86 patch proved governed background dispatch was accepted, but it discarded the Task result. This review reruns it with assertions that the accepted result actually carries `metadata.background === true`, a `jobId`, `state="running"`, and `Background task started`.

## Revalidation

- Current host-literal manifest: every published entry matches its bytes; all JSON parses; local Markdown links resolve.
- `review/final`: observed host/core runs exit 0; desired host/core runs exit 1 with exactly 5 and 2 failures, while controls remain 4 and 3 respectively.
- #85 independent rerun: 4 pass / 0 fail / 6 assertions across the service and ToolRegistry probes.
- #86 strengthened rerun: 1 pass / 0 fail / 6 assertions; the returned dispatch is explicitly background/running.
- #24 strengthened rerun: 4 pass / 0 fail using real Git blob computation.
- The audit commits reviewed remain documentation-only; no product path appears in the diff from `a360219b` to `eca0aa8`, and `git diff --check` is clean.
- Whole-PR boundary check against product base: **205 changed paths, all under `docs/audits/`**. Full `git diff --check b0c33d2..HEAD` has one preserved historical warning in `runtime-proof/evidence/atlas-official-suite.log`: an extra blank line at EOF. That raw historical test log is intentionally not rewritten merely to cosmetically green the aggregate diff check; recent reviewed/corrective ranges themselves pass `diff --check`.

## Claims that remain deliberately bounded

- #83: original SessionPrompt + local HTTP provider boundary, not full CLI/UI or real-model inference.
- #84: service/registered-tool lifecycle, not a proven cross-project leak or complete Core V2 session.
- #85: host namespace/authenticity prerequisite; not unauthorized governed execution.
- #86: exact-approval contract defect behind a public presentation path that remains intentionally blocked.
- #24: shape/renderer contract defect; the malformed fixtures are synthetic and do not imply the committed snapshot contains them.
- None of these focused rounds satisfy the requested five semantic passes over the entire monorepo.

## Current disposition

#83, #84, #85 and #86 stay open. #24 stays open and now has stronger evidence for its completeness extension. Future fixes must use desired-property regressions; characterization tests that assert the defective baseline are not acceptance tests.

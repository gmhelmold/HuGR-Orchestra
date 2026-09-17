# Atlas / Maestro — identity and runtime boundary audit

Product baseline: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.

This is an additional audit, not a production fix or a replacement for earlier findings. The journal is updated progressively. Existing issues #15–#62 were reviewed for duplicates. The complete tracked-file inventory has 7,936 files, including 1,252 under Atlas; inventory coverage is NOT a claim of semantic review of every file. Focused source reads are recorded separately in the source manifest.

## Newly executed evidence

The original Atlas packages compiled. Three independent runs of `probes/identity-runtime.mjs` used real Git repositories, real filesystem/CAS, original WASM parser, original governed doors and original CLI subprocesses. No replacement hash, gate, reducer, or LLM was used.

| Scenario | Observed |
|---|---|
| Linear history A→B→C | 2 accepted transitions, 2 nodes, 1 current |
| Legitimate revert A→B→A | 2 accepted transitions, 2 nodes, **0 current** |
| Reapply A→B→A→B | 3 accepted occurrences, **2 nodes**, 0 current |
| Two tests with different names | 2 scanned findings, 2 persisted/read rows |
| Same test leaf name in different suites | 2 scanned findings, **1 current row** |
| Reverse the suite order in an independent fixture | The surviving shape changes |
| Same RevIndex, HEAD advances | Retained HEAD lookup returns prior content; explicit new SHA and fresh instance return new content |

These are characterizations: a passing probe means that the stated observations were reproduced, not that the product satisfies the desired invariants. The transition algorithm explicitly defines behavior for cycles; the finding concerns a valid acyclic Git history collapsing into a content-state cycle, not a claim that the algorithm violates its own set-membership formula. Test names are not qualified by suite in the scanned witness or persisted identity.

Historical transitions must remain historical; no proposal here rechecks their truth against current HEAD. Source hashes are not semantic proof. A symbolic Git name is not an immutable revision identity.

## Reproduction

From a checkout with Atlas dependencies installed and original packages built:

```sh
AUDIT_ROOT=$(mktemp -d)
mkdir -p "$AUDIT_ROOT/home" "$AUDIT_ROOT/tmp"
env -i HOME="$AUDIT_ROOT/home" TMPDIR="$AUDIT_ROOT/tmp" \
  PATH="$PATH" HUGR_AUDIT_REPO="$PWD" \
  ATLAS_ACTOR=seat:owner ATLAS_RATIFY_TOKEN=seat:ratifier \
  node docs/audits/2026-09-17-identity-boundaries/probes/identity-runtime.mjs "$AUDIT_ROOT"
```

Run from the repository root. The script imports the original built Atlas modules from that checkout and creates its fixtures outside it. It does not invoke a model or execute the scanned test bodies. Files named `example.test.ts` are parser input, not claimed passing product tests.

## Verification boundaries

The original targeted Atlas suite result and its exact command are included. Runtime observations cover CLI transitions/test-vacuity, reopened composed reads, and the direct original RevIndex adapter. The moving-reference experiment does not yet prove a stale answer from a public MCP tool. Maestro dispatch fault handling was exercised with seeded approval records, real services and a counted no-network executor; the public approval-presentation tool remains intentionally unavailable and must not be enabled from model-supplied validation.

No production source, policy of an existing project, workflow, merge gate, or existing issue state was modified. No automatic merge or issue closure is requested by this audit.

## Additional confirmed boundaries

The `failure-boundaries.mjs` probe executes the real CLI parser-failure cases and retained composed transition producer. An unparseable-only scan is rendered byte-identically to a valid no-findings scan. A mixed scan exits 0 and omits the parse failure. A retained transition producer uses obsolete HEAD resolution; a fresh producer or immutable SHA is the positive control. Both observations repeat three times.

`maestro-consume-boundary.test.ts` exercises original TaskTool with seeded approved events and real Session/Database/Event services. Only the model port is counted without network, and only the Consumed publish is fault-injected in the error case. The error reports approval-consumed despite zero durable markers; restoring the publisher permits the exact approval to dispatch once. Normal and actually-consumed controls are included. All three cases repeat in three independent Bun runs.

## Evidence index

- `UNDERSTANDING.md`: detailed learned model, source paths, counterevidence and hypotheses not promoted to issues.
- `JOURNAL.md`: five progressive focused passes. These are NOT five exhaustive semantic reads of the monorepo.
- `evidence/verification-summary.json`: 136 original Atlas tests in 15 files and 58 original Maestro/Task tests in 8 files, all passing; characterization runs reported separately.
- `evidence/reviewed-source-manifest.json`: 42 full files read, totaling 7,071 physical lines including comments and tests; this is not a business-logic LOC count.
- `evidence/independent-source-check.json`: four source blobs rechecked through independent GitHub reads.
- `evidence/*round*.json`: raw observations with positive controls and real fixture identities. Historical absolute temp paths identify where measurements ran, not a portable installation requirement.

## Maestro probe reproduction

Use a disposable checkout at the product baseline with working host dependencies. Copy `probes/maestro-consume-boundary.test.ts` into `packages/opencode/test/maestro/audit-consume-boundary.test.ts`; its relative imports intentionally follow the original test layout. From `packages/opencode`, run `bun test test/maestro/audit-consume-boundary.test.ts` with a temporary HOME/TMPDIR and optional `AUDIT_OUTPUT` pointing to an output JSON file. Remove only that new diagnostic copy afterwards. No existing test or production file needs modification.

The fault is injected before publication, not after a durable marker is written. Do not interpret the seeded approval fixtures as a working public approval journey.

## Published issues

See [FINDINGS.md](./FINDINGS.md) for issues **#68–#72**, their exact evidence paths, runtime reachability and deduplication rationale. These records do not close or fix any issue.

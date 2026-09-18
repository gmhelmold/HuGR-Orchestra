# Deepening #24 — GroundedFact family shape validation

Audited product: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.
Active issue: [#24](https://github.com/gmhelmold/HuGR-Orchestra/issues/24).

The original #24 reproduction showed a malformed predicate accepted by the Own snapshot parser and later rendered as `undefined`. Its completeness criteria explicitly required auditing the other accepted fact families. This round executes that requirement.

## Source result

In `packages/retrieval/src/own-snapshot.ts`, `isFact()` validates advisory and predicate specially, but for `relation`, `negation`, `transition`, and `test-vacuity` it accepts the kind after checking only common `id`, `tier`, and `freshness` fields.

The real family types require substantially more structure (grounding, endpoints/relation kind, scoped-negative identity, transition lineage, test-vacuity witness/shape, etc.).

`packages/retrieval/src/own-artifact.ts`'s `claimOf()` returns text only for advisory/predicate. If one of these complex families is admitted as a gotcha, its rendered claim is empty.

## Runtime reproduction

Using the current committed `OWN-SNAPSHOT.json` as a valid control, the audit replaced the fact bands with one minimal gotcha at a time:

`{ id, kind, tier:"T1", freshness:"FRESH" }`.

For **all four** families:
- `parseOwnSnapshot` accepted;
- `exportOwnSnapshot` accepted;
- materialization succeeded;
- the generated gotcha line had an empty claim;
- `verifyStaticOwnSnapshot` returned `READY`.

The four-case probe passed twice. The existing `own-snapshot.test.ts` passed 20/20 in the same environment.

See [probe](probes/own-snapshot-family-audit.test.ts) and [results](evidence/results.txt).

## Classification

This strengthens #24; it does not justify a second issue. The underlying defect is one parser/renderer shape contract that accepts states the downstream renderer cannot faithfully represent.

The right correction is an authoritative runtime decoder/validator for every accepted GroundedFact variant (or a deliberately narrower gotcha contract), not a sequence of one-off field checks per issue.

## Adversarial self-review qualification

The originally published probe passed `currentBlob` by looking up the reviewed snapshot's own `sourceBlobs`. That was sufficient to isolate parser/renderer shape behavior but was not an independent current-source witness. A subsequent self-review verified all three committed snapshot blobs against real `git hash-object` output and reran all four malformed-family cases with `git hash-object` supplying `currentBlob`; all four still returned `READY` with empty rendered claims. See [`../self-review-current/`](../self-review-current/).

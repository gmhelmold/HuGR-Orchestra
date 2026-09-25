# Reconciliation proof bundle

Product baseline: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.

Start with [AUDITORIA.md](AUDITORIA.md), then [JOURNAL.md](JOURNAL.md) and [execution-summary.json](evidence/execution-summary.json). Issues: #55, #57, #59, #60, #61. No product fix or merge is included.

## Re-run Atlas diagnostics

Use an isolated checkout of the product baseline with its original dependencies. Build from `foundation/atlas` using `bun run typecheck`. From any directory, run:

```sh
node /path/to/this/bundle/probes/reconcile-probes.mjs /path/to/checkout/foundation/atlas /tmp/reconcile-observations.json
node /path/to/this/bundle/probes/additional-controls.mjs /path/to/checkout/foundation/atlas /tmp/additional-observations.json
```

These diagnostics import compiled original modules and the original fixture/CLI/MCP harness. They create and remove temporary fixture repositories. They intentionally assert the observed defective behavior: exit 0 confirms reproduction, not product correctness. Run 1 preserves an initial diagnostic mistake; runs 2 and 3 are the corrected complete repetitions.

## Maestro diagnostic

In an isolated checkout, place `probes/maestro-conflicts.test.ts` at `packages/opencode/test/maestro/audit-conflicts.test.ts`; from `packages/opencode`, run `AUDIT_OUT=/tmp/maestro-conflicts.json bun test test/maestro/audit-conflicts.test.ts`. Remove only that copied diagnostic afterward. The result records six normally scheduled Effect concurrency pairs and a sequential control; it does not prove all interleavings or enable the blocked public presentation tool.

## Scope / integrity

Source integrity, direct-read coverage and whole-repository inventory are recorded separately. Inventory is not semantic review. The two reverify-population experiments use a minimal controlled SCIP protobuf, not the external indexer. Other lifecycle experiments use real file grounding and Git changes.

Antecedent audits: #14, #43, #44, #52, #53. Their results were not counted as executions in this bundle. Reference-model guard remains red at the audited baseline; it was not disabled or treated as a passed gate.

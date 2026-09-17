# Atlas/Maestro — Graph and boundary audit

Product: b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7. Separate disposable checkout; no product fixes or merge.

## Pass 1: version and prior evidence
Confirmed unchanged feature branch using GitHub ref. Read prior issues 15–42 and previous lifecycle journal; reusing existing issues for overlapping findings. Current investigation focuses graph completeness, ownership impact, deterministic identity and Maestro consumer boundaries. Inventory is not a claim to have read every file semantically.

## Pass 2: source-to-consumer trace
Read index build/depgraph/retrieval/fold/OwnImpact, production retrieval-model and projection query, runtime test fixtures, and Maestro admission, approval persistence and Task dispatch. Distinguished escaped spatial/AST identities from raw-file dependency hashes. Verified with full source search that ownImpact and createDriftFold have no production callers at this SHA.

## Pass 3: implementation and transport observations
Built the exact isolated Atlas checkout with bun run typecheck (exit 0). Ran graph-probes.mjs twice: five observations confirmed in each run, with original compiled modules, real kernel/CAS/Git/AST and controlled minimal SCIP. Selected original graph suite: 9 files / 60 tests pass. These are not acceptance tests for the newly observed cases.
Ran original MCP stdio server via repository harness: source without own fact, encoded provider/consumer names and real AST-level consumer anchors all lose reachable facts; direct source scope is the positive control. Restarts preserve the omissions. A fourth story confirms dependency underApprox=true is omitted from the response. No indexer-quality claim: SCIP input is explicitly controlled.

## Pass 4: host and counterevidence
The first host experiment could not start because the disposable clone lacked per-package node_modules links (preload missing); recorded as audit environment error, not product defect. Linked the existing dependencies without modifying the original source checkout and retried. Authority setup is the internal production recorder plus a visible presentation fixture, not the intentionally disabled public approval tool.

## Pass 5: cold review, scope correction and publication
Second MCP run confirmed all four scenario groups; original Maestro suite passed 32 tests/7 files. Host diagnostic succeeded with 2 tests under an explicit 60-second timeout after preserving setup/preload and five-second-timeout failures as instrument errors. The later third host run and broad parity operation were blocked by the tool and are neither counted nor retried through another route.
Published #45–#49. Kept local-versus-global graph completeness and immutable-versus-reusable DriftFold lifetime as qualified contract observations, not public-runtime incidents. OwnImpact is explicitly unwired. Public Maestro presentation remains disabled; approval authority is an internal fixture, not invented evidence of a usable end-to-end journey.
No product fix, merge or new CI certification. These are five investigation passes, not five entire semantic reads of the 7,936-file repository.

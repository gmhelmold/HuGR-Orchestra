# Progressive audit journal — round 3

Base b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7. Product checkout read-only; no new fixes/merges.

## Pass 1 — repository baseline and deduplication
Confirmed unchanged product ref; recovered prior documentation PR #14, head 14e74743d02a97bc577e1dffb6cb04d213c57569. Issues #15–31 already exist. Inventory is metadata, not semantic reading. Scope advances to previously unverified lifecycle and boundary contracts; only new findings or new evidence for existing issues will be published.

## Pass 2 — Memory/Orientation lifecycle (original runtime modules)
Read complete durable-log, memory-store, memory-read, memory-emit, memory-verdicts, orientation-store, awareness-store, memory/types, template, inject, orient, respawn, logbook and kernel/log. Followed composition into CLI/MCP read ports and memory emit handler. Historical reference-model banners are stale: compose imports these stores; caller search, not banner, establishes exposure.

Executed probes/memory-lifecycle.mjs against original compiled modules and original BLAKE3 kernel, writing only synthetic temporary stores. Six diagnostic cases verified their predicted observations; this is not six successful product acceptance tests. Only the named scanner was substituted with an explicitly clean synthetic fixture; scanner quality/security was not tested.

MEM-R3-01: after a torn non-newline tail, governed emit returns ok:true but the next record is lost on reopen; later append survives. A newline-terminated damaged line does not consume the following record.
MEM-R3-02: low-level read reports rejected=1; composed recall/orientation verdicts erase that diagnostic and return successful empty/partial data.
MEM-R3-03: one 80-word rule with six frecency versions occupies one injected slot; version 7 is rejected with tokens=560/cap=500, although the hypothetical current rule costs 80 by the same cap primitive. Historical versions are counted on write but deduplicated on read.
MEM-R3-04: orientation running→blocked→running retains blocked because repeated label identity ignores causal supersedes; 3 physical events fold to 2 without rejection. Durable builder is exercised; a live producer of these state events has NOT been established.
MEM-R3-05: two successful task checkpoints for the same owner/unit resume the oldest fold. spawnFold exists but is not wired into public runtime; prospective correctness issue, not demonstrated live Maestro behavior.
MEM-R3-06: logbook emit accepts an empty and a 281-character section rejected by the existing section validator. Duplicate-PR control still refuses.

Next: repeat through actual transport where possible, inspect existing test coverage/counterevidence, and investigate Maestro persistence idempotency without enabling its intentionally blocked approval tool.

## Pass 3 — Public transport and existing tests
Ran four new stories through the original MCP stdio server and SDK, actual gitleaks 8.30.1, real fixture Git/filesystem and restarts. Three passed initial diagnostic assertions; the fourth initially failed because the probe incorrectly expected an internal `ok` field in the serialized MCP body. Corrected the harness expectation (public success is MCP isError=false), retained initial output, then all four observations verified. Corrected an initial CLI `--taskId` spelling to the documented `--task-id`; no CLI parity claim is taken from the initial invocation.
Original focused memory suite: 4 files, 50 tests passed. These tests do not cover the newly exercised boundary conditions.

## Pass 4 — Concurrency and host counterevidence
Two original MCP processes simultaneously wrote valid logbook entries for one PR. Across three distinct PRs: both writes admitted, two durable records per PR, subsequent sequential duplicate refused. This separates O_APPEND no-lost-write from atomic business admission.
Maestro original recorder, Effect and SQLite: three rounds of eight concurrent identical admissions all succeeded and replayed one equal result; altered input refused, four distinct keys succeeded. The suspected admission retry race was NOT reproduced and is NOT published as a defect.
Original Task tests: valid resume and missing-ID new-child fallback both pass (2 tests, 24 filtered out). This fallback is deliberate and will be filed only as a continuity-contract improvement, not a regression. V2 built-in tool composition is a separate registry and explicitly lists task as a remaining port; this round does not establish V2 live Maestro availability.

## Pass 5 — Cold review, deduplication and publication
A refreshed issue read discovered concurrent issues #32/#33/#34/#37 matching four independently exercised cases. Own #38 was closed explicitly as duplicate of #32. Additional MCP evidence will be linked to canonical issues without overwriting their bodies. New independent issues: #39 concurrent logbook admission; #40 read-health propagation; #41 oldest task checkpoint (not publicly wired); #42 explicit resume fallback (intentional compatibility behavior).
Final reruns use corrected probes; initial harness mistakes remain in the audit evidence, not attributed to the product. This journal records investigation passes, NOT five complete semantic readings of all 7,936 tracked files.

Publication decision: use a separate documentation-only branch (`audit-memory-lifecycle`) and additive directory, leaving concurrent PR #14 untouched except a final cross-reference comment.

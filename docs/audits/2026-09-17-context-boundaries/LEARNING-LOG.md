# Atlas/Maestro — ongoing context-boundary investigation

Product baseline: b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7.
Scope: five distinct review lenses with explicit per-file coverage; NOT five exhaustive line-by-line readings.

## Pass 1 — inventory and prior evidence
Verified branch head through GitHub; read repository instructions; captured full tracked-file inventory and all issue/PR metadata available from the first 100-entry repository page (fewer than 100 returned). Source checkout isolated; existing working trees preserved. Read previous issue bodies before proposing new findings.

## Remaining review lenses
2. Data/identity and public contracts.
3. Producers, consumers, omissions and fallback behavior.
4. Original-code integration tests with positive and negative controls.
5. Independent repetitions, prior-test counterevidence and issue deduplication.

## Pass 2 — contracts and producers
Read Awareness root construction, memoization, disk adapter and existing tests. Production memoryAwareness reads the uncached path; assembleForWave has no external production caller, so a cache defect is NOT a demonstrated live MCP defect. Read Own composer and ceiling reducer; duplicate Injection kinds are not rejected/documented as prohibited in the signature, but no production resolveCeiling caller was found. Read Maestro admission tool, record reducer, host context constructor and compaction producer: auto-continue messages are role=user with synthetic text parts; tool filters only role. Hypotheses are not yet findings; diagnostic scripts exercise original modules.

## Pass 3 — executed original-module diagnostics
Awareness: addition/change of secondary constitution rows is invisible to the memo while cold read sees it; unchanged-primary controls and changed-primary positive controls distinguish the cache-key defect. Budget: six separate 1000-unit packs plus pinned 400-unit Awareness yields a reported 4400 but actual surviving 5400. Both repeated in independent runs; original code, no copied algorithms. Maestro first fixture did not provide Truncate required by Tool.init; all four cases failed setup, so none is counted as product evidence. Fixture dependency group corrected to match the original lifecycle test.

## Pass 4 — regression controls and independent repeat
Original Atlas tests: 31 passed in 4 files. Original Maestro tests: 32 passed in 7 files. Corrected host diagnostic: 2 positive/negative controls pass and 2 intended provenance invariants fail, identically in two independent test processes/temporary fixtures. Both Atlas diagnostics also repeat their failure and their successful controls. Atlas package typecheck exits 0. These are selected suites, not the complete monorepo suite.

## Pass 5 — adversarial recheck and publication scope
Checked actual call sites rather than trusting stale reference-model headers. AwarenessStore is instantiated in compose, but assembleForWave has no external production caller; ordinary Awareness uses uncached read. resolveCeiling has no production caller. The Maestro tool is registered; auto-continue production code creates the tested message shape, but no actual model/compaction run was executed. Existing tests exercise legitimate controls and were not modified to accept bad outcomes. Existing issue bodies were reviewed before creating only new issues #56, #58 and #62. Other audit branches are active concurrently; they were not overwritten.

## Environment and coverage limits
The isolated clone is pinned to the audited SHA; installed dependencies are borrowed by symlink from a clean checkout at that same SHA. This is NOT a hermetic clean installation. An attempted dependency-link isolation command was blocked before execution; no reroute/retry of that filesystem operation was used. The successful existing environment was retained. Initial missing-Truncate host setup failure is preserved separately and excluded from conclusions. Source inventory does not equal semantic review, and these five lenses do not satisfy five full line-by-line reads of all repository files.

# Progressive journal

1. Anchor: read current PR #14 metadata and live issue search. Product remains b0c33d2. Donor checkout is clean. Created a separate disposable checkout and recorded 38 dependency links; reused installation is not hermetic.
2. Composition: read original preloads and test helpers; reused the already exercised host fixture structure, not prior outputs. The new probe preserves the explicit SessionSummary substitute and a local scripted provider.
3. V2 execution: two separate Bun processes each exercised five cases. Original transform/dispose/reload, SkillV2 and registered SkillTool disagree for primed same-name replacement. No-prime and new-name controls succeed; disposal correctly removes the source before replacement. No claim of cross-project leakage or full V2 session execution.
4. Host execution in progress: original materialization and verification precede original SessionPrompt/command/tool. No source edits after materialization, so freshness remains independent of interpolation. Dollar values are ordinary data; shell-template execution is not tested.

5. Final observations: both host runs completed nine cases each; both V2 runs completed five cases each. Read back actual marked lines from captured provider messages, not only the receipt boolean. Same literal changes occurred twice while materialized files and freshness checks remained unchanged/READY.
6. Counterevidence and review: existing selected suites passed (51 host, 12 Core); package typechecks passed for Atlas, Core and OpenCode. Source integrity check finds no tracked production diff; all 819 compiled JS files examined under Atlas package dist directories match the clean same-SHA donor (this universe includes compiled tests, not only src).
7. Instrumentation limit: a request to create a standalone acceptance checker was blocked before execution. The file does not exist, it was not retried via another route, and no checker exit-1 or checker self-test is claimed. Continued read-only review of captured messages and active-source/list/tool records. The collectors intentionally assert baseline behavior; their green status is not product acceptance.

## Revisão posterior da entrega

Veja [review/REVIEW.md](review/REVIEW.md): escopo de 38 arquivos, rechecagem histórica, repetição original, modos observed/desired, correção de readback e isolamento das saídas. Os registros anteriores permanecem históricos. A revisão não amplia a cobertura global nem corrige o produto.

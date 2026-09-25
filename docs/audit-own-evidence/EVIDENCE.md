# Índice de evidências

`atlas-summary.json`: resumo do reporter original e 529 resultados por arquivo. O JSON completo permanece no diretório de auditoria; não é necessário duplicar todas as assertions nesta publicação.

`source-ledger.json`: paths integralmente lidos e blobs conferidos. `package-topology.json`: inventário de manifests, não leitura semântica integral. `build-identity.json`: 284 arquivos JavaScript comparados, todos idênticos. `environment.json`: revisão e versões.

`graph-first.json`, `graph-second.json`, `graph-portable.json`: reexecuções dos diagnósticos em processo. `mcp-graph.json`: quatro histórias no servidor original, com controles e reinício. `own-metadata-first.json`, `own-metadata-second.json`: duas rodadas de três casos de policy/owner e um de Role/drift.

`maestro-original-linked.log`: 32 testes originais. `maestro-concurrency-linked.log` / `maestro-concurrency.json`: controles de replay e 48 chamadas concorrentes, sem falha observada.

`owner-contract.log` / `.exit`: contrato desejado de #50, red na baseline. Não confundir esse red com falha no setup, nem o green dos diagnósticos observacionais com correção de produto.

`JOURNAL.md`: passagens, contraevidências e decisões de classificação. Todos os probes preservados são diagnósticos de comportamento; alterações funcionais não fazem parte desta entrega.

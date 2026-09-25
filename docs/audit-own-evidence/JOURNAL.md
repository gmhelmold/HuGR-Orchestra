# HuGR-Orchestra — approfondamento 4

Baseline: b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7.
Nenhuma mudança funcional autorizada ou realizada; auditoria e documentação.

## P1 — Descoberta e deduplicação
Branch remota revalidada; issues 15–42 recuperadas. Snapshot isolado criado via worktree detached. Dependências reutilizadas da baseline, fontes preservadas. Inventário não conta como leitura semântica.

## P2 — Grafo, identidades e contexto
Lidos build, depgraph, fold, own-impact, retrieval-model, retrieval, own-source e testes originais correspondentes. Identidade de documento SCIP usa caminho bruto; identidade estrutural escapa % e : e admite refinamentos ::. A ligação feita por retrieval-model usa primaryAnchor integral: hipótese de incompatibilidade identificada por comparação de produtores e consumidores.

## P3 — Execução e contraevidências
Reexecutados diagnósticos graph-probes recuperados de auditoria local anterior, agora contra o checkout isolado: cinco observações confirmadas. Não se atribui autoria nova a esses diagnósticos. O teste original wire-retrieval-freshness documenta deliberadamente a necessidade de fato na origem; classificação correta é limitação funcional/melhoria, não regressão recém-introduzida. ownImpact e createDriftFold não têm consumidores de produção identificados: resultados dessas funções não constituem incidentes no runtime.
Novo diagnóstico own-metadata usa composeRuntime, política real, draft/emit e commit Git real. Controle de escopo por caminho retorna alice; política com scope lógico payments retorna owner vazio; com fallback src retorna alice embora anchorOwner indique payments/bob. Role antigo continua sem flag no cabeçalho enquanto a banda advisory sinaliza DRIFTED. Não demonstrado aceite estático desse pack.

## P4 — Maestro e teste de hipótese negativa
Os 32 testes originais de Maestro passaram após resolver dependências de pacote ausentes no checkout isolado; a primeira tentativa falhou no preload, não no produto. Reexecutado o diagnóstico de retry original: 3 lotes de 8 admissões idênticas e 3 lotes de 8 apresentações idênticas retornaram sucesso. A hipótese de erro de concorrência nesses produtores NÃO se confirmou; nenhuma issue foi aberta por ela. A apresentação pública continua desabilitada, e esses testes não habilitam a jornada pública nem chamam um LLM real.

## P5 — Rechecagem adversarial e publicação
Rerun independente confirmou os cinco diagnósticos de grafo e as quatro observações de metadata. MCP real (SDK + binário stdio original) confirmou quatro histórias, incluindo reinício e formas de caminho. O índice é um protobuf mínimo controlado, não resultado de um indexador externo executado.
A nova busca no GitHub encontrou #45–48 já registradas; não foram duplicadas nem reivindicadas como criações desta sessão. Duas issues novas foram efetivamente criadas: #50 ownership/policy; #51 Role/proveniência e currentness.
Contrato esperado de ownership avaliado separadamente sobre observação real: saída 1, red esperado para #50. Os diagnósticos observacionais verdes significam reprodução, não correção.
Suíte completa Atlas finalizou: 4119 passados, 12 pendentes/ignorados, 3 TODO, 0 falhas; 529 entradas por arquivo no JSON. 1705 é o contador de suites/grupos do reporter, não arquivos.
Comparadas 284 saídas compiladas JS compartilhadas com o checkout de dependências: 284 byte-idênticas, zero diferenças. git diff de produção vazio. Ledger contém 30 arquivos integralmente retornados e conferidos por blob Git: 4859 linhas. Inventário global de 7936 paths e 41 manifests não é leitura semântica de todos os paths.
A limitação do cache createDriftFold foi observada no modelo, sem produtor de atualização de registro identificado. Não foi aberta issue de incidente de runtime; primeiro é necessário explicitar uma instância por snapshot versus múltiplas épocas de invalidação. A interpretação da completude sobre canais desconhecidos fora do conjunto alcançado permanece obrigação de contrato, separada da perda comprovada de uma flag já calculada (#48).

> **Registro histórico da primeira publicação. Não representa o estado atual de acesso, evidências ou issues. Consulte [o índice atual](README.md) e os relatórios de runtime posteriores.**

# Auditoria Atlas / Maestro — 17 de setembro de 2026

Base imutável: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.
Esta branch é documental. Não contém correções funcionais nem autoriza merge.

## Publicação de issues: bloqueada

O repositório retornou `has_issues:false`. Uma tentativa efetiva de criar a issue de hits anteriores à truncagem foi recusada com HTTP 410: `Issues has been disabled in this repository.` **Zero issues foram criadas.** Os nove cartões abaixo são registros preparados, não issues publicadas. Não foram usados o upstream ou outro repositório como destino alternativo. Habilitar Issues nas configurações do repositório é necessário para a publicação solicitada.

## Índice

| Registro | Prioridade sugerida | Evidência |
|---|---|---|
| [ATL-001 — perda do ledger de abstenções](issues/ATL-001.md) | P1 | Cadeia de composição confirmada estaticamente; regressão proposta não executada |
| [ATL-002 — hits antes da seleção final](issues/ATL-002.md) | P1 | Código inspecionado e modelo comportamental executado |
| [ATL-003 — contested constante](issues/ATL-003.md) | P1 | Wiring e contrato normativo confrontados; porta completa não executada |
| [OWN-001 — drill sem destino](issues/OWN-001.md) | P1 | Contrato original e scripts originais, Git real, digest de teste |
| [OWN-002 — predicate renderizado como undefined](issues/OWN-002.md) | P2 | Contrato original e scripts originais, Git real, digest de teste |
| [OWN-003 — freshness de gotchas](issues/OWN-003.md) | P2 | Assimetria de projeção confirmada estaticamente |
| [OWN-004 — autoridade de COMPLETE](issues/OWN-004.md) | P2 | Lacuna de contrato; comportamento da função original reproduzido |
| [OWN-005 — orçamento do payload final](issues/OWN-005.md) | P2 | Compositor inspecionado e entrada estática adversarial executada |
| [MAE-001 — replay versus reapresentação](issues/MAE-001.md) | P2 | Produtor inspecionado e avaliador original executado; limitação latente |

P1/P2 são prioridades de engenharia sugeridas, não CVSS. Nem todos os registros são bugs de produção: dois tratam de garantias de contrato; o de Maestro é latente porque sua entrada pública está deliberadamente bloqueada.

## Escopo e método

Cinco passagens focadas: (1) versão/publicação; (2) leitura e escrita; (3) Own, verificadores e consumidores; (4) experimentos e controles; (5) revisão adversarial das próprias conclusões. Isso **não equivale a cinco leituras integrais de todos os arquivos do monorepo**.

A investigação seguiu `cover → query → splitBands`, `governed emit → gates → incumbent → ratify → upsert → commitLoop → publish`, Own snapshot → Markdown → verificador, e apresentação → resposta → decisão. O relatório anterior foi usado como mapa de hipóteses, não como confirmação independente.

## Execução real e limites

Ambiente: Node 22.16.0, TypeScript 5.8.3 e Git. Não houve checkout integral, instalação das dependências do projeto, execução de Bun, suíte oficial completa, sessão MCP ou aplicação OpenCode.

Seis arquivos foram reconstruídos e conferidos byte a byte pelos hashes Git antes dos experimentos: os três contratos Own, os dois scripts e `approval.ts`. Os testes Own substituem **somente `@atlas/kernel.id`** por um digest determinístico de teste; não testam a identidade BLAKE3 do Atlas. O guard/materializador usaram commits, blobs, arquivos e subprocessos Git reais em diretórios temporários. O avaliador puro de Maestro foi executado sem dependências substituídas. A query foi um **modelo comportamental**, não importação dos módulos originais de query.

Resultados: 10 casos Own, 4 casos dos scripts com Git e 4 casos do avaliador original; mais 2 cenários do modelo de query. Todos observaram os resultados esperados, inclusive os defeitos. **Não são vinte testes que certificam a qualidade do produto.** Os probes, fontes conferidas, resultados completos e cartões expandidos são entregues no pacote offline da auditoria. [Resumo dos experimentos](EVIDENCE.md).

## Contraevidências preservadas

- O guard não é apenas autocertificação: ancestralidade Git e source blobs são realmente verificados. A mudança de uma fonte real fez o guard falhar no controle.
- A porta de negação conserva abstenções explicitamente; a perda foi delimitada à composição que publica diretamente a saída incompleta de upsert.
- Existem gates reais de scope/tier; contested constante não foi chamado de bypass T2→T0 ou de autenticação remota.
- O parser Markdown do host sanitiza dois-pontos em valores YAML: a hipótese simples de frontmatter inválido foi descartada.
- Omissão de manifest no Markdown foi observada, mas informação pode estar duplicada em drill/pullReachable; não virou décima issue.
- Não foi demonstrada omissão de um arquivo relevante nas três âncoras do snapshot atual.
- Agregação de claims versus freshness do último fato permanece hipótese para uma fixture multi-revisão, não achado confirmado.
- O bloqueio público de aprovação deve permanecer até existirem leitores duráveis de plano/validação. Não removê-lo para satisfazer testes.

## Próxima prova exigida para concluir correções

As definições de pronto dos cartões exigem regressões no caminho real quando a auditoria ainda só possui evidência estática ou isolamento. Um retorno HTTP/exit code de sucesso, paridade entre duas funções ou receipt autoconsistente não substitui observar a propriedade específica em questão. Nenhum achado foi corrigido nesta branch.

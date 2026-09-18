# Atlas / Maestro — diário de auditoria

Base imutável: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.
Data: 17 de setembro de 2026.
Esta branch contém apenas documentação e evidências de auditoria. Nenhuma correção funcional, merge ou certificação integral do monorepo está implícita.

## Publicação
A API do repositório informa `has_issues:false`. Uma tentativa efetiva de criar a issue `[Atlas][P1] Query increments delivered-use hits before advisory truncation` foi recusada pelo GitHub com HTTP 410: `Issues has been disabled in this repository.` Nenhuma issue foi criada. As ferramentas conectadas não expõem a alteração dessa configuração. Os registros preparados nesta branch não são issues publicadas.

## Passagem 1 — versão e evidência anterior
Revalidado o head da branch. O relatório anterior foi usado como mapa de investigação, não como prova independente. A consulta de issues não retornou itens; a configuração explica o impedimento de publicação.

## Passagem 2 — caminhos de leitura e escrita
Rechecados `projection-query-index.ts`, `query.ts`, `bands.ts`, `hits.ts`, `governed-emit.ts`, `governed-emit-gates.ts`, `governed-emit-incumbent.ts`, `governed-emit-route.ts` e o reducer `upsert.ts`.

- Confirmada a ordem: `cover` contabiliza hits antes de `splitBands` saber quais fatos serão retornados.
- Novo achado: a chamada ao ratificador fornece `contested:false` apesar de ter acesso ao incumbent. Escopo restrito: conflito entre fatos autorizados; os gates de escopo e de tier não foram considerados inexistentes.
- Novo achado: `upsert` retorna apenas `{current,cas}`, descartando `StoreProjection.abstained`. O emit comum publica esse resultado; `commitLoop`/`publish` não restauram o ledger. Contraevidência útil: a porta de negação o carrega explicitamente e remove apenas a chave pertinente.

## Passagem 3 — contrato Own versus consumidor
Rechecados parser, exportador, materializador, guard de Git/blobs, loader de Markdown e testes de aprovação.

- As checagens de revisão imutável, ancestralidade e blobs são reais; não se trata de um receipt que apenas certifica o próprio hash.
- Candidatos em validação naquela passagem: apontador `drill.finer` sem unidade correspondente; predicate cujo discriminante `check.kind` não corresponde ao campo do corpo; freshness dos gotchas sem o oráculo usado pelas outras bandas.
- Hipótese descartada: dois-pontos não escapados no frontmatter. O parser real do host tenta sanitização para block scalar; não registrar o caso simples como bug.
- Maestro: a idempotência de apresentação preserva a mensagem antiga em uma nova chamada para a mesma revisão. Falta distinguir retry idempotente de nova apresentação que exige uma resposta imediata. O caminho público continua intencionalmente bloqueado; não alegar exploração em produção.

## Passagem 4 — experimentos concluídos

Seis arquivos originais foram reconstituídos e seus hashes de blob Git conferidos: own-snapshot.ts, own-artifact.ts, own-coverage.ts, materialize-own-snapshot.mjs, own-snapshot-guard.mjs e approval.ts. Os três contratos Own foram transpilados em memória; somente o digest @atlas/kernel.id foi substituído por um digest determinístico declarado.

- Dez casos Own: positivos, negativos, drill órfão, discriminantes de predicate, COMPLETE e tamanho. Omissão de manifest foi observada, sem promovê-la automaticamente a bug.
- Quatro casos dos scripts originais: repositórios Git temporários, commits, source blobs e filesystem reais. Drill órfão e predicate undefined passaram indevidamente pelos dois scripts. Fonte alterada e fato stale foram recusados nos controles.
- Quatro casos do avaliador original de Maestro, sem dependências substituídas: aprovação imediata válida, redisplay com vínculo antigo recusada por adjacência, vínculo novo aprovado, e respostas sintéticas/tool recusadas.
- Dois cenários de modelo de query: seis claims T2 individuais de 400 caracteres. Na ordem observada, o sexto omitido acumula oito hits e é governing na nona chamada. No controle após seleção, seu primeiro crédito só ocorre quando ele é realmente entregue, ainda advisory.

Todos os casos observaram o resultado experimental esperado, inclusive o defeito. Isso não significa que o produto tenha passado em vinte testes de qualidade. Resultados e limites em EVIDENCE.md; probes, fontes verificadas e JSON completos no pacote offline da auditoria.

## Passagem 5 — revisão adversarial das conclusões

ATL-001 foi seguido até a publicação de gerações; o ramo de negação que conserva o ledger ficou como contraevidência. ATL-003 foi confrontado com as proteções existentes de tier/scope e REQ-KNOW-18b; não foi chamado de bypass de T0 ou de ataque remoto. OWN-001/002 foram repetidos nos scripts depois das verificações de ancestralidade e source blobs. MAE-001 ficou como limitação latente porque o ponto público permanece bloqueado.

Hipóteses não promovidas: dois-pontos YAML (descartada); perda exclusiva de informação do manifest (ainda pode haver redundância em drill/pullReachable); arquivo relevante omitido nas três âncoras atuais (não demonstrado); freshness emprestada entre claims agregados (exige fixture multi-revisão); exactly-once/crash recovery de Task (não executado).

## Entrega documental

Nove cartões individuais publicados nesta branch, cada um com fontes imutáveis, escopo, reprodução, contraevidências, completude, sucesso, qualidade, definição de pronto e invariantes. PR documental **#14**, criado como draft contra a branch auditada, sem merge. Os cartões não corrigem os defeitos e não são issues publicadas. Os probes não foram adicionados às suítes de produção.

## Limites finais

Não houve checkout integral nem instalação das dependências do projeto. Suíte oficial completa, Bun, CLI Atlas completo, sessão MCP e aplicação OpenCode não foram executados. Os scripts específicos de materialização/guard foram executados em isolamento como declarado. Produtor Effect/DB de aprovação não foi executado. O teste de reducer proposto no pacote permanece não executado. Cinco passagens focadas não equivalem a cinco leituras integrais de todos os arquivos do monorepo.

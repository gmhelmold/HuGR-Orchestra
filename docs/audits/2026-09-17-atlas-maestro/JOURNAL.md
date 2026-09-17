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
- Candidatos em validação: apontador `drill.finer` sem unidade correspondente; predicate cujo discriminante `check.kind` não corresponde ao campo do corpo; freshness dos gotchas sem o oráculo usado pelas outras bandas.
- Hipótese descartada: dois-pontos não escapados no frontmatter. O parser real do host tenta sanitização para block scalar; não registrar o caso simples como bug.
- Maestro: a idempotência de apresentação preserva a mensagem antiga em uma nova chamada para a mesma revisão. Falta distinguir retry idempotente de nova apresentação que exige uma resposta imediata. O caminho público continua intencionalmente bloqueado; não alegar exploração em produção.

## Evidência e limites
Até este registro: inspeção estática de código e testes; suíte do repositório, CLI e MCP não executados. Não existe checkout local utilizável neste ambiente. Experimentos isolados, quando concluídos, devem registrar exatamente as funções e dependências substituídas. Cinco passagens focadas não equivalem a cinco leituras integrais de todos os arquivos do monorepo.

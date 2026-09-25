# HuGR-Orchestra — aprofundamento de Atlas, Own e Maestro

Data: 17 de setembro de 2026. Revisão de produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.

## Resultado executivo

Esta rodada encontrou e registrou dois problemas adicionais na projeção de ownership: **o responsável mostrado pelo Own pode contradizer a política explícita** e **uma definição com drift pode reaparecer como Role sem carregar seu estado de evidência**. As issues novas são [#50](https://github.com/gmhelmold/HuGR-Orchestra/issues/50) e [#51](https://github.com/gmhelmold/HuGR-Orchestra/issues/51).

Também foram reexecutados e aprofundados diagnósticos de grafo, inclusive pelo servidor MCP original. A busca de deduplicação encontrou esses problemas já registrados em [#45](https://github.com/gmhelmold/HuGR-Orchestra/issues/45), [#46](https://github.com/gmhelmold/HuGR-Orchestra/issues/46), [#47](https://github.com/gmhelmold/HuGR-Orchestra/issues/47) e [#48](https://github.com/gmhelmold/HuGR-Orchestra/issues/48). Esses registros foram preservados; não são apresentados como issues criadas por esta sessão.

A suíte original Atlas passou com **4.119 testes aprovados, 12 pendentes/ignorados, 3 TODO e zero falhas**. O JSON contém 529 entradas por arquivo; o contador de 1.705 suites inclui grupos e não deve ser chamado de quantidade de arquivos. No Maestro, os sete arquivos originais somaram **32 testes aprovados**. Um diagnóstico adicional de concorrência executou três lotes de oito admissões idênticas e três lotes de oito apresentações idênticas: todas as 48 chamadas retornaram sucesso. Essa suspeita de falha foi descartada, não transformada em issue.

Fontes desses resultados: `evidence/atlas-summary.json`, `evidence/maestro-original-linked.log`, `evidence/maestro-concurrency.json`. Passar os testes existentes não comprova as histórias adicionais de ownership; o contrato desejado de #50 é verificado separadamente e **falha com saída 1**, conforme `evidence/owner-contract.log`.

## Escopo, ambiente e qualidade da evidência

A branch remota foi lida novamente antes da investigação. Foi criado um worktree detached isolado no Mac autorizado, sem alterações funcionais em código de produção. Node v22.17.1, Bun 1.3.14 e Git 2.51.0. Dependências já instaladas foram reutilizadas. As 284 saídas JavaScript compiladas encontradas nos dois checkouts foram comparadas: todas eram byte-idênticas. `git diff` de produção estava vazio. Isso está registrado em `evidence/environment.json` e `evidence/build-identity.json`.

O inventário global identificou 7.936 paths versionados e leu 41 manifests de pacote. A leitura semântica documentada desta rodada abrange 30 arquivos integralmente retornados, com 4.859 linhas e blobs Git conferidos contra a revisão auditada. A tabela de fontes ao final identifica esses arquivos. **Inventariar, compilar ou testar o monorepo não equivale a ler semanticamente todos os seus arquivos. Esta rodada não é apresentada como cinco releituras integrais de todo o monorepo.**

Os testes de grafo usam um SCIP protobuf mínimo controlado, construído com o schema original instalado. O parser, AST, kernel, hashing, armazenamento, composição e transporte são os originais. Não foi executado um indexador SCIP externo; portanto, a evidência prova o comportamento do consumidor perante o índice fornecido, não a precisão geral de um indexador. Nenhuma chamada a modelo pago foi realizada.

Os diagnósticos `graph-probes.mjs`, `mcp-graph.mjs` e `maestro-concurrency.test.ts` foram recuperados de trabalhos locais de auditoria e reexecutados nesta rodada, após leitura e conferência. O primeiro foi ajustado apenas para resolver dependências a partir do diretório Atlas informado e reexecutado nessa forma portátil. A investigação nova de metadata está em `own-metadata.mjs`.

## Cinco passagens de investigação

| Passagem | Trabalho realizado | Evidência preservada |
|---|---|---|
| P1 — versão e deduplicação | Branch remota, inventário, issues existentes, checkout isolado. | Ambiente, topologia e journal. |
| P2 — produtores e consumidores | Identidade de documentos, chaves estruturais, fechamento reverso, seleção de fatos, policy e ownership. | Ledger de fontes e mapa abaixo. |
| P3 — experimentos diferenciais | Casos com/sem fato de origem, âncoras de arquivo/símbolo, nomes comuns/escapados, policy lógica/caminho e mudança real de fonte. | Duas execuções independentes e controles. |
| P4 — transporte e Maestro | MCP stdio original, reinícios, testes de sessão/eventos e retry concorrente. | Respostas finais e logs originais. |
| P5 — revisão adversarial | Rechecar fontes/compilação, separar limitações do modelo de runtime, red do contrato, deduplicar e abrir issues. | Prova de identidade, verificador e registro de publicação. |

`JOURNAL.md` registra a evolução, as hipóteses descartadas e os limites. O objetivo não foi multiplicar apontamentos, mas impedir que uma afirmação sobre um componente ganhe, por interpretação, uma garantia que a composição não fornece.

## Mapa de execução compreendido

### 1. Documento, unidade estrutural e fato têm identidades diferentes

`index/src/build.ts` constrói eixos a partir da árvore de arquivos e das ocorrências SCIP. A identidade dos endpoints de dependência usa o caminho relativo bruto do documento. Já a chave espacial escapa caracteres reservados e pode adicionar refinamentos AST `::`. O kernel realiza o hashing; o problema observado não é colisão criptográfica, mas usar preimagens de namespaces diferentes como se representassem a mesma entidade.

`adapter-io/src/retrieval-model.ts` organiza os fatos atuais por `primaryAnchor` e calcula o mapa de blast radius. `index/src/retrieval.ts` consulta esse mapa. O Own reutiliza esse feed para relações em vez de implementar outro algoritmo de grafo. Reutilizar um feed mantém a composição coerente, mas também propaga uma perda de informação que ocorra nesse feed.

**Consequência de produto:** grounding mais preciso só agrega valor se as consultas por arquivo continuarem encontrando os fatos ancorados em suas unidades internas. O refinamento não deve tornar o fato invisível ao contexto relevante.

### 2. Pertencimento à política não é inferível pelo nome do scope

`policy.ts` separa `authz.scopes` — membros autorizados por scope lógico — de `authz.anchors` — qual scope é responsável por qual prefixo de fonte. `anchorOwner` resolve o prefixo explícito mais específico. Isso permite políticas como `src/payments -> payments`, mesmo que o scope se chame `payments` e não `src/payments`.

`own-source.ts` responde quem é o owner usando outro raciocínio: considera as próprias chaves de `authz.scopes` como prefixos de arquivos. Esse é o ponto concreto de divergência. O mapa de ownership deve consumir a associação explícita já existente, não reconstruí-la pela aparência dos identificadores.

O ator local continua sendo um identificador autodeclarado, como o próprio código documenta. Esta auditoria não apresenta esses controles locais como autenticação adversarial e não testou escrita não autorizada.

### 3. A projeção de contexto precisa preservar o estado da evidência

O Own tem diferentes bandas e campos: invariants/advisory, gotchas, Role, Terrain e relations. Não é suficiente que uma banda recalcule freshness corretamente se outra reutiliza a mesma afirmação como uma string sem indicar sua origem ou atualidade.

No diagnóstico desta rodada, a banda advisory faz o correto: a definição antiga fica `DRIFTED`. A função Role, porém, seleciona a definição e retorna suas claims sem transportar esse estado. A observação é mais estreita que #22: aqui não há um novo flag `FRESH` falso no Role; há **remoção da indicação de drift ao projetar a afirmação em outro campo**.

### 4. O Maestro compõe políticas e eventos; os limites públicos continuam relevantes

Foram relidos o registro de admissão, o registro de apresentação/aprovação, a ferramenta de admissão, a ponte de eventos e os fixtures de integração. O registro de admissão usa identidade determinística vinculada à sessão, mensagem e método. O produtor de apresentação e o consumidor de resposta também usam eventos persistidos e bindings específicos.

Uma leitura superficial de read-before-write poderia sugerir que retries concorrentes idênticos necessariamente falham. A execução demonstrou o contrário nos cenários testados: 48 chamadas concorrentes distribuídas em seis lotes concluíram com sucesso. Não há base, nesses testes, para abrir uma issue afirmando esse defeito.

Esses testes não habilitam a ferramenta pública de apresentação atualmente bloqueada por falta de leitores duráveis de plano/validação. Também não são testes com modelo real, de todos os interleavings possíveis ou de recuperação após queda de processo. A janela de aprovação e a criação efetiva da tarefa precisam continuar sendo avaliadas com essas fronteiras explícitas.

## Achados e encaminhamento

### OWN-META-01 — responsável incorreto ou ausente — issue #50

Foram montadas três políticas válidas sobre `src/payments`, com escrita autorizada bem-sucedida em todos os casos:

| Caso | Associação relevante | Owner retornado |
|---|---|---|
| Controle legado | `scopes.src = [alice]`, sem binding explícito. | alice |
| Scope lógico | `src/payments -> payments`, `payments = [bob]`. | vazio |
| Fallback enganoso | Binding anterior, acrescido de `scopes.src = [alice]`. | alice, embora o binding indique bob |

As duas execuções independentes produziram os mesmos resultados. A causa está em `terrainOwner`: a associação `authz.anchors` é ignorada. O impacto esperado é atribuição/orientação errada de trabalho, não autorização indevida. Não foi demonstrado que a policy de uso corrente do usuário tenha essa configuração.

A correção mínima é compartilhar o resolver de ownership explícito e definir separadamente o fallback legado. Não requer outro grafo, uma nova camada de permissões ou uma consulta a LLM. O critério central de aceite é igualdade entre a associação explícita e a informação exibida no briefing.

Diagnóstico: `probes/own-metadata.mjs`, três primeiros casos. Evidência: dois arquivos `own-metadata-*.json`. Contrato desejado: `probes/check-owner-contract.mjs`, cuja saída 1 na baseline está preservada.

### OWN-META-02 — Role sem disposição de drift — issue #51

A fonte inicialmente exporta `value = 1`. Uma definição válida é admitida. Depois, a fonte muda para `value = 2`, há novo commit e um novo runtime é construído. O resultado combina:

```text
Role: The fixture value is one.
Advisory: The fixture value is one. — DRIFTED
```

O exemplo prova que a projeção remove o sinal de currentness; não é preciso afirmar que o motor determina a verdade de qualquer sentença natural. O controle decisivo é a banda do mesmo runtime conseguir detectar o drift.

A decisão de produto pode preservar a definição com um carrier de origem/status, ou usar fallback estrutural explícito quando ela não é elegível. Não se deve inventar automaticamente uma nova descrição sem evidência. Esta rodada **não demonstrou que o materializador estático aceite esse pack com advisory DRIFTED**, nem que um executor tenha agido com base nele.

Diagnóstico: último caso de `own-metadata.mjs`, repetido em outro repositório temporário. O pedido de teste também cobre o caso futuro de a definição sair de uma banda por orçamento e continuar aparecendo no Role; esse caso não foi executado aqui.

### GRAPH-01 — origem sem fato limita consulta — issue existente #45

O grafo original contém `consumer -> provider`, e o consumidor possui um fato durável elegível. A consulta por dependência no provider retorna vazio até que um fato seja adicionado ao próprio provider. A relação estrutural e o fato do consumidor não mudam. O comportamento foi repetido dentro do runtime e pelo MCP com reinício; consultas por escopo funcionam durante todo o experimento.

A causa é materializar chaves de consulta a partir dos nós de Knowledge, não a partir da fonte consultável ou de uma resolução sob demanda. O teste original `wire-retrieval-freshness.test.ts` expressamente assume um fato na origem. Isso é contraevidência à narrativa de regressão inesperada: a restrição já está incorporada ao teste. A melhoria consiste em separar o universo do grafo do universo de fatos, sem inventar fatos de preenchimento.

### GRAPH-02 — namespaces e granularidade incompatíveis — issue existente #46

Foram testados origem/destino com nomes comuns e caracteres escapados, além de fatos em refinamentos AST reais obtidos do parser. Os fatos aparecem na consulta por escopo, mas desaparecem da consulta por dependência, mesmo com um fato na origem. O fato do arquivo permanece visível enquanto seu fato de símbolo é omitido. O MCP reproduz o resultado após reinício.

Isso elimina explicações por ausência de persistência, falta de origem ou cache de sessão. A associação do fato ao documento da aresta está ausente. A correção deve manter a chave estrutural injetiva e a âncora precisa do fato, usando uma conversão compartilhada para a identidade do documento. Decodificar indiscriminadamente strings ou remover escaping criaria outro defeito.

### GRAPH-03 — impacto de caminho escapado — issue existente #47

`ownImpact` recebe antes/depois de uma mudança real de bytes. O fechamento reverso correto contém o consumidor, mas o receipt omite esse consumidor para nomes com `%` ou `:` e ainda retorna `COMPLETE`. O controle de nome comum o inclui. É um problema concreto do algoritmo de impacto, ligado à mesma diferença de identidades, mas em outro consumidor.

**Limite:** não foi identificado chamador de produção para `ownImpact` nessa revisão. O resultado é uma obrigação antes de integrar manutenção automática, não um incidente de merge gate já operacional.

### GRAPH-04 — flag de incompletude descartada — issue existente #48

Em fixtures pareadas, o fechamento original retorna `underApprox: false` ou `true` conforme a presença de uma referência não resolvida em um consumidor já alcançado. Os fatos conhecidos continuam recuperáveis, mas a resposta final MCP não preserva a indicação de incompletude. O Own também perde o carrier ao consumir o mapa achatado.

Servir fatos conhecidos pode continuar permitido. O ajuste é preservar a diferença entre freshness do fato, completude da consulta e truncamento por orçamento. Não é necessário bloquear toda consulta parcial nem promover correlação a aresta resolvida.

## Hipóteses e limites que NÃO viraram novas issues

O diagnóstico `createDriftFold` demonstra que reutilizar o cache com um novo objeto de mesmo endereço pode reter o estado anterior, enquanto uma instância nova calcula outro estado. Contudo, a instância captura um registro inicial e não foi identificado um chamador de produção ou protocolo de atualização desse registro. Antes de chamar isso de bug de runtime é preciso definir o contrato: uma instância por snapshot ou várias épocas mutáveis. O resultado foi mantido como limitação do modelo, sem nova issue de incidente.

Uma segunda investigação mostra a dificuldade de chamar COMPLETE a uma consulta quando existem referências sem destino fora do conjunto já alcançado. Isso é uma questão sobre o universo da promessa de completude, diferente de #48, que perde uma flag explicitamente calculada. A observação controlada não é prova de que uma referência externa desconhecida represente um chamador real específico.

O logbook e Orientation foram relidos para compreender a separação entre modelos, logs duráveis e portas públicas. Seus problemas já registrados em #32–42 não foram reabertos nem anunciados como descobertas desta rodada. Em particular, uma função existir e ter testes não estabelece que um fluxo automático a invoque.

## Ordem prática de correção

Primeiro, resolver a associação entre âncora estrutural e documento, coordenando #46 e #47 para não criar duas normalizações concorrentes. Em seguida, desacoplar chaves de consulta da presença de fatos (#45) e preservar metadados de cobertura (#48). Corrigir #50 pelo resolver de policy existente e decidir o carrier de evidência do Role em #51 são mudanças delimitadas que podem avançar independentemente, com revisão da representação estática.

Para Maestro, preservar os produtores que passaram nos controles, manter a apresentação pública bloqueada até existir autoridade durável e enfrentar os gaps de continuidade/integração já registrados sem declarar uma jornada completa por causa de testes internos verdes. Esta sequência é uma proposta técnica, não execução de fixes nesta rodada.

As issues novas têm Success criteria, Quality standards, Completeness criteria, Definition of done e Invariants, além de escopo, causa, controles e limites. Nenhuma foi fechada e nenhuma alteração funcional foi feita.

## Reprodução e interpretação dos resultados

A partir de um checkout na revisão auditada, com dependências instaladas e `bun run typecheck` concluído em `foundation/atlas`:

```sh
ATLAS="/caminho/absoluto/HuGR-Orchestra/foundation/atlas"
AUDIT="/caminho/absoluto/HuGR-Orchestra/docs/audit-own-evidence"
OUT="$(mktemp -d)"
node "$AUDIT/probes/graph-probes.mjs" "$ATLAS" "$OUT/graph.json"
node "$AUDIT/probes/mcp-graph.mjs" "$ATLAS" "$OUT/mcp.json"
node "$AUDIT/probes/own-metadata.mjs" "$ATLAS" "$OUT/own.json"
node "$AUDIT/probes/check-owner-contract.mjs" "$OUT/own.json"
```

Os três primeiros diagnósticos verificam que as observações relatadas realmente ocorreram: exit 0 significa que a baseline reproduziu o comportamento, inclusive os defeitos. O último verifica o contrato desejado de ownership sobre a saída produzida pelo runtime: na revisão auditada, exit 1 é o resultado esperado. Ele não é a correção nem substitui um futuro teste integrado depois do patch.

O diagnóstico Bun preserva os imports relativos dos testes originais. Para reexecutá-lo, copie `probes/maestro-concurrency.test.ts` para um nome novo sob `packages/opencode/test/maestro`, sem sobrescrever arquivo existente, e rode esse arquivo a partir de `packages/opencode` com `AUDIT_OUT` apontando para o JSON de saída. O arquivo copiado é um diagnóstico; não altera a implementação. Os testes existentes podem ser rodados pelos sete filenames registrados no log de baseline.

Nenhum script de grafo chama um LLM ou modifica o repositório do usuário como fixture: os casos criam repositórios temporários. O diagnóstico em processo mantém seus diretórios temporários para inspeção; o harness MCP limpa suas fixtures ao encerrar. Não há promessa de execução posterior ou monitoramento contínuo.

## Fontes integralmente lidas e verificadas nesta rodada

O ledger abaixo registra os arquivos retornados integralmente e a identidade Git conferida. Isso é um registro de cobertura de leitura, não certificação de que todo comportamento desses arquivos tenha sido testado. Cada achado acima está ligado a experimentos específicos; as outras entradas preservam o contexto necessário para continuar a investigação.

| Arquivo | Linhas | Blob Git |
|---|---:|---|
| [AGENTS.md](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/AGENTS.md) | 161 | `cd2327e88811` |
| [foundation/atlas/package.json](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/package.json) | 44 | `700eb8c7d4bf` |
| [packages/opencode/src/maestro/admission-record.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/maestro/admission-record.ts) | 66 | `e4be41c69e2c` |
| [packages/opencode/src/maestro/approval-record.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/maestro/approval-record.ts) | 298 | `10f43f5d5b6d` |
| [packages/opencode/src/tool/maestro-admission.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/maestro-admission.ts) | 53 | `b7bbccfd0817` |
| [packages/opencode/src/event-v2-bridge.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/event-v2-bridge.ts) | 71 | `8e65f2752df7` |
| [packages/opencode/test/maestro/admission-record.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/maestro/admission-record.test.ts) | 56 | `ef72ca36b702` |
| [packages/opencode/test/lib/effect.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/lib/effect.ts) | 177 | `255d4b394750` |
| [packages/opencode/test/fixture/fixture.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/fixture/fixture.ts) | 228 | `53e3142cdfb3` |
| [foundation/atlas/packages/index/src/depgraph.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/src/depgraph.ts) | 95 | `c55a264976c1` |
| [foundation/atlas/packages/index/src/own-impact.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/src/own-impact.ts) | 135 | `37dd53bfd209` |
| [foundation/atlas/packages/index/src/build.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/src/build.ts) | 287 | `b47846d7b609` |
| [foundation/atlas/packages/index/src/fold.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/src/fold.ts) | 312 | `38f9d8cc01cf` |
| [foundation/atlas/packages/index/src/retrieval.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/src/retrieval.ts) | 91 | `9becfb475503` |
| [foundation/atlas/packages/index/test/own-impact.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/test/own-impact.test.ts) | 68 | `36fedc645913` |
| [foundation/atlas/packages/index/test/fold-drift.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/test/fold-drift.test.ts) | 155 | `2aa04ab69194` |
| [foundation/atlas/packages/index/test/fold.heldout.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/index/test/fold.heldout.test.ts) | 43 | `2f28363dfe9a` |
| [foundation/atlas/packages/adapter-io/src/own-source.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/own-source.ts) | 366 | `4874c2d11adb` |
| [foundation/atlas/packages/adapter-io/src/retrieval-model.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/retrieval-model.ts) | 147 | `8b05d4958b7a` |
| [foundation/atlas/packages/adapter-io/src/policy.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/policy.ts) | 272 | `8e6cb85b0c6e` |
| [foundation/atlas/packages/adapter-io/src/compose-runtime.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/compose-runtime.ts) | 215 | `89946e28ead3` |
| [foundation/atlas/packages/adapter-io/src/orientation-store.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/orientation-store.ts) | 77 | `a551836241b1` |
| [foundation/atlas/packages/adapter-io/test/wire-retrieval-freshness.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/test/wire-retrieval-freshness.test.ts) | 93 | `05e90e90e135` |
| [foundation/atlas/packages/adapter-io/test/own-two-bands.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/test/own-two-bands.test.ts) | 174 | `699b62107c31` |
| [foundation/atlas/packages/adapter-io/test/harness/fix-scip.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/test/harness/fix-scip.ts) | 96 | `656c2d98c66b` |
| [foundation/atlas/packages/tools/src/draft.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/tools/src/draft.ts) | 220 | `92be02e68c05` |
| [foundation/atlas/packages/knowledge/src/write/router.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/knowledge/src/write/router.ts) | 415 | `c74d1ab3a8e0` |
| [foundation/atlas/packages/memory/src/logbook.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/logbook.ts) | 201 | `c060de2c710f` |
| [foundation/atlas/packages/memory/src/orient.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/orient.ts) | 214 | `4f7b69067999` |
| [foundation/atlas/packages/memory/src/index.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/index.ts) | 29 | `d842ca2f9927` |

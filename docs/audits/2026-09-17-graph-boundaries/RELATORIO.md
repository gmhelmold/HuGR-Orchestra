# HuGR-Orchestra — Atlas / Maestro: fronteiras de grafo e execução

**Data:** 17 de setembro de 2026. **Produto auditado:** `maestro/rebuild-fork-dev-clean`, commit `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.

## Resultado desta rodada

Cinco issues novas foram abertas: **#45, #46, #47, #48 e #49**. Três tratam de comportamento observado no transporte MCP do Atlas; uma trata de um algoritmo de Own ainda sem consumidor de produção localizado; outra trata da recuperação do despacho governado interno do Maestro. Nenhuma foi classificada como exploração de segurança, e nenhum patch de produto foi aplicado nesta rodada.

| Issue | Achado | Evidência mais forte | Limite de exposição |
|---|---|---|---|
| [#45](https://github.com/gmhelmold/HuGR-Orchestra/issues/45) | Consulta de dependências exige um fato no próprio alvo | MCP real, antes/depois de admitir o fato do alvo, com reinício | Caminho público do Atlas |
| [#46](https://github.com/gmhelmold/HuGR-Orchestra/issues/46) | Âncoras escapadas e de subarquivo não se associam corretamente ao grafo de arquivos | MCP real, controles de nome comum, origem/destino escapados e unidade AST real | Caminho público do Atlas |
| [#47](https://github.com/gmhelmold/HuGR-Orchestra/issues/47) | OwnImpact omite dependente resolvido de caminho escapado e retorna COMPLETE | build → delta → depgraph → ownImpact originais, duas execuções | Algoritmo ainda sem chamada de produção localizada |
| [#48](https://github.com/gmhelmold/HuGR-Orchestra/issues/48) | Incompletude calculada pelo grafo desaparece na resposta | underApprox false/true contrastado com payloads MCP reais | Consulta pública; Own composto também inspecionado |
| [#49](https://github.com/gmhelmold/HuGR-Orchestra/issues/49) | Aprovação consumida e sessão filha sem execução após falha de metadata | Task original, Effect/SQLite reais, contador de chamadas ao modelo e falha injetada | Autoridade interna preparada por fixture; apresentação pública continua bloqueada |

As issues contêm contexto, versão, causa, observação, controles, limites de inferência, direção mínima de correção e os cinco critérios: **success criteria, quality standards, completeness criteria, definition of done e invariants**. São obrigações abertas, não correções concluídas.

## 1. Método, fontes e cobertura real

A revisão começou conferindo a referência remota da branch e o backlog existente, incluindo as issues #15–#42 e os PRs documentais #14, #43 e #44. Problemas já registrados não foram reabertos sob novos títulos. As issues #46 e #47 são relacionadas e explicitamente ligadas: compartilham uma fronteira de identidade, mas afetam algoritmos e consumidores diferentes.

Foi criado um clone descartável separado no computador autorizado. A árvore do produto permaneceu no SHA fixado. O inventário contém **7.936 arquivos rastreados**. Inventariar não significa ler semanticamente cada arquivo. Esta rodada executou cinco passagens progressivas de investigação, **não cinco leituras integrais, linha por linha, dos 7.936 arquivos**.

As passagens foram: topologia/versão/backlog; leitura dos produtores e consumidores; execução de cenários contra código original; repetição e controles em transporte/host; revisão fria das classificações e publicação. O diário registra a evolução e os erros do próprio instrumento. Não foram usados subagentes ou modelos externos de revisão.

### Ambiente e limites instrumentais

Atlas foi compilado do clone fixado com `bun run typecheck`, que executa o script declarado pelo pacote. Saída 0. Node observado: 22.17.1; Bun: 1.3.14; macOS Intel. Dependências Atlas foram copiadas de uma instalação já existente; os links internos @atlas apontam para os pacotes do clone descartável. Não foi feita uma reinstalação limpa de dependências do zero.

Os testes do host usaram links para dependências já instaladas em um checkout também identificado no mesmo SHA. Não foi feita uma comparação byte a byte de todos os arquivos dessa instalação. As fontes de Maestro/Task estudadas foram lidas diretamente, e o teste novo foi instalado somente no clone de auditoria.

**SCIP foi controlado:** os cenários fornecem protobufs mínimos válidos com as definições e referências necessárias à fixture, serializados pelo schema instalado. Não foi executado scip-typescript nem foi medida sua precisão. A inferência é sobre como o Atlas consome relações já registradas, não sobre a capacidade de um indexador encontrar relações em código arbitrário.

Nenhuma inferência paga foi executada. No teste do Maestro, o executor do modelo foi substituído por uma porta contada e sem rede; a falha foi injetada explicitamente em `ctx.metadata`. A apresentação pública bloqueada não foi habilitada.

## 2. Entendimento estrutural consolidado

### 2.1 Existem três identidades diferentes na mesma jornada

O construtor do índice recebe caminhos físicos e cria chaves estruturais escapadas. Um arquivo com `%` ou `:` não conserva os mesmos bytes na chave espacial. Um símbolo tem, adicionalmente, um refinamento `::...` sob o arquivo. Já o ledger de dependências usa hashes de caminhos físicos de documentos SCIP.

Assim, caminho físico, chave espacial e âncora de símbolo não são intercambiáveis. `nodeHashOfPath` não converte entre eles: apenas calcula a identidade a partir da string recebida. O problema novo não é fraqueza do hash nem defeito do escape; é usar uma representação no ponto que espera outra.

### 2.2 O grafo de código e a ocupação por conhecimento são independentes

Uma unidade pode ter dependentes mesmo sem possuir um fato autorado. O adapter atual constrói as chaves de blast radius percorrendo as linhas de Knowledge. Isso faz o universo consultável depender da ocupação da base de fatos, não apenas do índice estrutural.

A existência de um fato no destino da consulta deveria influenciar seus fatos próprios, não a possibilidade de localizar fatos de consumidores já conhecidos. Essa distinção explica a #45 e é separada da conversão de identidade da #46.

### 2.3 Atualidade, completude e truncamento não são a mesma propriedade

Um fato retornado pode estar FRESH e, ainda assim, representar somente uma parte de um grafo incompleto. Um resultado também pode estar completo quanto ao grafo e truncado pelo orçamento de saída. Confundir esses três estados impede o consumidor de escolher corretamente entre usar conhecimento parcial, buscar continuação ou manter HOLD.

O depgraph já retorna `underApprox` e `coChanged` separadamente. A composição de retrieval retém somente `closure`. A correção proporcional é preservar a evidência existente até a saída, não construir outro motor de grafo ou bloquear indiscriminadamente consultas úteis.

### 2.4 OwnImpact é um algoritmo existente, mas sua integração não foi demonstrada

O módulo combina delta estrutural, mudança de arestas, alcance reverso em before/after, mudanças de Knowledge e invalidação dos ancestrais. O algoritmo foi realmente executado. A busca de chamadas em fontes de produto não localizou um consumidor de `ownImpact`; portanto, seu falso COMPLETE medido não é prova de que um merge atual tenha sido autorizado incorretamente.

### 2.5 Consumo de aprovação não equivale a início ou conclusão de execução

No Task governado, o consumo durável acontece antes da criação/adoção da sessão filha, da gravação de metadata e da admissão do prompt. Essa ordem protege contra repetição, mas abre estados intermediários que precisam de interpretação durável. O controle contra uma segunda execução funcionou nos testes. A #49 pede definição de resultado e recuperação, não afrouxamento dessa proteção.

## 3. Achados comprovados e controles

### #45 — Alvo sem fato próprio produz vazio indevido

Uma fixture contém provider e consumer, com aresta resolvida consumer → provider. O fato do consumer é admitido pelas portas reais. Consulta de escopo devolve esse fato. Consulta de dependências pelo provider devolve vazio, inclusive após reiniciar o servidor MCP. Admitir um fato no provider, sem mudar código ou arestas, faz o fato do consumer aparecer.

Isso elimina como explicações alternativas a falta da aresta, a falha de persistência do consumer e um cache apenas transitório. O teste existente `wire-retrieval-freshness.test.ts` se protege de outro defeito — congelamento da projeção de fatos — mas semeia expressamente um fato no alvo antes de consultar. A própria preparação do teste assume a limitação agora isolada.

Evidências: `GRAPH-01-target-without-own-fact` e `MCP-GRAPH-01-root-without-own-fact` nos JSONs.

### #46 — Precisão da âncora pode reduzir a recuperação

Com fatos tanto no provider quanto no consumer, o controle de nomes comuns retorna o consumer. Percentual no nome do provider, dois-pontos no provider ou percentual no consumer eliminam sua recuperação por dependência. Foram consultadas as versões bruta e canônica do nome do provider; ambas preservam a falha nos casos relevantes.

Em cenário separado, uma âncora de símbolo foi obtida do parser AST original já inicializado: `src/consumer.ts::lexical_declaration:0:readValue`. Um fato dessa unidade e outro do arquivo foram admitidos. Ambos aparecem na consulta de escopo. Somente o do arquivo aparece na consulta de dependências do provider. Reiniciar o MCP não corrige a omissão.

O provider já tinha fato próprio, excluindo a #45 como causa deste cenário. A associação no adapter é um multimap, mas suas chaves pertencem à representação errada. O conserto deve preservar a âncora precisa do fato, usando a identidade do documento apenas para a associação ao grafo.

Evidências: `GRAPH-03-symbol-anchored-dependent`, `MCP-GRAPH-02-canonical-file-identities` e `MCP-GRAPH-03-subfile-fact`.

### #47 — COMPLETE apesar de omitir um dependente resolvido

O controle de OwnImpact detecta a alteração de provider.ts e inclui consumer.ts. Com provider%value.ts ou provider:value.ts, o delta detecta corretamente a alteração e os ancestrais, e a consulta direta ao grafo pelo caminho físico encontra o consumer. OwnImpact usa a chave escapada como caminho físico, recebe vazio e conserva COMPLETE.

Há controles positivos em dois componentes independentes: detecção de alteração e presença da relação no grafo. O defeito é a associação entre eles. Foi medido duas vezes em fixtures novas. Não depende de fontes históricas ausentes ou de relações desconhecidas.

Evidência: `GRAPH-02-escaped-provider-impact`. A issue é pré-integração, não incidente de produção.

### #48 — O grafo sabe que não cobriu tudo; a resposta não informa

Duas fixtures mantêm a dependência resolvida conhecida. Uma acrescenta referência não resolvida no consumer já alcançado. O depgraph original diferencia `underApprox: false` e `true`. As respostas MCP continuam servindo corretamente o fato conhecido, mas não carregam a diferença de cobertura nem orientação específica sobre a incompletude.

Inspeção adicional do Own composto encontrou ausência de um carrier de cobertura. O teste usou Own da unidade src, que contém os dois arquivos; não pretende provar ausência de um dependente externo nesse escopo. A evidência decisiva da perda de flag é a consulta pública de dependências, acompanhada da leitura do adapter que descarta `.underApprox`.

Evidência: `MCP-GRAPH-06-coverage-erased`. Não se propõe transformar todo conhecimento parcial em erro: é necessário torná-lo reconhecível como parcial.

### #49 — Falha após consumo, antes de iniciar o modelo

O controle executa um prompt, cria uma sessão filha e grava um consumo; repetir a mesma aprovação é corretamente recusado. No cenário de falha de metadata, a sessão filha e o consumo já existem, mas o contador de chamadas ao modelo permanece zero. A repetição com metadata funcionando é recusada como approval-consumed.

A autoridade foi preparada pela função interna de apresentação e pelo recorder original de decisão sobre a mensagem de usuário, mais o registro visível de ferramenta requerido pela fixture. Isso não atravessa com sucesso a ferramenta pública de apresentação, que permanece indisponível por desenho. A prova é de ordenação e recuperação internas.

Uma solução suficiente pode registrar falha terminal e exigir aprovação nova; outra pode permitir adoção segura de uma tentativa comprovadamente não iniciada. Não é aceitável liberar repetição quando o estado de execução anterior é desconhecido. O alvo é um resultado durável claro e proporcional.

Evidência: `maestro-dispatch-second.json` e o log correspondente. Os dois testes observacionais passaram com timeout explícito de 60 segundos. Os primeiros problemas de instrumentação foram preservados, não reclassificados como bugs do produto.

## 4. Observações que não foram promovidas a bugs públicos adicionais

### Universo de completude de reverseClosure

Uma aresta não resolvida de um nó fora do conjunto já alcançado não ativa o flag do alvo consultado. Essa observação é reproduzível, mas o contrato local do depgraph define o escopo exatamente como origem + fechamento alcançado. Portanto, não a rotulei simplesmente como implementação quebrada desse contrato.

O cuidado é não elevar essa propriedade local a uma prova de ausência de qualquer dependente ainda não resolvido no repositório. Essa obrigação conceitual pertence à definição de cobertura de #29/#48. O experimento `GRAPH-04-unresolved-outside-reached-set` não identifica o alvo real de uma referência desconhecida e não mede o comportamento de um indexador real.

### Tempo de vida do cache em createDriftFold

Após resolver um nó, marcar dependentes dirty e executar rehash, uma consulta ao mesmo identificador com estado diferente retorna o hash já cacheado. Uma nova instância do fold com o estado novo produz hash diferente. A observação `GRAPH-05-drift-fold-cache-invalidation` foi repetida.

Entretanto, não foi localizado um consumidor público, e falta fechar se a instância deve suportar atualização entre snapshots ou deve ser estritamente descartada com o snapshot. Ficou no ledger como **obrigação de contrato/lifetime antes de integração**, não como alegação de resposta stale de um servidor em produção. Próxima evidência necessária: cenário de dois edits compatível com o contrato de lifetime adotado e seu consumidor real.

## 5. Verificação executada

| Verificação | Resultado aceito | Interpretação |
|---|---|---|
| Atlas bun run typecheck | exit 0 | Build/typecheck do pacote no clone auditado |
| Suíte original de grafo/retrieval selecionada | 9 arquivos, 60 testes passaram | Não cobre automaticamente os novos casos |
| Suíte original de Maestro | 7 arquivos, 32 testes passaram | Não prova a jornada pública de aprovação disponível |
| Diagnóstico graph-probes | 5 cenários × 2 execuções | Observações confirmadas, incluindo 2 notas não promovidas a bugs |
| MCP real mcp-graph | 4 grupos × 2 execuções | Inclui variantes e reinícios explícitos nos cenários descritos |
| Host fault/controle | 2 testes passaram em execução válida | Instrumento interno, sem inferência de modelo |

Total das duas seleções de testes originais: **92 testes passaram**. Esse número não é uma afirmação de suíte completa do monorepo verde. Também não foi acompanhado um novo CI remoto nesta rodada.

A tentativa posterior de uma terceira execução do host junto com uma checagem ampla de paridade de fontes foi bloqueada pela ferramenta. Não foi executada, não foi contada e não foi repetida por outra rota. A evidência aceita do host é a execução concluída, seu controle positivo e a dupla checagem da ordenação no código.

## 6. Reprodução e leitura do pacote

Leia `JOURNAL.md` para a evolução. `SOURCE-REGISTER.md` aponta as fontes e os papéis investigados. `evidence/` conserva saídas JSON, logs, códigos de saída e inventário. `probes/` contém os instrumentos, que importam implementações originais em vez de reimplementar o produto. O script de grafo deixa fixtures descartáveis para inspeção; o harness MCP original remove suas próprias fixtures ao encerrar.

O README de reprodução explica instalação local de dependências, execução e as hipóteses do instrumento. Os probes são diagnósticos da revisão auditada: confirmar a presença de uma falha faz o probe passar, mas **não torna o produto correto**. Na correção, esses cenários devem virar regressões que exijam o comportamento desejado.

## 7. Prioridade sugerida e fronteira de término

Primeiro, corrigir e provar o caminho público de recuperação de contexto (#45/#46), preservando o código de grafo existente. Em paralelo lógico, propagar a cobertura já calculada (#48). Aplicar a mesma disciplina de identidade ao algoritmo OwnImpact antes de integrá-lo (#47). Para o Maestro, definir liquidação de tentativa antes de liberar a jornada de aprovação (#49), sem remover o bloqueio que protege autoridade ainda não implementada.

Não se propõe um framework adicional. As primeiras correções pedem uma associação de identidade correta, construção de consulta independente da ocupação de Knowledge e propagação de metadados já existentes. A última pede uma política explícita para um estado intermediário real.

Esta rodada fecha a **publicação do diagnóstico**: fontes, experimentos e issues. Não fecha os bugs, não faz merge e não declara compreensão integral de cada parte do monorepo.

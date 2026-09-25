# Entendimento consolidado — identidade, projeção, prova e falha

Baseline do produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Este documento registra o que esta rodada aprendeu, não uma certificação integral. Fontes completas e blobs estão em `evidence/reviewed-source-manifest.json`; quatro correspondências foram rechecadas independentemente pelo GitHub. Experimentos e contraprovas estão em `evidence/verification-summary.json`.

## 1. O limite de uma identidade depende do que ela identifica

No caminho de transições, há três objetos distintos: a unidade estrutural, um estado de conteúdo dessa unidade e uma ocorrência histórica da mudança. `transition-source.ts` resolve revisões Git reais com o RevIndex, porém coloca o `subtreeHash` das duas âncoras em `shaBefore` e `shaAfter`. Portanto esses campos representam estados de conteúdo, apesar do nome que pode sugerir commits.

`admit-transition.ts` usa esse par para construir a chave. O reducer de leitura em `knowledge/src/read/transitions.ts` não consulta a ordem dos commits: coleta todos os estados iniciais da mesma unidade e considera uma aresta superada quando seu estado final também inicia outra aresta. Isso é uma regra determinística sobre um grafo de estados. Não é uma ordem causal de ocorrências Git.

A cadeia A→B→C funciona porque estados diferentes tornam a ordem aparente suficiente. Uma mudança seguida de revert tem três commits distintos e dois estados de conteúdo. O mesmo algoritmo vê A→B e B→A e não encontra uma ponta. Uma reaplicação cria mais uma ocorrência Git mas reutiliza a chave A→B. A CLI original aceitou essas operações, e a leitura reaberta confirmou as diferenças; não é uma hipótese obtida apenas da nomenclatura dos campos.

**O que a correção não deve fazer:** tornar fatos históricos falsos quando HEAD muda, apagar registros antigos ou inventar tempo/aleatoriedade só para derrotar deduplicação. O requisito é escolher uma semântica explícita: histórico causal de ocorrências, ou grafo de transições de conteúdo com limites expostos. A primeira exige distinguir nova ocorrência de retry. A segunda não deve chamar ausência de ciclos de conteúdo de critério suficiente de “estado histórico atual”.

## 2. Persistência em CAS e presença na projeção são garantias diferentes

O CAS retém conteúdo endereçado. A projeção mantém uma linha corrente por chave. Assim, duas escritas reconhecidas como duráveis não significam dois sujeitos distintos consultáveis: ambas podem endereçar a mesma linha.

O pipeline de test-vacuity mostra isso concretamente:

```text
arquivo real -> parseTsDoc -> scanTestVacuity
  -> proposta(unitKey, testName, shape)
  -> testemunho e selo do Genesis
  -> porta governada -> upsert -> CAS + projeção
  -> testVacuities -> CLI
```

O scanner identifica testes em posições distintas e retorna linha/coluna. Entretanto, a identidade que atravessa proposta, witness e persistência usa apenas arquivo/unidade mais título local. Dois `test('same')` em suites diferentes chegam à mesma chave. A segunda escrita conserva o comportamento UPDATE do reducer, mas troca os campos correntes de conteúdo e shape. Inverter as suites em uma fixture independente muda qual shape a leitura devolve.

O achado não é “o CAS apagou o primeiro teste” nem “o parser errou a shape”. O parser encontrou ambos; o problema é preservar a identidade do sujeito entre componentes. Colocar só `shape` na chave também seria insuficiente: dois testes distintos podem compartilhar nome e shape. A qualificação por suite ajuda, mas duplicatas dentro da mesma suite ainda pedem identidade estrutural ou recusa explícita por ambiguidade.

## 3. O selo precisa continuar vinculado ao sujeito exato

Na família test-vacuity, o Genesis produz um selo `proven` quando o oráculo de AST confirma uma shape reconhecida. Isso é mais restrito que provar o comportamento completo do teste. Por exemplo, a família tem proposições sintáticas delimitadas; não autoriza extrapolar de uma forma detectada para todas as propriedades semânticas da execução.

O produtor original foi usado nos experimentos sem substituir esse oráculo. A porta de escrita mantém os checks de HEAD, autoria produzida, escopo e ratificação. Portanto não se concluiu que um payload arbitrário pode criar um selo pelo caminho público. O que foi demonstrado é que duas provas legitimamente produzidas para sujeitos diferentes acabam sob a mesma identidade de projeção.

A função de replay também usa nome e shape. A correção deve propagar a mesma identidade única até o replay, para não validar acidentalmente um homônimo sobrevivente depois que o outro foi alterado. Essa última situação é requisito de regressão, não um incidente adicional executado nesta rodada.

## 4. Um nome de revisão móvel não satisfaz a premissa de cache imutável

O RevIndex é uma camada separada do índice corrente capturado por `composeRuntime`. Ele cria worktrees temporárias, deriva as âncoras na revisão pedida, limpa os worktrees e guarda os resultados em memória. A memoização é correta quando sua chave representa um commit imutável.

A implementação atual aceita uma string Git e usa essa mesma string em `cache.get(rev)` e `cache.set(rev, axes)`. O contrato público de `atlas transition` permite SHA, tag e ref e mostra `HEAD~1 HEAD` como exemplo. `HEAD` e nomes de branches podem apontar para outro commit entre chamadas.

Foram executados dois níveis de prova. No adapter original retido, consultar HEAD depois de novo commit retornou o hash antigo; novo adapter e SHA novo explícito retornaram o hash novo. No produtor real de uma composição retida, A→HEAD funcionou quando HEAD era B. Após avançar para C, B→HEAD foi recusado como se o conteúdo não tivesse mudado. Uma nova composição com os mesmos argumentos e a composição antiga com o SHA C explícito persistiram a transição.

Isso é diferente do problema já registrado em #18: lá o gate de HEAD usa eixos capturados e um watermark novo pode dar aparência de atualidade. Aqui a própria chave da cache de revisões arbitrárias é um nome móvel. Uma correção de watermark não resolve essa memoização.

**Limite observado:** esta rodada executou o produtor composto retido, não demonstrou uma chamada MCP pública de transição. Invocações independentes da CLI criam processos novos e não compartilham essa cache. A distinção deve aparecer na issue e na decisão de prioridade.

## 5. O produtor sabe que falhou; o renderer esquece

`test-vacuity-source.ts` devolve um registro `admitted:false` com motivo quando não consegue analisar um arquivo. Isso preserva a distinção entre “não encontrei uma shape” e “não consegui avaliar esse arquivo”.

O renderer `cli/src/test-vacuity.ts` agrupa apenas registros admitidos que persistiram e admitidos cuja persistência foi recusada. Um registro de falha de parse não entra em nenhum grupo. Com zero persistidos, a saída diz que nenhum teste possui uma shape demonstrada; com algum persistido, a saída mostra sucesso e omite o restante.

Os controles reais são importantes: o stdout de uma entrada válida sem achados foi byte-idêntico ao stdout de uma entrada que o parser não conseguiu avaliar. No caso misto, a CLI preservou o achado válido, mas não mostrou a falha do outro arquivo. Não houve admissão de um fato falso pela falha de parse. Houve perda de evidência sobre a cobertura da avaliação.

A correção deve preservar diagnósticos e tornar a incompletude observável. Não precisa descartar fatos válidos de um lote parcial ou introduzir uma transação global de análise. O contrato do exit code deve ser definido junto à saída, sem confundir “algum fato foi persistido” com “todos os arquivos foram avaliados”.

## 6. No Maestro, ordem e persistência já têm mecanismos próprios

A admissão, a aprovação e o consumo da aprovação são eventos diferentes. `admission-record.ts` registra uma avaliação vinculada à mensagem; não executa trabalho. O avaliador de aprovação exige a apresentação exata, usuário direto, mesma sessão, posição posterior/imediata e binding correspondente. O despacho governado confere a requisição contra eventos e cria um identificador determinístico de consumo.

O consumo ocorre antes da criação da sessão filha e da execução. Esse posicionamento protege contra reuso; o achado desta rodada não pede movê-lo para depois do efeito. A falha após consumo durável é assunto de #49, com política de recuperação distinta.

Aqui a falha foi injetada antes de publicar o evento Consumed. O handler de exceção faz uma consulta ao banco, mas ignora se ela encontrou um registro, retornando incondicionalmente `approval-consumed`. O experimento comprovou zero registros, zero filhos e zero chamadas ao executor. Restaurando o publicador, a mesma aprovação foi usada com sucesso. O diagnóstico anterior portanto não refletia estado persistido.

O caso de consumo realmente existente foi testado separadamente e recusou a nova execução corretamente. O caso normal registrou um consumo, um filho e uma chamada ao executor. A correção deve distinguir registro existente, registro ausente e verificação indisponível. No último caso, não se deve inventar certeza nem repetir automaticamente trabalho cujo resultado permaneça incerto.

## 7. Fronteiras de teste do Maestro não são disponibilidade do produto inteiro

Os testes desta rodada usam os serviços originais de Session, Database, EventV2 e TaskTool; os eventos de apresentação/decisão foram semeados como fixtures aprovadas, seguindo o padrão da suíte existente. A execução do modelo foi substituída por um contador sem rede. Na terceira condição, somente a publicação de Consumed falha antes de qualquer commit.

Isso prova comportamento do despacho e de seu tratamento de erro sob essas condições. Não prova a origem humana dos eventos semeados, execução de um modelo, uma pane física de disco ou a conclusão da jornada pública. `maestro_present_approval` continua deliberadamente bloqueada até existirem leitores duráveis de plano e validação. Não foi alterada e não deve ser habilitada para fazer a fixture parecer uma jornada ponta a ponta.

Há também registros de agentes distintos no host legacy e no core V2. Foram lidos `opencode/src/agent/agent.ts`, `core/src/agent.ts`, o plugin de agentes, a configuração e o handler de listagem V2. A ausência de Maestro na lista builtin de um módulo não prova sozinha que nenhuma configuração/plugin pode registrá-lo no aplicativo. Essa hipótese ficou **não concluída**, sem nova issue de ausência de integração.

## 8. Pontos que não foram transformados em novos bugs

| Observação | Tratamento nesta rodada |
|---|---|
| Histórico de transição não usa freshness de HEAD | Intencional; preservar histórico não é servir prova falsa por si só. |
| RevIndex usa dump SCIP vazio em revisão arbitrária | Não classificado como novo defeito: grounding consultado depende dos eixos estruturais; há justificativa e testes próprios. |
| Mesmo CAS recebe conteúdos antigos e novos | Retenção histórica é válida; presença corrente precisa ser examinada separadamente. |
| Existem dois registros de agentes no host | Limite de integração ainda não exercitado; nenhuma conclusão de indisponibilidade total. |
| Campo model opcional/variant no despacho | Precisa ser avaliado contra o contrato de resolução e futuros leitores; não foi declarado bypass. |
| Aprovação pública recusa | Proteção explícita, não regressão a “corrigir” habilitando entrada não confiável. |
| #18, #37, #49 tratam conceitos vizinhos | Relidos e relacionados; novos achados têm caminhos e causas distintos. |
| 194 testes existentes passaram | Contraprova contra quebra generalizada; não certificação das condições que faltavam nos testes. |

## 9. Fechamento que uma futura correção precisa demonstrar

O teste final de cada mudança deve atravessar a fronteira responsável pelo erro: identidade do produtor até leitura reaberta; parser até saída pública; nome Git até resultado do adapter retido; publicação de consumo até diagnóstico e recuperação. Asserções apenas no helper de hash, no sucesso do write ou num retorno HTTP não cobrem essas propriedades.

Esta rodada não propõe um framework genérico novo. As correções devem resolver causas específicas preservando gates, ratificação, isolamento, deduplicação de retries e compatibilidade dos dados existentes. Primeiro explicitar exatamente a garantia; depois provar que o produtor, o storage e o consumidor concordam sobre seu significado.

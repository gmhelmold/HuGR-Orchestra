# HuGR-Orchestra — reconciliação, revalidação e autoridade do Maestro

Data: 17 de setembro de 2026. Base de produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.

## Resultado e escopo

Esta rodada produziu cinco issues novas, sustentadas por seis cenários agregados executados contra a implementação original. Os diagnósticos completos foram repetidos em duas execuções independentes concluídas, com novas fixtures. Há também um primeiro log preservado que contém um erro do próprio diagnóstico, explicado abaixo. Não houve correção de código de produto, ativação de aprovação bloqueada, alteração de configurações globais ou merge.

| Issue | Resultado observado | Alcance provado |
|---|---|---|
| [#55](https://github.com/gmhelmold/HuGR-Orchestra/issues/55) | Uma citação deletada desaparece do conjunto de drift e a reconciliação retorna limpa | Handler, CLI real e MCP real, processos novos |
| [#57](https://github.com/gmhelmold/HuGR-Orchestra/issues/57) | `--accept-reground` relata um reparo concluído, mas não modifica a store | CLI real, MCP real e hashes de todos os arquivos da store |
| [#59](https://github.com/gmhelmold/HuGR-Orchestra/issues/59) | O payload de aposentadoria sugerido pelo doctor é recusado pelo próprio write gate | Plano original, check/emit originais e emit via MCP |
| [#60](https://github.com/gmhelmold/HuGR-Orchestra/issues/60) | Reverify ignora provas novas e pode contar uma mesma linha como revalidada e dangling | API `composeRuntime` reutilizada; não existe porta MCP de reverify no binário examinado |
| [#61](https://github.com/gmhelmold/HuGR-Orchestra/issues/61) | Doctor CAS declara saúde com blob íntegro colocado fora de seu shard canônico | Store original, doctor original, CLI e MCP |

As issues incluem causa, evidência, controles, limites, direção mínima de correção e cinco grupos de critérios: success criteria, completeness criteria, quality standards, Definition of Done e invariants. Os critérios listam o trabalho necessário para corrigir; não são uma afirmação de que todas essas variantes já foram executadas nesta auditoria.

O inventário abrange 7.936 caminhos rastreados, dos quais 7.935 arquivos regulares foram materializados e identificados por hash. Há 1.252 arquivos no Atlas e 56 manifests de pacotes no repositório. Uma busca cruzada percorreu os arquivos textuais inventariados e registrou referências em 1.199 arquivos. **Inventário e busca não equivalem a leitura semântica integral.** O ledger distingue arquivos lidos integralmente nesta rodada, trechos inspecionados e arquivos somente pesquisados. Não se reivindicam cinco leituras integrais de todos os arquivos do monorepo.

## Método e cinco passagens

A primeira passagem fixou versão, branches, antecedentes, inventário e deduplicação. A segunda seguiu produtores, consumidores e contratos: `compose -> wire -> git-drift -> reconcile`, `doctor -> plan -> emit`, `compose -> reverify`, e os seis módulos centrais de Maestro. A terceira executou testes existentes e cenários adicionais usando módulos originais compilados, Git e persistência reais. A quarta repetiu os diagnósticos, confrontou runtime reutilizado com runtime novo e verificou transportes públicos. A quinta revisou os próprios achados, limitou conclusões à superfície efetivamente exercitada, separou causas parecidas e publicou as issues.

`JOURNAL.md` conserva a evolução do entendimento. `source-review-ledger.json` informa a extensão de leitura. `source-integrity.json` registra que os arquivos rastreados do produto não foram alterados. `inventory.json`, `manifests.json` e `cross-repository-references.json` tornam a navegação rastreável, sem tratá-la como prova de compreensão de cada arquivo.

As dependências Atlas foram copiadas para o checkout isolado, preservando symlinks relativos de workspace que apontam para os pacotes desse checkout. As dependências do host foram reutilizadas após verificar que os fontes rastreados relevantes do checkout de origem coincidiam com a base auditada. Os testes de Maestro carregaram os módulos do checkout auditado e os serviços originais correspondentes; não houve execução de modelo para esses diagnósticos.

## O que a composição realmente garante — e o que não garante

### 1. Detecção e classificação são responsabilidades diferentes

O classificador de reconciliação decide se um fato apresentado a ele é recuperável mecanicamente. A detecção decide quais fatos chegam ao classificador. Compartilhar o classificador com o doctor evita duas definições divergentes de “mecânico”, mas não corrige uma omissão no detector.

Em `adapter-io/src/git-drift.ts`, `entryDrift` compara a âncora no merge-base validado e em HEAD. Uma mudança de bytes no mesmo caminho produz par de drift. Um caminho removido pode produzir um par quando o conteúdo é encontrado em outro local. Quando o caminho desaparece e o conteúdo não se encontra em lugar nenhum, a função retorna `undefined`. Isso elimina precisamente o caso que deveria exigir análise semântica ou recusa explícita.

O controle mais importante foi comparar quatro mudanças sobre fatos admitidos pelo mesmo caminho público: sem mudança, rename, rewrite e delete. A reescrita gerou exitCode 2; o rename gerou um item mecânico; a ausência de mudança permaneceu limpa; a deleção retornou zero itens, mesmo com o doctor classificando o fato como semanticamente quebrado. Foram usados processos novos para excluir o problema de índices capturados em runtime longo (#18).

Controles adicionais confirmaram a omissão tanto para a citação primária quanto para a secundária de um fato com duas âncoras. Em ambas as fixtures, um merge-base inexistente foi corretamente recusado com exit 1.

A conclusão de #55 é específica: existe um falso resultado limpo de reconciliação. Não foi demonstrado merge automático, nem se está afirmando que o read gate de query serviu o fato como fresco.

### 2. Conjunto elegível não é conjunto publicado

`tools/src/reconcile.ts` não persiste nada. Seu `regroundedCount` é o tamanho do conjunto mecânico quando a opção é verdadeira. Os comentários dizem que a gravação acontece posteriormente, mas a jornada examinada devolve o resultado sem essa gravação. O schema público e o nome do resultado continuam descrevendo re-grounding automático/completado.

Para testar #57 não bastava olhar o retorno. O diagnóstico calculou um manifesto SHA-256 de cada arquivo regular sob `.atlas/`, executou CLI com a flag, repetiu via MCP, comparou os manifestos e abriu outro runtime. Todos os bytes permaneceram iguais; a âncora velha continuava armazenada; o doctor ainda detectava drift mecânico. Isso exclui a explicação “o reparo aconteceu silenciosamente em outro arquivo”.

A primeira correção admissível pode ser pequena: não anunciar capacidade indisponível e não contar elegibilidade como conclusão. Se for implementada publicação real, ela precisa atravessar a autoridade já existente e contabilizar o que ficou durável. Esta issue não se confunde com #21, que trata de uma gravação efetivamente tentada e confirmada que não atualiza a evidência de grounding.

### 3. Retirar uma afirmação não é reafirmar sua verdade atual

O doctor reconhece drift semântico e oferece um plano `retire`. `retireTemplate` muda `authoring` para `SUPERSEDED`, mas conserva o grounding antigo. O write gate continua exigindo grounding atual. Assim, o motivo para aposentar o fato é também o motivo para recusar o payload sugerido.

#59 foi verificada com plano original e a exata operação sugerida, usando o mesmo ator autorizado. A recusa foi `ungrounded`; a store permaneceu igual. Uma escrita fresca em outra fonte estável passou, eliminando falha geral de configuração como explicação. Não há falsa prova aceita aqui: o gate é conservador e está correto ao não certificar evidência velha. A lacuna é de progresso e coerência do plano de reparo.

Uma solução não deve inventar uma citação atual, marcar a evidência velha como FRESH nem relaxar indiscriminadamente a verdade exigida de novos fatos. A semântica de uma aposentadoria autorizada precisa ser definida em relação à identidade e à autoridade do incumbent. Enquanto isso não existe, o plano deve dizer claramente que é recomendação não executável por aquele caminho.

### 4. Há pelo menos três tempos distintos na revalidação

A composição captura o índice, captura uma população de fatos e permite ler a store novamente. Esses três momentos não são intercambiáveis. Em `compose.ts`, `driftPairsOf(store)` é avaliado durante a inicialização. O thunk de reverify reaproveita esse array, mas chama `danglingOf(store)` novamente.

O primeiro cenário de #60 não muda fonte, HEAD nem SCIP. O próprio `deriveRelations()` original produz uma relação com selo proven depois da composição. O runtime retido continua contabilizando zero; o runtime novo reconhece e revalida uma prova. Isso distingue a falha de população da falha de índice desatualizado já registrada em #18.

O segundo cenário começa com uma prova já existente e compõe o runtime depois dela. Retira-se somente o objeto CAS da fixture. O runtime retido ainda revalida os bytes capturados e também enxerga a linha dangling atual: denominador 2 para uma linha corrente. O runtime novo contabiliza uma linha, somente dangling. O relatório antigo não é apenas “um pouco atrasado”; ele mistura épocas incompatíveis dentro da mesma resposta.

Um controle adicional executou também o binário CLI `verify-store`: depois da publicação ele encontrou uma prova e saiu com 0; depois da perda dos bytes encontrou um dangling e saiu com 2.

O alcance da falha reproduzida é a API composta reutilizada. O binário CLI normalmente compõe um runtime por execução, e o binário MCP não expõe reverify. Não foi executada uma chamada MCP de verify-store inexistente; a proteção de um processo CLI novo decorre também desse ciclo de composição, não de uma alegada prova sobre todos os consumidores possíveis. No caso da contagem dupla, dangling permanece detectado: não se afirma que o gate final ficaria verde.

### 5. Integridade criptográfica não é disponibilidade no endereço correto

O CAS resolve um hash em `cas/<dois primeiros caracteres>/<hash>`. O doctor inspeciona diretórios e usa o filename como presença, sem verificar se está no shard correto. Um arquivo com conteúdo íntegro no diretório errado pode satisfazer a contagem do doctor, embora o `get(hash)` real retorne ausência.

#61 usou deslocamento de um blob em uma fixture temporária, mantendo os bytes. O controle inicial era saudável. Depois do deslocamento, o reader real não encontrou o objeto e os diagnósticos públicos continuaram `sound: true`. Não foi afirmado que o writer normal gere diretórios errados; trata-se de um caso de restauração/layout inconsistente que o diagnóstico promete detectar.

A disponibilidade de uma referência deve ser avaliada com a mesma regra de endereço do reader. Encontrar uma cópia íntegra em algum lugar não comprova que o produto consegue recuperá-la onde a procura.

## Maestro: aprofundamento e resultado negativo importante

Foram relidos integralmente `admit-request.ts`, `admission-record.ts`, `approval.ts`, `approval-record.ts`, `governed-task.ts` e `task-hash.ts`, além do schema de eventos e testes de lifecycle. A admissão é uma decisão de encaminhamento, não prova da verdade do assessment nem autorização de execução. Seu resultado durável vincula mensagem e versão do método; replay idêntico e conflito de conteúdo são casos diferentes.

O avaliador de aprovação não se limita a reconhecer a palavra “aprovo”: exige apresentação renderizada exatamente, identidade válida, mensagem direta apropriada, ordenação e vínculo à revisão pertinente. O registrador reconstrói a evidência de apresentação a partir da mensagem/tool part concluída. A verificação de tarefa compara os bindings; o consumo da aprovação é outra etapa e não equivale à conclusão da execução.

Os 32 testes originais de Maestro passaram. Um diagnóstico adicional usou banco e EventV2 originais para executar três pares concorrentes de admissões com conteúdo diferente e três pares de apresentações com conteúdo diferente. Em todos os casos observados, houve um vencedor e um conflito explícito. O controle sequencial também preservou a distinção entre replay e conflito. Isso não originou issue: não há evidência, nesse diagnóstico, da hipótese de perda silenciosa de conflito.

O teste usa o agendamento normal de Effect; não força todos os interleavings nem afirma concorrência multiprocesso. Ele chama produtores internos porque a apresentação pública continua deliberadamente bloqueada até existirem leitores duráveis de plano e validação. Os testes de lifecycle existentes usam um executor substituto e não são uma demonstração de trabalho real de um LLM. Nenhuma dessas limitações foi convertida em alegação de execução governada disponível ponta a ponta.

As questões anteriores #25, #42 e #49 continuam relacionadas ao lifecycle, mas não foram reabertas com outro nome. Um ponto arquitetural preservado: consumo único pode garantir “no máximo uma tentativa autorizada”; sem um resultado terminal durável, não garante execução concluída nem recuperação inequívoca. Uma correção futura não deve transformar falha após consumo em repetição automática de efeitos potencialmente já realizados.

## Revisão adversarial dos próprios diagnósticos

O primeiro run interrompeu o agregado de reconciliação porque o diagnóstico esperava que `MCP.isError` fosse verdadeiro em todo bloqueio semântico. A propriedade correta naquela resposta é `data.exitCode=2`. O diagnóstico foi corrigido; nenhuma linha do produto foi alterada. O log inicial permanece preservado para que esse erro não desapareça da história.

Os dois runs completos posteriores confirmaram os seis cenários. Um exit 0 do script de diagnóstico significa “observação reproduzida conforme descrita”, não “produto corrigido”. As condições desejadas para regressões futuras estão nas issues. O Maestro adicional, por sua vez, forneceu contraevidência e não um novo defeito.

Mantiveram-se separados: sintomas e causa; hipótese e reprodução; componente interno e transporte público; input SCIP controlado e execução do indexador real; classificação mecânica e efeito durável; validade de conteúdo e disponibilidade atual. Mudanças de código de produto, correções e merges não fazem parte deste pacote.

## Execuções e evidência

O estado final das execuções e guards está em `execution-summary.json` e nos logs referenciados. O typecheck teve exit 0. A suite focada inicial passou 50 testes em sete arquivos; a suite original Maestro passou 32 testes em sete arquivos. A suite completa Atlas terminou com **4.119 passed, 12 skipped, 3 todo**, em **527 arquivos passed e 2 skipped**, exit 0. O `reference-model-guard` retornou exit 1 com seis violações; o `own-snapshot-guard` retornou exit 0. São resultados separados: suite verde não certifica o ledger de reference models nem cobertura global do Own.

As evidências incluem os dois runs completos, o run inicial com erro do diagnóstico, observações do Maestro, inventário, referências cruzadas, ledger de fontes e controle de integridade dos fontes. Os dados de prova foram criados em repositórios temporários; não foram usados documentos, worktrees de trabalho ou stores pessoais do usuário.

A prioridade recomendada é #55, por retornar um resultado limpo quando uma fonte citada deixa de existir. Depois, alinhar os contratos de reparo (#57/#59), a coerência de população (#60) e a disponibilidade diagnosticada do CAS (#61). Essa ordem é julgamento de engenharia; não é uma pontuação estatística de risco nem uma afirmação de incidente em produção.

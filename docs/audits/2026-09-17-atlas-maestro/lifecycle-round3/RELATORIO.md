# HuGR-Orchestra — Atlas e Maestro
## Auditoria de ciclo de vida, persistência e continuidade — 17/09/2026

**Objeto:** `gmhelmold/HuGR-Orchestra`, branch `maestro/rebuild-fork-dev-clean`, commit `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.

**Natureza:** investigação e documentação. Nenhuma correção de código, merge ou habilitação do fluxo governado foi realizada. Os experimentos escrevem somente em repositórios/arquivos temporários; o checkout de produto permaneceu sem alterações rastreadas. Prioridades são propostas de triagem, não classificações de vulnerabilidade.

## 1. Resultado e diferença em relação à auditoria anterior

Esta rodada avançou do exame de contratos isolados para a relação entre **admissão, publicação, leitura, histórico e retomada**. O principal resultado não é que “o armazenamento inteiro está quebrado”. É que algumas garantias das funções isoladas deixam de valer quando o caminho completo muda o significado do seu resultado.

Foram abertas quatro issues independentes: **#39**, concorrência na admissão do logbook; **#40**, perda de diagnóstico de leitura parcial; **#41**, escolha do checkpoint antigo na projeção de retomada; **#42**, contrato explícito para fallback de retomada. As duas primeiras têm evidência pela interface MCP real. A terceira é um problema de componente ainda sem consumidor público de spawn identificado. A quarta é uma melhoria deliberadamente classificada como mudança de contrato: o comportamento atual é exigido por um teste existente.

Quatro resultados foram independentemente reconfirmados e associados às issues canônicas **#32, #33, #34 e #37**, que surgiram em trabalho paralelo durante a investigação. A issue #38, criada antes dessa atualização de deduplicação, foi fechada como duplicata da #32. Não se deve contar #38 como um defeito adicional ou uma correção.

O resumo de execuções próprias está em [RESULTADOS.md](RESULTADOS.md); os outputs estão em [evidence/](evidence/) e os programas em [probes/](probes/). [JOURNAL.md](JOURNAL.md) registra a progressão e as hipóteses descartadas. As issues anteriores #15–31 não foram reabertas nem apresentadas como descobertas novas.

## 2. Escopo e força da evidência

O inventário capturou **7.936 caminhos rastreados** do commit. Isso é cobertura de metadados, não leitura semântica desses 7.936 arquivos. Foram realizadas cinco passagens de investigação: baseline/deduplicação; modelo e persistência; transporte e reinício; concorrência e contraprovas do host; revisão fria e publicação. **Não foram realizadas cinco leituras integrais, linha por linha, de todo o monorepo.**

As conclusões distinguem quatro níveis: comportamento observado no transporte real; comportamento observado em componentes originais com dependências de teste explicitadas; rastreamento estático de chamadas; proposta de mudança de contrato. Uma frase em comentário não foi aceita como prova de que uma feature está conectada. Um teste verde não foi aceito como prova de uma jornada que ele não executa.

A execução ocorreu em macOS. Atlas foi recompilado pelo próprio script `npm run build -- --force` antes das últimas repetições. As histórias MCP usam o binário original, cliente SDK original, stdio entre processos, Git/arquivos reais e gitleaks 8.30.1. Não usam LLM nem APIs de inferência. O diagnóstico inicial de seis componentes substitui somente o scanner por uma implementação nomeada que aceita as fixtures não secretas; esse diagnóstico não mede capacidade de detectar segredos.

Os testes do host usam o isolamento de configuração e banco do próprio repositório. A sondagem de admissão concorrente usa os serviços originais de eventos/SQLite, sem substituir o gravador. Os dois testes originais de Task utilizam prompt operations substituídas, como declara sua fixture: demonstram comportamento do host, não execução de trabalho por um modelo real.

Não se mediram perda de energia, NFS, Windows, comportamento sob carga de produção ou a probabilidade estatística das corridas. O caso de linha truncada simula uma interrupção deixando um fragmento no arquivo; ele não derruba a máquina.

## 3. Modelo de arquitetura que esta rodada estabeleceu

### 3.1 Há mais de uma noção de estado

No Atlas, Knowledge, Memory, Orientation e Own não são nomes alternativos para a mesma base. Memory preserva registros por membro e tipo; sua projeção de regras é uma seleção para injeção. Orientation deriva rótulos de estado a partir de eventos e supersessões. Own representa contexto de ownership. A retomada por Task é, por sua vez, continuação de uma sessão do host. Uma garantia de qualquer uma dessas superfícies não deve ser transferida automaticamente para outra.

Para Memory, o caminho efetivo de escrita é: transporte → handler → `createMemoryEmit` → derivação de tipo/template e verificações específicas → scanner → `createDurableMemory.append` → `createDurableLog.append`. O caminho de leitura é diferente: log → verificação/fold → registros → projeção/seleção → construtor de verdict → transporte. As diferenças entre esses caminhos explicam as falhas observadas. [fonte 1][S1] [fonte 2][S2] [fonte 3][S3] [fonte 4][S4] [fonte 5][S5]

O registro completo preservado pelo fold não é o mesmo conjunto que entra no header. `memory-read.ts` calcula posições por regra, escolhe versões e aplica política de frecência/seleção. Já a escrita calcula o cap sobre a lista histórica de entradas do membro. A soma está aritmeticamente correta; o conjunto somado é que não corresponde ao contrato de injeção. [fonte 2][S2] [fonte 4][S4] [fonte 6][S6]

### 3.2 Append seguro não implica decisão de admissão atômica

O log append-only e sua identidade por conteúdo protegem propriedades úteis: preservação de registros independentes e deduplicação do mesmo evento no fold. Mas a regra “há uma única entrada de logbook por PR” depende de uma observação do estado antes da escrita. Dois processos podem observar a mesma ausência e escrever duas identidades de conteúdo diferentes. Nenhum append precisa falhar ou perder bytes para que a regra seja violada. [fonte 1][S1] [fonte 2][S2] [fonte 7][S7]

Esse é o ponto de maior impacto deste ciclo: o comentário “não existe read-modify-write de um arquivo inteiro” não elimina a necessidade de coordenar **read-decide-append** quando a decisão depende de unicidade, ocupação ou orçamento. A evidência da issue #39 mostra exatamente essa separação, sem substituir o armazenamento ou fabricar um resultado de filesystem.

### 3.3 Valor de rótulo não é identidade de ocorrência

`orientEvent` identifica um evento pelo conteúdo `{channel, label}` e usa o mesmo valor como content hash. Isso permite deduplicar a repetição daquele conteúdo, mas não distingue uma nova ocorrência de um estado que já apareceu. Na sequência running → blocked → running, a terceira ocorrência tem outro predecessor e o mesmo identificador da primeira. O fold conserva a primeira, descartando a nova relação causal. [fonte 7][S7] [fonte 8][S8] [fonte 9][S9]

Corrigir isso exige explicar identidade de evento, identidade do conteúdo e referência de supersessão. Acrescentar timestamp ou aleatoriedade somente para “parar de deduplicar” não define semântica de retry nem compatibilidade com registros antigos.

### 3.4 Checkpoint do Atlas e sessão do Task são mecanismos distintos

A função `spawnFold` monta um arquivo de checkpoints a partir de registros de tarefa e procura o primeiro correspondente. Não foi encontrada sua chamada por um caminho público do runtime: existe capacidade de componente, não prova de integração automática completa com Maestro. A issue #41 mantém essa limitação no título/escopo e não inventa um incidente do produto final. [fonte 4][S4] [fonte 10][S10]

O Task do host trata `task_id` como tentativa de recuperar uma sessão existente. Se ela existe, reutiliza a sessão; se não existe, o código pode criar outra. Isso está explicitamente exercitado pelos testes existentes. A interface textual, entretanto, descreve `task_id` como continuação da mesma sessão, com mensagens e tool outputs anteriores. A melhoria #42 é tornar essa mudança de contexto explícita, não fingir que o fallback foi um acidente recém-descoberto. [fonte 11][S11] [fonte 12][S12] [fonte 13][S13]

### 3.5 O host não tem um único registro de ferramentas universal

A investigação também verificou o serviço AgentV2 e a composição V2 de built-ins. A lista de built-ins desse caminho declara Task entre os ports ainda pendentes. Isso impede extrapolar a existência das ferramentas em `packages/opencode` para todas as superfícies V2. Não foi aberta issue afirmando que Maestro está indisponível em todo V2: ferramentas dinâmicas e outras composições exigem uma auditoria própria antes dessa conclusão. [fonte 14][S14] [fonte 15][S15]

## 4. Achados e limites

### A. Perda de escrita reconhecida após linha incompleta — canônica #32

Com um primeiro registro válido no log, foi acrescentado um fragmento JSON incompleto sem newline. A segunda escrita válida recebeu reconhecimento de admissão pelo MCP. Depois de encerrar e abrir novamente o servidor, o segundo registro não apareceu no recall. O leitor de baixo nível registrou uma linha rejeitada. Uma terceira escrita saudável voltou a sobreviver.

A causa é framing: o próximo JSON é concatenado ao fragmento anterior. O newline ao final do novo evento não recupera uma fronteira anterior inexistente. Um controle com fragmento danificado já terminado por newline preserva a escrita seguinte. Logo, não se trata de “qualquer corrupção apaga todo o log”, mas de um evento específico reconhecido e depois ilegível. [fonte 1][S1] [fonte 2][S2]

**Resultado de aceitação esperado:** uma escrita reconhecida precisa ser recuperável como evento independente após reabertura, ou a operação deve recusar explicitamente a publicação. A correção não pode truncar histórico silenciosamente nem introduzir uma corrida de reparação sem coordenação. Este ciclo adiciona à #32 evidência pelo MCP e reinício de processo.

### B. Leitura parcial é transformada em resultado aparentemente completo — #40

A leitura baixa retorna `rejected`, precisamente para não confundir corrupção e ausência. Mas recall/header/Orientation descartam essa informação na composição. No experimento, um log parcialmente legível produziu um resultado vazio de consulta, sem erro MCP, acompanhado de orientação afirmando que não existem registros correspondentes. Não se pode concluir isso da parte que falhou ao ler. [fonte 1][S1] [fonte 4][S4] [fonte 5][S5] [fonte 9][S9]

**Separação importante:** corrigir o framing da #32 não resolve a #40; uma linha danificada mas corretamente terminada já é suficiente para esconder o estado parcial. O contrato deve escolher quando permitir PARTIAL e quando exigir HOLD, mantendo o caso realmente vazio saudável distinto.

### C. Histórico gasta o orçamento reservado à injeção — canônica #33

Foi usada uma única regra com 80 palavras na métrica de whitespace do produto. As versões com frecência 1 a 6 foram admitidas. A sétima foi recusada com contador 560 e cap 500, embora o header contivesse somente uma regra e o cap calculado sobre essa regra isolada fosse 80. A sequência também foi reproduzida pelo MCP real. [fonte 2][S2] [fonte 4][S4] [fonte 6][S6]

O problema não desaparece trocando o tokenizador: mesmo sob a métrica interna declarada, arquivo histórico e conjunto ativo são diferentes. Excluir o histórico para liberar espaço destruiria uma propriedade deliberada. A solução deve reutilizar uma definição explícita do conjunto pós-escrita que o orçamento governa.

### D. Dois escritores autorizados ocupam o mesmo PR — #39

Foram abertas duas sessões MCP, cada uma com seu processo original de servidor. Ambas usaram actor `orch` e enviaram entradas válidas e diferentes para o mesmo PR. Em três rodadas, com três IDs de PR distintos, duas escritas foram reconhecidas e duas entradas apareceram no recall. Uma tentativa posterior, serial, foi corretamente recusada como duplicata.

Esse controle elimina duas interpretações erradas: a regra de unicidade não está simplesmente ausente, e não ocorreu confusão de identidade por conteúdo. A verificação serial existe; a decisão de concorrência não é publicada de maneira atômica. [fonte 1][S1] [fonte 2][S2]

**Escopo:** esse teste prova violação de unicidade do logbook. A possibilidade de oversubscription do cap por concorrência merece revisão do mesmo mecanismo, mas não foi medida separadamente e não é apresentada como outro defeito confirmado.

### E. O writer governado não usa todas as regras do validator específico — canônica #34

O validator de logbook exige seções preenchidas e limita seus campos de prosa a 280 caracteres. O writer durável usa o validator genérico de shape/tipos e verificações específicas de autor/PR, mas não aplica aquele validator de seções. [fonte 2][S2] [fonte 16][S16] [fonte 17][S17]

Uma seção com 281 caracteres e outra vazia foram recusadas pelo validator especializado e aceitas pela escrita governada. Ambas sobreviveram ao reinício e recall pelo MCP. O controle de PR duplicado permaneceu funcionando no experimento serial. Nenhuma dessas observações implica falha de detecção do scanner ou de autorização.

### F. Orientation não representa retorno ao rótulo anterior — canônica #37

Três appends legítimos, com supersessões causais corretas, geraram três linhas físicas, dois eventos no fold e nenhum erro de leitura. O estado final foi blocked em vez de running. A mudança para um rótulo novo, completed, funcionou. A reconfirmação usou os componentes originais e reabertura do store. [fonte 7][S7] [fonte 8][S8] [fonte 9][S9]

**Limite de exposição:** esta rodada não identificou produtor automático público dos eventos de Orientation. O erro do componente está provado; a ocorrência em uma orquestração real não foi demonstrada.

### G. Retomada escolhe o primeiro checkpoint antigo — #41

Duas entradas válidas, mesmo dono e mesmo task ID, registraram sucessivamente old checkpoint e new checkpoint. Após reabrir o store, `spawnFold` devolveu old checkpoint. O outro dono recebeu `no-own-fold`, como esperado. [fonte 4][S4] [fonte 10][S10]

O arquivo preserva várias versões e `find` seleciona a primeira. Falta uma definição implementada de versão corrente, ou uma recusa de ambiguidade. Não basta inverter uma lista sem explicar como ela se comporta depois de merges e forks. A existência da função não prova que o Maestro já a use; essa issue é explícita sobre o port ainda não conectado.

### H. Continuação pode virar criação sem declaração explícita — #42

Os testes existentes confirmam os dois comportamentos: um ID válido retoma; um ID ausente cria um filho. O teste não é defeituoso por isso: ele é evidência de intenção de compatibilidade. A tensão está entre essa intenção e a promessa feita ao chamador de conservar contexto. [fonte 11][S11] [fonte 12][S12] [fonte 13][S13]

A proposta é explicitar política e resultado: retomou, criou intencionalmente, ou fez fallback de uma retomada indisponível. Os nomes são ilustrativos; não são uma API existente. Erro de leitura não deve ser classificado automaticamente como ausência, e a escolha não deve enfraquecer vínculo de pai/agente ou aprovação governada.

## 5. Contraevidência e controles que impedem exageros

**Admissão concorrente do Maestro:** a leitura estática sugeriu investigar um intervalo entre lookup e publicação. O teste original de serviços executou três rodadas de oito requisições idênticas concorrentes; todas as 24 retornaram com sucesso e o replay correspondeu ao registro persistido. Quatro chaves diferentes também passaram, e uma alteração de payload para chave já usada foi recusada. A suspeita não foi reproduzida e não virou issue. Isso não é uma prova universal de linearizabilidade sob todo schedule; é evidência contra a acusação nos schedules executados. [fonte 18][S18] [fonte 19][S19]

**Suite original de memória:** 50 testes passaram em quatro arquivos. Os testes de append concorrente confirmam preservação de registros distintos. A issue #39 não contradiz esses resultados: ela adiciona a pergunta sobre escritores competindo por um único slot lógico.

**Task:** o comportamento de fallback não foi chamado de regressão, porque o teste já o exige. Foi aberto como melhoria de contrato, com necessidade de decisão explícita de compatibilidade.

**Governança:** a ferramenta pública de apresentação continua deliberadamente indisponível sem leitores duráveis de plano/validação. Este ciclo não a habilitou e não usou seus testes internos para declarar a jornada pública concluída. [fonte 20][S20]

**Fixtures e infraestrutura:** o primeiro programa MCP esperava um campo interno `ok` que a serialização pública não mantém; a asserção foi corrigida. A primeira invocação CLI usou a grafia errada de flag; a última usa `--task-id`. Esses erros do experimento foram preservados no histórico e não atribuídos ao produto. O Bun também registrou um aviso interno de tsconfig na sondagem externa; os resultados do teste constam separadamente desse aviso.

## 6. Ordem recomendada para correção e prova

Primeiro, tratar **framing/recuperação (#32), atomicidade da admissão (#39) e propagação de saúde de leitura (#40)** como três propriedades coordenadas da persistência. Uma correção deve evitar transferir o problema: não esconder corrupção para continuar escrevendo, não tornar a checagem de unicidade uma corrida nova e não descartar evidência histórica como “limpeza”.

Depois, alinhar **projeção atual versus histórico (#33), validator especializado versus entrada pública (#34), e identidade causal de Orientation (#37)**. O objetivo não é reimplementar todos os módulos, mas fazer com que as fronteiras compartilhem o mesmo contrato e a mesma autoridade.

Por fim, resolver os contratos de continuidade **#41 e #42** antes de prometer recuperação automática de orquestrações longas. Em #41, o consumidor público ainda precisa ser conectado; em #42, a alteração exige compatibilidade consciente porque o comportamento atual já é testado.

Cada issue nova contém **Completeness criteria, Success criteria, Quality standards, Definition of done e Invariants**, além de fonte imutável, resultado observado, controles e limite de exposição. Os critérios descrevem trabalho necessário; não são evidência de que a correção já foi realizada.

## 7. O que permanece aberto nesta investigação

O estudo não cobre completamente todos os parsers/linguagens, manutenção completa de Knowledge, reproof de todas as famílias, fluxo de geração de Own inteiro, todas as entradas V2, nem comportamento da interface final em sessão longa com LLMs reais. Windows, NFS, recuperação de energia e carga prolongada continuam sem execução neste ciclo.

A matriz de referências e os outputs permitem continuar a investigação sem tratar esses limites como funções prontas. A prioridade de engenharia que emerge é demonstrar as cadeias completas: **reconheceu → persistiu → releu → classificou a evidência corretamente → selecionou o estado corrente → retomou o contexto prometido**. Esta rodada encontrou falhas concretas nessas transições e também documentou os caminhos que passaram pelos controles.

## Referências de código no commit auditado

[S1]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/durable-log.ts
[S2]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/memory-emit.ts
[S3]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/memory-store.ts
[S4]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/memory-read.ts
[S5]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/memory-verdicts.ts
[S6]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/rules.ts
[S7]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/kernel/src/log.ts
[S8]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/orient.ts
[S9]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/orientation-store.ts
[S10]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/respawn.ts
[S11]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/task.ts
[S12]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/task.txt
[S13]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/tool/task.test.ts
[S14]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/agent.ts
[S15]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/tool/builtins.ts
[S16]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/logbook.ts
[S17]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/template.ts
[S18]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/maestro/admission-record.ts
[S19]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/event.ts
[S20]: https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/maestro-approval.ts

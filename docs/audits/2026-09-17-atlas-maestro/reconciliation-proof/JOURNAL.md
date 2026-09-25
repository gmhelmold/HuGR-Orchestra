# Atlas/Maestro — reconciliação e continuidade

## Passagem 1 — escopo e inventário

Base de produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, revalidada no GitHub. Checkout separado, detached; nenhum source de produto editado. Auditorias #14, #43, #44, #52 e #53 são antecedentes, não evidência de execução desta rodada. Issues #15–#51 consultadas para evitar duplicação. #38 já consta como duplicata de #32 no histórico.

Inventário de todos os arquivos rastreados e manifests foi produzido com hashes e contagens. Inventariar e pesquisar não equivalem a revisão semântica arquivo a arquivo.

## Plano de investigação

Passagem 2: seguir contratos e chamadas de reconciliação, revalidação e continuidade até os produtores/consumidores reais.
Passagem 3: comparar implementação com suites existentes e contraexemplos; executar módulos originais em fixtures isoladas.
Passagem 4: repetir achados em novas fixtures, controlar fatores e conferir alcance de transporte/publicação.
Passagem 5: revisão adversarial dos próprios resultados, deduplicação final, issues e documentação versionada.

Nenhum serviço de modelo pago será invocado. Os testes não operarão sobre dados de usuário: apenas repositórios temporários. Hipóteses não reproduzidas permanecerão identificadas como tal.

## Passagem 2 — contratos e composição

Seguidos `compose → wire → git-drift → tools/reconcile`, `doctor-source → plan → governed emit` e `compose → driftPairsOf → reverifyStore`. O índice e a população de fatos têm tempos de leitura diferentes. `reverify` conserva `driftPairs` da composição, mas lê `danglingOf` novamente. Doctor encontra fatos por leitura atual do store.

## Passagem 3 — código original e controles

`bun run typecheck`: exit 0. Sete arquivos de testes originais de doctor/reconcile/reverify: 50 testes passaram. Primeiro diagnóstico adicional executou seis cenários agregados usando fontes originais compiladas, Git, CAS e transporte reais. Cinco observações foram confirmadas; um agregado interrompeu porque o próprio diagnóstico confundia o `isError` do MCP com o `data.exitCode` da reconciliação. Essa suposição foi corrigida no diagnóstico, não no produto: o bloqueio semântico é observado pelo `data.exitCode=2`. O primeiro log permanece preservado, com exit 1.

Confirmados provisoriamente: contador de reground sem alteração em disco; payload de aposentadoria sugerido pelo doctor recusado pela porta de escrita; população antiga em reverify com fonte/index inalterados; contagem dupla de uma prova removida do CAS; diagnóstico de CAS saudável para blob íntegro no shard incorreto. Falta repetição e delimitação de alcance antes da publicação.

## Passagem 4 — repetição independente e alcance

A segunda e a terceira execuções do diagnóstico completo confirmaram os seis cenários agregados; cada execução reconstruiu seus repositórios temporários. Deleção, rename, reescrita e ausência de mudança foram distinguidos nos transportes públicos. O contador de reparos foi comparado com hashes de todos os arquivos da store antes/depois. A falha de reverify foi delimitada à API composta reutilizada: a porta MCP atual não a expõe.

Maestro: 32 testes originais passaram. Executado também um diagnóstico com banco/EventV2 originais: três pares concorrentes de admissão discordante e três de apresentação discordante. Um vencedor e um conflito explícito em todos os casos observados. Esta hipótese NÃO originou issue. O teste usa o agendamento normal de Effect, não explora exaustivamente todos os interleavings nem demonstra concorrência multiprocesso.

Algumas tentativas suplementares de comandos foram recusadas pela ferramenta de execução antes de executar. Não foram convertidas em resultados do produto nem incluídas como verificações concluídas.

## Passagem 5 — revisão dos próprios achados

Separadas capacidade de biblioteca e porta exposta; elegibilidade e publicação; integridade de bytes e disponibilidade no endereço; snapshot do índice e snapshot da população. Evitados duplicados com #18, #19, #21 e #49. Novos achados publicados em #55, #57, #59, #60 e #61. Os números intermediários #56 e #58 pertencem a outra rodada concorrente e não são resultados desta execução.

Foi preservado o erro inicial do diagnóstico (confusão entre isError e data.exitCode); os resultados posteriores corrigem apenas o diagnóstico. A suíte completa Atlas foi iniciada com dois workers e seu estado final será registrado a partir do log, não inferido da existência do processo.

## Fechamento da execução

Suite completa Atlas: 4.119 passed, 12 skipped, 3 todo; 527 arquivos passed e 2 skipped; exit 0. O guard de reference models falhou com as seis inconsistências registradas no seu log; o guard de Own passou.

Controles adicionais executados: deleção primária e secundária de fatos com duas âncoras continua retornando reconciliação limpa, enquanto base inválida retorna 1; CLI verify-store novo encontra a prova recém-publicada e retorna 0, e encontra o dangling após perda dos bytes retornando 2. Isso fecha a delimitação de #60 com execução CLI, não apenas inferência do binário.

Antes da publicação, verificou-se novamente que os fontes rastreados do produto não sofreram alterações. Os novos testes de auditoria ficam no pacote documental, não nas suites originais.

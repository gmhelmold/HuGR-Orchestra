# Revisão adversarial da publicação e das issues #83 / #84

## Norte e escopo fechado

Revisão solicitada pelo usuário da última entrega: commit `a360219b7f3b8d317c6bf24712f6ac88103f27e1`, seus **38 arquivos alterados** (37 no pacote e o índice principal), issues [#83](https://github.com/gmhelmold/HuGR-Orchestra/issues/83) / [#84](https://github.com/gmhelmold/HuGR-Orchestra/issues/84) e comunicação no PR #14. Produto fixado: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. O [norte original](../NORTE.md) continua válido: identidade e validade precisam acompanhar o conteúdo até o consumidor.

**Os dois achados permanecem sustentados. Corrigi a instrumentação, a reprodução e a precisão documental; não corrigi o produto.** Esta revisão não abrange como leitura integral todos os outros commits do PR #14 ou todo o monorepo. JSONs extensos de inventário foram verificados programaticamente; não são leitura semântica de centenas de módulos.

## O que a revisão encontrou e corrigiu

| Ponto na entrega | Correção e consequência |
|---|---|
| O comentário do probe Own afirmava checagem independente, mas a rodada não executou checker separado. | Removida a afirmação. Probes agora têm `AUDIT_EXPECT=observed` e `AUDIT_EXPECT=desired`. O primeiro caracteriza; o segundo exige a propriedade e efetivamente falha no produto auditado. Não foi criado um checker independente. |
| A descrição V2 dizia que apenas a permissão era substituída. | Explicitado também `ToolOutputStore.nodeWithoutConfig`: implementação original com limites padrão, sem carregar configuração. Permissão continua sendo o único mock funcional; são duas adaptações de composição, não uma. O arquivo original ToolOutputStore foi relido integralmente. |
| `currentDiskOrEmbeddedContent` repetia `newInfo.content`, sem fazer uma leitura do disco. | Campo retirado da versão revisada. Diretórios agora registram `currentDiskContent` lido realmente do arquivo; embedded é comparado à fonte ativa original. Os JSONs históricos não foram adulterados: aquele campo antigo era valor declarado da fixture, não testemunho independente do disco. |
| O verificador pós-consumo recebia a lista de arquivos capturada antes do consumo. | Cada verificação agora relê artefato e manifesto do disco. A comparação byte a byte do artefato já existia antes; isso reforça a prova, não revela uma alteração de disco que a rodada antiga teria observado. |
| O exemplo de reprodução gravava resultados nos mesmos caminhos da evidência publicada. | Nova receita usa diretório de resultados separado e ambiente mínimo. Os dois probes recusam `AUDIT_OUT` ausente ou já existente e modo desconhecido; a gravação final usa criação exclusiva (`wx`). Os três guardas foram exercitados pelo probe Core: recusaram, preservaram o arquivo existente e não criaram saída inválida. |
| O índice/PR não apresentavam de forma central as duas issues e a revisão posterior. | Navegação atualizada, sem apagar resultados ou contextos históricos. Issues continuam abertas e preservam seus cinco axiomas. |

## Provas repetidas e novas

[Resumo legível por máquina](RESULTS.json). As execuções de produto ocorreram em checkout descartável novo; nenhum patch de produção foi aplicado.

| Execução nesta revisão | Resultado | Interpretação |
|---|---|---|
| Probes exatamente como publicados | Host 9 pass; Core 5 pass | Caracterização original reproduzida novamente. |
| Probes revisados, modo observed | Host 9 pass; Core 5 pass | Melhorias da instrumentação não mudam os comportamentos observados. |
| Probes revisados, modo desired | **Host 4 pass / 5 fail; Core 3 pass / 2 fail; ambos exit 1** | Violações reais das propriedades desejadas, com controles ainda corretos. Não são sete issues: são cenários de duas causas. |
| Baseline original selecionado | **51 host + 12 Core = 63 pass**, 13 arquivos | Não é full-suite e não inclui contagem inflada das repetições. |
| Typecheck de Atlas, Core e OpenCode | Os três exit 0 | Probes revisados presentes nos typechecks Core/host. |
| Guardas do coletor Core | 3 controles passaram | Caminho existente, saída ausente e modo inválido não sobrescrevem evidência. Não são testes adicionais do produto. |

A [verificação do conjunto de falhas](evidence/desired-outcome-check.json) confirma os nomes exatos, a presença dos 9/5 registros e os Git blobs calculados a partir das nove fontes capturadas. Não se inferiu sucesso a partir do exit 1.

Arquivos principais: [host desired](evidence/desired-host.json), [log host desired](evidence/desired-host.log), [Core desired](evidence/desired-core.json), [log Core desired](evidence/desired-core.log), [comandos](evidence/commands.jsonl), [guardas](evidence/output-guard-tests.json).

No Own, as observações entram no coletor antes da assertion de igualdade desejada e o arquivo é escrito pelo `afterAll`. As falhas medidas não eliminaram as capturas; isso não é uma garantia de durabilidade contra crash. Os controles preservam `$1` e caminhos quando a skill é carregada como ferramenta, e mantêm a interpolação do comando ordinário. O artefato e suas fontes continuam READY. No V2, o caso embedded confirma fonte B ativa e conteúdo A servido; não depende de watcher. O caso de diretório mantém a obrigação de definir precisamente reload versus atualização automática.

## Integridade e rechecagem do material antigo

`shasum -a 256 -c SHA256SUMS` verificou **36/36 entradas** do pacote original antes destas alterações. O manifesto não se inclui a si próprio; são 37 arquivos no diretório. O índice é o 38º arquivo do commit. Os quatro JSONs históricos de cenários foram reprocessados: cada texto extraído das mensagens coincide com o campo observado, e os cinco desvios Own por conjunto persistem. A fonte embedded B e a saída A estão presentes nos registros, não somente em booleanos.

[Rechecagem histórica](evidence/historical-recheck.json) também compara os **819 JS registrados** com a nova compilação e não encontra diferenças. Esse universo inclui testes compilados; não são 819 módulos semanticamente revisados. [Resolução das dependências](evidence/dependency-source-check.json) compara as fontes físicas resolvidas nas cinco combinações pacote/consumidor disponíveis com os blobs da revisão do produto, sem divergência. Existem sobreposições; não somar essas contagens como arquivos únicos.

Os arquivos históricos em `../evidence/` e `../RESULTS.json` permanecem byte a byte como no commit original. O novo manifesto inclui documentos/probes revisados e os arquivos desta revisão. Hashes verificam os bytes publicados, não verdade semântica nem autenticidade externa.

## Limites e higiene

A infraestrutura usa Node/Bun e dependências previamente instaladas, por 38 links. Não é reprodução hermética. HOME/XDG de teste foram isolados; só variáveis mínimas de execução foram herdadas, sem chaves de modelos. O provedor local tem respostas programadas; nenhum modelo real foi chamado. SQLite é em memória. A variante Core é serviço/ferramenta, não sessão V2 completa; a variante Own usa SessionPrompt original diretamente, não UI/CLI completa. Não há prova de restart da mesma sessão ou isolamento completo entre worktrees.

Uma inspeção combinada de metadados e uma checagem sintática automatizada do exemplo shell foram bloqueadas antes de executar e não foram usadas como evidência. O exemplo de reprodução recebeu revisão manual; sua validação sintática automatizada não é declarada. As operações efetivamente concluídas e os códigos de saída são identificados acima. Não foram inventados resultados para suprir aquela tentativa.

A aprovação pública permanece bloqueada como no produto original. Não houve fechamento de issue, merge ou mudança em código de produção. As cinco passagens globais do repositório continuam abertas. Os resultados vermelhos aqui documentados são necessários para orientar a correção futura, não motivo para mascarar a falha ou enfraquecer o contrato.

## Fechamento da revisão dos próprios probes

Depois de acrescentar escrita exclusiva (`wx`), executei novamente **os dois modos nos dois probes**, com os mesmos controles e falhas desejadas. Os [comandos finais](final/commands.jsonl) registram o SHA-256 exato de cada probe executado; ele foi confrontado com o arquivo publicado. Typechecks Core/OpenCode foram repetidos após essa última alteração, ambos com exit 0. Veja [host desired final](final/desired-host.log) e [Core desired final](final/desired-core.log). Não somar essas repetições como novos casos únicos.

O manifesto foi regenerado somente depois de preservar os arquivos históricos. Links locais, cercas Markdown e `git diff --check` passaram. A atualização das issues e da descrição/comentário do PR referencia esta revisão, sem fechar os defeitos. O novo commit continua estritamente documental.

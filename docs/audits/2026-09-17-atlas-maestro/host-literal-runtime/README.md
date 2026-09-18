# WP-HOST-01 — fidelidade literal e substituição de fontes, com runtime original

Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Norte: [CONTINUIDADE.md](../CONTINUIDADE.md), complementado por [NORTE.md](NORTE.md).

**Rodada de auditoria, não correção:** nenhuma alteração de produção, habilitação da aprovação pública, fechamento de issue ou merge. Esta publicação supera o limite anterior de fragmentos isolados para os casos aqui executados, não amplia retroativamente a evidência antiga.

> **Revisão posterior:** [resultado e correções da auditoria](review/REVIEW.md). Os JSONs abaixo são históricos; os probes atuais suportam modos observed/desired. As evidências novas estão em `review/evidence/`.

## Resultado principal

O artefato Own pode estar atualizado, íntegro no disco e aprovado pelo verificador original, mas seu texto ser alterado no caminho de comando de barra antes de chegar ao endpoint do provedor. Separadamente, o Core V2 pode listar a nova fonte B como ativa e ainda entregar o conteúdo antigo A pela ferramenta registrada. São duas causas independentes, não duas formas de corrupção do CAS.

## 1. Literais Own até o provedor

[Coletor original-host em a360219b](https://github.com/gmhelmold/HuGR-Orchestra/blob/a360219b7f3b8d317c6bf24712f6ac88103f27e1/docs/audits/2026-09-17-atlas-maestro/host-literal-runtime/probes/audit-own-literal.test.ts) — [execução 1](evidence/host-literal-1.json) — [execução 2](evidence/host-literal-2.json).

O coletor cria um Git real descartável, constrói uma fixture de snapshot com revisão e blobs reais, executa o **materializador original** e o **verifyStaticOwnSnapshot original**, chama **SessionPrompt/Command/SkillTool originais**, e captura as mensagens recebidas pelo **TestLLMServer por HTTP local**. Não transcreve o renderer nem a interpolação. A fonte não muda depois da materialização; o verificador dá READY antes e depois, e o arquivo materializado permanece byte a byte igual.

| Caso | Original | Mensagem recebida pelo provedor |
|---|---|---|
| Ferramenta, controle | `The module returns the literal "$1".` | Texto preservado |
| Comando, sem argumento | `The module returns the literal "$1".` | `The module returns the literal "".` |
| Comando, sem argumento | `The module returns the literal "$ARGUMENTS".` | `The module returns the literal "".` |
| Comando, valor monetário | `The documented threshold is $100.` | `The documented threshold is .` |
| Comando, caminho | `The source path is src/cost$1.ts.` | `The source path is src/cost.ts.` |
| Comando, argumento `review` | `The module returns the literal "$1".` | `The module returns the literal "review".` |
| Comando sem dólar, controle | Texto simples | Texto preservado |
| Ferramenta com caminho, controle | `src/cost$1.ts` | Caminho preservado |
| Comando ordinário, controle | `Review $1: $ARGUMENTS`, argumento `sample` | `Review sample: sample`, como desejado |

Cada caso foi executado em duas fixtures/processos independentes. Cinco casos Own exibem alteração indevida; quatro controles permanecem corretos. Os coletores dão 9 pass/0 fail porque caracterizam o comportamento atual, inclusive o defeito. **Não são nove critérios de aceitação atendidos.**

A revisão adversarial confirmou ainda que, no caso de caminho `src/cost$1.ts`, a interpolação alcança o receipt textual entregue ao provedor: a chave `sourceBlobs` aparece como `src/cost.ts`, enquanto o artefato verificado em disco permanece `src/cost$1.ts`. A transformação portanto afeta também metadados de proveniência presentes na mensagem consumida.

### Causa e limite

[own-artifact.ts, linhas 105–162](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/retrieval/src/own-artifact.ts#L105-L162) escreve claims e paths literalmente e produz o receipt. [Command, linhas 134–151](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/command/index.ts#L134-L151) transforma toda skill em template. [SessionPrompt, linhas 1400–1422](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/prompt.ts#L1400-L1422) aplica interpolação no template inteiro, sem distinguir o corpo factual de Own. `hints: []` não é consultado como uma proibição de interpolar.

O resultado atravessa SessionPrompt e a serialização original até um servidor de teste HTTP; não foi lançada a CLI/UI nem a rota HTTP pública do aplicativo nesta rodada. As respostas do provedor são programadas, sem inferência. SessionSummary é neutralizado explicitamente para evitar chamadas extras. SQLite usa o preload original em memória; não há prova de recuperação da mesma sessão após reiniciar. Permissões da fixture são permitidas, portanto não se testa autorização. Nenhum template de execução shell foi usado. As frases são **dados sintéticos de um snapshot revisado de teste**; READY aqui não é prova da verdade semântica dessas frases nem de sua geração por Genesis.

### Encaminhamento

Preservar o conteúdo factual como dados, distinguindo-o de comandos intencionalmente parametrizados. Um verificador chamado antes da transformação não garante o texto depois dela. Manter a parametrização de comandos ordinários; não corrigir isso removendo indiscriminadamente a funcionalidade ou alterando o receipt para encobrir a diferença. É independente de #36: aqui a fonte não está stale.

## 2. SkillV2: fonte ativa B, conteúdo servido A

[Coletor Core original em a360219b](https://github.com/gmhelmold/HuGR-Orchestra/blob/a360219b7f3b8d317c6bf24712f6ac88103f27e1/docs/audits/2026-09-17-atlas-maestro/host-literal-runtime/probes/audit-skill-replacement.test.ts) — [execução 1](evidence/v2-replacement-1.json) — [execução 2](evidence/v2-replacement-2.json).

O teste usa `State`, `SkillV2`, registro de ferramentas, serialização da ferramenta e arquivos reais. A composição usa `PermissionV2.assert` permitindo o experimento e `ToolOutputStore.nodeWithoutConfig`, variante original com limites padrão e sem a dependência de configuração. O primeiro é um mock funcional; o segundo é uma adaptação explícita de composição. Não serve como prova de autorização ou de configuração de produção. A ferramenta é executada pelo registro original, não por uma cópia da implementação.

| Ciclo de substituição | Fonte/conteúdo novo | `list()` e ferramenta depois de reload |
|---|---|---|
| Embedded A carregado, dispose, B com mesmo nome | B | **A** |
| Embedded A sem leitura, dispose, B com mesmo nome | B | B, controle |
| Embedded A carregado, dispose, B com outro nome | B | B, controle |
| Diretório lido, dispose, arquivo alterado, mesma fonte registrada novamente | Arquivo B | **A** |
| Mesmo ciclo, fonte em novo diretório | Arquivo B | B, controle |

Nos cinco casos, a listagem ficou vazia imediatamente após dispose: a remoção funciona. No caso embedded decisivo, `sources()` contém de fato B, mas `list()` e a ferramenta retornam A. As duas execuções deram os mesmos resultados semânticos; os JSONs brutos diferem nos diretórios temporários gerados por cada fixture. Não se confundiu a rejeição de duas fontes simultâneas de mesmo nome com substituição: a inscrição A é removida antes de registrar B.

[SkillV2, linhas 109–124](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/skill.ts#L109-L124) mantém o cache fora do estado recomposto e consulta-o pela chave antes de carregar a fonte atual. [Source.key](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/schema/src/skill.ts#L40-L53) usa apenas nome para embedded e caminho para diretório. [State](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/state.ts#L78-L125) refaz as fontes corretamente, mas não possui autoridade sobre esse cache externo. A [ponte do host de plugins](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/plugin/host.ts#L208-L216) expõe essas operações.

**Exposição comprovada:** serviço exportado e ferramenta registrada. Não houve troca de plugin pela UI nem sessão Core V2 até um provedor. O caso embedded independe de decidir a política de filesystem watcher; o caso de diretório corrobora a falta de invalidação, mas a promessa exata de reload versus watcher deve ser documentada. Não foi demonstrada mistura entre projetos/worktrees.

## Verificações e evidência

- `bun run typecheck` em Atlas, Core e OpenCode: exit 0, com os novos probes presentes no checkout durante os typechecks de Core/OpenCode.
- Baseline original Core: **12 pass, 4 arquivos**.
- Baseline original Maestro/skills: **51 pass, 9 arquivos**.
- Total do baseline selecionado: **63 testes existentes, 13 arquivos**; não é suíte completa.
- Dois conjuntos de **9 casos host + 5 casos V2**, 28 execuções de caracterização ao todo. As observações não constituem correções.
- Leituras posteriores inspecionaram as linhas factuais nas mensagens capturadas e os registros ativos/listados/recarregados, não somente os campos booleanos dos coletores.
- [source-integrity.json](evidence/source-integrity.json): nenhum diff rastreado de produção; **819 JS em `packages/*/dist/**/*.js`** comparados com doador limpo da mesma revisão, todos iguais. O universo inclui testes compilados; não é contagem de módulos src nem de arquivos revisados.

Uma tentativa de criar checker separado foi bloqueada antes de executar; o arquivo está ausente. Não há nesta rodada checker independente executado, exit 1, nem autoteste de checker. A observação é sustentada pelas execuções dos componentes originais, controles, assertions de caracterização e releitura dos payloads. Os rascunhos isolados anteriores não foram contados como novas execuções.

## Ambiente, reprodução e escopo pendente

Veja [REPRODUCING.md](REPRODUCING.md), [COVERAGE.md](COVERAGE.md), [JOURNAL.md](JOURNAL.md) e [ambiente](evidence/environment.json). macOS x64, Node 22.17.1, Bun 1.3.14. Checkout descartável; 38 links para dependências já instaladas. Não é instalação hermética. HOME/XDG e identidade Git de fixtures foram isolados; não se usaram credenciais de modelo ou dados pessoais em testes. As capturas publicadas são mensagens sintéticas sem headers de autenticação. Os JSONs brutos preservam caminhos descartáveis sob `/private/tmp/opencode-*`; eles diferem entre execuções e não foram normalizados. A revisão adversarial não encontrou caminhos de HOME pessoal nem credenciais reais nesses artefatos.

O WP-HOST-01 permanece aberto: UI/CLI completa, sessão Core V2 configurada até o provedor, duplicatas e identidade de Own entre worktrees, recibos ausentes/não canônicos no consumidor e retomada da mesma sessão persistida ainda exigem suas próprias provas. Não habilitar a apresentação pública de aprovação para contornar essas lacunas. As cinco passagens globais do repositório continuam abertas; estas são revisões focadas, não leituras integrais do monorepo.

## Issues canônicas

[#83 — fidelidade literal](https://github.com/gmhelmold/HuGR-Orchestra/issues/83) e [#84 — substituição de fonte V2](https://github.com/gmhelmold/HuGR-Orchestra/issues/84). Ambas continuam abertas; a [revisão posterior](review/REVIEW.md) confirma os achados e corrige a instrumentação/documentação.

# Atlas / Maestro — aprofundamento, rodada 2

Base verificada: b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7.
Fonte: clone isolado limpo, confrontado com ref remota da feature branch.
Não modificar a árvore de trabalho principal do usuário; não executar chamadas LLM pagas.

## Passagem 1 — reconciliação e escopo
GitHub contém issues #15–#31. Evitar duplicações; provas antigas são contexto, não execução desta rodada.
PR #14 é documentação em rascunho; descrição está defasada (afirma Issues desativadas).
Foco adicional: liveness/transações do Maestro, persistência de memória e consumo real de Own.

## Passagem 2 — rastreamento inicial
recordAdmission / presentApproval: leitura anterior seguida de publicação com ID determinístico. Concorrência requer prova, não inferência.
recordApproval: monta conversa a partir de timestamps; valida todas as apresentações históricas. Examinar interação com poda legítima de tool outputs.
TaskTool: aprovação consumida antes de criar a filha; examinar falha recuperável e resultado do subagente.

## Passagem 3 — execução e controles
Typecheck original passou. Suíte original focada: 17 arquivos / 158 testes passaram.
Probes originais via composeRuntime + scanner gitleaks real reproduzem: append depois de cauda sem LF perde registro novo; cap de memória conta replay/histórico; logbook ignora validator de seções. Adapter durável de Orientation perde recorrência de rótulo (producer automático não localizado; read está conectado).
Own: três processos/interleavings controlados (A e B em dois subprocessos) deixam snapshot antigo e skills B após B retornar sucesso e A fazer rollback. Não é teste de crash.

## Hipóteses descartadas ou não confirmadas
Compactação marca time.compacted sem apagar output do storage: não sustenta perda de prova de apresentação.
Maestro concorrência natural: três rodadas x oito chamadas idênticas para admission e mais três x oito para presentation: todas concluíram. Não abrir issue a partir de leitura-before-write isolada.
TaskTool trata explicitamente assistant.error e erro de tool retornada; não afirmar que engole esses erros.

## Passagem 4 — consumo e rechecagem independente
O materializador CLI original produziu uma skill Own ancorada a um commit/blob real de fixture. A fonte foi alterada: o verificador retorna HOLD e o host SkillTool continua servindo a afirmação velha, tanto cold quanto warm. Controle fresh passa. Dois cenários negativos falham na expectativa desejada.
Suíte original do host: 51 testes / 9 arquivos, incluindo Maestro e skills, passou.
Issues novas criadas: #32 (cauda JSONL), #33 (cap histórico/replay), #34 (validator logbook), #35 (rollback concorrente), #36 (consumo Own), #37 (recorrência Orientation).

## Passagem 5 — auditoria da própria evidência
Rebuild forçado original concluído (tsc -b --force). Probes de memória e Own repetidos com scripts portáveis; resultados conservam as falhas e os controles. Suíte original de memória repetida após rebuild: mesmos 158 testes aprovados. Host Own repetido após rebuild.
Nenhuma alegação de cinco leituras completas de todo o monorepo; SOURCES.md separa leitura integral/focal de execução e contexto anterior. Nenhuma feature corrigida nesta rodada. Não promover o defeito do adapter Orientation a incidente de um produtor automático que não foi localizado. Não chamar o teste interno do host de jornada governada ponta a ponta.

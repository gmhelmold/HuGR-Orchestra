# Auditoria progressiva Atlas / Maestro — 17 de setembro de 2026

Produto examinado: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`. Esta branch e o PR #14 são documentais: não corrigem código de produção, não fecham os achados e não autorizam merge.

## Estado atual

A publicação no GitHub está disponível e foi executada. Os avisos iniciais de Issues desabilitadas e ausência de execução do produto são **históricos**; não devem ser usados como estado atual da auditoria. O registro original foi preservado em [HISTORICAL-INITIAL.md](HISTORICAL-INITIAL.md), com seus limites e suas prioridades daquela fase.

| Leitura | Conteúdo e força de evidência |
|---|---|
| [Host: Own até o request do provedor](host-consumption/README.md) | WP-HOST-01 executado parcialmente: 12 cenários de contexto e 2 de rotas, duas execuções independentes; reforça #36 sem duplicá-la. Cinco controles passam e seis propriedades de atualidade falham em cada conjunto. |
| [Genesis: workers e publicação parcial](genesis-workers/README.md) | Rodada Genesis anterior: três novos defeitos, dois conjuntos independentes de experimentos, CLI compilado no caso de seleção de braços, workers reais, armazenamento real e injeções de falha explicitamente delimitadas. |
| [Provas de runtime anteriores](runtime-proof/README.md) | Evidências originais publicadas em `14e74743d02a97bc577e1dffb6cb04d213c57569`; consultar o relatório para comandos, controles e limites. Não são uma nova execução da rodada Genesis. |
| [Primeira publicação, histórica](HISTORICAL-INITIAL.md) | Nove cartões iniciais, parte com isolamento/modelo comportamental. As issues e os relatórios posteriores prevalecem sobre os limites já superados. |
| [Registro inicial de experimentos](EVIDENCE.md) | Evidência histórica da primeira fase; não representa a soma de todas as rodadas. |

## Issues da rodada Genesis anterior

| Issue | Achado | Prova executada |
|---|---|---|
| [#65](https://github.com/gmhelmold/HuGR-Orchestra/issues/65) | Workers perdem a seleção explícita do braço; o modo padrão envia somente prompts advisory, mas reporta três templates. | CLI compilado original, quatro cenários por conjunto, dois conjuntos independentes e captura real de stdin do comando substituto sem inferência. |
| [#66](https://github.com/gmhelmold/HuGR-Orchestra/issues/66) | A espera síncrona do pool impede a observação da morte de um worker. | Pool e workers originais, perda de startup injetada, controles saudável/fechado e supervisor externo com limite explícito; repetido duas vezes. |
| [#67](https://github.com/gmhelmold/HuGR-Orchestra/issues/67) | Falha na segunda publicação zera o relatório e o checkpoint, embora a primeira gravação continue persistida. | Driver, gate e store originais; proposer sintético e falha no segundo commit explicitamente injetados; reabertura independente; duas execuções. |

As três foram publicadas e relidas após a escrita. Todas permanecem abertas. Cada uma contém escopo, causas, contraevidências, links imutáveis, success criteria, completeness criteria, quality standards, definition of done e invariants. P2 é prioridade de engenharia, não avaliação de segurança.

## Encaminhamento dos nove cartões iniciais

Os cartões em `issues/` permanecem como evidência histórica; os registros ativos estão nas issues abaixo. Uma hipótese que ganhou prova posterior não deve continuar sendo apresentada como apenas estática, e uma prova isolada não deve ser generalizada para uma jornada inteira.

| Cartão inicial | Registro ativo |
|---|---|
| ATL-001 — abstenções descartadas pelo upsert | [#15](https://github.com/gmhelmold/HuGR-Orchestra/issues/15) |
| ATL-002 — hits antes da entrega final | [#16](https://github.com/gmhelmold/HuGR-Orchestra/issues/16) |
| ATL-003 — contested constante | [#30](https://github.com/gmhelmold/HuGR-Orchestra/issues/30) |
| OWN-001 — drill sem destino | [#23](https://github.com/gmhelmold/HuGR-Orchestra/issues/23) |
| OWN-002 — predicate malformado | [#24](https://github.com/gmhelmold/HuGR-Orchestra/issues/24) |
| OWN-003 — freshness dos gotchas | [#22](https://github.com/gmhelmold/HuGR-Orchestra/issues/22) |
| OWN-004 — autoridade de COMPLETE | [#29](https://github.com/gmhelmold/HuGR-Orchestra/issues/29) |
| OWN-005 — orçamento final de Own | [#28](https://github.com/gmhelmold/HuGR-Orchestra/issues/28) |
| MAE-001 — reapresentação de aprovação | [#25](https://github.com/gmhelmold/HuGR-Orchestra/issues/25) |

## Verificação executada na rodada Genesis

Instalação Atlas pelo lockfile e `bun run typecheck` concluíram com exit 0. Passaram **264 testes Genesis em 32 arquivos**, **24 testes CLI selecionados em 6 arquivos** e **32 testes Maestro em 7 arquivos**: **320 testes existentes em 45 arquivos**, sem falhas nessas execuções. Logs e identidade das fontes estão no relatório da rodada.

As verificações explícitas das propriedades desejadas sobre as observações capturadas reportam **6 controles passando e 4 violações em cada conjunto**: seleção de braços, término após perda de worker e duas formas de falha de publicação. O verificador dessas propriedades sai com código 1. Isso é evidência de defeitos ainda presentes, não correções ou uma suíte de produto toda verde.

Não houve inferência de LLM nem uso da configuração real de modelo do usuário nos diagnósticos. O índice SCIP é uma fixture controlada, não uma execução do indexador externo. A suíte interna do Maestro não prova disponibilidade da apresentação pública de aprovação, que continua deliberadamente bloqueada até suas dependências de autoridade existirem.

## Continuidade atual

O [WP-HOST-01](host-consumption/README.md) confirma contexto Own desatualizado chegando ao provedor local por ferramenta, comando e rota pública de sessão. Há controles positivos e distinção executada entre /agent e /api/agent. Não houve inferência real, correção ou merge. O [norte](CONTINUIDADE.md) permanece com cobertura explicitamente parcial.

## Cobertura e limites

A rodada documenta cinco iterações focadas na cadeia de execução investigada. **Isso não satisfaz cinco leituras semânticas completas, arquivo por arquivo, de todo o monorepo.** Nenhuma contagem de chamadas, arquivos ou testes é usada para inventar essa cobertura. Um comando de triagem ampla foi bloqueado e não executado; não contribui para a cobertura.

Antes de fechar cada issue, a correção deve passar sua regressão da propriedade desejada no caminho pertinente. Saída reproduzível, hashes íntegros e testes internos isolados não provam automaticamente validade semântica, completude ou integração ponta a ponta.

## Continuidade: literais e substituição de fontes

[Runtime original — fidelidade literal e cache V2](host-literal-runtime/README.md): dois conjuntos independentes de nove cenários host e cinco cenários V2. A fonte Own continua READY, mas comandos podem alterar literais antes do provedor; fontes V2 substituídas podem continuar servindo bytes antigos. Baseline selecionado: 63 testes existentes passando; nenhuma correção de produção ou encerramento da auditoria global. Consulte os limites e controles no relatório, inclusive a ausência de execução de um checker separado.

## Revisão da última publicação

[Revisão de a360219b](host-literal-runtime/review/REVIEW.md): 38 arquivos e issues [#83](https://github.com/gmhelmold/HuGR-Orchestra/issues/83)/[#84](https://github.com/gmhelmold/HuGR-Orchestra/issues/84). Ambos os achados confirmados; documentação e probes corrigidos. Modo desired: 5 falhas Own e 2 V2; baseline selecionado de 63 testes e três typechecks passam. Resultados antigos preservados, sem correção de produção.


## Rodada adicional — identidade de Own e binding de execução do Maestro

Duas novas fronteiras foram reproduzidas duas vezes no runtime original, em fixtures novas, sem alteração de código de produção:

| Evidência | Issue | Resultado |
|---|---|---|
| [Namespace canônico de Own](own-namespace-runtime/README.md) | [#85](https://github.com/gmhelmold/HuGR-Orchestra/issues/85) | Um `.claude` skill não canônico declarando `own_c3Jj` é resolvido e servido pelo SkillTool como `Loaded skill: own_c3Jj`. Duplicidade não gera HOLD. |
| [Binding foreground/background](maestro-background-binding/README.md) | [#86](https://github.com/gmhelmold/HuGR-Orchestra/issues/86) | O lifecycle governado aceita `background:true` usando o mesmo taskHash/aprovação do caso foreground, pois o modo não participa do intent/hash. |

Os dois resultados foram cruzados por código-fonte e execução. #85 é distinto de freshness (#36) e transformação pós-verificação (#83). #86 é latente em relação à entrada pública de apresentação, que continua corretamente bloqueada até existirem leitores duráveis de plano e validação.


## Aprofundamento do #24 — shapes das famílias GroundedFact

[Validação das famílias complexas de gotcha](own-snapshot-family-shapes/README.md): usando o snapshot real como controle, `relation`, `negation`, `transition` e `test-vacuity` contendo apenas `id/kind/tier/freshness` foram aceitos por parser/exporter, materializados com claim vazio e certificados `READY`. O probe passou 4/4 em duas execuções; a suíte original `own-snapshot.test.ts` passou 20/20. O resultado amplia a prova da issue [#24](https://github.com/gmhelmold/HuGR-Orchestra/issues/24), sem duplicá-la.

## Revisão adversarial do head atual

[Self-review consolidado](self-review-current/README.md): revisa a cadeia `a360219b..eca0aa8`, corrige duas imprecisões documentais, reforça #86 com retorno `background/running`, reforça #24 com blobs Git reais e reexecuta #85. Nenhuma mudança de produção; as issues permanecem abertas.

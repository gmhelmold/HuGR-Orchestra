# Continuidade da auditoria — integração real Atlas / Own / Maestro

Data: 2026-09-17. Produto de referência: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`, branch `maestro/rebuild-fork-dev-clean`.

**Estado deste documento:** norte e registro de continuidade. A versão original em `8ff7f8c93f178edf6c18892bab1be68833ede4b2` foi somente documental. A execução posterior está em [host-consumption/README.md](host-consumption/README.md): duas execuções independentes, com captura do contexto recebido pelo provedor local e controles de rotas. O WP permanece parcial; não houve correção, fechamento de issue ou merge. Os cinco axiomas abaixo continuam vigentes.

## Decisão: seguir do mecanismo isolado até o consumidor real

O próximo bloco é rastrear e testar o que uma sessão realmente seleciona e recebe: runtime escolhido pelo entrypoint, identidade do agente, registro das ferramentas, artefato Own carregado, validação aplicada e conteúdo entregue à montagem de contexto. A prioridade é a fronteira host/Own/Maestro, incluindo a distinção entre legado e V2.

Não é necessário um novo framework de auditoria. Usar os testes, materializadores, serviços e registros de evidências existentes. Resultados novos complementam a issue correspondente; abrir outra issue somente quando houver causa ou obrigação independente, após deduplicação.

## Índice das sete linhas documentais localizadas

As descrições abaixo foram reconciliadas com os metadados dos PRs abertos. Elas identificam ONDE consultar as evidências; não afirmam reexecução ou nova validação de cada arquivo dessas publicações. Os PRs são pontos de navegação mutáveis; resultados devem citar também o commit imutável de cada rodada.

| PR | Linha de investigação / encaminhamento |
|---|---|
| [#14](https://github.com/gmhelmold/HuGR-Orchestra/pull/14) | Publicação inicial, runtime-proof e Genesis workers/publicação parcial. README relido no commit `db1e7505d01ea411df0eaa3d879c9b3c6bee7baa`; a rodada Genesis referencia #65, #66 e #67. |
| [#43](https://github.com/gmhelmold/HuGR-Orchestra/pull/43) | Memory/Orientation, publicação concorrente de Own e consumo stale no host; #32–#37. Commit documental informado: `b73959b4077ccedb0bf5826682f4af85d51c99c4`. |
| [#44](https://github.com/gmhelmold/HuGR-Orchestra/pull/44) | Lifecycle, diagnóstico de memória parcial, concorrência de logbook e continuidade Task; #39–#42 e confirmação de achados anteriores. #38 foi registrado como duplicata de #32 nessa rodada. |
| [#52](https://github.com/gmhelmold/HuGR-Orchestra/pull/52) | Identidades do grafo, alcance, completude e resultado durável do despacho; #45–#49. Commit documental informado: `862c95d819f6861730bb6ac44a4b113eb90fd9fa`. |
| [#53](https://github.com/gmhelmold/HuGR-Orchestra/pull/53) | Ownership conforme política e proveniência/freshness do Role; #50–#51. Confirmações independentes de #45–#48 não são descobertas novas. Commit informado: `fd71fc85189080fe25d80a2e95a3a4a0d2babd42`. |
| [#63](https://github.com/gmhelmold/HuGR-Orchestra/pull/63) | Awareness, teto de injeção e origem de admissão Maestro; #56, #58 e #62. COVERAGE.md relido em `00fd9f191608d01d8beeab337322ec78ec03b034`. |
| [#64](https://github.com/gmhelmold/HuGR-Orchestra/pull/64) | Reconcile, reground, retirement, população de reverify e diagnóstico CAS; #55, #57, #59–#61. Head documental observado: `e049c7c993c929a00b74e78fb32ec5344bb25b03`. |

Não somar testes sobrepostos dessas rodadas como testes únicos. Não confundir um coletor que reproduz o comportamento observado com uma regressão que comprova a propriedade desejada. Não promover leitura dos metadados de PR a revisão integral do diff.

## Observação de fonte que justifica o próximo bloco

No produto fixado, estas fontes foram efetivamente relidas nesta continuidade:

| Fonte | Leitura | Observação limitada |
|---|---|---|
| [AGENTS.md](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/AGENTS.md) | Integral | Distingue admissão durável, execução, histórico e contexto V2; orienta testes nos diretórios dos pacotes. |
| [packages/opencode/src/agent/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/agent/agent.ts#L1-L215) | Linhas 1–215 | O registro legado declara `maestro`, `native: true`, com `PROMPT_MAESTRO`. |
| [packages/core/src/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/agent.ts) | Integral | O serviço AgentV2 inicia um mapa vazio, oferece transformações e resolve IDs a partir do estado produzido. |
| [packages/core/src/plugin/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/plugin/agent.ts) | Integral | Esse plugin registra build, plan, general, explore, compaction, title e summary; não registra Maestro em seu próprio corpo. |

**Isso ainda NÃO prova indisponibilidade global do Maestro no V2.** Configuração, plugins adicionais, adaptadores ou seleção do entrypoint podem estabelecer outro caminho. É necessário seguir bootstrap, produtores de configuração e consumidores antes de classificar a diferença como defeito, capacidade intencionalmente indisponível ou comportamento configurável. Nenhuma issue nova foi aberta apenas por essa diferença textual.

Pergunta a responder: **a sessão efetivamente utilizada consome o mesmo agente, ferramentas e validações que as provas anteriores exercitaram?**

## WP-HOST-01 — mapa e prova do consumo real

**Estado:** executado parcialmente; [provas e limites](host-consumption/README.md). Foram exercitados 12 cenários de contexto e 2 de rotas em duas execuções, com 68 testes originais selecionados passando. A #36 ganhou prova até o provedor local. Permanecem pendentes UI/CLI completa, sessão Core V2 configurada até o provedor, troca de projeto/worktree, duplicatas/recibos inválidos e reinício da mesma sessão persistida. Nenhuma correção foi aplicada.

### Trabalho

1. Rastrear da entrada pública até a montagem de contexto: seleção de backend/runtime em CLI e clientes, carregamento de configuração/plugins, resolução de agente, registro de ferramentas e execução da skill. Comparar legado e V2 sem presumir paridade obrigatória.
2. Identificar todos os caminhos de consumo de Own, incluindo tool, menções e qualquer carregamento direto efetivamente encontrado. Registrar caminhos pesquisados e trechos lidos; não inventar entrypoints por analogia.
3. Usar materializador original, Git real e serviços originais em fixtures descartáveis. Capturar o conteúdo que chega à fronteira de montagem/envio ao modelo, não apenas o retorno isolado de uma função de carregamento. Um endpoint/provider local sem inferência pode capturar essa fronteira; isso não prova interpretação ou comportamento de um LLM real.
4. Comparar fonte/artefato válido com fonte alterada, incluindo alteração sem commit; execução fria, reutilização da mesma instância e reabertura. Acrescentar troca de worktree/projeto, fonte ausente, identidade não canônica e duplicidade conforme os caminhos forem confirmados.
5. Confrontar cada observação com #36 e as demais issues pertinentes. Acrescentar evidência à causa já registrada; criar um registro independente apenas quando a distinção estiver demonstrada. Preservar controles que refutem hipóteses.

### Success criteria

Cada entrypoint examinado tem caminho de seleção e consumo identificável. É possível dizer, com evidência do limite realmente exercitado, qual agente/prompt, ferramenta e conteúdo Own foram usados. As variantes válida e stale têm resultados explícitos; uma diferença de runtime não é rotulada como bug sem contrato e caminho de consumo. O resultado pode ser uma falha reproduzida e documentada: sucesso da auditoria não exige fingir que o produto passou.

### Completeness criteria

Cobrir escolha do runtime; registro nativo e configuração de agente; ferramentas; tool versus outras entradas de skills encontradas; conteúdo completo na montagem de contexto; identidade e fonte do Own; frio/quente/restart; edição dirty e commit; fonte removida; troca de projeto/worktree; duplicatas; e distinção entre operação normal e governada. Registrar separadamente qualquer item não executado e a razão concreta. O mapa começa nos entrypoints públicos encontrados, não termina num helper sem consumidor provado.

### Quality standards

Código original e revisão fixa; nenhuma transcrição do algoritmo como única prova. Reutilizar helpers de teste existentes, Git/arquivos/serviços originais e controles positivos/negativos. Executar os cenários decisivos em duas fixtures independentes, registrando versões, comandos, exit codes, identificadores, hashes e fronteira de substituição. Separar falha de setup, leitura estática, resultado interno, transporte e comportamento do modelo. Não usar configuração real de inferência nem dados privados em fixtures publicadas.

### Definition of done

Publicar uma matriz `entrypoint -> runtime -> agent -> tool -> validação -> conteúdo consumido`, com fonte ou experimento para cada seta e lacunas nomeadas. Publicar scripts e resultados reproduzíveis, vincular cada defeito à issue canônica, registrar hipóteses refutadas, verificar os links e reler a publicação depois de escrever. Nenhuma cobertura ou passagem integral é declarada a partir de contagens de arquivos/testes. Nenhuma issue é fechada sem uma correção e a respectiva prova posterior, fora deste WP de auditoria.

### Invariants

Os bytes validados precisam ser os bytes consumidos sob a mesma visão de fontes. `CURRENT/FRESH` não significa verdade semântica nem cobertura completa. Nome de agente ou de skill não prova identidade do produtor. Um prompt não substitui um verificador. Não ativar a apresentação pública de aprovação deliberadamente bloqueada nem afrouxar suas dependências para fazer o cenário passar. Não apagar história, mudar código de produção, alterar configurações do usuário ou misturar dados entre worktrees como parte deste diagnóstico.

## Próximas fronteiras após WP-HOST-01

A ordem abaixo é uma prioridade de investigação, não uma declaração de dependências já provadas entre correções.

- **Coerência de snapshot:** fonte, índice, grounding, projeção e receipt precisam descrever a mesma visão. Reutilizar #17, #18, #21 e #27. Adicionar uma fixture produzida por indexador real, com versão e inputs fixados; não chamar o SCIP controlado das rodadas anteriores de indexação externa executada.
- **Persistência e falha parcial:** confrontar reconhecimento da operação com leitura após reabrir, preservação de evidências e recuperação. Encaminhamentos existentes incluem #15, #19, #32, #35, #39 e #67.
- **Contexto e continuidade:** retomar orçamento final, completude, proveniência e entrega (#16, #22, #28, #29, #48, #50, #51), além de apresentação/consumo/resultado do despacho (#25, #49, #62), preservando o bloqueio público até existirem as autoridades duráveis necessárias.

## Obrigação global de cobertura permanece aberta

O pedido original exige no mínimo cinco iterações sobre todo o repositório. As rodadas focadas existentes não são cinco leituras semânticas integrais. Este documento não reduz nem declara cumprida essa obrigação.

Consolidar o inventário por revisão e tipo de entrada (arquivo regular, symlink, gitlink, gerado/binário). Para cada caminho e cada passagem, registrar: inventariado, leitura parcial com faixa, leitura integral, relação produtor/consumidor verificada, teste executado e contraevidência. Esses estados não são intercambiáveis. Diferenças nas contagens dos inventários anteriores precisam ser explicadas pelo universo contado, não apagadas com um total arbitrário.

As cinco passagens globais devem distinguir topologia, contratos, implementação/caminhos de consumo, evidência de comportamento e rechecagem adversarial. Cada uma precisa explicitar o que revisitou e o que permanece sem leitura. Não renomear cinco testes ou cinco lentes de um subconjunto como cinco passagens completas do monorepo. WP-HOST-01 aprofunda uma fronteira importante e deve alimentar esse registro; não encerra a auditoria global.

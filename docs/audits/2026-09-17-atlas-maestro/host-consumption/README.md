# WP-HOST-01 — Own até o contexto consumido pelo Maestro

Data: 2026-09-17. Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Norte: [CONTINUIDADE.md em 8ff7f8c](https://github.com/gmhelmold/HuGR-Orchestra/blob/8ff7f8c93f178edf6c18892bab1be68833ede4b2/docs/audits/2026-09-17-atlas-maestro/CONTINUIDADE.md).

**Estado: avanço executado e revisto, com cobertura parcial do WP.** Nenhuma alteração de produção, habilitação de aprovação, correção, fechamento de issue ou merge. A issue canônica é [#36](https://github.com/gmhelmold/HuGR-Orchestra/issues/36); nenhum registro duplicado foi aberto.

## Norte e força de evidência

A pergunta é `entrada -> runtime -> agente -> ferramentas -> validação Own -> contexto consumido`. Esta rodada ultrapassa o retorno isolado da skill: atravessa a sessão original e captura a requisição recebida por um provedor HTTP local com respostas programadas. As provas anteriores da #36 não são recontadas como novas execuções.

Consultar [REPRODUCING.md](REPRODUCING.md), [RESULTS.json](RESULTS.json), [JOURNAL.md](JOURNAL.md) e [COVERAGE.md](COVERAGE.md). Os coletores confirmam observações, inclusive defeitos; o verificador independente avalia as propriedades desejadas.

## A lacuna chega ao provedor

O materializador original produz uma skill Own com revisão e blobs de Git real. O verificador original confirma READY. Após alterar ou remover `src/a.ts`, ele retorna HOLD, mas o host ainda entrega a afirmação antiga como conteúdo carregado, inclusive pela rota pública de sessão em processo.

**O HOLD vem do diagnóstico independente; não é um HOLD retornado pelo host e depois ignorado.** A lacuna é a ausência da verificação Own na composição consumidora. A mensagem entregue não contém aviso específico de fonte desatualizada. A instrução geral de Maestro sobre HOLD não equivale a um veredito dessa fonte.

| Cenário, repetido duas vezes | Verificador | Requests | Afirmação antiga entregue |
|---|---|---:|---|
| Own válido via ferramenta | READY | 2 | Sim; controle |
| Edição dirty antes do primeiro carregamento | HOLD | 2 | Sim; violação |
| Edição após primar o cache de skills | HOLD | 2 | Sim; violação |
| Edição com novo commit | HOLD | 2 | Sim; violação |
| Fonte removida | HOLD | 2 | Sim; violação |
| Own válido via comando de barra | READY | 1 | Sim; controle |
| Own dirty via comando de barra | HOLD | 1 | Sim; violação |
| Skill inexistente | Own-controle READY | 2 | Não; erro de nome inexistente |
| Skill ordinária, não Own | Own-controle READY | 2 | Não; conteúdo ordinário correto |
| HTTP de sessão, Own válido | READY | 2 | Sim; controle, HTTP 200 |
| HTTP de sessão, Own dirty | HOLD | 2 | Sim; violação, HTTP 200 |
| Carregamento válido, edição e continuação sem nova ferramenta | HOLD após edição | 3 | Sim; histórico retido, observado à parte |

Provas: [execução 1](evidence/context-first.json), [execução 2](evidence/context-second.json) e [coletor executado](probes/audit-host-context.test.ts). São afirmações sintéticas sobre fonte controlada, não um incidente observado nos dados do usuário.

O caso histórico não é um sétimo defeito. Preservar um resultado antigo não é carregar novamente um artefato como atual. A futura política de freshness/epochs deve distinguir histórico de estado atual; o experimento não justifica apagar história ou reescrever evidência antiga.

## Comando de barra: outro consumidor

[Command](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/command/index.ts#L134-L151) transforma skills em templates. [SessionPrompt.command](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/prompt.ts#L1384-L1509) resolve o template e chama prompt. A skill chega como mensagem de usuário em um request, sem atravessar SkillTool.

Portanto, corrigir somente `tool/skill.ts` não estabelece a garantia em todos os caminhos observados. A correção precisa de uma fronteira Own compartilhada ou de provas explícitas em cada consumidor, mantendo skills ordinárias compatíveis. Isso complementa a #36; não demonstra uma falha de autorização.

## Legado e V2: resultado e contraevidência

| Configuração da fixture | GET /agent | GET /api/agent |
|---|---|---|
| Sem agente personalizado | 200; Maestro nativo presente | 200; Maestro ausente dos padrões |
| Maestro explicitamente configurado | 200; Maestro presente | 200; Maestro presente com o texto configurado |

Provas: [rotas 1](evidence/routes-first.json), [rotas 2](evidence/routes-second.json), [coletor](probes/audit-host-routes.test.ts). O controle configurado refuta indisponibilidade global de Maestro em V2. Não prova sessão governada V2 nem paridade das ferramentas. Nenhuma issue foi criada apenas por essa diferença.

O nome `@opencode-ai/sdk/v2` não identifica sozinho o runtime Core V2: [app.agents](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/sdk/js/src/v2/gen/sdk.gen.ts#L562-L583) usa `/agent`, e [session.prompt](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/sdk/js/src/v2/gen/sdk.gen.ts#L3762-L3795) usa `/session/{sessionID}/message`. [Core V2 /api/agent](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/protocol/src/groups/agent.ts) tem outro consumidor.

## Matriz do caminho verificado

| Ligação | Evidência e limite |
|---|---|
| serve / worker TUI -> Server | Fontes `cli/cmd/serve.ts` e `cli/tui/worker.ts`; UI/CLI completa não lançada. |
| /agent -> Agent legado | Roteador executado; `handlers/instance.ts` usa Agent.Service. Prompt Maestro observado nos requests de contexto. |
| /api/agent -> AgentV2 | Roteador executado; handler em packages/server usa AgentV2.Service. Configuração explícita funciona. |
| /session/:id/message -> SessionPrompt | Fresh/dirty executados pelo roteador público. `handlers/session.ts:295–308` chama o serviço original. |
| SessionPrompt -> registro -> SkillTool | Serviços originais; nome solicitado pelo provedor programado; saída chega ao HTTP do provedor seguinte. |
| SkillTool -> conteúdo | Skill.require entrega texto carregado; verificação Own ocorreu apenas no diagnóstico independente. |
| Skill -> Command -> SessionPrompt | Fonte rastreada e comando executado; conteúdo direto observado como mensagem de usuário. |
| Histórico -> request seguinte | MessageV2 preserva saída não compactada; terceiro request observado após edição, sem nova ferramenta. |
| Preparação -> provedor | LLMRequestPrep inclui agent.prompt; serialização AI SDK original chega ao TestLLMServer por HTTP local. |

Trechos exatos e hashes: [COVERAGE.md](COVERAGE.md). A captura prova conteúdo recebido pelo endpoint local, não sua interpretação por um LLM real nem uma execução governada.

## Verificação executada

Atlas `bun run typecheck` terminou com 0 e gerou os módulos usados pelo materializador. Baselines originais: **49 testes legado/Maestro/skill em 8 arquivos e 19 Core V2 em 5 arquivos, 68 testes sem falhas**. Não é full-suite monorepo; nenhum resultado de CI remota foi usado como evidência desta rodada.

Os diagnósticos finais têm **12 cenários de contexto e 2 de rotas**, executados **duas vezes** em processos e fixtures independentes. Coletores retornaram 0 por reproduzir o comportamento observado. O [verificador independente](probes/check-evidence.py) releu as mensagens e encontrou **5 controles corretos e 6 violações de atualidade em cada conjunto**, exit 1. Histórico foi excluído da contagem de defeitos. Os campos semânticos comparados coincidem entre as duas execuções; requests brutos têm IDs/caminhos diferentes.

A primeira fixture omitiu SessionProjector e gerou nove falhas de setup, preservadas em `evidence/setup-missing-projector.*`, não abertas como bug. A composição corrigida usa o projetor original. A versão exploratória de nove casos está preservada e não é somada aos doze finais.

## Ambiente e limites

macOS, Node 22.17.1, Bun 1.3.14, checkout isolado na revisão fixada. Dependências previamente instaladas foram reutilizadas por 38 links de node_modules: não é instalação hermética. Fontes relevantes do doador foram verificadas sem diff; 284 JS compilados comparados coincidem. Nenhum trecho do registro de leituras diverge do produto fixado.

O preload original isola HOME/XDG, configuração e chaves. Não houve dados reais de usuário nem inferência paga. TestLLMServer responde programaticamente; SessionSummary é neutralizado na composição interna. A rota pública usa seus próprios serviços originais. Permissões são explicitamente permitidas; o diagnóstico não testa negação de autorização.

Server.Default().app.request exercita o roteador HTTP em processo, não um servidor TCP da aplicação lançado pela CLI. O transporte até o provedor local é HTTP real. SQLite é em memória, conforme o preload: não houve recuperação da mesma sessão persistida após restart. Duas execuções novas não são essa prova.

Os JSONs publicam mensagens capturadas, nomes de ferramentas e resultados. requestBodyHash foi calculado sobre o corpo completo durante a captura; como nem todos os campos do corpo são publicados, não é anunciado como recomputável só das mensagens. SHA256SUMS verifica os arquivos publicados. A inspeção de padrões não encontrou tokens privados ou HOME pessoal nos artefatos; não é certificação universal de ausência de segredos.

A presença de maestro_present_approval entre as ferramentas não significa que esteja disponível para aprovar: a recusa deliberada do produto permanece. Nenhuma apresentação governada foi habilitada por esta rodada.

## Cobertura restante

O WP permanece parcial: faltam UI/CLI completa, sessão Core V2 configurada até o provedor, troca real de projeto/worktree, duplicatas e recibos ausentes/não canônicos no consumidor, reinício da mesma sessão persistida e política de validade de histórico/epochs. Não declarar esses casos resolvidos pelos controles atuais.

O próximo passo delimitado é verificar identidade e atualidade entre projetos/worktrees e entre consumidores, antes de implementar a correção #36. Não basta inserir um verificador numa função que outro caminho não usa. Histórico deve permanecer histórico, não ser apagado para esconder desatualização.

A obrigação global de cinco passagens sobre todo o repositório continua aberta. O inventário nesta revisão contém **7.876 arquivos regulares + 60 symlinks = 7.936 entradas**, explicando os totais anteriores. Inventário não é leitura semântica; cinco passagens focadas neste diário não substituem a obrigação global.

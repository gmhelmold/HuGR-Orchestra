# Atlas / Maestro — auditoria com execução original

Data: 17 de setembro de 2026. Produto examinado: `gmhelmold/HuGR-Orchestra`, branch `maestro/rebuild-fork-dev-clean`, commit **`b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`**.

Esta entrega aprofunda o dossiê do [PR #14](https://github.com/gmhelmold/HuGR-Orchestra/pull/14). O histórico anterior permanece válido como registro do que havia sido demonstrado naquela etapa; esta rodada acrescenta execução dos módulos originais, armazenamento real, transporte MCP e integração interna do Maestro.

## Resultado executivo

Foram abertas **13 issues nesta rodada**, com escopo, reprodução ou limitação de contrato, contrapontos, critérios de completude, sucesso, qualidade, Definition of Done e invariantes. Não foram aplicados fixes no produto nem realizado merge.

O resultado mais importante não é um contador de bugs: **a suíte original passa, mas há cenários de composição em que uma camada afirma uma garantia que a camada anterior não estabeleceu**. A auditoria reproduziu perda de evidência durável, promoção baseada em entregas inexistentes e atribuição incorreta de freshness. Três dessas falhas também atravessaram o servidor MCP real.

### Baseline efetivamente executada

| Verificação | Resultado observado |
|---|---|
| Instalação isolada Atlas + `bun run typecheck` | Concluída; typecheck exit 0. |
| Suíte original Atlas, sem acrescentar os diagnósticos à descoberta de testes | **527 arquivos passaram; 2 ignorados. 4.119 testes passaram; 12 ignorados; 3 todo. Exit 0.** |
| Suíte original Maestro | **32 testes, 7 arquivos, 0 falhas.** |
| Diagnóstico interno adicional Maestro | **5 casos**: aprovação direta, reapresentação, nova revisão, usuário sintético e saída adulterada. |
| Diagnósticos adicionais Atlas | **15 cenários** usando módulos/contratos originais; incluem controles e medições, não apenas defeitos. |
| Diagnósticos MCP | **3 histórias** com SDK original e servidor original em subprocesso stdio. |

Fontes: [manifesto da execução](evidence/run-manifest.json), [log integral Atlas](evidence/atlas-official-suite.log), [log original Maestro](evidence/maestro-official-suite.log), [resultados Atlas](evidence/runtime-probes.json), [resultados MCP](evidence/mcp-probes.json), [resultados Maestro](evidence/maestro-redisplay.json).

**Um diagnóstico passar significa que o comportamento observado foi reproduzido; não significa que o defeito foi corrigido.** Os critérios do comportamento correto estão nas issues. A suíte baseline e as reproduções adversariais não são contagens intercambiáveis.

O lote adicional de invocação independente dos guards foi bloqueado pela avaliação de segurança da ferramenta. Não foi executado nem contornado. Isso não afeta os testes e os experimentos já concluídos, mas impede afirmar que todos os gates locais ou o CI estejam verdes. O guard Own foi executado anteriormente dentro das fixtures específicas documentadas; isso não equivale a executar todos os guards sobre o repositório real.

## Issues publicadas e força da evidência

| Issue | Prioridade proposta | Achado | Evidência desta rodada |
|---|---|---|---|
| [#15](https://github.com/gmhelmold/HuGR-Orchestra/issues/15) | P1 | Upsert remove o ledger de abstenções não relacionadas. | Redutor original nas quatro rotas; handler, disco reaberto e MCP com reinício. |
| [#16](https://github.com/gmhelmold/HuGR-Orchestra/issues/16) | P1 | Fatos descartados do pack ganham hits e viram governing. | Handler completo e MCP real, nove consultas com os mesmos IDs. |
| [#18](https://github.com/gmhelmold/HuGR-Orchestra/issues/18) | P1 | Runtime antigo certifica grounding obsoleto com watermark do HEAD novo. | Dois commits reais; handler; MCP retido versus reiniciado; check de controle. |
| [#22](https://github.com/gmhelmold/HuGR-Orchestra/issues/22) | P1 | Gotchas preservam `FRESH` armazenado após alteração da fonte. | Own de runtime reconstruído, com invariant e query como controles. |
| [#20](https://github.com/gmhelmold/HuGR-Orchestra/issues/20) | P2 | Draft exige ratificação na orientação, mas omite a proveniência que a exigiria. | Draft/check/emit originais; controle com proveniência explícita recusado. |
| [#23](https://github.com/gmhelmold/HuGR-Orchestra/issues/23) | P2 | Ponteiro de drill para unidade inexistente passa pela validação. | Contratos originais, kernel real e scripts originais com Git/blobs reais. |
| [#24](https://github.com/gmhelmold/HuGR-Orchestra/issues/24) | P2 | Predicado malformado vira `undefined` e passa pelo gate estático. | Parser/export/render/verify originais e scripts reais; controle de fonte stale. |
| [#25](https://github.com/gmhelmold/HuGR-Orchestra/issues/25) | P2 | Reapresentação da mesma revisão fica vinculada à mensagem antiga. | Produtor original, Effect, SQLite/eventos, `recordApproval`; saída visível inserida como fixture. |
| [#26](https://github.com/gmhelmold/HuGR-Orchestra/issues/26) | P2 | Check prevê emissão de slot inválido que emit recusa deterministicamente. | Mesmo payload, mesma revisão, mesmo runtime e nenhuma mutação intermediária. |
| [#28](https://github.com/gmhelmold/HuGR-Orchestra/issues/28) | P2 | Orçamento de seleção não limita todo o payload Own. | Árvore real com 350 arquivos; tamanho final medido; análise do campo sem cap. |
| [#29](https://github.com/gmhelmold/HuGR-Orchestra/issues/29) | P2 | `COMPLETE` estático não transporta autoridade explícita de cobertura do grafo. | Lacuna de contrato demonstrada no formato e na atribuição constante; não um grafo falso reproduzido. |
| [#30](https://github.com/gmhelmold/HuGR-Orchestra/issues/30) | P2 | `contested=false` constante diverge do contrato que declara derivação do incumbent. | Código e execução originais; decisão de política ainda necessária. |
| [#31](https://github.com/gmhelmold/HuGR-Orchestra/issues/31) | P2 | Materializador chamado por caminho com symlink termina com exit 0 sem executar. | Mesma fixture/input, caminho por alias versus caminho canônico. |

Prioridades são de engenharia, não notas CVSS. As 13 issues são estas acima; issues consultadas que foram acrescentadas ao repositório durante a investigação não entram nessa contagem. [Recibos das 13 criações](evidence/issues.json).

## 1. Perda durável de abstenções — #15

O `StoreProjection` possui `abstained`, mas `upsert()` reconstrói seu retorno com apenas `current` e `cas`. O experimento puro confirma a perda nas rotas **CREATE, UPDATE, SUPERSEDE e DEDUP**, mantendo a entrada original intacta.

A prova mais forte atravessou o produto: `atlas-emit` de uma negação sobre símbolo local criou uma abstenção `target-not-global`; `atlas-negations` a mostrou. Uma emissão advisory não relacionada teve sucesso. Depois de fechar e reabrir o servidor MCP, `atlas-negations` retornou a lista de abstenções vazia.

Não é apenas um objeto de teste sem campo. A evidência desapareceu do armazenamento servido pelo produto. Isso não demonstra que Atlas provou uma negação falsa; demonstra a perda do registro que explicava por que ele havia se abstido.

## 2. Promoção sem entrega — #16

Foram emitidos seis fatos T2, em seis âncoras diferentes, cada um com claim de 450 caracteres. Isso evita depender de um único fato exageradamente grande para acionar o limite do pack.

Nas consultas 1 a 8, os mesmos quatro fatos aparecem na banda advisory e os outros dois são descartados (`advisoryDropped=2`). Na consulta 9, todos os seis aparecem como T1/governing. Os dois nunca entregues também foram promovidos na classificação servida. A projeção persistida continua com seis tiers T2.

A causa é a ordem: `cover()` registra hit antes de `createQuery()` aplicar a seleção final. O contador representa seleção preliminar, mas é usado como evidência de uso servido. A história foi repetida através do MCP real.

A correção deve contabilizar os IDs efetivamente entregues. Não basta baixar o limiar, alterar a ordenação ou chamar tentativa de seleção de entrega.

## 3. Duas noções de revisão que deixam de coincidir — #18

No commit C1, a fonte declara `value0 = 0`. O runtime é construído e produz grounding para essa fonte. A fonte muda para `value0 = 987` e chega a C2, sem reiniciar o runtime.

A emissão do fato antigo, com `at=C2`, é aceita. A consulta no mesmo processo informa `FRESH` e `stale:false`. Reiniciando o MCP sobre exatamente C2, a consulta passa a informar `STALE`, e `atlas-check` recusa o fato antigo no truth gate.

O oráculo do runtime antigo continua vendo eixos construídos em C1; a persistência, por outro lado, consulta HEAD vivo e carimba a nova geração. O fato é certificado em uma revisão que esse oráculo não verificou. O defeito não é a antiga regra de carregar o watermark de uma linha não modificada: é produzir conteúdo novo a partir de uma visão estrutural antiga.

As fixtures distinguem `DRIFTED`, resposta estrutural de certas funções, de `STALE`, resposta apresentada por query. O problema é o falso `FRESH`, não a diferença de vocabulário entre superfícies.

## 4. Freshness assimétrica no Own — #22

A prova usa um runtime novo após o commit que altera a fonte, para não depender do defeito anterior. Um invariant e um gotcha T1 estão ancorados no mesmo arquivo. Inicialmente ambos aparecem FRESH. Após a alteração, Own mostra o invariant DRIFTED e o gotcha ainda FRESH; query identifica ambos como STALE.

`governingGotchas` devolve o fato armazenado, enquanto os outros caminhos recebem o oráculo corrente. Uma flag gravada no passado não estabelece a atualidade da fonte. Reads devem projetar o novo estado sem reescrever silenciosamente o CAS.

## 5. Orientação do autor versus decisão executada — #20 e #26

O draft usa uma proveniência não confiável na visão pela qual calcula a rota; a proveniência não segue no fato retornado. Resultado: o planner informa `full-ratify` e exige `ATLAS_RATIFY_TOKEN`, mas check e emit aceitam o fato sem esse token. Reintroduzir explicitamente a proveniência declarada pelo próprio planner faz a emissão ser recusada como unratified. Esse controle isola o campo responsável pela divergência.

Em outro experimento, trocar apenas `predicateSlot` por um nome fora do vocabulário fechado mantém `wouldEmit:true` no check. A emissão real recusa `closed-slot-violation` e o disco continua sem linhas. A proteção de escrita funciona; a previsão do dry-run é que está incompleta.

São defeitos distintos: um transporta semânticas diferentes entre o payload roteado e o retornado; o outro omite uma condição determinística do caminho de previsão.

## 6. Integridade de bytes não basta para validar o snapshot — #23 e #24

Os testes usam o materializador e guard originais, com BLAKE3 real e revisão Git ancestral/blobs correspondentes. O controle válido passa; a alteração de uma fonte real após materializar provoca exit 1 no guard.

Entretanto, o snapshot aceita um filho `missing/unit` sem unidade/artifact correspondente. Também aceita um predicate check contendo `expr` sem `check.kind`. O renderer lê `query` nesse caso e grava `undefined`; a recomposição repete o erro e a validação passa.

Não se trata de afirmar que o snapshot Genesis commitado contém esses exemplos. São entradas inválidas demonstravelmente aceitas. Existência dos ponteiros e coerência da união discriminada precisam ser verificadas antes da comparação de bytes.

## 7. Maestro: retry não é reapresentação — #25

A integração usa o produtor original de apresentações e o banco/eventos reais. A saída visível da ferramenta é fixture, porque a entrada pública de apresentação continua intencionalmente desabilitada até existirem leitores duráveis de plano e validação.

Após uma pergunta do usuário, apresentar a mesma revisão em nova mensagem devolve a apresentação anterior, com `assistantMessageID` antigo. O `aprovo` imediatamente posterior à nova exibição recebe `HOLD/reply-not-immediate`.

Os controles se comportam corretamente: aprovação direta e nova revisão são aprovadas; usuário sintético e saída alterada são bloqueados. Remover a verificação de adjacência seria uma correção errada. É preciso distinguir a identidade da revisão da identidade da tentativa visível, ou recusar explicitamente uma reapresentação não suportada.

**Não foi demonstrada uma jornada pública completa de governança.** O teste não habilita a ferramenta bloqueada, não prova integração de leitores ainda inexistentes e não executa um agente LLM real.

## 8. Boundedness e autoridade de cobertura — #28, #29 e #30

A árvore com 350 arquivos produz um Own com `tokenEstimate=127`, 350 entradas em `shape.contents`, 16 itens em `drill.finer` e 8.885 bytes UTF-8 serializados. Bytes não são tokens. A observação mostra que conteúdo retornado fica fora da contabilidade; o código que devolve todos os filhos sem cap estabelece a possibilidade de crescimento não limitado por esse orçamento.

A atribuição literal `graphCoverage:'COMPLETE'` é outra questão: a entrada do materializador não carrega a autoridade/veredito de cobertura que justificaria esse campo. Completude da projeção relativa a um snapshot aceito e completude do grafo do projeto precisam ter nomes e fontes de autoridade distintos. Essa é uma lacuna de contrato; não foi produzido um contraexemplo que prove incompleto o grafo atualmente commitado.

Por fim, o caminho de ratificação recebe `contested=false` constante enquanto comentários descrevem uma decisão derivada do incumbent. A execução confirma aceitação de outro conteúdo no mesmo endereço. Mas as regras de união de claims também permitem acumulação legítima; diferença de texto não é prova automática de contradição. A issue exige primeiro reconciliar a política, em vez de inventar conflito para todo UPDATE.

## 9. Um falso sucesso encontrado no próprio preparo da auditoria — #31

A primeira invocação do materializador por caminho absoluto com `/tmp` terminou em exit 0 sem criar o snapshot. Não contabilizei isso como aceitação pelo guard: o controle válido também falhou por ausência do arquivo.

A causa foi o alias `/tmp` → `/private/tmp` no macOS. O entrypoint compara o caminho apenas normalizado com o caminho real do módulo e não chama `main()` quando eles divergem. A auditoria passou a usar caminho canônico e a exigir existência real dos outputs. Separadamente, uma fixture com symlink explícito reproduziu o falso sucesso, enquanto o caminho real materializou os mesmos inputs corretamente.

Esse episódio foi preservado como ajuste do experimento, não escondido sob um status verde. A issue exige que exit 0 corresponda a execução real, mantendo importação do módulo sem efeitos colaterais.

## Método, cobertura e limites

Houve cinco lentes progressivas: revalidação da versão e dos contratos; rastreamento de produtores/consumidores; execução do runtime com Git/disco; execução pelo transporte MCP e pelo banco do Maestro; e revisão adversarial com controles e rechecagem das afirmações.

O inventário cobre **7.936 caminhos rastreados**. Há [31 testemunhos de fontes](evidence/source-witnesses.json), com identidade Git, SHA-256 e correspondência comprovada ao commit auditado. Isso não significa que apenas 31 arquivos foram abertos, nem que os demais foram semanticamente auditados. **Não se afirma aqui que foram realizadas cinco leituras integrais, linha a linha, dos 7.936 arquivos.** A profundidade comprovada está nas superfícies, suites e cadeias de reprodução delimitadas neste documento.

A execução ocorreu em checkout isolado. Os repositórios de trabalho originais não foram editados. Instalações usaram lockfiles, com scripts automáticos desabilitados; o pequeno shim local de tipos SCIP foi lido e executado explicitamente. As reproduções não substituíram hashing, grounding, query ou persistência e não fizeram chamadas de modelo.

Foi necessário habilitar o recurso Issues após uma tentativa real retornar HTTP 410. Não foram alterados visibilidade, branch padrão ou proteções de branch. Não se executou merge. Os logs publicados substituem caminhos locais de home/auditoria; não substituem resultados, contadores ou verdicts.

Não se apresenta benchmark de performance de produção, cobertura percentual de toda a base, garantia de segurança de rede, validação de Windows/Linux, CI atual inteiramente verde ou sucesso de uma jornada pública do Maestro ainda bloqueada.

## Reprodução

Em um checkout descartável do SHA auditado, prepare Atlas com os comandos registrados nos logs:

```sh
cd foundation/atlas
npm ci --ignore-scripts --no-audit --no-fund
node scripts/fix-scip-types.mjs
bun run typecheck
npm test -- --maxWorkers=2 --minWorkers=1
```

Os diagnósticos recebem o diretório Atlas e uma pasta de evidência já existente:

```sh
node /caminho/runtime-proof/probes/runtime-probes.mjs "$PWD" /caminho/evidence
node /caminho/runtime-proof/probes/mcp-probes.mjs "$PWD" /caminho/evidence
```

O primeiro script produz observações, incluindo condições defeituosas. O segundo usa o harness original de black-box apenas como cliente/gerenciador do subprocesso original. Não são substitutos da suíte de regressões esperadas após um fix.

Para Maestro, no checkout descartável, instale as dependências do host com `bun install --frozen-lockfile --ignore-scripts` e execute `bun test --timeout 30000 test/maestro` a partir de `packages/opencode` **antes** de acrescentar o diagnóstico. Para o diagnóstico, copie `probes/maestro-redisplay.test.ts` para `packages/opencode/test/maestro/audit-redisplay.test.ts`, defina `AUDIT_REDISPLAY_OUTPUT` para um JSON dentro da pasta de evidência e execute apenas esse arquivo. Os imports relativos pressupõem essa posição. O preload original isola home/XDG e usa SQLite em memória.

A conclusão de um fix exige o comportamento correto indicado na respectiva issue, com os controles mantidos, e não apenas repetir que os diagnósticos reconheceram a falha original.

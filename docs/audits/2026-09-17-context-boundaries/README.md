# HuGR-Orchestra — Atlas e Maestro: auditoria das fronteiras de contexto

**Data:** 17 de setembro de 2026.
**Produto examinado:** `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.
**Branch:** `maestro/rebuild-fork-dev-clean`.
**Entrega:** documentação e diagnósticos; nenhum fix de produção, merge ou habilitação de aprovação.

## Resultado desta rodada

Foram abertas três issues novas, após consulta às issues já existentes: [#56](https://github.com/gmhelmold/HuGR-Orchestra/issues/56), [#58](https://github.com/gmhelmold/HuGR-Orchestra/issues/58) e [#62](https://github.com/gmhelmold/HuGR-Orchestra/issues/62). Cada uma contém fonte imutável, cenário, resultado observado, controles, limite de exposição, direção de correção, success criteria, quality standards, completeness criteria, definition of done e invariants.

Os diagnósticos executam implementações originais, não reimplementações do algoritmo. Cada cenário novo foi repetido em outro processo e, quando aplicável, outra fixture temporária. As suítes originais selecionadas passaram: **31 testes Atlas e 32 testes Maestro**. Os novos diagnósticos falham de propósito nas propriedades corretas que o produto ainda viola. Vermelho significa defeito reproduzido, não defeito corrigido.

Esta rodada usa cinco lentes sequenciais: inventário, contratos, composição real, comportamento executado e rechecagem adversarial. **Não equivale a cinco leituras integrais de todo o monorepo.** O inventário cobre 7,876 arquivos regulares versionados; as leituras e execuções específicas estão em [COVERAGE.md](COVERAGE.md). Os demais arquivos estão explicitamente marcados como somente inventariados. Não se atribui compreensão semântica a uma contagem de arquivos.

## Como o entendimento foi construído

### 1. Estabelecer versão e distinguir trabalho anterior

O HEAD da branch foi reconfirmado no GitHub. A investigação usa um clone separado, sem trocar a branch de trabalho do usuário. As issues de rodadas anteriores foram consultadas antes de propor as novas. Falhas já registradas — como hits para candidatos descartados, gotchas stale, orçamento parcial de Own e carregamento de skills sem freshness — não foram abertas novamente.

A documentação de construção e os comentários de status não são tratados como prova de exposição. Um exemplo concreto: `awareness-store.ts` ainda possui um cabeçalho dizendo não ter consumidores, mas `compose.ts` instancia `createAwarenessStore`. Isso não significa que todos os seus métodos sejam usados: a leitura normal usa `read()`, enquanto o método memoizado de waves não tem consumidor externo localizado. Essa distinção controla a classificação da issue #56.

### 2. O que cada parte realmente representa

**Awareness** monta cinco facetas em ordem estável: missão, constituição, terreno, ontologia e preferências. No adaptador examinado, constituição vem das linhas T0 persistidas e preferências vêm de `CONVENTIONS.md`; facetas sem fonte ficam `UN-SEEDED`. A constituição é agregada: todas as linhas T0 contribuem para seu conjunto de âncoras; a primeira camada injetada informa a contagem. O texto dos fatos permanece na cauda consultável do modelo. A suíte original fixa essa separação; não foi classificada como defeito apenas por não injetar todo o texto.

**Memoização de Awareness** tenta evitar remontar facetas quando apenas o root muda por uma causa não relacionada. Essa otimização é legítima. O problema é o cache inferir que a faceta inteira não mudou porque a primeira de várias âncoras não mudou. A evidência de uma parte não representa a identidade do agregado.

**Limite de injeção** opera sobre estimativas já fornecidas, não tokeniza conteúdo. Duas categorias são fixas: Awareness e protocolos de segurança. As demais são removidas por prioridade e uso até o teto. O contrato admite excesso quando apenas as categorias fixas restam; isso foi mantido como controle válido. O defeito encontrado não depende dessa exceção, de um tokenizer ou de estimativa inexata: a soma declarada diverge da soma do próprio array retornado.

**Admissão do Maestro** transforma uma avaliação em `ORIENT`, `CLARIFY` ou `READY_TO_DRAFT` e a registra com identidade de sessão, mensagem e versão do método. Essa etapa não autentica a verdade semântica da avaliação e não aprova execução. A ferramenta anuncia que vincula a admissão à mensagem direta do usuário. Entretanto, o host também usa o papel `user` para continuação interna de compactação. Papel para o modelo e autoria humana são propriedades diferentes.

Fontes principais: [foundation/atlas/packages/memory/src/awareness.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/memory/src/awareness.ts), [foundation/atlas/packages/adapter-io/src/awareness-store.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/adapter-io/src/awareness-store.ts), [foundation/atlas/packages/retrieval/src/drop.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/foundation/atlas/packages/retrieval/src/drop.ts), [packages/opencode/src/maestro/admit-request.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/maestro/admit-request.ts) e [packages/opencode/src/tool/maestro-admission.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/maestro-admission.ts).

### 3. Seguir produtor, transformação e consumidor

O fluxo relevante de constituição é `projeção T0 -> constitutionInput -> atlasRoot -> assembleForWave -> makeAwarenessMemo`. A leitura independente `read -> rollup(realAtlasRoot)` fornece o controle frio. Não é necessário substituir a função de cache por um modelo matemático para observar a divergência.

No limitador, `orderDroppable` preserva repetições de uma categoria, `Map(kind -> injection)` conserva somente a última e `Set(injection)` conserva identidade de objeto. O loop mistura essas representações: pode subtrair novamente uma alocação já removida. Ao repetir a mesma referência no input, o efeito muda de direção porque filtrar o array remove várias ocorrências após uma única exclusão do Set. Ambos os casos indicam que o domínio precisa ser agregado explicitamente ou tratar multiplicidade de forma consistente.

Na admissão, o produtor de auto-continue em `session/compaction.ts` cria uma mensagem com papel `user` e texto marcado `synthetic: true`, mais `compaction_continue: true`. O contexto de ferramenta recebe o histórico. A ferramenta escolhe a última mensagem de papel user e grava seu ID sem checar a distinção de origem. O teste usa mensagens persistidas pelo serviço real e o histórico lido de volta; não passa diretamente uma falsa linha de evento como substituto da execução.

## Achado #56 — chave incompleta do cache de constituição

**Resultado observado:** após uma constituição com uma linha, inserir uma segunda linha que ordena depois da primeira mantém no resultado memoizado a contagem de um fato e uma única âncora. Uma leitura fria sobre o mesmo disco retorna dois fatos e duas âncoras. Alterar apenas a segunda linha também não invalida o cache. Alterar a primeira linha invalida corretamente. Fontes idênticas e um marcador de root sem relação continuam corretamente sem re-roll.

**Causa:** `sourceKey` usa somente `entry.grounding[0].subtreeHash`, mas `constitutionInput` monta a faceta com todas as linhas T0 ordenadas. A alteração de uma linha secundária não chega à identidade usada pelo cache.

**Prova:** [primeira execução](evidence/awareness-boundaries-first.json), [segunda execução](evidence/awareness-boundaries-second.json) e [diagnóstico](evidence/awareness-boundaries.mjs). Os registros T0 são semeados com `upsert` e persistência originais, seguindo o teste original de Awareness. Essa fixture não é prova de ratificação humana. Não houve execução automática de waves nem resposta stale demonstrada no MCP público.

**Correção delimitada:** a chave deve comprometer todos os inputs relevantes da faceta, com o mecanismo de identidade já existente. É necessário conferir quais campos a canonicalização exclui antes de simplesmente aplicar `id` ao objeto. Não remover o cache nem usar o hash global inteiro por conveniência se isso destruir o controle de mudanças não relacionadas sem necessidade.

## Achado #58 — o recibo do teto não corresponde aos sobreviventes

**Resultado observado:** Awareness de 400 unidades estimadas mais seis objetos distintos de tipo pack, cada um com 1.000, totalizam 6.400. Depois da redução com teto 5.000, restam Awareness e cinco packs, total **5.400**, mas o retorno declara **4.400**. A categoria pack consta duas vezes em `dropped`, embora só um objeto distinto tenha sido removido.

**Controles:** categorias únicas produzem soma correta; excesso composto exclusivamente por itens fixos permanece permitido; repetir a mesma referência seis vezes produz outra divergência entre soma e array, sem ser confundido com o caso de seis objetos distintos. Cada pack individual tem 1.000 unidades; não se depende de um item maior que seu limite para reproduzir.

**Prova:** [primeira execução](evidence/ceiling-boundaries-first.json), [segunda execução](evidence/ceiling-boundaries-second.json), [diagnóstico](evidence/ceiling-boundaries.mjs). Não há chamada de produção localizada para `resolveCeiling`; é uma obrigação de correção antes da integração, não um estouro observado numa sessão real. Unidades estimadas não são apresentadas como tokens medidos.

**Correção delimitada:** definir se a API aceita uma entrada agregada por categoria ou várias entradas. Rejeitar explicitamente duplicatas pode ser válido no primeiro caso. No segundo, seleção e contagem devem operar sobre o mesmo conjunto ou multiconjunto. A soma deve ser verificável a partir dos sobreviventes; itens fixos não podem ser descartados para mascarar o problema.

## Achado #62 — origem sintética vira admissão direta

**Resultado observado:** com um pedido direto seguido de auto-continue sintético, a admissão `READY_TO_DRAFT` fica vinculada ao auto-continue. Com apenas auto-continue sintético na fixture, o mesmo registro é aceito. O pedido direto isolado é registrado corretamente, e um caller diferente de Maestro é recusado. Esses quatro resultados se repetem nas duas execuções.

**Causa:** seleção por `role === 'user'` sem checagem de autoria/origem no momento de gravar o vínculo. A marca de origem já está disponível nos dados; a transformação a ignora.

**Prova:** [teste original-host](evidence/audit-context-admission.test.ts), [resultados extraídos](evidence/admission-results.json), [primeiro log](evidence/admission-first.log) e [segundo log](evidence/admission-second.log). O teste exercita a ferramenta original e lê o registro persistido. O auto-continue é uma fixture fiel ao formato do produtor, não uma execução real de compactação ou uma conversa com LLM. A avaliação de intenção é dado sintético do teste.

**Limite crítico:** não há demonstração de bypass de aprovação nem de execução indevida. `READY_TO_DRAFT` não é permissão para Task. A ferramenta pública de apresentação de aprovação continua bloqueada por suas dependências de autoridade; nenhum guard foi alterado.

**Correção delimitada:** recusar ausência de pedido direto elegível ou preservar uma linhagem explícita de continuação até a origem real. Não basta rejeitar qualquer mensagem com alguma parte sintética: mensagens legítimas podem combinar texto humano e expansões sintéticas de anexos. Esse caso misto faz parte dos critérios de conclusão da issue, ainda não foi executado no diagnóstico desta rodada.

## 4. Controles executados e condições de sucesso

| Execução | Resultado | Significado |
|---|---|---|
| Typecheck Atlas | exit 0 | Compilação do pacote no ambiente disponível; não comprova comportamento |
| Quatro arquivos de testes Atlas | 31 passam | Controles originais de Awareness e ceiling preservados |
| Sete arquivos de testes Maestro | 32 passam | Controles originais de admissão/aprovação/lifecycle preservados |
| Awareness novo, duas execuções | exit 1 em ambas | Duas propriedades de invalidação falham; controles permanecem corretos |
| Ceiling novo, duas execuções | exit 1 em ambas | Recibo diverge dos sobreviventes para duplicatas |
| Admissão nova, duas execuções | 2 passam / 2 falham em cada | Origem direta e caller passam nos controles; origem sintética é atribuída indevidamente |

Logs: [Atlas](evidence/atlas-baseline-tests.log), [Maestro](evidence/maestro-baseline-tests.log), [typecheck](evidence/typecheck-final.log). Não se executou a suíte inteira do monorepo. Nenhum resultado vermelho foi convertido em assertion que declara o defeito correto só para produzir verde.

A primeira tentativa de fixture de Maestro omitiu `Truncate`, requerido pela inicialização real da ferramenta. O erro de setup está [preservado](evidence/admission-fixture-setup-failure.log) e não conta como falha de produto. Após compor os serviços como na suíte original, o teste chegou ao registro real e produziu os resultados acima.

## 5. Rechecagem adversarial, falsos positivos evitados e trabalho restante

A investigação diferenciou instanciar um adaptador de invocar seu método memoizado; orçamento de seleção de orçamento de saída; papel user de autoria humana; testes internos de execução pública ponta a ponta. Essas distinções evitaram transformar três bugs delimitados em alegações indevidas sobre o produto inteiro.

O cache não foi chamado de totalmente quebrado: os controles de alteração primária e root não relacionado passam. O limite fixo não foi chamado de absoluto: a exceção pinned-only é declarada e foi respeitada. A admissão não foi chamada de aprovação: é uma fase anterior. O código de teste não substituiu kernel, soma, cache, decisão ou persistência.

Ainda faltam, para fechar correções: política explícita de multiplicidade no ceiling, testes de remoção e mudanças em todas as contribuições da faceta, compatibilidade com mensagem humana contendo expansões sintéticas e integração real de compactação até a ferramenta. Cada issue contém esses critérios, além de limites e invariantes. Não há recomendação para construir um novo framework de workflow como condição para esses fixes.

## Reprodução

Pré-condição: checkout separado na revisão indicada e dependências instaladas conforme o repositório. Esta auditoria reutilizou dependências de um checkout limpo no mesmo SHA por links; não é instalação hermética. Node 22.17.1, Bun 1.3.14, macOS. Os caminhos locais nos logs publicados foram substituídos por marcadores e espaços finais foram normalizados; resultados e assertions foram mantidos.

```sh
# A partir da raiz do checkout, depois da instalação das dependências:
(cd foundation/atlas && bun run typecheck)
node docs/audits/2026-09-17-context-boundaries/evidence/awareness-boundaries.mjs "$PWD"
node docs/audits/2026-09-17-context-boundaries/evidence/ceiling-boundaries.mjs "$PWD"
# Ambos retornam 1 nesta versão porque as propriedades corretas falham.
```

Para o teste do host, copiar o arquivo de evidência para `packages/opencode/test/maestro/audit-context-admission.test.ts` em um checkout descartável, mantendo os imports relativos originais. Executar de `packages/opencode`:

```sh
bun test test/maestro/audit-context-admission.test.ts --timeout 60000
```

O resultado esperado na versão auditada é 2 testes de controle passando e 2 propriedades desejadas falhando. O arquivo fica nesta pasta documental para não adicionar deliberadamente testes vermelhos à suíte ativa de produto. O procedimento não habilita ferramentas bloqueadas nem usa inferência paga.

## Entregáveis e preservação

[COVERAGE.md](COVERAGE.md) delimita o que foi lido/testado; [inventory.json](inventory.json) inventaria arquivos sem fingir revisão integral; [LEARNING-LOG.md](LEARNING-LOG.md) registra evolução; [RESULTS.json](RESULTS.json) resume resultados. As issues são unidades de trabalho independentes. O commit desta documentação preserva scripts e resultados para outro engenheiro reproduzir, contestar e corrigir sem depender da memória da conversa.

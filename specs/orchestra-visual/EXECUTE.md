# Orchestra — entrada de execução v3

Status: planejamento revisado. Nenhum código da interface, benchmark ou teste Electron foi executado por esta revisão.

## Insumo obrigatório

Use o pacote **Orchestra_Codex_Execution_Plan_v3.zip** entregue ao usuário. Ele substitui a v2 e contém o contrato completo: PLAN.json, SPEC.md, PERFORMANCE.md, CONTRACTS.md, MAP.md, SURFACES.json, OWNERSHIP.md, issues/*.md, ferramentas, provas da revisão e reference/approved.png.

Este arquivo no repositório é a entrada resumida. **O PLAN.json completo, as ferramentas e a imagem não estão publicados nesta branch por esta revisão.** Não finja que os leu a partir deste arquivo. Obtenha o pacote antes da implementação visual; compare o destino existente antes de copiar para specs/orchestra-visual/, sem sobrescrever trabalho diferente.

Leia EXECUTE.md do pacote, SPEC.md, PERFORMANCE.md, CONTRACTS.md, MAP.md e abra a referência. Depois carregue apenas a task selecionada, seus axiomas e dependências. Não injete os 140 nós em cada subagente.

Referência única: Approval flow refactor, 1672×941, SHA-256 `e839b759e0f93beca37b10cd45700725020a840fee6e97da1e67556b2ffb128d`. Base de código documentada: `30d951fcc4a09e708768551c7c6fd38a0efe3da8`. Revalidar checkout atual; não resetar para a base histórica.

## Missão fixa

Migrar toda a interface desktop/web existente, não apenas uma demonstração. Preservar o layout aprovado: sidebar estreita; topbar de projeto/branch/sessão; conversa central dominante; lista de alterações e diff em paralelo; evidência de execução; um único input inferior no centro; Dock acima de Tasks e Atividade no rail direito, simultaneamente visíveis.

Grafite discretamente azulado, azul contido, bordas finas, profundidade suave e montanhas dessaturadas na sidebar. Sem roxo, neon, wash ciano, novo dashboard ou editor central imposto. A v3 não muda a escolha visual. Performance, leveza, funcionamento e microacabamento são critérios simultâneos.

Reutilizar Solid, ThemeProvider V1/V2, stores, componentes, handlers e permissões existentes. Não criar runtime, browser, sistema de auth, biblioteca visual ou backend paralelo. Atlas é conhecimento, Dock é browser e Janitor permanece read-only. Progresso, testes aprovados, presença e autoridade precisam de fonte real. Conteúdo do site dentro do Dock não é uma nova aplicação a construir.

## Trabalho publicado

| Épico | Issues | Subissues |
|---|---|---|
| #130 Fundação | #134–#135 | #144–#148 |
| #131 Aplicação inteira | #136–#138 | #149–#157 |
| #132 Capacidades | #139–#141 | #158–#164 |
| #133 Gates e entrega | #142–#143 | #165–#168 |

Continuam 4 épicos, 10 issues, 25 subissues, 37 WPs e 64 tasks. Cada nó contém explicitamente DoD, Invariants, Quality standards, Completeness criteria e Success criteria. A revisão v3 materializa 1.898 critérios com IDs. PLAN.json do pacote v3 é a autoridade detalhada; as projeções Markdown locais são verificadas contra ele.

## Ordem

1. S01 confirma master, checkout, instruções, censo e ownership. O inventário inicial tem 68 registros mistos de UI, fonte, medida e lacuna; não são 68 telas testadas.
2. S02 estabelece fixture e medição de produção. S03 tema e S05 assets avançam separados; S04 primitives segue tema.
3. S16 bridge nativa e S17 dados não dependem de S22/tradução. Lanes de apresentação consomem o contrato de copy. S09 precede S11; S17 precede S18; S16 fornece fronteira nativa a overlays/Dock.
4. S25-W1-T1 produz o build integrado; S23 e S24 verificam; S25-W1-T2 encerra. Não criar ciclo esperando fechamento de S25 antes de medir.
5. S19/S20-W1 podem entregar UI segura unavailable/HOLD. W2 espera autoridade real das issues externas pertinentes. Não fingir W2 entregue nem bloquear frentes independentes.

S25 é único writer de app.tsx, session.tsx, session-side-panel.tsx, settings context e wiring main/index/server. S22 possui traduções. Respeitar scopes/exclusões. Um coordenador controla progress.json; o seletor não adquire locks de sistema. Benchmark reserva hardware e não concorre com builds/capturas pesadas.

## Gates e recibos v3

Na raiz do pacote:

```sh
python3 tools/validate_plan.py
python3 tools/render_issues.py --check
python3 -m unittest discover -s tools -p 'test_*.py' -v
python3 tools/select_work.py --repo /caminho/real/HuGR-Orchestra --jobs 4
python3 tools/select_work.py --show S01-W1-T1
```

Recibos schema 2 exigem três categorias explícitas: performance, visual, native. `evidence_requirements` e os arrays de gates definem a obrigatoriedade por task. NOT_RUN, ausência, estado arbitrário ou NOT_APPLICABLE em categoria obrigatória não desbloqueiam trabalho.

Cada recibo vincula o contrato da task, SHA do código, hashes das provas, critérios exatos, comandos e revisão. Categorias PASS devem apontar ao mesmo build. Leia RECEIPTS-v3.md. O inventário de hashes não autentica resultados; abrir imagens, interpretar métricas/logs e revisar continua obrigatório.

```sh
python3 tools/receipt_template.py S01-W1-T1 --out evidence/S01/W1-T1.draft.json
# Executar, revisar e preencher com dados reais.
python3 tools/seal_receipt.py evidence/S01/W1-T1.draft.json --out evidence/S01/W1-T1.json
python3 tools/validate_evidence.py S01-W1-T1 evidence/S01/W1-T1.json
```

Com --repo, o seletor verifica ancestry e alterações relevantes commitadas/dirty. Sem --repo, source_revision_verified permanece false. Gravar recibos/progress.json não invalida o produto; mapas, fixtures e contratos não recebem exclusão genérica. Rework exige STALE e nova prova dos dependentes.

## Performance e acabamento

Os P01–P12 do pacote continuam alvos, não resultados atingidos: carga com 8 sessões/64 children, histórico longo e streaming; input p95≤50ms/p99≤100ms; hot-tab p95≤100ms; limites incrementais de bundle, memória e idle; zero polling cosmético; nenhum rescan global por delta; nenhuma view extra por layout. Comparar o mesmo build de produção, máquina, fixture, cache e energia. RAF gaps não comprovam frames do compositor.

Q01–Q16 abrangem todas superfícies e microestados: geometria, tipografia, ícones, bordas, contraste, hover/foco, truncamento, loading/empty/error, rolagem e native overlays. Não esconder diferenças mascarando regiões inteiras nem aceitar placeholder de asset como final. Validadores de recibo não julgam beleza nem executam benchmarks.

## GitHub nativo e estado real

Os 39 tickets existem; não os recrie. Relações nativas **não foram aplicadas por esta revisão**. GET dos filhos de #130 retornou []; outras relações não foram auditadas exaustivamente. O script gh do pacote faz preflight, dry-run e leitura posterior, sem substituir pai, remover relações, criar ou fechar tickets.

Projeção v3: 35 pais e 55 dependências não redundantes (118 antes da redução); 56 restrições finas/advisory continuam em PLAN.json. Não transformar uma dependência de task em ciclo de issues inteiras.

A suite das ferramentas passou 83 testes locais, incluindo controles negativos e um repositório Git temporário sintético. Isso não significa Orchestra renderizado, rápido ou pronto. O Mac estava offline; não houve teste do aplicativo. A primeira task continua S01-W1-T1; zero tasks de implementação aprovadas.

Entregue código funcionando, evidência por critério, comparação ao master, medições, run/rollback e estado exato de capacidades. Não faça reset/clean/force-push ou merge com gate falho. Não termine em outro planejamento ou em uma tela bonita isolada.

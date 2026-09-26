# Orchestra — executar a migração visual

Status: planejamento; implementação e benchmarks de produto ainda não executados por esta entrega.

## Missão

Implemente a migração desktop/web do Orchestra para o mock aprovado **Approval flow refactor**. Não proponha identidade nova, não faça outro dashboard e não entregue só Storybook ou tema. Preserve o funcionamento existente. Performance muito alta, baixo consumo e acabamento rigoroso são critérios de aprovação simultâneos.

Base inspecionada: `30d951fcc4a09e708768551c7c6fd38a0efe3da8`. Revalide o HEAD local; não resetar para essa revisão ou transplantar PR histórica inteira. Leia AGENTS.md; branch curta sem slashes; testes e typecheck no package.

## Insumos

O pacote local entregue ao usuário, **Orchestra_Codex_Execution_Plan_v2.zip**, contém o plano completo em PLAN.json, SPEC.md, PERFORMANCE.md, MAP.md, SURFACES.json, OWNERSHIP.md, issues/*.md, scripts de validação/seleção e a imagem. Este arquivo no GitHub é o bootstrap e índice; não presume que o ZIP ou a imagem já estejam neste checkout.

Referência única: `reference/approved.png`, 1672×941, SHA-256 `e839b759e0f93beca37b10cd45700725020a840fee6e97da1e67556b2ffb128d`. Abra a imagem. Se ausente, recupere do pacote do usuário; nunca improvise usando outro batch.

## Composição que não muda

Sidebar estreita à esquerda; topbar de projeto/branch/sessão sobre centro e rail. Centro dominante com conversa, lista de alterações e diff em paralelo, evidência de testes e um único campo de mensagem inferior. Rail com Dock acima de Tasks acima de Atividade, simultaneamente visíveis. Grafite discretamente azulado, azul contido, bordas finas, sombras suaves e paisagem dessaturada na sidebar. Sem roxo, neon, ciano dominante ou editor ocupando o centro por preferência do executor.

Geometria inicial: sidebar230px,topbar44px,rail448px,centroflexível,paddingcentral28px,gap8px,cardpadding12px. Fontecorpo14/20px,meta/code12/16px,título22/28px; raios4/6/8/12px. Valores derivados do raster, não CSS original recuperado. O espaço externo do mock não vira outra janela dentro do Electron.

Tokens: canvas#10161D,shell#131A23,surface#18212A,input#1B232E,selected#1F2B3A,text#E4EAF2,secondary#B4C0CF,muted#8C9DB2,accent#78ADE8,primary#285DC7. Preservar semântica success/error/diff. Usar ThemeProvider V1/V2, não outro sistema.

## Hierarquia publicada

| Épico | Issues de coordenação | Subissues de execução |
|---|---|---|
| #130 Fundação | #134 baseline; #135 tema/primitives/assets | #144–#148 |
| #131 Aplicação inteira | #136 shell/entrada; #137 conversa; #138 settings/dialogs | #149–#157 |
| #132 Capacidades | #139 Dock; #140 Tasks; #141 contexto/governança/Janitor | #158–#164 |
| #133 Gates/entrega | #142 validação; #143 integração | #165–#168 |

Cada épico/issue/subissue/WP/task possui explicitamente: **Definition of Done, Invariants, Quality standards, Completeness criteria, Success criteria**. PLAN.json é o contrato detalhado; os tickets são projeções operacionais. Não substituir axiomas de um filho por “seguir o pai”.

S01=#144,S02=#145,S03=#146,S04=#147,S05=#148,S06=#149,S07=#150,S08=#151,S09=#152,S10=#153,S11=#154,S12=#155,S13=#156,S14=#157,S15=#158,S16=#159,S17=#160,S18=#161,S19=#162,S20=#163,S21=#164,S22=#165,S23=#166,S24=#167,S25=#168.

## Ordem de execução

1. S01 inventaria código/owners/capabilities e confirma insumos. S02 fixa fixture e medição de produção.
2. S03 tema e S05 assets podem avançar separados; S04 primitives segue S03; S22 prepara copy/locales/testes antes do fan-out.
3. Execute lanes prontas por DAG; S09 precede S11, S17 precede S18. S16 fornece contrato nativo a S14/S15. Não deduzir independência por nome de feature.
4. **S25-W1-T1** integra o código. S23 e S24 dependem dessa task, não do fechamento de S25 inteiro.
5. S23 mede; S24 revisa visual/a11y integral. **S25-W1-T2** fecha depois dos dois gates. Mudança de código após os gates invalida a prova afetada e exige nova rodada.
6. S19-W1/S20-W1 entregam UI segura para capacidades atuais/ausentes. W2 de cada uma espera autoridade real das issues externas. Não impedir UI independente nem fingir W2 concluído.

No pacote: `python3 tools/validate_plan.py`; `python3 tools/select_work.py --repo /caminho/do/repo --jobs 4`; `python3 tools/select_work.py --show S01-W1-T1`. Selecione só tasks prontas. Não carregue todo PLAN.json no contexto de cada subagente.

## Ownership e paralelismo

S25 é o único writer de app.tsx,session.tsx,session-side-panel.tsx,settings context e main/index/server de integração. Outros owners entregam componentes/interfaces e patches delimitados; não escrevem simultaneamente nesses arquivos. S12 exclui providers/models de S13. S04 exclui logo de S05. S17 possui dados e S18 apresentação. S15 possui Dock frontend; S16 nativeIPC/bounds. S22 possui locales. Gates devolvem defeitos aos owners.

Comece com até4lanes e uma fila serial de build/benchmark, reduzindo quando o hardware exigir. Benchmark não roda junto com compilação/carga alheia. API registry/client codegen necessários em S19/S20-W2 usam lease serial e geração oficial; nunca edição manual de generated.

## Capacidade real, não mock

Existem front/backend básicos de sessões, composer, modelos/credenciais, diff/terminal, Tasks, Janitor e Dock nativo em dev. O rail simultâneo e projeções incrementais/evidência exigem ligação adicional. PR #12 contém evolução do Dock, não ausência integral do Dock na base. Base close sem tabID fecha todas: single-tab close deve ser explícito.

Own/contexto e governança têm pré-requisitos #109/#112/#108/#114/#106/#113. S19/S20-W2 só acrescentam read projections/consumer necessários após fonte autoritativa existir; não reconstruir Atlas ou approval. W1 usa unavailable/HOLD, não botão cenográfico. Verificar issue fechada não basta: ler implementação e exercitar caminho público.

Atlas não é programador; Dock não é subagente; Janitor continua read-only. Não adicionar porcentagens por tempo/tokens, CPU/RAMcharts, online fictício, teste verde inferido da prosa, nova colaboração/PRqueue ou limpeza destrutiva. Conteúdo de página no Dock é exemplo externo, não novo produto a construir.

## Gates de performance

Objetivos propostos para medir, não resultados já alcançados:
- P1:8sessões×8children,histórico10k/50kparts,100events/s e uma páginaDockfixture. P2:1000files,diff100klines,1000models,log10MiB; P3:30min/50cycles.
- InitialJSgzip delta<=60KiB,CSS<=12KiB,zero runtime deps novas,decoração<=300KiB/decode4MiB.
- Inputpaintp95<=50ms/p99<=100ms; hottabp95<=100ms; renderer coldp95<=1500ms e regressão<=max(5%,50ms).
- Zero nova longtask>100ms atribuível à camada visual; nenhum rescan global por delta. DOM/cachesbounded.
- Zero polling/timers cosméticos em idle. Ticker compartilhado<=1Hz só visível/live. CPUidle delta<=1ponto percentual de um core.
- Heapdelta estabilizado<=20MiB; RSSdelta<=max(32MiB,10%); após50cycles residual<=5MiB e sem tendência crescente. Páginasexternas separadas.
- Nenhuma view extra por layout/tema; bounds<=1update/frame apenas quando mudam; cap20inativas preservado.

Use suite performance existente, hoje diagnóstica/manual. S02 acrescenta gates de budgets com testes negativos. A/B mesma máquina/build/energia/cache/fixture,5pares,20startups e200interactions por variante,amostrasbrutas. RAFgaps não provam compositor. Ausência de métrica=NOT_RUN, nuncaPASS. Não mudar workload/threshold para esconder regressão.

## Gates de acabamento

Conferir todas superfícies/estados, não só sessão: home/new/settings/providers/models/MCP/pickers/palette/toasts/permissions/errors/terminal/context/Janitor/native. Master1672×941 e1440×900/1366×768/1920×1080,1x/2x/zoom200%. Alinhamentos,ícones,raios,tipografia,contrastes,ellipsis,scrollbars,hover/foco/loading/empty/disabled,overlays e assets finais. Defeito de1–2px,jitter,legibilidade ou cor errada é bug, não “polish depois”. Sem fundoanimado/blur caro.

## Entrega e evidência

Cada task fornece SHA,paths,comandos/cwd/exit/logs,critério por ID dos cinco axiomas,capturas/métricas aplicáveis e revisão fria. Arquivo presente/validador de plano verde não prova aplicativo verde. Fixture apenas em teste, sem dados pessoais ou calls pagas. Não reset/clean/stash/kill global, não apagar trabalho alheio, não forçar push ou merge com gate falho.

Entregue código no app existente, screenshotcomparado ao master,coverage completa,performance medida,run/rollback e estado exato das capacidades. Se native não foi testado, não declarar desktop validado. Continuar após a primeira fatia visual: o escopo é toda a UI, não parar para escolher tema outra vez.

## Relações GitHub

Os39tickets estão publicados com hierarquia/dependências textuais. O conector usado nesta sessão não disponibiliza mutation de subissue/dependency nativa; a vinculação nativa não foi executada aqui. O pacote contém GITHUB.json e tools/github_sync.py, idempotente usando gh autenticado: dryrun primeiro; --apply adiciona somente relações desses tickets, sem duplicação, reparenting ou fechamento. Dependências por WP/task não devem virar dependência da issue inteira se isso criar ciclo; PLAN.json permanece a autoridade para execução.

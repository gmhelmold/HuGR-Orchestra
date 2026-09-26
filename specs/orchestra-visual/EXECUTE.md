# Orchestra — entrada de execução v4

A v3 foi reprovada na revisão adversarial. Use **Orchestra_Codex_Execution_Plan_v4.zip**, entregue ao usuário. O pacote contém PLAN.json, SURFACES.json, CENSUS.json, SPEC.md, CONTRACTS.md, PERFORMANCE.md, BUDGETS.json, COVERAGE.json, RECEIPTS-v4.md, tools, issues/*.md, referência original e provas dos reparos.

Este arquivo remoto é apenas o bootstrap. **O plano completo, os scripts e o PNG não foram integralmente publicados nesta branch.** Não alegar leitura desses insumos a partir deste resumo. Os corpos antigos de tickets não substituem os contratos v4 do pacote; a sincronização integral de corpos e relações nativas não foi executada nesta revisão.

## Missão aprovada, sem redesign

Migrar toda a UI desktop/web do Orchestra, com performance, leveza e acabamento simultâneos. Preservar o mock Approval flow refactor: sidebar estreita, conversa dominante, alterações/diff em paralelo, input inferior único, Dock acima de Tasks e Atividade à direita. Grafite discretamente azulado, azul contido, bordas finas, profundidade suave e montanhas dessaturadas. Sem roxo/ciano/neon, sem copiar os layouts exploratórios Claude/Replit.

Referência: reference/approved.png, 1672×941, SHA-256 e839b759e0f93beca37b10cd45700725020a840fee6e97da1e67556b2ffb128d. Base examinada: 30d951fcc4a09e708768551c7c6fd38a0efe3da8; revalidar o checkout, não resetar para ela. Leia AGENTS.md. Preserve trabalho do usuário, permissões e contratos de execução. Não migrar framework nem criar outro runtime/browser/auth/store.

## Hierarquia e estágios

Mantidos os39tickets: épicos #130–133, issues #134–143, subissues #144–168. A v4 acrescenta somente S25-W0 dentro do integrador #168: agora143nós,38WPs,66tasks e1.936critérios nos cinco axiomas explícitos de cada nível.

1. S01 atualiza os canônicos PLAN/SURFACES/CENSUS e deriva MAP/OWNERSHIP/issues. Censo local ainda não foi realizado por esta entrega. Arquivos de UI descobertos precisam de classificação/owner/cobertura, não quatro mapas paralelos.
2. S02 liga a coleta real à suíte de produção. O avaliador numérico v4 já existe no pacote e é recalculado pelo validador; não preencher PASS manualmente.
3. Fundação S03/S04/S05 e entradas necessárias → **S25-W0-T1** produz piloto conectado com controllers existentes. São15pré-requisitos de task, não44. W0-T2 verifica macrocomposição/interações/custo inicial antes de home/settings/providers/Janitor completos. Não equivale a aceite final de microacabamento.
4. S25-W1-T1 integra o restante e produz candidato; S23/S24 medem e revisam; S25-W1-T2 encerra. Critério do produtor não exige conclusão de consumidor futuro.
5. S19/S20-W1 representam capacidades atuais ou ausência segura. W2-T1 entrega adapter/consumer local após autoridade e codegen confirmados; S25 importa quando disponível; W2-T2 prova o caminho live conectado. Ausência de W2 não autoriza dado fictício nem bloqueia UI independente.

## Reparos que mudam a execução

- Contrato efetivo vincula task, regras contínuas dos ancestrais, normas, cobertura, fixture/master e leases. Não reutilizar recibos v3.
- S01/piloto são milestones históricos. Alterar app.tsx legitimamente não invalida todo o programa. Outputs locais e gates finais possuem escopos de revalidação distintos; --affected-by é cone potencial, não reset global.
- Scope vem do diff Git real BASE..HEAD, incluindo renames, dirty/index preexistentes e commits importados. Imports de S25 exigem recibos de origem e blobs finais correspondentes; conflitos voltam ao owner.
- Codegen tem paths autorizados e lock serial. S01 confirma footprint local; o comando oficial gera src/generated e src/generated-effect em packages/client, seguido de check:generated. Não editar generated manualmente nem omitir saídas.
- --jobs limita RUNNING+novas seleções. Excesso anterior gera zero novas alocações, sem cancelar trabalho. Benchmark exige host quieto.
- Dependências externas exigem fonte presente no candidato ou artefato instalado+lockfile de hash conferido, testes públicos positivos/negativos e revisão.
- Captura visual tem matriz de superfície/estado/viewport/DPR/zoom/host/build/fixture/master. PNG1×1 ou truncado não substitui cobertura. Decodificação e métricas não avaliam beleza nem autenticam o executor.

## Executar no pacote

```sh
python3 tools/validate_plan.py
python3 tools/render_maps.py --check
python3 tools/render_issues.py --check
python3 -m unittest discover -s tools -p 'test_*.py' -v
python3 tools/select_work.py --repo /caminho/HuGR-Orchestra --jobs 4
python3 tools/select_work.py --show S01-W1-T1
```

Antes de escrever uma task, capture baseline com tools/capture_scope.py. Use recibo esquema3, critérios exatos, comandos/logs/revisão e --repo para validar a fonte. Sem --repo o seletor não consome PASSs como entregas verificadas. --census-strict reprova enquanto houver UI local não classificada. S25 é único writer dos hotspots; outros owners mantêm scopes disjuntos.

O pacote passou133testes únicos das ferramentas (83preexistentes adaptados +50regressões). Git, métricas, capturas e APIs desses testes são sintéticos. **Não houve implementação do frontend, benchmark do Orchestra, render do aplicativo ou teste Electron nesta correção.** Apenas S01-W1-T1 começa pronta; zero tasks do produto foram pré-aprovadas.

Use REVIEW-v4.md, FINDINGS-RESOLUTION.json e QA_REPORT.md do ZIP para os reparos R01–R10/H01–H03 e seus limites. A escolha visual permanece intacta; o aceite do produto depende dos gates reais, no mesmo SHA/build, não da validação deste documento.

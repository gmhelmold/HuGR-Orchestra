# Orchestra — entrada de execução v4.1

Use **Orchestra_Codex_Execution_Plan_v4.1.zip**, entregue ao usuário. Esta revisão incorpora o kit oficial HuGR à v4, sem mudar o DAG, budgets, layout aprovado ou runtime. O ZIP contém o plano completo, ferramentas, referência da interface e os 304 arquivos intactos do kit em vendor/HuGR-Brand-Kit-v1.0/.

Este arquivo remoto é apenas o bootstrap. **O plano completo, scripts, PNG e kit não foram integralmente publicados nesta branch.** Não alegar leitura desses insumos a partir deste resumo. Os corpos antigos dos tickets não substituem o contrato do ZIP. Nesta passagem foram atualizados este bootstrap, BRAND-INPUT.md e a issue S05/#148; não foi feita sincronização integral dos 39 corpos nem vinculação nativa.

## Marca recebida, layout preservado

Leia BRAND-INPUT.md neste diretório. No pacote, leia BRAND-INTEGRATION.md, BRAND-ASSETS.json e o handoff original do kit antes de executar S05.

O master Approval flow refactor permanece a referência de layout/tema: 1672 × 941, SHA-256 e839b759e0f93beca37b10cd45700725020a840fee6e97da1e67556b2ffb128d. Sidebar estreita, conversa dominante, alterações/diff em paralelo, input inferior único, Dock acima de Tasks e Atividade à direita. Grafite discretamente azulado, azul contido, bordas finas, profundidade suave e montanhas dessaturadas.

A marca HuGR fornecida é a referência do símbolo. Não reconstruir/vetorizar/otimizar/reexportar o elo ilustrativo nem os logos HuGR. Use os SVGs primary/inverse externos, escolhidos pelo tema real, sem React novo ou ThemeProvider paralelo. Orchestra continua nome do produto, em texto separado; não criar lockup vetorial ou mudar appId/manifest/identidade instalada. Os tokens de tema do kit não substituem SPEC.md. A paisagem continua uma entrega separada.

Kit recebido SHA-256: 9c75596e259593c7b6e2ac9818c6358f207f7e4f9129fec3b93dbf3042fdd115. Só os dois símbolos são cópias obrigatórias da primeira fatia; ícones/wordmarks adicionais exigem consumidores reais. Não copiar todos os assets, guias ou templates para public. Integridade do kit não significa integração pronta.

## Missão e estágios

Migrar toda a UI desktop/web, com performance, leveza e microacabamento simultâneos. Revalidar o checkout a partir da base documentada 30d951fcc4a09e708768551c7c6fd38a0efe3da8; não resetar para ela. Ler AGENTS.md e preservar trabalho do usuário. Não migrar framework nem criar outro runtime/browser/auth/store.

Permanecem 4 épicos, 10 issues, 25 subissues, 38 WPs e 66 tasks. Epics #130–133; issues #134–143; subissues #144–168. Cinco axiomas explícitos em cada nível. PLAN.json e suas projeções locais são a fonte detalhada.

1. S01 confirma referência e kit; atualiza PLAN/SURFACES/CENSUS e deriva MAP/OWNERSHIP/issues. Censo local ainda não foi realizado por esta entrega. UI descoberta exige classificação/owner/cobertura.
2. S02 liga a coleta real ao avaliador quantitativo de produção; não preencher PASS manualmente. S03/S04/S05 entregam tema/primitives/assets com fontes oficiais.
3. S25-W0-T1 produz piloto conectado usando controllers existentes, após 15 pré-requisitos de task; W0-T2 confere macrocomposição, foco, scroll e custos iniciais antes de settings/providers/Janitor completos.
4. S25-W1-T1 integra o restante e produz candidato; S23/S24 medem/revisam; S25-W1-T2 encerra. O produtor não exige aprovação de consumidores futuros.
5. S19/S20-W1 representam capacidades atuais ou ausência segura. W2 exige fonte autoritativa e codegen confirmados. Sem W2, não alegar capacidade live nem bloquear a UI independente.

## Executar no pacote

```sh
python3 tools/verify_brand.py
python3 tools/validate_plan.py
python3 tools/render_maps.py --check
python3 tools/render_issues.py --check
python3 -m unittest discover -s tools -p 'test_*.py' -v
python3 tools/select_work.py --repo /caminho/HuGR-Orchestra --jobs 4
python3 tools/select_work.py --show S01-W1-T1
```

Antes de escrever, capture a baseline com tools/capture_scope.py. Use recibos esquema 3, critérios exatos, comandos/logs/revisão e --repo. Sem --repo não há PASS de fonte verificado. --census-strict reprova enquanto houver UI não classificada. S25 é o único writer de hotspots; outras frentes preservam scopes disjuntos.

O contrato efetivo inclui normas e registros da marca. Não reaproveitar recibos antigos apenas recalculando hashes. Censo/piloto são marcos históricos; outputs e gates finais têm revalidação própria. Imports entre owners exigem recibos e blobs correspondentes; conflitos voltam ao owner. Codegen permanece serializado e gerado pelo comando oficial. --jobs limita RUNNING+novas seleções; benchmark exige host quieto.

Capturas cobrem superfície/estado/viewport/DPR/zoom/host/build/fixture/master. O novo símbolo é uma exceção de marca localizada ao raster antigo, não permissão para mascarar a sidebar. Métricas são recalculadas das observações do mesmo build bonito. Nenhum blur, polling ou animação extra para exibir o logo. Os budgets não foram aumentados.

## Estado real

151 testes das ferramentas passaram nesta revisão: 133 preexistentes e 18 de integração de marca/arquivos. Cópias, Git e outras fixtures dos testes são sintéticos. Nenhum frontend, render do aplicativo, benchmark do Orchestra, teste Electron ou instalação de ícone nativo foi executado. Nenhuma task de produto foi marcada PASS. Os assets ainda não foram instalados no repositório.

Leia BRAND-INTEGRATION-REVIEW.md e QA_REPORT.md do pacote para a revisão atual; REVIEW-v4.md/FINDINGS-RESOLUTION.json preservam o histórico de correções anterior. Entregue aplicativo real, medições, comparação visual, execução/rollback e estado exato de capacidades. Não fechar com gate reprovado ou apenas documentos/imagens.
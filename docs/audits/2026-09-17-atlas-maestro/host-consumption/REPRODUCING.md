# Reprodução — WP-HOST-01

Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Execute somente em checkout descartável. O preload original isola HOME/XDG, configuração de provedores e SQLite em memória; os scripts usam fontes Git temporárias e um provedor HTTP local com respostas programadas, não inferência paga.

Ambiente executado: macOS, Node 22.17.1, Bun 1.3.14. Dependências desta rodada foram reutilizadas de outro checkout da mesma revisão. Para preparação limpa, usar o lockfile do monorepo (`bun install --frozen-lockfile`) e o do Atlas (`npm ci` em foundation/atlas). Isso é uma instrução de preparação, não alegação de instalação hermética feita nesta rodada.

## Preparação

PRODUCT é o caminho absoluto real do produto descartável. BUNDLE é este diretório documental, que pode estar em outro checkout. OUT é um diretório vazio de resultados. Use caminhos canônicos para invocar o materializador.

```sh
PRODUCT=/absolute/path/to/disposable-product
BUNDLE=/absolute/path/to/host-consumption
OUT=/absolute/path/to/empty-audit-results
mkdir -p "$OUT"
test "$(git -C "$PRODUCT" rev-parse HEAD)" = b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7
cp "$BUNDLE/probes/audit-host-context.test.ts" "$PRODUCT/packages/opencode/test/session/audit-host-context.test.ts"
cp "$BUNDLE/probes/audit-host-routes.test.ts" "$PRODUCT/packages/opencode/test/session/audit-host-routes.test.ts"
cd "$PRODUCT/foundation/atlas"
bun run typecheck
```

A publicação mantém os diagnósticos fora da árvore ativa do produto. Eles afirmam o comportamento observado, incluindo o defeito, e não são correções ou regressões verdes do requisito final.

## Execuções finais

```sh
cd "$PRODUCT/packages/opencode"
ATLAS_ROOT="$PRODUCT/foundation/atlas" AUDIT_OUT="$OUT/context-first.json" \
  bun test test/session/audit-host-context.test.ts --timeout 60000
AUDIT_ROUTES_OUT="$OUT/routes-first.json" \
  bun test test/session/audit-host-routes.test.ts --timeout 60000

ATLAS_ROOT="$PRODUCT/foundation/atlas" AUDIT_OUT="$OUT/context-second.json" \
AUDIT_ROUTES_OUT="$OUT/routes-second.json" \
  bun test test/session/audit-host-context.test.ts test/session/audit-host-routes.test.ts --timeout 60000
```

Primeiro conjunto: 12 cenários de contexto e 2 de rotas. Segundo: 14 casos em novo processo com fixtures independentes. Os coletores saíram com 0 por reproduzir suas observações; isso não torna correto o produto.

```sh
python3 "$BUNDLE/probes/check-evidence.py" "$OUT/context-first.json"
python3 "$BUNDLE/probes/check-evidence.py" "$OUT/context-second.json"
```

Cada verificador sai com **1** na revisão auditada: cinco controles corretos e seis violações de atualidade. O caso de histórico retido é observado separadamente.

O arquivo context-first.exit é da execução final isolada de contexto. Os resultados context-second e routes-second correspondem juntos ao independent-second.log/.exit. Não existe um resultado de processo separado para cada arquivo JSON da execução conjunta.

## Baselines executados

```sh
cd "$PRODUCT/packages/opencode"
bun test test/maestro test/skill/skill.test.ts --timeout 60000
# 49 pass, 0 fail, 8 files
cd "$PRODUCT/packages/core"
bun test test/agent.test.ts test/location-layer.test.ts test/tool-skill.test.ts \
  test/skill.test.ts test/skill/guidance.test.ts --timeout 60000
# 19 pass, 0 fail, 5 files
```

## Fronteira e limitações dos diagnósticos

Materializador, verificador, descoberta, agente, registro, sessão, projetor e serialização são originais. TestLLMServer fornece respostas programadas. SessionSummary é neutralizado na composição interna; isso não substitui a validação de Own. As variantes HTTP usam o roteador original em processo, sem lançar CLI/UI. O endpoint de provedor usa HTTP local real. Permissões explicitamente aceitas e banco em memória não provam autorização negativa ou recuperação durável.

Warm prima a skill antes da edição; cold altera a fonte antes do primeiro carregamento da skill. Nos controles de skill ausente/ordinária, READY refere-se ao Own-controle materializado, não a uma skill inexistente ou não Own. O verificador também inspeciona o conteúdo recebido.

setup-missing-projector.* preserva nove falhas iniciais de montagem do teste, não defeitos de produto. initial-nine-cases.* preserva a versão exploratória anterior aos casos HTTP/histórico; esses casos se sobrepõem ao conjunto final. A versão inicial de setup pode ser obtida da versão exploratória removendo o SessionProjector e MessageV2 do grupo, mas não precisa ser reexecutada para demonstrar os resultados corrigidos.

source-reads.jsonl registra intervalos de leitura; consumer-search.txt é apenas busca textual. source-verification.json registra identidade de fontes e comparações compiladas. SHA256SUMS pode ser verificado com `shasum -a 256 -c SHA256SUMS` neste diretório. requestBodyHash não é o checksum dos JSONs: ele refere-se ao corpo completo original, enquanto a publicação preserva mensagens e nomes de ferramentas.

A primeira tentativa de gravar o relatório em um comando grande foi bloqueada antes de executar; os arquivos estavam ausentes e foram escritos depois por operações explícitas de arquivo. Esse bloqueio não é um resultado de teste e não conta como publicação.

Na preparação da publicação, git diff --check detectou espaços finais no log de erro de setup. Somente esses espaços de fim de linha foram removidos na cópia publicada; resultados e mensagens foram preservados. Os JSONs das capturas não foram normalizados.

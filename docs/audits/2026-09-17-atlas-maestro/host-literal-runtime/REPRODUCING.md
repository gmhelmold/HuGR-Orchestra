# Reprodução em checkout descartável, sem sobrescrever evidências

Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Use um clone descartável novo, não a árvore de trabalho do usuário. Instale as dependências conforme os lockfiles do repositório e do subprojeto Atlas. As execuções registradas reutilizaram dependências: não são instalação hermética.

Os probes atuais têm dois modos: `AUDIT_EXPECT=observed` caracteriza o comportamento existente; `AUDIT_EXPECT=desired` exige fidelidade do literal/acordo com a nova fonte. O segundo **falha no produto auditado**. Os resultados históricos originais pertencem à versão dos probes no commit `a360219b`; consulte [a revisão](review/REVIEW.md) para não misturar versões.

## Preparação e ambiente mínimo

Na raiz do clone descartável do produto, defina `AUDIT` como caminho absoluto deste pacote publicado, que pode estar em outro checkout. `RUN` é um diretório novo para resultados, nunca `AUDIT/evidence`.

```sh
ROOT="$(pwd -P)"
AUDIT="/caminho/absoluto/para/host-literal-runtime"
[ "$(git rev-parse HEAD)" = b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7 ] || exit 1
[ -z "$(git status --porcelain)" ] || exit 1
[ ! -e packages/core/test/audit-skill-replacement.test.ts ] || exit 1
[ ! -e packages/opencode/test/session/audit-own-literal.test.ts ] || exit 1
RUN="$(mktemp -d)"
mkdir -p "$RUN/home" "$RUN/data" "$RUN/cache" "$RUN/config" "$RUN/state"
cp "$AUDIT/probes/audit-own-literal.test.ts" packages/opencode/test/session/
cp "$AUDIT/probes/audit-skill-replacement.test.ts" packages/core/test/
isolated() {
  env -i PATH="$PATH" HOME="$RUN/home" OPENCODE_TEST_HOME="$RUN/home" \
    XDG_DATA_HOME="$RUN/data" XDG_CACHE_HOME="$RUN/cache" \
    XDG_CONFIG_HOME="$RUN/config" XDG_STATE_HOME="$RUN/state" \
    OPENCODE_DISABLE_MODELS_FETCH=true \
    GIT_AUTHOR_NAME="Audit Fixture" GIT_COMMITTER_NAME="Audit Fixture" \
    GIT_AUTHOR_EMAIL=audit@example.invalid GIT_COMMITTER_EMAIL=audit@example.invalid "$@"
}
(cd "$ROOT/foundation/atlas" && isolated bun run typecheck)
for MODE in observed desired; do
  (cd "$ROOT/packages/core" && isolated AUDIT_EXPECT="$MODE" AUDIT_OUT="$RUN/$MODE-core.json" \
    bun test test/audit-skill-replacement.test.ts --timeout 60000) >"$RUN/$MODE-core.log" 2>&1
  echo "$?" >"$RUN/$MODE-core.exit"
  (cd "$ROOT/packages/opencode" && isolated AUDIT_EXPECT="$MODE" AUDIT_OUT="$RUN/$MODE-host.json" \
    ATLAS_ROOT="$ROOT/foundation/atlas" bun test test/session/audit-own-literal.test.ts --timeout 60000) >"$RUN/$MODE-host.log" 2>&1
  echo "$?" >"$RUN/$MODE-host.exit"
done
printf 'Resultados: %s\n' "$RUN"
```

Não habilite `set -e` nesse laço: desired deve produzir exit 1 no produto auditado, e o código precisa ser registrado. **Exit 1 sozinho não comprova o defeito**: confira nomes das falhas, controles e todos os registros. O modo observed não é um teste de aceitação. Cada processo exige arquivo `AUDIT_OUT` novo; para repetir, crie outro diretório RUN ou outros nomes. Saída existente é recusada antes do coletor poder sobrescrevê-la.

## Baseline e typecheck

Ainda com a função `isolated` definida:

```sh
(cd "$ROOT/packages/core" && isolated bun test test/state.test.ts test/skill.test.ts test/tool-skill.test.ts test/skill/guidance.test.ts --timeout 60000)
(cd "$ROOT/packages/opencode" && isolated bun test test/maestro test/skill/skill.test.ts test/tool/skill.test.ts --timeout 60000)
(cd "$ROOT/packages/core" && isolated bun run typecheck)
(cd "$ROOT/packages/opencode" && isolated bun run typecheck)
```

Na revisão: 12 testes Core e 51 host passaram; três typechecks passaram. Desired: host 4 pass/5 fail e Core 3 pass/2 fail. O caso de diretório impõe a propriedade de acordo após substituição explícita; não inventa uma política já implementada de watcher.

## O que comparar

Own: compare o trecho entre `AUDIT_LITERAL_BEGIN` / `AUDIT_LITERAL_END` em `renderedArtifact` com `capturedMessages`. `observed` é apenas uma projeção dessa captura. `sourceReadback` contém a fonte realmente lida; seu Git blob deve coincidir com `sourceBlob`. As verificações before/after releem artefato e manifesto; o teste também compara o artefato byte a byte. O comando ordinário deve interpolar; o texto factual de Own não.

V2: `afterDisposal` deve ficar vazio. Para embedded, a fonte ativa está em `sources[0].skill.content`; compare com `listed`, `reloaded` e `tool.value`. Para diretórios, `currentDiskContent` é readback real. O antigo campo histórico `currentDiskOrEmbeddedContent` era o valor esperado da fixture, não uma leitura independente; os JSONs antigos foram preservados com essa qualificação.

As capturas são gravadas antes das assertions desejadas, permitindo inspecionar as falhas. Não existe checker separado executado nesta rodada ou na original; agora a própria execução original é acompanhada de assertions explícitas de aceitação e rechecagem dos dados capturados.

## Limites e limpeza

Provedor HTTP local com respostas programadas, sem inferência; SessionSummary neutralizado; SQLite em memória. Core usa permissão explicitamente permitida e a variante original `ToolOutputStore.nodeWithoutConfig`. Não há sessão V2 completa, UI, autorização real ou recuperação da mesma sessão após restart. Templates shell não são usados.

Depois de preservar os resultados, remova somente as duas cópias de probes que você criou no clone descartável. Não altere nem apague dados de uma árvore de trabalho real. O diretório RUN conserva a evidência; não use seus arquivos para substituir resultados históricos publicados.

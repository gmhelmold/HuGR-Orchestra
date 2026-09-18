# Reprodução em checkout descartável

Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Nunca copie estes coletores para uma árvore de trabalho com alterações do usuário. Eles caracterizam o defeito atual; após corrigir o produto, substitua as expectativas observacionais pelas propriedades desejadas das issues.

## Preparação

Use as dependências do lockfile do repositório e do subprojeto Atlas. A execução registrada reutilizou uma instalação existente, com 38 links documentados; não se anuncia instalação limpa. Preserve o preload de testes original. O runner usado forneceu somente PATH/TMPDIR/LANG/LC_ALL herdados e HOME, OPENCODE_TEST_HOME, quatro diretórios XDG, OPENCODE_DISABLE_MODELS_FETCH=true e identidade Git de teste. Nenhuma chave de inferência foi herdada.

```sh
# A partir da raiz do checkout descartável, após instalar suas dependências:
ROOT="$PWD"
AUDIT=/caminho/para/este/pacote
mkdir -p "$AUDIT/evidence"
cp "$AUDIT/probes/audit-own-literal.test.ts" packages/opencode/test/session/
cp "$AUDIT/probes/audit-skill-replacement.test.ts" packages/core/test/
(cd foundation/atlas && bun run typecheck)
# Defina HOME/XDG isolados para o processo de teste; mantenha PATH para Node/Bun/Git.
(cd packages/core && AUDIT_OUT="$AUDIT/evidence/v2-replacement-1.json" bun test test/audit-skill-replacement.test.ts --timeout 60000)
(cd packages/opencode && ATLAS_ROOT="$ROOT/foundation/atlas" AUDIT_OUT="$AUDIT/evidence/host-literal-1.json" bun test test/session/audit-own-literal.test.ts --timeout 60000)
# Repita cada comando em um processo novo com sufixo -2.json.
(cd packages/core && bun test test/state.test.ts test/skill.test.ts test/tool-skill.test.ts test/skill/guidance.test.ts --timeout 60000)
(cd packages/opencode && bun test test/maestro test/skill/skill.test.ts test/tool/skill.test.ts --timeout 60000)
(cd packages/core && bun run typecheck)
(cd packages/opencode && bun run typecheck)
```

## Oráculos, sem confundir caracterização com aceitação

Em cada registro host, compare `renderedArtifact` e `original` com a linha entre AUDIT_LITERAL_BEGIN/AUDIT_LITERAL_END em `capturedMessages`, efetivamente recebida pelo servidor HTTP. Só o comando ordinário deve interpolar intencionalmente. `before` e `after` ficam READY e o teste compara o arquivo original após o consumo. Cinco casos Own divergiram por rodada; quatro controles funcionaram.

Em cada registro V2, `afterDisposal` deve estar vazio. Para embedded, a própria `sources[0].skill.content` é a nova entrada autoritativa B; compare-a com `listed`, `reloaded` e a saída `tool.value`. O arquivo de diretório foi alterado pelo probe antes de registrar novamente a fonte. Dois ciclos entregaram A, três controles entregaram B. O caso embedded não depende de filesystem watcher.

Não execute ou anuncie um checker separado: sua criação nesta rodada não ocorreu. Os resultados brutos, os testes executados e as comparações acima são a evidência disponível. `pass` nos logs significa que o comportamento observado foi reproduzido, não que o literal foi preservado ou o cache corrigido.

## Limites

O servidor de provedor tem respostas programadas, não um LLM. O host usa seu SessionPrompt original diretamente; a ferramenta V2 usa o registro original, com a permissão explicitamente permitida na fixture. Não se lança uma sessão Core V2 completa. SQLite é em memória. Repetir um teste em outro processo não prova recuperação da mesma sessão durável. Não se executam templates shell.

# Execuções e reprodução

## Resultado próprio deste ciclo

| Execução | Resultado | Limite |
|---|---|---|
| Rebuild original `npm run build -- --force` | exit 0 | Compilação, não aceite funcional |
| Suite Memory/Orientation selecionada | 50 testes, 4 arquivos, todos passaram | Não é a suíte integral do Atlas |
| Dois testes originais de Task/resume | 2 passaram; 24 filtrados | Prompt operations substituídas pela fixture original |
| Dois testes adicionais do recorder Maestro | 2 passaram | Serviços/SQLite originais; sem LLM |
| Admissões Maestro idênticas concorrentes | 24/24 retornaram; nenhum erro | Três schedules de oito chamadas, não prova universal de linearizabilidade |
| Diagnósticos de componentes Memory | 6 observações verificadas | Scanner nomeado substituído; kernel/store/fold originais |
| Histórias públicas MCP | 4 observações verificadas | Scanner real; arquivos/Git/processos reais |
| Corrida de logbook via MCP | 3/3 rodadas com 2 admissões e 2 registros por PR | Dois processos; frequência fora destes schedules não medida |

Ambiente: Node `v22.17.1`, Bun `1.3.14`, `darwin`, gitleaks `8.30.1`. O checkout de produto permaneceu limpo em arquivos rastreados.

## Repetir os diagnósticos

Use um checkout descartável do commit auditado com as dependências do repositório já instaladas. As variáveis abaixo são caminhos absolutos; AUDIT aponta para este diretório. Os probes criam apenas fixtures temporárias e escrevem evidências em OUT. Não execute no armazenamento de produção do usuário.

```sh
PRODUCT=/absolute/path/to/HuGR-Orchestra
AUDIT=/absolute/path/to/lifecycle-round3
OUT=/absolute/path/to/new-evidence
mkdir -p "$OUT"
cd "$PRODUCT/foundation/atlas"
npm run build -- --force
node "$AUDIT/probes/memory-lifecycle.mjs" "$PRODUCT/foundation/atlas" "$OUT"
node "$AUDIT/probes/memory-mcp.mjs" "$PRODUCT/foundation/atlas" "$OUT"
node "$AUDIT/probes/memory-concurrency.mjs" "$PRODUCT/foundation/atlas" "$OUT"
```

Os dois programas MCP exigem scanner gitleaks funcional no PATH. A ausência não deve ser contornada por uma implementação que aceite tudo; a recusa do produto seria um resultado de ambiente, não a reprodução destas histórias.

Para os testes originais selecionados:

```sh
cd "$PRODUCT/foundation/atlas"
./node_modules/.bin/vitest run packages/adapter-io/test/memory-store.test.ts packages/adapter-io/test/memory-read.test.ts packages/adapter-io/test/memory-emit.test.ts packages/adapter-io/test/orientation-store.test.ts --maxWorkers=1 --minWorkers=1
cd "$PRODUCT/packages/opencode"
bun test test/tool/task.test.ts -t 'execute resumes an existing task session from task_id|execute creates a child when task_id does not exist'
```

Para a sondagem adicional do Maestro, o arquivo precisa resolver as dependências do package opencode. Nesta execução, um link `probes/node_modules` no diretório descartável apontava para `packages/opencode/node_modules`; esse link não faz parte da publicação. A execução foi feita de `packages/opencode`, preservando o preload de testes do projeto que isola XDG/configuração e usa SQLite de teste.

```sh
cd "$PRODUCT/packages/opencode"
AUDIT_PRODUCT_ROOT="$PRODUCT" AUDIT_CONCURRENCY_OUTPUT="$OUT/maestro-concurrency.json"   bun test --tsconfig-override ./tsconfig.json "$AUDIT/probes/maestro-concurrent.test.ts"
```

O Bun reportou aviso interno de tsconfig nessa execução; os dois testes passaram. Não foi inferida falha do produto a partir desse aviso.

## Correções do experimento

O primeiro probe MCP esperava `body.ok`, um campo do verdict interno que não é mantido na serialização MCP. A falha foi do probe. A validação final usa o estado de erro público e os dados efetivamente serializados. A flag CLI foi corrigida de `--taskId` para `--task-id`; apenas a invocação final sustenta a conclusão sobre o resultado CLI. Os arquivos `initial-memory-mcp.*` preservam a primeira tentativa.

Os diagnósticos são deliberadamente descritivos do baseline: passam ao confirmar a observação especificada, inclusive quando ela é uma falha do produto. Os critérios de aceite nas issues definem o comportamento que os futuros testes de regressão devem exigir após a correção.

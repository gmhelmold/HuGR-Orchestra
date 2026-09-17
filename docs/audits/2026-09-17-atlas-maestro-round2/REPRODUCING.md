# Reprodução e interpretação dos resultados

## Ambiente observado

Produto b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7; macOS, Node 22.17.1, Bun 1.3.14, gitleaks 8.30.1. Os probes importam as implementações originais. Os testes do host usam o harness real de serviços; a permissão de leitura no teste de skill é concedida pela fixture. Não há provider ou chamada LLM real nesses probes.

Dependências existentes foram reutilizadas na auditoria. O Atlas foi recompilado com `npm run build -- --force`. Não se afirma que a instalação original de dependências foi realizada nesta rodada. As instruções abaixo são para um checkout descartável; não copiar testes diagnósticos sobre arquivos de trabalho existentes.

## Preparação

Parta da raiz de um checkout isolado que contenha o código do commit auditado e esta documentação. ATLAS_ROOT deve ser um caminho absoluto/canônico; isso também evita o problema de entrada por symlink já registrado em #31.

```sh
export REPO="$(pwd -P)"
export ATLAS_ROOT="$REPO/foundation/atlas"
export DOC="$REPO/docs/audits/2026-09-17-atlas-maestro-round2"
export AUDIT_ROOT="$(mktemp -d)"
mkdir -p "$AUDIT_ROOT/fixtures" "$AUDIT_ROOT/evidence"

# Necessário quando as dependências ainda não estiverem instaladas:
(cd "$ATLAS_ROOT" && npm ci)
(cd "$REPO" && bun install --frozen-lockfile)
(cd "$ATLAS_ROOT" && npm run build -- --force)
gitleaks version
```

O probe de memória exige gitleaks instalado. O scanner real recebe somente os records sintéticos via stdin. Ausência de scanner deve bloquear a escrita; não substituir por uma função que sempre aprova apenas para obter os mesmos resultados.

## Memória e Orientation — #32, #33, #34, #37

```sh
node "$DOC/probes/memory-round2.mjs" --assert-invariants
```

O script cria repositórios pequenos em `$AUDIT_ROOT/fixtures`, usa `composeRuntime` e grava `evidence/memory-round2.json`. São 12 cenários: três caudas de log, dois replays, uma sequência de versões, quatro seções de logbook, duas sequências causais de Orientation.

Na base auditada o comando termina em **1** porque as expectativas desejadas não são satisfeitas. Isso é um diagnóstico negativo, não uma falha de instalação. Erro de import/scanner ou controle inicial recusado é outra falha e não pode ser contado como reprodução do defeito.

O caso Orientation chama o adapter diretamente. A porta de leitura do runtime consome esse adapter, mas não foi executado um produtor automático de estados. Não misturar os dois níveis de evidência.

## Publicação Own — #35

```sh
node "$DOC/probes/own-replacement-race.mjs" --assert-invariants
```

Um controle serial e três schedules concorrentes usam a função original exportada `replaceOwnTargets`, com dois subprocessos. Uma barreira para A somente após o rename real; B conclui; A retoma. Os arquivos e renames são reais. O scheduler não substitui resultados de filesystem. O relatório fica em `evidence/own-replacement-race.json`.

Na base auditada o comando termina em **1** e registra `afterB = B/B`, `afterA = old/B`. O fixture de publicação usa marcadores mínimos para observar gerações; ele não é um teste de validação do esquema inteiro de snapshot. As demais verificações da CLI são exercitadas no teste de host abaixo. Também não é um teste de crash, NFS ou frequência espontânea da corrida.

## Host e Maestro

Em um checkout descartável, copie os testes para as pastas correspondentes. Os imports relativos dependem dessas posições.

```sh
set -eu
test ! -e "$REPO/packages/opencode/test/maestro/audit-round2-concurrency.test.ts"
test ! -e "$REPO/packages/opencode/test/tool/audit-round2-own.test.ts"
cp "$DOC/probes/audit-round2-concurrency.test.ts" "$REPO/packages/opencode/test/maestro/"
cp "$DOC/probes/audit-round2-own.test.ts" "$REPO/packages/opencode/test/tool/"
cd "$REPO/packages/opencode"

AUDIT_OUT="$AUDIT_ROOT/evidence/maestro-concurrency.json"   bun test --timeout 60000 test/maestro/audit-round2-concurrency.test.ts

AUDIT_OUT="$AUDIT_ROOT/evidence/host-own.json"   bun test --timeout 60000 test/tool/audit-round2-own.test.ts
```

**Maestro concurrency:** expectativa observada é exit 0. Um teste agregado faz três rodadas de oito admissões e três rodadas de oito apresentações idênticas concorrentes, além de controles/replays sequenciais. Todas as chamadas concorrentes concluíram. Não contar 48 invocações como 48 testes independentes, nem generalizar para concorrência multiprocesso não exercitada.

**Host Own:** expectativa na base auditada é exit 1, com um teste fresh passando e dois testes stale falhando. O teste cria uma revisão/blob Git real, adapta uma entrada sintética revisada e invoca a CLI materializadora original. Depois altera a fonte e confronta o verificador original com o resultado da ferramenta original do host. Não usa texto de receipt inventado nem verdict de freshness mockado. A fixture concede permissão à skill, como nos testes originais; ela não prova autorização nem execução governada com LLM.

## Suítes originais executadas nesta rodada

Execute em árvore sem os testes adicionais dentro de `test/maestro`, para não misturar seus resultados com os da suíte original:

```sh
(cd "$ATLAS_ROOT" && npm test --   packages/memory/test   packages/adapter-io/test/memory-emit.test.ts   packages/adapter-io/test/memory-store.test.ts   packages/adapter-io/test/memory-read.test.ts   packages/adapter-io/test/orientation-store.test.ts)

(cd "$REPO/packages/opencode" && bun test --timeout 60000   test/maestro test/tool/skill.test.ts test/skill/skill.test.ts)
```

Resultados observados: memória/Orientation 158 testes em 17 arquivos; host 51 testes em 9 arquivos. Ambos passam. Repetições não foram adicionadas ao total de 209 testes originais.

## Captura e cadeia de evidência

Cada comando auditado tem stdout/log e `.exit` quando aplicável. O shell que grava o código pode retornar zero após um teste retornar um; consulte o `.exit`. Os JSONs registram o resultado por cenário e controles. `source-ledger.json` confronta arquivos com blobs do commit. `manifest.json` registra SHA-256 dos documentos, scripts e evidências publicados, excluindo a si mesmo.

A publicação é somente de documentação e probes. Alterações ao produto, alteração dos seus contratos e fechamento das issues requerem trabalho separado com nova evidência antes/depois.

# Reproduzir a auditoria de fronteiras

Produto: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Todos os probes são diagnósticos: saída 0 confirma as observações do código auditado, inclusive defeitos. Não são testes de aceitação de uma correção.

## Atlas

Use um checkout descartável do SHA acima. Instale as dependências declaradas pelo pacote Atlas e execute seu script `bun run typecheck` em `foundation/atlas`. Os testes originais não exigem mudanças de produto. O ambiente medido usou Node 22.17.1 e Bun 1.3.14 no macOS Intel, com dependências previamente instaladas.

Coloque o diretório dos probes onde Node resolva os pacotes de `foundation/atlas/node_modules` (por exemplo, dentro de um diretório temporário local a esse pacote ou com link de node_modules no diretório pai dos probes). Não acrescente credenciais reais. O código cria fixtures próprias de Git/Atlas com identidade e política sintéticas.

```sh
node probes/graph-probes.mjs /absolute/checkout/foundation/atlas /absolute/output/graph.json
node probes/mcp-graph.mjs /absolute/checkout/foundation/atlas /absolute/output/mcp.json
```

O primeiro instrumento usa módulos compilados originais; o segundo usa servidor e cliente MCP originais. O SCIP é protobuf controlado, não uma execução do indexador. O primeiro deixa fixtures sob o diretório temporário do macOS para inspeção. O segundo encerra cada servidor e limpa suas próprias fixtures em finally.

## Maestro

O teste `probes/maestro-dispatch.test.ts` é destinado a ser copiado para `packages/opencode/test/maestro/audit-graph-dispatch.test.ts` **somente em um checkout descartável com as dependências do host instaladas**. Os imports relativos foram escritos para esse local, seguindo o harness já existente.

```sh
cd /absolute/checkout/packages/opencode
AUDIT_RESULT=/absolute/output/dispatch.json bun test --timeout 60000 test/maestro/audit-graph-dispatch.test.ts
```

Esse teste prepara apresentação e decisão com funções internas e uma fixture de apresentação visível. Ele NÃO habilita nem demonstra a ferramenta pública de apresentação. Model prompt e metadata são as portas explicitamente instrumentadas; modelo sem rede, callback com falha deliberada. Sessões, eventos e banco são reais.

A primeira tentativa faltava preload devido à instalação incompleta do clone. A seguinte usou o timeout padrão de cinco segundos e expirou, embora imprimisse observações. O log `maestro-dispatch-second.log` é a execução válida, com 2 pass / 0 fail; `original-maestro-suite.log` registra os 32 testes originais. Não atribua falhas do instrumento ao produto.

## Conteúdo e integridade

`MANIFEST.sha256` registra hashes de todos os arquivos publicados neste pacote, exceto ele próprio. Os JSONs de resultados incluem dados sintéticos e caminhos de fixtures. Nenhuma credencial ou banco de sessão real foi incluído. O inventário é de paths rastreados, não bytes do produto. O pacote documental não altera o produto nem fecha automaticamente issues.

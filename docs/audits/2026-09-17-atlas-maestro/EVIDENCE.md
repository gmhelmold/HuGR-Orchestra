# Registro de experimentos

Base: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Node 22.16.0; TypeScript 5.8.3; Git real. Os probes e JSONs completos são entregues no pacote offline da auditoria; este documento registra resultados e limites, não a suíte oficial.

## Integridade das fontes efetivamente executadas

| Arquivo | Git blob conferido |
|---|---|
| retrieval/src/own-snapshot.ts | 758a4b4df5165d0cdc2d2c773cfcd652a6b4ce6e |
| retrieval/src/own-artifact.ts | 3f8ff4c6d7f01b6e2071652b764b06680798420b |
| retrieval/src/own-coverage.ts | 8c6b7125a11d62dd27f63488fda7ef2541acf644 |
| scripts/materialize-own-snapshot.mjs | ce9f1eb4a23a6358f3c2bae781f4022cce1dd8c0 |
| harness/gates/own-snapshot-guard.mjs | 3f0a7efdde4f94e21d9977b86bb9ba9d96455c7a |
| opencode/src/maestro/approval.ts | d0052a0a0c7aa1546328906ef8b333a757cf6547 |

Os três primeiros ficam em foundation/atlas/packages; os dois scripts em foundation/atlas; o último em packages/opencode. O hash foi calculado sobre o preimage Git `blob <byte_length>\0<bytes>` e confrontado com o blob do conector. Não se afirma essa verificação independente para todos os demais arquivos lidos.

## Funções originais de Own — 10 casos

Valid snapshot; nomes canônicos distintos; drill sem destino aceito indevidamente; destino incluído válido; três checks discriminados incorretamente renderizados como undefined; checks válidos; COMPLETE sem autoridade de entrada; observação de manifest não renderizado; stale/dirty recusados; adulteração/ausência/duplicação recusadas; terreno grande sem validação de teto final. Alguns casos agrupam variantes.

O conjunto de dez casos observou o esperado. `@atlas/kernel.id` foi substituído por SHA256 de JSON serializado; os corpos originais de parsing, rendering, coverage e verification foram executados. Não é prova da canonicalização/BLAKE3 do Atlas. O campo currentBlob foi um callback controlado neste grupo.

## Scripts originais com Git/filesystem reais — 4 casos

1. Snapshot válido: materializador exit 0, guard exit 0; após alterar fonte real, guard exit 1 com source blob drift.
2. Drill órfão: materializador exit 0, guard exit 0, destino ausente no filesystem.
3. Predicate sem check.kind: materializador exit 0, guard exit 0, corpo contém undefined.
4. Fato DRIFTED: materializador exit 1 antes de instalar snapshot.

Subprocessos usam as portas de injeção já existentes (`OWN_SNAPSHOT_MATERIALIZE_IMPL`, `OWN_SNAPSHOT_GUARD_IMPL`, `OWN_SNAPSHOT_GUARD_ROOT`). Contratos originais compilados e digest de teste declarado. Commit ancestral, sourceRevision, blobs e arquivos foram reais em repositórios Git temporários.

## Avaliador original Maestro — 4 casos

Aprovação direta imediata: APPROVED. Resposta após redisplay com binding antigo: HOLD/reply-not-immediate. Binding novo para nova apresentação: APPROVED. Respostas sintéticas/tool: recusadas. Sem dependências substituídas no avaliador; produtor Effect/DB e UI não executados.

## Modelo de query — 2 cenários

Transcrição comportamental, não módulos originais. Seis claims T2 de 400 caracteres, cap advisory 2000, threshold 8. Ordem atual: sexto omitido nas consultas 1–8, com oito hits; todos governing na nona. Ordem contrafactual após seleção: sexto sem hits até nona, quando é entregue advisory pela primeira vez. Nenhum tier persistido foi alterado; nenhum patch foi aplicado ao produto.

## Interpretação

18 casos sobre funções/scripts originais com isolamento declarado, mais 2 cenários modelados. Pass significa reprodução do comportamento esperado, inclusive defeitos, e **não** certificação de qualidade do produto. A fixture de tamanho produziu 131.637 bytes com 3.000 entradas de terreno e tokenEstimate 16; não é medição de tokens. ATL-001, ATL-003 e a jornada completa OWN-003 continuam sem execução da porta real. O teste de reducer no pacote é proposto e não executado.

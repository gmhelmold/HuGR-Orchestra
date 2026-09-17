# Cobertura efetiva — WP-HOST-01

Produto `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Cinco passagens focadas não são cinco leituras integrais do monorepo.

Inventário Git: 7.821 arquivos 100644, 55 arquivos 100755, 60 symlinks 120000. Total: 7.876 arquivos regulares ou 7.936 entradas. Inventário e busca não são leitura.

31 arquivos têm os intervalos devolvidos abaixo. Integral significa cobertura de leitura, não execução de cada linha. Instruções de pacote/teste foram relidas na preparação fora deste registrador.

| Fonte | Intervalos devolvidos | Leitura | Git blob |
|---|---|---|---|
| [packages/core/src/config/plugin/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/config/plugin/agent.ts) | 1–160 | Parcial | `0635aa6291c140f210514b92ec115f38a66f494b` |
| [packages/core/src/config/plugin/skill.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/config/plugin/skill.ts) | 1–50 | Integral | `765992a765b25554be9de3e47443e35d54aed3ce` |
| [packages/core/src/plugin/skill.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/src/plugin/skill.ts) | 1–31 | Integral | `ea723dd89dea01fce6ebab3d32ec0116552ae4a0` |
| [packages/core/test/location-layer.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/core/test/location-layer.test.ts) | 1–160 | Parcial | `e28e758c87b8d29d1cb5854e6541ab426aa2e472` |
| [packages/opencode/src/agent/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/agent/agent.ts) | 180–209 | Parcial | `821e2373a0ddcd282ea3ff7df8db2933b314a3de` |
| [packages/opencode/src/agent/prompt/maestro.txt](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/agent/prompt/maestro.txt) | 1–54 | Integral | `ac5fbf535569fd22c8775cbb1937a6af0e17bcda` |
| [packages/opencode/src/cli/cmd/serve.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/cli/cmd/serve.ts) | 1–24 | Integral | `c0f62b3ca0714a74b6280f0f0197621ece8d9312` |
| [packages/opencode/src/cli/tui/worker.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/cli/tui/worker.ts) | 1–80 | Integral | `4cf6b2d446b3c842c18b8567a7485a6aa7ed8ae9` |
| [packages/opencode/src/command/index.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/command/index.ts) | 160–177, 95–160 | Parcial | `057754cd9ef879d18efb5934232eec079732d817` |
| [packages/opencode/src/server/routes/instance/httpapi/handlers/instance.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/server/routes/instance/httpapi/handlers/instance.ts) | 1–110 | Integral | `f851b3a3100573f8283f1e8d42323ac01bbe5eab` |
| [packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/server/routes/instance/httpapi/handlers/session.ts) | 1–160, 282–323 | Parcial | `662585020a643d5d2e933a9f74e391d32a7afac7` |
| [packages/opencode/src/server/routes/instance/httpapi/server.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/server/routes/instance/httpapi/server.ts) | 1–200 | Parcial | `733d71d49446c184a83103a72768876fc627603c` |
| [packages/opencode/src/server/server.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/server/server.ts) | 1–160 | Parcial | `440b992c155774c9611dd01b3de2f400a522e71b` |
| [packages/opencode/src/session/llm.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/llm.ts) | 120–200, 1–117, 257–313 | Parcial | `4954b99d7a4ccf9448524cdd52c56d436f9340f4` |
| [packages/opencode/src/session/llm/request.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/llm/request.ts) | 1–115 | Parcial | `cfd8c6e9550ae4f6c9def243fe01ca30bb99d543` |
| [packages/opencode/src/session/message-v2.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/message-v2.ts) | 270–318 | Parcial | `9b3f2c46f40578128001957004c67633a18da23a` |
| [packages/opencode/src/session/prompt.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/prompt.ts) | 157–192, 1225–1315, 1384–1510 | Parcial | `a0736c119d702e319d0778196aaf54a97d3654e8` |
| [packages/opencode/src/session/system.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/session/system.ts) | 1–152 | Integral | `d0c608b203f68f8c84f117129852b30c9b73d090` |
| [packages/opencode/src/skill/index.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/skill/index.ts) | 100–145, 275–321 | Parcial | `5a04ec213994a65dd25098b843efca1fbd1c4e0e` |
| [packages/opencode/src/tool/skill.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/src/tool/skill.ts) | 1–70 | Integral | `9149bcc5ff0de554828b5c2b08ee85ce1cc6502a` |
| [packages/opencode/test/fixture/fixture.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/fixture/fixture.ts) | 1–160 | Parcial | `53e3142cdfb34aea269cae40cb90a6c768fff27e` |
| [packages/opencode/test/lib/effect.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/lib/effect.ts) | 1–145 | Parcial | `255d4b3947502b971ffb4ab3ab15cfb184c2db4f` |
| [packages/opencode/test/lib/llm-server.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/lib/llm-server.ts) | 1–240, 600–640 | Parcial | `245acc7280f553ae4a8f13ffa05c97257e88587d` |
| [packages/opencode/test/preload.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/preload.ts) | 1–92 | Integral | `16b4789b0725b50cd9056f0ff9b9885bcb9139b3` |
| [packages/opencode/test/session/prompt.test.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/opencode/test/session/prompt.test.ts) | 1–145, 160–315, 313–490, 790–880, 140–160 | Parcial | `8d7a7576a6f1731d688e1f4bc41eb74e21cd6ef1` |
| [packages/protocol/src/api.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/protocol/src/api.ts) | 1–86 | Integral | `7b422d06007d65407e3e36e2c022a6bd2013d0e9` |
| [packages/protocol/src/groups/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/protocol/src/groups/agent.ts) | 1–20 | Integral | `0d499e187f9a4b3c22d7ee4c679748d1c9db8070` |
| [packages/sdk/js/src/v2/gen/sdk.gen.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/sdk/js/src/v2/gen/sdk.gen.ts) | 562–585, 3762–3795 | Parcial | `a2bcd4252c6d8a185469dcda23a8cccc819218f0` |
| [packages/server/src/api.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/server/src/api.ts) | 1–8 | Integral | `981ad28db93d253ac02e231b6dbc28f034fe5c35` |
| [packages/server/src/handlers/agent.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/server/src/handlers/agent.ts) | 1–13 | Integral | `c1511e3c62cdefab6e73fcc1454c468f1710a0d7` |
| [packages/server/src/location.ts](https://github.com/gmhelmold/HuGR-Orchestra/blob/b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7/packages/server/src/location.ts) | 1–60 | Integral | `8ae5aa6e6d08b26ed063ad7841b7195b3096ff7a` |

## Evidência comportamental e exclusões

Doze cenários de contexto e dois de rotas foram repetidos; 68 testes originais selecionados passaram. Detalhes estão em README e RESULTS. Não houve UI/CLI completa, sessão Core V2 configurada até o provedor, troca de projeto/worktree, duplicatas/recibos malformados no consumidor, reinício da mesma sessão persistida, full-suite monorepo ou verificação de CI remota. A captura usa HTTP local com respostas programadas, não inferência real.

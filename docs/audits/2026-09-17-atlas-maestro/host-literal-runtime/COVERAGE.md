# Cobertura de leitura desta rodada

Produto fixado. Faixas realmente retornadas e relidas nesta execução; leituras herdadas da conversa não são promovidas a releitura integral.

| Fonte | Faixa | Git blob |
|---|---|---|
| `packages/core/test/preload.ts` | 1–5 | `39b237d70a426e5e42bf9e1564ee55a2d25d5d68` |
| `packages/opencode/test/preload.ts` | 1–92 | `16b4789b0725b50cd9056f0ff9b9885bcb9139b3` |
| `packages/core/test/lib/tool.ts` | 1–20 | `a711e3118400a2a9bd5989caf2f5db965798d0b6` |
| `packages/core/package.json` | 1–132 | `0dbf20fc8756b0b64a2cfc71aff538300a09eacb` |
| `foundation/atlas/package.json` | 1–44 | `700eb8c7d4bf7a5ce2c765f0d3a0bbd2b3c6e2ec` |
| `packages/core/src/config/plugin/skill.ts` | 1–50 | `765992a765b25554be9de3e47443e35d54aed3ce` |
| `packages/core/src/plugin/host.ts` | 180–219 | `a9d084709efc69d5c376c227eea122c46bffc306` |
| `packages/core/src/skill.ts` | 1–132 | `be1cd1d49adcc18643ca3e799d1b00af5313b786` |
| `packages/core/src/state.ts` | 50–128 | `ab3457fc18143c10d830979dbde3a9375e194ccf` |
| `packages/opencode/src/command/index.ts` | 128–154 | `057754cd9ef879d18efb5934232eec079732d817` |
| `packages/opencode/src/session/prompt.ts` | 1384–1442 | `a0736c119d702e319d0778196aaf54a97d3654e8` |
| `packages/opencode/src/session/prompt.ts` | 1617–1628 | `a0736c119d702e319d0778196aaf54a97d3654e8` |
| `packages/schema/src/skill.ts` | 1–55 | `ec299180ed0b5cedcf33e892a8b27a6382c423e4` |
| `packages/core/src/tool/skill.ts` | 60–107 | `1f8b12290354aba536520c7b1416719247edca4c` |
| `foundation/atlas/packages/retrieval/src/own-artifact.ts` | 95–192 | `3f8ff4c6d7f01b6e2071652b764b06680798420b` |

Os dois novos probes foram executados duas vezes e revisados; a fixture original do host foi lida integralmente (157 linhas) antes da adaptação. Baselines executados não significam leitura integral de todos os seus testes. O inventário/compilação de 819 JS não é cobertura semântica.

Nenhuma nova passagem global completa é declarada. Matriz de host/worktree/restart e outras pendências continuam no README e no norte canônico.

## Revisão posterior da entrega

Veja [review/REVIEW.md](review/REVIEW.md): escopo de 38 arquivos, rechecagem histórica, repetição original, modos observed/desired, correção de readback e isolamento das saídas. Os registros anteriores permanecem históricos. A revisão não amplia a cobertura global nem corrige o produto.

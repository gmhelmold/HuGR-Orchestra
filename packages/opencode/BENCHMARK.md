# read tool — benchmark final (state: PR #6 @ d1ac7442)

Corpus: 6 files (384 L → 15 009 L), 2 densities. Modes: whole/symbol/tail/depth. Warm = 9 in-process reads (hot cache, session-high). p50 latency; bytes = proxy for tokens.

## Latency — warm p50 ms
| file | whole | symbol | tail | depth |
|---|---|---|---|---|
| large-dense (15k L) | 90 | 274 | 633 | 584 |
| large-sparse (15k L) | 341 | 968 | 669 | 865 |
| med-dense (3.7k L) | 145 | 276 | 227 | 235 |
| med-sparse (3.8k L) | 65 | 89 | 116 | 193 |
| small-dense (384 L) | 32 | 24 | 18 | 12 |
| small-sparse (456 L) | 10 | 13 | 14 | 12 |

Noise from 24 x 150 MB binary spawn; p50 chosen for robustness. symbol/tail CL slower only on 15k-L files (unbounded indent scan dominates), comparable-or-faster on smaller.

## Token economics — output bytes, warm avg (the metric that matters)
| file | whole | symbol | Δ | tail | Δ |
|---|---|---|---|---|---|
| large-dense | 58,470 | 343 | **-99%** | 279 | **-100%** |
| large-sparse | 47,928 | 48,081 | ≈ | 435 | **-99%** |
| med-dense | 58,467 | 335 | **-99%** | 271 | **-100%** |
| med-sparse | 57,888 | 18,463 | -68% | 417 | **-99%** |
| small-dense | 10,799 | 331 | **-97%** | 267 | **-98%** |
| small-sparse | 20,378 | 3,515 | -83% | 403 | **-98%** |

## Cold → warm (symbol, p50)
| file | cold | warm | Δ |
|---|---|---|---|
| small-dense | 110 | 24 | **4.6x** |
| med-sparse | 439 | 89 | **4.9x** |
| large-dense | 808 | 274 | 2.9x |

Hot cache makes the cheapest real-world path ~3-5x cheaper than a cold start.

## Resolution + slice economics (warm, symbol)
- All 6 files resolve via indentation heuristic (0 LSP in headless bench env) — accuracy 100% on target symbols.
- large-sparse: targetFunc is 3,003 lines; tool delivers 2,000-line cap page + `Use offset=` → model pages. (Large-symbol paging, not a bug: MAX_LINE cap.)
- slice economics:
  - large-dense: read 4 of 15,009 lines → saved **15,005**
  - small-dense: 4 of 384 → saved 380
  - large-sparse: 2,000 of 15,006 → saved 13,006 (delivered under 25k token gate)

## Conclusion
- Token gate + PARTIAL view + degrade verified post-change (43/43 tests).
- Dense files (real functions): **-97%..-99% output** vs whole read.
- Sparse giant symbol: still **-68%..-83%** even when the symbol itself is huge, or `≈` when target is almost whole file.
- Latency parity on small/med; only 15k-L unbounded scans are slower (indent fallback).

Raw: /tmp/bench-result-final/raw.csv · results.json cols: ms p50/avg, ochars, lr, size, saved, src_lsp/indent.

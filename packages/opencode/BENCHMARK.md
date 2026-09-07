# Read Benchmark

Correctness-first harness for `filePath`, `offset`, `limit`.

## Run

```bash
./bench-corpus.sh /tmp/bench-corpus
./bench-hardcore.sh <opencode-binary> /tmp/bench-corpus 5 /tmp/bench-result
```

Harness overwrites deterministic corpus files and validates SHA-256 manifest. Each serial run validates JSON envelope and expected outcome. Success validates numbered range plus exact returned content against source oracle. Oversized explicit range is valid source range `offset=1, limit=1000` over dense post-truncation lines; it expects `ok:false` with `Requested range exceeds 50 KB output limit` and no output. Missing corpus, malformed/no envelope, malformed JSON, invalid output, oracle mismatch, wrong outcome, unsuccessful process, no rows, missing expected cells, wrong row count fail run.

Modes: default, explicit slice, tail, oversized default, oversized explicit range. Corpus: LF, CRLF, Unicode/emoji, long-line, dense-large, sparse-large.

`output_chars` means JavaScript string character count, not bytes or tokens. `elapsed_ms` includes CLI startup. p50/p95 only shown where sample size >=2.

Run self-tests with `BENCH_SELF_TEST=1 ./bench-hardcore.sh "$(command -v true)"`. They prove malformed envelope, zero rows, oracle mismatch, exact expected-error fragment mismatch, unexpected success/error outcomes fail closed. Out-of-range offsets are outside this benchmark scope. No symbol, search, depth, sparse, token, byte, or accuracy claim. No LSP oracle. Debug params JSON-only. Debug runner removes throwaway session in finalizer. Report records expected/observed outcomes, test count/cell completeness, runtime platform/Python/binary, and states missing CPU/memory/disk/load controls.

# Read Benchmark

Correctness-first harness for `filePath`, `offset`, `limit`.

## Run

```bash
./bench-corpus.sh /tmp/bench-corpus
./bench-hardcore.sh <opencode-binary> /tmp/bench-corpus 5 /tmp/bench-result
```

Harness overwrites deterministic corpus files and validates SHA-256 manifest. Each serial run validates JSON envelope and expected outcome. Success validates numbered range plus exact returned content against source oracle. Oversized explicit range expects `ok:false` with `Offset 3001 is out of range`; it must not contain output. Missing corpus, malformed/no envelope, malformed JSON, invalid output, oracle mismatch, wrong outcome, unsuccessful process, no rows, missing expected cells, wrong row count fail run.

Modes: default, explicit slice, tail, oversized default, oversized explicit range. Corpus: LF, CRLF, Unicode/emoji, long-line, dense-large, sparse-large.

`output_chars` means JavaScript string character count, not bytes or tokens. `elapsed_ms` includes CLI startup. p50/p95 only shown where sample size >=2.

Run self-tests with `BENCH_SELF_TEST=1 ./bench-hardcore.sh "$(command -v true)"`. They prove malformed envelope, zero rows, oracle mismatch, unexpected success/error outcomes fail closed. No symbol, search, depth, sparse, token, byte, or accuracy claim. No LSP oracle. Debug params JSON-only. Debug runner removes throwaway session in finalizer. Report records expected/observed outcomes, test count/cell completeness, runtime platform/Python/binary, and states missing CPU/memory/disk/load controls.

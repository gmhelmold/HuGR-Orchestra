# Read Benchmark

Correctness-first harness for `filePath`, `offset`, `limit`.

## Run

```bash
./bench-corpus.sh /tmp/bench-corpus
./bench-hardcore.sh <opencode-binary> /tmp/bench-corpus 5 /tmp/bench-result
```

Harness overwrites deterministic corpus files and validates SHA-256 manifest. Each serial run validates JSON envelope, numbered range, exact returned content against source oracle. Missing corpus, malformed/no envelope, malformed JSON, invalid output, oracle mismatch, unsuccessful process, no rows, missing expected cells, wrong row count fail run.

Modes: default, explicit slice, tail, oversized default, oversized explicit range. Corpus: LF, CRLF, Unicode/emoji, long-line, dense-large, sparse-large.

`output_chars` means JavaScript string character count, not bytes or tokens. `elapsed_ms` includes CLI startup. p50/p95 only shown where sample size >=2.

No symbol, search, depth, sparse, token, byte, or accuracy claim. No LSP oracle. Debug params JSON-only. Debug runner removes throwaway session in finalizer.

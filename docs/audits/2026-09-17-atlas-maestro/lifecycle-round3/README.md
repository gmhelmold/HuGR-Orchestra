# Atlas / Maestro — lifecycle audit, round 3

Product baseline: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`. Documentation and evidence only; no product fixes or merges.

Start with [RELATORIO.md](RELATORIO.md), the Portuguese architecture/context report. [JOURNAL.md](JOURNAL.md) records five focused investigation passes, corrections and counterevidence. [RESULTADOS.md](RESULTADOS.md) records what ran and how to repeat the diagnostics. [evidence/SUMMARY.json](evidence/SUMMARY.json) is the machine-readable result index; [evidence/SCOPE.json](evidence/SCOPE.json) pins source files and inspection limits.

New issues: [#39](https://github.com/gmhelmold/HuGR-Orchestra/issues/39), [#40](https://github.com/gmhelmold/HuGR-Orchestra/issues/40), [#41](https://github.com/gmhelmold/HuGR-Orchestra/issues/41), [#42](https://github.com/gmhelmold/HuGR-Orchestra/issues/42). Independent evidence also corroborates #32/#33/#34/#37. #38 was closed as duplicate of #32 when a refreshed read found concurrent issue publication. The existing audit PR #14 is related work; this directory does not overwrite that work.

A diagnostic exit code of zero means its specified observation was reproduced. It is **not** an acceptance declaration that the observed product defect is fixed. Initial experiment errors are retained separately and never counted as product failures.

The published logs normalize local checkout/scratch paths. Source contents and production logic are not patched. SHA256SUMS covers the published files.

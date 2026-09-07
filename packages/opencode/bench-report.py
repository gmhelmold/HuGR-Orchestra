#!/usr/bin/env python3
"""Validate correctness-checked rows. Usage: raw expected system results report."""
import json
import statistics
import sys

def percentile(values, p):
    values = sorted(values)
    return values[min((len(values) - 1) * p // 100, len(values) - 1)]

def main():
    if len(sys.argv) != 6: raise SystemExit("usage: bench-report.py raw.jsonl expected.json system.json results.json report.md")
    raw_path, expected_path, system_path, results_path, report_path = sys.argv[1:]
    expected, system = json.load(open(expected_path, encoding="utf-8")), json.load(open(system_path, encoding="utf-8"))
    rows = []
    for line_number, line in enumerate(open(raw_path, encoding="utf-8"), 1):
        if not line.strip(): continue
        try:
            row = json.loads(line)
            if not isinstance(row, dict) or not isinstance(row.get("elapsed_ms"), (int, float)) or not isinstance(row.get("output_chars"), int): raise ValueError("missing measurements")
        except (json.JSONDecodeError, ValueError) as err: raise SystemExit(f"malformed raw row {line_number}: {err}")
        rows.append(row)
    if not rows: raise SystemExit("no valid rows")
    cells = {(case["file"], case["mode"]): [] for case in expected.get("cases", [])}
    if not cells: raise SystemExit("no expected cells")
    for row in rows:
        key = (row.get("file"), row.get("mode"))
        if key not in cells: raise SystemExit(f"unexpected cell: {key}")
        cells[key].append(row)
    runs = expected.get("runs_per_cell")
    if not isinstance(runs, int) or runs < 1: raise SystemExit("invalid expected run count")
    missing = [key for key, values in cells.items() if len(values) != runs]
    if missing: raise SystemExit(f"missing expected cells or rows: {missing}")
    summary = {}
    for key, values in sorted(cells.items()):
        elapsed, chars = [r["elapsed_ms"] for r in values], [r["output_chars"] for r in values]
        ms = {"min": min(elapsed), "max": max(elapsed), "avg": statistics.mean(elapsed)}
        if len(values) >= 2: ms.update(p50=percentile(elapsed, 50), p95=percentile(elapsed, 95))
        summary["|".join(key)] = {"successful_rows": len(values), "elapsed_ms": ms, "output_chars": {"min": min(chars), "max": max(chars), "avg": statistics.mean(chars)}}
    results = {"scope": "filePath, offset, limit only", "system": system, "successful_rows": len(rows), "expected_rows": len(cells) * runs, "cells": summary}
    json.dump(results, open(results_path, "w", encoding="utf-8"), indent=2)
    lines = ["# Read Benchmark", "", "Correctness-first, reproducible harness for `filePath`, `offset`, `limit`.", "", "## Scope", "", "Modes: default, explicit slice, tail, oversized default, oversized explicit range. Every row passed numbered-line range and exact-content oracle.", "", "No symbol, search, depth, sparse, token, byte, or accuracy measurement. No LSP oracle.", "", "## System", "", f"- Platform: `{system['platform']}`", f"- Python: `{system['python']}`", f"- Binary: `{system['binary']}`", f"- Successful/expected rows: {len(rows)}/{len(cells) * runs}", "", "## Results", "", "| fixture | mode | rows | elapsed ms avg | p50 | p95 | output chars avg |", "|---|---|---:|---:|---:|---:|---:|"]
    for key, metric in summary.items():
        file, mode = key.split("|", 1); ms = metric["elapsed_ms"]
        p50 = f"{ms['p50']:.1f}" if "p50" in ms else "n/a (n<2)"; p95 = f"{ms['p95']:.1f}" if "p95" in ms else "n/a (n<2)"
        lines.append(f"| {file} | {mode} | {metric['successful_rows']} | {ms['avg']:.1f} | {p50} | {p95} | {metric['output_chars']['avg']:.1f} |")
    lines += ["", "## Limits", "", "Elapsed time includes one serial CLI process per row. `output_chars` is JavaScript string character count, not bytes or tokens. Corpus contains LF, CRLF, Unicode/emoji, long-line, dense-large, sparse-large fixtures; cases use range-relevant fixtures. Debug runner removes its throwaway session through `Session.remove` finalizer."]
    open(report_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("\n".join(lines))
if __name__ == "__main__": main()

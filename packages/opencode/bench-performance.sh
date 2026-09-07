#!/usr/bin/env bash
# Isolated latency and RSS harness; does not use correctness corpus.
set -euo pipefail
BIN="${1:-}"
shift $(( $# > 0 ? 1 : 0 ))
CORPUS="/tmp/opencode-read-performance-corpus"
OUT="/tmp/opencode-read-performance-result"
LARGE=0
RUNS=3
valid_runs() { [[ "$1" =~ ^[1-9][0-9]*$ ]]; }
while [[ $# -gt 0 ]]; do
  case "$1" in
    --corpus) CORPUS="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --runs) RUNS="${2:-}"; shift 2 ;;
    --large) LARGE=1; shift ;;
    *) echo "usage: $0 <compiled-binary> [--corpus DIR] [--out DIR] [--runs N] [--large]" >&2; exit 2 ;;
  esac
done
valid_runs "$RUNS" || { echo "runs must be positive integer" >&2; exit 2; }
if [[ "${BENCH_PERFORMANCE_SELF_TEST:-}" == 1 ]]; then
  if valid_runs 0; then echo "invalid runs self-test failed" >&2; exit 1; fi
  export BENCH_PERFORMANCE_SELF_TEST
  python3 - <<'PY'
import re
import statistics
def rss(text, os_name):
    if os_name == "Darwin":
        match = re.search(r"^\s*(\d+)\s+maximum resident set size\s*$", text, re.M)
        if match: return int(match.group(1))
        raise ValueError("missing macOS maximum resident set size")
    if os_name == "Linux":
        match = re.search(r"^\s*Maximum resident set size \(kbytes\):\s*(\d+)\s*$", text, re.M)
        if match: return int(match.group(1)) * 1024
        raise ValueError("missing Linux maximum resident set size (kbytes)")
    raise ValueError(f"unsupported-platform: {os_name}; supported: Darwin, Linux")
if rss("  42 maximum resident set size\n", "Darwin") != 42: raise AssertionError("macOS parser")
if rss("\tMaximum resident set size (kbytes): 42\n", "Linux") != 42 * 1024: raise AssertionError("Linux parser")
for text, os_name in (("", "Darwin"), ("Maximum resident set size (kbytes): x", "Linux"), ("", "Plan9")):
    try: rss(text, os_name)
    except ValueError: continue
    raise AssertionError("RSS parser did not fail closed")
def envelope(stdout):
    lines = [line for line in stdout.splitlines() if line.strip()]
    if len(lines) != 1: raise ValueError("missing or duplicate read envelope")
    try: result = json.loads(lines[0])
    except json.JSONDecodeError as error: raise ValueError(f"malformed read envelope: {error}")
    if not isinstance(result, dict) or not isinstance(result.get("ms"), (int, float)) or not isinstance(result.get("output"), str): raise ValueError("invalid read envelope")
    return result
import json
if envelope('{"ms":1,"output":"x"}\n')["ms"] != 1: raise AssertionError("envelope parser")
for value in ("", "not-json\n", '{"ms":null,"output":"x"}\n', '{"ms":1}\n'):
    try: envelope(value)
    except ValueError: continue
    raise AssertionError("envelope parser did not fail closed")
def validate(rows, fixtures, runs):
    expected = {(fixture, mode, run) for fixture in fixtures for mode in ("default", "explicit_small_slice", "tail_offset_minus_5") for run in range(runs)}
    seen = set()
    for row in rows:
        key = (row.get("file"), row.get("mode"), row.get("run"))
        if key not in expected or key in seen: raise ValueError("missing, unexpected, or duplicate row")
        if not all(isinstance(row.get(name), (int, float)) and row[name] >= 0 for name in ("process_elapsed_ms", "operation_ms", "peak_rss_bytes")): raise ValueError("invalid metric")
        seen.add(key)
    if seen != expected: raise ValueError("missing expected mode row")
def summary(values):
    if len(values) == 1: return {"min": values[0], "avg": values[0], "p50": None, "p95": None}
    values = sorted(values); return {"min": values[0], "avg": statistics.mean(values), "p50": values[(len(values)-1)//2], "p95": values[((len(values)-1)*95)//100]}
good = [{"file": "x", "mode": mode, "run": 0, "process_elapsed_ms": 1, "operation_ms": 1, "peak_rss_bytes": 1} for mode in ("default", "explicit_small_slice", "tail_offset_minus_5")]
validate(good, ["x"], 1)
for rows in (good[:-1], good + [good[0]], [{**good[0], "process_elapsed_ms": None}] + good[1:]):
    try: validate(rows, ["x"], 1)
    except ValueError: continue
    raise AssertionError("row validator did not fail closed")
if summary([1])["p95"] is not None: raise AssertionError("N=1 percentile")
print("bench-performance self-test: pass")
PY
  exit 0
fi
[[ -n "$BIN" && -x "$BIN" ]] || { echo "missing executable binary: $BIN" >&2; exit 2; }
[[ -n "$CORPUS" && "$CORPUS" != / ]] || { echo "invalid performance corpus: $CORPUS" >&2; exit 2; }
mkdir -p "$CORPUS" "$OUT"
CORPUS="$(cd "$CORPUS" && pwd -P)"
OUT="$(cd "$OUT" && pwd -P)"
export BIN CORPUS OUT LARGE RUNS
python3 - <<'PY'
import hashlib, json, os, platform, re, statistics, subprocess, sys, time
from pathlib import Path

def fail(message): raise ValueError(message)
def rss(text, os_name):
    if os_name == "Darwin":
        match = re.search(r"^\s*(\d+)\s+maximum resident set size\s*$", text, re.M)
        if match: return int(match.group(1))
        fail("missing macOS maximum resident set size")
    if os_name == "Linux":
        match = re.search(r"^\s*Maximum resident set size \(kbytes\):\s*(\d+)\s*$", text, re.M)
        if match: return int(match.group(1)) * 1024
        fail("missing Linux maximum resident set size (kbytes)")
    fail(f"unsupported-platform: {os_name}; supported: Darwin, Linux")
def write(path, size):
    line = b"0123456789abcde\n"; digest = hashlib.sha256(); chunk = line * 65536
    with path.open("wb") as file:
        left = size
        while left:
            data = chunk if left >= len(chunk) else line * (left // len(line))
            file.write(data); digest.update(data); left -= len(data)
    return {"file": path.name, "bytes": size, "sha256": digest.hexdigest()}
def envelope(stdout, params):
    lines = [line for line in stdout.splitlines() if line.strip()]
    if len(lines) != 1: fail("missing or duplicate read envelope")
    try: result = json.loads(lines[0])
    except json.JSONDecodeError as error: fail(f"malformed read envelope: {error}")
    if not isinstance(result, dict) or result.get("tool") != "read" or result.get("params") != params: fail("invalid read envelope")
    if result.get("ok") is False or not isinstance(result.get("output"), str): fail("invalid read output")
    if not isinstance(result.get("ms"), (int, float)) or result["ms"] < 0: fail("missing or invalid operation ms")
    return result
def validate(rows, fixtures, runs):
    modes = ("default", "explicit_small_slice", "tail_offset_minus_5")
    expected = {(fixture["file"], mode, run) for fixture in fixtures for mode in modes for run in range(runs)}
    seen = set()
    for row in rows:
        key = (row.get("file"), row.get("mode"), row.get("run"))
        if key not in expected or key in seen: fail("missing, unexpected, or duplicate row")
        for metric in ("process_elapsed_ms", "operation_ms", "peak_rss_bytes"):
            if not isinstance(row.get(metric), (int, float)) or row[metric] < 0: fail(f"invalid {metric}: {key}")
        seen.add(key)
    if seen != expected: fail("missing expected mode row")
def stats(values):
    ordered = sorted(values); result = {"min": ordered[0], "avg": statistics.mean(ordered), "p50": None, "p95": None}
    if len(ordered) >= 2: result.update(p50=ordered[(len(ordered)-1)//2], p95=ordered[((len(ordered)-1)*95)//100])
    return result

os_name = platform.system()
if os_name not in {"Darwin", "Linux"}: raise SystemExit(f"unsupported-platform: {os_name}; supported: Darwin, Linux")
corpus, out, binary = Path(os.environ["CORPUS"]), Path(os.environ["OUT"]), Path(os.environ["BIN"])
runs = int(os.environ["RUNS"])
fixtures = [write(corpus / "read-1MiB.txt", 1 << 20), write(corpus / "read-100MiB.txt", 100 << 20)]
if os.environ["LARGE"] == "1": fixtures.append(write(corpus / "read-1GiB.txt", 1 << 30))
(corpus / "manifest.json").write_text(json.dumps({"fixtures": fixtures}, indent=2) + "\n")
rows = []
for fixture in fixtures:
    path = corpus / fixture["file"]
    if hashlib.sha256(path.read_bytes()).hexdigest() != fixture["sha256"]: raise SystemExit(f"invalid performance fixture: {path}")
    for mode, extra in (("default", {}), ("explicit_small_slice", {"offset": 2, "limit": 3}), ("tail_offset_minus_5", {"offset": -5})):
        params = {"filePath": str(path), **extra}
        for run in range(runs):
            command = ["/usr/bin/time", "-l" if os_name == "Darwin" else "-v", str(binary), "debug", "read", "--params", json.dumps(params)]
            before = time.monotonic_ns(); proc = subprocess.run(command, text=True, capture_output=True)
            if proc.returncode != 0: raise SystemExit(f"read process failed {fixture['file']}/{mode}/{run}: {proc.stderr.strip()}")
            try: result, peak = envelope(proc.stdout, params), rss(proc.stderr, os_name)
            except ValueError as error: raise SystemExit(f"invalid result {fixture['file']}/{mode}/{run}: {error}")
            rows.append({"file": fixture["file"], "mode": mode, "run": run, "process_elapsed_ms": (time.monotonic_ns() - before) / 1_000_000, "operation_ms": result["ms"], "peak_rss_bytes": peak})
try: validate(rows, fixtures, runs)
except ValueError as error: raise SystemExit(str(error))
identity = {"path": str(binary.resolve()), "bytes": binary.stat().st_size, "sha256": hashlib.sha256(binary.read_bytes()).hexdigest()}
system = {"os": platform.platform(), "cpu": platform.processor() or platform.machine(), "runtime": sys.version.split()[0], "binary": identity, "rss_tool": "/usr/bin/time -l" if os_name == "Darwin" else "/usr/bin/time -v", "fixtures": fixtures}
cells = {}
for fixture in fixtures:
    for mode in ("default", "explicit_small_slice", "tail_offset_minus_5"):
        values = [row for row in rows if row["file"] == fixture["file"] and row["mode"] == mode]
        cells[f"{fixture['file']}|{mode}"] = {metric: stats([row[metric] for row in values]) for metric in ("process_elapsed_ms", "operation_ms", "peak_rss_bytes")}
results = {"system": system, "runs_per_cell": runs, "rows": rows, "cells": cells}
(out / "results.json").write_text(json.dumps(results, indent=2) + "\n")
lines = ["# Read Performance", "", f"System: `{system}`", "", f"Runs per cell: {runs}", "", "| fixture | mode | process min/avg/p50/p95 ms | operation min/avg/p50/p95 ms | peak RSS min/avg/p50/p95 bytes |", "|---|---|---:|---:|---:|"]
def format_stats(value):
    return "/".join("n/a" if value[name] is None else f"{value[name]:.1f}" for name in ("min", "avg", "p50", "p95"))
for key, value in cells.items():
    fixture, mode = key.split("|", 1)
    lines.append(f"| {fixture} | {mode} | {format_stats(value['process_elapsed_ms'])} | {format_stats(value['operation_ms'])} | {format_stats(value['peak_rss_bytes'])} |")
(out / "report.md").write_text("\n".join(lines) + "\n")
print("\n".join(lines))
PY

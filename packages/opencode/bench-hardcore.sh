#!/usr/bin/env bash
# Correctness-first benchmark for filePath/offset/limit read modes.
# Usage: ./bench-hardcore.sh <binary> [corpus_dir] [runs] [out_dir]
set -euo pipefail
BIN="${1:?usage: $0 <binary> [corpus_dir] [runs] [out_dir]}"
CORPUS="${2:-/tmp/bench-corpus}"
RUNS="${3:-5}"
OUT="${4:-/tmp/bench-result}"
[[ -x "$BIN" ]] || { echo "binary not executable: $BIN" >&2; exit 2; }
[[ -f "$CORPUS/manifest.json" ]] || { echo "corpus manifest missing: $CORPUS/manifest.json (run bench-corpus.sh)" >&2; exit 2; }
[[ "$RUNS" =~ ^[1-9][0-9]*$ ]] || { echo "runs must be positive integer" >&2; exit 2; }
mkdir -p "$OUT"
export BIN CORPUS RUNS OUT
# One process per invocation. Serial avoids SQLite database-locked artifacts.
python3 - <<'PY'
import hashlib, json, os, platform, subprocess, sys, time
from pathlib import Path
bin_path, corpus, runs, out = os.environ["BIN"], Path(os.environ["CORPUS"]), int(os.environ["RUNS"]), Path(os.environ["OUT"])
manifest = json.loads((corpus / "manifest.json").read_text())
for fixture in manifest.get("fixtures", []):
    path = corpus / fixture["file"]
    if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != fixture["sha256"]: raise SystemExit(f"invalid corpus fixture: {path}")
cases = [("default", "lf-unicode.txt", {}), ("explicit_slice", "lf-unicode.txt", {"offset": 2, "limit": 2}), ("tail", "lf-unicode.txt", {"offset": -2}), ("oversized_default", "dense-large.txt", {}), ("oversized_explicit_range", "dense-large.txt", {"offset": 2500, "limit": 1000})]
def oracle(path, params):
    lines = path.read_text(encoding="utf-8").splitlines(); offset, limit = params.get("offset", 1), params.get("limit", 2000)
    start = max(1, len(lines) + 1 + offset) if offset < 0 else offset
    return [(start + i, line) for i, line in enumerate(lines[start - 1:start - 1 + limit])]
def parsed(output):
    if not isinstance(output, str) or "<content>\n" not in output: raise ValueError("missing content envelope")
    body = output.split("<content>\n", 1)[1].split("\n\n(", 1)[0]; got = []
    for line in body.splitlines():
        number, sep, text = line.partition(": ")
        if not sep or not number.isdecimal(): raise ValueError(f"malformed numbered content line: {line!r}")
        got.append((int(number), text))
    if not got: raise ValueError("no numbered content rows")
    return got
rows = []
for mode, name, extra in cases:
    path, want = corpus / name, oracle(corpus / name, extra)
    if not want: raise SystemExit(f"oracle produced no rows: {mode}")
    for run in range(runs):
        params = {"filePath": str(path), **extra}; before = time.monotonic_ns()
        proc = subprocess.run([bin_path, "debug", "read", "--params", json.dumps(params)], text=True, capture_output=True)
        elapsed_ms = (time.monotonic_ns() - before) / 1_000_000
        if proc.returncode != 0: raise SystemExit(f"unsuccessful run {name}/{mode}/{run}: {proc.stderr.strip()}")
        lines = [line for line in proc.stdout.splitlines() if line.strip()]
        if len(lines) != 1: raise SystemExit(f"invalid envelope count {name}/{mode}/{run}: {len(lines)}")
        try: envelope = json.loads(lines[0])
        except json.JSONDecodeError as err: raise SystemExit(f"malformed JSON envelope {name}/{mode}/{run}: {err}")
        if envelope.get("tool") != "read" or envelope.get("params") != params or "output" not in envelope: raise SystemExit(f"invalid read envelope {name}/{mode}/{run}")
        try: actual = parsed(envelope["output"])
        except ValueError as err: raise SystemExit(f"invalid read output {name}/{mode}/{run}: {err}")
        if actual != want: raise SystemExit(f"oracle mismatch {name}/{mode}/{run}: expected {want[:2]!r}, got {actual[:2]!r}")
        rows.append({"file": name, "mode": mode, "run": run, "elapsed_ms": elapsed_ms, "output_chars": len(envelope["output"]), "range": [actual[0][0], actual[-1][0]]})
(out / "raw.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows), encoding="utf-8")
(out / "expected.json").write_text(json.dumps({"runs_per_cell": runs, "cases": [{"file": n, "mode": m} for m, n, _ in cases]}, indent=2) + "\n")
(out / "system.json").write_text(json.dumps({"platform": platform.platform(), "python": sys.version.split()[0], "binary": bin_path}, indent=2) + "\n")
PY
python3 "$(dirname "$0")/bench-report.py" "$OUT/raw.jsonl" "$OUT/expected.json" "$OUT/system.json" "$OUT/results.json" "$OUT/report.md"

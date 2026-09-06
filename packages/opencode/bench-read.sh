#!/usr/bin/env bash
# Benchmark for the read tool (legacy, via `opencode debug read`).
#
# Usage:
#   ./bench-read.sh <binary> <file> [runs] [--json]
#
# Example:
#   ./bench-read.sh packages/opencode/dist/opencode-darwin-x64/bin/opencode /tmp/sample.js 5
#
# Output:
#   CSV lines to stdout:
#     mode,symbol,tail,runs,avg_ms,p50_ms,p95_ms,size,lines_read,saved,source
#   With --json: full per-run envelopes as one JSON array.
#
# Modes tested (unless --single):
#   - whole:  read with no symbol/tail (baseline)
#   - symbol: read with symbol=first_fun (first function/class in file)
#   - tail:   read with offset=-5
set -euo pipefail

BIN="${1:-}"
FILE="${2:-}"
RUNS="${3:-5}"
MODE_FLAG="${4:-}"

if [[ -z "$BIN" || ! -x "$BIN" || -z "$FILE" || ! -f "$FILE" ]]; then
  echo "usage: $0 <binary> <file> [runs] [--json]" >&2
  exit 2
fi

# Extract the first likely symbol name (function/class/const) for symbol mode.
# Prefer one whose name contains "target"/"main"/"bench" for meaningful slices.
FIRST_SYMBOL="${BENCH_SYMBOL:-}"
if [[ -z "$FIRST_SYMBOL" ]]; then
  FIRST_SYMBOL="$(rg -o -m1 '^(export )?(async )?(function|const|class|let) (target|main|bench)[A-Za-z0-9_$]*' "$FILE" \
    | awk '{print $NF}' || true)"
fi
if [[ -z "$FIRST_SYMBOL" ]]; then
  FIRST_SYMBOL="$(rg -o -m1 '^(export )?(async )?(function|const|class|let) [A-Za-z_$][A-Za-z0-9_$]*' "$FILE" \
    | awk '{print $NF}' || true)"
fi
if [[ -z "$FIRST_SYMBOL" ]]; then
  FIRST_SYMBOL="$(basename "$FILE" | tr '. ' '__')"
fi

run_one() { # mode symbol? tail?  -> prints envelope JSON
  local mode="$1" symbol="$2" tail_off="$3"
  local params
  if [[ "$mode" == "symbol" ]]; then
    params="{\"filePath\":\"$FILE\",\"symbol\":\"$symbol\"}"
  elif [[ "$mode" == "tail" ]]; then
    params="{\"filePath\":\"$FILE\",\"offset\":$tail_off}"
  else
    params="{\"filePath\":\"$FILE\"}"
  fi
  "$BIN" debug read --params "$params" 2>/dev/null
}

pct() { # stdin lines -> percentile
  local p="$1" arr=()
  while read -r v; do [[ -n "$v" ]] && arr+=("$v"); done
  local n=${#arr[@]}
  [[ $n -eq 0 ]] && { echo 0; return; }
  local idx=$(( (p * n) / 100 ))
  idx=$(( idx > 0 ? idx - 1 : 0 ))
  [[ $idx -ge $n ]] && idx=$((n - 1))
  printf '%s' "${arr[$idx]}"
}

run_mode() {
  local mode="$1" symbol="${2:-}" tail_off="${3:-}"
  local ms_list=() size=0 lines=0 saved=0 source=""
  local incoming
  for ((i = 0; i < RUNS; i++)); do
    incoming="$(run_one "$mode" "$symbol" "$tail_off")"
    if [[ "$MODE_FLAG" == "--json" ]]; then
      echo "$incoming"
    fi
    ms="$(printf '%s' "$incoming" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ms",0))' 2>/dev/null || echo 0)"
    ms_list+=("$ms")
    size="$(printf '%s' "$incoming" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metadata",{}).get("size",0))' 2>/dev/null || echo 0)"
    lines="$(printf '%s' "$incoming" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metadata",{}).get("lines_read",0))' 2>/dev/null || echo 0)"
    saved="$(printf '%s' "$incoming" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metadata",{}).get("saved",0))' 2>/dev/null || echo 0)"
    source="$(printf '%s' "$incoming" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metadata",{}).get("source",""))' 2>/dev/null || echo "")"
  done

  local stats
  stats="$(printf '%s\n' "${ms_list[@]}" | python3 -c '
import sys
v = sorted(float(x) for x in sys.stdin if x.strip())
if not v:
    print("0,0,0")
else:
    n = len(v)
    avg = sum(v) / n
    p50 = v[min(int(0.5 * n), n - 1)]
    p95 = v[min(int(0.95 * n), n - 1)]
    print(f"{avg:.1f},{p50:.0f},{p95:.0f}")
')"
  local avg p50 p95
  IFS=, read -r avg p50 p95 <<< "$stats"
  printf "%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n" \
    "$mode" "$symbol" "$tail_off" "$RUNS" "$avg" "$p50" "$p95" "$size" "$lines" "$saved" "$source"
}

if [[ "$MODE_FLAG" == "--json" ]]; then
  # JSON mode: emit all envelopes interleaved (caller filters by params).
  echo "["
  first=1
  for mode in whole symbol tail; do
    for ((i = 0; i < RUNS; i++)); do
      out="$(run_one "$mode" "$FIRST_SYMBOL" -5)"
      if [[ $first -eq 0 ]]; then echo ","; fi
      printf '%s' "$out"
      first=0
    done
  done
  echo "]"
else
  echo "mode,symbol,tail_off,runs,avg_ms,p50_ms,p95_ms,size_lines,lines_read,saved,source"
  run_mode whole
  run_mode symbol "$FIRST_SYMBOL"
  run_mode tail "" -5
fi
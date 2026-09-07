#!/usr/bin/env bash
# Hardcore benchmark for the read tool.
#
# Measures per-file x per-mode latency AND token economics, cold vs warm LSP,
# and cross-mode deltas. Emits:
#   - raw CSV of every envelope
#   - consolidated results JSON
#   - human-readable report (markdown)
#
# Usage:  ./bench-hardcore.sh <binary> [corpus_dir] [warm_runs] [out_dir]
#   binary    path to `opencode` binary (default: dist/opencode-darwin-x64/bin/opencode)
#   corpus    dir of target *.js files (default: /tmp/bench-corpus)
#   warm_runs jobs per warm process (default 9)
#   out_dir   where results land (default /tmp/bench-result)
set -euo pipefail

BIN="${1:-}"
CORPUS="${2:-/tmp/bench-corpus}"
WARM="${3:-9}"
OUT="${4:-/tmp/bench-result}"

if [[ -z "$BIN" || ! -x "$BIN" ]]; then
  BIN="$(cd "$(dirname "$0")/.." && echo "$PWD")/dist/opencode-darwin-x64/bin/opencode"
  echo "using default binary: $BIN" >&2
fi
if [[ ! -d "$CORPUS" ]]; then
  echo "corpus missing: $CORPUS (run bench-corpus.sh first)" >&2
  exit 2
fi
mkdir -p "$OUT"
RAW="$OUT/raw.csv"
RES="$OUT/results.json"
REP="$OUT/report.md"

: > "$RAW"

FILES=("$CORPUS"/*.js)
RUNS_PER_CELL=$((WARM + 1)) # 1 cold + N warm, same process for warm

cold_job() { # file mode -> params JSON
  local file="$1" mode="$2"
  case "$mode" in
    whole)  echo "{\"filePath\":\"$file\"}" ;;
    symbol) echo "{\"filePath\":\"$file\",\"symbol\":\"targetFunc\"}" ;;
    search) echo "{\"filePath\":\"$file\",\"search\":\"targetFunc\"}" ;;
    tail)   echo "{\"filePath\":\"$file\",\"offset\":-5}" ;;
    depth)  echo "{\"filePath\":\"$file\",\"symbol\":\"targetFunc\",\"depth\":1}" ;;
  esac
}

# Build the warm params array: WARM identical jobs, comma-joined.
warm_array() {
  local file="$1" mode="$2" jobs=() j
  for ((j = 0; j < WARM; j++)); do
    jobs+=("$(cold_job "$file" "$mode")")
  done
  local IFS=,
  echo "[${jobs[*]}]"
}

run_process() { # file mode phase (cold|warm) -> envelopes on stdout
  local file="$1" mode="$2" phase="$3"
  if [[ "$phase" == "cold" ]]; then
    "$BIN" debug read --meta-only --params "$(cold_job "$file" "$mode")" 2>/dev/null
  else
    "$BIN" debug read --meta-only --params "$(warm_array "$file" "$mode")" 2>/dev/null
  fi
}

declare -A SLOT
slot_metric() { # file mode phase metric
  local file="$1" mode="$2" phase="$3" metric="$4"
  printf '%s' "${SLOT["$(basename "$file")|$mode|$phase|$metric"]}"
}

FILE_LIST=""
for FILE in "${FILES[@]}"; do
  b="$(basename "$FILE")"
  total_lines="$(wc -l < "$FILE" | tr -d ' ')"
  FILE_LIST+="$b:$total_lines "
  for MODE in whole symbol search tail depth; do
    for PHASE in cold warm; do
      ENVS="$(run_process "$FILE" "$MODE" "$PHASE")"
      # parse into raw.csv lines tagged with file|mode|phase
      printf '%s' "$ENVS" | python3 -c '
import json, sys
file, mode, phase = sys.argv[1], sys.argv[2], sys.argv[3]
tlines = int(sys.argv[4])
total_chars = 0
ms_list, chars_list, size_list, lr_list, saved_list, src_list, ok_count = [], [], [], [], [], [], 0
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try: e = json.loads(line)
    except Exception: continue
    ri = e.get("run_index", 0)
    ms = e.get("ms", -1)
    ok = e.get("ok", True)
    meta = e.get("metadata") or {}
    out = e.get("output") or ""
    ochars = e.get("output_chars", len(out))
    src = meta.get("source", "")
    size = meta.get("size", 0)
    lr = meta.get("lines_read", 0)
    saved = meta.get("saved", 0)
    print(f"{file}|{mode}|{phase}|{ri}|{ms}|{ochars}|{size}|{lr}|{saved}|{src}|{int(ok)}", file=sys.stderr)
    if ok:
        ms_list.append(ms); chars_list.append(ochars); size_list.append(size)
        lr_list.append(lr); saved_list.append(saved); src_list.append(src); ok_count += 1
        total_chars += ochars
if not ok_count:
    print(f"NO_OK {file} {mode} {phase}", file=sys.stderr)
' "$b" "$MODE" "$PHASE" "$total_lines" 2>>"$RAW"

      # Aggregate per-slot metrics into SLOT via python (single pass over RAW tail)
      # Simpler: recompute aggregates from RAW with awk/python after each slot.
      SLOT["$b|$MODE|$PHASE|rows"]="$(rg -c "^$b\|$MODE\|$PHASE\|" "$RAW" || true)"
    done
  done
done

echo "raw rows: $(wc -l < "$RAW")"

# ---- aggregate into results.json + report ----
python3 "$(dirname "$0")/bench-report.py" "$RAW" "$RES" "$REP" "$FILE_LIST"

echo "=== saved artifacts ==="
echo "raw:   $RAW"
echo "json:  $RES"
echo "report:$REP"

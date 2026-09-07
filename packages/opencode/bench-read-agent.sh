#!/usr/bin/env bash
# Model-driven A/B read-agent evaluator. Credentials come only from normal OpenCode provider config.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd -P)"
if [[ "${1:-}" == "--self-test" ]]; then
  exec python3 "$ROOT/bench-read-agent-report.py" --self-test
fi

BASELINE=""
CANDIDATE=""
MODELS=""
RUNS=1
OUT=""
RESUME=0
REPORT_ONLY=0
TIMEOUT_SEC=180
while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline) BASELINE="${2:-}"; shift 2 ;;
    --candidate) CANDIDATE="${2:-}"; shift 2 ;;
    --models) MODELS="${2:-}"; shift 2 ;;
    --runs) RUNS="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    --timeout-sec) TIMEOUT_SEC="${2:-}"; shift 2 ;;
    --resume) RESUME=1; shift ;;
    --report-only) REPORT_ONLY=1; shift ;;
    *) echo "usage: $0 --baseline BIN --candidate BIN --models provider/model[,provider/model] [--runs N] [--timeout-sec N] --out DIR [--resume] | $0 --report-only --out DIR" >&2; exit 2 ;;
  esac
done
if [[ "$REPORT_ONLY" == 1 ]]; then
  [[ -n "$OUT" ]] || { echo "--out required" >&2; exit 2; }
  exec python3 "$ROOT/bench-read-agent-report.py" report --out "$OUT"
fi
[[ -n "$BASELINE" && -x "$BASELINE" ]] || { echo "missing executable baseline: $BASELINE" >&2; exit 2; }
[[ -n "$CANDIDATE" && -x "$CANDIDATE" ]] || { echo "missing executable candidate: $CANDIDATE" >&2; exit 2; }
[[ -n "$MODELS" && -n "$OUT" ]] || { echo "--models and --out required" >&2; exit 2; }
[[ "$RUNS" =~ ^[1-9][0-9]*$ ]] || { echo "--runs must be positive integer" >&2; exit 2; }
[[ "$TIMEOUT_SEC" =~ ^[1-9][0-9]*$ ]] || { echo "--timeout-sec must be positive integer" >&2; exit 2; }
exec python3 "$ROOT/bench-read-agent-report.py" run --baseline "$BASELINE" --candidate "$CANDIDATE" --models "$MODELS" --runs "$RUNS" --timeout-sec "$TIMEOUT_SEC" --out "$OUT" $([[ "$RESUME" == 1 ]] && printf '%s' '--resume')

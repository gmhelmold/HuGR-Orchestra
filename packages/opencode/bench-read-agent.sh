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
while [[ $# -gt 0 ]]; do
  case "$1" in
    --baseline) BASELINE="${2:-}"; shift 2 ;;
    --candidate) CANDIDATE="${2:-}"; shift 2 ;;
    --models) MODELS="${2:-}"; shift 2 ;;
    --runs) RUNS="${2:-}"; shift 2 ;;
    --out) OUT="${2:-}"; shift 2 ;;
    *) echo "usage: $0 --baseline BIN --candidate BIN --models provider/model[,provider/model] [--runs N] --out DIR" >&2; exit 2 ;;
  esac
done
[[ -n "$BASELINE" && -x "$BASELINE" ]] || { echo "missing executable baseline: $BASELINE" >&2; exit 2; }
[[ -n "$CANDIDATE" && -x "$CANDIDATE" ]] || { echo "missing executable candidate: $CANDIDATE" >&2; exit 2; }
[[ -n "$MODELS" && -n "$OUT" ]] || { echo "--models and --out required" >&2; exit 2; }
[[ "$RUNS" =~ ^[1-9][0-9]*$ ]] || { echo "--runs must be positive integer" >&2; exit 2; }
exec python3 "$ROOT/bench-read-agent-report.py" run --baseline "$BASELINE" --candidate "$CANDIDATE" --models "$MODELS" --runs "$RUNS" --out "$OUT"

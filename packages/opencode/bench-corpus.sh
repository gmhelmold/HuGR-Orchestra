#!/usr/bin/env bash
# Generate a benchmark corpus: 3 sizes x 2 symbol densities.
#
#   small  (~300  lines) | dense / sparse
#   med    (~3000 lines) | dense / sparse
#   large  (~12000 lines)| dense / sparse
#
# Every file contains exactly one misnamed target symbol `targetFunc` plus an
# unambiguous sibling `siblingFunc`, so symbol-resolution accuracy can be
# measured (exact vs substring vs indent fallback).
set -euo pipefail

OUT="${1:-/tmp/bench-corpus}"
mkdir -p "$OUT"

gen_dense() { # file lines fn_body
  local file="$1" lines="$2" body="$3"
  {
    echo "'use strict';"
    echo "const GLOBAL = Math.random();"
    echo "function helper$((RANDOM % 7))() { return GLOBAL + 1 }"
    i=0
    while [ "$i" -lt "$lines" ]; do
      echo "function fn_${i}_noise() {"
      echo "  const k = helper$((RANDOM % 7))() * $i;"
      echo "  return k;"
      echo "}"
      echo "const c_${i}_noise = () => fn_${i}_noise() + $i;"
      i=$((i + 4))
    done
    echo "function targetFunc(x) {"
    echo "  let acc = 0;"
    echo "  for (let j = 0; j < $body; j++) acc += j * x;"
    echo "  return acc;"
    echo "}"
    echo "function siblingFunc() { return targetFunc(2) }"
  } >> "$file"
}

gen_sparse() { # file lines fn_body
  local file="$1" lines="$2" body="$3"
  {
    echo "'use strict';"
    echo "function targetFunc(x) {"
    echo "  let acc = 0;"
    i=0
    while [ "$i" -lt "$body" ]; do
      echo "  acc += ${i} * x;"
      i=$((i + 1))
    done
    echo "  return acc;"
    echo "}"
    echo "function siblingFunc() { return targetFunc(2) }"
    n=0
    while [ "$n" -lt "$lines" ]; do
      echo "function pad_${n}() { return '$n' + targetFunc(1) }"
      n=$((n + 1))
    done
  } >> "$file"
}

gen_dense  "$OUT/small-dense.js"   300  200
gen_sparse "$OUT/small-sparse.js"  300  150
gen_dense  "$OUT/med-dense.js"    3000 400
gen_sparse "$OUT/med-sparse.js"   3000 800
gen_dense  "$OUT/large-dense.js"  12000 800
gen_sparse "$OUT/large-sparse.js" 12000 3000

wc -l "$OUT"/*.js
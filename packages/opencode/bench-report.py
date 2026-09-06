#!/usr/bin/env python3
"""Aggregate a bench-hardcore raw.csv into results.json + report.md.

Usage: bench-report.py <raw.csv> <results.json> <report.md> <"file:tlines ...">
"""
import json
import statistics
import sys


def main() -> None:
    raw, res_path, rep_path = sys.argv[1], sys.argv[2], sys.argv[3]
    file_list = sys.argv[4].split()

    rows = []
    with open(raw) as f:
        for line in f:
            line = line.rstrip("\n")
            if not line:
                continue
            try:
                file, mode, phase, ri, ms, ochars, size, lr, saved, src, ok = line.split("|")
            except ValueError:
                continue
            rows.append(
                dict(
                    file=file,
                    mode=mode,
                    phase=phase,
                    ri=int(ri),
                    ms=int(ms),
                    ochars=int(ochars),
                    size=int(size),
                    lr=int(lr),
                    saved=int(saved),
                    src=src,
                    ok=ok == "1",
                )
            )

    def stats(xs):
        if not xs:
            return {}
        xs = sorted(xs)
        n = len(xs)
        return dict(
            n=n,
            min=xs[0],
            p50=xs[n * 50 // 100],
            p95=xs[min(n * 95 // 100, n - 1)],
            max=xs[-1],
            avg=statistics.mean(xs),
            std=statistics.pstdev(xs) if n > 1 else 0,
        )

    cells: dict = {}
    for r in rows:
        key = (r["file"], r["mode"], r["phase"])
        cells.setdefault(
            key,
            {"ms": [], "ochars": [], "size": [], "lr": [], "saved": [], "src": [], "ok": 0, "total": 0},
        )
        c = cells[key]
        c["total"] += 1
        if r["ok"]:
            c["ok"] += 1
            c["ms"].append(r["ms"])
            c["ochars"].append(r["ochars"])
            c["size"].append(r["size"])
            c["lr"].append(r["lr"])
            c["saved"].append(r["saved"])
            c["src"].append(r["src"])

    out_cells = {}
    for (file, mode, phase), c in cells.items():
        out_cells[f"{file}|{mode}|{phase}"] = dict(
            ok=c["ok"],
            total=c["total"],
            ms=stats(c["ms"]),
            ochars=stats(c["ochars"]),
            size=stats(c["size"]),
            lr=stats(c["lr"]),
            saved=stats(c["saved"]),
            src_lsp=sum(1 for s in c["src"] if s == "lsp"),
            src_indent=sum(1 for s in c["src"] if s == "indent"),
        )

    def cell(file, mode, phase="warm"):
        return out_cells.get(f"{file}|{mode}|{phase}", {})

    def f(x, d="\u2013"):
        return f"{x:,.0f}" if isinstance(x, (int, float)) else d

    def sp(base, v):
        if not base or not v:
            return "\u2013"
        return f"{base / v:.1f}x"

    def red(base, v):
        if not base or not v:
            return "\u2013"
        if v >= base:
            return "\u2248"
        return f"-{(1 - v / base) * 100:.0f}%"

    lines = ["# read tool \u2014 hardcore benchmark", ""]

    # --- latency: warm p50 per mode, delta vs whole ---
    lines += ["## Latency (warm p50 ms)", "", "| file | whole | symbol | tail | depth | \u0394 symbol | \u0394 tail | \u0394 depth |"]
    lines += ["|---|---|---|---|---|---|---|---|"]
    for entry in file_list:
        file, tlines = entry.rsplit(":", 1)
        w = cell(file, "whole").get("ms", {}).get("p50")
        s = cell(file, "symbol").get("ms", {}).get("p50")
        t = cell(file, "tail").get("ms", {}).get("p50")
        d = cell(file, "depth").get("ms", {}).get("p50")
        lines += [f"| {file} ({tlines}L) | {f(w)} | {f(s)} | {f(t)} | {f(d)} | {sp(w, s)} | {sp(w, t)} | {sp(w, d)} |"]

    # --- token economics: output bytes, delta vs whole ---
    lines += ["", "## Output bytes (warm avg)", "", "| file | whole | symbol | tail | \u0394 symbol | \u0394 tail |"]
    lines += ["|---|---|---|---|---|---|"]
    for entry in file_list:
        file, _ = entry.rsplit(":", 1)
        w = cell(file, "whole").get("ochars", {}).get("avg")
        s = cell(file, "symbol").get("ochars", {}).get("avg")
        t = cell(file, "tail").get("ochars", {}).get("avg")
        lines += [f"| {file} | {f(w)} | {f(s)} | {f(t)} | {red(w, s)} | {red(w, t)} |"]

    # --- cold vs warm: symbol mode latency (p50 — robust to bench-runner noise) ---
    lines += ["", "## Cold \u2192 warm (p50 ms, symbol res)", "", "| file | cold | warm | \u0394 |"]
    lines += ["|---|---|---|---|"]
    for entry in file_list:
        file, _ = entry.rsplit(":", 1)
        c = cell(file, "symbol", "cold").get("ms", {}).get("p50")
        w = cell(file, "symbol").get("ms", {}).get("p50")
        lines += [f"| {file} | {f(c)} | {f(w)} | {sp(c, w)} |"]

    # --- resolution accuracy (lsp vs indent heuristic) ---
    lines += ["", "## Symbol resolution (source, warm)", "", "| file | lsp | indent | accuracy |"]
    lines += ["|---|---|---|---|"]
    for entry in file_list:
        file, _ = entry.rsplit(":", 1)
        c = cell(file, "symbol")
        n = c.get("src_lsp", 0) + c.get("src_indent", 0)
        acc = f"{c.get('src_lsp', 0) / n * 100:.0f}%" if n else "\u2013"
        lines += [f"| {file} | {c.get('src_lsp', 0)} | {c.get('src_indent', 0)} | {acc} |"]

    # --- symbol slice economics: lines read vs full file ---
    lines += ["", "## Symbol slice (warm, symbol mode)", "", "| file | full lines | lines_read | saved |"]
    lines += ["|---|---|---|---|"]
    for entry in file_list:
        file, tlines = entry.rsplit(":", 1)
        c = cell(file, "symbol")
        lr = c.get("lr", {}).get("avg")
        saved = int(tlines) - lr if lr else None
        lines += [f"| {file} | {tlines} | {f(lr)} | {f(saved)} |"]

    report = "\n".join(lines) + "\n"
    open(rep_path, "w").write(report)
    json.dump({"cells": out_cells, "file_list": file_list}, open(res_path, "w"), indent=1)
    print(report)


if __name__ == "__main__":
    main()
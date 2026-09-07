#!/usr/bin/env python3
"""Fail-closed parser and reporter for `opencode run --format json` read-agent trials."""
import argparse
import hashlib
import json
import shutil
import statistics
import subprocess
from pathlib import Path

TASKS = (
    ("tail", "tail-marker.txt", "READ_AGENT_TAIL_MARKER_6C8A7E"),
    ("middle", "middle-marker.txt", "READ_AGENT_MIDDLE_MARKER_3F91BD"),
    ("long_line", "long-line-marker.txt", "READ_AGENT_LONG_LINE_MARKER_8D42C1"),
)


class InvalidStream(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise InvalidStream(message)


def number(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and value >= 0


def parse_stream(text):
    """Accept only event schema emitted by current `opencode run --format json`."""
    events = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line.strip():
            raise InvalidStream(f"malformed stream: blank line {line_number}")
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise InvalidStream(f"malformed stream line {line_number}: {error.msg}") from error
        require(isinstance(event, dict), f"unsupported schema line {line_number}: event is not object")
        event_type = event.get("type")
        require(event_type in {"tool_use", "text", "step_start", "step_finish", "error"}, f"unsupported schema line {line_number}: {event_type!r}")
        require(isinstance(event.get("part") if event_type != "error" else event.get("error"), dict), f"unsupported schema line {line_number}: missing payload")
        events.append(event)
    require(events, "malformed stream: no events")
    return events


def parse_trial(text, expected_marker):
    tools, final, seen_calls, telemetry = [], [], set(), []
    for event in parse_stream(text):
        kind = event["type"]
        if kind == "error":
            raise InvalidStream("model error event")
        part = event["part"]
        require(isinstance(part.get("type"), str), "unsupported schema: part type missing")
        if kind == "tool_use":
            require(part["type"] == "tool", "unsupported schema: tool_use part")
            require(isinstance(part.get("callID"), str) and part["callID"], "unsupported schema: tool call id")
            require(part["callID"] not in seen_calls, "duplicate tool result")
            seen_calls.add(part["callID"])
            state = part.get("state")
            require(isinstance(state, dict) and state.get("status") in {"completed", "error"}, "unsupported schema: tool result")
            require(isinstance(part.get("tool"), str), "unsupported schema: tool name")
            require(isinstance(state.get("input"), dict), "unsupported schema: tool input")
            result = state.get("output") if state["status"] == "completed" else state.get("error")
            require(isinstance(result, str), "unsupported schema: tool result body")
            tools.append({"call_id": part["callID"], "tool": part["tool"], "status": state["status"], "input": state["input"], "result": result})
        elif kind == "text":
            require(part["type"] == "text" and isinstance(part.get("text"), str), "unsupported schema: text part")
            final.append(part["text"])
        elif kind == "step_start":
            require(part["type"] == "step-start", "unsupported schema: step_start part")
        elif kind == "step_finish":
            require(part["type"] == "step-finish", "unsupported schema: step_finish part")
            tokens, cost = part.get("tokens"), part.get("cost")
            require(isinstance(tokens, dict) and number(tokens.get("input")) and number(tokens.get("output")) and number(cost), "unsupported schema: step telemetry")
            telemetry.append((tokens["input"], tokens["output"], cost))
    answer = "\n".join(final).strip()
    require(answer, "missing final response")
    require(any(tool["tool"] == "read" for tool in tools), "no read call")
    require(expected_marker in answer, "missing exact marker")
    return {
        "outcome": "success",
        "final": answer,
        "tool_calls": tools,
        "read_calls": sum(tool["tool"] == "read" for tool in tools),
        "retries": None,  # `run --format json` has no retry event; do not infer retries from steps.
        "tokens_input": None if not telemetry else sum(item[0] for item in telemetry),
        "tokens_output": None if not telemetry else sum(item[1] for item in telemetry),
        "cost": None if not telemetry else sum(item[2] for item in telemetry),
    }


def write_corpus(out):
    corpus = out / "corpus"
    corpus.mkdir(parents=True, exist_ok=True)
    tail = "".join(f"tail decoy line {index:05d}\n" for index in range(20_000)) + TASKS[0][2] + "\n"
    middle = "".join(f"middle decoy line {index:05d}\n" for index in range(10_000)) + TASKS[1][2] + "\n" + "".join(f"middle decoy line {index:05d}\n" for index in range(10_000, 20_000))
    long_line = ("long-line-decoy-" * 8_192) + TASKS[2][2] + ("-long-line-decoy" * 8_192) + "\n"
    contents = {"tail-marker.txt": tail, "middle-marker.txt": middle, "long-line-marker.txt": long_line}
    fixtures = []
    for name, content in contents.items():
        path = corpus / name
        path.write_text(content, encoding="utf-8", newline="\n")
        fixtures.append({"file": name, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    manifest = {"tasks": [{"id": task, "file": file, "answer": answer} for task, file, answer in TASKS], "fixtures": fixtures}
    (corpus / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    return corpus, manifest


def validate_corpus(corpus, manifest):
    for fixture in manifest["fixtures"]:
        path = corpus / fixture["file"]
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != fixture["sha256"]:
            raise SystemExit(f"invalid corpus fixture: {path}")


def median(values):
    present = [value for value in values if value is not None]
    return "N/A" if not present else statistics.median(present)


def report(rows, out):
    groups = {}
    for row in rows:
        groups.setdefault((row["model"], row["task"]), {}).setdefault(row["binary"], []).append(row)
    summary = []
    for (model, task), binaries in sorted(groups.items()):
        require(set(binaries) == {"baseline", "candidate"}, f"unknown model outcome: incomplete pair {model}/{task}")
        entry = {"model": model, "task": task, "binaries": {}}
        for binary, samples in sorted(binaries.items()):
            expected_runs = {sample["run"] for sample in samples}
            require(len(expected_runs) == len(samples), f"duplicate trial: {binary}/{model}/{task}")
            entry["binaries"][binary] = {
                "success_rate": sum(sample["outcome"] == "success" for sample in samples) / len(samples),
                "median_read_calls": median([sample.get("read_calls") for sample in samples]),
                "median_retries": median([sample.get("retries") for sample in samples]),
                "median_tokens_input": median([sample.get("tokens_input") for sample in samples]),
                "median_tokens_output": median([sample.get("tokens_output") for sample in samples]),
                "median_cost": median([sample.get("cost") for sample in samples]),
            }
        summary.append(entry)
    result = {"rows": rows, "paired": summary}
    (out / "results.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    lines = ["# Read Agent A/B", "", "| model | task | binary | success | median read calls | median retries | tokens in/out | cost |", "|---|---|---|---:|---:|---:|---:|---:|"]
    for pair in summary:
        for binary in ("baseline", "candidate"):
            value = pair["binaries"][binary]
            tokens = f"{value['median_tokens_input']}/{value['median_tokens_output']}" if value["median_tokens_input"] != "N/A" else "N/A"
            lines.append(f"| {pair['model']} | {pair['task']} | {binary} | {value['success_rate']:.0%} | {value['median_read_calls']} | {value['median_retries']} | {tokens} | {value['median_cost']} |")
    (out / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def run(args):
    models = args.models.split(",")
    if not models or any(not model or "/" not in model or model.startswith("/") or model.endswith("/") for model in models) or len(set(models)) != len(models):
        raise SystemExit("--models must be unique explicit provider/model IDs")
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    corpus, manifest = write_corpus(out)
    validate_corpus(corpus, manifest)
    raw = out / "raw-events"
    if raw.exists():
        shutil.rmtree(raw)
    raw.mkdir()
    rows = []
    for binary_name, binary in (("baseline", args.baseline), ("candidate", args.candidate)):
        for model in models:
            for task, file, answer in TASKS:
                prompt = f"Find exact marker in {file}. Reply with marker only."
                for trial in range(args.runs):
                    path = raw / f"{binary_name}--{model.replace('/', '_')}--{task}--{trial}.jsonl"
                    process = subprocess.run([binary, "run", "--format", "json", "--model", model, prompt], cwd=corpus, text=True, capture_output=True)
                    path.write_text(process.stdout, encoding="utf-8")
                    row = {"binary": binary_name, "model": model, "task": task, "run": trial, "raw_events": str(path.relative_to(out))}
                    try:
                        if process.returncode != 0:
                            raise InvalidStream(f"unknown model outcome: process exited {process.returncode}: {process.stderr.strip()}")
                        row.update(parse_trial(process.stdout, answer))
                    except InvalidStream as error:
                        row.update(outcome="failed", error=str(error), read_calls=None, retries=None, tokens_input=None, tokens_output=None, cost=None)
                    rows.append(row)
    (out / "trials.jsonl").write_text("".join(json.dumps(row) + "\n" for row in rows), encoding="utf-8")
    report(rows, out)
    if any(row["outcome"] != "success" for row in rows):
        raise SystemExit("one or more trials failed closed; inspect trials.jsonl")


def self_test():
    tool = {"type": "tool_use", "part": {"type": "tool", "callID": "call-1", "tool": "read", "state": {"status": "completed", "input": {"filePath": "x"}, "output": "x"}}}
    text = {"type": "text", "part": {"type": "text", "text": "MARKER"}}
    finish = {"type": "step_finish", "part": {"type": "step-finish", "cost": 1, "tokens": {"input": 2, "output": 3}}}
    good = "\n".join(json.dumps(item) for item in (tool, text, finish))
    assert parse_trial(good, "MARKER")["read_calls"] == 1
    probes = [("not-json", "malformed event"), ("\n".join(json.dumps(item) for item in (text, finish)), "no-read"), ("\n".join(json.dumps(item) for item in (tool, {**text, "part": {**text["part"], "text": "wrong"}}, finish)), "wrong marker"), ("\n".join(json.dumps(item) for item in (tool, tool, text, finish)), "duplicate result")]
    for stream, name in probes:
        try:
            parse_trial(stream, "MARKER")
        except InvalidStream:
            continue
        raise AssertionError(f"self-test did not fail closed: {name}")
    print("bench-read-agent self-test: pass")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["run"], nargs="?")
    parser.add_argument("--baseline")
    parser.add_argument("--candidate")
    parser.add_argument("--models")
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--out")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
        return
    if args.command != "run" or not all((args.baseline, args.candidate, args.models, args.out)) or args.runs < 1:
        raise SystemExit("invalid evaluator arguments")
    run(args)


if __name__ == "__main__":
    main()

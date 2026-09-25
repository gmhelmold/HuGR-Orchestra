# Runtime audit — governed foreground/background binding

Audited product: `b0c33d2f6567a2c741240f3c44bc00ca2f01e7e7`.
Active issue: [#86](https://github.com/gmhelmold/HuGR-Orchestra/issues/86).

## Question

Does Maestro's “exact governed Task” approval bind whether the child executes foreground or background?

## Source trace

`packages/opencode/src/tool/task.ts` exposes `background?: boolean`. The value materially changes execution:
- foreground waits for the child result/promotion;
- background starts or extends a BackgroundJob, returns a running result early, arranges notification, and later injects a synthetic result into the parent session.

The governed hash check nevertheless calls `taskHash` with subagent type, prompt, model and task ID plus the approval hashes. `background` is absent.

`packages/opencode/src/maestro/task-hash.ts` likewise omits it from `TaskIntent`; approval presentation intent and the public approval tool schema omit it too.

## Executed evidence

The existing governed-lifecycle integration was copied in a disposable clone. The exact patch is [governed-background.patch](probes/governed-background.patch).

Only background support was enabled and `background:true` was added to the approved Task dispatch. The existing presentation and task hash remained unchanged.

The target lifecycle test passed twice in independent fresh fixtures. See [results](evidence/results.txt).

That proves the current binding treats foreground and background executions as the same approved intent.

## Why this is semantic, not cosmetic

Background mode changes response timing, BackgroundJob state, continuation behavior, notification/synthetic injection and cancellation flow. Therefore either:
- the normalized execution mode belongs in the durable approval intent/hash; or
- governed Tasks must explicitly reject background mode before approval consumption.

## Boundary

The public `maestro_present_approval` tool is deliberately unavailable until durable plan-revision and validation readers exist. This finding does not claim an enabled public exploit; it is a contract/runtime mismatch that should be closed before unblocking that path.

No production code was changed by this audit.

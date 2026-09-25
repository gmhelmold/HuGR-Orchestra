## subagent models

Session-scoped allowlist of models that subagents may run on, plus an
explicit per-call model parameter on the task tool. The allowlist is stored as
ordinary session permission rules — no schema change, no migration.

### user flow

1. In a session (or on a draft, before the first message), the composer shows
   a "Subagents" control next to the model and reasoning selectors.
2. Opening it renders a searchable, provider-grouped list of visible models
   with a switch per row (same pattern as the model management dialog).
3. Switching a model on appends allow/deny task rules to the session; the
   first enabled model also writes the `*/*` deny baseline so unchecked
   models are denied instead of falling through to ask.
4. The task tool description lists the session's allowed provider/model
   patterns, so the model knows exactly what it may pass as `model` and what
   will be denied. Without session rules, behavior is unchanged (no section,
   no extra ask).

### draft flow

A draft has no session id yet, so the pending selection lives in a per-directory
module store (`draft-subagent-models.ts`, in-memory, bounded, reactive via a
version signal). On the first message the session is created and, before the
first prompt is dispatched (sequentially, inside the same async handler), the
selection is flushed into the session's permission rules via the v1
`session.update` route. No race by construction: the first task call observes
the rules.

### task tool contract

Tool: `task`.

Parameter `model` (optional, string):
`providerID/modelID` (e.g. `openrouter/deepseek/deepseek-chat`). Resolution
order: param > agent-configured model > parent session model.

If the session carries model-scoped task rules (permission `task` with a `/`
in the pattern), the resolved `provider/model` is appended to the permission
ask patterns and surfaced in the ask metadata; a denied model responds with
the session ruleset so the caller can retry with an allowed one.

### permission rules shape

Stored on the session (`Session.permission`):

```
{ permission: "task", pattern: "*/*",             action: "deny"  }  // baseline, written once
{ permission: "task", pattern: "openrouter/*",    action: "allow" }  // provider scope
{ permission: "task", pattern: "openrouter/x",    action: "deny"  }  // explicit deny wins (last)
```

The `*/*` shape only matches provider/model patterns (it contains a `/`), so
it never collides with `subagent_type` gating (`task` + agent name, which has
no `/`).

Matching semantics are the canonical wildcard matcher with last-match-wins,
shared by both sides:

- Enforcement: `Permission.evaluate("task", pattern, ruleset)` at ask time.
- Visibility: `ToolRegistry.allowedTaskModels(ruleset)` filters patterns whose
  evaluated action is allow, appended to the task tool description.

Client helper (`subagent-model-rules.ts`) mirrors the matcher for checkbox
state, plus `toggleModelRules` producing append-only rule batches (server
merges, last match wins — so removing a model does not require rewriting the
whole ruleset).

### files

Server:

- `packages/opencode/src/tool/task.ts` — `model` param, model pattern in ask,
  metadata.
- `packages/opencode/src/tool/registry.ts` — `allowedTaskModels` + description.
- `packages/opencode/src/tool/task.txt` — tool usage notes.

Client:

- `packages/app/src/components/subagent-model-rules.ts` (+ tests) — matcher,
  state, toggle batches.
- `packages/app/src/components/draft-subagent-models.ts` (+ tests) — pending
  pre-session selection.
- `packages/app/src/components/dialog-subagent-models.tsx` — picker dialog.
- `packages/app/src/components/prompt-input.tsx` / `prompt-input-v2.tsx` —
  composer control (session + legacy).
- `packages/app/src/components/prompt-input/submit.ts` — draft flush.
- `packages/app/src/pages/session/tasks-data.ts` — tasks pane aggregates.

## decision record

Status: accepted (2026-09).

Context: gate which models subagents may use per session, and let the model
pick at call time, without inventing storage.

Considered:

1. New session field / metadata column — rejected: schema migration + write
   paths + API for something the permission system already models.
2. Agent-configured model only — rejected: global, not per session; the whole
   point is a per-session allowlist.
3. Threading session context into tool registry for dynamic description —
   rejected: invasive; enforcement (ask patterns) already has the session
   ruleset at call time, and appending the allowed list to the existing tool
   description keeps visibility in lockstep with enforcement (same matcher).
4. Accepted: session permission rules (`task` + `provider/model` patterns),
   last-match-wins canonical wildcard matching, shared matcher client/server.
   Payload is plain `Session.permission`, written via the existing
   `session.update` route; drafts buffer in a tiny in-memory pending store and
   flush on session create before the first prompt.

Consequences:

- No migration, works over v1 and v2 session models.
- Allowlist visible to the model (tool description) and enforced (ask).
- Removing a model is append of a deny; baseline `*/*` deny makes unchecked
  models unavailable without needing to enumerate them.
- The task tool gains a `model` param; resolution is
  param > agent model > parent model (backwards compatible).
- Draft pending set is per-directory and in-memory: survives the composer but
  not a reload before first message (acceptable: no session exists yet to
  attach it to anyway).
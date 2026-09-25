import { SessionV1 } from "@opencode-ai/core/v1/session"

// Automatic Maestro admission runs once at the persisted-message boundary,
// before Maestro model work. Model-facing role is not stakeholder provenance.
// Only direct user content or explicit preserved lineage qualifies. Admission
// classifies work; it never authorizes execution.

export const DIRECT_SOURCE_KEY = "maestro_direct_source"
const CONTINUATION_ALIAS = "maestro_continuation_of"
const REPLAY_ALIAS = "maestro_replay_of"

function metadataSource(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const record = value as Record<string, unknown>
  for (const key of [DIRECT_SOURCE_KEY, CONTINUATION_ALIAS, REPLAY_ALIAS]) {
    const candidate = record[key]
    if (typeof candidate === "string" && candidate.trim().length > 0) return candidate
  }
  return undefined
}

export function lineageSource(message: SessionV1.WithParts): string | undefined {
  for (const part of message.parts) {
    if (part.type !== "text") continue
    const source = metadataSource(part.metadata)
    if (source) return source
  }
  return undefined
}

function isDirectText(part: SessionV1.Part): boolean {
  if (part.type !== "text") return false
  if (part.synthetic === true) return false
  if (part.ignored === true) return false
  return part.text.trim().length > 0
}

function isDirectFile(part: SessionV1.Part): boolean {
  if (part.type !== "file") return false
  return (part as { synthetic?: unknown }).synthetic !== true
}

export function hasDirectContent(message: SessionV1.WithParts): boolean {
  return message.parts.some((part) => isDirectText(part) || isDirectFile(part))
}

export function hasCompactionPart(message: SessionV1.WithParts): boolean {
  return message.parts.some((part) => part.type === "compaction")
}

export type OriginClass =
  | { kind: "non-user" }
  | { kind: "compaction-control" }
  | { kind: "continuation"; sourceMessageID: string }
  | { kind: "direct" }
  | { kind: "synthetic-only" }

export function classifyOrigin(message: SessionV1.WithParts): OriginClass {
  if (message.info.role !== "user") return { kind: "non-user" }
  if (hasCompactionPart(message)) return { kind: "compaction-control" }
  const source = lineageSource(message)
  if (source) return { kind: "continuation", sourceMessageID: source }
  if (hasDirectContent(message)) return { kind: "direct" }
  return { kind: "synthetic-only" }
}

// Deterministic direct-request selection for the tool boundary. Sorts by
// persisted creation time with message-ID tie-break (imported messages are not
// guaranteed monotonic IDs, array order is not chronological after compaction
// reorder). Lineage continuations and compaction controls never qualify.
export function selectDirectCandidate(messages: SessionV1.WithParts[]): SessionV1.WithParts | undefined {
  return messages
    .filter((message) => message.info.role === "user")
    .filter((message) => !hasCompactionPart(message))
    .filter((message) => lineageSource(message) === undefined)
    .filter(hasDirectContent)
    .sort(
      (left, right) =>
        left.info.time.created - right.info.time.created || left.info.id.localeCompare(right.info.id),
    )
    .at(-1)
}

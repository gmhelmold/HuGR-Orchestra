import { SessionV1 } from "@opencode-ai/core/v1/session"
import { Effect } from "effect"
import { MessageV2 } from "../session/message-v2"
import { SessionID } from "../session/schema"
import { NotFoundError } from "../storage/storage"
import { classifyOrigin, hasDirectContent, hasCompactionPart, lineageSource } from "./admission-origin"
import { readAdmission, recordAdmission, type AdmissionRecord } from "./admission-record"

// Automatic admission trigger. Call once per persisted user message before
// Maestro model work. Exact replay returns the immutable record without
// calling the assessor again. HOLD produces no record and never authorizes
// execution. The public approval tool stays unavailable.

export type AdmissionHoldReason =
  | "non-maestro-agent"
  | "non-user-role"
  | "compaction-control"
  | "synthetic-only"
  | "lineage-unavailable"
  | "message-not-found"

export type AdmissionTriggerResult =
  | { status: "RECORDED"; record: AdmissionRecord; sourceMessageID: string }
  | { status: "REPLAYED"; record: AdmissionRecord; sourceMessageID: string }
  | { status: "HOLD"; reason: AdmissionHoldReason; sourceMessageID?: string }

export const ADMISSION_METHOD_VERSION = "admit-request-v1"

function isMaestro(message: SessionV1.WithParts): boolean {
  return message.info.role === "user" && message.info.agent === "maestro"
}

function loadMessage(input: { sessionID: string; messageID: string }) {
  return MessageV2.get({
    sessionID: SessionID.make(input.sessionID),
    messageID: input.messageID as SessionV1.MessageID,
  }).pipe(
    Effect.catchIf(NotFoundError.isInstance, () => Effect.succeed(undefined)),
  )
}

function isUsableLineageSource(message: SessionV1.WithParts | undefined): message is SessionV1.WithParts {
  if (!message) return false
  if (message.info.role !== "user") return false
  if (message.info.agent !== "maestro") return false
  if (hasCompactionPart(message)) return false
  if (lineageSource(message) !== undefined) return false
  return hasDirectContent(message)
}

export const ensureAdmission = Effect.fn("MaestroAdmission.ensure")(function* (input: {
  sessionID: string
  messageID: string
  methodVersion?: string
  assess: (message: SessionV1.WithParts) => Effect.Effect<unknown>
}) {
  const methodVersion = input.methodVersion ?? ADMISSION_METHOD_VERSION
  const message = yield* MessageV2.get({
    sessionID: SessionID.make(input.sessionID),
    messageID: input.messageID as SessionV1.MessageID,
  }).pipe(Effect.catchIf(NotFoundError.isInstance, () => Effect.succeed(undefined)))
  if (!message) return { status: "HOLD", reason: "message-not-found" } as const
  if (message.info.role !== "user") return { status: "HOLD", reason: "non-user-role" } as const
  if (!isMaestro(message)) return { status: "HOLD", reason: "non-maestro-agent" } as const

  const origin = classifyOrigin(message)
  if (origin.kind === "non-user") return { status: "HOLD", reason: "non-user-role" } as const
  if (origin.kind === "compaction-control") return { status: "HOLD", reason: "compaction-control" } as const
  if (origin.kind === "synthetic-only") return { status: "HOLD", reason: "synthetic-only" } as const

  if (origin.kind === "continuation") {
    const source = yield* loadMessage({ sessionID: input.sessionID, messageID: origin.sourceMessageID })
    if (!isUsableLineageSource(source)) return { status: "HOLD", reason: "lineage-unavailable" } as const
    const existing = yield* readAdmission({
      sessionID: input.sessionID,
      messageID: source.info.id,
      methodVersion,
    })
    if (existing) return { status: "REPLAYED", record: existing, sourceMessageID: source.info.id } as const
    const assessment = yield* input.assess(source)
    const record = yield* recordAdmission({
      sessionID: input.sessionID,
      messageID: source.info.id,
      methodVersion,
      assessment,
    })
    return { status: "RECORDED", record, sourceMessageID: source.info.id } as const
  }

  const existing = yield* readAdmission({ sessionID: input.sessionID, messageID: message.info.id, methodVersion })
  if (existing) return { status: "REPLAYED", record: existing, sourceMessageID: message.info.id } as const
  const assessment = yield* input.assess(message)
  const record = yield* recordAdmission({
    sessionID: input.sessionID,
    messageID: message.info.id,
    methodVersion,
    assessment,
  })
  return { status: "RECORDED", record, sourceMessageID: message.info.id } as const
})

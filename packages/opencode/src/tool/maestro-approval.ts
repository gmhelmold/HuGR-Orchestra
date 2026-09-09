import { Effect, Schema } from "effect"
import { presentApprovalFromSession, recordApproval } from "@/maestro/approval-record"
import { renderPresentation } from "@/maestro/approval"
import { Database } from "@opencode-ai/core/database/database"
import { EventV2Bridge } from "@/event-v2-bridge"
import { Session } from "@/session/session"
import * as Tool from "./tool"

const PresentationParameters = Schema.Struct({
  planRevisionID: Schema.String,
  validationRecordID: Schema.String,
  memberID: Schema.String,
  revisionHash: Schema.String,
  validationHash: Schema.String,
  contextHash: Schema.String,
  policyHash: Schema.String,
  methodVersion: Schema.String,
  plan: Schema.String,
  provenance: Schema.String,
  assumptions: Schema.Array(Schema.String),
  validationLedger: Schema.String,
  contextState: Schema.Literal("CURRENT"),
})

export const MaestroPresentApprovalTool = Tool.define(
  "maestro_present_approval",
  Effect.gen(function* () {
    const database = yield* Database.Service
    const events = yield* EventV2Bridge.Service
    const sessions = yield* Session.Service
    return {
      description: "Present one exact governed plan approval record. Maestro only; call only after plan validation.",
      parameters: PresentationParameters,
      execute: (params: Schema.Schema.Type<typeof PresentationParameters>, ctx) =>
        Effect.gen(function* () {
        if (ctx.agent !== "maestro") return yield* Effect.fail(new Error("Approval presentation requires Maestro"))
        if (!ctx.callID) return yield* Effect.fail(new Error("Approval presentation requires tool call identity"))
        const presentation = yield* presentApprovalFromSession({
          ...params,
          sessionID: ctx.sessionID,
          assistantMessageID: ctx.messageID,
          callID: ctx.callID,
        })
        return {
          title: "Maestro plan approval",
          metadata: { presentationID: presentation.id },
          output: renderPresentation(presentation),
        }
        }).pipe(
          Effect.provideService(Database.Service, database),
          Effect.provideService(EventV2Bridge.Service, events),
          Effect.provideService(Session.Service, sessions),
          Effect.orDie,
        ),
    }
  }),
)

export const MaestroRecordApprovalTool = Tool.define(
  "maestro_record_approval",
  Effect.gen(function* () {
    const database = yield* Database.Service
    const events = yield* EventV2Bridge.Service
    return {
      description: "Record direct user approval or decline for current exact Maestro plan presentation. Maestro only.",
      parameters: Schema.Struct({}),
      execute: (_: Record<string, never>, ctx) =>
        Effect.gen(function* () {
        if (ctx.agent !== "maestro") return yield* Effect.fail(new Error("Approval decision requires Maestro"))
        const result = yield* recordApproval(ctx.sessionID)
        switch (result.status) {
          case "APPROVED":
          case "DECLINED":
            return {
              title: `Approval ${result.status.toLowerCase()}`,
              metadata: { status: String(result.status), approvalMessageID: result.decision.approvalMessageID },
              output: `${result.status}: exact plan revision ${result.decision.planRevisionID}`,
            }
          case "HOLD":
            return {
              title: "Approval not recorded",
              metadata: { status: String(result.status), approvalMessageID: "" },
              output: `HOLD: ${result.reason}`,
            }
          case "PENDING":
            return {
              title: "Approval not recorded",
              metadata: { status: String(result.status), approvalMessageID: "" },
              output: `PENDING: ${result.kind}`,
            }
        }
        }).pipe(
          Effect.provideService(Database.Service, database),
          Effect.provideService(EventV2Bridge.Service, events),
          Effect.orDie,
        ),
    }
  }),
)

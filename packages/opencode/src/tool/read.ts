import { Effect, Option, Schema, Scope, Stream } from "effect"
import { NonNegativeInt } from "@opencode-ai/core/schema"
import * as path from "path"
import { pathToFileURL } from "url"
import * as Tool from "./tool"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { LSP, type DocumentSymbol as LspDocumentSymbol } from "@/lsp/lsp"
import DESCRIPTION from "./read.txt"
import { InstanceState } from "@/effect/instance-state"
import { assertExternalDirectoryEffect } from "./external-directory"
import { Instruction } from "../session/instruction"
import { isPdfAttachment, sniffAttachmentMime } from "@/util/media"

const DEFAULT_READ_LIMIT = 2000
const MAX_LINE_LENGTH = 2000
const MAX_LINE_SUFFIX = `... (line truncated to ${MAX_LINE_LENGTH} chars)`
const MAX_BYTES = 50 * 1024
const MAX_BYTES_LABEL = `${MAX_BYTES / 1024} KB`
// Token budget per read (Grok parity). A read cuts (with a PARTIAL-view
// footer) once the estimated token count crosses this budget; the 50 KB byte
// cap remains a parallel floor. For ordinary code the two fire together
// (~50 KB ≈ 25k tokens); for token-dense content (CJK, minified, data) the
// token budget binds strictly first, so the model is never fed a context bomb.
const MAX_TOKENS = 25_000
const MAX_TOKENS_LABEL = `${MAX_TOKENS} tokens`
const SAMPLE_BYTES = 4096
const SUPPORTED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"])

class ReadStop extends Schema.TaggedErrorClass<ReadStop>()("ReadStop", {}) {}

// Memo cache for the whole-file scan used by the indent fallback AND the
// tail line count. Keyed by path + mtime + size; invalidated whenever the
// file changes. Keeps warm reads (repeated symbol lookups, repeated tails in
// one session) from re-scanning the file.
const indentScanCache = new Map<
  string,
  { mtimeMs: number; size: number; raw: string[] }
>()
const SCAN_CACHE_MAX_LINES = 200_000

// `offset` and `limit` were originally `z.coerce.number()` — the runtime
// coercion was useful when the tool was called from a shell but serves no
// purpose in the LLM tool-call path (the model emits typed JSON). The JSON
// Schema output is identical (`type: "number"`), so the LLM view is
// unchanged; purely CLI-facing uses must now send numbers rather than strings.
export const Parameters = Schema.Struct({
  filePath: Schema.String.annotate({ description: "The absolute path to the file or directory to read" }),
  offset: Schema.optional(Schema.Int).annotate({
    description:
      "The line number to start reading from (1-indexed). Negative values read from the end (e.g. -3 reads the last 3 lines).",
  }),
  limit: Schema.optional(NonNegativeInt).annotate({
    description: "The maximum number of lines to read (defaults to 2000)",
  }),
  symbol: Schema.optional(Schema.String).annotate({
    description:
      "Read only the range of a named symbol (function/class/const) in the file. The output reports the symbol's total size so you can page through it with offset/limit if it is large. Resolves via LSP when available, else an indentation heuristic (reported as source=indent). If the symbol cannot be resolved at all, degrades to a normal file read with a note instead of failing.",
  }),
  depth: Schema.optional(Schema.Literals([0, 1])).annotate({
    description:
      "When symbol is set, depth=1 also returns the immediately called symbols (callees) with their signatures and locations, so you can understand the module in one read.",
  }),
})

type Display =
  | {
      type: "directory"
      path: string
      entries: string[]
      offset: number
      totalEntries: number
      truncated: boolean
    }
  | {
      type: "file"
      path: string
      text: string
      lineStart: number
      lineEnd: number
      totalLines: number
      truncated: boolean
    }

type Metadata = {
  preview: string
  truncated: boolean
  loaded: string[]
  display?: Display
  symbol?: string
  source?: "lsp" | "indent"
  size?: number
  lines_read?: number
  saved?: number
}

export const ReadTool = Tool.define<
  typeof Parameters,
  Metadata,
  FSUtil.Service | Instruction.Service | LSP.Service | Scope.Scope
>(
  "read",
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const instruction = yield* Instruction.Service
    const lsp = yield* LSP.Service
    const scope = yield* Scope.Scope

    const miss = Effect.fn("ReadTool.miss")(function* (filepath: string) {
      const dir = path.dirname(filepath)
      const base = path.basename(filepath)
      const items = yield* fs.readDirectory(dir).pipe(
        Effect.map((items) =>
          items
            .filter(
              (item) =>
                item.toLowerCase().includes(base.toLowerCase()) || base.toLowerCase().includes(item.toLowerCase()),
            )
            .map((item) => path.join(dir, item))
            .slice(0, 3),
        ),
        Effect.catch(() => Effect.succeed([] as string[])),
      )

      if (items.length > 0) {
        return yield* Effect.fail(
          new Error(`File not found: ${filepath}\n\nDid you mean one of these?\n${items.join("\n")}`),
        )
      }

      return yield* Effect.fail(new Error(`File not found: ${filepath}`))
    })

    const list = Effect.fn("ReadTool.list")(function* (filepath: string) {
      const items = yield* fs.readDirectoryEntries(filepath)
      return yield* Effect.forEach(
        items,
        Effect.fnUntraced(function* (item) {
          if (item.type === "directory") return item.name + "/"
          if (item.type !== "symlink") return item.name

          const target = yield* fs.stat(path.join(filepath, item.name)).pipe(Effect.catch(() => Effect.void))
          if (target?.type === "Directory") return item.name + "/"
          return item.name
        }),
        { concurrency: "unbounded" },
      ).pipe(Effect.map((items: string[]) => items.sort((a, b) => a.localeCompare(b))))
    })

    const warm = Effect.fn("ReadTool.warm")(function* (filepath: string) {
      // LSP warm-up is optional; do not let a background defect fail an otherwise successful read.
      yield* lsp.touchFile(filepath).pipe(Effect.ignoreCause, Effect.forkIn(scope))
    })

    const readSample = Effect.fn("ReadTool.readSample")(function* (
      filepath: string,
      fileSize: number,
      sampleSize: number,
    ) {
      if (fileSize === 0) return new Uint8Array()
      return yield* Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(filepath, { flag: "r" })
          return Option.getOrElse(yield* file.readAlloc(Math.min(sampleSize, fileSize)), () => new Uint8Array())
        }),
      )
    })

    // Normalize a symbol hit (DocumentSymbol has `range`; flat Symbol has
// `location.range`) into line numbers.
    const normalizeHit = (hit: LspDocumentSymbol | LSP.Symbol) => {
      const range = "range" in hit ? hit.range : hit.location.range
      const detail = "detail" in hit ? hit.detail : undefined
      return {
        name: hit.name,
        kind: hit.kind,
        start: range.start.line + 1,
        end: range.end.line + 1,
        detail,
      }
    }

    // Resolve `query` over LSP documentSymbol results; returns the symbol
    // range or undefined.
    const resolveSymbolByLsp = (symbols: (LspDocumentSymbol | LSP.Symbol)[], query: string) => {
      if (!symbols || symbols.length === 0) return undefined
      const exact = symbols.find((s) => s.name === query)
      const hit = exact ?? symbols.find((s) => s.name.includes(query))
      return hit ? normalizeHit(hit) : undefined
    }

    // Whole-file scan with memo cache (indent fallback + tail count).
    const scanFile = (
      filepath: string,
    ): Effect.Effect<{ raw: string[]; count: number }, never, never> =>
      Effect.catch(
        Effect.gen(function* () {
          const stat = yield* fs.stat(filepath).pipe(
            Effect.catchIf(
              (err) => "reason" in err && err.reason._tag === "NotFound",
              () => Effect.succeed(undefined),
            ),
          )
          const mtimeMs = stat ? Number(stat.mtime) : undefined
          const size = stat ? Number(stat.size) : undefined
          const cached = stat ? indentScanCache.get(filepath) : undefined
          const valid = cached && stat && cached.mtimeMs === mtimeMs && cached.size === size
          if (valid) {
            return { raw: cached!.raw, count: cached!.raw.length }
          }
          const all = yield* lines(filepath, { offset: 1, limit: Number.MAX_SAFE_INTEGER, unbounded: true })
          if (stat && all.raw.length <= SCAN_CACHE_MAX_LINES) {
            indentScanCache.set(filepath, { mtimeMs: mtimeMs!, size: size!, raw: all.raw })
          }
          return { raw: all.raw, count: all.count }
        }),
        () => Effect.succeed({ raw: [] as string[], count: 0 }),
      )

    // Fallback indentation heuristic (Codex-style): find the line whose
    // indentation is minimal around the first line matching `query`, then
    // extend while indentation is >= anchor indent (or blank/comment).
    // Uses the memoized whole-file scan so symbols past line 2000 resolve
    // and warm reads are cheap; the range is re-read with caps afterwards.
    const findSymbolByIndent = (
      filepath: string,
      query: string,
    ): Effect.Effect<{ name: string; start: number; end: number } | undefined, never, never> =>
      Effect.catch(
        Effect.gen(function* () {
          if (!query) return undefined
          const { raw } = yield* scanFile(filepath)
        const anchor = raw.findIndex((l) => l.includes(query))
        if (anchor === -1) return undefined
        const indentOf = (line: string) => {
          const ws = line.match(/^\s*/)?.[0] ?? ""
          return ws.replace(/\t/g, "    ").length
        }
        const anchorIndent = indentOf(raw[anchor])
        let start = anchor
        while (start > 0 && (raw[start - 1].trim() === "" || indentOf(raw[start - 1]) > anchorIndent)) start--
        let end = anchor
        while (end + 1 < raw.length && (raw[end + 1].trim() === "" || indentOf(raw[end + 1]) > anchorIndent)) end++
        if (raw[anchor].trim() === "") return undefined
        return { name: query, start: start + 1, end: end + 1 }
      }),
      () => Effect.succeed(undefined as { name: string; start: number; end: number } | undefined),
    )

    // Read all lines of a file up to cap (shared by indent fallback + tail).
    const readLines = Effect.fn("ReadTool.readLines")(function* (
      filepath: string,
      opts: { offset: number; limit: number },
    ) {
      return yield* lines(filepath, opts)
    })

    const lines = Effect.fn("ReadTool.lines")(function* (
      filepath: string,
      opts: { limit: number; offset: number; unbounded?: boolean },
    ) {
      const start = opts.offset - 1
      const raw: string[] = []
      const flags = { bytes: 0, tokens: 0, count: 0, cut: false, tokenCut: false, more: false, done: false }

      // Note: prefer manual TextDecoder over Stream.decodeText — when the source stream
      // ends without flushing, decodeText drops the final unterminated line. We also
      // avoid Stream.runForEachWhile (it currently swallows the final unterminated
      // line of the upstream splitLines pipeline) and use a tagged error to stop the
      // upstream file stream as soon as the cap is reached.
      const decoder = new TextDecoder("utf-8")
      yield* fs.stream(filepath).pipe(
        Stream.map((bytes) => decoder.decode(bytes, { stream: true })),
        Stream.splitLines,
        Stream.runForEach((text) =>
          Effect.gen(function* () {
            if (flags.done) return yield* new ReadStop()
            flags.count += 1
            if (flags.count <= start) return

            if (raw.length >= opts.limit) {
              flags.more = true
              return
            }

            const line = text.length > MAX_LINE_LENGTH ? text.substring(0, MAX_LINE_LENGTH) + MAX_LINE_SUFFIX : text
            const size = Buffer.byteLength(line, "utf-8") + (raw.length > 0 ? 1 : 0)
            // Token estimate: ~2 bytes/token is a conservative upper bound
            // for code, so the budget cuts in ~coincidence with the byte cap
            // on ASCII and strictly before it on token-dense content (CJK,
            // minified, data) — which gets a PARTIAL-view footer instead of
            // dumping a token bomb into the model's context.
            const lineTokens = Math.max(1, Math.ceil(size / 2))
            if (
              opts.unbounded ||
              (flags.bytes + size <= MAX_BYTES && flags.tokens + lineTokens <= MAX_TOKENS)
            ) {
              raw.push(line)
              flags.bytes += size
              flags.tokens += lineTokens
              return
            }

            flags.cut = true
            flags.tokenCut = flags.bytes + size <= MAX_BYTES
            flags.more = true
            flags.done = true
            return yield* new ReadStop()
          }),
        ),
        Effect.catchTag("ReadStop", () => Effect.void),
      )

      return {
        raw,
        count: flags.count,
        cut: flags.cut,
        tokenCut: flags.tokenCut,
        more: flags.more,
        offset: opts.offset,
      }
    })

    const isBinaryFile = (filepath: string, bytes: Uint8Array) => {
      const ext = path.extname(filepath).toLowerCase()
      switch (ext) {
        case ".zip":
        case ".tar":
        case ".gz":
        case ".exe":
        case ".dll":
        case ".so":
        case ".class":
        case ".jar":
        case ".war":
        case ".7z":
        case ".doc":
        case ".docx":
        case ".xls":
        case ".xlsx":
        case ".ppt":
        case ".pptx":
        case ".odt":
        case ".ods":
        case ".odp":
        case ".bin":
        case ".dat":
        case ".obj":
        case ".o":
        case ".a":
        case ".lib":
        case ".wasm":
        case ".pyc":
        case ".pyo":
          return true
      }

      if (bytes.length === 0) return false

      let nonPrintableCount = 0
      for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) return true
        if (bytes[i] < 9 || (bytes[i] > 13 && bytes[i] < 32)) {
          nonPrintableCount++
        }
      }

      return nonPrintableCount / bytes.length > 0.3
    }

    const run = Effect.fn("ReadTool.execute")(function* (
      params: Schema.Schema.Type<typeof Parameters>,
      ctx: Tool.Context<Metadata>,
    ) {
      const instance = yield* InstanceState.context
      let filepath = params.filePath
      if (!path.isAbsolute(filepath)) {
        filepath = path.resolve(instance.directory, filepath)
      }
      if (process.platform === "win32") {
        filepath = FSUtil.normalizePath(filepath)
      }
      const title = path.relative(instance.worktree, filepath)

      const stat = yield* fs.stat(filepath).pipe(
        Effect.catchIf(
          (err) => "reason" in err && err.reason._tag === "NotFound",
          () => Effect.succeed(undefined),
        ),
      )

      yield* assertExternalDirectoryEffect(ctx, filepath, {
        bypass: Boolean(ctx.extra?.["bypassCwdCheck"]),
        kind: stat?.type === "Directory" ? "directory" : "file",
      })

      yield* ctx.ask({
        permission: "read",
        patterns: [path.relative(instance.worktree, filepath)],
        always: ["*"],
        metadata: {},
      })

      if (!stat) return yield* miss(filepath)

      if (stat.type === "Directory") {
        const items = yield* list(filepath)
        const limit = params.limit ?? DEFAULT_READ_LIMIT
        const offset = params.offset || 1
        const start = offset - 1
        const sliced = items.slice(start, start + limit)
        const truncated = start + sliced.length < items.length

        return {
          title,
          output: [
            `<path>${filepath}</path>`,
            `<type>directory</type>`,
            `<entries>`,
            sliced.join("\n"),
            truncated
              ? `\n(Showing ${sliced.length} of ${items.length} entries. Use 'offset' parameter to read beyond entry ${offset + sliced.length})`
              : `\n(${items.length} entries)`,
            `</entries>`,
          ].join("\n"),
          metadata: {
            preview: sliced.slice(0, 20).join("\n"),
            truncated,
            loaded: [] as string[],
            display: {
              type: "directory" as const,
              path: filepath,
              entries: sliced,
              offset,
              totalEntries: items.length,
              truncated,
            },
          },
        }
      }

      const loaded = yield* instruction.resolve(ctx.messages, filepath, ctx.messageID)
      const sample = yield* readSample(filepath, Number(stat.size), SAMPLE_BYTES)

      const mime = sniffAttachmentMime(sample, FSUtil.mimeType(filepath))
      const isImage = SUPPORTED_IMAGE_MIMES.has(mime)

      if (isImage || isPdfAttachment(mime)) {
        const bytes = yield* fs.readFile(filepath)
        const msg = isPdfAttachment(mime) ? "PDF read successfully" : "Image read successfully"
        return {
          title,
          output: msg,
          metadata: {
            preview: msg,
            truncated: false,
            loaded: loaded.map((item) => item.filepath),
          },
          attachments: [
            {
              type: "file" as const,
              mime,
              url: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
            },
          ],
        }
      }

      if (isBinaryFile(filepath, sample)) {
        return yield* Effect.fail(new Error(`Cannot read binary file: ${filepath}`))
      }

      // symbol-scoped read: resolve a named symbol to its line range, announce
      // its size, and page through it with offset/limit. Falls back to an
      // indentation heuristic when no LSP server covers the file. If the
      // symbol is genuinely unresolvable, DEGRADES to a normal file read with
      // a note instead of failing — the model never pays a second round-trip.
      let degradeNote = ""
      if (params.symbol) {
        const uri = pathToFileURL(filepath).href
        const hasClient = yield* Effect.catch(
          lsp.hasClients(filepath),
          () => Effect.succeed(false),
        )
        let resolved:
          | { name: string; kind?: number; start: number; end: number; detail?: string }
          | undefined

        if (hasClient) {
          const symbols = yield* Effect.catch(
            lsp.documentSymbol(uri),
            () => Effect.succeed([] as unknown as (LspDocumentSymbol | LSP.Symbol)[]),
          )
          const raw = symbols as unknown as (LspDocumentSymbol | LSP.Symbol)[]
          if (raw && raw.length > 0) {
            resolved = resolveSymbolByLsp(raw, params.symbol ?? "")
          }
        }
        const source: "lsp" | "indent" = hasClient && resolved ? "lsp" : "indent"
        if (!resolved) {
          const indent = yield* findSymbolByIndent(filepath, params.symbol ?? "")
          if (indent) {
            resolved = { ...indent }
          }
        }
        if (!resolved) {
          degradeNote = `Symbol "${params.symbol}" not found via LSP or indentation in ${filepath} — continuing with a normal file read.`
        }
        if (resolved) {
        const symbolSize = resolved.end - resolved.start + 1
        const startLine = resolved.start
        const rel = Math.max(0, startLine - 1)

        // `tail` is not meaningful for symbol mode; keep it legal by ignoring.
        // Pagination inside the symbol: offset is relative to the symbol start.
        const pageOffset = (params.offset ?? 1) - 1
        const pageLimit = Math.min(params.limit ?? DEFAULT_READ_LIMIT, Math.max(1, symbolSize - pageOffset))
        const file = yield* lines(filepath, {
          offset: rel + pageOffset + 1,
          limit: pageLimit,
        })
        const part = file.raw

        let output = [
          `<path>${filepath}</path>`,
          `<type>symbol</type>`,
          `<symbol name="${resolved.name}" source="${source}">`,
          `<size>${symbolSize} lines</size>`,
          `<range>${resolved.start}-${resolved.end}</range>`,
          `<content>\n`,
          ...part.map((line, i) => `${rel + pageOffset + i + 1}: ${line}`),
          `\n`,
          `</content>`,
          "</symbol>",
        ].join("\n")

        if (pageOffset + part.length < symbolSize) {
          output += `\n(Showing lines ${pageOffset + 1}-${pageOffset + part.length} of ${symbolSize}. Use offset=${pageOffset + part.length + 1} to continue within the symbol.)`
        }

        // depth=1: report callees with signatures + locations in one read.
        let callees: string[] = []
        if (params.depth === 1 && hasClient && resolved.kind !== undefined) {
          const calls = yield* Effect.catch(
            lsp.incomingCalls({ file: filepath, line: resolved.start, character: 1 }),
            () => Effect.succeed([] as any[]),
          )
          callees = calls
            .map((c) => {
              const from = c?.from as { name?: string; range?: { start?: { line?: number } } } | undefined
              const fromName = from?.name ?? "?"
              const line = from?.range?.start?.line ?? 0
              return `${fromName} (${path.relative(instance.worktree, filepath)}:${line + 1})`
            })
            .slice(0, 20)
        }
        if (callees.length > 0) {
          output += `\n\n## Callees\n${callees.join("\n")}`
        }

        // diagnostics freshness: reports pending/stale instead of pretending clean.
        let diagStatus = "pending"
        if (hasClient) {
          const diags = yield* Effect.catch(
            lsp.diagnostics(),
            () => Effect.succeed({} as Record<string, { length: number }[]>),
          )
          const fileDiags = diags?.[filepath]
          if (fileDiags !== undefined) diagStatus = fileDiags.length > 0 ? "error" : "fresh"
        }
        output += `\n\n## Diagnostics: ${diagStatus}`

        return {
          title: `${resolved.name} (symbol)`,
          output,
          metadata: {
            preview: part.slice(0, 20).join("\n"),
            truncated: part.length < symbolSize || file.cut,
            loaded: loaded.map((item) => item.filepath),
            symbol: resolved.name,
            source,
            size: symbolSize,
            lines_read: part.length,
            // telemetry: how many lines the model would have read without symbol mode
            saved: Math.max(0, symbolSize - part.length),
          },
        }
        }
      }

      // tail: negative offset reads from the end of the file (Grok semantics).
      let effectiveOffset = params.offset || 1
      if (params.offset !== undefined && params.offset < 0) {
        const total = yield* scanFile(filepath).pipe(Effect.map((l) => l.count))
        effectiveOffset = Math.max(1, total + 1 + params.offset)
      }
      const file = yield* lines(filepath, {
        limit: params.limit ?? DEFAULT_READ_LIMIT,
        offset: effectiveOffset,
      })
      if (file.count < file.offset && !(file.count === 0 && file.offset === 1)) {
        return yield* Effect.fail(
          new Error(`Offset ${file.offset} is out of range for this file (${file.count} lines)`),
        )
      }

      let output = [`<path>${filepath}</path>`, `<type>file</type>`, "<content>\n"].join("\n")
      output += file.raw.map((line, i) => `${i + file.offset}: ${line}`).join("\n")

      const last = file.offset + file.raw.length - 1
      const next = last + 1
      const truncated = file.more || file.cut
      if (file.tokenCut) {
        output += `\n\n(Output capped at ${MAX_TOKENS_LABEL}. PARTIAL view — showing lines ${file.offset}-${last}. Use offset=${next} to continue.)`
      } else if (file.cut) {
        output += `\n\n(Output capped at ${MAX_BYTES_LABEL}. Showing lines ${file.offset}-${last}. Use offset=${next} to continue.)`
      } else if (file.more) {
        output += `\n\n(Showing lines ${file.offset}-${last} of ${file.count}. Use offset=${next} to continue.)`
      } else {
        output += `\n\n(End of file - total ${file.count} lines)`
      }
      output += "\n</content>"

      if (degradeNote) {
        output += `\n\n<system-note>${degradeNote}</system-note>`
      }

      yield* warm(filepath)

      if (loaded.length > 0) {
        output += `\n\n<system-reminder>\n${loaded.map((item) => item.content).join("\n\n")}\n</system-reminder>`
      }

      return {
        title,
        output,
        metadata: {
          preview: file.raw.slice(0, 20).join("\n"),
          truncated,
          loaded: loaded.map((item) => item.filepath),
          display: {
            type: "file" as const,
            path: filepath,
            text: file.raw.join("\n"),
            lineStart: file.offset,
            lineEnd: last,
            totalLines: file.count,
            truncated,
          },
        },
      }
    })

    return {
      description: DESCRIPTION,
      parameters: Parameters,
      execute: (params: Schema.Schema.Type<typeof Parameters>, ctx: Tool.Context<Metadata>) =>
        run(params, ctx).pipe(Effect.orDie),
    }
  }),
)

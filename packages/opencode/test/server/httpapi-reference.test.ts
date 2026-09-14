import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "path"
import { Server } from "../../src/server/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { Effect } from "effect"
import { pollWithTimeout } from "../lib/effect"

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("reference HttpApi", () => {
  test("lists local references resolved in the server workspace", async () => {
    await using tmp = await tmpdir({
      init: async (directory) => {
        await fs.mkdir(path.join(directory, "docs"))
      },
      config: {
        formatter: false,
        lsp: false,
        references: {
          docs: "./docs",
        },
      },
    })

    const body = await Effect.runPromise(
      pollWithTimeout(
        Effect.promise(async () => {
          const response = await Server.Default().app.request("/api/reference", {
            headers: { "x-opencode-directory": tmp.path },
          })
          expect(response.status).toBe(200)
          const body = await response.json()
          return body.data.length === 0 ? undefined : body
        }),
        "references were not loaded",
      ),
    )
    expect(body).toMatchObject({ location: { directory: tmp.path } })
    expect(body.data).toEqual([
      {
        name: "docs",
        path: path.join(tmp.path, "docs"),
        source: {
          type: "local",
          path: path.join(tmp.path, "docs"),
        },
      },
    ])
  })
})

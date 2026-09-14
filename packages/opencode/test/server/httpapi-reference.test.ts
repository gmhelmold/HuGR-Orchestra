import { afterEach, describe, expect, test } from "bun:test"
import { $ } from "bun"
import fs from "node:fs/promises"
import path from "path"
import { Server } from "../../src/server/server"
import { Global } from "@opencode-ai/core/global"
import { Repository } from "@opencode-ai/core/repository"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { Effect } from "effect"
import { pollWithTimeout } from "../lib/effect"

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("reference HttpApi", () => {
  test("lists local and hermetic remote references resolved in the server workspace", async () => {
    let server: ReturnType<typeof Bun.serve> | undefined
    await using tmp = await tmpdir({
      init: async (directory) => {
        await fs.mkdir(path.join(directory, "docs"))
        const remote = path.join(directory, "remote", "repo.git")
        const source = path.join(directory, "source")
        await fs.mkdir(path.dirname(remote), { recursive: true })
        await $`git init --bare ${remote}`.quiet()
        await $`git init --initial-branch main ${source}`.quiet()
        await $`git -C ${source} config user.email test@opencode.test`.quiet()
        await $`git -C ${source} config user.name Test`.quiet()
        await Bun.write(path.join(source, "README.md"), "fixture\n")
        await $`git -C ${source} add README.md`.quiet()
        await $`git -C ${source} commit -m fixture`.quiet()
        await $`git -C ${source} remote add origin ${remote}`.quiet()
        await $`git -C ${source} push origin main`.quiet()
        await $`git --git-dir ${remote} update-server-info`.quiet()
        server = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          async fetch(request) {
            const file = Bun.file(path.join(path.dirname(remote), new URL(request.url).pathname.replace(/^\/+/, "")))
            return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 })
          },
        })
        const repository = `http://127.0.0.1:${server.port}/repo.git`
        await $`git clone ${repository} ${path.join(directory, "probe")}`.quiet()
        return { repository }
      },
      dispose: async () => server?.stop(true),
      config: {
        formatter: false,
        lsp: false,
        references: {
          docs: "./docs",
        },
      },
    })

    await Bun.write(
      path.join(tmp.path, "opencode.json"),
      JSON.stringify({
        formatter: false,
        lsp: false,
        references: { docs: "./docs", fixture: { repository: tmp.extra.repository, branch: "main" } },
      }),
    )
    const remote = Repository.parseRemote(tmp.extra.repository)
    const remotePath = Repository.cachePath(Global.Path.repos, remote, "main")
    const body = await Effect.runPromise(
      pollWithTimeout(
        Effect.promise(async () => {
          const response = await Server.Default().app.request("/api/reference", {
            headers: { "x-opencode-directory": tmp.path },
          })
          expect(response.status).toBe(200)
          const body = await response.json()
          return body.data.length === 2 ? body : undefined
        }),
        "references were not materialized",
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
      {
        name: "fixture",
        path: remotePath,
        source: {
          type: "git",
          repository: tmp.extra.repository,
          branch: "main",
        },
      },
    ])
  })
})

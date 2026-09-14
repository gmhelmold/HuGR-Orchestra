import { $ } from "bun"
import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import { tmpdir } from "./fixture"

describe("tmpdir", () => {
  test("disables fsmonitor for git fixtures", async () => {
    await using tmp = await tmpdir({ git: true })

    const value = (await $`git config core.fsmonitor`.cwd(tmp.path).quiet().text()).trim()
    expect(value).toBe("false")
  })

  test("removes directories on dispose", async () => {
    const tmp = await tmpdir({ git: true })
    const dir = tmp.path

    await tmp[Symbol.asyncDispose]()

    const exists = await fs
      .stat(dir)
      .then(() => true)
      .catch(() => false)
    expect(exists).toBe(false)
  })

  test("moves global cwd before deleting current fixture", async () => {
    const original = process.cwd()
    const tmp = await tmpdir()
    try {
      process.chdir(tmp.path)
      await tmp[Symbol.asyncDispose]()
      expect(await fs.realpath(process.cwd())).toBe(await fs.realpath(os.tmpdir()))
    } finally {
      process.chdir(original)
    }
  })
})

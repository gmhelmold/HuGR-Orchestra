import { readdir } from "node:fs/promises"
import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const dir = path.join(root, "test-browser")
const files = (await readdir(dir))
  .filter((name) => name.endsWith(".test.ts"))
  .sort()

for (const file of files) {
  const relative = "./test-browser/" + file
  console.log("[browser-test] " + relative)
  const child = Bun.spawn({
    cmd: [
      process.execPath,
      "test",
      "--conditions=browser",
      "--preload",
      "./happydom.ts",
      relative,
    ],
    cwd: root,
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  })
  const code = await child.exited
  if (code !== 0) process.exit(code)
}

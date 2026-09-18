// In-process HTTP requests through the original Server.Default router. No live UI or inference.
import { afterAll, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { Server } from "../../src/server/server"
import { tmpdir, disposeAllInstances } from "../fixture/fixture"

const results: object[] = []
afterAll(async () => {
  await disposeAllInstances()
  writeFileSync(process.env.AUDIT_ROUTES_OUT!, JSON.stringify(results, null, 2) + "\n")
})

for (const configured of [false, true]) {
  test(`public agent routes configured=${configured}`, async () => {
    await using tmp = await tmpdir({ git: true, config: configured ? {
      agent: { maestro: { description: "Configured audit agent", prompt: "AUDIT_CONFIGURED_MAESTRO", mode: "primary" } },
    } : {} })
    const api = Server.Default().app
    const responses = []
    for (const endpoint of ["/agent", "/api/agent"]) {
      const response = await api.request(endpoint, { headers: { "x-opencode-directory": encodeURIComponent(tmp.path) } })
      const body = await response.json()
      expect(response.status).toBe(200)
      const list = Array.isArray(body) ? body : body.data
      expect(Array.isArray(list)).toBe(true)
      const maestro = list.find((entry: { id?: string; name?: string }) => entry.id === "maestro" || entry.name === "maestro")
      responses.push({ endpoint, status: response.status, names: list.map((entry: { id?: string; name?: string }) => entry.id ?? entry.name), maestro: maestro ?? null })
    }
    results.push({ configured, responses })
    expect(responses[0].maestro).not.toBeNull()
    if (configured) expect(JSON.stringify(responses[1].maestro)).toContain("AUDIT_CONFIGURED_MAESTRO")
    else expect(responses[1].maestro).toBeNull()
  }, 60000)
}

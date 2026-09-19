import { afterAll } from "bun:test"

const describe = (value: unknown) => {
  const item = value as {
    constructor?: { name?: string }
    fd?: number
    pid?: number
    localAddress?: string
    remoteAddress?: string
  }
  return {
    type: item?.constructor?.name ?? typeof value,
    fd: item?.fd,
    pid: item?.pid,
    localAddress: item?.localAddress,
    remoteAddress: item?.remoteAddress,
  }
}

afterAll(async () => {
  if (process.platform !== "win32") return
  await Bun.sleep(250)
  const handles = ((process as any)._getActiveHandles?.() ?? []).map(describe)
  const requests = ((process as any)._getActiveRequests?.() ?? []).map(describe)
  console.error("[windows-exit-diagnostic]", JSON.stringify({ handles, requests }))
})

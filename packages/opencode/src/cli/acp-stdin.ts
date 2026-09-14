type AcpStdin = {
  readonly ended: Promise<void>
  readonly buffered: readonly Uint8Array[]
  readonly onData: (listener: (chunk: Uint8Array) => void) => () => void
}

let stdin: AcpStdin | undefined

export function watchAcpStdin() {
  if (stdin) return stdin

  const buffered: Uint8Array[] = []
  const listeners = new Set<(chunk: Uint8Array) => void>()
  const ended = new Promise<void>((resolve, reject) => {
    process.stdin.once("end", resolve)
    process.stdin.once("error", reject)
  })
  process.stdin.on("data", (chunk: Buffer) => {
    const value = new Uint8Array(chunk)
    buffered.push(value)
    for (const listener of listeners) listener(value)
  })

  stdin = {
    ended,
    buffered,
    onData(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
  return stdin
}

type AcpStdin = {
  readonly ended: Promise<void>
  readonly attach: (listener: (chunk: Uint8Array) => void) => readonly Uint8Array[]
}

let stdin: AcpStdin | undefined

export function watchAcpStdin() {
  if (stdin) return stdin

  let buffered: Uint8Array[] = []
  let listener: ((chunk: Uint8Array) => void) | undefined
  const ended = new Promise<void>((resolve, reject) => {
    process.stdin.once("end", resolve)
    process.stdin.once("error", reject)
  })
  process.stdin.on("data", (chunk: Buffer) => {
    const value = new Uint8Array(chunk)
    if (listener) listener(value)
    else buffered.push(value)
  })

  stdin = {
    ended,
    attach(next) {
      if (listener) throw new Error("ACP stdin already attached")
      listener = next
      const drained = buffered
      buffered = []
      return drained
    },
  }
  return stdin
}

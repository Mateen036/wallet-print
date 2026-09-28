/** Parse a 0x-prefixed or raw hex seed (bytes32) into a Uint8Array of 32 bytes. */
export function parseSeed(hexSeed: string): Uint8Array {
  const hex = hexSeed.startsWith("0x") ? hexSeed.slice(2) : hexSeed
  const padded = hex.padStart(64, "0").slice(0, 64)
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

/** Derive a preview seed from a token ID (for gallery and pre-mint display). */
export function seedFromTokenId(tokenId: number): string {
  // Eight mixed 32-bit words. The previous implementation built the seed from a
  // masked 8-hex-digit value, so the first 8 bytes were always zero. That
  // collapsed `SeededRandom`'s initial state (s0 = s1 = 0), making the first
  // `next()` return exactly 0 — which pinned corner rarity to 1 for every
  // preview token. It also multiplied past 2^53 (`0x517cc1b727220a95`), losing
  // precision. Display-only: real tokens use their on-chain seed.
  const words: number[] = []
  let state = tokenId >>> 0
  for (let i = 0; i < 8; i++) {
    state = (Math.imul(state, 0x9e3779b1) + 0x85ebca6b) >>> 0
    words.push(state)
  }
  return "0x" + words.map((word) => word.toString(16).padStart(8, "0")).join("")
}

/** Generate a random hex seed for preview animations. */
export function randomHexSeed(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  )
}

/** Seed to hex string for display. */
export function seedToDisplayHex(seedBytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(seedBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  )
}

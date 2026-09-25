/** Parse a 0x-prefixed or raw hex seed (bytes32) into a Uint8Array of 32 bytes. */
export function parseSeed(hexSeed: string): Uint8Array {
  const hex = hexSeed.startsWith('0x') ? hexSeed.slice(2) : hexSeed;
  const padded = hex.padStart(64, '0').slice(0, 64);
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Derive a preview seed from a token ID (for gallery and pre-mint display). */
export function seedFromTokenId(tokenId: number): string {
  const hex = (tokenId * 0x9e3779b9 + 0x6c62272e).toString(16).padStart(8, '0');
  const entropy = (tokenId * 0x517cc1b727220a95 + 0x0f2d2a50).toString(16).padStart(16, '0');
  return '0x' + (hex + entropy + hex + entropy).padStart(64, '0').slice(0, 64);
}

/** Generate a random hex seed for preview animations. */
export function randomHexSeed(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Seed to hex string for display. */
export function seedToDisplayHex(seedBytes: Uint8Array): string {
  return '0x' + Array.from(seedBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

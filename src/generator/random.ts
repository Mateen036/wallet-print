// xoshiro128** — fast, high-quality 32-bit PRNG
// Reference: https://prng.di.unimi.it/xoshiro128starstar.c
//
// State is mixed from ALL 32 seed bytes (not only the first 16). Using only
// the leading half made keccak seeds whose first 16 bytes were sparse share
// traits, and `s1 == 0` made the first `next()` return 0 — pinning corners
// to 1. Solidity `prngInit` must stay identical.

function rotl(x: number, k: number): number {
  return ((x << k) | (x >>> (32 - k))) >>> 0
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] ?? 0) << 24) |
    ((bytes[offset + 1] ?? 0) << 16) |
    ((bytes[offset + 2] ?? 0) << 8) |
    (bytes[offset + 3] ?? 0)
  ) >>> 0
}

const WARMUP = 8

export class SeededRandom {
  private s0: number
  private s1: number
  private s2: number
  private s3: number

  constructor(seedBytes: Uint8Array) {
    const padded = new Uint8Array(32)
    padded.set(seedBytes.subarray(0, 32))

    this.s0 = (u32be(padded, 0) ^ u32be(padded, 16)) >>> 0
    this.s1 = (u32be(padded, 4) ^ u32be(padded, 20)) >>> 0
    this.s2 = (u32be(padded, 8) ^ u32be(padded, 24)) >>> 0
    this.s3 = (u32be(padded, 12) ^ u32be(padded, 28)) >>> 0
    if (!this.s0 && !this.s1 && !this.s2 && !this.s3) this.s0 = 0xdeadbeef

    for (let i = 0; i < WARMUP; i++) this.next()
  }

  /** Float in [0, 1) */
  next(): number {
    const result = Math.imul(rotl(Math.imul(this.s1, 5) >>> 0, 7), 9) >>> 0
    const t = (this.s1 << 9) >>> 0
    this.s2 ^= this.s0
    this.s3 ^= this.s1
    this.s1 ^= this.s2
    this.s0 ^= this.s3
    this.s2 ^= t
    this.s3 = rotl(this.s3, 11)
    return result / 0x100000000
  }

  /** Integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n)
  }

  /** Float in [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  /** Boolean with given probability */
  bool(p = 0.5): boolean {
    return this.next() < p
  }
}

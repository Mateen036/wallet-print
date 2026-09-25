// xoshiro128** — fast, high-quality 32-bit PRNG
// Reference: https://prng.di.unimi.it/xoshiro128starstar.c

function rotl(x: number, k: number): number {
  return (((x << k) | (x >>> (32 - k))) >>> 0);
}

export class SeededRandom {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;

  constructor(seedBytes: Uint8Array) {
    const buf = new Uint8Array(16);
    const len = Math.min(seedBytes.length, 16);
    for (let i = 0; i < len; i++) buf[i] = seedBytes[i];
    const view = new DataView(buf.buffer);
    this.s0 = view.getUint32(0, false);
    this.s1 = view.getUint32(4, false);
    this.s2 = view.getUint32(8, false);
    this.s3 = view.getUint32(12, false);
    if (!this.s0 && !this.s1 && !this.s2 && !this.s3) this.s0 = 0xdeadbeef;
  }

  /** Float in [0, 1) */
  next(): number {
    const result = (Math.imul(rotl((Math.imul(this.s1, 5) >>> 0), 7), 9)) >>> 0;
    const t = (this.s1 << 9) >>> 0;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = rotl(this.s3, 11);
    return result / 0x100000000;
  }

  /** Integer in [0, n) */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** Float in [min, max) */
  float(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Boolean with given probability */
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
}

import type { SeededRandom } from "./random.ts"

// Target distribution across 6,767 tokens:
//   1 corner = 4000  (59.1%)
//   2 corners = 1700 (25.1%)
//   3 corners = 700  (10.3%)
//   4 corners = 300  (4.4%)
//   5 corners = 67   (1.0%)
//
// Using a PRNG value mapped to thresholds so that uniform seeds
// produce the exact target distribution statistically.

const THRESHOLDS = [
  4000 / 6767, // < this → 1 corner
  5700 / 6767, // < this → 2 corners
  6400 / 6767, // < this → 3 corners
  6700 / 6767, // < this → 4 corners
  // ≥ last → 5 corners
] as const

export function computeCorners(rng: SeededRandom): number {
  const score = rng.next()
  if (score < THRESHOLDS[0]) return 1
  if (score < THRESHOLDS[1]) return 2
  if (score < THRESHOLDS[2]) return 3
  if (score < THRESHOLDS[3]) return 4
  return 5
}

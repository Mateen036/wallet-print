import type { SeededRandom } from "./random.ts"

export type Pattern = "Grid" | "Blocks" | "Stripes" | "Fragments" | "Clusters"
export type PrintMode = "Registered" | "Offset" | "Drift" | "Misaligned"
export type DistortionLevel = "None" | "Low" | "Medium" | "High"
export type Density = "Sparse" | "Light" | "Medium" | "Dense"

export interface Traits {
  paletteIndex: number
  pattern: Pattern
  printMode: PrintMode
  distortion: DistortionLevel
  rotations: number // 0–3 × 90°
  layerCount: number // 1–4
  density: Density
  corners: number // 1–5
}

const PATTERNS: Pattern[] = [
  "Grid",
  "Blocks",
  "Stripes",
  "Fragments",
  "Clusters",
]
const PRINT_MODES: PrintMode[] = ["Registered", "Offset", "Drift", "Misaligned"]
const DISTORTIONS: DistortionLevel[] = ["None", "Low", "Medium", "High"]
const DENSITIES: Density[] = ["Sparse", "Light", "Medium", "Dense"]

export function extractTraits(rng: SeededRandom, corners: number): Traits {
  // Density is drawn from the PRNG, not derived from the active-cell ratio.
  // A keccak-uniform seed makes the 16x16 bit count ~Binomial(256, 0.5), so the
  // ratio only ever lands around 0.35-0.63. Thresholding it left 'Sparse' and
  // 'Dense' unreachable (0 of 20,000 samples) and 'Medium' covering ~94% of
  // tokens while the metadata advertised four tiers.
  //
  // The draw is appended last so every other trait keeps its existing value for
  // a given seed — only density changes.
  return {
    paletteIndex: rng.int(16),
    pattern: PATTERNS[rng.int(5)],
    printMode: PRINT_MODES[rng.int(4)],
    distortion: DISTORTIONS[rng.int(4)],
    rotations: rng.int(4),
    layerCount: rng.int(4) + 1,
    density: DENSITIES[rng.int(4)],
    corners,
  }
}

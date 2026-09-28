/**
 * Wallet Print — Generative Art Engine
 *
 * Public API: generate(seed) → { svg, traits, metadata }
 *
 * The engine is intentionally dependency-free (no React, no DOM).
 * It can run in browser, Node, or any JS environment.
 *
 * Solidity `WalletPrintSVG.sol` must stay bit-for-bit aligned with this
 * pipeline. `src/generator/parity.test.ts` pins the shared vectors.
 */

import { SeededRandom } from "./random.ts"
import {
  parseSeed,
  seedFromTokenId,
  randomHexSeed,
  seedToDisplayHex,
} from "./hash.ts"
import { buildGrid, applyGridRotation } from "./grid.ts"
import { extractTraits } from "./traits.ts"
import { computeCorners } from "./rarity.ts"
import { buildGeometry } from "./geometry.ts"
import { assignToPlates } from "./layers.ts"
import { computeTransforms } from "./distortion.ts"
import { generateSVG } from "./svg.ts"
import { buildMetadata } from "./metadata.ts"
import { PALETTES } from "./palettes.ts"
import { inspect } from "./inspect.ts"

export type { Traits } from "./traits.ts"
export type { TokenMetadata } from "./metadata.ts"
export type { Palette } from "./palettes.ts"
export { parseSeed, seedFromTokenId, randomHexSeed, seedToDisplayHex, inspect }

export interface GenerateResult {
  svg: string
  traits: ReturnType<typeof extractTraits>
  metadata: ReturnType<typeof buildMetadata>
  seedHex: string
}

/**
 * Generate a complete artwork from a hex seed.
 * Same seed → identical output every time.
 *
 * @param hexSeed   bytes32 hex string (0x-prefixed or raw)
 * @param tokenId   token ID for metadata naming (0 for preview)
 */
export function generate(hexSeed: string, tokenId = 0): GenerateResult {
  const seedBytes = parseSeed(hexSeed)
  const rng = new SeededRandom(seedBytes)

  // 1. Build the 16×16 binary matrix from the raw seed bytes
  const rawGrid = buildGrid(seedBytes)

  // 2. Extract rarity (corners) — consumed first from PRNG
  const corners = computeCorners(rng)

  // 3. Extract all traits
  const traits = extractTraits(rng, corners)

  // 4. Apply grid rotation (trait-driven)
  const grid = applyGridRotation(rawGrid, traits.rotations)

  // 5. Interpret grid → geometry based on pattern trait
  const geometry = buildGeometry(grid, traits.pattern)

  // 6. Assign geometry to CMYK plates
  const plates = assignToPlates(geometry, traits.layerCount)

  // 7. Compute plate transforms (registration offsets)
  const transforms = computeTransforms(rng, traits.printMode, traits.distortion)

  // 8. Render SVG
  const palette = PALETTES[traits.paletteIndex]
  const svg = generateSVG({
    palette,
    plates,
    transforms,
    corners,
    pattern: traits.pattern,
  })

  // 9. Build metadata
  const metadata = buildMetadata(tokenId, traits)

  return {
    svg,
    traits,
    metadata,
    seedHex:
      "0x" +
      Array.from(seedBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
  }
}

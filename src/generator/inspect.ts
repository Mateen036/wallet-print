import { SeededRandom } from "./random.ts"
import { parseSeed } from "./hash.ts"
import { buildGrid, applyGridRotation, countActiveCells } from "./grid.ts"
import { extractTraits } from "./traits.ts"
import { computeCorners } from "./rarity.ts"
import { buildGeometry } from "./geometry.ts"
import { assignToPlates } from "./layers.ts"
import { computeTransforms } from "./distortion.ts"
import { PALETTES } from "./palettes.ts"

/** Deterministic trace of one seed. Used to pin JS ↔ Solidity parity. */
export function inspect(hexSeed: string) {
  const seedBytes = parseSeed(hexSeed)
  const rng = new SeededRandom(seedBytes)
  const rawGrid = buildGrid(seedBytes)
  const corners = computeCorners(rng)
  const traits = extractTraits(rng, corners)
  const grid = applyGridRotation(rawGrid, traits.rotations)
  const geometry = buildGeometry(grid, traits.pattern)
  const plates = assignToPlates(geometry, traits.layerCount)
  const transforms = computeTransforms(rng, traits.printMode, traits.distortion)
  const palette = PALETTES[traits.paletteIndex]

  return {
    corners,
    traits,
    paletteName: palette.name,
    dark: palette.dark,
    blend: palette.dark ? "screen" : "multiply",
    activeCells: countActiveCells(grid),
    geometryCount: geometry.length,
    plateCounts: {
      K: plates.find((p) => p.id === "K")?.rects.length ?? 0,
      C: plates.find((p) => p.id === "C")?.rects.length ?? 0,
      M: plates.find((p) => p.id === "M")?.rects.length ?? 0,
      Y: plates.find((p) => p.id === "Y")?.rects.length ?? 0,
    },
    transforms,
  }
}

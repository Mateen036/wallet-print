/**
 * JS generator parity suite.
 *
 * Run: node src/generator/parity.test.ts
 *
 * Vectors here are the source of truth for `WalletPrintSVG.sol`.
 * If you change trait order, PRNG init, or plate assignment, update
 * `contracts/test/WalletPrintSVG.t.sol` to match.
 */

import assert from "node:assert/strict"
import { generate, inspect, parseSeed } from "./index.ts"
import { SeededRandom } from "./random.ts"

const SEED_ONE = `0x${"00".repeat(31)}01`
const SEED_FF = `0x${"00".repeat(31)}ff`
const SEED_MIXED =
  "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

let passed = 0
let failed = 0

function test(name: string, fn: () => void): void {
  try {
    fn()
    passed += 1
    console.log(`[PASS] ${name}`)
  } catch (error) {
    failed += 1
    console.error(`[FAIL] ${name}`)
    console.error(`       ${(error as Error).message.split("\n")[0]}`)
    process.exitCode = 1
  }
}

console.log("generator parity\n")

test("zero seed does not collapse PRNG (s0 forced)", () => {
  const rng = new SeededRandom(parseSeed("0x" + "00".repeat(32)))
  assert.notEqual(rng.next(), 0)
})

test("seed 0x01 is deterministic", () => {
  const a = inspect(SEED_ONE)
  const b = inspect(SEED_ONE)
  assert.deepEqual(a.traits, b.traits)
  assert.equal(generate(SEED_ONE, 1).svg, generate(SEED_ONE, 1).svg)
})

test("different seeds produce different prints", () => {
  assert.notEqual(generate(SEED_ONE).svg, generate(SEED_FF).svg)
})

test("svg uses mix-blend-mode, not isolation-only", () => {
  const svg = generate(SEED_MIXED).svg
  assert.match(svg, /mix-blend-mode:(multiply|screen)/)
  assert.doesNotMatch(svg, /opacity="100"/)
})

test("dump vectors for Solidity", () => {
  for (const seed of [SEED_ONE, SEED_FF, SEED_MIXED]) {
    const info = inspect(seed)
    const { traits } = info
    console.log(
      JSON.stringify({
        seed,
        palette: info.paletteName,
        paletteIndex: traits.paletteIndex,
        corners: traits.corners,
        pattern: traits.pattern,
        printMode: traits.printMode,
        distortion: traits.distortion,
        rotations: traits.rotations,
        layerCount: traits.layerCount,
        density: traits.density,
        blend: info.blend,
        plateCounts: info.plateCounts,
        geometryCount: info.geometryCount,
        transforms: info.transforms,
      }),
    )
    assert.ok(traits.layerCount >= 1 && traits.layerCount <= 4)
    assert.ok(traits.corners >= 1 && traits.corners <= 5)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) throw new Error(`${failed} parity test(s) failed`)

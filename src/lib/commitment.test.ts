/**
 * Regression coverage for the commit–reveal commitment hash.
 *
 * The bug this guards against: the frontend hashed with `encodePacked` while
 * the contract verified `abi.encode`, so `commitMint` succeeded and every
 * `revealMint` reverted with "invalid secret" — minting was impossible.
 *
 * Run with: npm test
 * (Node 22 native type stripping, no test runner dependency.)
 */

import assert from "node:assert/strict"

import { encodeAbiParameters, encodePacked, keccak256 } from "viem"

import { commitmentFor } from "./commitment.ts"

/**
 * Cross-boundary vector, mirrored in `contracts/test/WalletPrint.t.sol`
 * (see `testCommitmentVectorMatchesContractEncoding`):
 *
 *   secret = bytes32(uint256(1))   minter = address(0xA11CE)
 */

const SECRET = `0x${"00".repeat(31)}01` as const

const MINTER = "0x00000000000000000000000000000000000A11cE" as const // EIP-55 checksummed

const MINTER_OTHER = "0x0000000000000000000000000000000000000B0b" as const // address(0xB0B)

/** `keccak256(abi.encode(SECRET, MINTER))` — the value the contract requires. */

const EXPECTED_COMMITMENT =
  "0x9d3647136d0914d701c9b96dbb35e3dad01a29de1407ef5d8a2df403367aa095"

/** `keccak256(abi.encodePacked(SECRET, MINTER))` — the old, broken encoding. */

const PACKED_COMMITMENT =
  "0x2c670bc75dc49c00afca19ea6af96b92c538fa823378ff2644354dcfb75c40e5"

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

console.log("commitment.ts - regression suite\n")

test("matches the pinned cross-boundary vector", () => {
  assert.equal(commitmentFor(SECRET, MINTER), EXPECTED_COMMITMENT)
})

test("uses standard ABI encoding (64 bytes: two 32-byte slots)", () => {
  const encoded = encodeAbiParameters(
    [{ type: "bytes32" }, { type: "address" }],
    [SECRET, MINTER],
  )

  assert.equal(encoded.length, 2 + 64 * 2)

  assert.equal(keccak256(encoded), EXPECTED_COMMITMENT)

  assert.equal(commitmentFor(SECRET, MINTER), keccak256(encoded))
})

test("does not regress to packed encoding", () => {
  const packed = keccak256(
    encodePacked(["bytes32", "address"], [SECRET, MINTER]),
  )

  assert.equal(
    packed,
    PACKED_COMMITMENT,
    "packed vector changed — recheck the contract",
  )

  assert.notEqual(commitmentFor(SECRET, MINTER), packed)
})

test("is deterministic", () => {
  assert.equal(commitmentFor(SECRET, MINTER), commitmentFor(SECRET, MINTER))
})

test("is bound to the minter address", () => {
  assert.notEqual(
    commitmentFor(SECRET, MINTER),
    commitmentFor(SECRET, MINTER_OTHER),
  )
})

test("returns a 32-byte hash", () => {
  assert.match(commitmentFor(SECRET, MINTER), /^0x[0-9a-f]{64}$/)
})

console.log(`\n${passed} passed, ${failed} failed`)

if (failed > 0) {
  throw new Error(`${failed} commitment test(s) failed`)
}

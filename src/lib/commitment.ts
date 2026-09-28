import { encodeAbiParameters, keccak256, type Hex } from "viem"

/**
 * Commitment hash for the Wallet Print commit–reveal mint.
 *
 * This MUST stay byte-for-byte identical to the on-chain check in
 * `contracts/src/WalletPrint.sol`:
 *
 *   keccak256(abi.encode(secret, msg.sender))
 *
 * Note the use of standard ABI encoding — each argument occupies its own
 * 32-byte slot. Do NOT switch this to `encodePacked`: packed layout places the
 * address directly after the 32 secret bytes, producing a different hash, so
 * every `revealMint` call would revert with "invalid secret".
 *
 * The resulting vector is pinned by both `src/lib/commitment.test.ts` and
 * `contracts/test/WalletPrint.t.sol`, so either side drifting fails a test.
 */

export function commitmentFor(secret: Hex, walletAddress: `0x${string}`): Hex {
  return keccak256(
    encodeAbiParameters([{ type: "bytes32" }, { type: "address" }], [
      secret,
      walletAddress,
    ]),
  )
}

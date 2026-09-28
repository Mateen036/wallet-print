import type { Abi } from "viem"

import { parseAbi } from "viem"

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const

export const WALLET_PRINT_ADDRESS =
  import.meta.env.VITE_WALLET_PRINT_ADDRESS as `0x${string}` | undefined ??
  ZERO_ADDRESS

export const WALLET_PRINT_ABI = parseAbi([
  "function commitMint(bytes32 commitment) external",

  "function revealMint(bytes32 secret) external",

  // Stores the commit block hash that seeds the artwork. Permissionless, and the
  // app sends it right after the commit confirms.
  "function snapshotCommitment(address minter) external",

  "function totalSupply() view returns (uint256)",

  "function MAX_SUPPLY() view returns (uint256)",

  "function COMMIT_EXPIRY() view returns (uint256)",

  "function REVEAL_DELAY() view returns (uint256)",

  "function SNAPSHOT_WINDOW() view returns (uint256)",

  // The block counter the commit/reveal math uses — the L2 counter on Robinhood
  // Chain, where `block.number` is an Ethereum estimate.
  "function currentBlock() view returns (uint256)",

  // Retained for the pending on-chain metadata phase; not called by the UI yet.

  "function tokenURI(uint256 tokenId) view returns (string)",

  "function hasMinted(address) view returns (bool)",

  "function mintedTokenId(address) view returns (uint256)",

  "function mintCommitment(address) view returns (bytes32)",

  "function commitmentBlock(address) view returns (uint256)",

  "function commitmentTime(address) view returns (uint256)",

  "function commitBlockHash(address) view returns (bytes32)",

  "function tokenSeed(uint256) view returns (bytes32)",

  "event MintCommitted(address indexed to, bytes32 commitment, uint256 commitmentBlock)",

  "event CommitmentSnapshotted(address indexed to, uint256 commitmentBlock, bytes32 blockHash)",

  "event Minted(address indexed to, uint256 indexed tokenId, bytes32 seed)",
]) as Abi

export const CONTRACT_READY = WALLET_PRINT_ADDRESS !== ZERO_ADDRESS

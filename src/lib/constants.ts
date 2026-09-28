export const MAX_SUPPLY = 6767

/**
 * Fallbacks for the on-chain constants, used only until the contract reads
 * resolve. `WalletPrint.sol` is the source of truth — the mint UI reads
 * `COMMIT_EXPIRY`, `REVEAL_DELAY`, and `SNAPSHOT_WINDOW` from the chain and
 * falls back to these.
 */
export const COMMIT_EXPIRY_FALLBACK = 1800
export const REVEAL_DELAY_FALLBACK = 1
export const SNAPSHOT_WINDOW_FALLBACK = 250

export const MINT_SEQUENCE_STEPS = [
  "INITIALIZING",
  "RECEIVING SIGNAL",
  "BUILDING MATRIX",
  "16 × 16",
  "FORMING STRUCTURE",
  "REGISTERING PLATES",
  "PRINTING",
  "COMPLETE",
] as const

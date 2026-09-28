# Wallet Print

Wallet Print turns a wallet identity into a deterministic generative print. The frontend is a Vite + React app and the mint contract is a Foundry project under `contracts/`.

## Local development

Start Anvil:

```bash
anvil
```

Deploy the contract from a second terminal:

```bash
cd contracts
forge build
forge test
forge create src/WalletPrint.sol:WalletPrint \
  --rpc-url http://127.0.0.1:8545 \
  --private-key YOUR_ANVIL_PRIVATE_KEY \
  --broadcast
```

Put the deployed address in the root `.env` using `.env.example` as a guide, then start the frontend:

```bash
npm install
npm run dev -- --port 5173
```

The mint is a commit-reveal flow with three steps. The wallet commits a secret, the app stores the commit block hash that seeds the artwork, and the wallet then reveals the secret to mint.

## Robinhood Chain

Wallet Print targets Robinhood Chain, an Arbitrum L2 that uses ETH as its gas
token and allows contracts up to 96 KB (so the full on-chain SVG generator fits).

| | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | `4663` | `46630` |
| RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | [RobinScan](https://robin.etherscan.io) | [Blockscout](https://explorer.testnet.chain.robinhood.com) |
| Faucet | — (bridge ETH with the Arbitrum canonical bridge) | `https://faucet.testnet.chain.robinhood.com` |

There is also a Robinhood-hosted Blockscout at
`https://robinhoodchain.blockscout.com` for browsing, but its front end sits
behind a Cloudflare challenge, so scripted verification against it fails (see
[Verifying with standard JSON](#verifying-with-standard-json)).

### Deploy and verify

Deploy with `forge create` from the repo root so the artifacts land in
`contracts/out`:

```bash
cd contracts
forge create src/WalletPrint.sol:WalletPrint \
  --rpc-url <rpc> \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

`forge verify-contract` works against the **testnet** explorer:

```bash
forge verify-contract 0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3 \
  src/WalletPrint.sol:WalletPrint \
  --chain-id 46630 \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api/ \
  --watch
```

It does **not** work against the mainnet Blockscout: that host sits behind a
Cloudflare interstitial, so scripted requests get an HTML "Just a moment..." page
instead of JSON and Forge fails with `Failed to deserialize response`.

### Verifying with standard JSON

`WalletPrint` is built with `via_ir = true` and the 200-run optimizer, so
explorers need the exact settings. Rather than transcribing them into a web
form, generate the payload and check it locally first:

```bash
# 1. Regenerate the payload from the exact compiler input Foundry used.
npm run verify:prepare

# 2. Compile it with the same solc and diff the runtime bytecode against the
#    chain. Prints "MATCH true" only if the explorer will be able to verify.
npm run verify:check

# 3. Submit it.
npm run verify:submit    # Etherscan v2, needs ETHERSCAN_API_KEY
```

| Script | Does |
| --- | --- |
| `verify:prepare` | Runs `forge inspect ... standardJson` and writes `contracts/WalletPrint-standard-json-input.json` |
| `verify:check` | Compiles the payload with solc 0.8.25 and compares to `eth_getCode` |
| `verify:submit` | Posts the payload to Etherscan (v2, chain 4663) or Blockscout and polls |
| `verify:bytecode` | Compares `contracts/out` against the chain, for build-vs-deploy drift |

`verify:prepare` and `verify:check` need no API key, so the payload can always
be proven before it is uploaded. `verify:submit` also accepts `--blockscout` and
`--testnet` to target those endpoints instead, though mainnet Blockscout is
blocked by the Cloudflare challenge and the mainnet contract is already verified
on RobinScan.

Two payload details matter, and both are the reason a hand-rolled upload can
report "Unable to find matching Contract Bytecode and ABI" even when the sources
are right:

- **`settings.experimental` must be removed.** Forge emits it; it is not part of
  solc's standard-JSON schema, so solc aborts with `Unknown key "experimental"`
  before comparing anything. `verify:prepare` strips it. This was the actual
  cause of the original mainnet verification failure.
- **`settings.compilationTarget` must not be sent to solc** — same
  `Unknown key` failure. Etherscan's form does not need it, and
  `verify:submit` passes Blockscout's target as a separate top-level field.

Etherscan is reached through the v2 unified API with `chainid=4663`
(`api.etherscan.io`); the chain-specific host `api.robin.etherscan.io` does not
resolve. The Blockscout instances do not serve the v2
`/verification/via/solidity-standard-json` route (it 404s), but they do serve the
Etherscan-compatible v1 `verifysourcecode` API, which is what
`verify:submit --blockscout` and `forge verify-contract --verifier blockscout`
both use.

### Deployments

| Network | Chain ID | Contract | Explorer |
| --- | --- | --- | --- |
| Robinhood Chain Mainnet | `4663` | `0xF391057A5C8C5045b84147560dDE7Ef609625f8E` | [RobinScan](https://robin.etherscan.io/address/0xF391057A5C8C5045b84147560dDE7Ef609625f8E#code) (verified, exact match) |
| Robinhood Chain Testnet | `46630` | `0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3` | [Blockscout](https://explorer.testnet.chain.robinhood.com/address/0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3) (verified) |

Both deployments were built with solc `0.8.25+commit.b61c2a91`, optimizer on at
200 runs, `viaIR`, and `evmVersion` cancun.

Mainnet is verified on RobinScan rather than the Robinhood Blockscout instance:
Blockscout's mainnet front end sits behind a Cloudflare challenge, so scripted
submissions are rejected, whereas `robin.etherscan.io` serves the standard
Etherscan API. `npm run verify:check` reproduces the mainnet runtime bytecode
byte for byte, which is what the explorer's "Exact Match" badge reports.

### What differs on this chain

- **`block.number` is an Ethereum (L1) estimate**, and `blockhash()` always
  returns zero. Both the mint timing and the artwork seed therefore come from the
  ArbSys precompile (`0x…64`): `currentBlock()` returns the L2 counter (what
  `eth_blockNumber` reports), and `arbBlockHash()` returns real recent L2 block
  hashes.
- **`block.prevrandao` is constant**, so the seed uses the commit block hash
  instead. That value cannot exist while the commit transaction is being signed,
  which is what stops a minter from previewing the artwork and grinding for a
  rare print before committing.
- **`arbBlockHash()` only reaches back 256 blocks**, which is a few tens of
  seconds here. `snapshotCommitment(minter)` is permissionless and the frontend
  calls it right after the commit confirms, storing the hash on-chain so the
  reveal stays open for the whole 30-minute `COMMIT_EXPIRY`. A reveal inside the
  250-block `SNAPSHOT_WINDOW` snapshots inline, so a fast mint is still two
  transactions.
- **Code size**: `forge build --sizes` reports the contract above Ethereum's
  24 KB EIP-170 limit. That is expected and fine on Robinhood Chain (96 KB
  limit); it would not deploy to Ethereum as-is.

### Known issue: `findConnectedComponents` overflows on a full grid

`WalletPrintSVG.findConnectedComponents` runs a BFS with `uint8 head` / `uint8
tail` over a fixed `uint8[256]` queue. A component can hold all 256 cells, at
which point `tail++` wraps 255 → 256 and checked arithmetic reverts with
`Panic(0x11)`, so `generateSVG` (and therefore `tokenURI`) reverts for that seed.

The fuzz test `testTraitsAreInRange` hits it with the all-`0xFF` seed. Reaching
it in production needs a commit whose block hash maps to the all-ones grid
*and* the `Blocks` pattern, so it is not practically mintable, but it is a real
brick. The fix is one line — widen the counters, since the queue is 256 deep:

```solidity
uint16 head = 0; uint16 tail = 0;
```

It is **not** fixed on the deployed contracts. Changing the source changes the
bytecode, which would make `npm run verify:check` fail against
`0xF391057A5C8C5045b84147560dDE7Ef609625f8E` — that is the check working
correctly, not a regression. Fix and redeploy first, then regenerate the
verification payload.

## Production deployment

1. Deploy the contract to the chosen chain and verify it on the explorer (see
   above).
2. Set `VITE_RPC_URL`, `VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_EXPLORER_URL`,
   `VITE_IS_TESTNET`, `VITE_WALLET_PRINT_ADDRESS`, and `VITE_SITE_URL` in Vercel
   for the production and preview environments. `.env.example` lists them.
3. Import the GitHub repository into Vercel. Vercel detects the Vite build automatically.
4. Run `npm run build` before promoting the deployment.
5. Test wallet connection, network switching, commit, snapshot, reveal, rejection,
   refresh persistence, and sold-out behavior on testnet.

Never commit `.env`, `.env.local`, private keys, wallet seed phrases, or funded
deployer credentials. `contracts/.env` holds the deployer key for local deploys
and is gitignored; the local Anvil private key is for local testing only.

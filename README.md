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
| Explorer | `https://robinhoodchain.blockscout.com` | `https://explorer.testnet.chain.robinhood.com` |
| Faucet | — (bridge ETH with the Arbitrum canonical bridge) | `https://faucet.testnet.chain.robinhood.com` |

### Deploy and verify

#### Testnet (Chain ID 46630)

```bash
cd contracts
forge create src/WalletPrint.sol:WalletPrint \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

forge verify-contract <address> src/WalletPrint.sol:WalletPrint \
  --chain-id 46630 \
  --rpc-url https://rpc.testnet.chain.robinhood.com \
  --verifier blockscout \
  --verifier-url https://explorer.testnet.chain.robinhood.com/api/ \
  --watch
```

#### Mainnet (Chain ID 4663)

```bash
cd contracts
forge create src/WalletPrint.sol:WalletPrint \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast

forge verify-contract <address> src/WalletPrint.sol:WalletPrint \
  --chain-id 4663 \
  --rpc-url https://rpc.mainnet.chain.robinhood.com \
  --verifier blockscout \
  --verifier-url https://robinhoodchain.blockscout.com/api/ \
  --watch
```

### Deployments

| Network | Chain ID | Contract | Explorer |
| --- | --- | --- | --- |
| Robinhood Chain Testnet | `46630` | `0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3` | [Blockscout](https://explorer.testnet.chain.robinhood.com/address/0xf0f055501841E1cB95Afbec8bF28A2b85B4953a3) |
| Robinhood Chain Mainnet | `4663` | *TBD (deploy using command above)* | [Blockscout](https://robinhoodchain.blockscout.com) |

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

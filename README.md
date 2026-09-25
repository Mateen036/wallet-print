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

The mint uses a two-step commit-reveal flow. The wallet commits a secret, waits one block, and then reveals it to create the final seed.

## Production deployment

1. Deploy the contract to the chosen production chain and verify it on the chain explorer.
2. Set the production `VITE_RPC_URL`, `VITE_CHAIN_ID`, `VITE_CHAIN_NAME`, `VITE_WALLET_PRINT_ADDRESS`, and `VITE_SITE_URL` values in Vercel.
3. Import the GitHub repository into Vercel. Vercel detects the Vite build automatically.
4. Run `npm run build` before promoting the deployment.
5. Test wallet connection, network switching, commit, reveal, rejection, refresh persistence, and sold-out behavior on testnet.

Never commit `.env`, private keys, wallet seed phrases, or funded deployer credentials. The local Anvil private key is for local testing only.

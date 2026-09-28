import type { Chain } from "viem"

const rpcUrl =
  import.meta.env.VITE_RPC_URL as string | undefined ?? "http://127.0.0.1:8545"

const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? "31337")

const chainName =
  import.meta.env.VITE_CHAIN_NAME as string | undefined ??
  "Wallet Print Testnet"

const explorerUrl = import.meta.env.VITE_EXPLORER_URL as string | undefined

/**
 * Robinhood Chain runs chain 4663 on mainnet and 46630 on testnet. Any other id
 * is a local or custom deployment, which is treated as a testnet so wallets
 * label it correctly.
 */
const isTestnet =
  (import.meta.env.VITE_IS_TESTNET as string | undefined) !== undefined
    ? import.meta.env.VITE_IS_TESTNET === "true"
    : chainId !== 4663

export const walletPrintChain: Chain = {
  id: chainId,

  name: chainName,

  nativeCurrency: {
    name: "Ether",

    symbol: "ETH",

    decimals: 18,
  },

  rpcUrls: {
    default: {
      http: [rpcUrl],
    },

    public: {
      http: [rpcUrl],
    },
  },

  ...(explorerUrl
    ? {
        blockExplorers: {
          default: { name: `${chainName} Explorer`, url: explorerUrl },
        },
      }
    : {}),

  testnet: isTestnet,
}

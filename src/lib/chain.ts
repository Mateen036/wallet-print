import type { Chain } from 'viem';

const rpcUrl = (import.meta.env.VITE_RPC_URL as string | undefined) ?? 'http://127.0.0.1:8545';
const chainId = Number(import.meta.env.VITE_CHAIN_ID ?? '31337');

export const walletPrintChain: Chain = {
  id: chainId,
  name: (import.meta.env.VITE_CHAIN_NAME as string | undefined) ?? 'Wallet Print Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
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
  testnet: true,
};

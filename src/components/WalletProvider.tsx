import type { ReactNode } from "react"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { createConfig, http, injected, WagmiProvider } from "wagmi"

import { walletPrintChain } from "../lib/chain"

const queryClient = new QueryClient()

export const wagmiConfig = createConfig({
  chains: [walletPrintChain],

  connectors: [injected()],

  transports: {
    [walletPrintChain.id]: http(),
  },
})

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  )
}

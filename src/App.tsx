import { useEffect } from "react"
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
} from "wagmi"
import { injected } from "wagmi/connectors"
import { Analytics } from "@vercel/analytics/react"
import { Nav } from "./components/Nav"
import { Landing } from "./components/sections/Landing"
import { MintSection } from "./components/sections/MintSection"
import { Codex } from "./components/sections/Codex"
import { Gallery } from "./components/sections/Gallery"
import { YourPrint } from "./components/sections/YourPrint"
import { About } from "./components/sections/About"
import {
  CONTRACT_READY,
  WALLET_PRINT_ABI,
  WALLET_PRINT_ADDRESS,
} from "./lib/contract"
import { walletPrintChain } from "./lib/chain"
import { Reveal } from "./components/Reveal"

export default function App() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, error: switchError } = useSwitchChain()

  const { data: totalSupply, error: supplyError } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "totalSupply",
    query: {
      enabled: CONTRACT_READY,
      refetchInterval: 4000,
    },
  })

  const { data: walletTokenId } = useReadContract({
    address: CONTRACT_READY && address ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "mintedTokenId",
    args: address ? [address] : undefined,
    query: {
      enabled: CONTRACT_READY && !!address,
      refetchInterval: 4000,
    },
  })

  const readableTokenId =
    typeof walletTokenId === "bigint" && walletTokenId > 0n
      ? walletTokenId
      : null

  const { data: walletSeed } = useReadContract({
    address: readableTokenId ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: "tokenSeed",
    args: readableTokenId ? [readableTokenId] : undefined,
    query: {
      enabled: CONTRACT_READY && readableTokenId !== null,
      refetchInterval: 4000,
    },
  })

  useEffect(() => {
    if (isConnected && chainId !== walletPrintChain.id) {
      switchChain({ chainId: walletPrintChain.id })
    }
  }, [chainId, isConnected, switchChain])

  const walletAddress = address ?? null
  const mintedCount = Number(totalSupply ?? 0)
  const walletError = connectError?.message ?? switchError?.message ?? null
  const statusError = walletError ?? supplyError?.message ?? null

  const handleConnectWallet = () => {
    if (!isConnected) {
      connect({ connector: injected() })
      return
    }

    if (chainId !== walletPrintChain.id) {
      switchChain({ chainId: walletPrintChain.id })
      return
    }

    disconnect()
  }

  const scrollToMint = () => {
    document.getElementById("mint")?.scrollIntoView({ behavior: "smooth" })
  }

  return (
    <div className="relative z-10 min-h-screen bg-[#101311] text-[#f4f0e8]">
      <Analytics />
      <Nav
        onConnectWallet={handleConnectWallet}
        walletAddress={walletAddress}
        mintedCount={mintedCount}
        walletError={statusError}
      />

      <main>
        <Landing mintedCount={mintedCount} onMintClick={scrollToMint} />

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Reveal>
          <MintSection
            mintedCount={mintedCount}
            walletConnected={!!walletAddress}
            walletAddress={walletAddress}
            supplyReady={totalSupply !== undefined && !supplyError}
            onConnectWallet={handleConnectWallet}
          />
        </Reveal>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Reveal>
          <Codex />
        </Reveal>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Reveal>
          <Gallery />
        </Reveal>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Reveal>
          <YourPrint
            walletConnected={!!walletAddress}
            tokenId={readableTokenId ? Number(readableTokenId) : null}
            seed={typeof walletSeed === "string" ? walletSeed : null}
            onConnectWallet={handleConnectWallet}
          />
        </Reveal>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Reveal>
          <About />
        </Reveal>
      </main>
    </div>
  )
}

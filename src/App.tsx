import { useAccount, useConnect, useDisconnect, useReadContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { Nav } from './components/Nav';
import { Landing } from './components/sections/Landing';
import { MintSection } from './components/sections/MintSection';
import { Codex } from './components/sections/Codex';
import { Gallery } from './components/sections/Gallery';
import { YourPrint } from './components/sections/YourPrint';
import { About } from './components/sections/About';
import { CONTRACT_READY, WALLET_PRINT_ABI, WALLET_PRINT_ADDRESS } from './lib/contract';

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: totalSupply } = useReadContract({
    address: CONTRACT_READY ? WALLET_PRINT_ADDRESS : undefined,
    abi: WALLET_PRINT_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: CONTRACT_READY && isConnected,
    },
  });

  const walletAddress = address ?? null;
  const mintedCount = Number(totalSupply ?? 2814);

  const handleConnectWallet = () => {
    if (!isConnected) {
      connect({ connector: injected() });
      return;
    }

    disconnect();
  };

  const scrollToMint = () => {
    document.getElementById('mint')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      <Nav
        onConnectWallet={handleConnectWallet}
        walletAddress={walletAddress}
        mintedCount={mintedCount}
      />

      <main>
        <Landing mintedCount={mintedCount} onMintClick={scrollToMint} />

        {/* Divider */}
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <MintSection
          mintedCount={mintedCount}
          walletConnected={!!walletAddress}
          walletAddress={walletAddress}
          onConnectWallet={handleConnectWallet}
        />

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Codex />

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <Gallery />

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <YourPrint
          walletConnected={!!walletAddress}
          tokenId={walletAddress ? 2814 : null}
          seed={walletAddress ? '0x71c7656ec7ab88b098defb751b7401b5f6d8976f0000000000000000000000af' : null}
          onConnectWallet={handleConnectWallet}
        />

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/6" />
        </div>

        <About />
      </main>
    </div>
  );
}

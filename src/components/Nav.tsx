import { useState } from 'react';
import { MAX_SUPPLY } from '../lib/constants';

interface NavProps {
  onConnectWallet?: () => void;
  walletAddress?: string | null;
  mintedCount?: number;
}

export function Nav({ onConnectWallet, walletAddress, mintedCount = 0 }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/8 bg-[#080808]/80 backdrop-blur-sm">
      <button
        onClick={() => scrollTo('landing')}
        className="font-display text-sm font-black tracking-[0.25em] text-white uppercase hover:opacity-60 transition-opacity"
      >
        WALLET PRINT
      </button>

      {/* Desktop nav */}
      <div className="hidden md:flex items-center gap-8">
        {['CODEX', 'GALLERY', 'ABOUT'].map(label => (
          <button
            key={label}
            onClick={() => scrollTo(label.toLowerCase())}
            className="font-mono text-[10px] tracking-[0.2em] text-white/40 hover:text-white/80 transition-colors uppercase"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-4">
        {mintedCount > 0 && (
          <span className="hidden sm:block font-mono text-[10px] tracking-widest text-white/30">
            {mintedCount.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}
          </span>
        )}
        <button
          onClick={onConnectWallet}
          className="font-mono text-[10px] tracking-[0.15em] uppercase border border-white/20 px-4 py-2 text-white/60 hover:border-white/60 hover:text-white transition-all"
        >
          {walletAddress
            ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
            : 'CONNECT WALLET'}
        </button>
      </div>
    </nav>
  );
}

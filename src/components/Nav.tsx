import { useState } from 'react';
import { MAX_SUPPLY } from '../lib/constants';

interface NavProps {
  onConnectWallet?: () => void;
  walletAddress?: string | null;
  mintedCount?: number;
  walletError?: string | null;
}

export function Nav({ onConnectWallet, walletAddress, mintedCount = 0, walletError = null }: NavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#f4f0e8]/10 bg-[#101311]/85 backdrop-blur-xl">
      <div className="flex h-7 items-center justify-center bg-[#c5ff4e] px-4 font-mono text-[8px] tracking-[0.26em] text-[#101311] uppercase">
        MINT A UNIQUE PRINT FROM YOUR WALLET IDENTITY
      </div>

      <div className="flex items-center justify-between px-5 md:px-8 py-4">
        <button
          onClick={() => scrollTo('landing')}
          className="font-display text-sm font-black tracking-[0.25em] text-[#f4f0e8] uppercase hover:text-[#c5ff4e] transition-colors"
        >
          WALLET PRINT
        </button>

        <div className="hidden md:flex items-center gap-8">
          {['MINT', 'CODEX', 'GALLERY', 'ABOUT'].map(label => (
            <button
              key={label}
              onClick={() => scrollTo(label.toLowerCase())}
              className="font-mono text-[10px] tracking-[0.2em] text-[#f4f0e8]/45 hover:text-[#c5ff4e] transition-colors uppercase"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {mintedCount > 0 && (
            <span className="hidden sm:block font-mono text-[10px] tracking-widest text-[#f4f0e8]/40">
              {mintedCount.toLocaleString()} / {MAX_SUPPLY.toLocaleString()}
            </span>
          )}
          <button
            onClick={onConnectWallet}
            className="font-mono text-[10px] tracking-[0.15em] uppercase border border-[#c5ff4e]/45 px-4 py-2 text-[#c5ff4e] hover:bg-[#c5ff4e] hover:text-[#101311] transition-all"
          >
            {walletAddress
              ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}`
              : 'CONNECT WALLET'}
          </button>
          {walletError && (
            <p
              role="alert"
              className="absolute right-5 top-full mt-2 max-w-xs border border-red-300/30 bg-[#101311] px-3 py-2 font-mono text-[9px] leading-relaxed text-red-200/80"
            >
              {walletError}
            </p>
          )}
          <button
            type="button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen(open => !open)}
            className="md:hidden border border-[#f4f0e8]/20 px-3 py-2 font-mono text-[10px] tracking-[0.15em] text-[#f4f0e8]/70 uppercase"
          >
            {menuOpen ? 'CLOSE' : 'MENU'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-[#f4f0e8]/10 px-5 py-4 grid grid-cols-2 gap-2 bg-[#101311] animate-[menu-in_220ms_ease-out]">
          {['MINT', 'CODEX', 'GALLERY', 'ABOUT'].map(label => (
            <button
              key={label}
              onClick={() => scrollTo(label.toLowerCase())}
              className="py-3 text-left font-mono text-[10px] tracking-[0.2em] text-[#f4f0e8]/60 uppercase hover:text-[#c5ff4e]"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

import { useEffect, useRef, useState } from 'react';
import { MAX_SUPPLY } from '../../lib/constants';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { randomHexSeed } from '../../generator/index';

interface LandingProps {
  mintedCount?: number;
  onMintClick?: () => void;
}

export function Landing({ mintedCount = 0, onMintClick }: LandingProps) {
  const [seeds] = useState(() => Array.from({ length: 4 }, randomHexSeed));
  const [active, setActive] = useState(0);
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTitleVisible(true), 200);
    return () => clearTimeout(t);
  }, []);

  // Cycle background artworks
  useEffect(() => {
    const interval = setInterval(() => setActive(a => (a + 1) % seeds.length), 8000);
    return () => clearInterval(interval);
  }, [seeds]);

  const isSoldOut = mintedCount >= MAX_SUPPLY;

  return (
    <section
      id="landing"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
    >
      {/* Background artwork grid — blurred, very subtle */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute inset-0 flex items-center justify-center opacity-8">
          <div
            className="transition-opacity duration-2000"
            style={{ filter: 'blur(2px) saturate(0.6)' }}
          >
            <ArtworkCanvas seed={seeds[active]} size={700} animate />
          </div>
        </div>
        {/* Vignette */}
        <div className="absolute inset-0 bg-radial-gradient" />
      </div>

      {/* Main content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-8 text-center px-6 transition-all duration-1000 ${
          titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="space-y-1">
          <h1 className="font-display text-[clamp(4rem,14vw,12rem)] font-black leading-none tracking-tighter text-white uppercase">
            WALLET
          </h1>
          <h1 className="font-display text-[clamp(4rem,14vw,12rem)] font-black leading-none tracking-tighter text-white uppercase">
            PRINT
          </h1>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-white/20" />
            <span className="font-mono text-[10px] tracking-[0.4em] text-white/35 uppercase">
              {MAX_SUPPLY.toLocaleString()} PRINTS
            </span>
            <div className="h-px w-8 bg-white/20" />
          </div>
          <p className="font-mono text-[10px] tracking-[0.25em] text-white/20 uppercase max-w-xs">
            Your mint becomes your print
          </p>
        </div>

        <div className="flex flex-col items-center gap-4 mt-4">
          {mintedCount > 0 && (
            <span className="font-mono text-[10px] tracking-widest text-white/20">
              {mintedCount.toLocaleString()} / {MAX_SUPPLY.toLocaleString()} MINTED
            </span>
          )}

          <button
            onClick={onMintClick}
            disabled={isSoldOut}
            className="group relative font-mono text-[11px] tracking-[0.25em] uppercase border border-white/25 px-10 py-4 text-white/60 hover:border-white/70 hover:text-white transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="relative z-10">
              {isSoldOut ? 'SOLD OUT' : 'MINT YOUR PRINT'}
            </span>
          </button>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-20">
        <div className="h-12 w-px bg-white animate-pulse" />
      </div>
    </section>
  );
}

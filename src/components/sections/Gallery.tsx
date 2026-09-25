import { useState, useCallback } from 'react';
import { ArtworkCanvas } from '../ArtworkCanvas';
import { generate, seedFromTokenId } from '../../generator/index';

const PREVIEW_COUNT = 24;

interface PrintCardProps {
  tokenId: number;
  onSelect: (tokenId: number) => void;
}

function PrintCard({ tokenId, onSelect }: PrintCardProps) {
  return (
    <button
      onClick={() => onSelect(tokenId)}
      className="group text-left focus:outline-none focus:ring-1 focus:ring-white/30"
    >
      <div className="relative overflow-hidden border border-white/6 group-hover:border-white/20 transition-colors">
        <ArtworkCanvas seed={seedFromTokenId(tokenId)} tokenId={tokenId} size={200} className="w-full" />
      </div>
      <p className="font-mono text-[9px] tracking-[0.2em] text-white/25 mt-2 group-hover:text-white/50 transition-colors">
        #{String(tokenId).padStart(4, '0')}
      </p>
    </button>
  );
}

interface DetailModalProps {
  tokenId: number;
  onClose: () => void;
}

function DetailModal({ tokenId, onClose }: DetailModalProps) {
  const seed = seedFromTokenId(tokenId);
  const result = generate(seed, tokenId);
  const attrs = result.metadata.attributes;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#080808]/95 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="relative max-w-2xl w-full flex flex-col md:flex-row gap-8"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-shrink-0">
          <ArtworkCanvas seed={seed} tokenId={tokenId} size={300} />
        </div>

        <div className="flex flex-col justify-between gap-6">
          <div>
            <p className="font-mono text-[9px] tracking-[0.3em] text-white/25 uppercase mb-2">
              WALLET PRINT
            </p>
            <h2 className="font-display text-3xl font-black tracking-tight text-white uppercase">
              #{String(tokenId).padStart(4, '0')}
            </h2>
          </div>

          <div className="space-y-0">
            {attrs.map(({ trait_type, value }) => (
              <div key={trait_type} className="flex justify-between items-center py-2 border-b border-white/6">
                <span className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">{trait_type}</span>
                <span className="font-mono text-[9px] tracking-[0.1em] text-white/55 uppercase">{value}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="font-mono text-[9px] tracking-[0.2em] uppercase text-white/25 hover:text-white/60 border border-white/10 hover:border-white/25 px-4 py-2 self-start transition-all"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

export function Gallery() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <section id="gallery" className="px-6 py-32 max-w-6xl mx-auto">
      <div className="mb-12">
        <h2 className="font-display text-[clamp(2rem,6vw,5rem)] font-black leading-none tracking-tight text-white uppercase mb-3">
          THE PRINTS
        </h2>
        <p className="font-mono text-[10px] tracking-[0.3em] text-white/25 uppercase">
          {PREVIEW_COUNT} of {(6767).toLocaleString()} shown
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {Array.from({ length: PREVIEW_COUNT }, (_, i) => (
          <PrintCard key={i + 1} tokenId={i + 1} onSelect={setSelected} />
        ))}
      </div>

      {selected !== null && (
        <DetailModal tokenId={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

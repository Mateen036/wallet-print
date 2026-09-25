import { ArtworkCanvas } from '../ArtworkCanvas';
import { seedFromTokenId } from '../../generator/index';

export function About() {
  return (
    <section id="about" className="px-6 py-32 max-w-4xl mx-auto">
      <div className="grid md:grid-cols-2 gap-16 items-start">
        <div className="space-y-8">
          <h2 className="font-display text-[clamp(2rem,6vw,5rem)] font-black leading-none tracking-tight text-white uppercase">
            ABOUT
          </h2>

          <div className="space-y-6">
            <p className="font-mono text-[11px] text-white/45 leading-[2] tracking-wide">
              A wallet is normally an identifier.
            </p>
            <p className="font-mono text-[11px] text-white/45 leading-[2] tracking-wide">
              In Wallet Print, that identity becomes a visual seed.
              Every aspect of your print — its structure, palette, and
              registration — derives deterministically from the conditions
              of your mint.
            </p>
            <p className="font-mono text-[11px] text-white/45 leading-[2] tracking-wide">
              Each mint produces one print.
              6,767 participants.
              6,767 outputs.
              No two intended to be the same.
            </p>
            <p className="font-mono text-[11px] text-white/45 leading-[2] tracking-wide">
              You do not choose the print.
              You create the conditions for it to exist.
            </p>
          </div>

          <div className="pt-4 space-y-3">
            {[
              ['COLLECTION',   '6,767 PRINTS'],
              ['BLOCKCHAIN',   'ROBINHOOD CHAIN'],
              ['CONTRACT',     'ERC-721'],
              ['ARTWORK',      'ON-CHAIN SVG'],
              ['RANDOMNESS',   'PREVRANDAO + KECCAK256'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between items-center py-2 border-b border-white/6">
                <span className="font-mono text-[9px] tracking-[0.2em] text-white/20 uppercase">{label}</span>
                <span className="font-mono text-[9px] tracking-[0.1em] text-white/40 uppercase">{value}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3 pt-2">
            <p className="font-mono text-[8px] tracking-[0.2em] text-white/12 uppercase">
              SECURITY NOTE
            </p>
            <p className="font-mono text-[9px] text-white/18 leading-relaxed">
              Artwork seeds are derived from{' '}
              <code className="bg-white/5 px-1">block.prevrandao</code>,
              the minter address, and token ID via keccak256.
              A validator on the chain could, in principle, time their mint
              to influence their seed. For an experimental art project on testnet,
              this is an accepted assumption. The security model will be revisited
              before mainnet deployment.
            </p>
          </div>
        </div>

        {/* Side artwork grid */}
        <div className="grid grid-cols-2 gap-3 md:sticky md:top-32">
          {[100, 200, 300, 400].map(id => (
            <div key={id} className="border border-white/6">
              <ArtworkCanvas seed={seedFromTokenId(id)} tokenId={id} size={160} />
            </div>
          ))}
        </div>
      </div>

      <footer className="mt-32 pt-8 border-t border-white/6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <span className="font-mono text-[9px] tracking-[0.3em] text-white/15 uppercase">
          WALLET PRINT
        </span>
        <span className="font-mono text-[9px] tracking-[0.2em] text-white/10 uppercase">
          A generative art experiment — not an investment
        </span>
      </footer>
    </section>
  );
}

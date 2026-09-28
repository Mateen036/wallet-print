import { ArtworkCanvas } from "../ArtworkCanvas"
import { generate } from "../../generator/index"

interface YourPrintProps {
  walletConnected?: boolean
  tokenId?: number | null
  seed?: string | null
  onConnectWallet?: () => void
}

export function YourPrint({
  walletConnected = false,
  tokenId = null,
  seed = null,
  onConnectWallet,
}: YourPrintProps) {
  const hasPrint = walletConnected && tokenId !== null && seed !== null
  const result = hasPrint ? generate(seed!, tokenId!) : null

  return (
    <section id="yourprint" className="px-6 py-32 max-w-4xl mx-auto">
      <div className="mb-12">
        <h2 className="font-display text-[clamp(2rem,6vw,5rem)] font-black leading-none tracking-tight text-white uppercase">
          YOUR PRINT
        </h2>
      </div>

      {!walletConnected ? (
        <div className="border border-white/8 p-12 flex flex-col items-center gap-6 text-center">
          {/* Placeholder grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8,8px)",
              gap: "3px",
              opacity: 0.08,
            }}
          >
            {Array.from({ length: 64 }, (_, i) => (
              <div
                key={i}
                style={{ width: 8, height: 8, background: "white" }}
              />
            ))}
          </div>
          <div className="space-y-2">
            <p className="font-mono text-[11px] tracking-[0.3em] text-white/40 uppercase">
              NO WALLET CONNECTED
            </p>
            <p className="font-mono text-[9px] tracking-[0.1em] text-white/20 uppercase">
              Connect to see your print
            </p>
          </div>
          <button
            onClick={onConnectWallet}
            className="font-mono text-[10px] tracking-[0.2em] uppercase border border-white/20 px-6 py-3 text-white/40 hover:border-white/50 hover:text-white/70 transition-all"
          >
            CONNECT WALLET
          </button>
        </div>
      ) : !hasPrint ? (
        <div className="border border-white/8 p-12 flex flex-col items-center gap-6 text-center">
          <p className="font-mono text-[11px] tracking-[0.3em] text-white/40 uppercase">
            NO PRINT YET
          </p>
          <p className="font-mono text-[9px] tracking-[0.1em] text-white/20 uppercase">
            Mint your print to create your unique artwork
          </p>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-12 items-start">
          <div className="flex-shrink-0">
            <ArtworkCanvas seed={seed!} tokenId={tokenId!} size={300} />
          </div>

          <div className="flex flex-col gap-8 flex-1">
            <div>
              <p className="font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase mb-1">
                WALLET PRINT
              </p>
              <h3 className="font-display text-4xl font-black tracking-tight text-white uppercase">
                #{String(tokenId).padStart(4, "0")}
              </h3>
            </div>

            <div className="space-y-0">
              {result!.metadata.attributes.map(({ trait_type, value }) => (
                <div
                  key={trait_type}
                  className="flex justify-between items-center py-2.5 border-b border-white/6"
                >
                  <span className="font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                    {trait_type}
                  </span>
                  <span className="font-mono text-[9px] tracking-[0.1em] text-white/55 uppercase">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[9px] tracking-[0.2em] text-white/15 uppercase">
                SEED
              </p>
              <p className="font-mono text-[7px] text-white/12 break-all leading-relaxed">
                {seed}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

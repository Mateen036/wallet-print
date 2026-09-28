import { useState } from "react"
import { ArtworkCanvas } from "../ArtworkCanvas"
import { seedFromTokenId } from "../../generator/index"

const PIPELINE = [
  {
    id: "wallet",
    label: "WALLET",
    description:
      "Your wallet address is the first input. It identifies you uniquely on the blockchain.",
  },
  {
    id: "mint",
    label: "MINT",
    description:
      "Your wallet commits a secret hash first. After one block, you reveal the secret and the contract assigns a sequential token ID.",
  },
  {
    id: "seed",
    label: "SEED",
    description:
      "The contract combines your revealed secret, address, token ID, block randomness, and the commitment block hash via keccak256 to produce a 32-byte seed. This is stored on-chain and is permanent.",
  },
  {
    id: "bits",
    label: "256 BITS",
    description:
      "The seed is 256 bits of deterministic data. Every bit of your seed is fixed from the moment of your mint. No two wallets receive the same seed.",
  },
  {
    id: "matrix",
    label: "16 × 16",
    description:
      "The 256 bits map directly to a 16×16 binary matrix. Each bit determines whether a cell is active. Trait rolls (palette, pattern, plates) are mixed from the full 32-byte seed, then the matrix is rotated.",
  },
  {
    id: "geometry",
    label: "GEOMETRY",
    description:
      "Connected active cells are grouped into geometric structures — blocks, bands, clusters, or fragments. The interpretation mode is itself derived from the seed.",
  },
  {
    id: "cmyk",
    label: "CMYK",
    description:
      "Structures are distributed across four printing plates: Key (black), Cyan, Magenta, and Yellow. Each plate receives an independent registration offset, like a physical press.",
  },
  {
    id: "print",
    label: "PRINT",
    description:
      "The plates are composited with authentic CMYK blend modes. Where colors overlap, they mix as physical ink does. The result is your unique, deterministic print.",
  },
] as const

type StepId = typeof PIPELINE[number]["id"]

export function Codex() {
  const [active, setActive] = useState<StepId | null>(null)

  return (
    <section id="codex" className="px-6 py-32 max-w-4xl mx-auto">
      <div className="mb-16">
        <p className="section-kicker mb-3">
          / 02 — how a wallet becomes a print
        </p>
        <h2 className="font-display text-[clamp(2rem,6vw,5rem)] font-black leading-none tracking-tight text-[#f4f0e8] uppercase mb-3">
          THE ALGORITHM
        </h2>
        <p className="font-mono text-[10px] tracking-[0.3em] text-[#f4f0e8]/40 uppercase">
          Hover to inspect each stage
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-12 items-start">
        {/* Pipeline */}
        <div className="space-y-0">
          {PIPELINE.map((step, i) => {
            const isLast = i === PIPELINE.length - 1
            const isActive = active === step.id
            return (
              <div key={step.id}>
                <button
                  onMouseEnter={() => setActive(step.id)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(step.id)}
                  onBlur={() => setActive(null)}
                  onClick={() => setActive(isActive ? null : step.id)}
                  className={`w-full flex items-center gap-4 py-3 text-left group transition-all ${
                    isActive ? "opacity-100" : "opacity-30 hover:opacity-70"
                  }`}
                >
                  <div
                    className={`w-5 h-5 border flex-shrink-0 flex items-center justify-center transition-colors ${
                      isActive ? "border-white bg-white" : "border-white/30"
                    }`}
                  >
                    {isActive && <div className="w-2 h-2 bg-black" />}
                  </div>
                  <span className="font-mono text-[11px] tracking-[0.25em] text-white uppercase">
                    {step.label}
                  </span>
                </button>

                {/* Connector */}
                {!isLast && <div className="ml-[10px] w-px h-6 bg-white/10" />}

                {/* Mobile: inline description */}
                {isActive && (
                  <div className="md:hidden ml-9 mb-3">
                    <p className="font-mono text-[10px] tracking-wide text-white/50 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        <div className="hidden md:block sticky top-32">
          <div className="border border-white/8 p-6 min-h-[200px] flex flex-col justify-between">
            {active ? (
              <>
                <div className="space-y-4">
                  <span className="font-mono text-[9px] tracking-[0.3em] text-white/20 uppercase">
                    {PIPELINE.findIndex((s) => s.id === active) + 1} /{" "}
                    {PIPELINE.length}
                  </span>
                  <h3 className="font-display text-2xl font-black tracking-tight text-white uppercase">
                    {PIPELINE.find((s) => s.id === active)?.label}
                  </h3>
                  <p className="font-mono text-[11px] text-white/45 leading-relaxed">
                    {PIPELINE.find((s) => s.id === active)?.description}
                  </p>
                </div>

                {/* Mini artwork demo for matrix/geometry/cmyk stages */}
                {["matrix", "geometry", "cmyk", "print"].includes(active) && (
                  <div className="mt-6 self-start">
                    <ArtworkCanvas
                      seed={seedFromTokenId(
                        active === "matrix"
                          ? 42
                          : active === "geometry"
                            ? 137
                            : active === "cmyk"
                              ? 256
                              : 512,
                      )}
                      size={120}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="font-mono text-[10px] tracking-[0.2em] text-white/15 uppercase self-center text-center my-auto">
                SELECT A STAGE
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

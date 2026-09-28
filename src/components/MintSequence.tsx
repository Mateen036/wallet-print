import { useState, useEffect, useRef } from "react"
import { MINT_SEQUENCE_STEPS } from "../lib/constants"
import { ArtworkCanvas } from "./ArtworkCanvas"
import { generate } from "../generator/index"
import type { Traits } from "../generator/index"

interface MintSequenceProps {
  seed: string
  tokenId: number
  onClose?: () => void
}

type Phase = "sequence" | "reveal"

export function MintSequence({ seed, tokenId, onClose }: MintSequenceProps) {
  const [phase, setPhase] = useState<Phase>("sequence")
  const [stepIndex, setStepIndex] = useState(0)
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const result = generate(seed, tokenId)
  const traits = result.traits as Traits

  useEffect(() => {
    setVisible(true)
    let i = 0
    const advance = () => {
      i++
      if (i < MINT_SEQUENCE_STEPS.length) {
        setStepIndex(i)
        const delay = i === MINT_SEQUENCE_STEPS.length - 1 ? 1200 : 600
        timerRef.current = setTimeout(advance, delay)
      } else {
        timerRef.current = setTimeout(() => setPhase("reveal"), 800)
      }
    }
    timerRef.current = setTimeout(advance, 700)
    return () => clearTimeout(timerRef.current)
  }, [])

  if (phase === "reveal") {
    return (
      <RevealScreen
        seed={seed}
        tokenId={tokenId}
        traits={traits}
        result={result}
        onClose={onClose}
      />
    )
  }

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#080808] flex flex-col items-center justify-center transition-opacity duration-500 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="space-y-2 text-center">
        {MINT_SEQUENCE_STEPS.slice(0, stepIndex + 1).map((step, i) => (
          <p
            key={step}
            className={`font-mono text-xs tracking-[0.3em] uppercase transition-all duration-300 ${
              i === stepIndex ? "text-white" : "text-white/20"
            }`}
          >
            {step}
          </p>
        ))}
      </div>

      {/* Subtle animated grid hint */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <GridHint step={stepIndex} />
      </div>
    </div>
  )
}

function GridHint({ step }: { step: number }) {
  const cells = 16
  const filledCount = Math.round(
    (step / (MINT_SEQUENCE_STEPS.length - 1)) * cells * cells,
  )
  return (
    <div
      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cells}, 12px)`,
        gap: "2px",
      }}
    >
      {Array.from({ length: cells * cells }, (_, i) => (
        <div
          key={i}
          className="transition-colors duration-200"
          style={{
            width: 12,
            height: 12,
            background: i < filledCount ? "white" : "transparent",
            border: "1px solid rgba(255,255,255,0.3)",
          }}
        />
      ))}
    </div>
  )
}

interface RevealScreenProps {
  seed: string
  tokenId: number
  traits: Traits
  result: ReturnType<typeof generate>
  onClose?: () => void
}

function RevealScreen({
  seed,
  tokenId,
  traits,
  result,
  onClose,
}: RevealScreenProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const paletteName =
    result.metadata.attributes.find((a) => a.trait_type === "Palette")?.value ??
    "—"

  const rows: [string, string | number][] = [
    ["CORNERS", traits.corners],
    ["PALETTE", paletteName],
    ["DENSITY", traits.density],
    ["PATTERN", traits.pattern],
    ["PRINT", traits.printMode],
    ["DISTORTION", traits.distortion],
    ["LAYERS", traits.layerCount],
  ]

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#080808] overflow-y-auto transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-20 gap-12">
        <p className="font-mono text-[10px] tracking-[0.4em] text-white/30 uppercase">
          PRINT #{String(tokenId).padStart(4, "0")}
        </p>

        <div
          className="relative mint-reveal-artwork"
          style={{
            boxShadow: "0 0 60px rgba(255,255,255,0.03)",
          }}
        >
          <ArtworkCanvas seed={seed} tokenId={tokenId} size={360} />
        </div>

        <div className="w-full max-w-xs">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between py-2 border-b border-white/8"
            >
              <span className="font-mono text-[10px] tracking-[0.2em] text-white/30 uppercase">
                {label}
              </span>
              <span className="font-mono text-[10px] tracking-[0.1em] text-white/70 uppercase">
                {value}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-[9px] tracking-[0.2em] text-white/20 uppercase">
            SEED
          </p>
          <p className="font-mono text-[8px] text-white/15 break-all max-w-xs text-center leading-relaxed">
            {seed}
          </p>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="font-mono text-[10px] tracking-[0.2em] uppercase text-white/30 hover:text-white/70 border border-white/10 hover:border-white/30 px-6 py-3 transition-all"
          >
            CLOSE
          </button>
        )}
      </div>
    </div>
  )
}

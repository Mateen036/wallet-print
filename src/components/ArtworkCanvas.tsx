import { useMemo, useEffect, useRef, useState } from "react"
import { generate, randomHexSeed } from "../generator/index"

interface ArtworkCanvasProps {
  seed?: string
  tokenId?: number
  size?: number
  animate?: boolean
  className?: string
}

/**
 * Renders a deterministic Wallet Print SVG.
 * When `animate` is true and no seed is provided, the CMYK layers
 * drift slowly — mimicking a press aligning its plates.
 */
export function ArtworkCanvas({
  seed,
  tokenId = 0,
  size = 400,
  animate = false,
  className = "",
}: ArtworkCanvasProps) {
  const fixedSeed = useMemo(() => seed ?? randomHexSeed(), [seed])
  const result = useMemo(
    () => generate(fixedSeed, tokenId),
    [fixedSeed, tokenId],
  )

  const svgRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const tRef = useRef(0)

  // Slow CMYK layer drift via direct DOM transform mutation (no re-render)
  useEffect(() => {
    if (!animate) return
    const container = svgRef.current
    if (!container) return

    const cancel = () => cancelAnimationFrame(rafRef.current)

    const tick = () => {
      tRef.current += 0.004
      const t = tRef.current
      const svg = container.querySelector("svg")
      if (!svg) {
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      // Animate the individual plate <g> elements (children of the blend group)
      const blendGroup = svg.querySelectorAll<SVGGElement>(
        '[style*="mix-blend-mode"]',
      )
      blendGroup.forEach((group) => {
        const children = group.children
        if (children[1]) {
          // C plate
          const dx = Math.sin(t * 0.7) * 2.5
          const dy = Math.cos(t * 0.5) * 1.8
          ;(children[1] as SVGElement).setAttribute(
            "transform",
            `translate(${dx.toFixed(2)},${dy.toFixed(2)}) rotate(0,320,320)`,
          )
        }
        if (children[2]) {
          // M plate
          const dx = Math.cos(t * 0.6 + 1) * 2
          const dy = Math.sin(t * 0.8 + 0.5) * 2.5
          ;(children[2] as SVGElement).setAttribute(
            "transform",
            `translate(${dx.toFixed(2)},${dy.toFixed(2)}) rotate(0,320,320)`,
          )
        }
        if (children[3]) {
          // Y plate
          const dx = Math.sin(t * 0.9 + 2) * 1.5
          const dy = Math.cos(t * 0.7 + 1.5) * 2
          ;(children[3] as SVGElement).setAttribute(
            "transform",
            `translate(${dx.toFixed(2)},${dy.toFixed(2)}) rotate(0,320,320)`,
          )
        }
      })

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return cancel
  }, [animate, fixedSeed])

  return (
    <div
      ref={svgRef}
      className={`artwork-canvas ${className}`}
      style={{ width: size, height: size, flexShrink: 0 }}
      dangerouslySetInnerHTML={{ __html: result.svg }}
    />
  )
}

/**
 * A larger animated preview that generates new artworks periodically.
 */
export function LivePreview({
  size = 500,
  className = "",
}: {
  size?: number
  className?: string
}) {
  const [seed, setSeed] = useState(() => randomHexSeed())

  useEffect(() => {
    const interval = setInterval(() => setSeed(randomHexSeed()), 12000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className={`relative overflow-hidden transition-opacity duration-1000 ${className}`}
    >
      <ArtworkCanvas seed={seed} size={size} animate />
    </div>
  )
}

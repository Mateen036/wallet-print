import type { Palette } from "./palettes.ts"
import { getPaletteColor } from "./palettes.ts"
import type { Plate, PlateId } from "./layers.ts"
import type { GeomRect } from "./geometry.ts"
import type { TransformMap } from "./distortion.ts"
import type { Pattern } from "./traits.ts"

// Canonical SVG dimensions
const SIZE = 640
const MARGIN = 32
const CELL = 36 // 16 × 36 = 576 = SIZE - 2×MARGIN ✓

function cellToSVG(col: number, row: number): { x: number; y: number } {
  return { x: MARGIN + col * CELL, y: MARGIN + row * CELL }
}

// --- Registration cross-hair marks (used as corner rarity markers) ---
function crosshair(cx: number, cy: number, color: string, size = 10): string {
  const r = 3.5
  return [
    `<line x1="${cx - size}" y1="${cy}" x2="${cx + size}" y2="${cy}" stroke="${color}" stroke-width="0.75"/>`,
    `<line x1="${cx}" y1="${cy - size}" x2="${cx}" y2="${cy + size}" stroke="${color}" stroke-width="0.75"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="0.75"/>`,
  ].join("")
}

function renderCornerMarkers(count: number, color: string): string {
  const pad = 16
  const half = SIZE / 2
  // TL, TR, BL, BR, Center
  const positions = [
    [pad, pad],
    [SIZE - pad, pad],
    [pad, SIZE - pad],
    [SIZE - pad, SIZE - pad],
    [half, half],
  ]
  const markers = positions
    .slice(0, count)
    .map(([x, y]) => crosshair(x, y, color))
    .join("")
  return `<g class="wp-corners">${markers}</g>`
}

// --- Plate block rendering ---
function renderPlate(
  plate: Plate,
  transform: { dx: number; dy: number; angle: number },
  palette: Palette,
  pattern: Pattern,
): string {
  const color = getPaletteColor(palette, plate.id as PlateId)
  const { dx, dy, angle } = transform

  // Inset for small repeated forms so the underlying grid remains visible.
  const inset = pattern === "Grid" || pattern === "Fragments" ? 3 : 0

  const shapes = plate.rects
    .map((geometry: GeomRect) => {
      const { x, y, w, h, shape = "rect" } = geometry
      const sv = cellToSVG(x, y)
      const width = w * CELL - inset * 2
      const height = h * CELL - inset * 2
      const cx = sv.x + (w * CELL) / 2
      const cy = sv.y + (h * CELL) / 2

      if (shape === "circle") {
        return `<circle cx="${cx}" cy="${cy}" r="${Math.max(3, Math.min(width, height) / 2)}" fill="${color}"/>`
      }

      if (shape === "diamond") {
        return `<polygon points="${cx},${sv.y + inset} ${sv.x + w * CELL - inset},${cy} ${cx},${sv.y + h * CELL - inset} ${sv.x + inset},${cy}" fill="${color}"/>`
      }

      if (shape === "hex") {
        const radius = Math.min(width, height) / 2
        const points = Array.from({ length: 6 }, (_, index) => {
          const angle = (Math.PI / 3) * index - Math.PI / 6
          return `${(cx + Math.cos(angle) * radius).toFixed(2)},${(cy + Math.sin(angle) * radius).toFixed(2)}`
        }).join(" ")
        return `<polygon points="${points}" fill="${color}"/>`
      }

      if (shape === "line") {
        return `<line x1="${sv.x}" y1="${cy}" x2="${sv.x + w * CELL}" y2="${cy}" stroke="${color}" stroke-width="${Math.max(4, height * 0.72).toFixed(2)}"/>`
      }

      return `<rect x="${sv.x + inset}" y="${sv.y + inset}" width="${width}" height="${height}" fill="${color}"/>`
    })
    .join("")

  const transformAttr = `translate(${dx.toFixed(2)},${dy.toFixed(2)}) rotate(${angle.toFixed(3)},${SIZE / 2},${SIZE / 2})`

  return `<g transform="${transformAttr}" opacity="${plate.opacity}">${shapes}</g>`
}

// --- Grid overlay (very subtle, printed in K color) ---
function renderGridOverlay(color: string, dark: boolean): string {
  const opacity = dark ? "0.04" : "0.05"
  const lines: string[] = []
  for (let i = 0; i <= 16; i++) {
    const x = MARGIN + i * CELL
    const y = MARGIN + i * CELL
    lines.push(
      `<line x1="${x}" y1="${MARGIN}" x2="${x}" y2="${MARGIN + 576}" stroke="${color}" stroke-width="0.5"/>`,
    )
    lines.push(
      `<line x1="${MARGIN}" y1="${y}" x2="${MARGIN + 576}" y2="${y}" stroke="${color}" stroke-width="0.5"/>`,
    )
  }
  return `<g opacity="${opacity}">${lines.join("")}</g>`
}

// --- Artwork border ---
function renderBorder(color: string): string {
  return `<rect x="${MARGIN}" y="${MARGIN}" width="576" height="576" fill="none" stroke="${color}" stroke-width="0.75" opacity="0.3"/>`
}

// --- Public API ---

export interface SVGInput {
  palette: Palette
  plates: Plate[]
  transforms: TransformMap
  corners: number
  pattern: Pattern
}

export function generateSVG(input: SVGInput): string {
  const { palette, plates, transforms, corners, pattern } = input
  const blend = palette.dark ? "screen" : "multiply"

  // Rotation is owned by the matrix layer (`applyGridRotation` in index.ts),
  // which rotates the 16x16 grid before geometry is derived. The blend group
  // must not rotate again. A previous version of this function injected a bare
  // ` rotate(deg,cx,cy)` token into the <g> tag below; that is not a valid
  // attribute (it has no `=`) and was silently ignored by HTML parsers while
  // being a fatal parse error for strict XML/SVG renderers. Removing it leaves
  // the rendered output unchanged.
  const plateLayers = plates
    .map((plate) =>
      renderPlate(plate, transforms[(plate.id as PlateId)], palette, pattern),
    )
    .join("\n    ")

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}" shape-rendering="crispEdges">
  <rect width="${SIZE}" height="${SIZE}" fill="${palette.bg}"/>
  ${renderGridOverlay(palette.k, palette.dark)}
  <g style="mix-blend-mode:${blend}">
    ${plateLayers}
  </g>
  ${renderBorder(palette.k)}
  ${renderCornerMarkers(corners, palette.k)}
</svg>`
}

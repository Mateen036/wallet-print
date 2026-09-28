import type { Traits } from "./traits.ts"
import { PALETTES } from "./palettes.ts"

export interface TokenMetadata {
  name: string
  description: string
  attributes: Array<{ trait_type: string; value: string | number }>
}

export function buildMetadata(tokenId: number, traits: Traits): TokenMetadata {
  const palette = PALETTES[traits.paletteIndex]
  const rotationLabel = (["0°", "90°", "180°", "270°"] as const)[
    traits.rotations
  ]

  return {
    name: `Wallet Print #${String(tokenId).padStart(4, "0")}`,
    description:
      "A generative print created from the deterministic identity of a blockchain mint. Your participation becomes your image.",
    // Names and order mirror WalletPrint.tokenURI() on-chain. "Seed" is
    // the first on-chain attribute; the UI shows it separately, so it is
    // omitted here.
    attributes: [
      { trait_type: "Palette", value: palette.name },
      { trait_type: "Corners", value: traits.corners },
      { trait_type: "Pattern", value: traits.pattern },
      { trait_type: "Print Mode", value: traits.printMode },
      { trait_type: "Distortion", value: traits.distortion },
      { trait_type: "Rotation", value: rotationLabel },
      { trait_type: "Layers", value: traits.layerCount },
      { trait_type: "Density", value: traits.density },
    ],
  }
}

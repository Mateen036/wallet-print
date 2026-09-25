import type { SeededRandom } from './random';

export type Pattern = 'Grid' | 'Blocks' | 'Stripes' | 'Fragments' | 'Clusters';
export type PrintMode = 'Registered' | 'Offset' | 'Drift' | 'Misaligned';
export type DistortionLevel = 'None' | 'Low' | 'Medium' | 'High';
export type Density = 'Sparse' | 'Light' | 'Medium' | 'Dense';

export interface Traits {
  paletteIndex: number;
  pattern: Pattern;
  printMode: PrintMode;
  distortion: DistortionLevel;
  rotations: number;   // 0–3 × 90°
  layerCount: number;  // 1–4
  density: Density;
  corners: number;     // 1–5
}

const PATTERNS: Pattern[] = ['Grid', 'Blocks', 'Stripes', 'Fragments', 'Clusters'];
const PRINT_MODES: PrintMode[] = ['Registered', 'Offset', 'Drift', 'Misaligned'];
const DISTORTIONS: DistortionLevel[] = ['None', 'Low', 'Medium', 'High'];

export function extractTraits(rng: SeededRandom, activeCells: number, corners: number): Traits {
  const ratio = activeCells / 256;
  let density: Density;
  if (ratio < 0.25) density = 'Sparse';
  else if (ratio < 0.45) density = 'Light';
  else if (ratio < 0.65) density = 'Medium';
  else density = 'Dense';

  return {
    paletteIndex: rng.int(16),
    pattern: PATTERNS[rng.int(5)],
    printMode: PRINT_MODES[rng.int(4)],
    distortion: DISTORTIONS[rng.int(4)],
    rotations: rng.int(4),
    layerCount: rng.int(4) + 1,
    density,
    corners,
  };
}

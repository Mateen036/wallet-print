import type { SeededRandom } from './random';
import type { PlateId } from './layers';
import type { DistortionLevel, PrintMode } from './traits';

export interface PlateTransform {
  dx: number;   // pixel offset X
  dy: number;   // pixel offset Y
  angle: number; // degrees (very small)
}

export type TransformMap = Record<PlateId, PlateTransform>;

const MAGNITUDES: Record<DistortionLevel, { offset: number; angle: number }> = {
  None:   { offset: 0,   angle: 0 },
  Low:    { offset: 2,   angle: 0.15 },
  Medium: { offset: 4,   angle: 0.35 },
  High:   { offset: 8,   angle: 0.65 },
};

const MODE_SCALE: Record<PrintMode, number> = {
  Registered: 0.25,
  Offset:     1.0,
  Drift:      1.5,
  Misaligned: 2.5,
};

export function computeTransforms(
  rng: SeededRandom,
  printMode: PrintMode,
  distortion: DistortionLevel,
): TransformMap {
  const { offset, angle } = MAGNITUDES[distortion];
  const scale = MODE_SCALE[printMode];
  const o = offset * scale;
  const a = angle * scale;

  // For Drift mode, all plates shift in the same general direction with variation
  const driftX = printMode === 'Drift' ? rng.float(-1, 1) : 0;
  const driftY = printMode === 'Drift' ? rng.float(-1, 1) : 0;

  const makeTransform = (): PlateTransform => ({
    dx: rng.float(-o, o) + driftX * o * 0.5,
    dy: rng.float(-o, o) + driftY * o * 0.5,
    angle: rng.float(-a, a),
  });

  return {
    K: { dx: 0, dy: 0, angle: 0 }, // Black is always the reference plate
    C: makeTransform(),
    M: makeTransform(),
    Y: makeTransform(),
  };
}

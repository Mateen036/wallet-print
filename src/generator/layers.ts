import type { GeomRect } from './geometry';

export type PlateId = 'K' | 'C' | 'M' | 'Y';

export interface Plate {
  id: PlateId;
  rects: GeomRect[];
  opacity: number;
}

const PLATE_ORDER: PlateId[] = ['K', 'C', 'M', 'Y'];
const PLATE_OPACITY: Record<PlateId, number> = {
  K: 1.0,
  C: 0.88,
  M: 0.86,
  Y: 0.82,
};

/**
 * Assign geometry to CMYK plates.
 * K receives the largest (most dominant) structures.
 * Remaining plates share the rest in descending area order.
 */
export function assignToPlates(rects: GeomRect[], layerCount: number): Plate[] {
  const activePlates = PLATE_ORDER.slice(0, Math.max(1, layerCount));
  const buckets: Map<PlateId, GeomRect[]> = new Map(activePlates.map(id => [id, []]));

  // Sort descending by area; K gets the largest share
  const sorted = [...rects].sort((a, b) => b.area - a.area);

  // K plate: top ~50% of rects by count (always the dominant layer)
  const kCount = Math.ceil(sorted.length * 0.5);
  sorted.slice(0, kCount).forEach(r => buckets.get('K')!.push(r));

  // Distribute the rest round-robin across C, M, Y
  const rest = sorted.slice(kCount);
  const secondary = activePlates.filter(id => id !== 'K');
  rest.forEach((r, i) => {
    if (secondary.length === 0) {
      buckets.get('K')!.push(r);
    } else {
      buckets.get(secondary[i % secondary.length])!.push(r);
    }
  });

  return activePlates.map(id => ({
    id,
    rects: buckets.get(id)!,
    opacity: PLATE_OPACITY[id],
  }));
}

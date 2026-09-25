export const MAX_SUPPLY = 6767;

export const MINT_SEQUENCE_STEPS = [
  'INITIALIZING',
  'RECEIVING SIGNAL',
  'BUILDING MATRIX',
  '16 × 16',
  'FORMING STRUCTURE',
  'REGISTERING PLATES',
  'PRINTING',
  'COMPLETE',
] as const;

export const RARITY_DISTRIBUTION = {
  1: 4000,
  2: 1700,
  3: 700,
  4: 300,
  5: 67,
} as const;

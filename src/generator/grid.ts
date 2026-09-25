export type Grid = boolean[][];

/** Build a 16×16 binary grid from the first 256 bits (32 bytes) of seed. */
export function buildGrid(seedBytes: Uint8Array): Grid {
  const grid: Grid = [];
  for (let r = 0; r < 16; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < 16; c++) {
      const bitIndex = r * 16 + c;
      const byteIndex = bitIndex >> 3;
      const bitOffset = 7 - (bitIndex & 7);
      row.push(((seedBytes[byteIndex] >> bitOffset) & 1) === 1);
    }
    grid.push(row);
  }
  return grid;
}

/** Count active cells in a grid. */
export function countActiveCells(grid: Grid): number {
  let count = 0;
  for (const row of grid) for (const cell of row) if (cell) count++;
  return count;
}

/** Rotate a grid 90° clockwise. */
export function rotateGrid(grid: Grid): Grid {
  const result: Grid = Array.from({ length: 16 }, () => new Array(16).fill(false));
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      result[c][15 - r] = grid[r][c];
    }
  }
  return result;
}

/** Apply n × 90° clockwise rotations. */
export function applyGridRotation(grid: Grid, rotations: number): Grid {
  let g = grid;
  for (let i = 0; i < rotations; i++) g = rotateGrid(g);
  return g;
}

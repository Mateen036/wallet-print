import type { Grid } from './grid';
import type { Pattern } from './traits';

export type GeomShape = 'rect' | 'circle' | 'diamond' | 'hex' | 'line';

export interface GeomRect {
  x: number; // grid column index [0, 15]
  y: number; // grid row index [0, 15]
  w: number; // width in cells
  h: number; // height in cells
  area: number; // active cells in component (used for sorting)
  shape?: GeomShape;
}

// --- Connected-component extraction ---

function findConnectedComponents(grid: Grid): GeomRect[] {
  const visited = Array.from({ length: 16 }, () => new Array(16).fill(false));
  const rects: GeomRect[] = [];

  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      if (!grid[r][c] || visited[r][c]) continue;

      // BFS
      const cells: [number, number][] = [];
      const queue: [number, number][] = [[r, c]];
      visited[r][c] = true;

      while (queue.length > 0) {
        const [cr, cc] = queue.shift()!;
        cells.push([cr, cc]);
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nr = cr + dr, nc = cc + dc;
          if (nr >= 0 && nr < 16 && nc >= 0 && nc < 16 && grid[nr][nc] && !visited[nr][nc]) {
            visited[nr][nc] = true;
            queue.push([nr, nc]);
          }
        }
      }

      const rows = cells.map(([row]) => row);
      const cols = cells.map(([, col]) => col);
      const minR = Math.min(...rows), maxR = Math.max(...rows);
      const minC = Math.min(...cols), maxC = Math.max(...cols);

      rects.push({
        x: minC, y: minR,
        w: maxC - minC + 1,
        h: maxR - minR + 1,
        area: cells.length,
      });
    }
  }

  return rects.sort((a, b) => b.area - a.area);
}

// --- Pattern-specific geometry builders ---

function buildBlocks(grid: Grid): GeomRect[] {
  // Bounding boxes of all connected components
  return findConnectedComponents(grid);
}

function buildGrid(grid: Grid): GeomRect[] {
  // Each active cell rendered as its own 1×1 rect
  const rects: GeomRect[] = [];
  for (let r = 0; r < 16; r++) {
    for (let c = 0; c < 16; c++) {
      if (grid[r][c]) rects.push({ x: c, y: r, w: 1, h: 1, area: 1, shape: 'circle' });
    }
  }
  return rects;
}

function buildStripes(grid: Grid): GeomRect[] {
  const rects: GeomRect[] = [];
  for (let r = 0; r < 16; r++) {
    const activeCols = grid[r].filter(Boolean).length;
    if (activeCols >= 8) {
      // Full-width horizontal band
      rects.push({ x: 0, y: r, w: 16, h: 1, area: activeCols, shape: 'line' });
    } else if (activeCols >= 3) {
      // Find the span from first to last active col
      let start = -1, end = -1;
      for (let c = 0; c < 16; c++) {
        if (grid[r][c]) {
          if (start === -1) start = c;
          end = c;
        }
      }
      if (start !== -1) {
        rects.push({ x: start, y: r, w: end - start + 1, h: 1, area: activeCols, shape: 'line' });
      }
    }
  }
  return rects;
}

function buildFragments(grid: Grid): GeomRect[] {
  // Like Grid but keeps only isolated cells or very small components
  const components = findConnectedComponents(grid);
  return components.flatMap(comp =>
    comp.area <= 3
      ? [comp]
      : Array.from({ length: Math.min(comp.area, 4) }, (_, i) => ({
          x: (comp.x + i) % 16,
          y: comp.y + Math.floor(i / 8),
          w: 1,
          h: 1,
          area: 1,
          shape: 'diamond',
        }))
  );
}

function buildClusters(grid: Grid): GeomRect[] {
  // Keep only the N largest components
  const components = findConnectedComponents(grid);
  const minArea = components.length > 4 ? components[Math.floor(components.length * 0.4)].area : 1;
  return components
    .filter(c => c.area >= Math.max(4, minArea))
    .map(c => ({ ...c, shape: 'hex' as const }));
}

// --- Public dispatcher ---

export function buildGeometry(grid: Grid, pattern: Pattern): GeomRect[] {
  switch (pattern) {
    case 'Blocks':    return buildBlocks(grid);
    case 'Grid':      return buildGrid(grid);
    case 'Stripes':   return buildStripes(grid);
    case 'Fragments': return buildFragments(grid);
    case 'Clusters':  return buildClusters(grid);
  }
}

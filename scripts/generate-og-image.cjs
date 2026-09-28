#!/usr/bin/env node
/**
 * Generates public/og-image.png (1200x630) for social/link previews.
 *
 * Dependency-free: the PNG is encoded with Node's zlib, and the artwork comes
 * from the real generator pipeline (loaded through a TypeScript transpile hook)
 * so the social card shows an authentic engine output rather than a mock-up.
 *
 * Regenerate with: npm run og
 *
 * Scope: rasterises the plate geometry as rectangles (circles for the patterns
 * that use them). It does not reproduce CMYK blend modes or the registration
 * cross-hairs, and it renders no text — replace the PNG with a design-tool
 * export if you want a wordmark.
 */
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText,
    filename,
  );

const root = path.resolve(__dirname, '..');
const load = modulePath => require(path.join(root, 'src/generator', modulePath));

const { parseSeed, seedFromTokenId } = load('hash.ts');
const { buildGrid, applyGridRotation } = load('grid.ts');
const { buildGeometry } = load('geometry.ts');
const { assignToPlates } = load('layers.ts');
const { computeTransforms } = load('distortion.ts');
const { computeCorners } = load('rarity.ts');
const { extractTraits } = load('traits.ts');
const { SeededRandom } = load('random.ts');
const { PALETTES } = load('palettes.ts');

// --- output + geometry constants (mirror src/generator/svg.ts) ---
const W = 1200;
const H = 630;
const ART = 486;                    // rendered print size in pixels
const SVG_SIZE = 640;               // engine viewBox
const MARGIN = 32;
const CELL = 36;
const SCALE = ART / SVG_SIZE;
const OFFSET_X = (W - ART) / 2;
const OFFSET_Y = (H - ART) / 2;
const BG = [0x10, 0x13, 0x11];      // site background

const toRgb = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];

function createCanvas() {
  const px = Buffer.alloc(W * H * 3);
  for (let i = 0; i < px.length; i += 3) {
    px[i] = BG[0];
    px[i + 1] = BG[1];
    px[i + 2] = BG[2];
  }
  return px;
}

function setPixel(px, x, y, rgb, alpha = 1) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = Math.round(px[i] * (1 - alpha) + rgb[0] * alpha);
  px[i + 1] = Math.round(px[i + 1] * (1 - alpha) + rgb[1] * alpha);
  px[i + 2] = Math.round(px[i + 2] * (1 - alpha) + rgb[2] * alpha);
}

function fillRect(px, x, y, w, h, rgb, alpha = 1) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) setPixel(px, xx, yy, rgb, alpha);
  }
}

function fillCircle(px, cx, cy, r, rgb, alpha = 1) {
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx;
      const dy = yy - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(px, xx, yy, rgb, alpha);
    }
  }
}

/** Registration cross-hair, mirroring crosshair() in svg.ts. */
function drawCrosshair(px, cx, cy, rgb) {
  const arm = 10 * SCALE;
  const radius = 3.5 * SCALE;
  for (let i = -arm; i <= arm; i += 0.5) {
    setPixel(px, Math.round(cx + i), Math.round(cy), rgb, 0.55);
    setPixel(px, Math.round(cx), Math.round(cy + i), rgb, 0.55);
  }
  for (let yy = Math.floor(cy - radius); yy <= Math.ceil(cy + radius); yy++) {
    for (let xx = Math.floor(cx - radius); xx <= Math.ceil(cx + radius); xx++) {
      const d = Math.hypot(xx - cx, yy - cy);
      if (Math.abs(d - radius) <= 0.6) setPixel(px, xx, yy, rgb, 0.55);
    }
  }
}
// --- engine pipeline (mirrors src/generator/index.ts) ---
function buildArtwork(tokenId) {
  const seed = seedFromTokenId(tokenId);
  const rng = new SeededRandom(parseSeed(seed));
  const corners = computeCorners(rng);
  const traits = extractTraits(rng, corners);
  const grid = applyGridRotation(buildGrid(parseSeed(seed)), traits.rotations);
  const geometry = buildGeometry(grid, traits.pattern);
  const plates = assignToPlates(geometry, traits.layerCount);
  const transforms = computeTransforms(rng, traits.printMode, traits.distortion);
  return { traits, plates, transforms, palette: PALETTES[traits.paletteIndex], corners };
}

const PLATE_KEY = { K: 'k', C: 'c', M: 'm', Y: 'y' };

function render(tokenId) {
  const art = buildArtwork(tokenId);
  const px = createCanvas();
  const s = v => v * SCALE;

  // The engine paints the palette's own background across the art box
  // (`<rect width height fill=palette.bg>` in svg.ts). Reproduce it, otherwise a
  // light-palette print renders dark ink straight onto the dark page and the
  // card looks empty.
  const paper = toRgb(art.palette.bg);
  const boxSize = Math.round(ART);
  fillRect(px, Math.round(OFFSET_X), Math.round(OFFSET_Y), boxSize, boxSize, paper, 1);

  for (const plate of art.plates) {
    const rgb = toRgb(art.palette[PLATE_KEY[plate.id]]);
    const transform = art.transforms[plate.id];
    for (const rect of plate.rects) {
      const x = OFFSET_X + s(MARGIN + rect.x * CELL + transform.dx);
      const y = OFFSET_Y + s(MARGIN + rect.y * CELL + transform.dy);
      const w = s(rect.w * CELL);
      const h = s(rect.h * CELL);
      if (rect.shape === 'circle') {
        fillCircle(px, x + w / 2, y + h / 2, Math.max(2, Math.min(w, h) / 2), rgb, 0.92);
      } else {
        fillRect(px, x, y, w, h, rgb, 0.92);
      }
    }
  }

  // Registration border, mirroring renderBorder() in svg.ts.
  const inset = s(MARGIN);
  const span = s(576);
  const borderRgb = toRgb(art.palette.k);
  for (let i = 0; i <= span; i++) {
    const bx = Math.round(OFFSET_X + inset + i);
    const by = Math.round(OFFSET_Y + inset + i);
    setPixel(px, bx, Math.round(OFFSET_Y + inset), borderRgb, 0.3);
    setPixel(px, bx, Math.round(OFFSET_Y + inset + span), borderRgb, 0.3);
    setPixel(px, Math.round(OFFSET_X + inset), by, borderRgb, 0.3);
    setPixel(px, Math.round(OFFSET_X + inset + span), by, borderRgb, 0.3);
  }

  // Registration cross-hairs (rarity markers), mirroring renderCornerMarkers().
  const pad = 16;
  const markPositions = [
    [pad, pad],
    [SVG_SIZE - pad, pad],
    [pad, SVG_SIZE - pad],
    [SVG_SIZE - pad, SVG_SIZE - pad],
    [SVG_SIZE / 2, SVG_SIZE / 2],
  ].slice(0, art.traits.corners);
  for (const [mx, my] of markPositions) {
    drawCrosshair(px, OFFSET_X + s(mx), OFFSET_Y + s(my), borderRgb);
  }

  let painted = 0;
  for (let i = 0; i < px.length; i += 3) {
    if (px[i] !== BG[0] || px[i + 1] !== BG[1] || px[i + 2] !== BG[2]) painted++;
  }

  // Ink coverage inside the art box — the metric that actually describes how
  // busy the print is, since the paper fill makes whole-image coverage constant.
  let ink = 0;
  const boxTotal = boxSize * boxSize;
  const x0 = Math.round(OFFSET_X);
  const y0 = Math.round(OFFSET_Y);
  for (let y = y0; y < y0 + boxSize; y++) {
    for (let x = x0; x < x0 + boxSize; x++) {
      const i = (y * W + x) * 3;
      if (px[i] !== paper[0] || px[i + 1] !== paper[1] || px[i + 2] !== paper[2]) ink++;
    }
  }

  return {
    px,
    coverage: painted / (W * H),
    inkCoverage: ink / boxTotal,
    traits: art.traits,
    colors: {
      bg: paper,
      K: toRgb(art.palette.k),
      C: toRgb(art.palette.c),
      M: toRgb(art.palette.m),
      Y: toRgb(art.palette.y),
    },
  };
}

// Pick a deterministic token that makes a well-composed card.
// Pattern shape dominates how the card reads: 'Blocks' merges into one blob and
// 'Stripes' into full-width bars, while 'Grid' (a circle per active cell) best
// represents the 16x16 matrix that is the engine's premise. So: find the best
// candidate within each pattern by coverage, then prefer patterns in order.
const PATTERN_ORDER = ['Grid', 'Clusters', 'Fragments', 'Blocks', 'Stripes'];
const COMFORTABLE_COVERAGE = [0.08, 0.45];

function pickToken() {
  const byPattern = new Map();
  for (let id = 1; id <= 64; id++) {
    const candidate = render(id);
    const list = byPattern.get(candidate.traits.pattern) ?? [];
    list.push({ id, ...candidate });
    byPattern.set(candidate.traits.pattern, list);
  }

  for (const list of byPattern.values()) {
    list.sort((a, b) => Math.abs(a.inkCoverage - 0.25) - Math.abs(b.inkCoverage - 0.25));
  }

  for (const pattern of PATTERN_ORDER) {
    const comfortable = (byPattern.get(pattern) ?? []).find(
      c => c.inkCoverage >= COMFORTABLE_COVERAGE[0] && c.inkCoverage <= COMFORTABLE_COVERAGE[1],
    );
    if (comfortable) return comfortable;
  }

  return [...byPattern.values()].flat().sort(
    (a, b) => Math.abs(a.inkCoverage - 0.25) - Math.abs(b.inkCoverage - 0.25),
  )[0];
}
// --- minimal PNG encoder (8-bit RGB, no dependencies) ---
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

function encodePng(px) {
  const stride = 1 + W * 3;
  const raw = Buffer.alloc(H * stride);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none
    px.copy(raw, y * stride + 1, y * W * 3, (y + 1) * W * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- verification: decode the PNG back and inspect real pixels ---
function readUint32(buf, offset) {
  return ((buf[offset] << 24) | (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]) >>> 0;
}

function verifyPng(png) {
  const problems = [];
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((b, i) => png[i] === b)) problems.push('bad PNG signature');

  let offset = 8;
  let width = 0;
  let height = 0;
  const idat = [];

  while (offset < png.length) {
    const length = readUint32(png, offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const data = png.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      if (data[8] !== 8) problems.push(`bit depth ${data[8]}`);
      if (data[9] !== 2) problems.push(`colour type ${data[9]}`);
    }
    if (type === 'IDAT') idat.push(data);
    offset += 12 + length;
  }

  if (width !== W) problems.push(`width ${width} != ${W}`);
  if (height !== H) problems.push(`height ${height} != ${H}`);

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = 1 + W * 3;
  if (raw.length !== H * stride) problems.push(`raw length ${raw.length} != ${H * stride}`);

  // Count background vs painted pixels straight out of the decoded scanlines.
  let painted = 0;
  const seen = new Set();
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * stride + 1 + x * 3;
      const r = raw[i];
      const g = raw[i + 1];
      const b = raw[i + 2];
      seen.add((r << 16) | (g << 8) | b);
      if (r !== BG[0] || g !== BG[1] || b !== BG[2]) painted++;
    }
  }
  if (painted === 0) problems.push('image is entirely background');

  return { problems, decodedCoverage: painted / (W * H), distinctColours: seen.size };
}

// --- verification: coarse ASCII preview so the composition is inspectable ---
function asciiPreview(px, colors) {
  const cols = 72;
  const rows = 22;
  const palette = [
    { ch: ' ', rgb: BG },
    { ch: '.', rgb: colors.bg },
    { ch: '#', rgb: colors.K },
    { ch: 'c', rgb: colors.C },
    { ch: 'm', rgb: colors.M },
    { ch: 'y', rgb: colors.Y },
  ];
  const lines = [];
  for (let row = 0; row < rows; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const x = Math.floor((col + 0.5) * (W / cols));
      const y = Math.floor((row + 0.5) * (H / rows));
      const i = (y * W + x) * 3;
      let best = palette[0];
      let bestDistance = Infinity;
      for (const entry of palette) {
        const d = (px[i] - entry.rgb[0]) ** 2 + (px[i + 1] - entry.rgb[1]) ** 2 + (px[i + 2] - entry.rgb[2]) ** 2;
        if (d < bestDistance) {
          bestDistance = d;
          best = entry;
        }
      }
      line += best.ch;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

// --- generate ---
const best = pickToken();
const png = encodePng(best.px);
const outPath = path.join(root, 'public', 'og-image.png');
fs.writeFileSync(outPath, png);

console.log(`wrote ${path.relative(root, outPath)} (${W}x${H}, ${(png.length / 1024).toFixed(1)} KiB)`);
console.log(`token #${best.id} | pattern=${best.traits.pattern} palette=${best.traits.paletteIndex} ` +
  `density=${best.traits.density} layers=${best.traits.layerCount} print=${best.traits.printMode} ` +
  `distortion=${best.traits.distortion} corners=${best.traits.corners}`);
console.log(`whole-image coverage=${(best.coverage * 100).toFixed(1)}% | ink coverage=${(best.inkCoverage * 100).toFixed(1)}%`);

const check = verifyPng(png);
console.log(`verified: ${check.distinctColours} distinct colours, decoded coverage ${(check.decodedCoverage * 100).toFixed(1)}%`);
console.log('\npreview (space = bg, . = paper, # = key plate, c/m/y = colour plates):');
console.log(asciiPreview(best.px, best.colors));

for (const problem of check.problems) console.error(`FAIL: ${problem}`);
if (check.problems.length) process.exitCode = 1;
if (best.coverage < 0.25 || best.coverage > 0.6) {
  console.error('FAIL: whole-image coverage outside 25%-60%');
  process.exitCode = 1;
}
if (best.inkCoverage < 0.05 || best.inkCoverage > 0.6) {
  console.error('FAIL: ink coverage outside 5%-60%');
  process.exitCode = 1;
}
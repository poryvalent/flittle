import { drawMascot } from './arcade-art.js';

// The final attack assembles the same pixel mascot used by the games before it
// grows into the existing homepage mascot, without another image load.
const PALETTES = {
  shooter: ['#bda8ff', '#8de6e5'], dodge: ['#c9ff73', '#8de6e5'],
  breakout: ['#ffbf91', '#ffe7a0'], flappy: ['#8de6e5', '#b7e0ff'],
  runner: ['#c9ff73', '#ffe7a0']
};
const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => value * value * (3 - 2 * value);
const random = i => { const n = Math.sin(i * 127.1 + 38.2) * 43758.5453; return n - Math.floor(n); };
// Read the silhouette through the long-standing drawing API. Cached sprite
// modules stay compatible; a new named export must not prevent arcade startup.
const MASCOT_PIXELS = (() => {
  const sample = document.createElement('canvas');
  sample.width = sample.height = 24;
  const brush = sample.getContext('2d', { willReadFrequently: true });
  if (!brush) throw new Error('The mascot silhouette canvas is unavailable.');
  drawMascot(brush, 12, 12, 24);
  const data = brush.getImageData(0, 0, 24, 24).data;
  return Array.from({ length: 24 }, (_, y) => Array.from({ length: 24 }, (_, x) =>
    data[(y * 24 + x) * 4 + 3] ? 'B' : '.').join(''));
})();
const filled = (x, y) => Boolean(MASCOT_PIXELS[y]?.[x] && MASCOT_PIXELS[y][x] !== '.');

// Trace the exterior of the bitmap once. Each edge follows an occupied pixel
// clockwise; removing collinear corners keeps the animated clip path small.
function traceMascot() {
  const edges = new Map();
  const add = (x, y, nx, ny) => edges.set(`${x},${y}`, [nx, ny]);
  MASCOT_PIXELS.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel === '.') return;
    if (!filled(x, y - 1)) add(x, y, x + 1, y);
    if (!filled(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!filled(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!filled(x - 1, y)) add(x, y + 1, x, y);
  }));
  const start = edges.keys().next().value;
  const points = [];
  let key = start;
  do {
    points.push(key.split(',').map(Number));
    key = edges.get(key).join(',');
  } while (key !== start && points.length <= edges.size);
  return points.filter((point, i) => {
    const prev = points[(i + points.length - 1) % points.length];
    const next = points[(i + 1) % points.length];
    return (point[0] - prev[0]) * (next[1] - point[1]) !== (point[1] - prev[1]) * (next[0] - point[0]);
  });
}
const contour = traceMascot();
export const arcadeMascotSize = (width, height) => Math.round(Math.max(120, Math.min(240, Math.min(width, height) * .24)) / 24) * 24;

export function drawArcadePortal(ctx, width, height, progress, kind, source) {
  const p = clamp(progress);
  if (!p) return;
  const [color, secondary] = PALETTES[kind] || PALETTES.dodge;
  const unit = Math.min(width, height);
  const cx = width * .5, cy = height * .5;
  const build = smooth(clamp(p / .72));
  const size = arcadeMascotSize(width, height) * (.28 + .72 * build);
  const outline = scale => {
    ctx.beginPath();
    contour.forEach(([x, y], i) => {
      const px = cx + (x - 12) / 24 * size * scale;
      const py = cy + (y - 12) / 24 * size * scale;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.closePath();
  };

  ctx.save();
  // Attack fragments return to the mascot's ears, face and feet.
  for (let i = 0; i < 48; i++) {
    const delay = random(i + 8) * .18;
    const q = clamp((p - delay) / (.76 - delay));
    if (!q || q === 1) continue;
    const angle = i / 48 * Math.PI * 2;
    const reach = unit * (.28 + random(i + 31) * .38);
    const fromX = i % 3 === 0 && source ? source.x : cx + Math.cos(angle) * reach;
    const fromY = i % 3 === 0 && source ? source.y : cy + Math.sin(angle) * reach;
    const edge = contour[Math.floor(i / 48 * contour.length)];
    const travel = 1 - Math.pow(1 - q, 3);
    const bow = Math.sin(q * Math.PI) * unit * .08;
    const x = fromX + (cx + (edge[0] - 12) / 24 * size - fromX) * travel + Math.sin(angle) * bow;
    const y = fromY + (cy + (edge[1] - 12) / 24 * size - fromY) * travel - Math.cos(angle) * bow;
    const block = 2 + random(i) * 4;
    ctx.globalAlpha = Math.sin(q * Math.PI) * .85;
    ctx.fillStyle = i % 3 ? color : secondary;
    ctx.fillRect(Math.round(x), Math.round(y), block, block);
  }

  // A stepped halo traces the ears and paws rather than placing them in a box.
  ctx.lineJoin = 'miter';
  for (const [line, alpha] of [[9, .055], [4, .2], [1.5, .75]]) {
    ctx.globalAlpha = build * alpha * (1 - smooth(clamp((p - .8) / .2))); ctx.lineWidth = line;
    ctx.strokeStyle = color; outline(1.12); ctx.stroke();
  }
  ctx.globalAlpha = smooth(clamp(p / .48));
  drawMascot(ctx, cx, cy, size);

  // One soft pixel scan finishes the assembly, leaving the blue coat/gold eyes clear.
  const scan = clamp((p - .22) / .64);
  if (scan > 0 && scan < 1) {
    ctx.save(); outline(1); ctx.clip();
    ctx.globalAlpha = Math.sin(scan * Math.PI) * .3;
    ctx.fillStyle = '#edffff';
    ctx.fillRect(cx - size / 2, cy - size / 2 + scan * size, size, Math.max(2, size / 12));
    ctx.restore();
  }
  ctx.restore();
}

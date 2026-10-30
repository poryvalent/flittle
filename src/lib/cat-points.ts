/**
 * Turns the cat in Flittle's logo into a cloud of points for the bust
 * renderer. The cut-out wordmark is sampled where it is opaque, each point
 * keeps the colour it was sampled from, and a chamfer distance to the
 * silhouette's edge gives the flat drawing a puffy depth, so the cat reads as
 * a soft body rather than a sheet when it turns toward the pointer.
 */
export type CatPoints = { pos: Float32Array; col: Float32Array };

// Where the cat sits inside /logo-mark.png (2036 x 720), with a little margin.
const CROP = { x: 735, y: 30, w: 626, h: 670 };
const DEPTH = 0.16; // thickest point of the body, as a share of the cat's height
const SUN: [number, number, number] = [0.961, 0.867, 0.431];

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });

export async function sampleCat(src: string, n: number): Promise<CatPoints> {
  const img = await loadImage(src);
  const S = 0.55; // about 344 x 368 cells: fine enough for the silhouette, cheap to scan
  const w = Math.round(CROP.w * S), h = Math.round(CROP.h * S);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, CROP.x, CROP.y, CROP.w, CROP.h, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;

  const inside = new Uint8Array(w * h);
  const idx: number[] = [];
  let minX = w, maxX = 0, minY = h, maxY = 0;
  for (let i = 0; i < w * h; i++) {
    if (d[i * 4 + 3] > 128) {
      inside[i] = 1;
      idx.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Two-pass chamfer distance (3-4 weights) from every inside cell to the nearest outside cell.
  const INF = 1e9;
  const dist = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) dist[i] = inside[i] ? INF : 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!inside[i]) continue;
      dist[i] = Math.min(dist[i], dist[i - 1] + 3, dist[i - w] + 3, dist[i - w - 1] + 4, dist[i - w + 1] + 4);
    }
  }
  for (let y = h - 2; y > 0; y--) {
    for (let x = w - 2; x > 0; x--) {
      const i = y * w + x;
      if (!inside[i]) continue;
      dist[i] = Math.min(dist[i], dist[i + 1] + 3, dist[i + w] + 3, dist[i + w - 1] + 4, dist[i + w + 1] + 4);
    }
  }
  let maxD = 1;
  for (const i of idx) if (dist[i] < INF && dist[i] > maxD) maxD = dist[i];

  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, H = Math.max(1, maxY - minY + 1);
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const i = idx[(Math.random() * idx.length) | 0];
    const x = (i % w) + Math.random() - 0.5, y = ((i / w) | 0) + Math.random() - 0.5;
    const puff = Math.sqrt(Math.min(1, dist[i] / maxD));
    const z = (Math.random() < 0.5 ? -1 : 1) * puff * DEPTH * (0.35 + 0.65 * Math.random());
    pos[k * 3] = (x - cx) / H;
    pos[k * 3 + 1] = -(y - cy) / H;
    pos[k * 3 + 2] = z;
    let r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    // The pale insides of the ears would vanish against the page, so warm them toward the sun yellow.
    if (0.2126 * r + 0.7152 * g + 0.0722 * b > 0.86) {
      r += (SUN[0] - r) * 0.55;
      g += (SUN[1] - g) * 0.55;
      b += (SUN[2] - b) * 0.55;
    }
    col[k * 3] = r;
    col[k * 3 + 1] = g;
    col[k * 3 + 2] = b;
  }
  return { pos, col };
}

import { PROJECTS, type CoverKind, type Field, type Project } from "./projects";

/**
 * Generated cover art for the sample projects: an abstract product screen (a
 * browser window, a dashboard, a phone…) sitting on a coloured field, drawn
 * as a small SVG and served as a blob URL. It is vector, so one cover is crisp
 * as a sphere card, a grid tile and the lightbox plate alike. Everything is
 * deterministic per project, so the art never changes between visits.
 */

type Tone = { bg: [string, string]; glow: string; panel: string; ink: string; accent: string; accent2: string; light: boolean };
const TONES: Record<Field, Tone> = {
  lilac: { bg: ["#241c36", "#4a3a6e"], glow: "#a785c9", panel: "#f4f4f2", ink: "#272b2e", accent: "#f5dd6e", accent2: "#a785c9", light: false },
  mint: { bg: ["#12302e", "#2a5d58"], glow: "#bfe6e2", panel: "#f4f4f2", ink: "#272b2e", accent: "#f5dd6e", accent2: "#bfe6e2", light: false },
  sun: { bg: ["#3b3212", "#7d6a26"], glow: "#f5dd6e", panel: "#f4f4f2", ink: "#272b2e", accent: "#a785c9", accent2: "#f5dd6e", light: false },
  charcoal: { bg: ["#17191c", "#34393e"], glow: "#8e8f8c", panel: "#f4f4f2", ink: "#272b2e", accent: "#bfe6e2", accent2: "#f5dd6e", light: false },
  paper: { bg: ["#f1eee6", "#d6d1c4"], glow: "#ffffff", panel: "#272b2e", ink: "#f4f4f2", accent: "#f5dd6e", accent2: "#a785c9", light: true },
  lavender: { bg: ["#ebe4f4", "#c6b4de"], glow: "#ffffff", panel: "#272b2e", ink: "#f4f4f2", accent: "#f5dd6e", accent2: "#bfe6e2", light: true },
};

type Rng = () => number;
const mulberry = (seed: number): Rng => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const f = (n: number) => Math.round(n * 10) / 10;
const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, o = 1) =>
  `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}"${o < 1 ? ` fill-opacity="${o}"` : ""}/>`;
const line = (x: number, y: number, w: number, h: number, fill: string, o: number) => rect(x, y, w, h, h / 2, fill, o);
const dot = (cx: number, cy: number, r: number, fill: string, o = 1) =>
  `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}"${o < 1 ? ` fill-opacity="${o}"` : ""}/>`;

type Area = { x: number; y: number; w: number; h: number; t: Tone; rnd: Rng };

/** Sidebar, a heading, a primary button and a table of rows. */
function browser({ x, y, w, h, t, rnd }: Area) {
  let s = rect(x, y, w * 0.22, h, 0, t.ink, 0.06);
  for (let i = 0; i < 7; i++) s += line(x + 28, y + 40 + i * 44, w * 0.22 * (0.45 + rnd() * 0.35), 12, t.ink, i === 1 ? 0.85 : 0.3);
  const mx = x + w * 0.22 + 40, mw = w - w * 0.22 - 80;
  s += line(mx, y + 42, mw * 0.3, 18, t.ink, 0.9);
  s += rect(x + w - 190, y + 34, 130, 36, 18, t.accent);
  const rows = Math.floor((h - 130) / 56);
  for (let i = 0; i < rows; i++) {
    const ry = y + 116 + i * 56;
    s += rect(mx, ry + 44, mw, 1, 0, t.ink, 0.12);
    s += dot(mx + 14, ry + 16, 14, i % 3 === 0 ? t.accent2 : t.ink, i % 3 === 0 ? 1 : 0.16);
    s += line(mx + 46, ry + 10, mw * (0.22 + rnd() * 0.16), 12, t.ink, 0.6);
    s += line(mx + mw * 0.56, ry + 10, mw * (0.1 + rnd() * 0.12), 12, t.ink, 0.3);
    s += rect(mx + mw - 76, ry + 6, 76, 20, 10, t.ink, 0.1);
  }
  return s;
}

/** A marketing page: two-line headline, copy, a button, a picture, three columns. */
function site({ x, y, w, h, t, rnd }: Area) {
  let s = line(x + 60, y + 72, w * 0.42, 34, t.ink, 0.9) + line(x + 60, y + 120, w * 0.3, 34, t.ink, 0.9);
  s += line(x + 60, y + 180, w * 0.38, 12, t.ink, 0.4) + line(x + 60, y + 204, w * 0.26, 12, t.ink, 0.4);
  s += rect(x + 60, y + 244, 150, 40, 20, t.accent);
  s += rect(x + w * 0.58, y + 60, w * 0.38, 236, 16, t.accent2, 0.9);
  s += dot(x + w * 0.58 + w * 0.38 * 0.68, y + 60 + 236 * 0.36, 44, t.panel, 0.55);
  const cy = y + 352, cw = (w - 120 - 56) / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x + 60 + i * (cw + 28);
    s += rect(cx, cy, cw, Math.min(160, h - 420), 12, t.ink, 0.1);
    s += line(cx, cy + 184, cw * (0.5 + rnd() * 0.3), 14, t.ink, 0.7);
    s += line(cx, cy + 210, cw * (0.7 + rnd() * 0.25), 10, t.ink, 0.3);
  }
  return s;
}

/** Three stat tiles over a line chart. */
function dash({ x, y, w, h, t, rnd }: Area) {
  let s = line(x + 40, y + 36, w * 0.18, 16, t.ink, 0.9);
  s += rect(x + w - 250, y + 28, 100, 32, 16, t.ink, 0.1) + rect(x + w - 140, y + 28, 100, 32, 16, t.accent);
  const tw = (w - 80 - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const tx = x + 40 + i * (tw + 20);
    s += rect(tx, y + 90, tw, 112, 14, t.ink, 0.08);
    s += line(tx + 22, y + 112, tw * 0.4, 10, t.ink, 0.4);
    s += line(tx + 22, y + 144, tw * (0.3 + rnd() * 0.3), 28, t.ink, i === 1 ? 0.9 : 0.75);
  }
  const cx = x + 40, cy = y + 232, cw = w - 80, ch = Math.max(180, h - 270);
  s += rect(cx, cy, cw, ch, 14, t.ink, 0.06);
  for (let j = 0; j < 4; j++) s += rect(cx + 24, cy + 32 + j * ((ch - 64) / 3), cw - 48, 1, 0, t.ink, 0.12);
  const n = 9, pts: [number, number][] = [];
  let v = 0.55;
  for (let i = 0; i < n; i++) {
    v = Math.min(0.9, Math.max(0.12, v + (rnd() - 0.42) * 0.28));
    pts.push([cx + 24 + ((cw - 48) * i) / (n - 1), cy + 32 + (ch - 64) * (1 - v)]);
  }
  const path = pts.map(([px, py], i) => `${i ? "L" : "M"}${f(px)} ${f(py)}`).join(" ");
  s += `<path d="${path} L${f(cx + cw - 24)} ${f(cy + ch - 32)} L${f(cx + 24)} ${f(cy + ch - 32)} Z" fill="${t.accent}" fill-opacity=".14"/>`;
  s += `<path d="${path}" fill="none" stroke="${t.accent}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  const [lx, ly] = pts[n - 2];
  s += dot(lx, ly, 9, t.panel) + dot(lx, ly, 5, t.accent);
  return s;
}

/** Systems joined up: five nodes and the connections between them. */
function flow({ x, y, w, h, t }: Area) {
  const nw = w * 0.2, nh = 68;
  const col = [x + w * 0.1, x + w * 0.5 - nw / 2, x + w * 0.9 - nw];
  const nodes: [number, number, boolean][] = [
    [col[0], y + h * 0.26, false], [col[0], y + h * 0.62, false],
    [col[1], y + h * 0.44, true],
    [col[2], y + h * 0.22, false], [col[2], y + h * 0.66, false],
  ];
  const mid = (n: [number, number, boolean], side: 1 | -1) => [n[0] + (side > 0 ? nw : 0), n[1] + nh / 2] as const;
  let s = "";
  const wire = (a: readonly [number, number], b: readonly [number, number]) => {
    const dx = (b[0] - a[0]) / 2;
    s += `<path d="M${f(a[0])} ${f(a[1])} C${f(a[0] + dx)} ${f(a[1])} ${f(b[0] - dx)} ${f(b[1])} ${f(b[0])} ${f(b[1])}" fill="none" stroke="${t.ink}" stroke-opacity=".3" stroke-width="3"/>`;
  };
  wire(mid(nodes[0], 1), mid(nodes[2], -1)); wire(mid(nodes[1], 1), mid(nodes[2], -1));
  wire(mid(nodes[2], 1), mid(nodes[3], -1)); wire(mid(nodes[2], 1), mid(nodes[4], -1));
  for (const [nx, ny, hot] of nodes) {
    s += rect(nx, ny, nw, nh, 16, hot ? t.accent : t.ink, hot ? 1 : 0.1);
    s += dot(nx + 30, ny + nh / 2, 12, hot ? "#272b2e" : t.accent2, hot ? 0.8 : 1);
    s += line(nx + 54, ny + nh / 2 - 6, nw * 0.5, 12, hot ? "#272b2e" : t.ink, hot ? 0.75 : 0.55);
  }
  s += dot(x + w * 0.5, y + h * 0.44 - 26, 6, t.accent2) + dot(x + w * 0.5, y + h * 0.44 + nh + 26, 6, t.accent2, 0.6);
  return s;
}

/** A phone screen: greeting, a hero card, a list, a tab bar. */
function phone({ x, y, w, h, t }: Area) {
  const ink = "#272b2e";
  let s = line(x + 30, y + 26, 54, 10, ink, 0.6) + rect(x + w - 78, y + 26, 48, 10, 5, ink, 0.6);
  s += line(x + 30, y + 86, w * 0.52, 22, ink, 0.9) + line(x + 30, y + 122, w * 0.36, 12, ink, 0.4);
  s += rect(x + 30, y + 162, w - 60, 176, 20, t.light ? t.accent : t.accent2);
  s += line(x + 56, y + 190, w * 0.38, 14, ink, 0.7) + line(x + 56, y + 216, w * 0.26, 10, ink, 0.45);
  s += line(x + 56, y + 284, w * 0.3, 26, ink, 0.85) + rect(x + w - 128, y + 282, 70, 30, 15, ink, 0.8);
  for (let i = 0; i < 5; i++) {
    const ry = y + 372 + i * 92;
    s += rect(x + 30, ry, w - 60, 74, 16, ink, 0.07);
    s += dot(x + 66, ry + 37, 18, i === 1 ? t.accent : ink, i === 1 ? 1 : 0.18);
    s += line(x + 100, ry + 22, w * 0.4, 12, ink, 0.7) + line(x + 100, ry + 46, w * 0.26, 10, ink, 0.35);
  }
  s += rect(x, y + h - 92, w, 92, 0, ink, 0.06);
  for (let i = 0; i < 4; i++) s += dot(x + w * (0.16 + i * 0.227), y + h - 50, 9, ink, i === 0 ? 0.85 : 0.25);
  return s;
}

const DRAW: Record<Exclude<CoverKind, "phone">, (a: Area) => string> = { browser, site, dash, flow };

export function coverSVG(p: Project, i: number): string {
  const t = TONES[p.field], rnd = mulberry(i * 7919 + 17);
  const W = p.tall ? 800 : 1200, H = p.tall ? 1000 : 800;
  const defs =
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset="1" stop-color="${t.bg[1]}"/></linearGradient>` +
    `<radialGradient id="r" cx=".18" cy=".08" r=".95"><stop offset="0" stop-color="${t.glow}" stop-opacity="${t.light ? ".9" : ".34"}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>` +
    `<filter id="b" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="34"/></filter>` +
    `<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter></defs>`;
  let body = `<rect width="${W}" height="${H}" fill="url(#g)"/><rect width="${W}" height="${H}" fill="url(#r)"/>`;
  body += `<circle cx="${f(W * 0.82)}" cy="${f(H * 0.16)}" r="${f(W * 0.22)}" fill="${t.accent2}" fill-opacity="${t.light ? ".35" : ".22"}" filter="url(#b)"/>`;

  if (p.tall) {
    const px = 170, py = 112, pw = 460, ph = 980, r = 64;
    body += rect(px + 10, py + 50, pw, ph, r, "#000", t.light ? 0.28 : 0.55).replace("/>", ' filter="url(#s)"/>');
    body += rect(px, py, pw, ph, r, "#272b2e");
    body += rect(px + 2, py + 2, pw - 4, ph - 4, r - 2, "#3a3f44", 0.6);
    const sx = px + 16, sy = py + 16, sw = pw - 32, sh = ph - 32;
    body += `<clipPath id="c"><rect x="${sx}" y="${sy}" width="${sw}" height="${sh}" rx="${r - 16}"/></clipPath>`;
    body += `<g clip-path="url(#c)">${rect(sx, sy, sw, sh, 0, "#f4f4f2")}${phone({ x: sx, y: sy, w: sw, h: sh, t, rnd })}</g>`;
    body += rect(px + pw / 2 - 60, py + 28, 120, 34, 17, "#272b2e");
  } else {
    const px = 150, py = 122, pw = 1130, ph = 760, r = 22;
    body += rect(px + 16, py + 44, pw, ph, r, "#000", t.light ? 0.26 : 0.55).replace("/>", ' filter="url(#s)"/>');
    body += `<clipPath id="c"><rect x="${px}" y="${py}" width="${pw}" height="${ph}" rx="${r}"/></clipPath>`;
    body += `<g clip-path="url(#c)">${rect(px, py, pw, ph, 0, t.panel)}${rect(px, py, pw, 56, 0, t.ink, 0.06)}`;
    body += dot(px + 30, py + 28, 6, t.ink, 0.25) + dot(px + 52, py + 28, 6, t.ink, 0.25) + dot(px + 74, py + 28, 6, t.accent);
    body += line(px + pw * 0.34, py + 20, pw * 0.3, 16, t.ink, 0.08);
    body += DRAW[p.cover as Exclude<CoverKind, "phone">]({ x: px, y: py + 56, w: pw, h: ph - 56, t, rnd }) + "</g>";
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${defs}${body}</svg>`;
}

let cache: string[] | null = null;
/** One URL per project, in order. Blob URLs are created once per page load. */
export function coverURLs(): string[] {
  if (cache) return cache;
  cache = PROJECTS.map((p, i) => p.image ?? URL.createObjectURL(new Blob([coverSVG(p, i)], { type: "image/svg+xml" })));
  return cache;
}

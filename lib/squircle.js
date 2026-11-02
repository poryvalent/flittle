// Smooth corners. Every element marked data-sq gets a Figma-style squircle clip-path built from its
// own size and CSS border-radius (which stays as the no-JS fallback). The construction is the
// figma-squircle one by phamfoo: per corner a cubic, an arc, a cubic, with 60 % corner smoothing,
// reduced when the element is too small to fit the smoothing inside half of its shorter side.

// The corner smoothing asked for; 0 is a plain circular corner, 1 the fully smoothed one.
const SMOOTHING = 0.6;

const toRad = (deg) => (deg * Math.PI) / 180;

// The lengths that make up one corner: a and b are the cubic handles, c and d the short straight
// run into the arc, p the total length the corner takes along each edge.
function cornerParams(radius, smoothing, budget) {
  radius = Math.min(radius, budget);
  if (radius <= 0) return { a: 0, b: 0, c: 0, d: 0, p: 0, arc: 0, r: 0 };
  const maxSmoothing = budget / radius - 1;
  smoothing = Math.max(0, Math.min(smoothing, maxSmoothing));
  const p = Math.min((1 + smoothing) * radius, budget);
  const arcMeasure = 90 * (1 - smoothing);
  const arc = Math.sin(toRad(arcMeasure / 2)) * radius * Math.SQRT2;
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4 = radius * Math.tan(toRad(angleAlpha / 2));
  const angleBeta = 45 * smoothing;
  const c = p3ToP4 * Math.cos(toRad(angleBeta));
  const d = c * Math.tan(toRad(angleBeta));
  const b = (p - arc - c - d) / 3;
  const a = 2 * b;
  return { a, b, c, d, p, arc, r: radius };
}

const f = (n) => Math.round(n * 1000) / 1000;

function topRight({ a, b, c, d, p, arc, r }) {
  if (!r) return `l ${f(p)} 0`;
  return `c ${f(a)} 0 ${f(a + b)} 0 ${f(a + b + c)} ${f(d)} a ${f(r)} ${f(r)} 0 0 1 ${f(arc)} ${f(arc)} c ${f(d)} ${f(c)} ${f(d)} ${f(b + c)} ${f(d)} ${f(a + b + c)}`;
}
function bottomRight({ a, b, c, d, p, arc, r }) {
  if (!r) return `l 0 ${f(p)}`;
  return `c 0 ${f(a)} 0 ${f(a + b)} ${f(-d)} ${f(a + b + c)} a ${f(r)} ${f(r)} 0 0 1 ${f(-arc)} ${f(arc)} c ${f(-c)} ${f(d)} ${f(-(b + c))} ${f(d)} ${f(-(a + b + c))} ${f(d)}`;
}
function bottomLeft({ a, b, c, d, p, arc, r }) {
  if (!r) return `l ${f(-p)} 0`;
  return `c ${f(-a)} 0 ${f(-(a + b))} 0 ${f(-(a + b + c))} ${f(-d)} a ${f(r)} ${f(r)} 0 0 1 ${f(-arc)} ${f(-arc)} c ${f(-d)} ${f(-c)} ${f(-d)} ${f(-(b + c))} ${f(-d)} ${f(-(a + b + c))}`;
}
function topLeft({ a, b, c, d, p, arc, r }) {
  if (!r) return `l 0 ${f(-p)}`;
  return `c 0 ${f(-a)} 0 ${f(-(a + b))} ${f(d)} ${f(-(a + b + c))} a ${f(r)} ${f(r)} 0 0 1 ${f(arc)} ${f(-arc)} c ${f(c)} ${f(-d)} ${f(b + c)} ${f(-d)} ${f(a + b + c)} ${f(-d)}`;
}

// The full outline for a box of the given size with the same radius on all four corners.
export function squirclePath(width, height, radius, smoothing = SMOOTHING) {
  const budget = Math.min(width, height) / 2;
  const k = cornerParams(radius, smoothing, budget);
  return `M ${f(width - k.p)} 0 ${topRight(k)} L ${f(width)} ${f(height - k.p)} ${bottomRight(k)} L ${f(k.p)} ${f(height)} ${bottomLeft(k)} L 0 ${f(k.p)} ${topLeft(k)} Z`;
}

function apply(el) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const path = `path("${squirclePath(w, h, radius)}")`;
  if (el.style.clipPath !== path) el.style.clipPath = path;
}

// Watch every data-sq element; the clip is recomputed whenever the element is resized, which also
// covers the first layout, font swaps and viewport changes.
export function initSquircles(root = document) {
  const ro = new ResizeObserver((entries) => { for (const e of entries) apply(e.target); });
  const seen = new WeakSet();
  const watch = (el) => { if (seen.has(el)) return; seen.add(el); ro.observe(el); apply(el); };
  root.querySelectorAll('[data-sq]').forEach(watch);
  return { watch };
}

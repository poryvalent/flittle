// The bottom veil: a strip along the bottom edge that blurs the bust and the screens behind it
// progressively, so content fades softly out of the viewport instead of being cut off. It is built
// from stacked backdrop-filter layers, each masked to a band, so the blur grows toward the edge.
// (The brief names this module but its section was cut off in the copy I was given; the strip
// height and blur amounts here are my choice.)

// Three overlapping bands preserve the soft edge without six backdrop passes
// repainting the animated dashboard underneath. Bottom-most band is last.
const BANDS = [2, 8, 24];

export function initVeil() {
  const veil = document.createElement('div');
  veil.className = 'veil';
  veil.setAttribute('aria-hidden', 'true');
  const n = BANDS.length;
  BANDS.forEach((blur, i) => {
    const layer = document.createElement('i');
    // Each band fades in over the previous one and out over the next, so the steps do not show.
    const start = (i / n) * 100, mid = ((i + 1) / n) * 100, end = Math.min(100, ((i + 2) / n) * 100);
    const mask = i === n - 1
      ? `linear-gradient(to bottom, transparent ${start}%, #000 ${mid}%)`
      : `linear-gradient(to bottom, transparent ${start}%, #000 ${mid}%, transparent ${end}%)`;
    layer.style.cssText = `backdrop-filter: blur(calc(var(--u) * ${blur})); -webkit-backdrop-filter: blur(calc(var(--u) * ${blur})); mask-image: ${mask}; -webkit-mask-image: ${mask};`;
    veil.appendChild(layer);
  });
  document.body.appendChild(veil);
  return veil;
}

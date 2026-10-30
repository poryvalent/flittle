/**
 * Colour helpers for the point-cloud bust: soften a colour's chroma in OKLCH
 * (lightness and hue stay put) and turn a list of colour stops into a GLSL
 * function that blends them like a CSS gradient (flat outside the stops).
 */

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
};
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function rgbToOklab([r, g, b]: [number, number, number]): [number, number, number] {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToRgb([L, a, b]: [number, number, number]): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    toSrgb(clamp01(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    toSrgb(clamp01(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    toSrgb(clamp01(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)),
  ];
}

/** Scale a colour's OKLCH chroma by `k`, keeping lightness and hue. */
export function soften(hex: string, k: number): [number, number, number] {
  const [L, a, b] = rgbToOklab(hexToRgb(hex));
  return oklabToRgb([L, a * k, b * k]);
}

export type Stop = [position: number, rgb: [number, number, number]];

/** GLSL `vec3 name(float t)` that blends the stops in order. */
export function rampGLSL(name: string, stops: Stop[]): string {
  const f = (n: number) => n.toFixed(4);
  const v = (c: [number, number, number]) => `vec3(${f(c[0])}, ${f(c[1])}, ${f(c[2])})`;
  let body = `  vec3 c = ${v(stops[0][1])};\n`;
  for (let i = 1; i < stops.length; i++) {
    const [p0] = stops[i - 1];
    const [p1, c1] = stops[i];
    body += `  c = mix(c, ${v(c1)}, clamp((t - ${f(p0)}) / ${f(p1 - p0)}, 0.0, 1.0));\n`;
  }
  return `vec3 ${name}(float t) {\n${body}  return c;\n}\n`;
}

export const rgbOf = (hex: string) => hexToRgb(hex);

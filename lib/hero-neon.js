// Pointer-driven plasma, with the original cyan circuit finish inside the logo.
import { plasmaGLSL } from './hero-plasma.js';

export const neonFragmentShader = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uText;
uniform float uTime;
uniform vec2 uRes, uPointer;
uniform vec4 uCatBounds;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float beam(float distance, float width) {
  float d = abs(distance) / max(width, 0.0001);
  return exp(-d * d) + 0.22 * exp(-d * 0.24);
}
float trailAt(vec2 uv) { return texture2D(uTrail, vec2(uv.x, 1.0 - uv.y)).r; }

${plasmaGLSL}

vec3 techMaterial(vec2 uv, vec4 tx, float inCat, float edge, float time) {
  vec2 pixels = uv * vec2(uRes.x / uRes.y, 1.0) * 55.0;
  vec2 id = floor(pixels), cell = fract(pixels);
  if (hash(id) > 0.5) cell = cell.yx;
  if (hash(id + 12.7) > 0.5) cell.x = 1.0 - cell.x;
  // Tiny right-angle tracks and contact points sit inside an opaque luminous surface.
  float horizontal = (1.0 - smoothstep(0.025, 0.055, abs(cell.y - 0.5)))
                   * step(0.16, cell.x) * step(cell.x, 0.76);
  float vertical = (1.0 - smoothstep(0.025, 0.055, abs(cell.x - 0.76)))
                 * step(0.20, cell.y) * step(cell.y, 0.50);
  float node = 1.0 - smoothstep(0.045, 0.085, length(cell - vec2(0.16, 0.5)));
  float circuit = max(horizontal, vertical) * step(0.30, hash(id + 4.5));
  float sheen = pow(0.5 + 0.5 * sin(uv.y * 23.0 + uv.x * 6.0 - time * 0.7), 4.0);
  vec3 metal = mix(vec3(0.12, 0.78, 0.92), vec3(0.80, 1.0, 1.0), sheen);
  metal = mix(metal, vec3(0.025, 0.34, 0.48), circuit * 0.32);
  metal = mix(metal, vec3(0.85, 1.0, 0.72), node * step(0.68, hash(id)) * (0.55 + 0.25 * sin(time + hash(id) * 6.28)));
  if (inCat > 0.5) {
    float blueBody = smoothstep(0.04, 0.20, tx.b - tx.r);
    metal = mix(tx.rgb, mix(metal, vec3(0.52, 0.86, 1.0), 0.28), blueBody);
  }
  return mix(metal, vec3(0.86, 1.0, 1.0), edge * 0.94);
}

void main() {
  vec2 uv = vUv;
  // A smooth energy aperture follows the existing pointer trail, without boiling smoke.
  vec2 drift = vec2(sin(uv.y * 24.0 + uTime * 0.6), cos(uv.x * 21.0 - uTime * 0.5)) * 0.002;
  float trail = trailAt(uv + drift);
  float mask = smoothstep(0.37, 0.43, trail);
  if (mask < 0.001) { gl_FragColor = vec4(0.0); return; }

  vec3 scene = plasmaField(uv, uTime);
  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 tx = texture2D(uText, tuv);
  vec2 px = vec2(2.7) / uRes;
  vec4 neighbours = vec4(texture2D(uText, tuv + vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv - vec2(px.x, 0.0)).a,
                         texture2D(uText, tuv + vec2(0.0, px.y)).a,
                         texture2D(uText, tuv - vec2(0.0, px.y)).a);
  float inside = min(min(neighbours.x, neighbours.y), min(neighbours.z, neighbours.w));
  float outside = max(max(neighbours.x, neighbours.y), max(neighbours.z, neighbours.w));
  scene += vec3(0.035, 0.32, 0.40) * outside * (1.0 - tx.a);
  if (tx.a > 0.001) {
    float inCat = step(uCatBounds.x, tuv.x) * step(tuv.x, uCatBounds.z)
                * step(uCatBounds.y, tuv.y) * step(tuv.y, uCatBounds.w);
    float edge = 1.0 - smoothstep(0.15, 0.9, inside);
    scene = mix(scene, techMaterial(tuv, tx, inCat, edge, uTime), tx.a);
  }
  float rim = (1.0 - smoothstep(0.43, 0.49, trail)) * (1.0 - tx.a);
  scene += vec3(0.06, 0.40, 0.55) * rim * 0.23;
  gl_FragColor = vec4(scene * mask, mask);
}
`;

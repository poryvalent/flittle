// The liquid: a GPU simulation that lets the grains stir under the pointer. A wake field (flow)
// remembers where the pointer went and how fast; every point is pushed away and around the pointer,
// dragged by the wake, swirled by curl noise where the wake is lively, and pulled home. It is a port
// of the cursor interaction of 21st.dev's "Sculpture Hero", at half force. Created lazily on the
// first live pointer move, so touch devices never pay for it.
import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';

// Reach of the push and of the ink mark, in CSS pixels.
const RADIUS = 150;
const INK_RADIUS = 110;
// Force scaling (half of the original), spread, turbulence and pull-home.
const STRENGTH = 0.5;
const SPREAD = 1;
const TURB = 0.6;
const RETURN = 1.2;
// Margin of the wake field around the bust, in model units.
const MARGIN = 0.15;
// A pointer that has not moved for this long counts as gone.
const STILL_MS = 1500;
// Frames the simulation keeps running after the pointer has faded out.
const TAIL_FRAMES = 270;

const FLOW = /* glsl */ `
uniform vec2 uOrigin;
uniform float uSpan;
uniform vec2 uMouse;
uniform vec2 uVel;
uniform float uPresence;
uniform float uUnits;
uniform float uDecay;
uniform float uInkDecay;
uniform float uRadius;
uniform float uInkRadius;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 texel = 1.0 / resolution.xy;
  // advect the field along itself, then blur it a little
  vec2 suv = uv - texture2D(flow, uv).xy * texel * 2.5;
  vec4 c = texture2D(flow, suv) * .52 + .12 * (
    texture2D(flow, suv + vec2(texel.x, 0.)) + texture2D(flow, suv - vec2(texel.x, 0.)) +
    texture2D(flow, suv + vec2(0., texel.y)) + texture2D(flow, suv - vec2(0., texel.y)));
  vec2 v = c.xy;
  float p = c.z;
  vec2 d = (uOrigin + uv * uSpan - uMouse) / uUnits;
  float f = exp(-dot(d, d) / (uRadius * uRadius)) * uPresence;
  v += uVel * f * .22;
  p = max(p, f * clamp(length(uVel) * 2.5, 0., 1.));
  v *= uDecay;
  p *= uDecay;
  v = sign(v) * max(abs(v) - 1.2 / 127., 0.);
  p = max(p - 1.2 / 255., 0.);
  float ink = max(max(c.w * uInkDecay - .002, 0.), exp(-dot(d, d) / (uInkRadius * uInkRadius)) * uPresence);
  gl_FragColor = vec4(clamp(v, -1., 1.), p, ink);
}
`;

const SIM = /* glsl */ `
uniform sampler2D home;
uniform vec2 uOrigin;
uniform float uSpan;
uniform vec2 uMouse;
uniform float uPresence;
uniform float uUnits;
uniform float uDt;
uniform float uTime;
uniform float uRadius;
uniform float uStrength;
uniform float uSpread;
uniform float uTurb;
uniform float uReturn;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * f * (f * (f * 6. - 15.) + 10.);
  float a = hash(i), b = hash(i + vec2(1., 0.)), c = hash(i + vec2(0., 1.)), d = hash(i + vec2(1., 1.));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec2 curl(vec2 p) {
  const float e = .35;
  float dy = vnoise(p + vec2(0., e)) - vnoise(p - vec2(0., e));
  float dx = vnoise(p + vec2(e, 0.)) - vnoise(p - vec2(e, 0.));
  return vec2(dy, -dx) / (2. * e);
}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 hm = texture2D(home, uv);
  if (hm.w <= 0.) { gl_FragColor = vec4(0.); return; }
  vec4 st = texture2D(state, uv);
  vec2 off = st.xy;
  vec2 vel = st.zw;
  float sd = hm.z;
  float light = .45 + sd * 1.1;
  vec2 p = hm.xy / uUnits + off;
  vec4 fl = texture2D(flow, clamp((hm.xy + off * uUnits - uOrigin) / uSpan, 0., 1.));
  vec2 toM = p - uMouse / uUnits;
  float r2 = dot(toM, toM);
  float f = exp(-r2 / (uRadius * uRadius)) * uPresence;
  vec2 n = toM * inversesqrt(r2 + 1.);
  float e = clamp(fl.z * 2. + f, 0., 1.);
  vec2 acc = n * f * 1.25 * uStrength * uSpread * light;
  acc += vec2(-n.y, n.x) * f * 1.45 * uStrength * uSpread * (.4 + sd);
  acc += (fl.xy * 42. * uSpread * light - vel) * e * .08;
  vec2 q = p * .0095 + vec2(uTime * .35, -uTime * .2);
  acc += (curl(q) + .5 * curl(q * 2.3 + 7.1)) * e * 1.2 * uSpread * uTurb * light;
  acc -= off * (.006 + .02 * uReturn) * (.65 + sd * .7);
  vel += acc * uDt;
  vel *= pow(mix(.93, .955, e), uDt);
  off += vel * uDt;
  if (dot(off, off) < .0004 && dot(vel, vel) < .0004) { off = vec2(0.); vel = vec2(0.); }
  gl_FragColor = vec4(off, vel);
}
`;

export function createLiquid(cloud) {
  const { renderer, side, count, positions, box } = cloud;
  const gpu = new GPUComputationRenderer(side, side, renderer);
  gpu.setDataType(THREE.HalfFloatType);

  // Home: each point's resting xy, a random number, and 1 (0 marks unused texels).
  const home = new THREE.DataTexture(new Float32Array(side * side * 4), side, side, THREE.RGBAFormat, THREE.FloatType);
  const hd = home.image.data;
  for (let i = 0; i < count; i++) { hd[i * 4] = positions[i * 3]; hd[i * 4 + 1] = positions[i * 3 + 1]; hd[i * 4 + 2] = Math.random(); hd[i * 4 + 3] = 1; }
  home.needsUpdate = true;

  const w = box.max.x - box.min.x, h = box.max.y - box.min.y;
  const span = Math.max(w, h) + 2 * MARGIN;
  const origin = new THREE.Vector2((box.min.x + box.max.x) / 2 - span / 2, (box.min.y + box.max.y) / 2 - span / 2);

  const flowVar = gpu.addVariable('flow', FLOW, gpu.createTexture());
  const stateVar = gpu.addVariable('state', SIM, gpu.createTexture());
  gpu.setVariableDependencies(flowVar, [flowVar]);
  gpu.setVariableDependencies(stateVar, [stateVar, flowVar]);
  flowVar.minFilter = THREE.LinearFilter;
  flowVar.magFilter = THREE.LinearFilter;

  const shared = {
    uOrigin: { value: origin }, uSpan: { value: span }, uMouse: { value: new THREE.Vector2() },
    uPresence: { value: 0 }, uUnits: { value: 1 }, uRadius: { value: RADIUS },
  };
  Object.assign(flowVar.material.uniforms, shared, {
    uVel: { value: new THREE.Vector2() }, uDecay: { value: 1 }, uInkDecay: { value: 1 }, uInkRadius: { value: INK_RADIUS },
  });
  Object.assign(stateVar.material.uniforms, shared, {
    home: { value: home }, uDt: { value: 1 }, uTime: { value: 0 },
    uStrength: { value: STRENGTH }, uSpread: { value: SPREAD }, uTurb: { value: TURB }, uReturn: { value: RETURN },
  });
  const err = gpu.init();
  if (err) throw new Error(err);

  const m = new THREE.Vector2();
  const prev = new THREE.Vector2();
  const wake = new THREE.Vector2();
  const vel = new THREE.Vector2();
  let presence = 0, time = 0, tail = 0, lastMove = 0, havePrev = false;

  const liquid = {
    // Compile and initialize both simulation passes while the entrance is up.
    warmup() {
      gpu.compute();
      cloud.setLiquid(gpu.getCurrentRenderTarget(stateVar).texture, gpu.getCurrentRenderTarget(flowVar).texture);
    },
    // Marks a live pointer move (local xy of the bust).
    move(p, now) { lastMove = now; if (!havePrev) { m.copy(p); prev.copy(p); havePrev = true; } },
    // Runs one step. p is the pointer in the bust's local xy (or null), on says whether it is live.
    // Returns true while the simulation still has something to do.
    update(dt, p, localPerPx, on, now) {
      const f = Math.min(3, Math.max(0.25, dt * 60));
      const live = on && p && now - lastMove < STILL_MS;
      if (!live && presence < 1e-3 && tail <= 0) return false;
      if (p) {
        m.lerp(p, 1 - Math.pow(1 - 0.22, f));
        vel.copy(p).sub(prev).divideScalar(localPerPx * f);
        vel.x = Math.min(60, Math.max(-60, vel.x)); vel.y = Math.min(60, Math.max(-60, vel.y));
        prev.copy(p);
      } else {
        vel.set(0, 0);
      }
      wake.lerp(vel, 0.5);
      const target = live ? 1 : 0;
      presence += (target - presence) * (1 - Math.pow(1 - (live ? 0.1 : 0.035), f));
      time += (f / 60) * (1 + presence * 1.6);
      if (presence > 1e-3) tail = TAIL_FRAMES; else tail = Math.max(0, tail - 1);

      shared.uMouse.value.copy(m);
      shared.uPresence.value = presence;
      shared.uUnits.value = localPerPx;
      const fu = flowVar.material.uniforms, su = stateVar.material.uniforms;
      fu.uVel.value.set(Math.min(1, Math.max(-1, wake.x / 40)), Math.min(1, Math.max(-1, wake.y / 40)));
      fu.uDecay.value = Math.pow(0.968, f);
      fu.uInkDecay.value = Math.pow(0.97, f);
      su.uDt.value = f;
      su.uTime.value = time;
      gpu.compute();
      cloud.setLiquid(gpu.getCurrentRenderTarget(stateVar).texture, gpu.getCurrentRenderTarget(flowVar).texture);
      return tail > 0;
    },
    get presence() { return presence; },
  };
  return liquid;
}

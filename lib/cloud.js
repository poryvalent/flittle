// The bust renderer. It loads the point cloud, centres it on the head line, fits it to the viewport,
// and draws every point as a tiny streaked quad whose colour runs along a gradient around the head.
// A faint bloom (run at CSS resolution so it looks the same on every screen) adds the haze.
// Other modules pose it through place() and ask for frames through render(); nothing here loops.
import * as THREE from 'three';
import { PCDLoader } from 'three/addons/loaders/PCDLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const MODEL_URL = 'https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/models/pcd/binary/Zaghetto.pcd';

// Vertical field of view of the camera, degrees.
const FOV = 30;
const FOV_RAD = (FOV * Math.PI) / 180;
// Height of the bust as a share of the viewport height.
const SIZE = 0.78;
// The base sinks this share of the view height below the bottom edge, so the bust rises out of it.
const BLEED = 0.07;
// The bust may be at most this many viewport widths wide (keeps it on narrow screens).
const WIDE = 1.3;
// Side of one grain in model units at scale 1.
const POINT_SIZE = 0.005;
// The points that outlive the dissolve and become the orbit's stars: how many (one per star), and
// the texture that carries their screen targets (one texel per star, row-major).
export const STAR_COUNT = 1500;
export const STAR_TEX_W = 64;
export const STAR_TEX_H = 32;
// Where the head centre sits above the bust centre, in model units.
const HEAD_Y = 0.10;
// Camera clipping planes.
const NEAR = 0.01;
const FAR = 40;
// The model is turned slightly so the face reads toward the viewer.
const FACE_YAW = 0.05;
const FACE_PITCH = 0.19;
// The haze: a very weak, very wide bloom with no threshold.
const BLOOM = { strength: 0.020, radius: 0.9, threshold: 0 };
// Blur kernels of the five bloom mips, in CSS pixels.
const KERNELS = [3, 5, 7, 9, 11];
// Grain look: streak length share, gradient radius around the head, film grain amount.
const STREAK = 0.8;
const RADIUS = 0.40;
const GRAIN = 0.335;
// The resting gradient is the touched one with its chroma scaled down by this much.
const SOFTEN = 0.6;
// Colour stops of the gradient from the head outward: white-hot core, Cherenkov blue, ember red.
const STOPS = [[0, '#FFFFFF'], [0.32, '#7FD4FF'], [1, '#E0334F']];

// ---- colour helpers (sRGB <-> OKLab) so the resting gradient keeps lightness and hue ----
const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
function rgbToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
          1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
          0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
function oklabToRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
          -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
          -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
function soften(hex, k) {
  const [L, a, b] = rgbToOklab(hexToRgb(hex).map(toLinear));
  return oklabToRgb([L, a * k, b * k]).map((c) => Math.min(1, Math.max(0, toSrgb(c))));
}
export const SOFT_STOPS = STOPS.map(([p, c]) => [p, soften(c, SOFTEN)]);

// A GLSL ramp that is flat outside its stops, like a CSS gradient.
function rampGLSL(name, stops) {
  const v = (c) => `vec3(${c.map((x) => x.toFixed(4)).join(', ')})`;
  let s = `vec3 ${name}(float t) {\n  vec3 c = ${v(stops[0][1])};\n`;
  for (let i = 1; i < stops.length; i++) {
    const [p, c] = stops[i], prev = stops[i - 1][0];
    s += `  c = mix(c, ${v(c)}, clamp((t - ${prev.toFixed(4)}) / ${(p - prev).toFixed(4)}, 0.0, 1.0));\n`;
  }
  return s + '  return c;\n}\n';
}

const VERT = /* glsl */ `
precision highp float;
attribute vec3 aHome;
attribute vec2 aRef;
attribute float aStar;
uniform sampler2D uState;
uniform sampler2D uFlow;
uniform vec2 uOrigin;
uniform float uSpan;
uniform float uUnits;
uniform float uSize;
uniform float uStreak;
uniform vec2 uViewport;
uniform vec2 uCenter;
uniform float uRadius;
uniform float uScatter;
uniform float uFade;
uniform float uBecome;
uniform sampler2D uStars;
uniform float uTime;
varying vec3 vGrad;
varying float vBecome;
varying vec3 vTouched;
varying float vInk;
varying float vDrop;
varying float vTail;
varying float vFade;
varying vec2 vNdc;
${rampGLSL('ramp', SOFT_STOPS)}
${rampGLSL('touched', STOPS.map(([p, c]) => [p, hexToRgb(c)]))}
void main() {
  vec4 st = texture2D(uState, aRef);
  // per-point random numbers for the dust
  vec3 r = fract(sin(vec3(dot(aRef, vec2(12.9898, 78.233)), dot(aRef, vec2(39.3468, 11.135)), dot(aRef, vec2(73.156, 52.235)))) * vec3(43758.5453, 24634.6345, 9631.7453));
  float k = uScatter * uScatter;
  vec3 fling = normalize(r - .5 + 1e-3) * (.35 + .65 * r.x) * 0.05;
  vec3 drift = vec3(sin(uTime * .7 + r.y * 6.28318530718), cos(uTime * .6 + r.z * 6.28318530718), 0.) * 0.01;
  // dust loses most of its points and the dissolve into the portfolio the rest, one by one; the
  // points bound for the stars stay until they have handed over
  vDrop = aStar < 0. ? step(1. - max(uScatter * 0.7, uFade), r.z) : step(0.999, uBecome);
  vec3 p = aHome + vec3(st.xy * uUnits, 0.) + (fling + drift) * k;
  // the streak: how far the point moved on screen this frame
  vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  vec4 c2 = projectionMatrix * modelViewMatrix * vec4(p + vec3(st.zw * uUnits, 0.), 1.);
  // the star-bound points leave the dust for the screen spots of the orbit's particles, each in
  // its own time, and shrink to a star's size on the way
  float become = 0.;
  if (aStar >= 0.) {
    vec2 target = texture2D(uStars, vec2((mod(aStar, ${STAR_TEX_W}.) + .5) / ${STAR_TEX_W}., (floor(aStar / ${STAR_TEX_W}.) + .5) / ${STAR_TEX_H}.)).xy;
    become = smoothstep(0., 1., (uBecome - r.y * .3) / .7);
    vec2 d = (target - c.xy / c.w) * become;
    c.xy += d * c.w;
    c2.xy += d * c2.w;
  }
  vBecome = become;
  vec2 v = (c2.xy / c2.w - c.xy / c.w) * 0.5 * uViewport;
  float vl = length(v);
  float len = min(vl * 1.25, 18.) * uStreak;
  float h = uSize * (1. - 0.45 * uScatter) / (2. * c.w) * .5 * uViewport.y;
  h = mix(h, 1.7, become);
  vFade = smoothstep(0., 1.5, len);
  vec2 dir = vl > 1e-5 ? v / vl : vec2(1., 0.);
  float sx = dir.x < 0. ? -1. : 1.;
  vec2 axis = normalize(mix(vec2(1., 0.), dir * sx, vFade));
  vec2 perp = vec2(-axis.y, axis.x);
  vec2 lc = position.xy * vec2(h + len / 2., h);
  vec2 off = axis * lc.x + perp * lc.y - dir * len / 2.;
  vTail = (dot(off, -dir) - h) / max(len, 1e-3);
  vNdc = c.xy / c.w;
  c.xy += off / (0.5 * uViewport) * c.w;
  gl_Position = c;
  // colour along the gradient around the head, and how much the pointer has touched this point
  float t = distance(aHome.xy, uCenter) / uRadius;
  vGrad = ramp(t);
  vTouched = touched(t);
  vInk = clamp(texture2D(uFlow, clamp((p.xy - uOrigin) / uSpan, 0., 1.)).w, 0., 1.);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uGrain;
uniform float uDim;
uniform vec2 uHead;
uniform float uHeadR;
uniform vec2 uViewport;
varying vec3 vGrad;
varying vec3 vTouched;
varying float vInk;
varying float vDrop;
varying float vTail;
varying float vFade;
varying float vBecome;
varying vec2 vNdc;
float hash(vec2 p, vec2 k, float m) { return fract(sin(dot(p, k)) * m); }
vec3 overlay(vec3 b, vec3 s) { return mix(2. * b * s, 1. - 2. * (1. - b) * (1. - s), step(.5, b)); }
vec3 srgbToLinear(vec3 c) { return mix(c / 12.92, pow((c + .055) / 1.055, vec3(2.4)), step(.04045, c)); }
void main() {
  if (vDrop > .5) discard;
  // dithered tail of the streak
  if (clamp(vTail, 0., 1.) * .55 * vFade > hash(gl_FragCoord.xy, vec2(12.9898, 78.233), 43758.5453)) discard;
  vec3 col = mix(vGrad, vTouched, vInk * 0.6);
  // film grain
  col = mix(col, overlay(col, vec3(hash(gl_FragCoord.xy, vec2(39.3468, 11.135), 24634.6345))), uGrain);
  // the veil on the text screens: darker away from the head and on the side the text is on
  float aspect = uViewport.x / uViewport.y;
  float r = length((vNdc - uHead) * vec2(aspect, 1.)) / uHeadR;
  float edge = smoothstep(.3, 1.3, r);
  float dir = -clamp(uHead.x / .3, -1., 1.);
  float side = smoothstep(-.2, 1., dir * (vNdc.x - uHead.x));
  col *= (1. - uDim * 0.1) * (1. - uDim * 0.6 * edge) * (1. - uDim * 0.45 * side);
  // on the way to being a star, a point takes on the stars' pale blue
  col = mix(col, vec3(0.74, 0.9, 1.0), vBecome);
  gl_FragColor = vec4(srgbToLinear(col), 1.);
  #include <colorspace_fragment>
}
`;

// Loads the cloud, turns it to face the viewer and centres it: y and z on the box, x on the head line
// (the median of the row centres of the top 45 % of the height), so the head is the pivot of every turn.
export async function loadPCD(url) {
  const pts = await new PCDLoader().loadAsync(url);
  const geometry = pts.geometry;
  geometry.rotateX(Math.PI);
  geometry.rotateY(FACE_YAW);
  geometry.rotateX(FACE_PITCH);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const pos = geometry.getAttribute('position');
  const rows = 48;
  const top = box.max.y, y0 = top - (box.max.y - box.min.y) * 0.45, rowH = (top - y0) / rows;
  const minX = new Float32Array(rows).fill(Infinity), maxX = new Float32Array(rows).fill(-Infinity);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y < y0) continue;
    const r = Math.min(rows - 1, Math.floor((y - y0) / rowH));
    const x = pos.getX(i);
    if (x < minX[r]) minX[r] = x;
    if (x > maxX[r]) maxX[r] = x;
  }
  const mids = [];
  for (let r = 0; r < rows; r++) if (isFinite(minX[r])) mids.push((minX[r] + maxX[r]) / 2);
  mids.sort((a, b) => a - b);
  const cx = mids.length ? mids[mids.length >> 1] : (box.min.x + box.max.x) / 2;
  geometry.translate(-cx, -(box.min.y + box.max.y) / 2, -(box.min.z + box.max.z) / 2);
  return pos.array;
}

function patchBloom(bloom, ratio) {
  // The blur runs at CSS resolution with small kernels, so the haze has the same width on every screen.
  bloom.separableBlurMaterials.forEach((m) => m.dispose());
  bloom.separableBlurMaterials = KERNELS.map((k) => bloom._getSeparableBlurMaterial(k));
  bloom.highPassUniforms.uSrc = { value: new THREE.Vector2() };
  const setSize = bloom.setSize.bind(bloom);
  bloom.setSize = (w, h) => {
    setSize(Math.round(w / ratio), Math.round(h / ratio));
    bloom.highPassUniforms.uSrc.value.set(ratio / 2 / w, ratio / 2 / h);
  };
  // The high pass averages four taps half a CSS pixel apart, so single device pixels do not sparkle.
  const hp = bloom.materialHighPassFilter;
  hp.fragmentShader = hp.fragmentShader
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse;\n\t\tuniform vec2 uSrc;')
    .replace('vec4 texel = texture2D( tDiffuse, vUv );',
      'vec4 texel = 0.25 * ( texture2D( tDiffuse, vUv + uSrc ) + texture2D( tDiffuse, vUv - uSrc ) + texture2D( tDiffuse, vUv + vec2( uSrc.x, -uSrc.y ) ) + texture2D( tDiffuse, vUv - vec2( uSrc.x, -uSrc.y ) ) );');
  hp.needsUpdate = true;
  // The composite keeps the hue of the haze and softens its knee instead of tinting it.
  const cm = bloom.compositeMaterial;
  cm.fragmentShader = cm.fragmentShader
    .replace('vec3 bloom = 3.0 * bloomStrength * (', 'vec3 bloom = 3.0 * (')
    .replace('float bloomAlpha',
      'float lum = max( dot( bloom, vec3( .2126, .7152, .0722 ) ), 1e-5 );\n\t\t\t\t\tbloom = bloomStrength * bloom * ( pow( lum, 0.60 ) / lum );\n\t\t\t\t\tfloat bloomAlpha');
  cm.needsUpdate = true;
}

function patchOutput(output) {
  // The faint haze has to survive premultiplied compositing over the page, so alpha follows brightness.
  const src = output.material.fragmentShader;
  const i = src.lastIndexOf('#endif') + '#endif'.length;
  output.material.fragmentShader = src.slice(0, i) +
    '\n\n\t\t\tgl_FragColor.a = max( gl_FragColor.a, max( gl_FragColor.r, max( gl_FragColor.g, gl_FragColor.b ) ) );' + src.slice(i);
  output.material.needsUpdate = true;
}

export function createCloud(host) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(ratio);
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, NEAR, FAR);
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(ratio);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), BLOOM.strength, BLOOM.radius, BLOOM.threshold);
  patchBloom(bloom, ratio);
  composer.addPass(bloom);
  const output = new OutputPass();
  patchOutput(output);
  composer.addPass(output);

  // The rig pivots at the base of the bust; the points sit inside it with their base on the pivot.
  const rig = new THREE.Group();
  rig.rotation.order = 'YXZ';
  scene.add(rig);

  const empty = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
  empty.needsUpdate = true;

  // the stars' screen targets, written by the orbit while the hand-over is under way
  const starData = new Float32Array(STAR_TEX_W * STAR_TEX_H * 4);
  const starTex = new THREE.DataTexture(starData, STAR_TEX_W, STAR_TEX_H, THREE.RGBAFormat, THREE.FloatType);
  starTex.needsUpdate = true;

  const uniforms = {
    uState: { value: empty }, uFlow: { value: empty }, uStars: { value: starTex }, uBecome: { value: 0 },
    uOrigin: { value: new THREE.Vector2(0, 0) }, uSpan: { value: 1 },
    uUnits: { value: 1 }, uSize: { value: POINT_SIZE }, uStreak: { value: STREAK },
    uViewport: { value: new THREE.Vector2(1, 1) },
    uCenter: { value: new THREE.Vector2(0, HEAD_Y) }, uRadius: { value: RADIUS },
    uGrain: { value: GRAIN }, uScatter: { value: 0 }, uFade: { value: 0 }, uDim: { value: 0 },
    uHead: { value: new THREE.Vector2(0, 0) }, uHeadR: { value: 1e-3 }, uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, depthTest: false, depthWrite: false });

  const cloud = {
    host, renderer, camera, rig, points: null, uniforms, material,
    count: 0, side: 1, positions: null, box: null,
    head: new THREE.Vector3(0, HEAD_Y, 0), headInRig: new THREE.Vector3(),
    headNdc: new THREE.Vector2(), headPx: { w: 1, h: 1 }, headSize: { w: 1, h: 1 },
    heroY: -0.5, unitsPerPx: 1, localPerPx: 1, aspect: 1,
    stageBox: { s: 1, tx: 0, ty: 0 }, framed: false, ready: false, onPlace: null,
    // the hand-over to the orbit: 0 = whole bust, 1 = its surviving points are the orbit's stars
    handoff: 0, stars: { data: starData, texture: starTex },
    HEAD_Y,
  };

  const size = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let lastPose = { x: 0, y: -0.5, scale: 1, yaw: 0, pitch: 0, roll: 0 }, lastGaze = [0, 0, 0], lastAnchor = 0;

  function build(positions) {
    const n = positions.length / 3;
    const side = 2 ** Math.ceil(Math.log2(Math.sqrt(n)));
    const refs = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { refs[i * 2] = ((i % side) + 0.5) / side; refs[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side; }
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 2, 1, 3]);
    geo.setAttribute('aHome', new THREE.InstancedBufferAttribute(positions, 3));
    geo.setAttribute('aRef', new THREE.InstancedBufferAttribute(refs, 2));
    // the points that become the stars: a fixed random pick, the same on every load
    const stars = new Float32Array(n).fill(-1);
    let seed = 1234567;
    const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const order = Uint32Array.from({ length: n }, (_, i) => i);
    for (let i = 0; i < STAR_COUNT && i < n; i++) {
      const j = i + Math.floor(rnd() * (n - i));
      const t = order[i]; order[i] = order[j]; order[j] = t;
      stars[order[i]] = i;
    }
    geo.setAttribute('aStar', new THREE.InstancedBufferAttribute(stars, 1));
    geo.instanceCount = n;
    const box = new THREE.Box3().setFromArray(positions);
    box.getSize(size);
    const points = new THREE.Mesh(geo, material);
    points.frustumCulled = false;
    points.position.y = -box.min.y;
    rig.add(points);
    // the head's extent: the points above the line mirrored about the head centre
    const yLine = HEAD_Y - (box.max.y - HEAD_Y);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) {
      const y = positions[i * 3 + 1];
      if (y < yLine) continue;
      const x = positions[i * 3];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    cloud.headSize = { w: maxX - minX, h: maxY - minY };
    cloud.points = points; cloud.count = n; cloud.side = side; cloud.positions = positions; cloud.box = box;
    // the wake field covers the bust with a margin
    const span = Math.max(size.x, size.y) + 2 * 0.15;
    uniforms.uSpan.value = span;
    uniforms.uOrigin.value.set((box.min.x + box.max.x) / 2 - span / 2, (box.min.y + box.max.y) / 2 - span / 2);
    cloud.ready = true;
    fit();
  }

  function fit() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    cloud.aspect = w / h;
    camera.aspect = cloud.aspect;
    camera.updateProjectionMatrix();
    if (!cloud.ready) return;
    const view = Math.max(size.y / SIZE, size.x / (WIDE * cloud.aspect));
    camera.position.set(0, 0, view / 2 / Math.tan(FOV_RAD / 2));
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    cloud.headInRig.set(0, HEAD_Y - cloud.box.min.y, 0);
    cloud.heroY = (-view / 2 - BLEED * view + cloud.headInRig.y) / (view / 2);
    cloud.unitsPerPx = view / h;
    document.documentElement.style.setProperty('--bust-top', ((1 + BLEED - size.y / view) * 100).toFixed(2) + '%');
    place(lastPose, lastGaze, lastAnchor);
  }

  // Poses the bust so that its head lands at (pose.x, pose.y) in normalized device coordinates at the
  // given scale and turn. The gaze is added on top; anchor says how much of it the head position
  // already accounts for (0: the head swings as it turns, 1: the head stays put while turning).
  function place(pose, gaze = [0, 0, 0], anchor = 0) {
    lastPose = pose; lastGaze = gaze; lastAnchor = anchor;
    if (!cloud.ready) return;
    const s = pose.scale;
    rig.scale.setScalar(s);
    rig.rotation.set(pose.pitch + gaze[0] * anchor, pose.yaw + gaze[1] * anchor, pose.roll + gaze[2] * anchor);
    lift.copy(cloud.headInRig).multiplyScalar(s).applyEuler(rig.rotation);
    const half = (camera.position.z - lift.z) * Math.tan(FOV_RAD / 2);
    rig.position.set(pose.x * half * cloud.aspect - lift.x, pose.y * half - lift.y, 0);
    rig.rotation.set(pose.pitch + gaze[0], pose.yaw + gaze[1], pose.roll + gaze[2]);
    rig.updateMatrixWorld(true);
    cloud.localPerPx = cloud.unitsPerPx / s;
    uniforms.uUnits.value = cloud.localPerPx;
    uniforms.uSize.value = POINT_SIZE * s;
    tmp.copy(cloud.head).applyMatrix4(cloud.points.matrixWorld).project(camera);
    cloud.headNdc.set(tmp.x, tmp.y);
    cloud.headPx.w = (cloud.headSize.w * s) / cloud.unitsPerPx;
    cloud.headPx.h = (cloud.headSize.h * s) / cloud.unitsPerPx;
    uniforms.uHead.value.copy(cloud.headNdc);
    uniforms.uHeadR.value = Math.max(cloud.headPx.h / (host.clientHeight || 1), 1e-3);
    cloud.onPlace?.();
  }

  function render() { composer.render(); }

  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    uniforms.uViewport.value.set(w, h);
    fit();
    render();
  }

  new ResizeObserver(resize).observe(host);
  resize();

  cloud.load = async (url) => { build(await loadPCD(url)); return cloud; };
  cloud.place = place;
  cloud.fit = fit;
  cloud.render = render;
  cloud.setLiquid = (state, flow) => { uniforms.uState.value = state; uniforms.uFlow.value = flow; };
  return cloud;
}

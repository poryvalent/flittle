"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/addons/loaders/PCDLoader.js";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import { rampGLSL, rgbOf, soften } from "@/lib/tone";
import { sampleCat } from "@/lib/cat-points";
import { buildRelief } from "@/lib/relief";
import { EYE_SEQ as S, storyBus } from "@/lib/story-bus";

/**
 * A point-cloud bust of a man (about 60,000 points) drawn with three.js on a
 * see-through canvas. It turns its whole body toward the cursor, a colour
 * gradient follows the pointer, and the pointer's wake stirs the points like
 * a liquid (a GPU flow field with per-point inertia; an analytic stir stands
 * in where float textures are missing). A soft additive glow haloes the points.
 *
 * Scroll choreographs it: centred in the hero, into the top-left corner
 * (looking right), a burst of dust, re-formed top-right (looking left). Then
 * the man comes back to the centre and the points fuse into a solid, lit
 * relief built from the scan itself; the camera closes in on his eye; a drawn
 * eye takes over and we dive into the pupil, where the portfolio waits. At the
 * very end the hidden cloud returns as dust and condenses into Flittle's cat
 * above "Let's work together". The timeline is published on the story bus.
 */

const DEG = Math.PI / 180;
const FOV = 30;
const SIZE = 0.78; // bust height as a share of viewport height
const BLEED = 0.07; // the base sinks this far below the bottom edge
const WIDE = 1.3; // widest the bust may get, in viewport widths
const POINT_SIZE = 0.005;
const HEAD_Y = 0.1; // head centre above the bust centre, in model units
const GAZE_D = 0.41; // distance of the plane the cursor is projected onto for the gaze
// The man's right eye (on the viewer's left), measured on the scan's depth map.
const EYE = new THREE.Vector3(-0.031, 0.1, 0.08);
const EYE_W = 0.034; // width of the eye opening, model units
const EYE_FILL = 0.3; // share of the viewport width the eye opening spans when the drawn eye takes over
const EYE_FILL_MOBILE = 0.62;
const HEAD = new THREE.Vector3(0, HEAD_Y, 0);
const CAT_HEIGHT = 0.62; // the cat's height as a share of the bust's
const CAT_POINT = 0.9; // how much fatter the points get for the cat
const GLOW = 0.09;

type Pose = { x: number; y: number; scale: number; yaw: number; pitch: number; roll: number };
const POSE_KEYS: (keyof Pose)[] = ["x", "y", "scale", "yaw", "pitch", "roll"];
const LEFT: Pose = { x: -0.66, y: 0.64, scale: 3.3, yaw: 0.48, pitch: 0.03, roll: -0.28 };
const RIGHT: Pose = { x: 0.66, y: 0.64, scale: 3.3, yaw: -0.48, pitch: 0.03, roll: 0.28 };
const FRONT: Pose = { x: 0, y: 0.1, scale: 1.25, yaw: 0, pitch: 0, roll: 0 };
const FRONT_MOBILE: Pose = { x: 0, y: 0.12, scale: 1.05, yaw: 0, pitch: 0, roll: 0 };
const CAT: Pose = { x: 0, y: 0.3, scale: 0.9, yaw: 0, pitch: 0, roll: 0 };
const CAT_MOBILE: Pose = { x: 0, y: 0.34, scale: 1.3, yaw: 0, pitch: 0, roll: 0 };
const CENTER_DROP = 0.08;
const OS_IN: [number, number] = [0.12, 0.8];
const OS_OUT: [number, number] = [2.2, 3.2];
const TO_LEFT: [number, number] = [-1, -0.2];
const WINDOW: [number, number] = [-0.6, 0.1];
const CONDENSE = 0.42;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Unit-mass spring, semi-implicit Euler in sub-steps of at most 1/240 s. */
class Spring {
  x: number; v = 0; t: number;
  constructor(x: number, public k: number, public c: number, public eps = 1e-4) { this.x = x; this.t = x; }
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.k * (this.t - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    if (Math.abs(this.t - this.x) < this.eps && Math.abs(this.v) < this.eps * 10) { this.x = this.t; this.v = 0; }
  }
  snap() { this.x = this.t; this.v = 0; }
  get still() { return this.x === this.t && this.v === 0; }
}

// Gradient across the face: white where the cursor is, into lilac, into sun yellow (Flittle's colours).
const TOUCHED: [number, string][] = [[0, "#FFFFFF"], [0.32, "#A785C9"], [1, "#F5DD6E"]];
const RAMP = rampGLSL("ramp", TOUCHED.map(([p, h]) => [p, soften(h, 0.6)]));
const TOUCH = rampGLSL("touched", TOUCHED.map(([p, h]) => [p, rgbOf(h)]));

const VERT = /* glsl */ `
precision highp float;
attribute vec3 aHome, aHome2, aSeed, aColor2;
attribute vec2 aRef;
uniform sampler2D uState, uFlow;
uniform float uSize, uStreak, uScatter, uTime, uPresence, uStirR, uUnits, uMorph, uLiquid, uSpan, uRadius;
uniform vec2 uViewport, uCenter, uMouse, uVelPx, uOrigin;
varying float vFade, vTail, vDrop, vInk;
varying vec3 vGrad, vTouched, vCol2;
varying vec2 vNdc;
#ifdef GLOW
varying vec2 vQ;
varying float vKeep;
#endif
${RAMP}
${TOUCH}
void main() {
  vec3 r = aSeed;
  float k = uScatter * uScatter;
  vec3 home = mix(aHome, aHome2, uMorph);
  vec3 fling = normalize(r - .5 + 1e-3) * (.35 + .65 * r.x) * 0.05;
  vec3 drift = vec3(sin(uTime * .7 + r.y * 6.2831), cos(uTime * .6 + r.z * 6.2831), 0.) * 0.01;
  vDrop = step(1. - uScatter * 0.7, r.z);

  // Analytic stir, the fallback when the GPU liquid is unavailable: pushed away, swirled, eased back.
  vec2 toM = home.xy - uMouse;
  float r2 = dot(toM, toM);
  float f = exp(-r2 / (uStirR * uStirR)) * uPresence;
  vec2 n = toM * inversesqrt(r2 + 1e-8);
  vec2 sw = vec2(-n.y, n.x);
  vec2 turb = vec2(sin(home.y * 60. + uTime * 1.3 + r.x * 6.28), cos(home.x * 60. + uTime * 1.1 + r.y * 6.28));
  vec2 pushPx = (n * 40. * (.4 + r.x) + sw * 55. * (.4 + r.y) + turb * 14. + uVelPx * 4.) * f;
  vec2 motionPx = ((sw * .7 + n * .4) * 30. + uVelPx) * f;

  // GPU liquid: each point carries its own offset and velocity (px), left behind by the pointer's wake.
  vec4 st = texture2D(uState, aRef);
  vec2 offPx = mix(pushPx, st.xy, uLiquid);
  vec2 velPx = mix(motionPx, st.zw * 1.5, uLiquid);
  // The cat breathes softly once it has formed.
  vec3 breathe = vec3(sin(uTime * 1.1 + r.x * 6.2831), cos(uTime * .9 + r.y * 6.2831), 0.) * 0.003 * uMorph;
  vec3 p = home + vec3(offPx * uUnits, 0.) + (fling + drift) * k + breathe;

  vec4 c = projectionMatrix * modelViewMatrix * vec4(p, 1.);
  // Fast-moving points smear into short streaks along their direction of travel.
  vec4 c2 = projectionMatrix * modelViewMatrix * vec4(p + vec3(velPx * uUnits, 0.), 1.);
  vec2 v = (c2.xy / c2.w - c.xy / c.w) * .5 * uViewport;
  float len = min(length(v) * 1.25, 18.) * uStreak;
  vec2 dir = length(v) > 1e-4 ? normalize(v) : vec2(1., 0.);
  float h = uSize * (1. - .45 * uScatter) * (1. + ${CAT_POINT.toFixed(2)} * uMorph) / (2. * c.w) * .5 * uViewport.y;
  #ifdef GLOW
    h *= 7.0; len = 0.0;
    vKeep = step(0.75, r.x);
    vQ = position.xy;
  #endif
  vFade = smoothstep(0., 1.5, len);
  vec2 axis = normalize(mix(vec2(1., 0.), dir * (dir.x < 0. ? -1. : 1.), vFade));
  vec2 perp = vec2(-axis.y, axis.x);
  vec2 lc = position.xy * vec2(h + len / 2., h);
  vec2 off = axis * lc.x + perp * lc.y - dir * len / 2.;
  vTail = (dot(off, -dir) - h) / max(len, 1e-3);
  c.xy += off / (.5 * uViewport) * c.w;
  vNdc = c.xy / c.w;
  gl_Position = c;

  float t = distance(home.xy, uCenter) / uRadius;
  vGrad = ramp(t);
  vTouched = touched(t);
  vec2 fuv = clamp((home.xy - uOrigin) / uSpan, 0., 1.);
  vInk = mix(clamp(f * 1.6, 0., 1.), clamp(texture2D(uFlow, fuv).w, 0., 1.), uLiquid);
  vCol2 = aColor2;
}`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uGrain, uDim, uHeadR, uMorph, uGlowK, uAlpha;
uniform vec2 uHead, uViewport;
varying float vFade, vTail, vDrop, vInk;
varying vec3 vGrad, vTouched, vCol2;
varying vec2 vNdc;
#ifdef GLOW
varying vec2 vQ;
varying float vKeep;
#endif
float hash(vec2 p, vec2 k, float m) { return fract(sin(dot(p, k)) * m); }
vec3 overlay(vec3 b, vec3 s) { return mix(2. * b * s, 1. - 2. * (1. - b) * (1. - s), step(.5, b)); }
void main() {
  if (vDrop > .5) discard;
  vec3 col = mix(mix(vGrad, vTouched, vInk * .6), vCol2, uMorph);
  #ifdef GLOW
    if (vKeep < .5) discard;
    float g = exp(-dot(vQ, vQ) * 3.0);
    float a = g * uGlowK * (1. - .85 * uMorph) * uAlpha;
    gl_FragColor = vec4(col * a, a);
  #else
    if (clamp(vTail, 0., 1.) * .55 * vFade > hash(gl_FragCoord.xy, vec2(12.9898, 78.233), 43758.5453)) discard;
    col = mix(col, vec3(1.), vInk * .25 * uMorph);
    col = mix(col, overlay(col, vec3(hash(gl_FragCoord.xy, vec2(39.3468, 11.135), 24634.6345))), uGrain * (1. - .6 * uMorph));
    // On the text screens the bust sinks into the dark toward the text.
    float asp = uViewport.x / uViewport.y;
    float rr = length((vNdc - uHead) * vec2(asp, 1.)) / uHeadR;
    float edge = smoothstep(.3, 1.3, rr);
    float dir = -clamp(uHead.x / .3, -1., 1.);
    float side = smoothstep(-.2, 1., dir * (vNdc.x - uHead.x));
    col *= (1. - uDim * .1) * (1. - uDim * .6 * edge) * (1. - uDim * .45 * side);
    gl_FragColor = vec4(col, uAlpha);
  #endif
}`;

// The wake: a velocity field (xy), its energy (z) and an ink trace (w) over the bust's own xy plane.
const FLOW = /* glsl */ `
uniform vec2 uMouse, uVel, uOrigin;
uniform float uPresence, uUnits, uDecay, uInkDecay, uRadius, uInkRadius, uSpan;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec2 texel = 1.0 / resolution.xy;
  vec2 suv = uv - texture2D(flow, uv).xy * texel * 2.5;
  vec4 c = texture2D(flow, suv) * .52
    + .12 * (texture2D(flow, suv + vec2(texel.x, 0.)) + texture2D(flow, suv - vec2(texel.x, 0.))
           + texture2D(flow, suv + vec2(0., texel.y)) + texture2D(flow, suv - vec2(0., texel.y)));
  vec2 d = (uOrigin + uv * uSpan - uMouse) / uUnits;
  float f = exp(-dot(d, d) / (uRadius * uRadius)) * uPresence;
  vec2 v = c.xy + uVel * f * .22;
  float p = max(c.z, f * clamp(length(uVel) * 2.5, 0., 1.));
  v *= uDecay; p *= uDecay;
  v = sign(v) * max(abs(v) - 1.2 / 127., 0.);
  p = max(p - 1.2 / 255., 0.);
  float fi = exp(-dot(d, d) / (uInkRadius * uInkRadius)) * uPresence;
  float ink = max(c.w * uInkDecay, fi);
  gl_FragColor = vec4(v, p, ink);
}`;

// Per point: offset (xy, px) and velocity (zw, px per frame), pushed by the wake, drawn back home.
const STATE = /* glsl */ `
uniform sampler2D tHome, tHome2;
uniform vec2 uOrigin;
uniform float uMorph, uUnits, uDt, uTurb, uReturn, uTime, uSpan;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 h1 = texture2D(tHome, uv), h2 = texture2D(tHome2, uv);
  vec2 home = mix(h1.xy, h2.xy, uMorph);
  float seed = h1.z;
  vec4 s = texture2D(state, uv);
  vec2 pos = home + s.xy * uUnits;
  vec4 fl = texture2D(flow, clamp((pos - uOrigin) / uSpan, 0., 1.));
  vec2 swirl = vec2(-fl.y, fl.x) * (seed - .5) * 2.;
  float a = uTime * 2. + seed * 6.2831;
  vec2 turb = vec2(sin(a * 1.3 + pos.y * 40.), cos(a * 1.1 + pos.x * 40.)) * fl.z;
  vec2 acc = (fl.xy * 4. + swirl * 2.4 + turb * 1.2 * uTurb) * (.6 + .8 * seed);
  vec2 vel = s.zw + acc * uDt - s.xy * (uReturn * .02) * uDt;
  vel *= pow(.8, uDt);
  gl_FragColor = vec4(s.xy + vel * uDt, vel);
}`;

type Liquid = { gpu: GPUComputationRenderer; flow: Variable; state: Variable };

export function BustStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const story = document.getElementById("story");
    if (!story) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    } catch {
      return; // no WebGL: the title and text still carry the page
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 40);
    const rig = new THREE.Group();
    rig.rotation.order = "YXZ";
    scene.add(rig);

    // Lights only touch the solid man; the points shade themselves.
    scene.add(new THREE.AmbientLight(0x6a6a78, 0.9));
    const key = new THREE.DirectionalLight(0xfff2e2, 2.2);
    key.position.set(-1.2, 1.4, 1.6);
    const fill = new THREE.DirectionalLight(0xa785c9, 0.9);
    fill.position.set(1.6, 0.3, 1.0);
    const rim = new THREE.DirectionalLight(0xf5dd6e, 1.6);
    rim.position.set(0.9, 0.8, -1.2);
    scene.add(key, fill, rim);

    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const centre = new THREE.Vector3();
    let mesh: THREE.Mesh | null = null;
    let glow: THREE.Mesh | null = null;
    let solid: THREE.Mesh | null = null;
    let material: THREE.ShaderMaterial | null = null;
    let glowMaterial: THREE.ShaderMaterial | null = null;
    let solidMaterial: THREE.MeshStandardMaterial | null = null;
    let top = 0.3;
    let vw = 1, vh = 1, aspect = 1, unitsPerPx = 0.001, heroY = -0.5, localPerPx = 0.001;
    let tops = { os: 0, services: 0, process: 0, real: 0 };
    let lastPose: Pose = { x: 0, y: 0, scale: 1, yaw: 0, pitch: 0, roll: 0 };
    let lastGaze: [number, number, number] = [0, 0, 0];
    let lastAnchorW = 0;
    const lastAnchor = new THREE.Vector3().copy(HEAD);
    let ready = false;
    let disposed = false;
    let homeData: Float32Array | null = null;
    let home2Data: Float32Array | null = null;
    let seedData: Float32Array | null = null;
    let side = 256;
    const zero = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RGBAFormat, THREE.FloatType);
    zero.needsUpdate = true;

    // ---- model ------------------------------------------------------------------
    Promise.all([new PCDLoader().loadAsync("/models/Zaghetto.pcd"), sampleCat("/logo-mark.png", 59750)]).then(([pts, cat]) => {
      if (disposed) return;
      const g = pts.geometry;
      g.rotateX(Math.PI); // the scan is stored upside down
      g.rotateY(0.05);
      g.rotateX(0.19);
      g.computeBoundingBox();
      const b = g.boundingBox!;
      const src = g.getAttribute("position").array as Float32Array;
      const n = src.length / 3;

      // Centre on the head line, not the bounding box: the shoulders are not symmetric.
      const H = b.max.y - b.min.y, rows = 48, rowH = (0.45 * H) / rows;
      const lo = new Float32Array(rows).fill(Infinity), hi = new Float32Array(rows).fill(-Infinity);
      for (let i = 0; i < n; i++) {
        const y = src[i * 3 + 1];
        if (y < b.max.y - 0.45 * H) continue;
        const r = Math.min(rows - 1, Math.floor((b.max.y - y) / rowH));
        lo[r] = Math.min(lo[r], src[i * 3]);
        hi[r] = Math.max(hi[r], src[i * 3]);
      }
      const centres: number[] = [];
      for (let r = 0; r < rows; r++) if (Number.isFinite(lo[r])) centres.push((lo[r] + hi[r]) / 2);
      centres.sort((p, q) => p - q);
      const cx = centres[Math.floor(centres.length / 2)] ?? 0;
      const cy = (b.min.y + b.max.y) / 2, cz = (b.min.z + b.max.z) / 2;

      const home = new Float32Array(n * 3);
      const seed = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        home[i * 3] = src[i * 3] - cx;
        home[i * 3 + 1] = src[i * 3 + 1] - cy;
        home[i * 3 + 2] = src[i * 3 + 2] - cz;
        seed[i * 3] = Math.random(); seed[i * 3 + 1] = Math.random(); seed[i * 3 + 2] = Math.random();
      }
      box.setFromArray(home);
      box.getSize(size);
      box.getCenter(centre);
      top = box.max.y;

      // The cat, scaled to the bust and centred on the head point, so the same pose maths places it.
      const catH = size.y * CAT_HEIGHT;
      const home2 = new Float32Array(n * 3);
      const col2 = new Float32Array(n * 3);
      const m = Math.min(n, cat.pos.length / 3);
      for (let i = 0; i < n; i++) {
        const j = i < m ? i : i % m;
        home2[i * 3] = cat.pos[j * 3] * catH;
        home2[i * 3 + 1] = cat.pos[j * 3 + 1] * catH + HEAD_Y;
        home2[i * 3 + 2] = cat.pos[j * 3 + 2] * catH;
        col2[i * 3] = cat.col[j * 3]; col2[i * 3 + 1] = cat.col[j * 3 + 1]; col2[i * 3 + 2] = cat.col[j * 3 + 2];
      }

      // Each point owns a texel in the liquid's state texture.
      side = 2 ** Math.ceil(Math.log2(Math.sqrt(n)));
      const ref = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) {
        ref[i * 2] = ((i % side) + 0.5) / side;
        ref[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side;
      }
      homeData = home; home2Data = home2; seedData = seed;

      const geo = new THREE.InstancedBufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0], 3));
      geo.setIndex([0, 1, 2, 2, 1, 3]);
      geo.setAttribute("aHome", new THREE.InstancedBufferAttribute(home, 3));
      geo.setAttribute("aHome2", new THREE.InstancedBufferAttribute(home2, 3));
      geo.setAttribute("aColor2", new THREE.InstancedBufferAttribute(col2, 3));
      geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 3));
      geo.setAttribute("aRef", new THREE.InstancedBufferAttribute(ref, 2));
      geo.instanceCount = n;

      const span = Math.max(size.x, size.y) + 0.3;
      const uniforms = {
        uSize: { value: POINT_SIZE }, uStreak: { value: 0.8 }, uScatter: { value: 0 }, uTime: { value: 0 },
        uPresence: { value: 0 }, uStirR: { value: 0.1 }, uUnits: { value: 0.001 },
        uViewport: { value: new THREE.Vector2(1, 1) }, uCenter: { value: new THREE.Vector2(0, HEAD_Y) },
        uMouse: { value: new THREE.Vector2(9, 9) }, uVelPx: { value: new THREE.Vector2() },
        uRadius: { value: 0.4 }, uGrain: { value: 0.335 }, uDim: { value: 0 },
        uHead: { value: new THREE.Vector2() }, uHeadR: { value: 0.2 },
        uMorph: { value: 0 }, uLiquid: { value: 0 }, uAlpha: { value: 1 }, uGlowK: { value: GLOW },
        uState: { value: zero as THREE.Texture }, uFlow: { value: zero as THREE.Texture },
        uOrigin: { value: new THREE.Vector2(centre.x - span / 2, centre.y - span / 2) }, uSpan: { value: span },
      };
      material = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms,
        transparent: true, depthWrite: true,
      });
      glowMaterial = new THREE.ShaderMaterial({
        vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, uniforms, defines: { GLOW: 1 },
        transparent: true, depthWrite: false, depthTest: false,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
        blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      });
      mesh = new THREE.Mesh(geo, material);
      mesh.frustumCulled = false;
      mesh.position.y = -box.min.y; // the bust's base sits on the rig's pivot
      mesh.renderOrder = 2;
      glow = new THREE.Mesh(geo, glowMaterial);
      glow.frustumCulled = false;
      glow.position.y = -box.min.y;
      glow.renderOrder = 0;

      // The solid man: the same scan as one continuous, lit surface.
      solidMaterial = new THREE.MeshStandardMaterial({
        color: 0xcfa78d, roughness: 0.6, metalness: 0, transparent: true, opacity: 0, side: THREE.DoubleSide,
      });
      solid = new THREE.Mesh(buildRelief(home, box), solidMaterial);
      solid.frustumCulled = false;
      solid.position.y = -box.min.y;
      solid.renderOrder = 1;
      solid.visible = false;
      rig.add(glow, solid, mesh);
      ready = true;
      fit();
      wake();
    });

    // ---- liquid (created lazily, on the first live pointer move) ----------------------
    let liquid: Liquid | null = null;
    let liquidTried = false;
    const initLiquid = () => {
      liquidTried = true;
      if (!homeData || !home2Data || !seedData || !material) return null;
      if (!renderer.extensions.has("EXT_color_buffer_float") && !renderer.extensions.has("EXT_color_buffer_half_float")) return null;
      const gpu = new GPUComputationRenderer(side, side, renderer);
      gpu.setDataType(THREE.HalfFloatType);
      const n = homeData.length / 3;
      const mk = (src: Float32Array) => {
        const data = new Float32Array(side * side * 4);
        for (let i = 0; i < n; i++) {
          data[i * 4] = src[i * 3]; data[i * 4 + 1] = src[i * 3 + 1]; data[i * 4 + 2] = seedData![i * 3]; data[i * 4 + 3] = 1;
        }
        const t = new THREE.DataTexture(data, side, side, THREE.RGBAFormat, THREE.FloatType);
        t.needsUpdate = true;
        return t;
      };
      const flow = gpu.addVariable("flow", FLOW, gpu.createTexture());
      const state = gpu.addVariable("state", STATE, gpu.createTexture());
      gpu.setVariableDependencies(flow, [flow]);
      gpu.setVariableDependencies(state, [state, flow]);
      flow.minFilter = THREE.LinearFilter;
      flow.magFilter = THREE.LinearFilter;
      const u = material.uniforms;
      Object.assign(flow.material.uniforms, {
        uMouse: { value: new THREE.Vector2(9, 9) }, uVel: { value: new THREE.Vector2() }, uOrigin: { value: u.uOrigin.value },
        uPresence: { value: 0 }, uUnits: { value: 0.001 }, uDecay: { value: 0.968 }, uInkDecay: { value: 0.97 },
        uRadius: { value: 150 }, uInkRadius: { value: 110 }, uSpan: { value: u.uSpan.value },
      });
      Object.assign(state.material.uniforms, {
        tHome: { value: mk(homeData) }, tHome2: { value: mk(home2Data) }, uOrigin: { value: u.uOrigin.value },
        uMorph: { value: 0 }, uUnits: { value: 0.001 }, uDt: { value: 1 }, uTurb: { value: 0.6 }, uReturn: { value: 1.2 },
        uTime: { value: 0 }, uSpan: { value: u.uSpan.value },
      });
      const err = gpu.init();
      if (err) {
        console.warn("Liquid unavailable:", err);
        return null;
      }
      return { gpu, flow, state };
    };

    // ---- layout -------------------------------------------------------------------
    const fit = () => {
      if (!ready) return;
      const view = Math.max(size.y / SIZE, size.x / (WIDE * aspect));
      camera.position.set(0, 0, view / 2 / Math.tan((FOV / 2) * DEG));
      camera.aspect = aspect;
      camera.near = 0.01; camera.far = 40;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      heroY = (-view / 2 - BLEED * view + (HEAD_Y - box.min.y)) / (view / 2);
      unitsPerPx = view / vh;
      place(lastPose, lastGaze, lastAnchorW, lastAnchor);
    };

    // The rig scale that makes the eye opening span EYE_FILL of the viewport, perspective included.
    const eyeScale = (mobile: boolean) => {
      const F = mobile ? EYE_FILL_MOBILE : EYE_FILL;
      const w = 2 * Math.tan((FOV / 2) * DEG) * aspect;
      return (F * w * camera.position.z) / (EYE_W + F * w * EYE.z);
    };

    const tmp = new THREE.Vector3();
    const tmp2 = new THREE.Vector3();
    const lift = new THREE.Vector3();
    const anchorInRig = new THREE.Vector3();
    /** Put `anchor` (a point in the bust's own space) at the pose's NDC position, with the pose's scale and rotation. */
    const place = (pose: Pose, gaze: [number, number, number], gazeAnchor: number, anchor: THREE.Vector3) => {
      lastPose = pose; lastGaze = gaze; lastAnchorW = gazeAnchor; lastAnchor.copy(anchor);
      if (!ready || !mesh || !material) return;
      const s = pose.scale;
      rig.scale.setScalar(s);
      anchorInRig.set(anchor.x, anchor.y - box.min.y, anchor.z);
      // First pin the anchor using the anchored rotation, then apply the full gaze.
      rig.rotation.set(pose.pitch + gaze[0] * gazeAnchor, pose.yaw + gaze[1] * gazeAnchor, pose.roll + gaze[2] * gazeAnchor);
      lift.copy(anchorInRig).multiplyScalar(s).applyEuler(rig.rotation);
      const half = (camera.position.z - lift.z) * Math.tan((FOV / 2) * DEG);
      rig.position.set(pose.x * half * aspect - lift.x, pose.y * half - lift.y, 0);
      rig.rotation.set(pose.pitch + gaze[0], pose.yaw + gaze[1], pose.roll + gaze[2]);
      rig.updateMatrixWorld(true);

      localPerPx = unitsPerPx / s;
      const u = material.uniforms;
      u.uUnits.value = localPerPx;
      u.uSize.value = POINT_SIZE * s;
      u.uStirR.value = 150 * localPerPx;
      tmp.set(0, HEAD_Y, 0);
      mesh.localToWorld(tmp);
      tmp.project(camera);
      u.uHead.value.set(tmp.x, tmp.y);
      const headPx = (2 * (top - HEAD_Y) * s) / unitsPerPx;
      u.uHeadR.value = Math.max(headPx / vh, 1e-3);
    };

    const measure = () => {
      const topOf = (id: string) => {
        const el = document.getElementById(id);
        return el ? el.getBoundingClientRect().top + window.scrollY : 0;
      };
      tops = { os: topOf("story-os"), services: topOf("services"), process: topOf("process"), real: topOf("real") };
    };

    const resize = () => {
      vw = window.innerWidth; vh = window.innerHeight; aspect = vw / vh;
      renderer.setSize(vw, vh, false);
      if (material) material.uniforms.uViewport.value.set(vw, vh);
      measure();
      fit();
      wake();
    };

    // ---- scroll -> pose and the eye timeline --------------------------------------------
    const at = (y: number) => {
      const around = (t: number, [a, b]: [number, number]) => smooth(t + a * vh, t + b * vh, y);
      const inOS = around(tops.os, OS_IN), outOS = around(tops.os, OS_OUT), toLeft = around(tops.services, TO_LEFT);
      const u = clamp((y - (tops.process + WINDOW[0] * vh)) / ((WINDOW[1] - WINDOW[0]) * vh));
      const sideMix = smooth(0.3, 0.7, u);
      let scatter = reduced ? 0 : smooth(0, 0.4, u) * (1 - smooth(0.6, 1, u));
      const centrePose: Pose = { x: 0, y: heroY - CENTER_DROP * inOS * (1 - outOS), scale: 1, yaw: 0, pitch: 0, roll: 0 };
      const pose = { ...centrePose };
      for (const k of POSE_KEYS) {
        const scr = LEFT[k] + (RIGHT[k] - LEFT[k]) * sideMix;
        pose[k] = centrePose[k] + (scr - centrePose[k]) * toLeft;
      }
      pose.scale *= 1 - CONDENSE * scatter;
      let dim = toLeft;

      // The eye sequence, measured in viewports from the top of the eye section.
      const q = tops.real ? (y - tops.real) / vh : -9;
      const mobile = vw < 768;
      const front = mobile ? FRONT_MOBILE : FRONT;
      const toFront = smooth(0, 1, q);
      for (const k of POSE_KEYS) pose[k] += (front[k] - pose[k]) * toFront;
      dim *= 1 - toFront;
      let solidMix = smooth(S.SOLID[0], S.SOLID[1], q);
      const approach = smooth(S.APPROACH[0], S.APPROACH[1], q);
      let anchor = smooth(S.APPROACH[0], S.APPROACH[0] + 0.35, q);
      const eyePose: Pose = { x: 0, y: 0, scale: eyeScale(mobile), yaw: 0, pitch: 0, roll: 0 };
      for (const k of POSE_KEYS) pose[k] += (eyePose[k] - pose[k]) * approach;
      let alpha = 1 - smooth(S.HANDOVER[0], S.HANDOVER[1], q);
      let morph = 0;
      if (q >= S.CAT_SWITCH) {
        // Hidden behind the dive, the cloud is re-targeted: the cat, as dust, condensing as the ending arrives.
        Object.assign(pose, mobile ? CAT_MOBILE : CAT);
        morph = 1;
        solidMix = 0;
        anchor = 0;
        dim = 0;
        scatter = reduced ? 0 : 1 - smooth(S.CAT_IN[0], S.CAT_IN[1], q);
        alpha = smooth(S.CAT_IN[0], S.CAT_IN[0] + 0.3, q);
      }
      const look = smooth(0.15, 0.6, q) * (1 - smooth(0.75, 1.05, q));
      const gazeW = Math.max(1 - inOS, look, morph * 0.6);
      const floatW = Math.max(inOS * (1 - smooth(1.0, 1.5, q)), morph);
      return { pose, scatter, hero: 1 - inOS, dim, q, solid: solidMix, anchor, alpha, morph, gazeW, floatW };
    };

    // ---- state ----------------------------------------------------------------------------
    const POSE = { k: 30, c: 11 }, TURN = { k: 110, c: 15 }, SWAY = { k: 45, c: 9 };
    const sp = {
      x: new Spring(0, POSE.k, POSE.c), y: new Spring(0, POSE.k, POSE.c), scale: new Spring(1, POSE.k, POSE.c),
      yaw: new Spring(0, POSE.k, POSE.c), pitch: new Spring(0, POSE.k, POSE.c), roll: new Spring(0, POSE.k, POSE.c),
      dust: new Spring(0, 26, 10), hero: new Spring(1, POSE.k, POSE.c), dim: new Spring(0, POSE.k, POSE.c),
      solid: new Spring(0, POSE.k, POSE.c), anchor: new Spring(0, POSE.k, POSE.c), alpha: new Spring(1, POSE.k, POSE.c),
      morph: new Spring(0, POSE.k, POSE.c), gw: new Spring(1, POSE.k, POSE.c), fw: new Spring(0, POSE.k, POSE.c),
      gYaw: new Spring(0, TURN.k, TURN.c), gPitch: new Spring(0, TURN.k, TURN.c), gRoll: new Spring(0, SWAY.k, SWAY.c),
      fx: new Spring(0, 10, 6), fy: new Spring(0, 10, 6),
      gx: new Spring(0, 18, 8, 1e-5), gy: new Spring(HEAD_Y, 18, 8, 1e-5),
    };
    const springs = Object.values(sp);
    const anchorNow = new THREE.Vector3();

    let pointerOn = false, px = 0, py = 0, pointerAt = 0;
    let presence = 0, presenceFrames = 0;
    const mEased = new THREE.Vector2(), mPrev = new THREE.Vector2(), wake2 = new THREE.Vector2();
    let mInit = false;
    const ray = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    const o = new THREE.Vector3(), d = new THREE.Vector3();

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch" || reduced || !finePointer.matches) return;
      px = e.clientX; py = e.clientY; pointerOn = true; pointerAt = performance.now();
      if (!liquid && !liquidTried && ready) liquid = initLiquid();
      wake();
    };
    const onOut = (e: MouseEvent) => { if (!e.relatedTarget) { pointerOn = false; wake(); } };

    // ---- loop -----------------------------------------------------------------------------------
    let raf = 0, running = false, last = 0, near = true, clock = 0;
    const wake = () => {
      if (!running && near && ready) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    };

    const setTargets = (t: ReturnType<typeof at>) => {
      sp.x.t = t.pose.x; sp.y.t = t.pose.y; sp.scale.t = t.pose.scale; sp.yaw.t = t.pose.yaw;
      sp.pitch.t = t.pose.pitch; sp.roll.t = t.pose.roll; sp.dust.t = t.scatter; sp.hero.t = t.hero; sp.dim.t = t.dim;
      sp.solid.t = t.solid; sp.anchor.t = t.anchor; sp.alpha.t = t.alpha; sp.morph.t = t.morph; sp.gw.t = t.gazeW; sp.fw.t = t.floatW;
    };

    const frame = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.25);
      last = now;
      clock += dt;
      const f = clamp(dt * 60, 0.25, 3);
      const y = window.scrollY;
      const t = at(y);
      setTargets(t);

      if (pointerOn && now - pointerAt > 1500) pointerOn = false; // a still cursor counts as gone

      // Pointer ray, using the canvas's on-screen box (it is scaled while the frame is zoomed out).
      const rect = canvas.getBoundingClientRect();
      let hitLocalX = 0, hitLocalY = HEAD_Y, haveHit = false;
      if (pointerOn && rect.width > 0 && mesh && sp.alpha.x > 0.05) {
        const nx = ((px - rect.left) / rect.width) * 2 - 1, ny = 1 - ((py - rect.top) / rect.height) * 2;
        ray.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
        // Gaze: where the ray crosses a plane in front of the bust.
        const tg = (GAZE_D - camera.position.z) / ray.z;
        const hx = camera.position.x + ray.x * tg, hy = camera.position.y + ray.y * tg;
        tmp.set(0, HEAD_Y, 0);
        mesh.localToWorld(tmp);
        const gw = sp.gw.x * (1 - 0.45 * sp.morph.x);
        sp.gYaw.t = clamp(Math.atan2(hx - tmp.x, GAZE_D), -0.6, 0.6) * gw;
        sp.gPitch.t = clamp(Math.atan2(tmp.y - hy, GAZE_D), -0.35, 0.3) * gw;
        sp.gRoll.t = -sp.gYaw.t * 0.18;
        // Cursor in the bust's own space, for the colour gradient and the stirring.
        inv.copy(mesh.matrixWorld).invert();
        o.copy(camera.position).applyMatrix4(inv);
        d.copy(camera.position).add(ray).applyMatrix4(inv).sub(o).normalize();
        const tl = -o.z / d.z;
        hitLocalX = o.x + d.x * tl; hitLocalY = o.y + d.y * tl;
        haveHit = true;
        sp.fx.t = clamp((px / vw) * 2 - 1, -1, 1);
        sp.fy.t = clamp(1 - (py / vh) * 2, -1, 1);
      } else {
        sp.gYaw.t = 0; sp.gPitch.t = 0; sp.gRoll.t = 0; sp.fx.t = 0; sp.fy.t = 0;
      }
      sp.gx.t = haveHit ? clamp(hitLocalX, box.min.x - 0.1, box.max.x + 0.1) : 0;
      sp.gy.t = haveHit ? clamp(hitLocalY, box.min.y - 0.1, box.max.y + 0.1) : HEAD_Y;

      if (reduced) springs.forEach((s) => s.snap()); else springs.forEach((s) => s.step(dt));

      const gazeAnchor = 1 - sp.hero.x;
      const fl = sp.fw.x;
      anchorNow.copy(HEAD).lerp(EYE, sp.anchor.x);
      place(
        {
          x: sp.x.x + sp.fx.x * 0.035 * fl, y: sp.y.x + sp.fy.x * 0.05 * fl, scale: sp.scale.x,
          yaw: sp.yaw.x + sp.fx.x * 0.07 * fl, pitch: sp.pitch.x - sp.fy.x * 0.04 * fl, roll: sp.roll.x,
        },
        [sp.gPitch.x, sp.gYaw.x, sp.gRoll.x],
        gazeAnchor,
        anchorNow,
      );

      // Liquid: the stirring field follows an eased cursor and fades in and out.
      if (haveHit) {
        if (!mInit) { mEased.set(hitLocalX, hitLocalY); mPrev.copy(mEased); mInit = true; }
        mEased.x += (hitLocalX - mEased.x) * (1 - 0.78 ** f);
        mEased.y += (hitLocalY - mEased.y) * (1 - 0.78 ** f);
      }
      const target = haveHit ? 1 : 0;
      presence += (target - presence) * (1 - (1 - (target ? 0.1 : 0.035)) ** f);
      presenceFrames = presence > 0.001 ? 270 : Math.max(0, presenceFrames - f);
      const vx = clamp((mEased.x - mPrev.x) / localPerPx / f, -60, 60);
      const vy = clamp((mEased.y - mPrev.y) / localPerPx / f, -60, 60);
      wake2.x += (vx - wake2.x) * 0.5; wake2.y += (vy - wake2.y) * 0.5;
      mPrev.copy(mEased);

      if (material) {
        const u = material.uniforms;
        u.uScatter.value = sp.dust.x;
        u.uDim.value = sp.dim.x;
        u.uTime.value = clock;
        u.uPresence.value = presence;
        u.uMouse.value.set(mEased.x, mEased.y);
        u.uVelPx.value.set(wake2.x / 40, wake2.y / 40).multiplyScalar(40 / 8);
        u.uCenter.value.set(sp.gx.x, sp.gy.x);
        u.uMorph.value = sp.morph.x;
        u.uAlpha.value = 1 - 0.85 * sp.solid.x;
        if (liquid && (presenceFrames > 0 || haveHit)) {
          const fu = liquid.flow.material.uniforms, su = liquid.state.material.uniforms;
          fu.uMouse.value.copy(mEased);
          fu.uVel.value.set(clamp(wake2.x / 40, -1, 1), clamp(wake2.y / 40, -1, 1));
          fu.uPresence.value = presence;
          fu.uUnits.value = localPerPx;
          fu.uDecay.value = 0.968 ** f;
          fu.uInkDecay.value = 0.97 ** f;
          su.uUnits.value = localPerPx;
          su.uDt.value = f;
          su.uMorph.value = sp.morph.x;
          su.uTime.value = clock;
          liquid.gpu.compute();
          u.uState.value = liquid.gpu.getCurrentRenderTarget(liquid.state).texture;
          u.uFlow.value = liquid.gpu.getCurrentRenderTarget(liquid.flow).texture;
          u.uLiquid.value = 1;
        }
      }
      if (solid && solidMaterial) {
        solidMaterial.opacity = sp.solid.x;
        solid.visible = sp.solid.x > 0.002;
      }
      canvas.style.opacity = sp.alpha.x.toFixed(3);

      renderer.render(scene, camera);

      // Publish the timeline and where the eye is on screen, for the drawn eye and the portfolio.
      if (mesh) {
        tmp.copy(EYE); mesh.localToWorld(tmp); tmp.project(camera);
        const eyeX = ((tmp.x + 1) / 2) * vw, eyeY = ((1 - tmp.y) / 2) * vh;
        tmp2.copy(EYE); tmp2.x += EYE_W / 2; mesh.localToWorld(tmp2); tmp2.project(camera);
        const eyeR = Math.abs(((tmp2.x + 1) / 2) * vw - eyeX);
        storyBus.emit({ q: t.q, eyeX, eyeY, eyeR, bustAlpha: sp.alpha.x });
      }

      const alive = sp.morph.x > 0.5 && sp.alpha.x > 0.01; // the cat breathes, so it keeps drawing
      const moving = !springs.every((s) => s.still) || sp.dust.x > 1e-3 || presenceFrames > 0 || pointerOn || alive;
      if (moving && near) raf = requestAnimationFrame(frame);
      else running = false;
    };

    const io = new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) wake(); }, { rootMargin: "50% 0px" });
    io.observe(story);
    const ro = new ResizeObserver(() => { measure(); wake(); });
    ro.observe(story);

    const onScroll = () => wake();
    const onVis = () => { if (!document.hidden) wake(); };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseout", onOut);
    document.addEventListener("visibilitychange", onVis);
    resize();
    // Start in the right pose even when the page loads mid-scroll.
    setTargets(at(window.scrollY));
    springs.forEach((s) => s.snap());

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseout", onOut);
      document.removeEventListener("visibilitychange", onVis);
      liquid?.gpu.dispose();
      mesh?.geometry.dispose();
      solid?.geometry.dispose();
      material?.dispose();
      glowMaterial?.dispose();
      solidMaterial?.dispose();
      zero.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="story-cat" />;
}

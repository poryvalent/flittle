"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

/**
 * Opening hero. A giant FLITTLE wordmark on off-white; moving the pointer
 * (or a finger) paints a gooey ink trail that reveals what lives under the
 * page: a real fluid. A GPU Navier-Stokes simulation (semi-Lagrangian
 * advection, vorticity confinement, a Jacobi pressure solve) carries ink in
 * Flittle's colours, so the ink actually flows and curls where you move.
 * The trail is a small 2D canvas used as a mask; one WebGL pass warps its
 * edges, adds a ghost rim, shows the fluid only inside the mask and repaints
 * the wordmark white there. Without WebGL2 float render targets the fluid
 * gives way to a churning noise field, so the hero never goes blank.
 */

const TRAIL_SCALE = 0.25;
const SIM_RES = 160; // velocity and pressure grid height
const DYE_RES = 512; // ink grid height
const PRESSURE_ITERS = 20;
const SPLAT_FORCE = 6000;
const SPLAT_RADIUS = 0.0022;
const CURL = 28;
const DYE_DISSIPATION = 0.5;
const VEL_DISSIPATION = 0.15;
// Flittle's ink: lilac, sun, mint and a paper white, cycled slowly as you draw.
const INKS: [number, number, number][] = [
  [0.655, 0.522, 0.788],
  [0.961, 0.867, 0.431],
  [0.749, 0.902, 0.886],
  [0.93, 0.9, 0.84],
];

const VERT = `
attribute vec2 p;
varying vec2 vUv;
void main(){ vUv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

// Every simulation pass shares this vertex stage: it hands the fragment stage its four neighbours.
const SIM_VERT = `
precision highp float;
attribute vec2 p;
uniform vec2 texelSize;
varying vec2 vUv, vL, vR, vT, vB;
void main(){
  vUv = p * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0); vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y); vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const CLEAR_FRAG = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float value;
void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`;

const SPLAT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float aspectRatio, radius;
uniform vec3 color;
uniform vec2 point;
void main(){
  vec2 p = vUv - point; p.x *= aspectRatio;
  vec3 splat = exp(-dot(p, p) / radius) * color;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + splat, 1.0);
}`;

const ADVECT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity, uSource;
uniform vec2 texelSize;
uniform float dt, dissipation;
void main(){
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
}`;

const DIVERGENCE_FRAG = `
precision mediump float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_FRAG = `
precision mediump float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity;
void main(){
  float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `
precision highp float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uVelocity, uCurl;
uniform float curl, dt;
void main(){
  float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`;

const PRESSURE_FRAG = `
precision mediump float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure, uDivergence;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  float div = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_FRAG = `
precision mediump float;
varying vec2 vUv, vL, vR, vT, vB;
uniform sampler2D uPressure, uVelocity;
void main(){
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  vec2 v = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(v, 0.0, 1.0);
}`;

// The reveal pass. Ashima / Ian McEwan 2D simplex noise boils the mask edges.
const SHOW_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTrail, uText, uDye;
uniform vec2 uRes, uTextOff;
uniform float uTime, uHasFluid;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}

float trailAt(vec2 uv){ return texture2D(uTrail, vec2(uv.x, 1.0 - uv.y)).r; }

// Fallback field for devices without float render targets: charcoal washed
// with lilac, sun and mint, warped twice so it keeps churning.
vec3 inkField(vec2 uv, float time, vec2 asp){
  vec2 q = uv * asp * 1.7;
  float t = time * 0.11;
  float a = snoise(q + vec2(t, -t));
  float b = snoise(q * 1.6 + vec2(a * 1.3, t * 1.4) + 3.0);
  float c = snoise(q * 0.9 - vec2(b, a) * 0.9 + 9.0);
  vec3 col = mix(vec3(0.153, 0.169, 0.180), vec3(0.655, 0.522, 0.788), smoothstep(-0.55, 0.45, a));
  col = mix(col, vec3(0.961, 0.867, 0.431), smoothstep(0.15, 0.85, b) * 0.9);
  col = mix(col, vec3(0.749, 0.902, 0.886), smoothstep(0.45, 0.95, c) * 0.85);
  return col;
}

void main(){
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  float t = uTime * 0.25;
  vec2 n  = vec2(snoise(uv*asp*3.2 + vec2(t,-t)), snoise(uv*asp*3.2 + vec2(-t,t) + 17.0));
  vec2 n2 = vec2(snoise(uv*asp*9.0 + t*2.0),      snoise(uv*asp*9.0 - t*2.0 + 5.0));
  vec2 wuv = uv + n*0.03 + n2*0.006;

  float v = trailAt(wuv);
  float mask = smoothstep(0.42, 0.445, v);
  float vg = trailAt(wuv + vec2(-0.008, 0.010));
  float rim = smoothstep(0.33, 0.35, vg) * (1.0 - mask);

  float e = 1.5 / uRes.x;
  vec2 grad = vec2(
    trailAt(wuv + vec2(e*4.0, 0.0)) - trailAt(wuv - vec2(e*4.0, 0.0)),
    trailAt(wuv + vec2(0.0, e*4.0)) - trailAt(wuv - vec2(0.0, e*4.0)));

  // The fluid, refracted a little at the blob's edge. Ink adds light to charcoal.
  vec2 fuv = uv + grad * 0.06;
  vec3 vid;
  if (uHasFluid > 0.5) {
    vec3 dye = texture2D(uDye, fuv).rgb;
    vid = vec3(0.153, 0.169, 0.180) + dye;
    // Soft knee so pooled ink goes luminous, not clipped flat.
    float peak = max(vid.r, max(vid.g, vid.b));
    vid *= peak > 1.0 ? (1.0 + log(peak)) / peak : 1.0;
  } else {
    vid = inkField(fuv, uTime, asp);
  }
  vid = pow(vid, vec3(0.92)) * 1.06;

  vec2 tuv = vec2(uv.x, 1.0 - uv.y);
  vec4 t1 = texture2D(uText, tuv - uTextOff);
  vec4 t2 = texture2D(uText, tuv - uTextOff * 2.2);
  vid = mix(vid, t2.rgb, t2.a * 0.35 * (1.0 - t1.a));
  vid = mix(vid, t1.rgb, t1.a);

  vec3 rimCol = vec3(0.86, 0.86, 0.90);
  float alpha = mask + rim * 0.55;
  vec3 color = vid * mask + rimCol * rim * 0.55;
  gl_FragColor = vec4(color, alpha);
}`;

type Droplet = { x: number; y: number; vx: number; vy: number; r: number; life: number };
type FBO = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number; texel: [number, number] };
type DoubleFBO = { read: FBO; write: FBO; texel: [number, number]; swap: () => void };
type Prog = { prog: WebGLProgram; u: (name: string) => WebGLUniformLocation | null };

export function InkHero() {
  const heroRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const hero = heroRef.current!;
    const canvas = canvasRef.current!;
    const mark = markRef.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const attrs = { premultipliedAlpha: true, alpha: true, antialias: false };
    const gl2 = canvas.getContext("webgl2", attrs) as WebGL2RenderingContext | null;
    const gl = (gl2 ?? canvas.getContext("webgl", attrs)) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) return;
    const fluidOK = !!gl2 && !!gl2.getExtension("EXT_color_buffer_float");

    // ---- programs --------------------------------------------------------
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn("Ink hero shader", gl.getShaderInfoLog(s));
      return s;
    };
    const makeProgram = (vs: string, fs: string): Prog | null => {
      const prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, vs));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(prog, 0, "p");
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        console.warn("Ink hero program failed", gl.getProgramInfoLog(prog));
        return null;
      }
      const cache = new Map<string, WebGLUniformLocation | null>();
      return {
        prog,
        u: (name) => {
          if (!cache.has(name)) cache.set(name, gl.getUniformLocation(prog, name));
          return cache.get(name)!;
        },
      };
    };

    const show = makeProgram(VERT, SHOW_FRAG);
    if (!show) return;
    const sim = fluidOK
      ? {
          clear: makeProgram(SIM_VERT, CLEAR_FRAG),
          splat: makeProgram(SIM_VERT, SPLAT_FRAG),
          advect: makeProgram(SIM_VERT, ADVECT_FRAG),
          divergence: makeProgram(SIM_VERT, DIVERGENCE_FRAG),
          curl: makeProgram(SIM_VERT, CURL_FRAG),
          vorticity: makeProgram(SIM_VERT, VORTICITY_FRAG),
          pressure: makeProgram(SIM_VERT, PRESSURE_FRAG),
          gradient: makeProgram(SIM_VERT, GRADIENT_FRAG),
        }
      : null;
    const hasFluid = !!sim && Object.values(sim).every(Boolean);

    // One quad for every pass, on attribute 0.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const bindTex = (tex: WebGLTexture | null, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      return unit;
    };
    const makeTex = () => {
      const t = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return t;
    };
    const trailTex = makeTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    const textTex = makeTex();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));

    gl.useProgram(show.prog);
    gl.uniform1i(show.u("uTrail"), 0);
    gl.uniform1i(show.u("uText"), 1);
    gl.uniform1i(show.u("uDye"), 2);
    gl.uniform1f(show.u("uHasFluid"), hasFluid ? 1 : 0);

    // ---- fluid buffers ----------------------------------------------------
    let W = 0, H = 0, DPR = 1;
    let vel: DoubleFBO | null = null, dye: DoubleFBO | null = null, pressure: DoubleFBO | null = null;
    let divergence: FBO | null = null, curl: FBO | null = null;

    const createFBO = (w: number, h: number): FBO => {
      const tex = makeTex();
      gl2!.texImage2D(gl.TEXTURE_2D, 0, gl2!.RGBA16F, w, h, 0, gl.RGBA, gl2!.HALF_FLOAT, null);
      const fb = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h, texel: [1 / w, 1 / h] };
    };
    const createDouble = (w: number, h: number): DoubleFBO => {
      const d = { read: createFBO(w, h), write: createFBO(w, h), texel: [1 / w, 1 / h] as [number, number], swap() { const t = d.read; d.read = d.write; d.write = t; } };
      return d;
    };
    const destroyFBO = (f: FBO | null) => { if (f) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fb); } };
    const destroyDouble = (d: DoubleFBO | null) => { if (d) { destroyFBO(d.read); destroyFBO(d.write); } };

    const buildFluid = () => {
      if (!hasFluid) return;
      destroyDouble(vel); destroyDouble(dye); destroyDouble(pressure); destroyFBO(divergence); destroyFBO(curl);
      const aspect = W / H;
      const simW = aspect >= 1 ? Math.round(SIM_RES * aspect) : SIM_RES;
      const simH = aspect >= 1 ? SIM_RES : Math.round(SIM_RES / aspect);
      const dyeW = Math.min(1024, aspect >= 1 ? Math.round(DYE_RES * aspect) : DYE_RES);
      const dyeH = aspect >= 1 ? DYE_RES : Math.min(1024, Math.round(DYE_RES / aspect));
      vel = createDouble(simW, simH);
      pressure = createDouble(simW, simH);
      divergence = createFBO(simW, simH);
      curl = createFBO(simW, simH);
      dye = createDouble(dyeW, dyeH);
    };

    const blit = (target: FBO | null) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      gl.viewport(0, 0, target ? target.w : canvas.width, target ? target.h : canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const bindProgram = (p: Prog, texel?: [number, number]) => {
      gl.useProgram(p.prog);
      if (texel) gl.uniform2f(p.u("texelSize"), texel[0], texel[1]);
      return p;
    };

    const splat = (x: number, y: number, dx: number, dy: number, c: [number, number, number]) => {
      if (!sim || !vel || !dye) return;
      const p = bindProgram(sim.splat!, vel.texel);
      const aspect = W / H;
      gl.uniform1f(p.u("aspectRatio"), aspect);
      gl.uniform2f(p.u("point"), x, y);
      gl.uniform1f(p.u("radius"), aspect > 1 ? SPLAT_RADIUS * aspect : SPLAT_RADIUS);
      gl.uniform1i(p.u("uTarget"), bindTex(vel.read.tex, 0));
      gl.uniform3f(p.u("color"), dx, dy, 0);
      blit(vel.write); vel.swap();
      gl.uniform1i(p.u("uTarget"), bindTex(dye.read.tex, 0));
      gl.uniform3f(p.u("color"), c[0], c[1], c[2]);
      blit(dye.write); dye.swap();
    };

    const stepFluid = (dt: number) => {
      if (!sim || !vel || !dye || !pressure || !divergence || !curl) return;
      let p = bindProgram(sim.curl!, vel.texel);
      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 0));
      blit(curl);

      p = bindProgram(sim.vorticity!, vel.texel);
      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 0));
      gl.uniform1i(p.u("uCurl"), bindTex(curl.tex, 1));
      gl.uniform1f(p.u("curl"), CURL);
      gl.uniform1f(p.u("dt"), dt);
      blit(vel.write); vel.swap();

      p = bindProgram(sim.divergence!, vel.texel);
      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 0));
      blit(divergence);

      p = bindProgram(sim.clear!, vel.texel);
      gl.uniform1i(p.u("uTexture"), bindTex(pressure.read.tex, 0));
      gl.uniform1f(p.u("value"), 0.8);
      blit(pressure.write); pressure.swap();

      p = bindProgram(sim.pressure!, vel.texel);
      gl.uniform1i(p.u("uDivergence"), bindTex(divergence.tex, 0));
      for (let i = 0; i < PRESSURE_ITERS; i++) {
        gl.uniform1i(p.u("uPressure"), bindTex(pressure.read.tex, 1));
        blit(pressure.write); pressure.swap();
      }

      p = bindProgram(sim.gradient!, vel.texel);
      gl.uniform1i(p.u("uPressure"), bindTex(pressure.read.tex, 0));
      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 1));
      blit(vel.write); vel.swap();

      p = bindProgram(sim.advect!, vel.texel);
      gl.uniform1f(p.u("dt"), dt);
      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 0));
      gl.uniform1i(p.u("uSource"), 0);
      gl.uniform1f(p.u("dissipation"), VEL_DISSIPATION);
      blit(vel.write); vel.swap();

      gl.uniform1i(p.u("uVelocity"), bindTex(vel.read.tex, 0));
      gl.uniform1i(p.u("uSource"), bindTex(dye.read.tex, 1));
      gl.uniform1f(p.u("dissipation"), DYE_DISSIPATION);
      blit(dye.write); dye.swap();
    };

    const ink: [number, number, number] = [0, 0, 0];
    const inkAt = (seconds: number, speed: number) => {
      const u = ((seconds * 0.11) % 1) * INKS.length;
      const i = Math.floor(u), f = u - i;
      const a = INKS[i], b = INKS[(i + 1) % INKS.length];
      const k = 0.5 + (Math.min(speed, 50) / 50) * 0.9;
      ink[0] = (a[0] + (b[0] - a[0]) * f) * k;
      ink[1] = (a[1] + (b[1] - a[1]) * f) * k;
      ink[2] = (a[2] + (b[2] - a[2]) * f) * k;
      return ink;
    };

    // ---- offscreen canvases -------------------------------------------
    const trail = document.createElement("canvas");
    const tctx = trail.getContext("2d")!;
    const text = document.createElement("canvas");
    const xctx = text.getContext("2d")!;

    const stamp = (x: number, y: number, r: number, a: number) => {
      const cx = x * TRAIL_SCALE, cy = y * TRAIL_SCALE, cr = Math.max(0.5, r * TRAIL_SCALE);
      const g = tctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.75})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      tctx.fillStyle = g;
      tctx.beginPath();
      tctx.arc(cx, cy, cr, 0, Math.PI * 2);
      tctx.fill();
    };

    // The white copy of the logo that shows inside the ink. It has the same
    // proportions as the visible wordmark, so we draw it into that wordmark's box.
    const white = new Image();
    let whiteReady = false;

    const drawText = () => {
      const hr = hero.getBoundingClientRect();
      const mr = mark.getBoundingClientRect();
      xctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      xctx.clearRect(0, 0, W, H);
      if (whiteReady && mr.width) {
        xctx.drawImage(white, mr.left - hr.left, mr.top - hr.top, mr.width, mr.height);
      }
      bindTex(textTex, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, text);
    };

    const resize = () => {
      const nw = hero.clientWidth, nh = hero.clientHeight;
      if (!nw || !nh) return;
      const changed = nw !== W || nh !== H;
      DPR = Math.min(window.devicePixelRatio || 1, 1.5);
      W = nw;
      H = nh;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      text.width = canvas.width;
      text.height = canvas.height;
      gl.useProgram(show.prog);
      gl.uniform2f(show.u("uRes"), canvas.width, canvas.height);

      // Keep existing blobs alive across a resize.
      const old = document.createElement("canvas");
      old.width = trail.width;
      old.height = trail.height;
      if (trail.width) old.getContext("2d")!.drawImage(trail, 0, 0);
      trail.width = Math.max(2, Math.round(W * TRAIL_SCALE));
      trail.height = Math.max(2, Math.round(H * TRAIL_SCALE));
      tctx.fillStyle = "#000";
      tctx.fillRect(0, 0, trail.width, trail.height);
      if (old.width) tctx.drawImage(old, 0, 0, trail.width, trail.height);
      if (changed) buildFluid();
      drawText();
    };

    // ---- pointer state --------------------------------------------------
    let active = false, mx = 0, my = 0, px = 0, py = 0, vx = 0, vy = 0, first = true;
    const drops: Droplet[] = [];
    let offX = 0, offY = 0, phase = 0;

    const setPointer = (cx: number, cy: number) => {
      const r = hero.getBoundingClientRect();
      mx = cx - r.left;
      my = cy - r.top;
      if (!active || first) {
        px = mx;
        py = my;
        first = false;
      }
      active = true;
    };
    const onMove = (e: PointerEvent) => setPointer(e.clientX, e.clientY);
    const onTouch = (e: TouchEvent) => e.touches[0] && setPointer(e.touches[0].clientX, e.touches[0].clientY);
    const onLeave = () => {
      active = false;
      first = true;
    };
    hero.addEventListener("pointermove", onMove);
    hero.addEventListener("pointerleave", onLeave);
    hero.addEventListener("touchmove", onTouch, { passive: true });
    hero.addEventListener("touchend", onLeave);

    // ---- frame loop -----------------------------------------------------
    let raf = 0, last = performance.now(), visible = true;
    const t0 = last;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || !W) return;
      const elapsed = Math.min(48, now - last);
      const dt = elapsed / 16.667;
      last = now;
      const seconds = (now - t0) / 1000;

      tctx.globalCompositeOperation = "source-over";
      tctx.fillStyle = `rgba(0,0,0,${0.022 * dt})`;
      tctx.fillRect(0, 0, trail.width, trail.height);
      tctx.globalCompositeOperation = "lighter";
      phase += 0.03 * dt;

      gl.disable(gl.BLEND);
      if (active) {
        const dx = mx - px, dy = my - py;
        const dist = Math.hypot(dx, dy);
        vx += (dx - vx) * 0.25;
        vy += (dy - vy) * 0.25;
        const speed = Math.hypot(vx, vy);
        const base = Math.min(W, H) * 0.075;
        const rad = base + Math.min(speed, 60) * 1.6 + Math.sin(phase * 2.3) * base * 0.15;
        const steps = Math.max(1, Math.ceil(dist / (rad * 0.25)));
        for (let i = 1; i <= steps; i++) {
          const k = i / steps;
          stamp(px + dx * k, py + dy * k, rad, 0.22);
        }
        if (dist < 0.5) stamp(mx, my, base * 1.1, 0.06);
        // The pointer pushes the fluid and drops ink where it moves.
        if (hasFluid && dist > 0.2) {
          const aspect = W / H;
          const fx = (dx / W) * (aspect < 1 ? aspect : 1) * SPLAT_FORCE;
          const fy = (-dy / H) * (aspect > 1 ? aspect : 1) * SPLAT_FORCE;
          splat(mx / W, 1 - my / H, fx, fy, inkAt(seconds, speed));
        }
        if (speed > 8 && Math.random() < 0.12 * dt) {
          const ang = Math.atan2(vy, vx) + Math.PI + (Math.random() - 0.5) * 2.2;
          const s = 1 + Math.random() * 2;
          drops.push({
            x: mx + Math.cos(ang) * rad * 1.3,
            y: my + Math.sin(ang) * rad * 1.3,
            vx: Math.cos(ang) * s,
            vy: Math.sin(ang) * s,
            r: base * (0.18 + Math.random() * 0.25),
            life: 1,
          });
        }
        px = mx;
        py = my;
      } else {
        vx *= 0.9;
        vy *= 0.9;
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.vx *= 0.96;
        d.vy *= 0.96;
        d.life -= 0.012 * dt;
        if (d.life <= 0) {
          drops.splice(i, 1);
          continue;
        }
        stamp(d.x, d.y, d.r, 0.35 * Math.max(0, d.life));
      }

      if (hasFluid) {
        // Three slow currents keep the ink alive between strokes.
        if (!reduced) {
          for (let i = 0; i < 3; i++) {
            const a = seconds * 0.21 + i * 2.1, b = seconds * 0.17 + i * 1.3;
            const ex = 0.5 + 0.36 * Math.sin(a), ey = 0.5 + 0.28 * Math.cos(b);
            const evx = Math.cos(a) * 0.36 * 0.21, evy = -Math.sin(b) * 0.28 * 0.17;
            const c = INKS[i % INKS.length];
            splat(ex, ey, evx * SPLAT_FORCE * 0.08, evy * SPLAT_FORCE * 0.08, [c[0] * 0.012, c[1] * 0.012, c[2] * 0.012]);
          }
        }
        stepFluid(Math.min(elapsed / 1000, 1 / 30));
      }

      offX += (vx * 0.35 - offX) * 0.12;
      offY += (vy * 0.12 - offY) * 0.12;

      bindTex(trailTex, 0);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, trail);
      bindTex(textTex, 1);
      if (dye) bindTex(dye.read.tex, 2);
      gl.useProgram(show.prog);
      gl.uniform1f(show.u("uTime"), reduced ? 4 : seconds);
      gl.uniform2f(show.u("uTextOff"), offX / W, offY / H);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      last = performance.now();
    });
    io.observe(hero);

    const ro = new ResizeObserver(resize);
    ro.observe(hero);
    resize();
    white.onload = () => { whiteReady = true; drawText(); };
    white.src = "/logo-white.png";
    if (!mark.complete) mark.addEventListener("load", resize, { once: true });
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      hero.removeEventListener("pointermove", onMove);
      hero.removeEventListener("pointerleave", onLeave);
      hero.removeEventListener("touchmove", onTouch);
      hero.removeEventListener("touchend", onLeave);
      destroyDouble(vel); destroyDouble(dye); destroyDouble(pressure); destroyFBO(divergence); destroyFBO(curl);
    };
  }, []);

  return (
    <section
      id="top"
      ref={heroRef}
      className="relative h-svh w-full overflow-hidden bg-background"
      style={{ touchAction: "pan-y" }}
    >
      <h1 className="pointer-events-none absolute inset-x-[5%] top-1/2 z-[1] -translate-y-1/2 select-none">
        {/* The logo itself is the wordmark: lowercase letters with the cat standing in for the two t's. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={markRef} src="/logo-mark.png" alt="Flittle" draggable={false} className="block h-auto w-full" />
      </h1>

      <canvas ref={canvasRef} aria-hidden className="pointer-events-none absolute inset-0 z-[2] h-full w-full" />

      <div className="absolute left-4 top-24 z-[4] max-w-[240px] text-[13px] leading-tight sm:left-8 sm:top-28 sm:max-w-[280px]">
        <div className="mb-2 text-[10px] tracking-[.02em] text-muted-foreground">Software development ©26</div>
        <p className="font-medium text-[#3a3a3a]">
          The tech team you don&rsquo;t
          <br />
          have to hire.
        </p>
        <Link
          href="/#contact"
          className="mt-3 inline-flex items-center gap-2 rounded-full bg-charcoal py-[7px] pl-3.5 pr-3 text-[10px] font-extrabold uppercase tracking-[.04em] text-white transition-transform duration-300 hover:translate-x-[3px]"
        >
          Start a project <ArrowRight className="size-2.5" strokeWidth={3} />
        </Link>
      </div>

      <div className="absolute bottom-6 left-4 z-[4] flex items-center text-[10px] text-muted-foreground sm:left-8">
        <span className="mr-2 inline-block h-[3px] w-[18px] rounded-sm bg-[#bdbdba]" />
        Scroll
      </div>
      <div className="absolute bottom-6 right-4 z-[4] text-[10px] text-muted-foreground sm:right-8">
        Roam to unveil
      </div>
    </section>
  );
}

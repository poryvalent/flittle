// The frame loop of the bust. It follows the native scroll pose directly, turns the
// head toward the pointer in the hero, lets the bust float with the pointer on the text screens,
// moves the colour gradient under the pointer, steps the liquid and renders. It runs only while
// something is still moving and sleeps otherwise; scroll, resize and pointer input wake it.
import * as THREE from 'three';
import { createLiquid } from './liquid.js';

// Spring presets: stiffness k and damping c, unit mass.
const POSE = { k: 110, c: 20 };
const DUST = { k: 90, c: 18 };
const TURN = { k: 110, c: 15 };
const SWAY = { k: 45, c: 9 };
const FLOAT = { k: 10, c: 6 };
const GLOW = { k: 18, c: 8 };
// Depth of the plane the gaze ray is intersected with, in world units in front of the head.
const GAZE_D = 0.41;
// Gaze limits, radians.
const YAW_MAX = 0.6;
const PITCH_MIN = -0.35;
const PITCH_MAX = 0.3;
// The head rolls a little against its yaw.
const ROLL_PER_YAW = -0.18;
// How far the bust floats and tilts with the pointer on the text screens.
const FLOAT_X = 0.035, FLOAT_Y = 0.05, FLOAT_YAW = 0.07, FLOAT_PITCH = 0.04;
// The gradient centre may leave the bust by this much, model units.
const GLOW_MARGIN = 0.1;
// Integration substep, seconds.
const SUBSTEP = 1 / 240;

// A damped spring on one number: semi-implicit Euler in substeps, snapping to its target when it
// is close enough to count as still.
export function spring(k, c, x = 0, eps = 1e-4) {
  return {
    k, c, x, v: 0, t: x, eps, still: true,
    step(dt) {
      dt = Math.min(0.25, Math.max(0, dt));
      const n = Math.max(1, Math.ceil(dt / SUBSTEP));
      const h = dt / n;
      for (let i = 0; i < n; i++) { this.v += (this.k * (this.t - this.x) - this.c * this.v) * h; this.x += this.v * h; }
      if (Math.abs(this.t - this.x) < this.eps && Math.abs(this.v) < this.eps * 10) { this.x = this.t; this.v = 0; this.still = true; }
      else this.still = false;
      return this.x;
    },
    snap() { this.x = this.t; this.v = 0; this.still = true; return this.x; },
  };
}

export function initCursor(cloud, scroll) {
  const root = document.documentElement;
  const { camera, uniforms } = cloud;
  const pose = {
    x: spring(POSE.k, POSE.c), y: spring(POSE.k, POSE.c), scale: spring(POSE.k, POSE.c, 1),
    yaw: spring(POSE.k, POSE.c), pitch: spring(POSE.k, POSE.c), roll: spring(POSE.k, POSE.c),
  };
  const dust = spring(DUST.k, DUST.c);
  const fade = spring(DUST.k, DUST.c);
  const become = spring(DUST.k, DUST.c);
  const hero = spring(POSE.k, POSE.c, 1);
  const dim = spring(POSE.k, POSE.c);
  const gaze = { yaw: spring(TURN.k, TURN.c), pitch: spring(TURN.k, TURN.c), roll: spring(SWAY.k, SWAY.c) };
  const float = { x: spring(FLOAT.k, FLOAT.c), y: spring(FLOAT.k, FLOAT.c) };
  const glow = { x: spring(GLOW.k, GLOW.c, 0, 1e-5), y: spring(GLOW.k, GLOW.c, cloud.HEAD_Y, 1e-5) };
  const scrollMotion = [...Object.values(pose), dust, fade, become, hero, dim];
  const pointerMotion = [...Object.values(gaze), ...Object.values(float), ...Object.values(glow)];
  const all = [...scrollMotion, ...pointerMotion];

  const fineMq = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerAllowed = () => fineMq.matches && !reducedMq.matches;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  const localRay = new THREE.Ray();
  const localHit = new THREE.Vector3();
  const pointerLocal = new THREE.Vector2();
  const t0 = performance.now();

  let pointerOn = false, px = 0, py = 0, lastMove = 0, haveLocal = false;
  let liquid = null, liquidBusy = false, liquidUnavailable = false;
  let running = false, lastT = 0, hidden = document.hidden;
  let pageY = window.scrollY, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;

  // The canvas's on-screen box, derived from the frame's transform instead of a layout read.
  function stageRect() {
    const W = viewportWidth, H = viewportHeight;
    const { s, tx, ty } = cloud.stageBox;
    const w = W * s, h = H * s;
    return { left: (W - w) / 2 + tx, top: (H - h) / 2 + ty, width: w, height: h };
  }

  function pointerRay(rect) {
    ndc.set(((px - rect.left) / rect.width) * 2 - 1, -(((py - rect.top) / rect.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    return raycaster.ray;
  }

  function aimGaze(rect, heroW) {
    const ray = pointerRay(rect);
    const t = (GAZE_D - ray.origin.z) / (ray.direction.z || -1e-6);
    hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);
    eye.copy(cloud.head).add(cloud.points.position).add(cloud.rig.position);
    const yaw = Math.min(YAW_MAX, Math.max(-YAW_MAX, Math.atan2(hit.x - eye.x, GAZE_D)));
    const pitch = Math.min(PITCH_MAX, Math.max(PITCH_MIN, Math.atan2(eye.y - hit.y, GAZE_D)));
    gaze.yaw.t = yaw * heroW;
    gaze.pitch.t = pitch * heroW;
    gaze.roll.t = gaze.yaw.t * ROLL_PER_YAW;
  }

  function aimFloat() {
    float.x.t = Math.min(1, Math.max(-1, (px / viewportWidth) * 2 - 1));
    float.y.t = Math.min(1, Math.max(-1, 1 - (py / viewportHeight) * 2));
  }

  // The pointer in the bust's own xy plane: the ray through the pointer meets the local plane z = 0.
  function aimGlow(rect) {
    const ray = pointerRay(rect);
    inv.copy(cloud.points.matrixWorld).invert();
    localRay.copy(ray).applyMatrix4(inv);
    const t = -localRay.origin.z / (localRay.direction.z || -1e-6);
    localHit.copy(localRay.direction).multiplyScalar(t).add(localRay.origin);
    pointerLocal.set(localHit.x, localHit.y);
    haveLocal = true;
    const b = cloud.box;
    glow.x.t = Math.min(b.max.x + GLOW_MARGIN, Math.max(b.min.x - GLOW_MARGIN, localHit.x));
    glow.y.t = Math.min(b.max.y + GLOW_MARGIN, Math.max(b.min.y - GLOW_MARGIN, localHit.y));
  }

  function restTargets() {
    gaze.yaw.t = 0; gaze.pitch.t = 0; gaze.roll.t = 0;
    float.x.t = 0; float.y.t = 0;
    glow.x.t = 0; glow.y.t = cloud.HEAD_Y;
  }

  function apply() {
    const f = 1 - hero.x;
    cloud.place({
      x: pose.x.x + float.x.x * FLOAT_X * f,
      y: pose.y.x + float.y.x * FLOAT_Y * f,
      scale: pose.scale.x,
      yaw: pose.yaw.x + float.x.x * FLOAT_YAW * f,
      pitch: pose.pitch.x - float.y.x * FLOAT_PITCH * f,
      roll: pose.roll.x,
    }, [gaze.pitch.x, gaze.yaw.x, gaze.roll.x], f);
    uniforms.uScatter.value = dust.x;
    uniforms.uFade.value = fade.x;
    uniforms.uBecome.value = become.x;
    cloud.handoff = become.x;
    uniforms.uDim.value = dim.x;
    uniforms.uTime.value = (performance.now() - t0) / 1000;
    uniforms.uCenter.value.set(glow.x.x, glow.y.x);
  }

  function setTargets() {
    // Reading scrollY after the dashboard writes styles forces synchronous
    // style/layout work. Scroll events provide the offset before these loops.
    const at = scroll.at(pageY, cloud.heroY);
    for (const k of Object.keys(pose)) pose[k].t = at.pose[k];
    dust.t = at.scatter;
    fade.t = at.fade;
    become.t = at.become;
    hero.t = at.hero;
    dim.t = at.dim;
  }

  function frame(now) {
    if (hidden || root.classList.contains('is-loading') || pageY <= 0) { running = false; return; }
    const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const rect = stageRect();
    const reduced = reducedMq.matches;
    setTargets();
    if (fade.t === 1 && become.t === 1 && fade.x >= .999 && become.x >= .999) {
      cloud.renderer.domElement.style.visibility = 'hidden';
      pointerOn = false; haveLocal = false;
      running = false;
      return;
    }
    cloud.renderer.domElement.style.visibility = '';
    if (reduced) dust.t = 0;
    if (pointerOn) { aimGaze(rect, hero.x); aimFloat(); aimGlow(rect); } else restTargets();
    // The browser already supplies smooth scroll positions. A second spring
    // made the bust trail behind the dashboard and keep moving after a stop.
    for (const s of scrollMotion) s.snap();
    for (const s of pointerMotion) reduced ? s.snap() : s.step(dt);
    apply();
    if (liquid) liquidBusy = liquid.update(dt, haveLocal ? pointerLocal : null, cloud.localPerPx, pointerOn, now);
    cloud.render();
    const moving = all.some((s) => !s.still) || (dust.x > 1e-3 && fade.x < .999) || liquidBusy;
    if (moving) requestAnimationFrame(frame); else running = false;
  }

  function wake() {
    if (running || hidden || root.classList.contains('is-loading') || pageY <= 0) return;
    if (fade.x >= .999 && become.x >= .999 && pageY >= scroll.tops.work - viewportHeight * .1) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  function resetPointer() {
    pointerOn = false; haveLocal = false;
    restTargets();
    for (const s of [...Object.values(gaze), ...Object.values(float), ...Object.values(glow)]) s.snap();
    wake();
  }

  function prepareInteraction() {
    if (liquid || liquidUnavailable || !pointerAllowed()) return;
    try {
      liquid = createLiquid(cloud);
      liquid.warmup();
    } catch (error) {
      liquidUnavailable = true;
      console.warn('The optional liquid interaction is unavailable.', error);
    }
  }
  cloud.prepareInteraction = prepareInteraction;

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !pointerAllowed()) return;
    if (root.classList.contains('is-cover') || root.classList.contains('is-loading')) return;
    if (fade.t === 1 && become.t === 1) return;
    px = e.clientX; py = e.clientY; lastMove = performance.now();
    pointerOn = true;
    prepareInteraction();
    aimGlow(stageRect());
    liquid?.move(pointerLocal, lastMove);
    wake();
  }, { passive: true });
  const leave = () => { if (!pointerOn) return; pointerOn = false; haveLocal = false; wake(); };
  document.documentElement.addEventListener('pointerleave', leave);
  document.documentElement.addEventListener('pointerout', (e) => { if (!e.relatedTarget) leave(); });
  const onMq = () => { if (!pointerAllowed()) resetPointer(); else wake(); };
  fineMq.addEventListener('change', onMq);
  reducedMq.addEventListener('change', onMq);

  window.addEventListener('scroll', () => { pageY = window.scrollY; wake(); }, { passive: true });
  window.addEventListener('resize', () => {
    viewportWidth = window.innerWidth; viewportHeight = window.innerHeight;
    pageY = window.scrollY;
    wake();
  });
  document.addEventListener('flittle:loaded', () => { pageY = window.scrollY; wake(); });
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) wake(); });

  // A load part-way down the page starts in that pose instead of easing into it.
  setTargets();
  for (const s of all) s.snap();
  apply();
  // During the entrance, warmup compiles this scene asynchronously first.
  if (!root.classList.contains('is-loading')) cloud.render();
  wake();
  cloud.wake = wake;
  return { wake, springs: all };
}

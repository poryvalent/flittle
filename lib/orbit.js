// The portfolio orbit. A sphere of fine particles with the project cards standing around its
// equator, slowly turning; the wheel spins it (the faster the wheel, the faster the turn), drag
// orbits the camera, hover reads the project, click opens it. The sphere starts empty: as the
// section scrolls in, the bust behind it bursts into dust and the dust's surviving points fly to
// the screen spots of the sphere's particles (the orbit tells the bust where those are, every
// frame) and hand over there, so the stars are the bust's remains. The cards grow in around them.
// This is a port of the "3d-orbit-gallery" react-three-fiber component to the page's plain
// three.js, so no React or bundler is needed. It renders only while the section is on screen.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { spring } from './cursor.js';
import { STAR_COUNT } from './cloud.js';
import { PROJECTS } from './projects.js';

// Particles: one per star-bound point of the bust, their size range (world units) and the sphere
// they sit on.
const PARTICLE_COUNT = STAR_COUNT;
const PARTICLE_SIZE_MIN = 0.03;
const PARTICLE_SIZE_MAX = 0.06;
const SPHERE_RADIUS = 9;
const POSITION_RANDOMNESS = 4;
// The cards: side length and how far a hovered card grows.
const IMAGE_SIZE = 1.5;
const HOVER_SCALE = 1.18;
// Camera as in the original demo. The view is shifted up on the screen (a lens shift, so the
// sphere keeps its look and its pivot) by this share of the frame, so the near cards end higher
// and clear the arrows along the bottom; the shift moves the scene up by half this much.
const CAMERA_POSITION = [-10, 1.5, 10];
const CAMERA_FOV = 50;
const SHIFT = 0.16;
// How far a drag may tip the camera above or below its resting height (radians): enough to feel
// the sphere, not enough to swing the ring up into the title or down into the arrows.
const TIP_UP = 0.05;
const TIP_DOWN = 0.05;
// The turn: resting speed (rad/s), what one wheel pixel adds (rad/s), the ceiling, and how long
// a kick takes to decay back toward the resting speed (s).
const SPIN_REST = 0.05;
const SPIN_KICK = 0.0045;
const SPIN_MAX = 7;
const SPIN_DECAY = 1.2;
const DAMPING = 0.05;
// Particle colours: ice blue to white, in HSL.
const HUE_MIN = 0.55, HUE_MAX = 0.6;
// The hand-over: the orbit's own particles show over this last part of it, as the bust's arriving
// points let go. The cards grow in with the section's rise (share of it, with a stagger).
const STARS_FROM = 0.92;
const CARDS_FROM = 0.45;
const CARDS_STAGGER = 0.25;
// A drag longer than this many pixels is not a click.
const CLICK_SLOP = 6;

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);
const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// A soft round sprite for the particles.
function dotTexture() {
  const s = 64;
  const cv = document.createElement('canvas'); cv.width = cv.height = s;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g; c.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// cloud is the bust: it says how far the hand-over is, and takes the stars' screen targets.
export function initOrbit(section, { cloud } = {}) {
  const canvas = section.querySelector('[data-orbit]');
  const caption = section.querySelector('[data-orbit-caption]');
  const capName = caption?.querySelector('.portfolio__name');
  const capMeta = caption?.querySelector('.portfolio__meta');
  if (!canvas) return null;
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100);
  camera.position.set(...CAMERA_POSITION);
  const group = new THREE.Group();
  scene.add(group);

  // ---- particles on a Fibonacci sphere, jittered in radius ----
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PARTICLE_COUNT);
  const col = new THREE.Color();
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
    const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;
    const r = SPHERE_RADIUS + (Math.random() - 0.5) * POSITION_RANDOMNESS;
    positions[i * 3] = r * Math.cos(theta) * Math.sin(phi);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(theta) * Math.sin(phi);
    col.setHSL(HUE_MIN + Math.random() * (HUE_MAX - HUE_MIN), 0.8, 0.6 + Math.random() * 0.3);
    colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    sizes[i] = PARTICLE_SIZE_MIN + Math.random() * (PARTICLE_SIZE_MAX - PARTICLE_SIZE_MIN);
  }
  const pgeo = new THREE.BufferGeometry();
  pgeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pgeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pgeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const pmat = new THREE.PointsMaterial({
    size: PARTICLE_SIZE_MAX * 2, map: dotTexture(), vertexColors: true, transparent: true,
    depthWrite: false, sizeAttenuation: true, opacity: 0,
  });
  // per-point size: scale the point by its own attribute
  pmat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('uniform float size;', 'uniform float size;\nattribute float aSize;')
      .replace('gl_PointSize = size;', 'gl_PointSize = size * aSize / ' + (PARTICLE_SIZE_MAX * 2).toFixed(4) + ' * 2.0;');
  };
  const points = new THREE.Points(pgeo, pmat);
  points.frustumCulled = false;
  points.visible = false;
  group.add(points);

  // ---- the project cards around the equator, facing outward ----
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  const cards = [];
  const n = PROJECTS.length;
  PROJECTS.forEach((project, i) => {
    const angle = (i / n) * Math.PI * 2;
    const pos = new THREE.Vector3(SPHERE_RADIUS * Math.cos(angle), 0, SPHERE_RADIUS * Math.sin(angle));
    const mat = new THREE.MeshBasicMaterial({ color: 0x1c1f27, side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(IMAGE_SIZE, IMAGE_SIZE), mat);
    mesh.position.copy(pos);
    mesh.lookAt(pos.clone().multiplyScalar(2));
    mesh.userData = { project, target: 1, hover: 1, grow: 0 };
    mesh.visible = false;
    group.add(mesh);
    cards.push(mesh);
    loader.load(project.image, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      // crop to a square (object-fit: cover)
      const img = tex.image;
      const aspect = img && img.width && img.height ? img.width / img.height : 1;
      if (aspect > 1) { tex.repeat.set(1 / aspect, 1); tex.offset.set((1 - 1 / aspect) / 2, 0); }
      else { tex.repeat.set(1, aspect); tex.offset.set(0, (1 - aspect) / 2); }
      mat.map = tex; mat.color.set(0xffffff); mat.needsUpdate = true;
    });
  });

  // ---- controls: drag to orbit, no zoom or pan (the wheel is the spin), damped ----
  const controls = new OrbitControls(camera, canvas);
  controls.enableZoom = false;
  controls.enablePan = false;
  controls.enableRotate = true;
  controls.autoRotate = false;
  controls.enableDamping = true;
  controls.dampingFactor = DAMPING;
  const polar = Math.acos(CAMERA_POSITION[1] / Math.hypot(...CAMERA_POSITION));
  controls.minPolarAngle = polar - TIP_UP;
  controls.maxPolarAngle = polar + TIP_DOWN;

  // ---- the spin ----
  let omega = SPIN_REST, theta = 0;
  // A wheel kick: dy in pixels, signed. Fast wheeling piles kicks up faster than they decay.
  function kick(dy) {
    omega = Math.min(SPIN_MAX, Math.max(-SPIN_MAX, omega + dy * SPIN_KICK));
    wake();
  }

  // ---- the section's rise, eased through a spring, for the cards ----
  const rise = spring(26, 10);
  function progress() {
    const top = section.getBoundingClientRect().top;
    const vh = window.innerHeight || 1;
    return clamp01((vh - top) / vh);
  }
  // How far the hand-over is: the bust's word while it is there, else the section's rise.
  const handoff = () => (cloud && cloud.ready ? cloud.handoff : rise.x);

  // ---- the stars' screen targets for the bust, in the bust's (full-viewport) clip space ----
  const v = new THREE.Vector3();
  function sendStars() {
    const data = cloud.stars.data;
    const dy = (2 * section.getBoundingClientRect().top) / (window.innerHeight || 1);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      v.fromArray(positions, i * 3).applyMatrix4(group.matrixWorld).project(camera);
      data[i * 4] = v.x; data[i * 4 + 1] = v.y - dy; data[i * 4 + 2] = 1; data[i * 4 + 3] = 0;
    }
    cloud.stars.texture.needsUpdate = true;
    cloud.wake?.();
  }

  // ---- hover and click ----
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let hovered = null, downX = 0, downY = 0;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(cards.filter((c) => c.visible), false)[0];
    return hit ? hit.object : null;
  }
  function setHovered(mesh) {
    if (mesh === hovered) return;
    if (hovered) hovered.userData.target = 1;
    hovered = mesh;
    if (hovered) {
      hovered.userData.target = HOVER_SCALE;
      const p = hovered.userData.project;
      if (capName) capName.textContent = p.title;
      if (capMeta) capMeta.textContent = [p.client, p.year].filter(Boolean).join(' · ');
      caption?.classList.add('is-on');
      canvas.style.cursor = p.url ? 'pointer' : 'grab';
    } else {
      caption?.classList.remove('is-on');
      canvas.style.cursor = 'grab';
    }
  }
  canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') setHovered(pick(e)); wake(); }, { passive: true });
  canvas.addEventListener('pointerleave', () => { setHovered(null); });
  canvas.addEventListener('pointerdown', (e) => { downX = e.clientX; downY = e.clientY; canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointerup', (e) => {
    canvas.style.cursor = hovered && hovered.userData.project.url ? 'pointer' : 'grab';
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > CLICK_SLOP) return;
    const mesh = pick(e);
    const url = mesh && mesh.userData.project.url;
    if (url) window.open(url, '_blank', 'noopener');
  });

  // ---- size and loop ----
  function resize() {
    const w = section.clientWidth || 1, h = section.clientHeight || 1;
    renderer.setSize(w, h, false);
    // The frame is taller than the canvas by SHIFT and the canvas shows its lower part; the field
    // of view widens to match, so the scene keeps its size and only moves up.
    const full = h * (1 + SHIFT);
    camera.aspect = w / full;
    camera.fov = (2 * Math.atan((1 + SHIFT) * Math.tan((CAMERA_FOV * Math.PI) / 360)) * 180) / Math.PI;
    camera.setViewOffset(w, full, 0, full - h, w, h);
    camera.updateProjectionMatrix();
    // a narrow screen sees a smaller sphere, so the ring of cards fits across it
    const aspect = w / h;
    group.scale.setScalar(aspect < 1 ? 1 / (1 + (1 - aspect) * 0.9) : 1);
    render();
  }
  function render() { renderer.render(scene, camera); }
  let onScreen = false, running = false, hidden = document.hidden, lastT = 0;
  function frame(now) {
    if (!onScreen || hidden) { running = false; return; }
    const dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const reduced = reducedMq.matches;
    // the spin: kicks decay back to the resting turn (no resting turn under reduced motion)
    const rest = reduced ? 0 : SPIN_REST;
    omega += (rest - omega) * (1 - Math.exp(-dt / SPIN_DECAY));
    theta += omega * dt;
    group.rotation.y = theta;
    // the cards grow in with the section's rise
    rise.t = progress();
    reduced ? rise.snap() : rise.step(dt);
    cards.forEach((c, i) => {
      const from = CARDS_FROM + CARDS_STAGGER * (i / n);
      c.userData.grow = expoOut(clamp01((rise.x - from) / (1 - from)));
    });
    // the stars show as the bust's points arrive
    const h = handoff();
    pmat.opacity = smooth(clamp01((h - STARS_FROM) / (1 - STARS_FROM)));
    points.visible = pmat.opacity > 1e-3;
    controls.update();
    for (const c of cards) {
      const u = c.userData;
      u.hover += (u.target - u.hover) * 0.15;
      const s = u.hover * u.grow;
      c.visible = s > 1e-3;
      c.scale.setScalar(Math.max(s, 1e-4));
    }
    render();
    // while the bust's points are on their way, tell it where the stars are now
    if (cloud && cloud.ready && h > 0 && h < 1) sendStars();
    requestAnimationFrame(frame);
  }
  function wake() { if (running || !onScreen || hidden) return; running = true; lastT = performance.now(); requestAnimationFrame(frame); }
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; if (onScreen) wake(); }, { threshold: 0 }).observe(section);
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; if (!hidden) wake(); });
  new ResizeObserver(resize).observe(section);
  // A load with the section already up starts with the cards grown instead of growing in.
  rise.t = progress(); rise.snap();
  resize();
  return {
    scene, camera, cards, controls, wake, kick,
    get hovered() { return hovered; }, get running() { return running; },
    get omega() { return omega; }, get assembled() { return rise.x; },
    get handoff() { return handoff(); }, get starsOpacity() { return pmat.opacity; },
  };
}

// The OS section. While it is pinned, the whole stage zooms out into a rounded frame on a lavender
// ground, a headline settles above it, and seven widgets fly in from the camera, hold, and fly back
// out as the frame zooms in again. Everything follows one scroll progress eased through a spring,
// and the pointer drifts the frame and the widgets slightly.
import { spring } from './cursor.js';

// Section timing in viewport heights: how long the zoom-in takes, the hold, the zoom-out.
const PIN_VH = 1.15;
const HOLD = 0.3;
const OUT_VH = 0.75;
const END = PIN_VH + HOLD + OUT_VH;
// The frame's scale when fully zoomed out, and its corner radius as seen.
const FRAME_SCALE = 0.56;
const FRAME_RADIUS = 28;
// Frame drift per unit of pointer, px.
const FRAME_DRIFT = -4;
// Widgets: start scale (nearer the eye), fly-in length, fly-out length, blur at the start.
const K0 = 2.6;
const LEN = 0.22;
const OUT_LEN = 0.45;
const BLUR = 16;
const BLUR_EASE = 0.55;
// Widgets turn to glass once they are closer than this scale.
const GLASS_K = 1.5;
// Vertical drift share of each widget, by DOM order.
const SWAY_Y = [1, .7, 1.15, .8, 1.2, .6, .9];
// Composer typing: first character after this delay, then one character per interval.
const TYPE_DELAY = 350;
const TYPE_STEP = 34;
// the composer's resting text is whatever the markup starts with
// Ground colours: the site black and the lavender of the OS section.
const DARK = [0, 0, 0];
const LIGHT = [21, 24, 33];

const seg = (v, [a, b]) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const inOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const out = (t) => 1 - Math.pow(1 - t, 4);
const expo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const smooth = (t) => t * t * (3 - 2 * t);

export function initFrame(cloud, { onGround } = {}) {
  const stage = document.querySelector('[data-stage]');
  const head = document.querySelector('[data-frame-head]');
  const hd = document.querySelector('[data-header]');
  const os = document.querySelector('[data-screen="os"]');
  const root = document.documentElement;
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  const fineMq = matchMedia('(hover: hover) and (pointer: fine)');

  const widgets = [...os.querySelectorAll('.ow')].map((el, i) => ({
    el, i, at: parseFloat(el.dataset.at), drift: parseFloat(el.dataset.drift) || 0,
    cx: 0, cy: 0, last: '', landed: false, glass: false,
    sx: null, sy: null,
  }));
  const drifts = widgets.map((w) => w.drift);
  const minD = Math.min(...drifts), maxD = Math.max(...drifts);
  for (const w of widgets) {
    const k = 20 + 20 * ((w.drift - minD) / ((maxD - minD) || 1));
    const c = 2 * Math.sqrt(k) * 0.95;
    w.sx = spring(k, c); w.sy = spring(k, c);
  }
  // Exit order: the last to arrive leaves first.
  const byAt = [...widgets].sort((a, b) => b.at - a.at);
  byAt.forEach((w, i) => { w.outAt = (i * (1 - OUT_LEN)) / (byAt.length - 1); });

  const p = spring(110, 20);
  const drift = { x: spring(36, 12), y: spring(36, 12) };
  const chart = os.querySelector('.ow--chart .minibars');
  const composer = os.querySelector('.composer__text');
  const typed = composer?.querySelector('[data-typed]');
  const PLACEHOLDER = typed ? typed.textContent : '';
  if (composer) composer.classList.add('is-empty');
  let typeTimer = 0;

  let osTop = 0;
  let pageY = window.scrollY, viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
  function measure() {
    pageY = window.scrollY;
    viewportWidth = window.innerWidth; viewportHeight = window.innerHeight;
    osTop = os.getBoundingClientRect().top + pageY;
    for (const w of widgets) {
      w.cx = w.el.offsetLeft + w.el.offsetWidth / 2 - viewportWidth / 2;
      w.cy = w.el.offsetTop + w.el.offsetHeight / 2 - viewportHeight / 2;
    }
  }

  function startTyping() {
    if (!composer || !typed) return;
    clearTimeout(typeTimer);
    const text = composer.dataset.type || '';
    composer.classList.remove('is-empty');
    if (reducedMq.matches) { typed.textContent = text; return; }
    typed.textContent = '';
    let i = 0;
    const step = () => {
      i++;
      typed.textContent = text.slice(0, i);
      if (i < text.length) typeTimer = setTimeout(step, TYPE_STEP);
    };
    typeTimer = setTimeout(step, TYPE_DELAY);
  }
  function stopTyping() {
    if (!composer || !typed) return;
    clearTimeout(typeTimer);
    typed.textContent = PLACEHOLDER;
    composer.classList.add('is-empty');
  }

  let heroOut = false;
  let running = false, lastT = 0;
  let frameStyle = '', groundStyle = '', headStyle = '';

  function frame(now) {
    if (document.hidden || root.classList.contains('is-loading')) { running = false; return; }
    const dt = Math.min(0.25, Math.max(0, (now - lastT) / 1000));
    lastT = now;
    const reduced = reducedMq.matches;
    const s = Math.min(END, Math.max(0, (pageY - osTop) / viewportHeight));
    p.t = s;
    reduced ? p.snap() : p.step(dt);
    for (const d of Object.values(drift)) reduced ? d.snap() : d.step(dt);
    for (const w of widgets) { reduced ? (w.sx.snap(), w.sy.snap()) : (w.sx.step(dt), w.sy.step(dt)); }

    // the hero leaves on the first scroll and comes back near the top
    if (!heroOut && s > 0.05) { heroOut = true; root.classList.add('is-hero-out'); }
    else if (heroOut && s <= 0.03) { heroOut = false; root.classList.remove('is-hero-out'); }

    const q = clamp01(p.x / PIN_VH);
    const o = clamp01((p.x - PIN_VH - HOLD) / OUT_VH);

    // the frame
    const k = inOut(seg(q, [0.06, 0.5])) * (1 - inOut(o));
    const scale = 1 - (1 - FRAME_SCALE) * k;
    const framed = q > 0 && o < 1;
    const fx = drift.x.x * FRAME_DRIFT * k, fy = drift.y.x * FRAME_DRIFT * k;
    const nextFrameStyle = `${framed}|${fx.toFixed(2)}|${fy.toFixed(2)}|${scale.toFixed(4)}`;
    if (nextFrameStyle !== frameStyle) {
      frameStyle = nextFrameStyle;
      stage.style.transform = framed ? `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) scale(${scale.toFixed(4)})` : '';
      stage.style.borderRadius = framed ? `${((FRAME_RADIUS * k) / scale).toFixed(2)}px` : '';
      stage.classList.toggle('is-framed', framed);
    }
    cloud.stageBox = { s: scale, tx: fx, ty: fy };
    cloud.framed = framed;

    // the ground
    const g = seg(q, [0.1, 0.42]) * (1 - seg(o, [0.3, 0.9]));
    const nextGroundStyle = g > 0 ? `rgb(${DARK.map((d, i) => Math.round(d + (LIGHT[i] - d) * g)).join(', ')})` : '';
    if (nextGroundStyle !== groundStyle) { groundStyle = nextGroundStyle; root.style.backgroundColor = groundStyle; }
    hd.classList.toggle('is-light', g > 0.5);
    onGround?.(g);

    // the headline
    const e = out(seg(q, [0.2, 0.44])) * (1 - smooth(seg(o, [0, 0.4])));
    if (e.toFixed(3) !== headStyle) {
      headStyle = e.toFixed(3);
      head.style.opacity = headStyle;
      head.style.transform = `translateY(${((1 - e) * 24).toFixed(2)}px) scale(${(1 / FRAME_SCALE).toFixed(4)})`;
      head.style.filter = e > 0 && e < 1 ? `blur(${((1 - e) * 6).toFixed(2)}px)` : '';
    }

    // the widgets
    for (const w of widgets) {
      const t = seg(q, [w.at, w.at + LEN]);
      const tOut = seg(o, [w.outAt, w.outAt + OUT_LEN]);
      const ei = reduced ? (t > 0 ? 1 : 0) : expo(t);
      const eOut = reduced ? (tOut > 0 ? 1 : 0) : Math.pow(tOut, 2.2);
      const kk = reduced ? 1 : 1 + (K0 - 1) * ((1 - ei) + eOut);
      const here = ei * (1 - tOut);
      const x = w.cx * (kk - 1) + w.sx.x * w.drift * here;
      const y = w.cy * (kk - 1) + w.sy.x * w.drift * SWAY_Y[w.i % SWAY_Y.length] * here;
      const opacity = reduced
        ? (t > 0 ? 1 : 0) * (tOut >= 1 ? 0 : 1)
        : smooth(clamp01(t / 0.45)) * (1 - smooth(clamp01((tOut - 0.3) / 0.7)));
      const flying = (t > 0 && t < 1) || (tOut > 0 && tOut < 1);
      const blur = flying && !reduced ? BLUR * Math.pow((kk - 1) / (K0 - 1), BLUR_EASE) : 0;
      const glass = reduced ? 1 : clamp01((GLASS_K - kk) / (GLASS_K - 1));
      const str = `${opacity.toFixed(3)}|${x.toFixed(2)}|${y.toFixed(2)}|${kk.toFixed(4)}|${blur.toFixed(2)}|${glass.toFixed(3)}`;
      if (str !== w.last) {
        w.last = str;
        const st = w.el.style;
        st.opacity = opacity.toFixed(3);
        st.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${kk.toFixed(4)})`;
        st.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : '';
        st.setProperty('--glass', glass.toFixed(3));
        st.setProperty('--solid', (1 - glass).toFixed(3));
        const hasGlass = glass > 0;
        if (hasGlass !== w.glass) { w.glass = hasGlass; w.el.classList.toggle('has-glass', hasGlass); }
      }
      const landed = t === 1;
      if (landed !== w.landed) {
        w.landed = landed;
        if (w.el.classList.contains('ow--chart') && chart) chart.classList.toggle('is-grown', landed);
        if (w.el.classList.contains('ow--composer')) landed ? startTyping() : stopTyping();
      }
    }

    const moving = !p.still || !drift.x.still || !drift.y.still || widgets.some((w) => !w.sx.still || !w.sy.still);
    if (moving) requestAnimationFrame(frame); else running = false;
  }

  function wake() {
    if (running || document.hidden || root.classList.contains('is-loading')) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || !fineMq.matches || reducedMq.matches || p.x <= 0 || p.x >= END || root.classList.contains('is-loading')) return;
    const nx = (e.clientX / viewportWidth) * 2 - 1, ny = (e.clientY / viewportHeight) * 2 - 1;
    drift.x.t = nx; drift.y.t = ny;
    for (const w of widgets) { w.sx.t = nx; w.sy.t = ny; }
    wake();
  }, { passive: true });
  window.addEventListener('scroll', () => { pageY = window.scrollY; wake(); }, { passive: true });
  window.addEventListener('resize', () => { measure(); wake(); });
  new ResizeObserver(() => { measure(); wake(); }).observe(document.body);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  document.addEventListener('flittle:loaded', () => { pageY = window.scrollY; wake(); });

  measure();
  // A load part-way through the section starts there instead of zooming from the top.
  p.t = Math.min(END, Math.max(0, (pageY - osTop) / viewportHeight));
  p.snap();
  wake();
  return { wake, measure };
}

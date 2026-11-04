import { createFlappyGame, createRunnerGame } from './arcade-flight.js';
import { createBreakoutGame, createShooterGame } from './arcade-action.js';
import { drawMascot, drawText } from './arcade-art.js';

const factories = { flappy: createFlappyGame, breakout: createBreakoutGame, shooter: createShooterGame, runner: createRunnerGame };
// Pixel size stays uniform while the world expands to the viewport's aspect
// ratio. Scenery reaches every edge; safe bounds keep play clear of controls.
export function createArcadeGame(canvas, { kind, onProgress, onComplete, reducedMotion = false }) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas is unavailable.');
  const buffer = document.createElement('canvas');
  const paint = buffer.getContext('2d', { alpha: false });
  if (!paint) throw new Error('The arcade drawing buffer is unavailable.');
  let width = 1, height = 1, scale = 1, left = 0, top = 0;
  let world = null;
  let frame = 0, last = 0, destroyed = false, ended = false, started = false;
  let score = 0, departure = null, departureTimer = 0, resolveDeparture = null;
  function measure() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || innerWidth); height = Math.max(1, rect.height || innerHeight);
    scale = Math.max(.65, Math.min(width / 360, height / 400, 3));
    const styles = getComputedStyle(canvas.parentElement);
    const inset = (name, fallback) => (parseFloat(styles.getPropertyValue(name)) || fallback) / scale;
    const logicalWidth = Math.ceil(width / scale), logicalHeight = Math.ceil(height / scale);
    const side = Math.min(logicalWidth * .18, inset('--arcade-safe-side', 16));
    const head = Math.min(logicalHeight * .4, inset('--arcade-safe-top', 150));
    const foot = Math.min(logicalHeight * .4, inset('--arcade-safe-bottom', 190));
    return {
      width: logicalWidth, height: logicalHeight,
      bounds: { left: side, right: logicalWidth - side, top: head, bottom: logicalHeight - foot },
      screen: { width, height, scale }
    };
  }
  world = measure();
  buffer.width = world.width; buffer.height = world.height;
  let pointerX = world.width / 2, pointerY = world.height / 2;
  const model = factories[kind]({
    ...world, random: Math.random, drawMascot, drawText,
    progress(value) { score = value.score || 0; onProgress?.(value); },
    complete(value) {
      if (ended || destroyed) return;
      ended = true; score = value.score || 0;
      onComplete?.(value);
    }
  });
  function draw() {
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, width, height);
    paint.setTransform(1, 0, 0, 1, 0, 0);
    paint.imageSmoothingEnabled = false;
    paint.fillStyle = '#080b12'; paint.fillRect(0, 0, world.width, world.height);
    model.draw(paint);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, world.width * scale, world.height * scale);
  }
  function tick(now) {
    frame = 0;
    if (destroyed || document.hidden || !canvas.isConnected) return;
    const dt = last ? Math.min(.04, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!ended && !departure) model.update(dt);
    draw();
    if (!ended && !departure) wake();
  }
  function wake() {
    if (!frame && !destroyed && !document.hidden && started && !ended && !departure) frame = requestAnimationFrame(tick);
  }
  function resize() {
    if (destroyed) return;
    const previous = world;
    const next = measure();
    const changed = next.width !== previous.width || next.height !== previous.height ||
      Object.keys(next.bounds).some(edge => next.bounds[edge] !== previous.bounds[edge]);
    world = next;
    if (changed) {
      releaseControls();
      pointerX *= world.width / previous.width; pointerY *= world.height / previous.height;
      model.resize?.(world);
    }
    buffer.width = world.width; buffer.height = world.height;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    draw();
  }
  function releaseControls() {
    for (const action of ['left','right','up','down','primary']) model.input(action, false);
    model.pointer(pointerX, pointerY, false);
  }
  function visibility() { last = 0; if (document.hidden) { releaseControls(); cancelAnimationFrame(frame); frame = 0; } else wake(); }
  function pointer(event) {
    if (destroyed || ended || departure) return;
    const bounds = canvas.getBoundingClientRect();
    const x = (event.clientX - bounds.left - left) / scale;
    const y = (event.clientY - bounds.top - top) / scale;
    if (event.type === 'pointerdown') {
      if (x < 0 || x > world.width || y < 0 || y > world.height) return;
      event.preventDefault(); canvas.setPointerCapture?.(event.pointerId);
    }
    const released = event.type === 'pointerup' || event.type === 'pointercancel' || event.type === 'pointerleave';
    pointerX = Math.max(0, Math.min(world.width, x)); pointerY = Math.max(0, Math.min(world.height, y));
    model.pointer(pointerX, pointerY, !released && (event.type === 'pointerdown' || event.buttons > 0));
    draw(); wake();
  }
  // Construct and paint successfully before registering any long-lived work.
  try { resize(); } catch (error) { model.destroy?.(); throw error; }
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) canvas.addEventListener(name, pointer);
  return {
    releaseControls,
    start() { if (started || destroyed) return; started = true; model.start(); draw(); wake(); },
    input(action, pressed) { if (!destroyed && !ended && !departure) { model.input(action, pressed); draw(); wake(); } },
    finishInstantly() {
      if (destroyed || ended) return false;
      ended = true;
      cancelAnimationFrame(frame); frame = 0;
      onComplete?.({ score, title: 'NICE LITTLE DETOUR' });
      return true;
    },
    playExit() {
      if (departure) return departure;
      if (destroyed) return Promise.resolve(false);
      cancelAnimationFrame(frame); frame = 0;
      departure = new Promise(resolve => { resolveDeparture = resolve; });
      departureTimer = setTimeout(() => { resolveDeparture?.(true); resolveDeparture = null; }, reducedMotion ? 0 : 180);
      return departure;
    },
    state: () => ({ ...model.state(), score, running: Boolean(frame), destroyed, kind, viewport: { left, top, scale, width: world.width, height: world.height, bounds: { ...world.bounds }, fullscreen: true } }),
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); clearTimeout(departureTimer); frame = 0;
      resolveDeparture?.(false); resolveDeparture = null;
      observer.disconnect(); model.destroy?.();
      document.removeEventListener('visibilitychange', visibility);
      for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'pointerleave']) canvas.removeEventListener(name, pointer);
    }
  };
}

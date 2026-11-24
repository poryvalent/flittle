import { drawMascot } from './arcade-art.js';
import { arcadeMascotSize } from './arcade-portal.js?v=mascot-handoff-1';

const clamp = value => Math.max(0, Math.min(1, value));
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };
const mix = (a, b, p) => a + (b - a) * p;
const rectOf = rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });

// Transfer the assembled sprite into the existing, decoded homepage image.
// Only this short animation owns a second canvas; the hero never moves in layout.
export function createMascotHandoff(overlay, { reducedMotion = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'arcade-handoff';
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('The mascot handoff canvas is unavailable.');
  const root = document.documentElement;
  const mascot = document.getElementById('catBase');
  let artwork = mascot;
  try { artwork = window.__flittle?.captureMascot?.() || mascot; } catch { /* The original image is a safe fallback. */ }
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pixelCanvas = document.createElement('canvas');
  pixelCanvas.width = pixelCanvas.height = 24;
  const pixelCtx = pixelCanvas.getContext('2d', { willReadFrequently: true });
  if (!pixelCtx) throw new Error('The mascot pixel canvas is unavailable.');
  drawMascot(pixelCtx, 12, 12, 24);
  const arcadePixels = pixelCtx.getImageData(0, 0, 24, 24);
  const blendedPixels = pixelCtx.createImageData(24, 24);
  let heroPixels = null;
  if (mascot?.complete && mascot.naturalWidth) {
    pixelCtx.clearRect(0, 0, 24, 24);
    pixelCtx.drawImage(artwork, 0, 0, 24, 24);
    heroPixels = pixelCtx.getImageData(0, 0, 24, 24);
  }
  let width = 1, height = 1, ratio = 1;
  let source = null, target = null, current = null, mode = 'return';
  let elapsed = 0, duration = .92, progress = 0, last = null, frame = 0;
  let started = false, complete = false, destroyed = false, resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });

  function measure() {
    const viewport = overlay.getBoundingClientRect();
    width = Math.max(1, viewport.width); height = Math.max(1, viewport.height);
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const size = arcadeMascotSize(width, height);
    source = { x: (width - size) / 2, y: (height - size) / 2, width: size, height: size };
    const rect = mascot?.getBoundingClientRect();
    const visibleWidth = rect ? Math.max(0, Math.min(rect.right, viewport.right) - Math.max(rect.left, viewport.left)) : 0;
    const visibleHeight = rect ? Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, viewport.top)) : 0;
    const visible = heroPixels && rect.width > 0 && rect.height > 0 &&
      visibleWidth * visibleHeight >= rect.width * rect.height * .75 &&
      !root.classList.contains('is-hero-fallback');
    // Reopening the arcade from further down the page must keep that return position.
    mode = visible ? 'hero' : 'return';
    target = visible ? { x: rect.left - viewport.left, y: rect.top - viewport.top, width: rect.width, height: rect.height }
      : { x: source.x - size * .15, y: source.y - size * .15, width: size * 1.3, height: size * 1.3 };
    duration = visible ? .92 : .52;
    if (started) {
      root.classList.toggle('has-arcade-handoff', visible);
      document.dispatchEvent(new Event('flittle:handoff'));
    }
  }

  function draw() {
    const p = progress;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 1 - smooth((p - .08) / .82);
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, width, height);
    const travel = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    current = Object.fromEntries(Object.keys(source).map(key => [key, mix(source[key], target[key], travel)]));
    if (mode === 'hero') {
      // The same 24x24 cells resolve into the real mascot's colours and silhouette.
      const resolve = smooth((p - .14) / .48);
      for (let i = 0; i < arcadePixels.data.length; i += 4) {
        const a = arcadePixels.data[i + 3] / 255, b = heroPixels.data[i + 3] / 255;
        const alpha = mix(a, b, resolve);
        for (let c = 0; c < 3; c++) blendedPixels.data[i + c] = alpha
          ? (arcadePixels.data[i + c] * a * (1 - resolve) + heroPixels.data[i + c] * b * resolve) / alpha : 0;
        blendedPixels.data[i + 3] = alpha * 255;
      }
      pixelCtx.putImageData(blendedPixels, 0, 0);
      const detail = smooth((p - .56) / .36);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1 - detail;
      ctx.drawImage(pixelCanvas, current.x, current.y, current.width, current.height);
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = detail;
      ctx.drawImage(artwork, current.x, current.y, current.width, current.height);
    } else {
      ctx.globalAlpha = 1 - smooth((p - .12) / .78);
      drawMascot(ctx, current.x + current.width / 2, current.y + current.height / 2, current.width);
    }
    ctx.globalAlpha = 1;
  }

  function cleanup() {
    cancelAnimationFrame(frame); frame = 0;
    observer.disconnect();
    document.removeEventListener('visibilitychange', visibility);
    motion.removeEventListener('change', motionChanged);
    root.classList.remove('has-arcade-handoff');
    document.dispatchEvent(new Event('flittle:handoff'));
    overlay.classList.remove('has-mascot-handoff');
    canvas.remove();
  }
  function finish() {
    if (complete || destroyed) return;
    complete = true; progress = 1;
    // Keep the final frame until the loader releases in this frame's microtask.
    // Removing the overlay early would expose the frozen arcade canvas again.
    cancelAnimationFrame(frame); frame = 0;
    resolveFinished(true);
  }
  function tick(now) {
    frame = 0;
    if (destroyed || complete || document.hidden) { last = null; return; }
    try {
      elapsed += last === null ? 0 : Math.min(.05, Math.max(0, (now - last) / 1000));
      last = now; progress = clamp(elapsed / duration);
      draw();
      if (progress >= 1) finish(); else wake();
    } catch (error) { skipFailedHandoff(error); }
  }
  function skipFailedHandoff(error) {
    console.warn('The mascot handoff could not finish. Opening the prepared website.', error);
    finish();
  }
  function wake() {
    if (!started || destroyed || complete || document.hidden) return;
    if (reducedMotion || motion.matches) { finish(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function visibility() {
    last = null;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else wake();
  }
  function motionChanged() { wake(); }
  const observer = new ResizeObserver(() => {
    if (!started || destroyed || complete) return;
    // Measure after the hero's own resize pass has refitted the wordmark.
    try { measure(); draw(); } catch (error) { skipFailedHandoff(error); }
  });
  return {
    finish() {
      if (started || destroyed) return finished;
      measure(); started = true;
      if (reducedMotion || motion.matches) { finish(); return finished; }
      draw(); overlay.append(canvas);
      overlay.classList.add('has-mascot-handoff');
      root.classList.toggle('has-arcade-handoff', mode === 'hero');
      document.dispatchEvent(new Event('flittle:handoff'));
      observer.observe(overlay);
      if (mascot) observer.observe(mascot);
      document.addEventListener('visibilitychange', visibility);
      motion.addEventListener('change', motionChanged);
      wake();
      return finished;
    },
    state: () => ({ phase: destroyed ? 'destroyed' : complete ? 'complete' : 'transferring', mode,
      progress, source: source && rectOf(source), current: current && rectOf(current),
      target: target && rectOf(target), running: Boolean(frame) }),
    destroy() {
      if (destroyed) return;
      destroyed = true; cleanup();
      if (!complete) resolveFinished(false);
    }
  };
}

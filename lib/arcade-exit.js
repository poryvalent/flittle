import { createGameFinisher } from './arcade-ult.js?v=mascot-handoff-1';
import { drawArcadePortal } from './arcade-portal.js?v=mascot-handoff-1';
import { createMascotHandoff } from './arcade-handoff.js?v=mascot-handoff-1';

// The website is fully prepared before the arcade opens. This renderer owns
// only the final game move, then hands straight back to the prepared page.
export function createArcadeExit(canvas, { kind = 'dodge', snapshot = null, gameState = null, reducedMotion = false } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The arcade departure canvas is unavailable.');
  const finisher = createGameFinisher(kind, gameState, snapshot);
  const portalStart = finisher ? finisher.assemble - .18 : 0;
  const duration = finisher ? finisher.assemble + .38 : .18;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let quiet = Boolean(reducedMotion || motion.matches);
  let width = 1, height = 1, ratio = 1, frame = 0, last = null, elapsed = 0;
  let destroyed = false, started = false, complete = false, resolveFinished;
  let handoff = null;
  const finished = new Promise(resolve => { resolveFinished = resolve; });

  function draw() {
    if (destroyed) return;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#08090b'; ctx.fillRect(0, 0, width, height);
    if (quiet) return;
    if (finisher) finisher.draw(ctx, width, height, elapsed);
    else if (snapshot?.width && snapshot?.height) ctx.drawImage(snapshot, 0, 0, width, height);
    if (finisher) drawArcadePortal(ctx, width, height,
      (elapsed - portalStart) / (duration - portalStart), kind, finisher.origin(width, height));
  }
  function resize() {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || innerWidth); height = Math.max(1, rect.height || innerHeight);
    ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.imageSmoothingEnabled = false;
    draw();
  }
  function finishAttack() {
    if (destroyed || complete) return;
    complete = true; cancelAnimationFrame(frame); frame = 0;
    resolveFinished(true);
  }
  function tick(now) {
    frame = 0;
    if (destroyed || complete || document.hidden || !canvas.isConnected) { last = null; return; }
    elapsed += last === null ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    try {
      draw();
      if (elapsed >= duration) finishAttack(); else wake();
    } catch (error) { skipFailedAttack(error); }
  }
  function skipFailedAttack(error) {
    console.warn('The final attack could not finish. Opening the prepared website.', error);
    quiet = true;
    finishAttack();
  }
  function wake() {
    if (!started || destroyed || complete || document.hidden || !canvas.isConnected) return;
    if (quiet) { finishAttack(); return; }
    if (!frame) frame = requestAnimationFrame(tick);
  }
  function visibility() {
    last = null;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else wake();
  }
  function motionChanged(event) {
    quiet = Boolean(reducedMotion || event.matches);
    if (quiet) { cancelAnimationFrame(frame); frame = 0; }
    wake();
  }
  resize();
  const observer = new ResizeObserver(() => {
    try { resize(); } catch (error) { skipFailedAttack(error); }
  }); observer.observe(canvas);
  document.addEventListener('visibilitychange', visibility);
  motion.addEventListener('change', motionChanged);

  return {
    finish() { started = true; wake(); return finished; },
    reveal() {
      if (destroyed) return Promise.resolve(false);
      handoff ||= createMascotHandoff(canvas.closest('[data-loader]'), { reducedMotion: quiet });
      return handoff.finish();
    },
    state: () => ({ kind, phase: destroyed ? 'destroyed' : complete ? 'complete' : 'exiting',
      beat: complete ? 'complete' : elapsed >= portalStart && finisher ? 'portal' : finisher?.beat(elapsed) || 'aftermath', elapsed, duration,
      origin: finisher?.origin(width, height) || null, running: Boolean(frame), destroyed, reducedMotion: quiet,
      viewport: { width, height, ratio }, handoff: handoff?.state() || null }),
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); frame = 0;
      observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      motion.removeEventListener('change', motionChanged);
      handoff?.destroy(); finisher?.destroy(); snapshot = null;
      if (!complete) resolveFinished(false);
    }
  };
}

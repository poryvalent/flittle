import { drawMascot, drawText } from './arcade-art.js';
import { createGameFinisher } from './arcade-ult.js';

const BACKGROUND = '#08090b';
const COLUMNS = 28;
const FORM_SECONDS = 1.72;
const REVEAL_SECONDS = .42;
const THEMES = {
  tetris: { color: '#c9ff73', secondary: '#b6a1ff', caption: 'BUILDING YOUR NEXT WORLD' },
  dodge: { color: '#c9ff73', secondary: '#ffe7a0', caption: 'STARS ALIGNED. NEXT WORLD READY.' },
  flappy: { color: '#8de6e5', secondary: '#c9ff73', caption: 'CLEAR FOR TAKEOFF' },
  breakout: { color: '#ffbf91', secondary: '#c9ff73', caption: 'ONE LAST PERFECT BOUNCE' },
  shooter: { color: '#c3b0ff', secondary: '#8de6e5', caption: 'NEXT WORLD IN RANGE' },
  runner: { color: '#c9ff73', secondary: '#8de6e5', caption: 'A LITTLE FURTHER' }
};
const clamp = value => Math.max(0, Math.min(1, value));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const out = t => 1 - Math.pow(1 - t, 3);
const noise = seed => { const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const triangle = t => 1 - Math.abs(((t % 1) + 1) % 1 * 2 - 1);

// One renderer owns the departure, after the game has released its canvas.
// Positions are normalized until drawing, so a rotation never restarts it.
export function createArcadeExit(canvas, { kind = 'tetris', snapshot = null, gameState = null, reducedMotion = false, onProgress } = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('The arcade departure canvas is unavailable.');
  if (!Object.hasOwn(THEMES, kind)) kind = 'tetris';
  const theme = THEMES[kind];
  const finisher = createGameFinisher(kind, gameState, snapshot);
  const formationDuration = finisher?.duration || FORM_SECONDS;
  let width = 1, height = 1, ratio = 1;
  let frame = 0, last = null, elapsed = 0, reveal = 0;
  let progress = 0, target = 0, notified = -1;
  let phase = 'forming', destroyed = false, finishing = false;
  let resolveFormed, resolveFinished, formedDone = false, finishedDone = false;
  const formed = new Promise(resolve => { resolveFormed = resolve; });
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  const motionQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  let quiet = Boolean(reducedMotion || motionQuery?.matches);
  // Sample the actual game, retaining both its palette and source positions.
  // A small readback occurs once, never in the animation loop.
  const fragments = sampleSnapshot(snapshot, theme);
  const stars = Array.from({ length: 46 }, (_, i) => ({ x: noise(i + 1), y: noise(i + 91), depth: noise(i + 411) }));

  function bar() {
    const w = Math.min(520, Math.max(100, width - Math.max(48, width * .18)));
    return { x: (width - w) / 2, y: height * .5 - 14, width: w, height: 28, cell: w / COLUMNS };
  }

  function notify() {
    const value = Math.round(progress * 1000) / 1000;
    if (notified === value) return;
    notified = value;
    onProgress?.(value);
  }

  function markFormed() {
    if (formedDone) return;
    formedDone = true;
    phase = finishing ? 'finishing' : 'waiting';
    resolveFormed(true);
  }

  function markFinished() {
    if (finishedDone) return;
    finishedDone = true;
    progress = 1; reveal = REVEAL_SECONDS; phase = 'complete';
    notify();
    // The completed bar stays visible until the parent removes the cover.
    draw();
    resolveFinished(true);
  }

  function resize() {
    if (destroyed) return;
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || window.innerWidth);
    height = Math.max(1, rect.height || window.innerHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.imageSmoothingEnabled = false;
    draw();
  }

  function drawTile(x, y, w, h, color, alpha = 1, rotation = 0) {
    if (alpha <= .001 || w < .1 || h < .1) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.translate(x, y); ctx.rotate(rotation);
    ctx.fillStyle = color;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(-w / 2, -h / 2, w, Math.min(2, h * .18));
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.fillRect(-w / 2, h / 2 - Math.min(2, h * .18), w, Math.min(2, h * .18));
    ctx.restore();
  }

  function drawBackdrop(formation) {
    ctx.fillStyle = BACKGROUND; ctx.fillRect(0, 0, width, height);
    if (!finisher && snapshot?.width && snapshot?.height && formation < .64) {
      ctx.save();
      ctx.globalAlpha = 1 - smooth(clamp((formation - .06) / .58));
      ctx.drawImage(snapshot, 0, 0, width, height);
      ctx.restore();
    }
    // The departure's quiet stage emerges from the original game frame.
    if (kind === 'shooter') {
      const intensity = smooth(clamp(formation * 2));
      ctx.strokeStyle = theme.secondary;
      for (const star of stars) {
        const speed = (quiet ? 0 : elapsed * (.04 + star.depth * .05));
        const distance = ((star.depth + speed) % 1) * 1.35;
        const dx = (star.x - .5) * width, dy = (star.y - .5) * height;
        ctx.globalAlpha = intensity * (.12 + star.depth * .28);
        ctx.beginPath();
        ctx.moveTo(width / 2 + dx * distance, height / 2 + dy * distance);
        ctx.lineTo(width / 2 + dx * (distance + .025), height / 2 + dy * (distance + .025));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = theme.color;
      for (let i = 0; i < 18; i++) {
        const star = stars[i];
        const flicker = quiet ? .18 : .10 + .09 * Math.sin(elapsed * 1.4 + i);
        ctx.globalAlpha = smooth(formation) * flicker;
        ctx.fillRect(Math.round(star.x * width), Math.round(star.y * height), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  }

  function fragmentPoint(fragment, p, b) {
    const sx = fragment.x * width, sy = fragment.y * height;
    const column = fragment.slot % COLUMNS, row = Math.floor(fragment.slot / COLUMNS) % 2;
    const tx = b.x + (column + .5) * b.cell;
    const ty = b.y + 7 + row * 14;
    const ease = smooth(p), lift = Math.sin(Math.PI * p), spin = fragment.spin;
    let x = mix(sx, tx, ease), y = mix(sy, ty, ease), rotation = 0;
    if (kind === 'tetris') {
      // A brief quarter-turn, then columns tuck into their final two rows.
      x = mix(sx, tx, out(p));
      y -= lift * (36 + fragment.seed * 50);
      rotation = Math.sin(Math.PI * p) * Math.round(spin * 2) * Math.PI / 2;
    } else if (kind === 'flappy') {
      x += lift * Math.sin(p * Math.PI * 2 + fragment.seed * 4) * 36;
      y -= lift * (45 + fragment.seed * 80);
      rotation = Math.cos(p * Math.PI * 2) * lift * spin * .7;
    } else if (kind === 'breakout') {
      // Sharp, damped rebounds give bricks the rhythm of the game ball.
      const bounce = Math.abs(Math.sin(p * Math.PI * 3)) * (1 - p);
      x += lift * spin * 65;
      y -= bounce * (80 + fragment.seed * 90);
      rotation = Math.sin(p * Math.PI * 4) * (1 - p) * spin;
    } else if (kind === 'shooter') {
      const swirl = lift * (1 - p);
      x += Math.cos(fragment.seed * Math.PI * 2 + p * 4) * swirl * width * .10;
      y -= swirl * height * .12;
      rotation = spin * Math.PI * (1 - p);
    } else if (kind === 'dodge') {
      x += lift * spin * 34;
      y -= lift * (48 + fragment.seed * 80);
      rotation = spin * Math.PI * (1 - p);
    } else {
      // Pixel scenery rolls into one last running jump before becoming track.
      x = mix(sx, tx, out(p)) + lift * spin * 45;
      y -= Math.abs(Math.sin(p * Math.PI * 2)) * (1 - p) * (65 + fragment.seed * 65);
      rotation = spin * Math.PI * 2 * (1 - p);
    }
    return { x, y, rotation, tx, ty };
  }

  function drawFragments(formation, b) {
    if (formation >= 1 || quiet) return;
    for (const fragment of fragments) {
      const p = clamp((formation - fragment.delay) / (1 - fragment.delay));
      const point = fragmentPoint(fragment, p, b);
      const endFade = 1 - smooth(clamp((p - .80) / .20));
      const alpha = smooth(clamp(formation / .12)) * endFade;
      const size = mix(Math.max(5, Math.min(17, width * fragment.size)), b.cell - 2, smooth(p));
      if (kind === 'shooter' && p > .05 && p < .8) {
        ctx.save(); ctx.globalAlpha = alpha * .24; ctx.strokeStyle = fragment.color;
        ctx.beginPath(); ctx.moveTo(point.x, point.y);
        ctx.lineTo(point.x + (point.x - width / 2) * .055, point.y + (point.y - height / 2) * .055);
        ctx.stroke(); ctx.restore();
      }
      drawTile(point.x, point.y, size, mix(size, 11, p), fragment.color, alpha, point.rotation);
    }
  }

  function drawBar(formation, b) {
    const arrival = smooth(clamp((formation - .32) / .68));
    if (!arrival) return;
    const completion = clamp(reveal / REVEAL_SECONDS);
    ctx.save(); ctx.globalAlpha = arrival;
    ctx.fillStyle = '#11151b';
    ctx.fillRect(b.x - 7, b.y - 7, b.width + 14, b.height + 14);
    ctx.strokeStyle = '#343b42'; ctx.lineWidth = 1;
    ctx.strokeRect(b.x - 7.5, b.y - 7.5, b.width + 15, b.height + 15);
    // A narrow glow under the bar keeps the sampled pixels crisp.
    ctx.shadowColor = theme.color; ctx.shadowBlur = 15 + completion * 10;
    ctx.globalAlpha = arrival * (.16 + completion * .2);
    ctx.fillStyle = theme.color; ctx.fillRect(b.x, b.y + b.height + 4, b.width * progress, 2);
    ctx.shadowBlur = 0; ctx.globalAlpha = arrival;
    for (let i = 0; i < COLUMNS; i++) {
      const fill = clamp(progress * COLUMNS - i);
      const x = b.x + i * b.cell;
      ctx.fillStyle = '#20262c'; ctx.fillRect(x + 1, b.y + 1, b.cell - 2, b.height - 2);
      if (fill > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, b.y, b.cell * fill, b.height); ctx.clip();
        drawTile(x + b.cell / 2, b.y + b.height / 2, b.cell - 2, b.height - 2, i % 7 === 6 ? theme.secondary : theme.color);
        ctx.restore();
      }
      // Unfilled cells retain a hint of the game tiles that formed them.
      if (formation < 1) {
        const incoming = clamp((formation - .43 - i / COLUMNS * .18) / .22);
        ctx.fillStyle = theme.secondary; ctx.globalAlpha = arrival * Math.sin(incoming * Math.PI) * .5;
        ctx.fillRect(x + 1, b.y + 1, b.cell - 2, b.height - 2); ctx.globalAlpha = arrival;
      }
    }
    if (completion > 0 && completion < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip();
      ctx.globalAlpha = Math.sin(completion * Math.PI) * .8; ctx.fillStyle = '#ffffff';
      ctx.fillRect(b.x - 40 + completion * (b.width + 80), b.y, 32, b.height);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawMotif(formation, b) {
    const appear = smooth(clamp((formation - .2) / .6));
    if (!appear) return;
    const t = quiet ? 0 : elapsed;
    const front = b.x + Math.max(12, Math.min(b.width - 12, b.width * progress));
    const finishEase = smooth(clamp(reveal / REVEAL_SECONDS));
    ctx.save(); ctx.globalAlpha = appear;
    if (kind === 'tetris') {
      const cycle = quiet ? .65 : (t * .9) % 1;
      const x = mix(front, b.x + b.width / 2, finishEase);
      const y = b.y - 43 + smooth(cycle) * 17;
      const tile = 9;
      for (const [dx, dy] of [[0,0],[-1,1],[0,1],[1,1]]) drawTile(x + dx * (tile + 2), y + dy * (tile + 2), tile, tile, dy ? theme.color : theme.secondary, .85);
      ctx.globalAlpha *= .35;
      ctx.fillStyle = theme.color; ctx.fillRect(x - 16, b.y - 5, 32, 1);
    } else if (kind === 'dodge') {
      const bob = quiet ? 0 : Math.sin(t * 3) * 3;
      drawMascot(ctx, front, b.y - 29 + bob, 30, { frame: t });
      ctx.strokeStyle = theme.color; ctx.lineWidth = 1;
      ctx.globalAlpha *= .4; ctx.beginPath(); ctx.arc(front, b.y - 29 + bob, 22, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = appear; ctx.fillStyle = theme.secondary;
      for (let i = 0; i < 3; i++) {
        const x = front + (i - 1) * 16, y = b.y - 64 - (quiet ? 0 : Math.sin(t * 3 + i) * 4);
        ctx.fillRect(x - 1, y - 4, 2, 8); ctx.fillRect(x - 4, y - 1, 8, 2);
      }
    } else if (kind === 'flappy') {
      const bob = Math.sin(t * 7) * (quiet ? 0 : 6);
      for (const side of [-1, 1]) {
        const x = side < 0 ? b.x - 23 : b.x + b.width + 14;
        ctx.fillStyle = '#29454d'; ctx.fillRect(x, b.y - 39, 9, 28);
        ctx.fillStyle = theme.secondary; ctx.fillRect(x - 3, b.y - 15, 15, 5);
      }
      for (let i = 1; i <= 3; i++) {
        ctx.fillStyle = theme.color; ctx.globalAlpha = appear * (.4 - i * .08);
        ctx.fillRect(front - i * 11 - 9, b.y - 34 + bob + i * 2, 5, 3);
      }
      ctx.globalAlpha = appear;
      drawMascot(ctx, front, b.y - 35 + bob - finishEase * 12, 31, { rotation: quiet ? 0 : Math.cos(t * 7) * .12, frame: t });
      ctx.fillStyle = '#e6f8e8'; ctx.fillRect(front - 22, b.y - 31 + bob, 6, quiet || Math.sin(t * 11) > 0 ? 3 : 8);
    } else if (kind === 'breakout') {
      const x = b.x + 14 + triangle(t * .72) * (b.width - 28);
      const y = b.y - 19 - Math.sin(((t * 1.44) % 1) * Math.PI) * 35;
      for (let i = 0; i < 3; i++) drawTile(b.x + b.width / 2 + (i - 1) * 22, b.y - 70, 18, 8, i === 1 ? theme.color : theme.secondary, .65);
      ctx.fillStyle = '#edf9e9'; ctx.fillRect(x - 4, y - 4, 8, 8);
      ctx.globalAlpha *= .65; ctx.fillStyle = theme.color; ctx.fillRect(x - 19, b.y - 9, 38, 4);
      if (!quiet) {
        const spark = (t * 1.44) % 1;
        ctx.globalAlpha = appear * (1 - clamp(spark * 5));
        for (let i = 0; i < 4; i++) ctx.fillRect(x + (i - 1.5) * (4 + spark * 30), b.y - 15 - spark * (20 + i * 4), 3, 3);
      }
    } else if (kind === 'shooter') {
      const x = front + (quiet ? 0 : Math.sin(t * 2.7) * 4);
      drawMascot(ctx, x, b.y - 47 - finishEase * 12, 30, { thruster: !quiet, frame: t, rotation: Math.PI });
      const shot = quiet ? .5 : (t * 2.8) % 1;
      ctx.fillStyle = theme.color; ctx.fillRect(x - 1, mix(b.y - 32, b.y - 5, shot), 2, 10);
      ctx.globalAlpha *= .45; ctx.fillStyle = theme.secondary;
      for (const side of [-1, 1]) ctx.fillRect(x + side * 17, b.y - 57, 3, 10);
    } else {
      const hop = quiet ? 0 : Math.max(0, Math.sin(t * 4)) * 18;
      ctx.fillStyle = '#344039'; ctx.fillRect(b.x - 7, b.y - 7, b.width + 14, 2);
      drawMascot(ctx, front, b.y - 25 - hop - finishEase * 8, 31, { frame: t, rotation: quiet ? 0 : Math.sin(t * 8) * .08 });
      for (let i = 1; i <= 4; i++) {
        const trail = quiet ? i * 8 : ((t * 38 + i * 11) % 47);
        ctx.globalAlpha = appear * (1 - trail / 47) * .5; ctx.fillStyle = theme.secondary;
        ctx.fillRect(front - 12 - trail, b.y - 10 - (i % 2) * 3, 4, 3);
      }
      ctx.globalAlpha = appear * .8;
      const crystalX = b.x + b.width + 15;
      ctx.fillStyle = theme.color; ctx.fillRect(crystalX, b.y - 21, 6, 14); ctx.fillRect(crystalX + 2, b.y - 26, 2, 5);
    }
    ctx.restore();
  }

  function draw() {
    if (destroyed) return;
    const formation = quiet ? 1 : finisher ? clamp((elapsed - finisher.assemble) / (formationDuration - finisher.assemble)) : clamp(elapsed / FORM_SECONDS);
    const b = bar();
    ctx.globalAlpha = 1;
    drawBackdrop(formation);
    if (!quiet) finisher?.draw(ctx, width, height, elapsed);
    drawBar(formation, b);
    drawFragments(formation, b);
    drawMotif(formation, b);
    if (formation > .3) {
      ctx.save(); ctx.globalAlpha = smooth(clamp((formation - .3) / .7));
      drawText(ctx, phase === 'complete' ? 'YOUR NEXT LEVEL IS READY' : theme.caption, width / 2, b.y + b.height + 32, { size: width < 400 ? 8 : 10, color: '#9da6ad' });
      ctx.restore();
    }
  }

  function tick(now) {
    frame = 0;
    if (destroyed || document.hidden || !canvas.isConnected) { last = null; return; }
    const dt = last === null ? 1 / 60 : Math.min(.05, Math.max(0, (now - last) / 1000));
    last = now;
    elapsed += dt;
    // Progress comes from the page loader. The visual only eases toward it.
    progress += (target - progress) * -Math.expm1(-dt / .12);
    if (Math.abs(target - progress) < .001) progress = target;
    if (elapsed >= formationDuration) markFormed();
    if (finishing && formedDone && progress >= .999) {
      progress = 1; reveal += dt;
      if (reveal >= REVEAL_SECONDS) { markFinished(); return; }
    }
    notify(); draw(); wake();
  }

  function wake() {
    if (!frame && !destroyed && !quiet && phase !== 'complete' && !document.hidden && canvas.isConnected) frame = requestAnimationFrame(tick);
  }

  function applyQuiet() {
    if (!quiet || destroyed) return;
    cancelAnimationFrame(frame); frame = 0; last = null;
    elapsed = Math.max(elapsed, formationDuration); progress = target;
    markFormed(); notify();
    if (finishing) markFinished(); else draw();
  }

  function visibility() {
    last = null;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else { draw(); wake(); }
  }

  function motionChanged(event) {
    quiet = Boolean(reducedMotion || event.matches);
    if (quiet) applyQuiet(); else { last = null; wake(); }
  }

  // Fail before subscribing to long-lived work if the first paint is unavailable.
  resize();
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(canvas);
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', visibility);
  motionQuery?.addEventListener?.('change', motionChanged);
  if (quiet) applyQuiet(); else wake();

  return {
    formed,
    setProgress(value) {
      if (destroyed || finishedDone || !Number.isFinite(value)) return;
      target = Math.max(target, clamp(value));
      if (quiet) { progress = target; notify(); draw(); } else wake();
    },
    finish() {
      if (destroyed || finishedDone || finishing) return finished;
      finishing = true; target = 1;
      if (formedDone) phase = 'finishing';
      if (quiet) applyQuiet(); else wake();
      return finished;
    },
    state: () => ({ kind, phase, beat: destroyed || phase === 'complete' || quiet ? phase : finisher?.beat(elapsed) || phase, elapsed, formationDuration, origin: finisher?.origin(width, height) || null, progress, target, formed: formedDone, finishing, destroyed, running: Boolean(frame), reducedMotion: quiet, fragments: fragments.length, reveal: clamp(reveal / REVEAL_SECONDS), viewport: { width, height, ratio }, bar: { ...bar() } }),
    destroy() {
      if (destroyed) return;
      destroyed = true; phase = 'destroyed';
      cancelAnimationFrame(frame); frame = 0;
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
      motionQuery?.removeEventListener?.('change', motionChanged);
      if (!formedDone) { formedDone = true; resolveFormed(false); }
      if (!finishedDone) { finishedDone = true; resolveFinished(false); }
      finisher?.destroy();
      snapshot = null;
    }
  };
}

function sampleSnapshot(snapshot, theme) {
  const columns = 88;
  const rows = snapshot?.width ? Math.max(28, Math.min(100, Math.round(columns * snapshot.height / snapshot.width))) : 54;
  const candidates = [];
  if (snapshot?.width && snapshot?.height) {
    try {
      const sampler = document.createElement('canvas');
      sampler.width = columns; sampler.height = rows;
      const paint = sampler.getContext('2d', { willReadFrequently: true });
      if (paint) {
        paint.drawImage(snapshot, 0, 0, columns, rows);
        const pixels = paint.getImageData(0, 0, columns, rows).data;
        for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
          const offset = (y * columns + x) * 4;
          const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
          const high = Math.max(r, g, b), low = Math.min(r, g, b);
          if (pixels[offset + 3] < 80 || high < 65 || high - low < 22 && high < 130) continue;
          candidates.push({ x: (x + .5) / columns, y: (y + .5) / rows, color: `rgb(${r},${g},${b})`, size: 1 / columns * 1.4 });
        }
      }
    } catch {
      // A tainted or unavailable readback still has a complete local fallback.
    }
  }
  const count = Math.min(168, Math.max(56, candidates.length));
  return Array.from({ length: count }, (_, i) => {
    const seed = noise(i + 81);
    const source = candidates.length ? candidates[Math.floor(i / count * candidates.length)] : {
      x: .07 + noise(i + 17) * .86, y: .18 + noise(i + 127) * .59,
      color: i % 3 ? theme.color : theme.secondary, size: .018
    };
    return { ...source, seed, slot: (i * 17) % (COLUMNS * 2), spin: seed * 2 - 1, delay: seed * .17 };
  });
}

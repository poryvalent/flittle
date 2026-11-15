import { createTreatSprites } from './hover-treat-art.js';

// A few little sweets follow the artwork, without replacing its original colour.
// Sprites are drawn once; this canvas only animates while particles are alive.
export function createHoverTreats(hero, reducedMotion) {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-treats';
  canvas.setAttribute('aria-hidden', 'true');
  hero.append(canvas);
  const ctx = canvas.getContext('2d');
  const sprites = createTreatSprites();
  const mask = document.createElement('canvas');
  const maskContext = mask.getContext('2d', { willReadFrequently: true });
  const particles = [];
  const MAX_PARTICLES = 36;
  let width = 1, height = 1, dpr = 1, pixels = null;
  let hovering = false, raf = 0, sequence = 0, lastSpawn = -Infinity;
  let lastX = 0, lastY = 0;

  function clear() {
    cancelAnimationFrame(raf); raf = 0;
    particles.length = 0; hovering = false; lastSpawn = -Infinity;
    ctx.clearRect(0, 0, width, height);
  }

  function resize(w, h, ratio) {
    clear();
    width = w; height = h; dpr = ratio;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function setArtwork(source) {
    // Read a small mask only when the wordmark changes, never during animation.
    const scale = Math.min(1, 1024 / Math.max(width, height));
    mask.width = Math.max(1, Math.round(width * scale));
    mask.height = Math.max(1, Math.round(height * scale));
    maskContext.drawImage(source, 0, 0, mask.width, mask.height);
    pixels = maskContext.getImageData(0, 0, mask.width, mask.height).data;
  }

  function hitsArtwork(x, y) {
    if (!pixels || x < 0 || y < 0 || x >= width || y >= height) return false;
    const mx = Math.floor(x * mask.width / width), my = Math.floor(y * mask.height / height);
    return pixels[(my * mask.width + mx) * 4 + 3] > 180;
  }

  function add(kind, x, y, size, angle, now, still = false) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ kind, x, y, size, angle, born: now, still,
      life: 1350 + Math.random() * 400,
      vx: (Math.random() - 0.5) * 24,
      vy: -22 - Math.random() * 17,
      spin: (Math.random() - 0.5) * 0.65,
      phase: Math.random() * Math.PI * 2 });
  }

  function burst(x, y, now, still) {
    const compact = width < 640, size = compact ? 29 : 42;
    const order = still ? 0 : sequence;
    const side = order % 2 ? -1 : 1;
    const cupcake = order % 2 ? 'cupcakeBlue' : 'cupcakePink';
    add(cupcake, x + side * size * 0.28, y - size * 0.35, size, side * 0.13, now, still);
    add(order % 3 ? 'heart' : 'star', x - side * size * 0.55, y - size * 0.68,
      size * 0.45, -side * 0.2, now, still);
    if (!still) {
      for (let i = 0; i < 3; i++) {
        const angle = sequence * 2.4 + i * 2.1;
        const radius = size * (0.5 + i * 0.15);
        add(i === 1 ? 'star' : 'sprinkle', x + Math.cos(angle) * radius,
          y + Math.sin(angle) * radius - size * 0.2,
          size * (i === 1 ? 0.25 : 0.22), angle, now);
      }
    }
    if (!still) sequence++;
  }

  function paint(now) {
    ctx.clearRect(0, 0, width, height);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i], age = now - p.born, t = p.still ? 0 : age / p.life;
      if (t >= 1) { particles.splice(i, 1); continue; }
      const seconds = p.still ? 0 : age / 1000;
      const intro = Math.min(1, age / 220);
      const pop = p.still ? 1 : 1 + 2.7 * Math.pow(intro - 1, 3) + 1.7 * Math.pow(intro - 1, 2);
      const fade = p.still ? 1 : 1 - Math.max(0, (t - 0.62) / 0.38);
      const sway = p.still ? 0 : Math.sin(seconds * 3 + p.phase) - Math.sin(p.phase);
      const size = p.size * pop * (1 - Math.max(0, t - 0.8) * 0.5);
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x + p.vx * seconds + sway * 4, p.y + p.vy * seconds);
      ctx.rotate(p.angle + p.spin * seconds);
      ctx.drawImage(sprites[p.kind], -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  function tick(now) {
    raf = 0;
    paint(now);
    if (particles.length) raf = requestAnimationFrame(tick);
  }

  function move(x, y) {
    const hit = hitsArtwork(x, y), entered = hit && !hovering;
    hovering = hit;
    if (reducedMotion.matches) {
      clear(); hovering = hit;
      if (hit) { burst(x, y, performance.now(), true); paint(performance.now()); }
      return;
    }
    if (!hit) return;
    const now = performance.now();
    const distance = Math.hypot(x - lastX, y - lastY);
    if (now - lastSpawn < 110 || (!entered && distance < (width < 640 ? 18 : 30))) return;
    lastSpawn = now; lastX = x; lastY = y;
    burst(x, y, now, false);
    if (!raf) raf = requestAnimationFrame(tick);
  }

  function leave() {
    hovering = false;
    if (reducedMotion.matches) clear();
  }

  return { resize, setArtwork, move, leave, clear,
    state: () => ({ treats: particles.length, treatHover: hovering, treatsRunning: !!raf }) };
}

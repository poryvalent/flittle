// Small deterministic pixel effects. The arcade exit owns the clock and canvas.
const random = n => { const x = Math.sin(n * 127.1 + 71.7) * 43758.5453; return x - Math.floor(x); };
const pixel = (ctx, x, y, w, h = w) => ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));

export function pixelRing(ctx, x, y, radius, color, alpha = 1, thickness = 2, squash = 1, turn = 0, count = 48) {
  if (radius <= 0 || alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  const block = Math.max(thickness, Math.min(7, radius * .052));
  for (let i = 0; i < count; i++) {
    const a = i / count * Math.PI * 2 + turn;
    pixel(ctx, x + Math.cos(a) * radius - block / 2, y + Math.sin(a) * radius * squash - thickness / 2, block, thickness);
  }
  ctx.restore();
}

export function fragments(ctx, x, y, age, color, seed, spread = 90, count = 10, upward = false) {
  if (age < 0 || age > .72) return;
  const p = age / .72, travel = 1 - (1 - p) ** 3;
  ctx.save(); ctx.globalAlpha *= 1 - p;
  for (let i = 0; i < count; i++) {
    const a = upward ? -Math.PI * (.12 + random(seed + i * 13) * .76) : random(seed + i * 13) * Math.PI * 2;
    const distance = travel * spread * (.30 + random(seed * 7 + i) * .7);
    const px = x + Math.cos(a) * distance, py = y + Math.sin(a) * distance + p * p * spread * .32;
    const size = Math.max(2, (4 + random(i + seed) * 5) * (1 - p * .6));
    ctx.fillStyle = i % 4 ? color : '#e9fff5';
    pixel(ctx, px, py, size * (i % 3 ? 1 : 1.8), size);
    if (i % 3 === 0) { ctx.globalAlpha *= .4; pixel(ctx, px - Math.cos(a) * 11, py - Math.sin(a) * 11, size * .5); ctx.globalAlpha /= .4; }
  }
  ctx.restore();
}

export function impact(ctx, x, y, age, color, size = 36) {
  if (age < 0 || age > .32) return;
  const p = age / .32, reach = size * (.35 + p * .75);
  ctx.save(); ctx.globalAlpha *= 1 - p; ctx.fillStyle = color;
  for (const side of [-1, 1]) {
    pixel(ctx, x + side * reach - 2, y - 2, 4, 4);
    pixel(ctx, x - 2, y + side * reach - 2, 4, 4);
  }
  if (p < .65) {
    pixel(ctx, x - reach * .65, y - 2, reach * 1.3, 4);
    pixel(ctx, x - 2, y - reach * .65, 4, reach * 1.3);
  }
  pixelRing(ctx, x, y, reach * .7, '#eaffef', (1 - p) * .7, 2, 1, .2, 12);
  ctx.restore();
}

export function streak(ctx, ax, ay, bx, by, color, width = 3, alpha = 1) {
  if (alpha <= 0 || width <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  const distance = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  const count = Math.max(1, Math.min(100, Math.ceil(distance / Math.max(3, width))));
  for (let i = 0; i <= count; i++) {
    const p = i / count;
    pixel(ctx, ax + (bx - ax) * p - width / 2, ay + (by - ay) * p - width / 2, width);
  }
  ctx.restore();
}

export function comet(ctx, x, y, angle, size, length, colors, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
  // Twelve stepped sections form a thick tapered comet, not a blurred shadow.
  for (let i = 12; i >= 0; i--) {
    const p = i / 12, width = size * (1 - p) * (i % 3 === 0 ? .90 : .72);
    const cx = x - dx * length * p, cy = y - dy * length * p;
    ctx.fillStyle = colors[0]; pixel(ctx, cx - width / 2, cy - width / 2, Math.max(3, width));
    if (i < 10) { ctx.fillStyle = colors[1]; pixel(ctx, cx - width * .24 + nx, cy - width * .24 + ny, Math.max(2, width * .48)); }
    if (i < 6) { ctx.fillStyle = colors[2]; pixel(ctx, cx - width * .1, cy - width * .1, Math.max(2, width * .2)); }
  }
  ctx.restore();
}

export function shield(ctx, x, y, size, progress, time, color) {
  const r = size * (1.28 - progress * .24);
  pixelRing(ctx, x, y, r, color, .32 + progress * .5, 3, 1, time * .3, 32);
  ctx.save(); ctx.globalAlpha *= .3 + progress * .55; ctx.strokeStyle = color; ctx.lineWidth = 3;
  const sides = 6;
  for (let i = 0; i < sides; i++) {
    const a = i / sides * Math.PI * 2 - Math.PI / 2;
    const b = a + Math.PI * 2 / sides;
    ctx.beginPath();
    ctx.moveTo(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r));
    ctx.lineTo(Math.round(x + Math.cos(b) * r), Math.round(y + Math.sin(b) * r)); ctx.stroke();
    ctx.fillStyle = i < Math.ceil(progress * sides) ? '#f3ffba' : color;
    pixel(ctx, x + Math.cos(a) * r - 3, y + Math.sin(a) * r - 3, 6);
  }
  ctx.restore();
}

export function wing(ctx, x, y, size, side, opening, color, alpha = 1) {
  ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = color;
  for (let i = 0; i < 5; i++) {
    const spread = (i + 1) * size * .17 * opening;
    const px = x - size * (.30 + i * .10);
    const py = y + side * spread;
    pixel(ctx, px - size * .22, py - size * .07, size * (.48 - i * .045), size * .14);
    ctx.fillStyle = i % 2 ? color : '#efffff';
  }
  ctx.restore();
}

// A bounded, event-driven pixel field. The invitation owns the only RAF; this
// renderer has no timers, listeners, or work after its pixels have settled.
export function createInvitationField(overlay, reduced) {
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-pixel-field'; canvas.setAttribute('aria-hidden', 'true');
  overlay.prepend(canvas);
  const ctx = canvas.getContext('2d');
  const noop = { move() {}, pulse() {}, reset() {}, resize() {}, step: () => false, state: () => ({ available: false }), destroy() { canvas.remove(); } };
  if (!ctx) { canvas.remove(); return noop; }
  const palette = ['#81cfff', '#78e6da', '#c9ff73', '#baa0ff'];
  let width = 1, height = 1, left = 0, top = 0, cells = [], ripples = [];
  let pointerX = -1000, pointerY = -1000, pointerOn = false, dirty = true, destroyed = false;
  let lastPulseX = -1000, lastPulseY = -1000, pulseAge = 1, colorIndex = 0;
  function draw() {
    ctx.clearRect(0, 0, width, height);
    for (const cell of cells) {
      // A quieter middle band keeps the invitation legible without a panel.
      const mask = Math.abs(cell.y - height / 2) < 54 && cell.x > width * .06 && cell.x < width * .94 ? .42 : 1;
      const heat = cell.heat * mask;
      const x = Math.round(cell.x + cell.dx), y = Math.round(cell.y + cell.dy);
      const size = heat > .5 ? 5 : heat > .18 ? 3 : cell.accent ? 2 : 1;
      ctx.fillStyle = palette[cell.color];
      if (heat > .18) {
        ctx.globalAlpha = heat * .10;
        ctx.fillRect(x - size - 3, y - size - 3, size * 2 + 6, size * 2 + 6);
      }
      ctx.globalAlpha = (cell.accent ? .14 : .075) * mask + heat * .82;
      ctx.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, size);
      if (heat > .58 && cell.accent) {
        ctx.globalAlpha = heat * .34;
        ctx.fillRect(x - 7, y, 15, 1); ctx.fillRect(x, y - 7, 1, 15);
      }
    }
    ctx.globalAlpha = 1;
  }
  function resize() {
    if (destroyed) return;
    const rect = overlay.getBoundingClientRect();
    width = Math.max(1, rect.width || innerWidth); height = Math.max(1, rect.height || innerHeight);
    left = rect.left; top = rect.top;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const gap = Math.max(27, Math.sqrt(width * height / 1400));
    cells = []; ripples = [];
    const columns = Math.ceil(width / gap), rows = Math.ceil(height / gap);
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns && cells.length < 1600; column++) {
      cells.push({ x: (column + .5) * gap, y: (row + .5) * gap,
        color: (column + Math.floor(row / 3)) % palette.length, accent: (column * 7 + row * 11) % 9 === 0,
        dx: 0, dy: 0, vx: 0, vy: 0, heat: 0 });
    }
    dirty = true; draw();
  }
  function pulse(x, y, force = false) {
    if (destroyed || reduced.matches) return;
    const px = x - left, py = y - top;
    if (!force && (pulseAge < .085 || Math.hypot(px - lastPulseX, py - lastPulseY) < 62)) return;
    const distances = Float32Array.from(cells, cell => Math.hypot(cell.x - px, cell.y - py));
    ripples.push({ age: force ? .045 : 0, duration: force ? 1.2 : .95, distances, color: colorIndex++ % 4 });
    if (ripples.length > 5) ripples.shift();
    lastPulseX = px; lastPulseY = py; pulseAge = 0; dirty = true;
  }
  function move(x, y, on = true) {
    if (destroyed) return;
    pointerX = x - left; pointerY = y - top; pointerOn = on; dirty = true;
    if (on) pulse(x, y);
  }
  function step(delta) {
    if (destroyed) return false;
    const dt = Math.min(.032, Math.max(0, delta)); pulseAge += dt;
    for (const ripple of ripples) ripple.age += dt;
    ripples = ripples.filter(ripple => ripple.age < ripple.duration);
    const radius = Math.min(165, Math.max(110, width * .14));
    const reach = Math.min(620, Math.max(width, height) * .68);
    let moving = ripples.length > 0;
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i], dx = cell.x - pointerX, dy = cell.y - pointerY, distance = Math.hypot(dx, dy);
      const local = pointerOn ? Math.max(0, 1 - distance / radius) : 0;
      let heat = local * local * .85, wavePush = 0;
      for (const ripple of ripples) {
        const age = ripple.age / ripple.duration;
        const wave = Math.max(0, 1 - Math.abs(ripple.distances[i] - (20 + age * reach)) / 34);
        const energy = wave * wave * (1 - age) * .9;
        if (energy > heat) cell.color = ripple.color;
        heat = Math.max(heat, energy); wavePush += energy * 3;
      }
      const push = reduced.matches ? 0 : local * local * 13 + wavePush;
      const tx = dx / Math.max(1, distance) * push, ty = dy / Math.max(1, distance) * push;
      if (reduced.matches) {
        cell.dx = cell.dy = cell.vx = cell.vy = 0; cell.heat = heat;
      } else {
        cell.vx += ((tx - cell.dx) * 150 - cell.vx * 20) * dt;
        cell.vy += ((ty - cell.dy) * 150 - cell.vy * 20) * dt;
        cell.dx += cell.vx * dt; cell.dy += cell.vy * dt;
        cell.heat += (heat - cell.heat) * -Math.expm1(-dt / .07);
      }
      if (Math.abs(cell.vx) + Math.abs(cell.vy) + Math.abs(cell.heat - heat) > .015) moving = true;
    }
    if (dirty || moving) draw();
    dirty = false;
    return moving;
  }
  function reset() {
    pointerOn = false; ripples = []; pulseAge = 1;
    lastPulseX = lastPulseY = -1000;
    for (const cell of cells) cell.dx = cell.dy = cell.vx = cell.vy = cell.heat = 0;
    dirty = true; draw();
  }
  resize();
  return { move, pulse, step, resize, reset,
    state: () => ({ available: true, cells: cells.length, ripples: ripples.length, width, height, reduced: reduced.matches, destroyed }),
    destroy() { destroyed = true; cells = []; ripples = []; canvas.remove(); }
  };
}

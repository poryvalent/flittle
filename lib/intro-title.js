// Keep the original SVG as the accessible/fallback layout, and animate its
// actual pixel cells. Every cell stays visible while the cursor pushes it.
export function createInteractiveTitle(image, reduced) {
  const host = image.parentElement;
  const canvas = document.createElement('canvas');
  canvas.className = 'intro-begin__pixels'; canvas.setAttribute('aria-hidden', 'true');
  host.append(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return { move() {}, step: () => false, reset() {} };
  const palette = [[201,255,115], [120,230,218], [129,207,255], [186,160,255]];
  const base = [241,243,238], padding = 40;
  let cells = [], width = 1, height = 1, unit = 1, left = 0, top = 0;
  let pointerX = -1000, pointerY = -1000, pointerOn = false, dirty = false;
  function draw() {
    ctx.clearRect(0, 0, width + padding * 2, height + padding * 2);
    for (const cell of cells) {
      const x = padding + cell.x * unit + cell.dx, y = padding + cell.y * unit + cell.dy;
      const color = palette[Math.floor(cell.x / 7) % palette.length];
      const rgb = base.map((v, i) => Math.round(v + (color[i] - v) * cell.heat));
      if (cell.heat > .1) {
        ctx.fillStyle = `rgba(${color.join(',')},${cell.heat * .12})`;
        ctx.fillRect(x - 3, y - 3, unit + 6, unit + 6);
      }
      ctx.fillStyle = `rgb(${rgb.join(',')})`;
      ctx.fillRect(x, y, unit + .15, unit + .15);
    }
  }
  function measure() {
    const rect = image.getBoundingClientRect();
    width = rect.width; height = rect.height; left = rect.left; top = rect.top;
    unit = width / 103;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round((width + padding * 2) * ratio);
    canvas.height = Math.round((height + padding * 2) * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    dirty = true; draw();
  }
  function prepare() {
    if (cells.length || !image.naturalWidth) return;
    try {
      const sample = document.createElement('canvas'); sample.width = 103; sample.height = 7;
      const paint = sample.getContext('2d', { willReadFrequently: true });
      paint.drawImage(image, 0, 0, 103, 7);
      const data = paint.getImageData(0, 0, 103, 7).data;
      for (let y = 0; y < 7; y++) for (let x = 0; x < 103; x++) {
        if (data[(y * 103 + x) * 4 + 3] > 100) cells.push({ x, y, dx: 0, dy: 0, vx: 0, vy: 0, heat: 0 });
      }
      measure(); host.classList.add('has-interactive-pixels');
    } catch { canvas.remove(); }
  }
  image.addEventListener('load', prepare, { once: true }); prepare();
  const observer = new ResizeObserver(measure); observer.observe(host);
  document.addEventListener('flittle:begin', () => observer.disconnect(), { once: true });
  return {
    move(x, y, on = true) { pointerX = x - left; pointerY = y - top; pointerOn = on; dirty = true; },
    step(dt) {
      if (!cells.length) return false;
      const radius = Math.max(60, Math.min(120, width * .17));
      let moving = false;
      for (const cell of cells) {
        const dx = (cell.x + .5) * unit - pointerX, dy = (cell.y + .5) * unit - pointerY;
        const distance = Math.hypot(dx, dy);
        const heat = pointerOn ? Math.max(0, 1 - distance / radius) : 0;
        const strength = heat * heat;
        const push = reduced.matches ? 0 : Math.min(16, unit * 2) * strength;
        const tx = dx / Math.max(1, distance) * push;
        const ty = dy / Math.max(1, distance) * push - (reduced.matches ? 0 : strength * 4);
        if (reduced.matches) { cell.dx = cell.dy = cell.vx = cell.vy = 0; cell.heat = heat; }
        else {
          cell.vx += ((tx - cell.dx) * 180 - cell.vx * 20) * dt;
          cell.vy += ((ty - cell.dy) * 180 - cell.vy * 20) * dt;
          cell.dx += cell.vx * dt; cell.dy += cell.vy * dt;
          cell.heat += (heat - cell.heat) * -Math.expm1(-dt / .09);
        }
        if (Math.abs(cell.vx) + Math.abs(cell.vy) + Math.abs(cell.heat - heat) > .02) moving = true;
      }
      if (moving || dirty) draw();
      dirty = false;
      return moving;
    },
    reset() {
      pointerOn = false;
      for (const cell of cells) { cell.dx = cell.dy = cell.vx = cell.vy = cell.heat = 0; }
      draw();
    }
  };
}

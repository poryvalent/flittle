import { createInteractiveTitle } from './intro-title.js';

// A lightweight cursor hint for the invitation. Work stops as soon as the pointer
// settles or the arcade opens; it never adds a loop to the website underneath.
export function initInvitation(overlay, controller) {
  const pointer = overlay.querySelector('[data-intro-pointer]');
  const sparks = overlay.querySelector('[data-intro-sparks]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const title = createInteractiveTitle(overlay.querySelector('.intro-begin__text img'), reduced);
  const colors = ['#c9ff73', '#81cfff', '#baa0ff', '#78e6da'];
  const pixels = Array.from({ length: 14 }, (_, index) => {
    const pixel = document.createElement('i');
    pixel.style.background = colors[index % colors.length];
    sparks.append(pixel);
    return { element: pixel, x: 0, y: 0 };
  });
  let x = innerWidth / 2, y = innerHeight / 2, px = x, py = y;
  let frame = 0, last = 0, moved = 0, visible = false;
  const idle = () => !controller.started && controller.ready && !controller.released;
  function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
  function tick(now) {
    frame = 0;
    if (!idle() || document.hidden || !fine.matches) return;
    const dt = Math.min(32, last ? now - last : 16); last = now;
    const blend = reduced.matches ? 1 : 1 - Math.exp(-dt / 58);
    px += (x - px) * blend; py += (y - py) * blend;
    const labelX = Math.max(10, Math.min(innerWidth - 170, px + 24));
    const labelY = Math.max(12, Math.min(innerHeight - 48, py + 22));
    pointer.style.transform = `translate3d(${labelX}px,${labelY}px,0)`;
    const speed = Math.min(1, (Math.abs(x - px) + Math.abs(y - py)) / 60);
    pointer.style.setProperty('--pointer-energy', speed.toFixed(2));
    let sourceX = px, sourceY = py;
    const life = reduced.matches ? 0 : Math.max(0, 1 - (now - moved) / 650);
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      const lag = 1 - Math.exp(-dt / (45 + i * 9));
      pixel.x += (sourceX - pixel.x) * lag;
      pixel.y += (sourceY - pixel.y) * lag;
      const spread = (i % 2 ? 1 : -1) * (3 + speed * 10);
      pixel.element.style.transform = `translate3d(${Math.round(pixel.x + spread)}px,${Math.round(pixel.y - 3)}px,0)`;
      pixel.element.style.opacity = (life * (1 - i / 17) * .75).toFixed(2);
      sourceX = pixel.x; sourceY = pixel.y;
    }
    const titleMoving = title.step(dt / 1000);
    if (titleMoving || life > 0 || Math.abs(x - px) + Math.abs(y - py) > .2) frame = requestAnimationFrame(tick);
  }
  overlay.addEventListener('pointermove', event => {
    x = event.clientX; y = event.clientY;
    if (!idle() || event.pointerType === 'touch' || !fine.matches) return;
    title.move(x, y);
    if (!visible) {
      visible = true; px = x; py = y;
      for (const pixel of pixels) { pixel.x = x; pixel.y = y; }
      overlay.classList.add('has-invitation-pointer');
    }
    moved = performance.now();
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: true });
  overlay.addEventListener('pointerdown', event => { x = event.clientX; y = event.clientY; }, { passive: true });
  overlay.addEventListener('pointerleave', () => {
    visible = false; moved = 0; title.move(x, y, false);
    overlay.classList.remove('has-invitation-pointer');
    for (const pixel of pixels) pixel.element.style.opacity = 0;
    if (!frame && idle()) frame = requestAnimationFrame(tick);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); title.reset(); } });
  reduced.addEventListener('change', () => { title.reset(); if (idle() && !frame) frame = requestAnimationFrame(tick); });
  document.addEventListener('flittle:begin', () => {
    stop(); title.reset();
    if (reduced.matches) return;
    pixels.forEach((pixel, index) => {
      const angle = index / pixels.length * Math.PI * 2;
      const distance = 60 + (index % 3) * 22;
      pixel.element.animate([
        { transform: `translate(${x}px,${y}px) scale(1)`, opacity: .9 },
        { transform: `translate(${x + Math.cos(angle) * distance}px,${y + Math.sin(angle) * distance}px) scale(.4)`, opacity: 0 }
      ], { duration: 700, easing: 'cubic-bezier(.16,.7,.3,1)', fill: 'forwards' });
    });
  });
}

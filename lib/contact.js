// A small, dependency-free adaptation of the Doodle Crew Footer reference.
// Contact stays an ordinary link; the sketchbook scene is progressive enhancement.
import { createContactScene } from './contact-art.js';

export function initContact(section) {
  if (!section) return null;
  const scene = section.querySelector('[data-contact-scene]');
  if (!scene) return null;
  scene.innerHTML = createContactScene();
  const year = section.querySelector('[data-contact-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const world = section.querySelector('.connect__world');
  const bubble = section.querySelector('[data-contact-bubble]');
  const announcement = section.querySelector('[data-contact-announcement]');
  const eyes = [...scene.querySelectorAll('[data-pupil]')];
  let visible = false;
  let frame = 0;
  let pointer = null;
  let talkTimer = 0;
  let activeCrew = null;

  function resetEyes() {
    cancelAnimationFrame(frame);
    frame = 0;
    pointer = null;
    eyes.forEach(eye => eye.removeAttribute('transform'));
  }

  function paintEyes() {
    frame = 0;
    if (!pointer || reduced.matches || !visible) return;
    eyes.forEach(eye => {
      const matrix = eye.parentNode.getScreenCTM();
      if (!matrix) return;
      const target = new DOMPoint(pointer.x, pointer.y).matrixTransform(matrix.inverse());
      const dx = target.x - Number(eye.dataset.eyeX);
      const dy = target.y - Number(eye.dataset.eyeY);
      const distance = Math.hypot(dx, dy);
      const reach = Number(eye.dataset.eyeMax) || 2.5;
      const amount = Math.min(reach, distance / 40) / Math.max(1, distance);
      eye.setAttribute('transform', `translate(${(dx * amount).toFixed(2)} ${(dy * amount).toFixed(2)})`);
    });
  }

  section.addEventListener('pointermove', event => {
    if (reduced.matches || !visible || event.pointerType === 'touch') return;
    pointer = { x: event.clientX, y: event.clientY };
    if (!frame) frame = requestAnimationFrame(paintEyes);
  }, { passive: true });
  section.addEventListener('pointerleave', resetEyes);

  function dismiss() {
    window.clearTimeout(talkTimer);
    if (bubble) { bubble.hidden = true; bubble.textContent = ''; }
    if (announcement) announcement.textContent = '';
    activeCrew?.classList.remove('is-hopping');
    activeCrew = null;
  }

  function sayHello(button) {
    dismiss();
    activeCrew = button;
    if (announcement) announcement.textContent = button.dataset.says;
    button.classList.add('is-hopping');
    if (bubble && world) {
      const bounds = world.getBoundingClientRect();
      const character = button.getBoundingClientRect();
      bubble.textContent = button.dataset.says;
      bubble.hidden = false;
      const half = bubble.offsetWidth / 2 + 8;
      const center = character.left + character.width / 2 - bounds.left;
      bubble.style.left = `${Math.max(half, Math.min(bounds.width - half, center))}px`;
      bubble.style.top = `${Math.max(12, character.top - bounds.top - 12)}px`;
    }
    talkTimer = window.setTimeout(dismiss, 2600);
  }

  scene.addEventListener('click', event => {
    const button = event.target.closest('[data-crew-button]');
    if (button) sayHello(button);
  });
  scene.addEventListener('keydown', event => {
    if (event.key === 'Escape') { dismiss(); return; }
    const button = event.target.closest('[data-crew-button]');
    if (button && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      if (!event.repeat) sayHello(button);
    }
  });
  scene.addEventListener('animationend', event => {
    if (event.animationName === 'connect-hop') event.target.closest('[data-crew-button]')?.classList.remove('is-hopping');
  });

  reduced.addEventListener('change', () => { if (reduced.matches) { resetEyes(); dismiss(); } });
  window.addEventListener('resize', dismiss, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetEyes(); });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      section.classList.toggle('is-visible', visible);
      if (visible) section.classList.add('has-arrived');
      else { resetEyes(); dismiss(); }
    }, { threshold: 0.12 });
    observer.observe(section);
  } else {
    visible = true;
    section.classList.add('is-visible', 'has-arrived');
  }

  return { get visible() { return visible; } };
}

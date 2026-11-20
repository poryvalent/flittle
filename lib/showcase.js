// Small, event-driven interactions; no extra renderer or animation loop.
import { initProjectInquiry } from './project-inquiry.js';

initProjectInquiry(document.querySelector('[data-project-inquiry]'));

document.querySelectorAll('[data-reveal-study]').forEach(study => {
  const input = study.querySelector('[data-reveal-input]');
  if (!input) return;
  function reveal() {
    const value = Math.max(0, Math.min(100, Number(input.value) || 0));
    study.style.setProperty('--reveal', `${value}%`);
    input.setAttribute('aria-valuetext', `${value}% of the website preview revealed`);
  }
  input.addEventListener('input', reveal);
  reveal();
});

document.querySelectorAll('[data-launch-demo]').forEach(demo => {
  const approve = demo.querySelector('[data-demo-approve]');
  const reset = demo.querySelector('[data-demo-reset]');
  if (!approve || !reset) return;
  function render(approved) {
    demo.classList.toggle('is-approved', approved);
    approve.disabled = approved;
    approve.innerHTML = approved ? 'Approved. Ready for the next step. <span aria-hidden="true">✓</span>' : 'Approve this version <span aria-hidden="true">↗</span>';
    demo.querySelector('[data-demo-badge]').textContent = approved ? 'Approved' : 'Ready for review';
    demo.querySelector('[data-demo-title]').textContent = approved ? 'That’s a green light.' : 'One last look. Then lift-off.';
    demo.querySelector('[data-demo-copy]').textContent = approved ? 'Your decision is clear. So is what happens next.' : 'The pages are ready for your sign-off.';
    demo.querySelector('[data-demo-check]').textContent = approved ? '✓' : '○';
    demo.querySelector('[data-demo-track] i').textContent = approved ? '✓' : '04';
    demo.querySelector('[data-demo-status]').textContent = approved
      ? 'Version approved in this demo. Clear feedback, right where you need it.'
      : 'A tiny demo. A real interaction. Give it a click.';
  }
  approve.addEventListener('click', () => {
    const keyboard = document.activeElement === approve && approve.matches(':focus-visible');
    render(true);
    if (keyboard) reset.focus({ preventScroll: true });
  });
  reset.addEventListener('click', () => {
    render(false);
    approve.focus({ preventScroll: true });
  });
});

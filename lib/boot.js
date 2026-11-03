// Local first: the cover and contact must never wait for the remote 3D modules.
import { initInkHero } from './ink.js';
import { initContact } from './contact.js';
import './preload.js';

const root = document.documentElement;
const controller = window.__flittleLoader;
const milestones = new Set();
let ready = false;
let finished = false;

const cover = document.getElementById('hero');
let coverHeight = cover.clientHeight || innerHeight;
let coverUp;
function coverState() {
  const up = window.scrollY < coverHeight * 0.6;
  if (up === coverUp) return;
  coverUp = up;
  root.classList.toggle('is-cover', up);
  document.dispatchEvent(new CustomEvent('flittle:cover', { detail: { up } }));
}
coverState();
window.addEventListener('scroll', coverState, { passive: true });
document.addEventListener('flittle:enter', coverState);
new ResizeObserver(([entry]) => { coverHeight = entry.contentRect.height; coverState(); }).observe(cover);

// This exported instance is reused by main.js instead of initializing twice.
export const invite = initContact(document.querySelector('.contact'));

function milestone(name) {
  milestones.add(name);
}

document.addEventListener('flittle:loaded', () => {
  finished = true;
}, { once: true });

// The font CSS is nonblocking so the loader can paint during its download.
function fontStylesReady() {
  const link = document.getElementById('site-fonts');
  if (!link || link.sheet || link.media === 'all') return Promise.resolve();
  return new Promise(resolve => {
    const finish = () => {
      clearTimeout(timer);
      link.removeEventListener('load', finish);
      link.removeEventListener('error', finish);
      resolve();
    };
    const timer = setTimeout(finish, 2500);
    link.addEventListener('load', finish);
    link.addEventListener('error', finish);
  });
}

fontStylesReady().then(() => {
  milestone('styles');
  return initInkHero({ onProgress: milestone }).ready;
}).catch(error => {
  // Static CSS sizing and the HTML mascot still provide a complete cover.
  console.warn('The interactive cover is unavailable; showing the static cover.', error);
}).finally(() => {
  ready = true;
  // The visitor chooses when to enter; an early click waits for this real readiness.
  controller?.markReady();
});

// Read-only state for regression checks, including throttled and failed loads.
export const loadingState = () => ({ ready, finished, milestones: [...milestones] });

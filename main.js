// Entry point. The page opens on the flittle ink cover and scrolls into the story: the bust on its
// plain dark ground, the pinned zoom-out, the services and approach screens, then the portfolio
// orbit and the invitation. This wires it all together: the cover's reveal, smooth corners, the
// header clock, the onboarding reveals, the bottom veil, the page tone, the bust with its scroll
// and pointer choreography, the orbit with its hold, and the contact section. The story header
// stays hidden under the cover.
import { initInkHero } from './lib/ink.js';
import { initSquircles } from './lib/squircle.js';
import { initClock } from './lib/header.js';
import { initReveal } from './lib/reveal.js';
import { initVeil } from './lib/veil.js';
import { initTone } from './lib/tone.js';
import { createCloud, MODEL_URL } from './lib/cloud.js';
import { createScroll } from './lib/scroll.js';
import { initCursor } from './lib/cursor.js';
import { initFrame } from './lib/frame.js';
import { initOrbit } from './lib/orbit.js';
import { initHold } from './lib/hold.js';
import { initContact } from './lib/contact.js';
import { initFocus } from './lib/focus.js';
import { PROJECTS } from './lib/projects.js';

// The cover counts as "up" until this share of it has scrolled away; then the story header appears.
const COVER_SHARE = 0.6;

const root = document.documentElement;

initInkHero();
initSquircles();
initClock();
initReveal();
initVeil();
const tone = initTone();

// ---- the cover state ----
const cover = document.querySelector('.ink-hero');
let coverUp = null, coverQueued = false;
function updateCover() {
  coverQueued = false;
  const up = window.scrollY < cover.offsetHeight * COVER_SHARE;
  if (up === coverUp) return;
  coverUp = up;
  root.classList.toggle('is-cover', up);
  tone.cover(up);
}
window.addEventListener('scroll', () => { if (!coverQueued) { coverQueued = true; requestAnimationFrame(updateCover); } }, { passive: true });
window.addEventListener('resize', updateCover);
updateCover();

// ---- the bust ----
const stage = document.querySelector('[data-stage]');
const cloud = createCloud(stage);
const scroll = createScroll();
initFrame(cloud, { onGround: (g) => tone.set(g) });

cloud.load(MODEL_URL)
  .then(() => { initCursor(cloud, scroll); })
  .catch((err) => { console.error('The bust could not be loaded.', err); });

// ---- the portfolio orbit, the hold that gives it the wheel, and the closing invitation ----
// The up arrow lands on the approach screen with its column this far down the viewport.
const PREV_INSET = 0.14;
const work = document.querySelector('.portfolio');
const contact = document.querySelector('.contact');
const approach = document.querySelector('#approach .screen__col') || document.querySelector('#approach');
let focus = null;
const orbit = initOrbit(work, { cloud, onOpen: (project, mesh) => focus?.open(project, mesh) });
focus = initFocus(document.querySelector('[data-focus]'), { orbit, total: PROJECTS.length });
const hold = initHold(work, {
  onWheel: (dy) => orbit?.kick(dy),
  next: contact,
  prev: () => approach.getBoundingClientRect().top + window.scrollY - PREV_INSET * window.innerHeight,
  nextButton: work.querySelector('[data-next]'),
  prevButton: work.querySelector('[data-prev]'),
});
const invite = initContact(contact);

// Exposed for debugging and automated checks only.
window.__kin = { cloud, scroll, orbit, hold, invite, focus };

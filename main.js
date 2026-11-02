// Entry point. The page opens on the flittle ink cover and scrolls into the story: the bust, the
// pinned zoom-out, the services and approach screens, then the portfolio orbit. This wires it all
// together: the cover's reveal, smooth corners, the header clock, the onboarding reveals, the
// bottom veil, the page tone, the bust with its scroll and pointer choreography, the hero title's
// soft window that follows the head, and the orbit. The story header stays hidden under the cover.
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

// The title's radial mask is a little larger than the head so the glyphs clear its outline.
const MASK_X = 0.5 / 0.64;
const MASK_Y = (0.5 * 1.08) / 0.64;
// The cover counts as "up" until this share of it has scrolled away; then the story header appears.
const COVER_SHARE = 0.6;
// The hero title spans the screen this far from each edge.
const TITLE_INSET = 24;

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
const title = stage.querySelector('.hero__title');
const cloud = createCloud(stage);
const scroll = createScroll();
initFrame(cloud, { onGround: (g) => tone.set(g) });

// The pixel title fills the width edge to edge (its widest line on phones), whatever it says.
function fitTitle() {
  title.style.fontSize = '100px';
  const range = document.createRange();
  range.selectNodeContents(title);
  const width = range.getBoundingClientRect().width || 1;
  title.style.fontSize = `${(100 * (window.innerWidth - 2 * TITLE_INSET)) / width}px`;
}
fitTitle();
window.addEventListener('resize', fitTitle);
if (document.fonts?.ready) document.fonts.ready.then(fitTitle);

// Cut a soft window in the title where the head stands in front of it.
let lastMask = '';
cloud.onPlace = () => {
  if (root.classList.contains('is-hero-out')) return;
  const { x: nx, y: ny } = cloud.headNdc;
  const x = Math.round(((nx + 1) / 2) * window.innerWidth - title.offsetLeft);
  const y = Math.round(((1 - ny) / 2) * window.innerHeight - (title.offsetTop - title.offsetHeight / 2));
  const rx = Math.round(cloud.headPx.w * MASK_X);
  const ry = Math.round(cloud.headPx.h * MASK_Y);
  const key = `${x},${y},${rx},${ry}`;
  if (key === lastMask) return;
  lastMask = key;
  title.style.setProperty('--hx', `${x}px`);
  title.style.setProperty('--hy', `${y}px`);
  title.style.setProperty('--hrx', `${rx}px`);
  title.style.setProperty('--hry', `${ry}px`);
};

cloud.load(MODEL_URL)
  .then(() => { initCursor(cloud, scroll); })
  .catch((err) => { console.error('The bust could not be loaded.', err); });

// ---- the portfolio orbit, the hold that gives it the wheel, and the closing invitation ----
// The up arrow lands on the approach screen with its column this far down the viewport.
const PREV_INSET = 0.14;
const work = document.querySelector('.portfolio');
const contact = document.querySelector('.contact');
const approach = document.querySelector('#approach .screen__col') || document.querySelector('#approach');
const orbit = initOrbit(work, { cloud });
const hold = initHold(work, {
  onWheel: (dy) => orbit?.kick(dy),
  next: contact,
  prev: () => approach.getBoundingClientRect().top + window.scrollY - PREV_INSET * window.innerHeight,
  nextButton: work.querySelector('[data-next]'),
  prevButton: work.querySelector('[data-prev]'),
});
const invite = initContact(contact);

// Exposed for debugging and automated checks only.
window.__kin = { cloud, scroll, orbit, hold, invite };

// A native portfolio for touch screens. It owns no WebGL, wheel handlers,
// pointer capture, scroll lock or continuous animation loop.
import { PROJECTS } from './projects.js';

export function initMobilePortfolio(section, { next, prev } = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const events = new AbortController();
  const subtitle = section.querySelector('.screen__sub');
  const title = section.querySelector('.screen__title');
  const previousSubtitle = subtitle?.textContent;
  const previousLabel = title?.getAttribute('aria-label');
  let index = 0, frame = 0, destroyed = false, preparing = null;

  section.classList.add('portfolio--mobile');
  if (subtitle) subtitle.textContent = 'Swipe through the work. Explore each project.';
  if (title) title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  const viewer = element('div', 'mobile-work');
  const controls = element('div', 'mobile-work__controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Browse projects');
  const previous = element('button', 'mobile-work__arrow', '←');
  previous.type = 'button'; previous.dataset.mobilePrev = '';
  previous.setAttribute('aria-label', 'Previous project');
  const count = element('span', 'mobile-work__count');
  count.dataset.mobileCount = '';
  count.setAttribute('aria-live', 'polite'); count.setAttribute('aria-atomic', 'true');
  const forward = element('button', 'mobile-work__arrow', '→');
  forward.type = 'button'; forward.dataset.mobileNext = '';
  forward.setAttribute('aria-label', 'Next project');
  controls.append(previous, count, forward);

  const track = element('div', 'mobile-work__track');
  track.id = 'mobile-projects'; track.tabIndex = 0;
  track.setAttribute('role', 'region');
  track.setAttribute('aria-roledescription', 'carousel');
  track.setAttribute('aria-label', 'Selected projects. Swipe left or right, or use the arrow buttons.');
  previous.setAttribute('aria-controls', track.id); forward.setAttribute('aria-controls', track.id);
  const images = [];
  const cards = PROJECTS.map((project, i) => {
    const card = element('article', 'mobile-work__project');
    card.dataset.mobileProject = String(i);
    card.setAttribute('role', 'group'); card.setAttribute('aria-roledescription', 'slide');
    card.setAttribute('aria-label', `${i + 1} of ${PROJECTS.length}: ${project.title}`);
    const image = element('img', 'mobile-work__image');
    image.alt = `${project.title} project preview`;
    image.decoding = 'async'; image.loading = 'eager'; image.src = project.image;
    images.push(image);
    const body = element('div', 'mobile-work__body');
    body.append(element('p', 'mobile-work__kicker', project.kicker), element('h3', 'mobile-work__title', project.title),
      element('p', 'mobile-work__summary', project.summary));
    const tags = element('ul', 'mobile-work__tags');
    tags.setAttribute('aria-label', 'Project disciplines');
    for (const tag of project.tags || []) tags.append(element('li', '', tag));
    body.append(tags);
    const story = element('div', 'mobile-work__story');
    for (const paragraph of project.body || []) story.append(element('p', '', paragraph));
    body.append(story);
    const links = element('div', 'mobile-work__links');
    for (const link of project.links || []) {
      const anchor = element('a', '', link.label);
      anchor.href = link.url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true');
      anchor.append(arrow); links.append(anchor);
    }
    body.append(links); card.append(image, body); track.append(card);
    return card;
  });
  viewer.append(controls, track);
  section.querySelector('.portfolio__nav').before(viewer);

  function update(nextIndex) {
    index = Math.max(0, Math.min(cards.length - 1, nextIndex));
    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`;
    count.setAttribute('aria-label', `Project ${index + 1} of ${cards.length}: ${PROJECTS[index].title}`);
    previous.disabled = index === 0; forward.disabled = index === cards.length - 1;
    cards.forEach((card, i) => {
      card.inert = i !== index;
      card.setAttribute('aria-hidden', String(i !== index));
    });
  }
  function select(nextIndex, smooth = true) {
    if (destroyed) return;
    const clamped = Math.max(0, Math.min(cards.length - 1, nextIndex));
    track.scrollTo({ left: cards[clamped].offsetLeft, behavior: smooth && !reduced.matches ? 'smooth' : 'instant' });
    // Native scrolling owns intermediate frames. Its scroll event updates the
    // accessible slide as it crosses the centre, including a touch swipe.
    if (!smooth || reduced.matches) update(clamped);
  }
  function onScroll() {
    if (frame || destroyed) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const width = track.clientWidth;
      if (width) update(Math.round(track.scrollLeft / width));
    });
  }
  const listen = (node, type, listener, options = {}) => node.addEventListener(type, listener, { ...options, signal: events.signal });
  listen(previous, 'click', () => select(index - 1));
  listen(forward, 'click', () => select(index + 1));
  listen(track, 'scroll', onScroll, { passive: true });
  listen(track, 'keydown', event => {
    if (event.target !== track || event.altKey || event.ctrlKey || event.metaKey) return;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    select(event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1));
  });
  function go(target) {
    if (!target) return;
    const value = typeof target === 'function' ? target() : target;
    const top = typeof value === 'number' ? value : value.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: reduced.matches ? 'instant' : 'smooth' });
  }
  const up = section.querySelector('[data-prev]'), down = section.querySelector('[data-next]');
  if (up) listen(up, 'click', () => go(prev));
  if (down) listen(down, 'click', () => go(next));
  const observer = new ResizeObserver(() => select(index, false));
  observer.observe(track);
  update(0);

  function prepare() {
    if (preparing) return preparing;
    preparing = Promise.all(images.map(image => {
      if (image.decode) return image.decode();
      if (image.complete) return image.naturalWidth ? Promise.resolve() : Promise.reject(new Error('A project image could not load.'));
      return new Promise((resolve, reject) => {
        const loaded = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new Error('A project image could not load.')); };
        const cleanup = () => { image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
        image.addEventListener('load', loaded, { once: true }); image.addEventListener('error', failed, { once: true });
      });
    })).then(() => {
      if (images.some(image => !image.naturalWidth)) throw new Error('A project image could not finish preparing.');
    });
    return preparing;
  }
  return {
    prepare, select,
    state: () => ({ mode: 'mobile', index, total: cards.length, title: PROJECTS[index].title, destroyed, running: Boolean(frame) }),
    destroy() {
      if (destroyed) return;
      destroyed = true; events.abort(); observer.disconnect(); cancelAnimationFrame(frame); frame = 0;
      viewer.remove(); section.classList.remove('portfolio--mobile');
      if (subtitle) subtitle.textContent = previousSubtitle;
      if (title && previousLabel !== null) title.setAttribute('aria-label', previousLabel);
    },
  };
}

// The portfolio hold. Scrolling into the portfolio, from above or from below, pins the page on
// it: the page's own scrolling is switched off (overflow hidden on the root, with the scrollbar
// gutter kept so nothing shifts), the wheel spins the orbit instead, and only the two arrows (or
// the keyboard, or an in-page link) leave it, up to the previous section or down to the next.
// Locking the container, rather than cancelling wheel events, is what makes a fast flick stick:
// the browser lets a page cancel only the first wheel event of a burst, and its smooth-scroll
// animation outlives the events, so anything that merely cancels would be overrun. The hold only
// ever engages for a mouse or trackpad: a finger keeps scrolling the page as usual. In-page links
// travel smoothly, and a link to the portfolio itself lands held.

// Firefox reports some wheels in lines or pages; converted to pixels with these.
const LINE_PX = 16;
// A programmatic travel is considered over this long after the last scroll event, or at the latest
// after this cap.
const SETTLE_MS = 140;
const TRAVEL_CAP_MS = 3000;
const SCROLL_KEYS = new Set(['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' ']);

// next and prev are where the arrows go: an element, a page offset, or a function returning one.
export function initHold(section, { onWheel, next, prev, nextButton, prevButton } = {}) {
  const root = document.documentElement;
  const fineMq = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  let held = false, travelling = false;
  let lastTop = sectionTop() - window.scrollY;

  function sectionTop() { return Math.round(section.getBoundingClientRect().top + window.scrollY); }
  function snap() { if (Math.abs(sectionTop() - window.scrollY) > 0) window.scrollTo(0, sectionTop()); }
  const editing = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

  // The wheel while held: the page cannot move (its overflow is hidden), so every event, cancelable
  // or not, goes to the orbit.
  function wheel(e) {
    if (!held || root.classList.contains('has-focus')) return;   // a project is in focus: its column scrolls
    if (e.cancelable) e.preventDefault();
    const unit = e.deltaMode === 1 ? LINE_PX : e.deltaMode === 2 ? window.innerHeight : 1;
    onWheel?.(e.deltaY * unit);
  }

  function keys(e) {
    if (!held || e.defaultPrevented || !SCROLL_KEYS.has(e.key) || editing(e.target) || root.classList.contains('has-focus')) return;
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'Home' || (e.key === ' ' && e.shiftKey);
    e.preventDefault();
    if (up) { if (prev) go(prev); }
    else if (next) go(next);
  }

  function hold() {
    if (held || !fineMq.matches) return;
    held = true;
    root.classList.add('is-held');
    section.classList.add('is-held');
    snap();
    window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', keys);
  }

  function release() {
    if (!held) return;
    held = false;
    window.removeEventListener('wheel', wheel);
    window.removeEventListener('keydown', keys);
    root.classList.remove('is-held');
    section.classList.remove('is-held');
    lastTop = sectionTop() - window.scrollY;
  }

  function offsetOf(target) {
    if (typeof target === 'function') return Math.round(target());
    if (typeof target === 'number') return Math.round(target);
    return Math.round(target.getBoundingClientRect().top + window.scrollY);
  }

  // Scrolls smoothly to a place without the hold catching the page on the way, then calls back.
  // A wheel or a scroll key during the travel hands the page back to the viewer at once.
  function go(target, after) {
    release();
    const top = offsetOf(target);
    if (Math.abs(window.scrollY - top) < 2) { after?.(); return; }
    travelling = true;
    const t0 = performance.now();
    let timer = 0;
    const done = (abandoned) => {
      if (!travelling) return;
      travelling = false;
      clearTimeout(timer);
      window.removeEventListener('scroll', bump);
      window.removeEventListener('scrollend', finish);
      window.removeEventListener('wheel', abandon);
      window.removeEventListener('keydown', abandonKey);
      lastTop = sectionTop() - window.scrollY;
      if (abandoned !== true) after?.();
    };
    const finish = () => done(false);
    const abandon = () => done(true);
    const abandonKey = (e) => { if (SCROLL_KEYS.has(e.key) && !editing(e.target)) done(true); };
    const check = () => {
      if (Math.abs(window.scrollY - top) < 2 || performance.now() - t0 > TRAVEL_CAP_MS) done(false);
      else timer = setTimeout(check, SETTLE_MS);
    };
    const bump = () => { clearTimeout(timer); timer = setTimeout(check, SETTLE_MS); };
    window.addEventListener('scroll', bump, { passive: true });
    window.addEventListener('scrollend', finish);
    window.addEventListener('wheel', abandon, { passive: true });
    window.addEventListener('keydown', abandonKey);
    timer = setTimeout(check, SETTLE_MS);
    window.scrollTo({ top, behavior: reducedMq.matches ? 'auto' : 'smooth' });
  }

  function onScroll() {
    const top = sectionTop() - window.scrollY;
    if (held) {
      // nothing the viewer does can move a locked page, but a scroll animation already in flight
      // can: put it back
      if (Math.abs(top) > 1) snap();
    } else if (!travelling) {
      // the section's top edge passed the top of the viewport, in either direction, by any amount
      const crossed = (lastTop > 0 && top <= 0) || (lastTop < 0 && top >= 0);
      if (crossed) hold();
    }
    lastTop = sectionTop() - window.scrollY;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { if (held) snap(); });
  fineMq.addEventListener('change', () => { if (!fineMq.matches) release(); });

  // In-page links travel smoothly; one to the portfolio lands held.
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const id = a.getAttribute('href').slice(1);
    const target = id && document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + id);
    go(target, () => { if (target === section) hold(); });
  });
  nextButton?.addEventListener('click', () => { if (next) go(next); });
  prevButton?.addEventListener('click', () => { if (prev) go(prev); });

  // A load on the portfolio's own anchor starts held.
  if (location.hash === '#' + section.id) requestAnimationFrame(() => { if (Math.abs(sectionTop() - window.scrollY) < 2) hold(); });

  return { hold, release, go, get held() { return held; }, get travelling() { return travelling; } };
}

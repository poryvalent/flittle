// The project focus: what opens when a card on the orbit is clicked. The whole screen is taken
// over the way a project page on igloo.inc is: the card flies out of the ring to hang at the left,
// lit and slowly turning (the orbit does that part), fog and grain roll over the scene, and a
// terminal-style column on the right decodes in line by line: a "////// Summary", the story, the
// stack, the links as "[name] ↗", with the brand glowing top-left and "[ Close ]" top-right. An
// ASCII loader "+===---==+" ticks for a moment before the words arrive.
// Under the pointer the words ripple: from where the pointer is, a wave runs out across the text,
// and every character it passes lifts a little, flares to ice-white and flickers through a few
// glyphs before settling again. Links and the close scramble whole and glow. Escape, the close
// button or the backdrop close it, and the card flies back into the ring.

// The loader: how long it runs, and how many cells it has.
const LOAD_MS = 700;
const LOAD_CELLS = 8;
// The decode: glyphs a character cycles through before settling, how long a line takes per
// character (ms), the floor and ceiling for a line, and the delay between lines.
const GLYPHS = '+-=/\\|<>[]{}#%&*:;~^';
const MS_PER_CHAR = 14;
const LINE_MIN_MS = 360;
const LINE_MAX_MS = 1100;
const LINE_GAP_MS = 90;
// The ripple: how fast the wave front travels (px/ms), how wide the band is (px), how far a
// character lifts at the crest (px), how likely a crest character is to flicker, and how far the
// pointer must move before a new ripple starts (px) and how soon after the last (ms).
const WAVE_SPEED = 0.9;
const WAVE_BAND = 56;
const WAVE_LIFT = 1.5;
const WAVE_FLICKER = 0.12;
const WAVE_STEP_PX = 44;
const WAVE_STEP_MS = 240;
// How long the overlay takes to leave before it is hidden (matches the CSS).
const CLOSE_MS = 700;

export function initFocus(root, { orbit, total = 0 } = {}) {
  if (!root) return null;
  const doc = document.documentElement;
  const col = root.querySelector('[data-focus-col]');
  const loader = root.querySelector('[data-focus-loader]');
  const meta = root.querySelector('[data-focus-meta]');
  const closeBtn = root.querySelector('[data-focus-close]');
  const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
  let open = false, current = null, before = null, timer = 0;
  let decodes = [];
  const ripples = [];
  let rippleRaf = 0;

  // ---- characters: every piece of text is a run of spans, one per character, words kept whole
  // so lines still break at spaces ----
  function spanify(el, text) {
    const frag = document.createDocumentFragment();
    for (const token of text.split(/( +)/)) {
      if (!token) continue;
      if (token[0] === ' ') {
        for (const ch of token) { const s = document.createElement('span'); s.className = 'c is-space'; s.dataset.c = ch; s.textContent = ch; frag.appendChild(s); }
        continue;
      }
      const w = document.createElement('span');
      w.className = 'w';
      for (const ch of token) {
        const s = document.createElement('span');
        s.className = 'c';
        s.dataset.c = ch;
        s.textContent = ch;
        w.appendChild(s);
      }
      frag.appendChild(w);
    }
    el.replaceChildren(frag);
    el.dataset.text = text;
  }
  const chars = (el) => [...el.querySelectorAll('.c')];

  function line(kind, text, extra) {
    const el = document.createElement('p');
    el.className = 'focus__' + kind;
    if (kind === 'links') {
      for (const l of extra) {
        const a = document.createElement('a');
        a.className = 'focus__link';
        a.href = l.url; a.target = '_blank'; a.rel = 'noopener';
        spanify(a, `[${l.label}]`);
        const arrow = document.createElement('i'); arrow.textContent = ' ↗'; arrow.setAttribute('aria-hidden', 'true');
        a.appendChild(arrow);
        el.appendChild(a);
      }
      return el;
    }
    spanify(el, text);
    return el;
  }

  function build(p) {
    const lines = [];
    lines.push(line('label', '////// Summary'));
    if (p.summary) lines.push(line('p', p.summary));
    for (const t of p.body || []) lines.push(line('p', t));
    if (p.tags?.length) { lines.push(line('label', '/// Stack')); lines.push(line('p', p.tags.map((t) => `[${t}]`).join('  '))); }
    if (p.links?.length) { lines.push(line('label', '/// Visit')); lines.push(line('links', '', p.links)); }
    col.replaceChildren(...lines);
    const index = orbit?.projects ? orbit.projects.indexOf(p) : -1;
    if (meta) spanify(meta, `${p.kicker || ''}${index >= 0 && total ? `  ·  ${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : ''}`);
    if (closeBtn && !closeBtn.querySelector('.c')) spanify(closeBtn, closeBtn.textContent.trim());
  }

  // ---- the decode-in: a line types itself out of glyphs ----
  function stopDecodes() { for (const d of decodes) cancelAnimationFrame(d.raf); decodes = []; }
  function decode(el, delay) {
    const cs = chars(el);
    const n = cs.length;
    if (reducedMq.matches || !n) { for (const s of cs) s.classList.remove('is-hidden'); return; }
    const dur = Math.min(LINE_MAX_MS, Math.max(LINE_MIN_MS, n * MS_PER_CHAR));
    for (const s of cs) { s.classList.add('is-hidden'); s.textContent = s.dataset.c; }
    const run = { raf: 0 };
    const t0 = performance.now() + delay;
    const step = (now) => {
      const t = Math.min(1, Math.max(0, (now - t0) / dur));
      const settled = Math.floor(t * n);
      const cycling = Math.min(n - settled, 6 + Math.floor(n * 0.12));
      for (let i = 0; i < n; i++) {
        const s = cs[i];
        if (i < settled) { s.textContent = s.dataset.c; s.classList.remove('is-hidden'); }
        else if (i < settled + cycling && t > 0) { s.textContent = s.dataset.c === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0]; s.classList.remove('is-hidden'); }
      }
      if (t < 1) run.raf = requestAnimationFrame(step);
      else for (const s of cs) { s.textContent = s.dataset.c; s.classList.remove('is-hidden'); }
    };
    run.raf = requestAnimationFrame(step);
    decodes.push(run);
  }
  function decodeAll() {
    stopDecodes();
    [...col.children].forEach((el, i) => {
      if (el.classList.contains('focus__links')) [...el.children].forEach((a, j) => decode(a, (i + j) * LINE_GAP_MS));
      else decode(el, i * LINE_GAP_MS);
    });
  }

  // ---- the ripple under the pointer ----
  // A ripple belongs to one element: the wave front runs out from the pointer over that
  // element's characters, whose places are measured once when the ripple starts.
  function startRipple(el, x, y) {
    const cs = chars(el);
    if (!cs.length) return;
    const cells = cs.map((s) => { const r = s.getBoundingClientRect(); return { s, x: r.left + r.width / 2, y: r.top + r.height / 2, done: false }; });
    let reach = 0;
    for (const c of cells) reach = Math.max(reach, Math.hypot(c.x - x, (c.y - y) * 1.6));
    ripples.push({ el, x, y, t0: performance.now(), cells, reach });
    if (!rippleRaf) rippleRaf = requestAnimationFrame(tickRipples);
  }
  function settle(c) {
    c.s.textContent = c.s.dataset.c;
    c.s.style.transform = '';
    c.s.classList.remove('is-hot', 'is-warm');
    c.done = true;
  }
  function tickRipples(now) {
    for (let r = ripples.length - 1; r >= 0; r--) {
      const rip = ripples[r];
      const front = (now - rip.t0) * WAVE_SPEED;
      let alive = false;
      for (const c of rip.cells) {
        if (c.done) continue;
        // the wave is a little flatter than it is wide, like the text
        const d = Math.hypot(c.x - rip.x, (c.y - rip.y) * 1.6);
        const k = (front - d) / WAVE_BAND;   // 0 at the front, 1 once the band has passed
        if (k < 0) { alive = true; continue; }
        if (k >= 1) { settle(c); continue; }
        alive = true;
        const e = Math.sin(k * Math.PI);     // the crest in the middle of the band
        c.s.style.transform = `translateY(${(-e * WAVE_LIFT).toFixed(2)}px)`;
        c.s.classList.toggle('is-hot', e > 0.55);
        c.s.classList.toggle('is-warm', e > 0.18 && e <= 0.55);
        if (c.s.dataset.c !== ' ') c.s.textContent = e > 0.3 && Math.random() < WAVE_FLICKER ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : c.s.dataset.c;
      }
      if (!alive || front > rip.reach + WAVE_BAND) { for (const c of rip.cells) if (!c.done) settle(c); ripples.splice(r, 1); }
    }
    rippleRaf = ripples.length ? requestAnimationFrame(tickRipples) : 0;
  }
  function stopRipples() {
    for (const rip of ripples) for (const c of rip.cells) if (!c.done) settle(c);
    ripples.length = 0;
    if (rippleRaf) { cancelAnimationFrame(rippleRaf); rippleRaf = 0; }
  }
  let lastX = -1e9, lastY = -1e9, lastAt = 0, lastEl = null;
  root.addEventListener('pointermove', (e) => {
    if (!open || e.pointerType === 'touch' || reducedMq.matches) return;
    const el = e.target.closest('.focus__p, .focus__label, .focus__link, .focus__close, .focus__meta');
    if (!el) { lastEl = null; return; }
    const now = performance.now();
    const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (el === lastEl && (moved < WAVE_STEP_PX || now - lastAt < WAVE_STEP_MS)) return;
    lastEl = el; lastX = e.clientX; lastY = e.clientY; lastAt = now;
    startRipple(el, e.clientX, e.clientY);
  }, { passive: true });

  // ---- the loader ----
  function runLoader(then) {
    if (!loader || reducedMq.matches) { then(); return; }
    loader.hidden = false;
    const t0 = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - t0) / LOAD_MS);
      const n = Math.round(t * LOAD_CELLS);
      loader.textContent = '+' + '='.repeat(n) + '-'.repeat(LOAD_CELLS - n) + '+';
      if (t < 1) requestAnimationFrame(tick); else { loader.hidden = true; then(); }
    };
    requestAnimationFrame(tick);
  }

  // ---- open and close ----
  function show(p, mesh) {
    clearTimeout(timer);
    stopDecodes(); stopRipples();
    current = p;
    build(p);
    col.classList.remove('is-in');
    if (!open) before = document.activeElement;
    open = true;
    root.hidden = false;
    doc.classList.add('has-focus');
    orbit?.focus?.(mesh);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      root.classList.add('is-open');
      closeBtn?.focus({ preventScroll: true });
      runLoader(() => { if (!open || current !== p) return; col.classList.add('is-in'); decodeAll(); });
    }));
  }

  function hide() {
    if (!open) return;
    open = false;
    stopDecodes(); stopRipples();
    if (loader) loader.hidden = true;
    root.classList.remove('is-open');
    doc.classList.remove('has-focus');
    orbit?.unfocus?.();
    timer = setTimeout(() => { if (!open) root.hidden = true; }, CLOSE_MS);
    if (before && typeof before.focus === 'function') before.focus({ preventScroll: true });
    before = null;
  }

  root.addEventListener('click', (e) => { if (e.target.closest('[data-focus-close]')) hide(); });
  window.addEventListener('keydown', (e) => { if (open && e.key === 'Escape') { e.preventDefault(); hide(); } });

  return { open: show, close: hide, get isOpen() { return open; }, get project() { return current; }, get rippling() { return ripples.length > 0; } };
}

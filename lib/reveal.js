// The onboarding screens: builds the bar charts and tick rows from their data, splits the titles into
// words, assigns each piece its place in the reveal cascade, and plays the reveal when a block scrolls
// into view (and back out when it leaves). Counters count up on each entry, and blocks drift a little
// against the scroll for depth.

// Cascade timing, ms: where a panel's parts start, and the step per kind of part.
const PANEL_START = 160;
const STEP_WORD = 45;
const STEP_CHIP = 60;
const STEP_OTHER = 90;
const AFTER_WORDS = 60;
// Counters: delay before counting and how long the count takes.
const COUNT_DELAY = 250;
const COUNT_DUR = 1400;
// Parallax is skipped for blocks further than this many window heights from the centre.
const PARALLAX_REACH = 1.5;

const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const fmtInt = new Intl.NumberFormat('en-US');

function buildBars(bars, key) {
  const data = JSON.parse(bars.dataset.bars);
  const set = data[key] || data[Object.keys(data)[0]];
  const plot = bars.querySelector('.bars__plot');
  const axis = bars.querySelector('.bars__axis');
  plot.classList.remove('is-grown');
  plot.innerHTML = set.values.map((v, j) => {
    const cls = j === set.now ? ' class="now"' : (j < set.now && v > 10 ? ' class="on"' : '');
    return `<i${cls} style="--h:${v};--j:${j}"></i>`;
  }).join('');
  axis.innerHTML = set.axis.map((a) => `<span${a === 'Now' ? ' class="is-now"' : ''}>${a}</span>`).join('');
  requestAnimationFrame(() => requestAnimationFrame(() => plot.classList.add('is-grown')));
}

function buildTicks(ticks) {
  const n = parseInt(ticks.dataset.ticks, 10) || 0;
  const on = parseInt(ticks.dataset.on, 10) || 0;
  ticks.innerHTML = Array.from({ length: n }, (_, j) => `<i class="${j < on ? 'on' : 'now'}" style="--j:${j}"></i>`).join('');
}

// Splits text nodes of a title into word spans so each word can rise on its own.
function splitWords(title) {
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        const parts = child.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          w.setAttribute('aria-hidden', 'true');
          w.textContent = part;
          frag.appendChild(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE) walk(child);
    }
  };
  walk(title);
}

const PART_SELECTOR = ['.screen__eyebrow', '.screen__title .w', '.screen__text', '.chips > li', '.panel__head', '.panel__text', '.stat', '.bars', '.ticks', '.track', '.legend', '.panel__note'].join(',');

function cascade(block) {
  let d = 0;
  if (block.classList.contains('panel')) { block.classList.add('rv', 'rv--panel'); block.style.setProperty('--d', '0'); d = PANEL_START; }
  const parts = [...block.querySelectorAll(PART_SELECTOR)];
  const words = parts.filter((el) => el.classList.contains('w'));
  const lastWord = words[words.length - 1];
  for (const el of parts) {
    el.classList.add('rv');
    let step = STEP_OTHER;
    if (el.classList.contains('w')) { el.classList.add('rv--word'); step = STEP_WORD; }
    else if (el.matches('.chips > li')) { el.classList.add('rv--chip'); step = STEP_CHIP; }
    el.style.setProperty('--d', String(d));
    d += step;
    if (el === lastWord) d += AFTER_WORDS;
  }
}

function formatCount(v, format) {
  if (format === 'hm') return `${Math.floor(v / 60)} h ${Math.round(v % 60)} m`;
  return fmtInt.format(Math.round(v));
}

function runCounters(block) {
  for (const el of block.querySelectorAll('[data-count]')) {
    const end = parseFloat(el.dataset.count);
    const format = el.dataset.format;
    cancelAnimationFrame(el._raf);
    clearTimeout(el._timer);
    el.textContent = formatCount(0, format);
    el._timer = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - t0) / COUNT_DUR);
        el.textContent = formatCount(end * expoOut(t), format);
        if (t < 1) el._raf = requestAnimationFrame(tick);
      };
      el._raf = requestAnimationFrame(tick);
    }, COUNT_DELAY);
  }
}

export function initReveal() {
  // charts and their range controls
  for (const bars of document.querySelectorAll('.bars[data-bars]')) {
    const panel = bars.closest('.panel');
    const seg = panel?.querySelector('.seg');
    const initial = seg?.querySelector('.seg__btn.is-on')?.dataset.range;
    buildBars(bars, initial);
    seg?.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg__btn');
      if (!btn) return;
      for (const b of seg.querySelectorAll('.seg__btn')) { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-selected', String(on)); }
      buildBars(bars, btn.dataset.range);
    });
  }
  for (const ticks of document.querySelectorAll('.ticks[data-ticks]')) buildTicks(ticks);
  for (const title of document.querySelectorAll('.screen__title')) splitWords(title);

  const blocks = [...document.querySelectorAll('[data-reveal]')];
  for (const block of blocks) cascade(block);

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const block = entry.target;
      if (entry.isIntersecting) {
        block.classList.add('is-in');
        runCounters(block);
      } else {
        block.dataset.dir = entry.boundingClientRect.top < window.innerHeight / 2 ? 'up' : 'down';
        block.classList.remove('is-in');
      }
    }
  }, { rootMargin: '-12% 0px -20% 0px' });
  for (const block of blocks) io.observe(block);

  // parallax
  const deep = blocks.filter((b) => b.dataset.depth).map((el) => ({ el, depth: parseFloat(el.dataset.depth), mid: 0 }));
  function measure() {
    for (const d of deep) d.el.style.translate = '';
    for (const d of deep) { const r = d.el.getBoundingClientRect(); d.mid = r.top + window.scrollY + r.height / 2; }
    parallax();
  }
  let queued = false;
  function parallax() {
    queued = false;
    const centre = window.scrollY + window.innerHeight / 2;
    for (const d of deep) {
      const off = d.mid - centre;
      if (Math.abs(off) > PARALLAX_REACH * window.innerHeight) continue;
      d.el.style.translate = `0 ${(-off * d.depth).toFixed(2)}px`;
    }
  }
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(parallax); } }, { passive: true });
  new ResizeObserver(measure).observe(document.body);
  measure();
}

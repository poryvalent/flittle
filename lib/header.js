// The header clock. It shows the local time in 24-hour form; the hours and minutes are only
// rewritten when they change so the text node stays stable, and each tick is scheduled to land
// just after the next whole second instead of polling.

const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

export function initClock(root = document) {
  const clock = root.querySelector('[data-clock]');
  if (!clock) return;
  const hm = clock.querySelector('[data-hm]');
  const sec = clock.querySelector('[data-s]');
  let shownHm = '';
  let timer = 0;

  function tick() {
    const now = new Date();
    const parts = fmt.formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value || '00';
    const nextHm = `${get('hour')}:${get('minute')}`;
    if (nextHm !== shownHm) { shownHm = nextHm; hm.textContent = nextHm; }
    sec.textContent = `:${get('second')}`;
    clock.setAttribute('datetime', now.toISOString());
    clearTimeout(timer);
    // Wake just after the next second boundary so the seconds never visibly skip.
    timer = setTimeout(tick, 1000 - now.getMilliseconds() + 5);
  }

  tick();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
}

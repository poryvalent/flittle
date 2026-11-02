// The closing section: "Let's work together". Clicking the invitation sends it away and brings in
// the booking button. This is a port of the "lets-work-section" React component to plain markup,
// CSS and this module; the states are classes on the wrapper, the hover work is CSS.

// Where to reach flittle. The inbox is a placeholder until the real one is known, and the booking
// link (cal.com, Calendly and the like) falls back to email while it is empty.
const EMAIL = 'hello@flittle.com';
const BOOK_URL = '';
const BOOK_SUBJECT = 'Intro call with flittle';
// The booking button arrives this long after the click (the invitation is on its way out).
const DONE_DELAY = 500;

export function initContact(section) {
  if (!section) return null;
  const wrap = section.querySelector('[data-contact]');
  const cta = section.querySelector('[data-contact-cta]');
  const done = section.querySelector('[data-contact-done]');
  const book = section.querySelector('[data-book]');
  const mail = section.querySelector('[data-mail]');
  if (mail) { mail.textContent = EMAIL; mail.href = `mailto:${EMAIL}`; }
  if (book) {
    if (BOOK_URL) { book.href = BOOK_URL; book.target = '_blank'; book.rel = 'noopener'; }
    else book.href = `mailto:${EMAIL}?subject=${encodeURIComponent(BOOK_SUBJECT)}`;
  }
  let clicked = false;
  function open() {
    if (clicked) return;
    clicked = true;
    wrap.classList.add('is-clicked');
    setTimeout(() => {
      wrap.classList.add('is-done');
      done?.removeAttribute('aria-hidden');
      cta?.setAttribute('aria-hidden', 'true');
    }, DONE_DELAY);
  }
  cta?.addEventListener('click', open);
  return { open, get clicked() { return clicked; } };
}

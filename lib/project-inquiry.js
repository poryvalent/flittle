// The second way in, under the LinkedIn button: a note that stays in the visitor's
// browser until they copy or download it (to send on LinkedIn), or, once an inbox is
// set on the section, open it as a draft in their own email app. No storage or network calls.
export function initProjectInquiry(section) {
  if (!section) return null;
  const form = section.querySelector('[data-inquiry-form]');
  const primary = section.querySelector('[data-inquiry-primary]');
  const copyButton = section.querySelector('[data-inquiry-copy]');
  const downloadButton = section.querySelector('[data-inquiry-download]');
  const status = section.querySelector('[data-inquiry-status]');
  const deliveryNote = section.querySelector('[data-inquiry-delivery]');
  const manual = section.querySelector('[data-inquiry-manual]');
  const manualText = section.querySelector('[data-inquiry-manual-text]');
  if (!form || !primary || !status) return null;

  const field = name => form.elements.namedItem(name);
  const description = field('description');
  if (!description) return null;
  const events = new AbortController();
  const urls = new Set();
  const timers = new Set();
  const actions = [primary, copyButton, downloadButton].filter(Boolean);
  const inbox = (section.dataset.inquiryEmail || '').trim();
  // Reject malformed configuration rather than silently using a placeholder.
  const hasInbox = /^[^\s@<>?#&]+@[^\s@<>?#&]+\.[^\s@<>?#&]+$/.test(inbox);
  let destroyed = false;
  let busy = false;

  form.noValidate = true;
  actions.forEach(button => { button.disabled = false; });
  primary.textContent = hasInbox ? 'Open email draft' : 'Copy note';
  if (copyButton) copyButton.hidden = !hasInbox;
  if (deliveryNote) deliveryNote.textContent = hasInbox
    ? 'Open a draft in your email app, then review and send it. Copy and download are also available.'
    : 'The quickest way to reach us is a message to our LinkedIn page, above. Copy or download your note to paste it there; nothing is sent from this page.';

  function announce(message) { if (!destroyed) status.textContent = message; }
  function value(name) { return String(field(name)?.value || '').trim(); }
  function validate() {
    description.setCustomValidity(value('description') ? '' : 'Add a note before continuing.');
    if (form.reportValidity()) return true;
    announce('Check the highlighted field before preparing your note.');
    return false;
  }
  function brief() {
    const lines = [
      'HELLO FLITTLE',
      '',
    ];
    if (value('email')) lines.push(`Reply email: ${value('email')}`);
    lines.push('', value('description'));
    return lines.join('\n');
  }
  function setBusy(next) {
    busy = next;
    actions.forEach(button => { button.disabled = next || destroyed; });
    form.setAttribute('aria-busy', String(next));
  }
  async function copy() {
    if (destroyed || busy || !validate()) return;
    const text = brief();
    setBusy(true);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (destroyed) return;
      if (manual) manual.hidden = true;
      announce('Note copied. Paste it wherever you want to share it. Nothing has been sent.');
    } catch {
      if (destroyed) return;
      if (manual && manualText) {
        manual.hidden = false;
        manualText.value = text;
        manualText.focus({ preventScroll: false });
        manualText.select();
      }
      announce('Automatic copying is unavailable. Copy the selected note below, or download the text file.');
    } finally {
      if (!destroyed) setBusy(false);
    }
  }
  function download() {
    if (destroyed || busy || !validate()) return;
    try {
      const url = URL.createObjectURL(new Blob([brief()], { type: 'text/plain;charset=utf-8' }));
      urls.add(url);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'hello-flittle.txt';
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      const timer = window.setTimeout(() => {
        URL.revokeObjectURL(url);
        urls.delete(url);
        timers.delete(timer);
      }, 30000);
      timers.add(timer);
      announce('Text-file download requested. Your note has not been sent.');
    } catch {
      announce('The text file could not be downloaded. Use Copy note instead.');
    }
  }
  function submit(event) {
    event.preventDefault();
    if (destroyed || busy) return;
    if (!hasInbox) { void copy(); return; }
    if (!validate()) return;
    const subject = 'Hello Flittle';
    const recipient = encodeURIComponent(inbox).replace(/%40/g, '@');
    try {
      window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(brief())}`;
      announce('Draft requested. Review and send it in your email app. If nothing opens, copy or download your note.');
    } catch {
      announce('Your email app could not be opened. Copy or download your note instead.');
    }
  }
  form.addEventListener('submit', submit, { signal: events.signal });
  form.addEventListener('input', () => {
    description.setCustomValidity('');
    status.textContent = '';
    // An earlier manually copied note should not masquerade as the edited one.
    if (manual) manual.hidden = true;
  }, { signal: events.signal });
  copyButton?.addEventListener('click', () => { void copy(); }, { signal: events.signal });
  downloadButton?.addEventListener('click', download, { signal: events.signal });

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      events.abort();
      timers.forEach(timer => window.clearTimeout(timer));
      urls.forEach(url => URL.revokeObjectURL(url));
      timers.clear();
      urls.clear();
      actions.forEach(button => { button.disabled = true; });
      form.removeAttribute('aria-busy');
    },
  };
}

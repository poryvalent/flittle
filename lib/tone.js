// The page tone: keeps the browser chrome in step with what is on screen. The flittle cover is
// off-white, the story is near-black, and the OS section lifts the ground to dark steel; the
// theme-color meta and color-scheme follow, so the address bar and form controls match.
// (The Kin OS brief lists this module but its section was cut off in the copy I was given; this
// is the smallest sensible reading of "tone".)

const COVER = '#f4f4f2';
const DARK = '#06070a';
const LIGHT = '#151821';

export function initTone() {
  const meta = document.querySelector('meta[name="theme-color"]');
  const root = document.documentElement;
  let light = false, cover = true, shown = '';
  function apply() {
    const colour = cover ? COVER : light ? LIGHT : DARK;
    if (colour === shown) return;
    shown = colour;
    if (meta) meta.setAttribute('content', colour);
    root.style.colorScheme = cover ? 'light' : 'dark';
  }
  apply();
  return {
    // g is the ground blend of the OS section, 0 = black site, 1 = lavender.
    set(g) { light = g > 0.5; apply(); },
    // on while the flittle cover is what the viewer sees.
    cover(on) { cover = on; apply(); },
  };
}

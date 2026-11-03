// Scroll choreography of the bust. Given the page offset, it returns where the head should be
// (in normalized device coordinates), how big, how it is turned, how far it has burst into dust,
// how far it has dissolved under the portfolio, how much of the hero is still showing, and how
// much the text screens dim it. The section tops are measured once per layout, not per frame.

// The two resting poses on the text screens: top-left looking right, and top-right looking left.
const LEFT  = { x: -0.66, y: 0.64, scale: 3.3, yaw: 0.48,  pitch: 0.03, roll: -0.28 };
const RIGHT = { x:  0.66, y: 0.64, scale: 3.3, yaw: -0.48, pitch: 0.03, roll:  0.28 };
// The hero head sinks a little while the OS frame zooms out, and rises back when it zooms in.
const CENTER_DROP = 0.08;
// Scroll windows in viewport heights, relative to the section tops.
const OS_IN = [0.08, 0.55];
const OS_OUT = [1.45, 2.2];
const TO_LEFT = [-1, -0.2];
const WINDOW = [-0.6, 0.1];
// The last screen before the portfolio: the bust bursts into dust over the first part of this
// window and dissolves point by point over the rest, so the orbit assembles out of its remains.
const EXIT = [-1, -0.1];
const EXIT_SCATTER = [0, 0.65];
const EXIT_FADE = [0.35, 1];
// ...and over this part of it the points that survive fly off to become the orbit's stars.
const EXIT_BECOME = [0.3, 1];
// On the way out the dust gathers toward the middle of the screen and shrinks, so it reads as
// the stuff the orbit is made of.
const EXIT_POSE = { x: 0, y: 0.05, scale: 1.5 };
const EXIT_GATHER = [0, 0.8];
// How much smaller the bust gets while it travels as a cloud.
const CONDENSE = 0.42;
const KEYS = ['x', 'y', 'scale', 'yaw', 'pitch', 'roll'];

const smooth = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function createScroll() {
  const tops = { os: 0, memory: 0, agents: 0, work: 0 };
  let vh = window.innerHeight;

  function measure() {
    vh = window.innerHeight;
    for (const key of Object.keys(tops)) {
      const el = document.querySelector(`[data-screen="${key}"]`);
      tops[key] = el ? el.getBoundingClientRect().top + window.scrollY : 0;
    }
  }

  const around = (top, [a, b], y) => smooth(top + a * vh, top + b * vh, y);

  function at(y, heroY) {
    const inOS = around(tops.os, OS_IN, y);
    const outOS = around(tops.os, OS_OUT, y);
    const toLeft = around(tops.memory, TO_LEFT, y);
    const u = clamp01((y - (tops.agents + WINDOW[0] * vh)) / ((WINDOW[1] - WINDOW[0]) * vh));
    const side = smooth(0.3, 0.7, u);
    const exit = around(tops.work, EXIT, y);
    const scatter = Math.max(smooth(0, 0.4, u) * (1 - smooth(0.6, 1, u)), smooth(EXIT_SCATTER[0], EXIT_SCATTER[1], exit));
    const fade = smooth(EXIT_FADE[0], EXIT_FADE[1], exit);
    const become = smooth(EXIT_BECOME[0], EXIT_BECOME[1], exit);
    const centre = { x: 0, y: heroY - CENTER_DROP * inOS * (1 - outOS), scale: 1, yaw: 0, pitch: 0, roll: 0 };
    const pose = {};
    for (const k of KEYS) {
      const screen = LEFT[k] + (RIGHT[k] - LEFT[k]) * side;
      pose[k] = centre[k] + (screen - centre[k]) * toLeft;
    }
    const gather = smooth(EXIT_GATHER[0], EXIT_GATHER[1], exit);
    for (const k of Object.keys(EXIT_POSE)) pose[k] += (EXIT_POSE[k] - pose[k]) * gather;
    pose.scale *= 1 - CONDENSE * scatter;
    return { pose, scatter, fade, become, hero: 1 - inOS, dim: toLeft };
  }

  measure();
  new ResizeObserver(measure).observe(document.body);
  return { at, measure, tops };
}

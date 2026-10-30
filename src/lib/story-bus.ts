/**
 * Shared timeline for the second half of the home page. The bust renderer
 * measures scroll and projects the man's eye; the drawn eye and the embedded
 * portfolio read from here instead of measuring the page again, so the three
 * layers stay in step to the pixel. Progress `q` counts viewports scrolled
 * past the top of the eye section (negative before it starts).
 */
export const EYE_SEQ = {
  REAL_VH: 6, // height of the eye section, in viewports
  SOLID: [0.3, 1.0], // the points fuse into the solid man
  APPROACH: [1.0, 2.3], // the camera closes in on his eye
  HANDOVER: [1.9, 2.3], // the bust fades out as the drawn eye fades in over it
  DIVE: [2.3, 3.4], // the drawn eye zooms into its own pupil
  RING_IN: [3.15, 3.7], // the portfolio emerges out of the dark
  RING_LIVE: [3.55, 5.2], // the ring takes the pointer
  RING_DOLLY: [3.8, 5.0], // a slight camera push while browsing
  RING_OUT: [5.2, 5.85], // the portfolio recedes
  CAT_SWITCH: 3.6, // the hidden point cloud is re-targeted to the cat
  CAT_IN: [5.25, 5.95], // dust condenses into the cat above the ending
  WORK_AT: 3.7, // where the "Work" link lands, in viewports from the section top
} as const;

export type StoryFrame = { q: number; eyeX: number; eyeY: number; eyeR: number; bustAlpha: number };
type Listener = (f: StoryFrame) => void;
const listeners = new Set<Listener>();

export const storyBus = {
  frame: { q: -1, eyeX: 0, eyeY: 0, eyeR: 0, bustAlpha: 1 } as StoryFrame,
  emit(f: StoryFrame) {
    storyBus.frame = f;
    listeners.forEach((l) => l(f));
  },
  on(fn: Listener) {
    listeners.add(fn);
    fn(storyBus.frame);
    return () => {
      listeners.delete(fn);
    };
  },
};

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const seg = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
export const smoothstep = (a: number, b: number, v: number) => {
  const t = seg(v, a, b);
  return t * t * (3 - 2 * t);
};

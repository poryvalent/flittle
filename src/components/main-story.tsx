"use client";

import { useEffect, type ReactNode } from "react";
import "./story.css";
import { BustStage } from "@/components/bust-stage";
import { EyeDive } from "@/components/eye-dive";
import { Counter, RangePanel, Rv, SplitTitle, Ticks, Bars, type BarSet } from "@/components/story-parts";
import { EYE_SEQ } from "@/lib/story-bus";

/**
 * The main page after the hero. A point-cloud man in front of a pixel-font
 * title, a pinned "zoom-out" where the whole screen shrinks into a frame and
 * seven glass widgets fly in from the camera, two scroll screens with panels,
 * then the eye sequence: the man turns solid, we dive into his eye and find
 * the portfolio inside, and the ending (passed in as children) follows with
 * the cat forming above it. This component owns the scroll choreography of
 * the DOM layers; the bust renderer owns the 3D and publishes the timeline.
 * All figures in the widgets and panels are illustrative demo data, not
 * Flittle results.
 */

// ---- OS choreography constants (progress is measured in viewport heights) ----
const PIN_VH = 1.7, HOLD = 0.5, OUT_VH = 1, END = 3.2;
const K0 = 3.6, LEN = 0.22, OUT_LEN = 0.45, BLUR = 44, BLUR_EASE = 0.55, GLASS_K = 1.5;
const FRAME_MIN = 0.56;
const SWAY_Y = [1, 0.7, 1.15, 0.8, 1.2, 0.6, 0.9];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
const smooth = (t: number) => t * t * (3 - 2 * t);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const outQuart = (t: number) => 1 - (1 - t) ** 4;
const expo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

class Spring {
  x = 0; v = 0; t = 0;
  constructor(public k: number, public c: number) {}
  step(dt: number) {
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.k * (this.t - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
  }
  snap() { this.x = this.t; this.v = 0; }
  get still() { return Math.abs(this.t - this.x) < 1e-3 && Math.abs(this.v) < 1e-2; }
}

type W = {
  el: HTMLElement; at: number; drift: number; sway: number; cx: number; cy: number;
  sx: Spring; sy: Spring; landed: boolean; last: string;
};


const PLAN: Record<string, BarSet> = {
  Plan: { values: [64, 72, 58, 40, 22, 14, 10, 8, 6, 6, 10, 8], axis: ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Now"], now: 11 },
  Build: { values: [14, 22, 46, 58, 66, 72, 68, 64, 52, 40, 28, 20], axis: ["Wk 2", "Wk 4", "Wk 6", "Wk 8", "Now"], now: 11 },
  Launch: { values: [8, 8, 12, 16, 20, 26, 38, 52, 66, 72, 58, 44], axis: ["Wk 6", "Wk 8", "Wk 10", "Wk 12", "Now"], now: 11 },
};

const BUSY: BarSet = {
  values: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 84, 10, 10, 10, 10, 24, 24, 24, 66, 40, 10, 10, 10, 52, 10, 92, 30, 10, 10, 48, 64],
  axis: ["Mon", "Tue", "Wed", "Thu", "Fri", "Now"],
  now: 30,
};

const TYPED = "Add online ordering to our shop and tell us what it needs.";
const PLACEHOLDER = "Ask Flittle anything…";

export function MainStory({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const story = document.getElementById("story")!;
    const section = document.getElementById("story-os")!;
    const screen = section.querySelector<HTMLElement>(".fl-screen")!;
    const fixedEl = story.querySelector<HTMLElement>(".story-fixed")!;
    const head = section.querySelector<HTMLElement>(".fl-framehead")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    // ---- scroll reveal for the text screens ----------------------------------
    const revealIO = new IntersectionObserver(
      (entries, io) => {
        for (const e of entries) {
          const el = e.target as HTMLElement;
          if (e.isIntersecting) {
            el.removeAttribute("data-dir");
            el.classList.add("is-in");
          } else if (el.classList.contains("is-in")) {
            const rootMid = (e.rootBounds?.top ?? 0) + (e.rootBounds?.height ?? 0) / 2;
            el.dataset.dir = e.boundingClientRect.top < rootMid ? "up" : "down";
            el.classList.remove("is-in");
          }
        }
        void io;
      },
      { rootMargin: "-12% 0px -20% 0px" },
    );
    document.querySelectorAll("[data-reveal]").forEach((el) => revealIO.observe(el));

    // ---- widgets ---------------------------------------------------------------
    const widgets: W[] = [];
    const typedEl = section.querySelector<HTMLElement>("[data-typed]")!;
    const composerText = section.querySelector<HTMLElement>(".fl-composer__text")!;
    let typeTimer = 0, typeInterval = 0;

    const onLand = (el: HTMLElement) => {
      el.querySelector(".fl-minibars")?.classList.add("is-grown");
      const cmp = el.querySelector<HTMLElement>(".fl-composer__text");
      if (!cmp) return;
      const text = cmp.dataset.type || "";
      clearTimeout(typeTimer);
      clearInterval(typeInterval);
      if (reduced) {
        typedEl.textContent = text;
        cmp.classList.remove("is-empty");
        return;
      }
      typeTimer = window.setTimeout(() => {
        let i = 0;
        cmp.classList.remove("is-empty");
        typeInterval = window.setInterval(() => {
          typedEl.textContent = text.slice(0, ++i);
          if (i >= text.length) clearInterval(typeInterval);
        }, 34);
      }, 350);
    };
    const onLeave = (el: HTMLElement) => {
      el.querySelector(".fl-minibars")?.classList.remove("is-grown");
      if (el.querySelector(".fl-composer__text")) {
        clearTimeout(typeTimer);
        clearInterval(typeInterval);
        typedEl.textContent = PLACEHOLDER;
        composerText.classList.add("is-empty");
      }
    };

    let osTop = 0, realTop = 0, vw = 0, vh = 0;
    const real = document.getElementById("real");
    const layout = () => {
      vw = window.innerWidth;
      vh = window.innerHeight;
      osTop = section.getBoundingClientRect().top + window.scrollY;
      realTop = real ? real.getBoundingClientRect().top + window.scrollY : Infinity;
      const els = [...section.querySelectorAll<HTMLElement>(".fl-ow")].filter((e) => e.offsetWidth > 0);
      const drifts = els.map((e) => +(e.dataset.drift || 10));
      const dMin = Math.min(...drifts), dMax = Math.max(...drifts);
      widgets.length = 0;
      els.forEach((el, i) => {
        const drift = drifts[i];
        const k = 7 + (13 * (drift - dMin)) / Math.max(1e-6, dMax - dMin);
        const c = 2 * Math.sqrt(k) * 0.95;
        widgets.push({
          el, at: +(el.dataset.at || 0), drift, sway: SWAY_Y[i % SWAY_Y.length],
          cx: el.offsetLeft + el.offsetWidth / 2 - vw / 2,
          cy: el.offsetTop + el.offsetHeight / 2 - vh / 2,
          sx: new Spring(k, c), sy: new Spring(k, c), landed: false, last: "",
        });
      });
    };

    // ---- loop -----------------------------------------------------------------------
    const p = new Spring(26, 10);
    const frameDx = new Spring(16, 8), frameDy = new Spring(16, 8);
    let nx = 0, ny = 0, pointerLive = false;
    let raf = 0, running = false, last = 0, lastScreen = "", lastHead = "", lastBg = "";

    const wake = () => {
      if (!running) { running = true; last = performance.now(); raf = requestAnimationFrame(tick); }
    };

    const tick = (now: number) => {
      const dt = clamp((now - last) / 1000, 0, 0.25);
      last = now;
      const rawS = clamp((window.scrollY - osTop) / vh, 0, END);
      p.t = rawS;

      const drifting = pointerLive && !reduced && fine.matches && p.x > 0;
      frameDx.t = drifting ? nx : 0; frameDy.t = drifting ? ny : 0;
      for (const w of widgets) { w.sx.t = drifting ? nx : 0; w.sy.t = drifting ? ny * w.sway : 0; }

      if (reduced) { p.snap(); frameDx.snap(); frameDy.snap(); widgets.forEach((w) => { w.sx.snap(); w.sy.snap(); }); }
      else { p.step(dt); frameDx.step(dt); frameDy.step(dt); widgets.forEach((w) => { w.sx.step(dt); w.sy.step(dt); }); }

      // Hero title and note leave on the first scroll (with hysteresis so it doesn't flicker).
      const out = story.dataset.heroOut === "1";
      if (!out && rawS > 0.05) story.dataset.heroOut = "1";
      else if (out && rawS <= 0.03) story.dataset.heroOut = "0";

      const x = p.x;
      const q = clamp(x / PIN_VH);
      const o = clamp((x - PIN_VH - HOLD) / OUT_VH);

      // The whole screen shrinks into a rounded frame and back.
      const k = inOut(seg(q, 0.06, 0.5)) * (1 - inOut(o));
      const scale = 1 - (1 - FRAME_MIN) * k;
      const fx = frameDx.x * -4 * k, fy = frameDy.x * -4 * k;
      const sTf = `translate(${fx.toFixed(2)}px, ${fy.toFixed(2)}px) scale(${scale.toFixed(4)})`;
      const sKey = `${sTf}|${k.toFixed(3)}`;
      if (sKey !== lastScreen) {
        lastScreen = sKey;
        // The fixed layer (title, note and the bust) is what shrinks into the frame; the
        // transparent "screen" carries the same transform so the headline sits inside it.
        const radius = k > 0 ? `${((28 * k) / scale).toFixed(2)}px` : "";
        for (const el of [screen, fixedEl]) {
          el.style.transform = k > 0 ? sTf : "";
          el.style.borderRadius = radius;
        }
        fixedEl.classList.toggle("is-framed", k > 0);
      }

      // Ground: charcoal, lavender while the frame is small, the pupil's near-black once we are
      // inside the eye, and the page's paper for the ending.
      const g = seg(q, 0.1, 0.42) * (1 - seg(o, 0.3, 0.9));
      const qe = (window.scrollY - realTop) / vh;
      const dark = smooth(seg(qe, EYE_SEQ.DIVE[1] - 0.5, EYE_SEQ.DIVE[1] - 0.1));
      const paper = smooth(seg(qe, EYE_SEQ.RING_OUT[0] + 0.1, EYE_SEQ.RING_OUT[1]));
      let bg = "";
      if (paper > 0 || dark > 0) {
        const r = lerp(lerp(31, 5, dark), 244, paper), gg = lerp(lerp(35, 6, dark), 244, paper), b = lerp(lerp(38, 7, dark), 242, paper);
        bg = `rgb(${r | 0}, ${gg | 0}, ${b | 0})`;
      } else if (g > 0) {
        bg = `rgb(${lerp(31, 233, g) | 0}, ${lerp(35, 226, g) | 0}, ${lerp(38, 243, g) | 0})`;
      }
      if (bg !== lastBg) { lastBg = bg; story.style.background = bg; }

      // Frame headline.
      const e = outQuart(seg(q, 0.2, 0.44)) * (1 - smooth(seg(o, 0, 0.4)));
      const hTf = `translateY(${((1 - e) * 24).toFixed(1)}px) scale(${(1 / scale).toFixed(4)})`;
      const hKey = `${e.toFixed(3)}|${hTf}`;
      if (hKey !== lastHead) {
        lastHead = hKey;
        head.style.opacity = e.toFixed(3);
        head.style.transform = hTf;
        head.style.filter = e > 0 && e < 1 ? `blur(${((1 - e) * 10).toFixed(1)}px)` : "";
      }

      // Widgets fly in from "the camera", settle, then fly back out latest-first.
      const order = [...widgets].sort((a, b) => b.at - a.at);
      const outAt = new Map(order.map((w, i) => [w, order.length > 1 ? (i * (1 - OUT_LEN)) / (order.length - 1) : 0]));
      for (const w of widgets) {
        const t = seg(q, w.at, w.at + LEN);
        const oa = outAt.get(w)!;
        const tOut = seg(o, oa, oa + OUT_LEN);
        const ee = expo(t);
        const eOut = tOut ** 2.2;
        const kk = reduced ? 1 : 1 + (K0 - 1) * (1 - ee + eOut);
        const here = ee * (1 - tOut);
        const tx = (reduced ? 0 : w.cx * (kk - 1)) + w.sx.x * w.drift * here;
        const ty = (reduced ? 0 : w.cy * (kk - 1)) + w.sy.x * w.drift * here;
        const opacity = reduced ? clamp(t * (1 - tOut) * 2) : smooth(clamp(t / 0.45)) * (1 - smooth(clamp((tOut - 0.3) / 0.7)));
        const flying = (t > 0 && t < 1) || (tOut > 0 && tOut < 1);
        const blur = reduced || !flying ? 0 : BLUR * ((kk - 1) / (K0 - 1)) ** BLUR_EASE;
        const glass = reduced ? 1 : clamp((GLASS_K - kk) / (GLASS_K - 1));
        const key = `${tx.toFixed(1)},${ty.toFixed(1)},${kk.toFixed(3)},${opacity.toFixed(3)},${blur.toFixed(1)},${glass.toFixed(3)}`;
        if (key !== w.last) {
          w.last = key;
          const s = w.el.style;
          s.opacity = opacity.toFixed(3);
          s.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${kk.toFixed(4)})`;
          s.filter = blur > 0.05 ? `blur(${blur.toFixed(1)}px)` : "";
          s.setProperty("--glass", glass.toFixed(3));
          s.setProperty("--solid", (1 - glass).toFixed(3));
          w.el.classList.toggle("has-glass", glass > 0);
        }
        if (t >= 1 && !w.landed) { w.landed = true; onLand(w.el); }
        else if (t < 1 && w.landed) { w.landed = false; onLeave(w.el); }
      }

      const settled = p.still && frameDx.still && frameDy.still && widgets.every((w) => w.sx.still && w.sy.still);
      if (settled) running = false;
      else raf = requestAnimationFrame(tick);
    };

    const onMove = (ev: PointerEvent) => {
      if (ev.pointerType === "touch" || !fine.matches) return;
      nx = (ev.clientX / vw) * 2 - 1;
      ny = (ev.clientY / vh) * 2 - 1;
      pointerLive = true;
      if (p.x > 0) wake();
    };
    const onResize = () => { layout(); wake(); };
    const onScroll = () => wake();

    layout();
    p.t = clamp((window.scrollY - osTop) / vh, 0, END);
    p.snap(); // a load in the middle of the page starts in its pose
    wake();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    document.fonts?.ready.then(onResize);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(typeTimer);
      clearInterval(typeInterval);
      revealIO.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div id="story" className="story" data-hero-out="0">
      {/* Fixed layers: the pixel title and the note. The cat canvas draws over the title. */}
      <div className="story-fixed" aria-hidden>
        <p className="story-title">
          <span>Hello,</span> <span>we&rsquo;re Flittle</span>
        </p>
        <BustStage />
        <div className="story-note">
          <div className="story-note__meta">
            <span className="fl-badge"><i className="fl-badge__dot" />Software development</span>
            <span>For teams without a tech team</span>
          </div>
          <p className="story-note__lead">
            Flittle is the tech team
            <br /> you don&rsquo;t have to hire. <span>We build it. You run the business.</span>
          </p>
        </div>
        <EyeDive />
      </div>

      <section id="story-hero" aria-label="Introduction" className="relative h-0">
        <h2 className="sr-only-text">Hello, we&rsquo;re Flittle. The tech team you don&rsquo;t have to hire.</h2>
      </section>

      {/* ---------------- pinned zoom-out ---------------- */}
      <section id="story-os" className="fl-os" aria-labelledby="os-title">
        <h2 className="sr-only-text" id="os-title">Everything you need built, in one quiet place.</h2>
        <div className="fl-os__pin">
          <div className="fl-screen">
            <div className="fl-framehead">
              <span className="fl-badge"><i className="fl-badge__dot" />Flittle</span>
              <p className="fl-framehead__title">
                Everything you need built, <span>in one quiet place.</span>
              </p>
            </div>
          </div>

          <figure className="fl-ow fl-ow--img fl-ow--img-b" data-at=".42" data-drift="12">
            <div className="fl-ph" style={{ background: "radial-gradient(circle at 30% 30%, #bfe6e2, transparent 60%), linear-gradient(135deg, #a785c9, #5d4a7a)" }} />
            <figcaption>Discovery <span>Sample</span></figcaption>
          </figure>
          <figure className="fl-ow fl-ow--img fl-ow--img-c" data-at=".48" data-drift="16">
            <div className="fl-ph" style={{ background: "radial-gradient(circle at 70% 25%, #fff3b0, transparent 55%), linear-gradient(135deg, #f5dd6e, #a785c9)" }} />
            <figcaption>Design <span>Sample</span></figcaption>
          </figure>
          <div className="fl-ow fl-ow--add" data-at=".50" data-drift="18">
            <span>Add a feature</span>
            <span className="fl-key" aria-hidden><i className="fl-plus" /></span>
          </div>
          <div className="fl-ow fl-ow--tools" data-at=".40" data-drift="9">
            <span className="fl-chip">Scope<kbd>⌘S</kbd></span>
            <span className="fl-chip">Estimate<kbd>⌘E</kbd></span>
            <span className="fl-chip">Later<kbd>L</kbd></span>
          </div>
          <article className="fl-ow fl-ow--chart" data-at=".46" data-drift="14">
            <div className="fl-ow__head"><span>Sample sprint</span><span className="fl-ow__up">+12%</span></div>
            <div className="fl-minibars" aria-hidden>
              {[46, 62, 34, 28, 74, 58, 66].map((h, i) => (
                <i key={i} className={i === 6 ? "now" : ""} style={{ ["--h" as string]: h }} />
              ))}
            </div>
            <div className="fl-minibars__axis"><span>Mon</span><span>Now</span></div>
          </article>
          <div className="fl-ow fl-ow--composer" data-at=".58" data-drift="6">
            <p className="fl-composer__text is-empty" data-type={TYPED}>
              <span data-typed>{PLACEHOLDER}</span>
              <i className="fl-caret" aria-hidden />
            </p>
            <div className="fl-composer__bar">
              <span className="fl-key" aria-hidden><i className="fl-plus" /></span>
              <span className="fl-chip">Brief</span>
              <span className="fl-chip">Link</span>
              <span className="fl-composer__end">
                <span className="fl-key" aria-hidden><i className="fl-mic" /></span>
                <span className="fl-key fl-key--send" aria-hidden><i className="fl-arrow" /></span>
              </span>
            </div>
            <i className="fl-composer__glow" aria-hidden />
          </div>
          <div className="fl-ow fl-ow--toast" data-at=".72" data-drift="11" role="status">
            <span className="fl-done" aria-hidden />
            Scoped. Your estimate is ready.
          </div>
        </div>
      </section>

      {/* ---------------- services (cat on the left, text on the right) ---------------- */}
      <section id="services" className="fl-screen-sec fl-screen-sec--right" data-screen="services">
        <div className="fl-col">
          <header className="fl-head" data-reveal>
            <Rv as="p" className="fl-eyebrow" d={0}>
              <span className="fl-badge"><i className="fl-badge__dot" />Software development</span>
              <span>Services</span>
            </Rv>
            <SplitTitle main="We build what your business runs on." sub="So you never have to build a tech team." />
            <Rv as="p" className="fl-text" d={420}>
              Websites, web apps and internal tools, planned, designed and built for you. Ask in plain words;
              we handle the engineering.
            </Rv>
          </header>
          <ul className="fl-chips" data-reveal>
            {["Websites", "Web apps", "Internal tools", "Integrations"].map((c, i) => (
              <Rv as="li" key={c} className="fl-chipx" d={60 * i}>{c}</Rv>
            ))}
          </ul>
          <RangePanel
            title="A project, step by step"
            sets={PLAN}
            initial="Build"
            note={<>Illustrative timeline · <Counter to={12} /> weeks shown</>}
          />
          <article className="fl-panel fl-rv fl-rv--panel" data-reveal>
            <Rv className="fl-panel__head" d={160}>
              <h3 className="fl-panel__title">Who does what</h3>
              <span className="fl-badge fl-badge--quiet">Illustrative</span>
            </Rv>
            <Rv className="fl-track" d={200} aria-hidden>
              <i style={{ ["--w" as string]: 30, ["--c" as string]: "var(--sun)" }} />
              <i style={{ ["--w" as string]: 70, ["--c" as string]: "var(--lilac)" }} />
            </Rv>
            <Rv className="fl-legend" d={260}>
              <span><i style={{ ["--c" as string]: "var(--sun)" }} />You decide what matters</span>
              <span><i style={{ ["--c" as string]: "var(--lilac)" }} />We design and build it</span>
            </Rv>
            <ul className="fl-chips">
              <Rv as="li" className="fl-chipx" d={320}>Plain-language updates</Rv>
              <Rv as="li" className="fl-chipx" d={380}>Ask anytime<kbd>⌘K</kbd></Rv>
            </ul>
          </article>
        </div>
      </section>

      {/* ---------------- process (cat on the right, text on the left) ---------------- */}
      <section id="process" className="fl-screen-sec fl-screen-sec--left" data-screen="process">
        <div className="fl-col">
          <header className="fl-head" data-reveal>
            <Rv as="p" className="fl-eyebrow" d={0}>
              <span className="fl-badge"><i className="fl-badge__dot fl-badge__dot--live" />Live</span>
              <span>How we work</span>
            </Rv>
            <SplitTitle main="Tell us what you need." sub="We check with you before anything big." />
            <Rv as="p" className="fl-text" d={420}>
              We take the technical work off your plate, from first idea to a working product, and stop at
              anything that&rsquo;s yours to decide.
            </Rv>
          </header>
          <ul className="fl-chips" data-reveal>
            {["Ask Flittle", "Scope", "Later"].map((c, i) => (
              <Rv as="li" key={c} className="fl-chipx" d={60 * i}>
                {c}
                {i < 2 && <kbd>{i === 0 ? "⌘K" : "⌘S"}</kbd>}
                {i === 2 && <kbd>L</kbd>}
              </Rv>
            ))}
          </ul>
          <article className="fl-panel fl-rv fl-rv--panel" data-reveal>
            <Rv className="fl-panel__head" d={160}>
              <h3 className="fl-panel__title">Your time, kept</h3>
              <span className="fl-badge">Sample · <Counter to={134} format="hm" /></span>
            </Rv>
            <Bars set={BUSY} d={250} />
            <Rv as="p" className="fl-panel__note" d={340}>Illustrative: busywork handled for you · 3 decisions waiting</Rv>
          </article>
          <article className="fl-panel fl-rv fl-rv--panel" data-reveal>
            <Rv className="fl-panel__head" d={160}>
              <h3 className="fl-panel__title">Your tech team</h3>
              <span className="fl-badge fl-badge--sun">Needs you · 3</span>
            </Rv>
            <Rv className="fl-stat" d={220}>
              <p className="fl-stat__value"><Counter to={0} /><small className="ml-1 text-[length:var(--t-m)] text-[var(--ink-2)]"> engineers to hire</small></p>
              <p className="fl-stat__label">Because Flittle is the team</p>
            </Rv>
            <Ticks count={48} on={37} d={300} />
            <Rv as="p" className="fl-panel__note" d={380}>Illustrative: the few decisions that are yours wait for you</Rv>
          </article>
        </div>
      </section>

      {/* ---------------- the eye: the man turns solid, we dive into his eye, the portfolio is inside ---------------- */}
      <section id="real" className="fl-real" aria-labelledby="work-title" style={{ height: `${EYE_SEQ.REAL_VH * 100}vh` }}>
        <h2 className="sr-only-text" id="work-title">Our work, in the round. Selected projects.</h2>
        <div id="work" className="fl-real__anchor" style={{ top: `${EYE_SEQ.WORK_AT * 100}vh` }} aria-hidden />
      </section>

      {children}
    </div>
  );
}


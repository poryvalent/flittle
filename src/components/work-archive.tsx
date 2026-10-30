"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import "./work.css";
import { PROJECTS } from "@/lib/projects";
import { coverURLs } from "@/lib/covers";
import { EYE_SEQ, seg, storyBus } from "@/lib/story-bus";
import { WorkIntro } from "@/components/work-intro";
import { WorkBio, WorkColophon, WorkCursor, WorkHeader, WorkMenu } from "@/components/work-chrome";

/**
 * The portfolio as a sphere of covers in 3D. Drag to rotate, scroll to dolly
 * in a little (the whole zoom lives in 16vh of scroll), toggle the flat grid,
 * click any project for a lightbox that flies out of the card it came from.
 * The headline sits on the world's origin and counter-rotates every frame, so
 * it always faces the viewer in the centre of the sphere while the cards turn
 * around it. On /work the page opens with the splash and the eye film and
 * carries its own chrome; embedded in the home page it lives inside the dive
 * and takes its cues (camera push, reveal) from the story bus instead.
 */

const N = PROJECTS.length;
const GA = Math.PI * (3 - Math.sqrt(5));
const DEG = 180 / Math.PI;

// Cards sit on a Fibonacci sphere so they spread evenly with no poles or seams.
const UNITS = Array.from({ length: N }, (_, i) => {
  const y = N > 1 ? 1 - (i / (N - 1)) * 2 : 0;
  const rad = Math.sqrt(Math.max(0, 1 - y * y));
  const th = i * GA;
  const x = Math.cos(th) * rad;
  const z = Math.sin(th) * rad;
  return { x, y, z, lat: Math.asin(y) * DEG, lon: Math.atan2(x, z) * DEG };
});

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const HEADLINE = ["Our", "work,", "in", "the", "round."];
const PRELOAD = ["/logo-white.png", "/cat.png"];
const noSubscribe = () => () => {};
const noCovers = () => null;

export function WorkArchive({ embedded = false }: { embedded?: boolean } = {}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLHeadingElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [grid, setGrid] = useState(false);
  const [lit, setLit] = useState<number | null>(null);
  const [litShown, setLitShown] = useState(false);
  const [deep, setDeep] = useState(false);
  const [menu, setMenu] = useState(false);

  // Mutable animation state lives in refs so the render loop never re-renders React.
  const S = useRef({
    R: 300, persp: 1150, spin: 0, tilt: -4, camZ: 0, dragX: 0, dragY: 0, velX: 0, velY: 0,
    focused: -1, shownLit: false, fade: new Float32Array(N).fill(-1), dimPrev: new Float32Array(N).fill(-1),
  });
  const locked = useRef(!embedded);
  const openToken = useRef(0);
  const srcRect = useRef<DOMRect | null>(null);

  // The covers are drawn on the client (blob URLs): null on the server, the cached list after hydration.
  const covers = useSyncExternalStore(noSubscribe, coverURLs, noCovers);
  // One stable list for the splash to warm; a fresh array each render would re-arm the intro.
  const introAssets = useMemo(() => (covers ? [...covers, ...PRELOAD] : null), [covers]);

  // The route's ground: a black document with a stable scrollbar gutter, locked until the film lets go.
  useEffect(() => {
    if (embedded) return;
    const html = document.documentElement;
    html.classList.add("wk-page");
    document.body.classList.add("wk-locked");
    html.style.overflow = "hidden";
    return () => {
      html.classList.remove("wk-page");
      document.body.classList.remove("wk-locked");
      html.style.overflow = "";
    };
  }, [embedded]);

  // ---- layout -------------------------------------------------------------------
  const layout = useCallback(() => {
    const root = rootRef.current, s = S.current;
    if (!root) return;
    const w = window.innerWidth, h = window.innerHeight;
    const hr = w <= 380 ? 0.38 : w <= 640 ? 0.42 : 0.46;
    const wr = w <= 380 ? 0.48 : w <= 640 ? 0.52 : 0.58;
    const floor = w <= 380 ? 108 : w <= 640 ? 120 : 155;
    s.R = Math.max(floor, Math.min(480, h * hr, w * wr));
    const scale = w <= 380 ? 0.44 : w <= 640 ? 0.46 : 0.47;
    const cw = Math.round(Math.max(72, s.R * scale));
    s.persp = w <= 380 ? 620 : w <= 640 ? 760 : w <= 900 ? 920 : 1150;
    root.style.setProperty("--cw", `${cw}px`);
    root.style.setProperty("--persp", `${s.persp}px`);
    UNITS.forEach((u, i) => {
      const el = cardRefs.current[i];
      if (el) el.style.transform = `translate3d(${u.x * s.R}px, ${-u.y * s.R}px, ${u.z * s.R}px) rotateY(${u.lon}deg) rotateX(${u.lat}deg)`;
    });
  }, []);

  // ---- render loop ----------------------------------------------------------------
  useEffect(() => {
    layout();
    let lastW = window.innerWidth, lastH = window.innerHeight;
    // Ignore the small deltas a scrollbar or a mobile URL bar makes.
    const onResize = () => {
      if (Math.abs(window.innerWidth - lastW) < 20 && Math.abs(window.innerHeight - lastH) < 20) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      layout();
    };
    let orient = 0;
    const onOrient = () => {
      clearTimeout(orient);
      orient = window.setTimeout(layout, 220);
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onOrient);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", layout);
    vv?.addEventListener("scroll", layout);
    // Nothing exists past the 16vh of zoom.
    const onScroll = () => {
      const max = window.innerHeight * 0.16;
      if (window.scrollY > max + 1) window.scrollTo(0, max);
    };
    if (!embedded) window.addEventListener("scroll", onScroll, { passive: true });

    let raf = 0;
    let hidden = false;
    const onVis = () => (hidden = document.hidden);
    document.addEventListener("visibilitychange", onVis);

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (hidden) return;
      const s = S.current;
      const world = worldRef.current, head = headRef.current;
      if (!world || !head) return;

      // Momentum only: the orb never spins on its own and it freezes while a project is open.
      if (!dragging && !s.shownLit) {
        s.dragX += s.velX;
        s.dragY += s.velY;
        s.velX *= 0.94; s.velY *= 0.94;
        if (Math.abs(s.velX) < 0.002) s.velX = 0;
        if (Math.abs(s.velY) < 0.002) s.velY = 0;
        s.dragY = clamp(s.tilt + s.dragY, -32, 32) - s.tilt;
      }

      // The whole zoom lives in the first 16% of a viewport of scrolling; it only dollies forward.
      // Inside the dive, the push comes from the story's timeline instead.
      const p = embedded
        ? seg(storyBus.frame.q, EYE_SEQ.RING_DOLLY[0], EYE_SEQ.RING_DOLLY[1])
        : clamp(window.scrollY / (window.innerHeight * 0.16));
      const camTarget = p * Math.min(64, s.R * 0.12);
      s.camZ += (camTarget - s.camZ) * 0.075;
      const sx = s.tilt + s.dragY;
      const sy = s.spin + s.dragX;

      world.style.transform = `translateZ(${s.camZ}px) rotateY(${sy}deg) rotateX(${sx}deg)`;
      // Counter-rotate the title and push it toward the camera along its own axis. Nothing else.
      head.style.transform = `rotateX(${-sx}deg) rotateY(${-sy}deg) translateZ(${s.R * 0.62}px)`;
      head.style.opacity = String(Math.max(0, 1 - p * 0.55));
      setDeepFlag(p > 0.5);

      const cx = Math.cos(sx / DEG), sxr = Math.sin(sx / DEG);
      const cy = Math.cos(sy / DEG), syr = Math.sin(sy / DEG);
      const near = s.persp * 0.66;
      const shade = 1 - Math.min(1, p * 1.6);
      UNITS.forEach((u, i) => {
        const el = cardRefs.current[i];
        if (!el) return;
        // Rotate the unit vector the way the world rotates and read its depth toward the camera.
        const py = -u.y, pz = u.z;
        const z1 = py * sxr + pz * cx;
        const zf = -u.x * syr + z1 * cy;
        const base = 0.14 + 0.86 * ((zf + 1) / 2) ** 0.85;
        let dim = shade * (1 - base);
        const absZ = zf * s.R + s.camZ;
        let fade = absZ > near ? Math.max(0, 1 - (absZ - near) / 190) : 1;
        if (s.shownLit) dim = Math.min(1, dim + 0.78);
        if (s.focused === i) fade = 0; // the lightbox plate stands in for it
        el.dataset.back = zf < 0 ? "1" : "0";
        const dimV = +dim.toFixed(3), fadeV = +fade.toFixed(3);
        if (fadeV !== s.fade[i]) { s.fade[i] = fadeV; el.style.opacity = String(fadeV); }
        if (dimV !== s.dimPrev[i]) { s.dimPrev[i] = dimV; el.style.setProperty("--d", String(dimV)); }
      });
    };

    // ---- drag ---------------------------------------------------------------------------
    let dragging = false, active = false, sxp = 0, syp = 0, lxp = 0, lyp = 0, moved = 0;
    let downCard: HTMLElement | null = null, touch = false;
    const stage = stageRef.current!;
    const slop = () => (window.matchMedia("(pointer: coarse)").matches ? 14 : 6);

    const onDown = (e: PointerEvent) => {
      if (S.current.shownLit) return;
      // Remember the card under the pointer before capture retargets the events.
      downCard = (e.target as HTMLElement).closest(".wk-card");
      active = true; moved = 0;
      sxp = lxp = e.clientX; syp = lyp = e.clientY;
      touch = e.pointerType === "touch";
      dragging = false;
      S.current.velX = S.current.velY = 0;
      if (!touch) { dragging = true; stage.setPointerCapture(e.pointerId); }
    };
    const onMove = (e: PointerEvent) => {
      if (!active) return;
      const dx = e.clientX - lxp, dy = e.clientY - lyp;
      lxp = e.clientX; lyp = e.clientY;
      moved = Math.max(moved, Math.hypot(e.clientX - sxp, e.clientY - syp));
      if (touch && !dragging) {
        const tx = Math.abs(e.clientX - sxp), ty = Math.abs(e.clientY - syp);
        if (Math.hypot(tx, ty) > 10) {
          if (ty > tx * 1.15) { active = false; return; } // a vertical swipe belongs to the page
          dragging = true; stage.setPointerCapture(e.pointerId);
        }
        return;
      }
      if (dragging) {
        const s = S.current;
        s.dragX += dx * 0.13; s.dragY -= dy * 0.13;
        s.velX = dx * 0.13; s.velY = -dy * 0.13;
      }
    };
    const onUp = () => {
      if (!active) return;
      active = false; dragging = false;
      const card = downCard; downCard = null;
      if (moved < slop() && card) {
        const idx = Number(card.dataset.idx);
        if (!Number.isNaN(idx)) openProject(idx, card);
      }
    };
    stage.addEventListener("pointerdown", onDown);
    stage.addEventListener("pointermove", onMove);
    stage.addEventListener("pointerup", onUp);
    stage.addEventListener("pointercancel", onUp);
    frame(); // one synchronous frame so the first paint is already the laid-out sphere

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(orient);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onOrient);
      window.removeEventListener("scroll", onScroll);
      vv?.removeEventListener("resize", layout);
      vv?.removeEventListener("scroll", layout);
      document.removeEventListener("visibilitychange", onVis);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("pointermove", onMove);
      stage.removeEventListener("pointerup", onUp);
      stage.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  // Covers mark themselves in once they have decoded, so nothing pops in half-drawn.
  useEffect(() => {
    const root = rootRef.current;
    if (!covers || !root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>(".wk-card img, .wk-rows img"));
    const offs = imgs.map((img) => {
      const mark = () => img.classList.add("in");
      if (img.complete && img.naturalWidth > 0) { mark(); return () => {}; }
      img.addEventListener("load", mark);
      return () => img.removeEventListener("load", mark);
    });
    return () => offs.forEach((off) => off());
  }, [covers]);

  // Inside the dive, the ring's chrome follows the story; on /work the intro calls the reveal.
  useEffect(() => {
    if (!embedded) return;
    return storyBus.on(({ q }) => {
      rootRef.current?.classList.toggle("is-in", q > EYE_SEQ.RING_IN[0] + 0.1 && q < EYE_SEQ.RING_OUT[1]);
    });
  }, [embedded]);

  const onReveal = useCallback(() => {
    locked.current = false;
    document.body.classList.remove("wk-locked");
    document.documentElement.style.overflow = "";
    layout();
    requestAnimationFrame(layout);
  }, [layout]);
  const onRevealed = useCallback(() => {
    layout();
    rootRef.current?.classList.add("is-in");
  }, [layout]);

  const deepRef = useRef(false);
  function setDeepFlag(v: boolean) {
    if (deepRef.current !== v) { deepRef.current = v; setDeep(v); }
  }

  // ---- lightbox ---------------------------------------------------------------------------
  function openProject(idx: number, src: HTMLElement) {
    srcRect.current = src.getBoundingClientRect();
    S.current.focused = grid ? -1 : idx;
    openToken.current++;
    setLit(idx);
    setLitShown(true);
    S.current.shownLit = true;
  }

  // Fly the plate out of the clicked card: measure home, start at the card's rect, release.
  useLayoutEffect(() => {
    const plate = plateRef.current, r = srcRect.current;
    if (!litShown || !plate || !r) return;
    plate.style.transition = "none";
    plate.style.transform = "";
    plate.style.opacity = "";
    const t = plate.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (t.left + t.width / 2);
    const dy = r.top + r.height / 2 - (t.top + t.height / 2);
    plate.style.transform = `translate(${dx}px, ${dy}px) scale(${Math.max(0.04, r.width / t.width)})`;
    plate.style.opacity = "0";
    void plate.offsetWidth;
    plate.style.transition = "";
    plate.style.transform = "";
    plate.style.opacity = "";
  }, [openToken.current, litShown]); // eslint-disable-line react-hooks/exhaustive-deps

  const closeProject = useCallback(() => {
    const plate = plateRef.current;
    const idx = lit;
    if (idx == null || !plate) return;
    S.current.focused = -1; // the card lights back up at once
    S.current.shownLit = false;
    const src = (grid
      ? document.querySelector<HTMLElement>(`.wk-rows figure[data-idx="${idx}"]`)
      : cardRefs.current[idx]) as HTMLElement | null;
    const r = src?.getBoundingClientRect();
    const t = plate.getBoundingClientRect();
    if (r) {
      const dx = r.left + r.width / 2 - (t.left + t.width / 2);
      const dy = r.top + r.height / 2 - (t.top + t.height / 2);
      plate.style.transform = `translate(${dx}px, ${dy}px) scale(${Math.max(0.04, r.width / t.width)})`;
    }
    plate.style.opacity = "0";
    setLitShown(false);
    window.setTimeout(() => {
      plate.style.transition = "none";
      plate.style.transform = "";
      plate.style.opacity = "";
      void plate.offsetWidth;
      plate.style.transition = "";
      setLit(null);
    }, 640);
  }, [lit, grid]);

  // Page scroll is held while anything full-screen is up; the lock from the intro wins until it lets go.
  useEffect(() => {
    document.documentElement.style.overflow = locked.current || litShown || grid || menu ? "hidden" : "";
  }, [litShown, grid, menu]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (litShown) closeProject();
      else if (menu) setMenu(false);
      else if (grid) setGrid(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [litShown, menu, grid, closeProject]);

  const project = lit != null ? PROJECTS[lit] : null;

  return (
    <div
      ref={rootRef}
      className={embedded ? "wk wk--embedded" : "wk"}
      data-grid={grid ? "1" : "0"}
      data-lit={litShown ? "1" : "0"}
      data-deep={deep ? "1" : "0"}
      data-menu={menu ? "1" : "0"}
    >
      <div ref={stageRef} className="wk-stage">
        <div ref={worldRef} className="wk-world">
          <div className="wk-orb">
            {PROJECTS.map((p, i) => (
              <div
                key={p.id}
                ref={(el) => { cardRefs.current[i] = el; }}
                className={p.tall ? "wk-card tall" : "wk-card"}
                data-idx={i}
                data-cursor="wide"
                role="button"
                tabIndex={-1}
                aria-label={`${p.title}, sample project`}
              >
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={covers?.[i]} alt="" draggable={false} />
                  <span className="tag">Sample {p.id}</span>
                </figure>
              </div>
            ))}
          </div>
          <h1 ref={headRef} className="wk-headline">
            <span className="inner">
              {HEADLINE.map((w, i) => (
                <Fragment key={w}>
                  <span style={{ ["--i" as string]: i }}>{w}</span>
                  {i < HEADLINE.length - 1 ? " " : null}
                </Fragment>
              ))}
            </span>
          </h1>
        </div>
      </div>

      <div className="wk-vig" aria-hidden />

      <div className="wk-grid" aria-hidden={!grid}>
        <div className="wk-rows">
          {PROJECTS.map((p, i) => (
            <figure
              key={p.id}
              data-idx={i}
              data-cursor="wide"
              onClick={(e) => openProject(i, e.currentTarget)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={covers?.[i]} alt={p.title} draggable={false} />
              <figcaption>{p.title}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <button type="button" className="wk-gridbtn" aria-label="Toggle grid view" aria-pressed={grid} onClick={() => setGrid((g) => !g)}>
        <b /><b /><b /><b />
      </button>

      <div className="wk-cue" aria-hidden><s />Drag to rotate</div>

      {!embedded && (
        <>
          <WorkHeader open={menu} onToggle={() => setMenu((m) => !m)} />
          <WorkBio />
          <WorkColophon />
          <WorkMenu open={menu} onClose={() => setMenu(false)} onArchive={() => setGrid(true)} />
          <WorkCursor />
          <WorkIntro assets={introAssets} onReveal={onReveal} onRevealed={onRevealed} />
        </>
      )}

      <div className="wk-lit" role="dialog" aria-modal="true" aria-label={project?.title ?? "Project"} aria-hidden={!litShown}>
        <div className="scrim" onClick={closeProject} />
        {project && (
          <div ref={plateRef} className={project.tall ? "wk-plate tall" : "wk-plate"}>
            <div className={project.tall ? "wk-shot tall" : "wk-shot"}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={covers?.[lit!]} alt={project.title} draggable={false} />
              <button type="button" className="wk-close" data-close onClick={closeProject}>Close</button>
            </div>
            <div className="wk-meta">
              <div>
                <h2>{project.title}</h2>
                <div className="where">{project.kind}</div>
                <span className="sample">Sample project</span>
              </div>
              <p className="note">{project.note}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

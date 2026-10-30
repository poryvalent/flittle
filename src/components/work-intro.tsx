"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The archive's opening. A black splash holds while the covers and the film
 * load (at least ~1.15s, never more than 9s), then the eye film runs at 2x:
 * an eye opens and the camera dives into the pupil. Just before the last
 * frame a black veil closes over it, the page unlocks and lays the sphere out
 * under the veil, and the intro lifts away onto an archive already in place.
 * Reduced motion skips the film and goes straight from the splash to the page.
 */

const FILM = "/media/eye-intro.mp4";
const POSTER = "/media/eye-poster.jpg";
const FILM_LENGTH = 6.04; // seconds; only used if the browser never reports a duration
const MIN_SPLASH = 1150, SPLASH_BACKSTOP = 9000, FILM_BACKSTOP = 14000, STALL = 2600;

type Props = {
  /** URLs to warm behind the splash; null until the parent knows them. */
  assets: string[] | null;
  /** The veil has started closing: unlock the page and lay the sphere out. */
  onReveal: () => void;
  /** The veil is fully black: lay out once more and show the archive. */
  onRevealed: () => void;
};

export function WorkIntro({ assets, onReveal, onRevealed }: Props) {
  const [splash, setSplash] = useState<"hold" | "out" | "gone">("hold");
  const [stage, setStage] = useState<"wait" | "film" | "closing" | "gone" | "done">("wait");
  const [novideo, setNovideo] = useState(false);
  const [birth] = useState(() => performance.now());
  const video = useRef<HTMLVideoElement>(null);
  const bar = useRef<HTMLElement>(null);
  const film = useRef({ ready: false, error: false, started: false, revealed: false });
  const timers = useRef<number[]>([]);
  const revealTimer = useRef(0);
  const waitTimer = useRef(0);
  const splashRan = useRef(false);
  const cb = useRef({ onReveal, onRevealed });
  useEffect(() => {
    cb.current = { onReveal, onRevealed };
  });
  useEffect(() => {
    const t = timers.current;
    return () => {
      t.forEach(clearTimeout);
      clearTimeout(revealTimer.current);
      clearTimeout(waitTimer.current);
    };
  }, []);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  // The cut: veil in, page unlocked and laid out under it, then the whole intro lifts away.
  const reveal = useCallback(() => {
    const st = film.current;
    if (st.revealed) return;
    st.revealed = true;
    clearTimeout(revealTimer.current);
    setStage("closing");
    cb.current.onReveal();
    later(() => {
      cb.current.onRevealed();
      setStage("gone");
      later(() => {
        video.current?.pause();
        setStage("done");
      }, 700);
    }, 1000);
  }, []);

  // Schedule the cut so it lands just before the last frame, under the black veil.
  const schedule = useCallback(() => {
    const v = video.current, st = film.current;
    if (!v || !st.started || st.revealed) return;
    const d = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : FILM_LENGTH;
    const ms = Math.max(300, ((d - v.currentTime - 0.45) / v.playbackRate) * 1000);
    clearTimeout(revealTimer.current);
    revealTimer.current = window.setTimeout(reveal, ms);
  }, [reveal]);

  // The film element exists from the first frame so it can load behind the splash.
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.playsInline = true;
    v.setAttribute("webkit-playsinline", "");
    v.playbackRate = 2;
    const st = film.current;
    const onReady = () => { st.ready = true; };
    const onError = () => { st.error = true; st.ready = true; setNovideo(true); };
    const onPlay = () => { v.playbackRate = 2; };
    const onPlaying = () => schedule();
    const onSeeked = () => { if (!v.paused) schedule(); };
    const onEnded = () => { if (st.started) reveal(); };
    v.addEventListener("canplaythrough", onReady);
    v.addEventListener("loadeddata", onReady);
    v.addEventListener("error", onError);
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("ended", onEnded);
    if (v.readyState >= 2) onReady();
    if (v.error) onError();
    return () => {
      v.removeEventListener("canplaythrough", onReady);
      v.removeEventListener("loadeddata", onReady);
      v.removeEventListener("error", onError);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("ended", onEnded);
    };
  }, [schedule, reveal]);

  // Splash: the bar fills as assets report in; hold for the minimum, never past the backstop.
  // Runs exactly once, however often the parent re-renders.
  useEffect(() => {
    if (!assets || splashRan.current) return;
    splashRan.current = true;
    const total = assets.length + 1; // the stills plus the film
    let loaded = 0, filmCounted = false, done = false;
    const paint = () => {
      if (bar.current) bar.current.style.transform = `scaleX(${Math.min(1, loaded / total).toFixed(3)})`;
    };
    const go = () => {
      if (done) return;
      done = true;
      if (bar.current) bar.current.style.transform = "scaleX(1)";
      later(() => {
        setSplash("out");
        setStage("film");
      }, 120);
      later(() => setSplash("gone"), 120 + 950);
    };
    const check = () => {
      if (done || loaded < total) return;
      const wait = Math.max(0, MIN_SPLASH - (performance.now() - birth));
      clearTimeout(waitTimer.current);
      waitTimer.current = window.setTimeout(go, wait);
    };
    const one = () => { loaded++; paint(); check(); };
    assets.forEach((src) => {
      const im = new Image();
      im.onload = im.onerror = one;
      im.src = src;
    });
    const filmIn = () => {
      if (filmCounted) return;
      filmCounted = true;
      one();
    };
    const v = video.current;
    if (film.current.ready) filmIn();
    else {
      v?.addEventListener("canplaythrough", filmIn);
      v?.addEventListener("loadeddata", filmIn);
      v?.addEventListener("error", filmIn);
    }
    later(go, Math.max(0, SPLASH_BACKSTOP - (performance.now() - birth)));
    paint();
  }, [assets, birth]);

  // The film: play from the first frame at 2x, with every way it can fail covered.
  useEffect(() => {
    if (stage !== "film") return;
    const v = video.current, st = film.current;
    st.started = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!v || reduced) {
      reveal();
      return;
    }
    if (st.error) {
      setNovideo(true);
      const t = window.setTimeout(reveal, 1300);
      return () => clearTimeout(t);
    }
    const backstop = window.setTimeout(reveal, FILM_BACKSTOP);
    if (v.currentTime > 0.05) v.currentTime = 0;
    v.playbackRate = 2;
    const tryPlay = () => { v.play().catch(() => {}); };
    tryPlay();
    if (!v.paused) schedule();
    // Autoplay blocked: the poster stays, the first interaction starts it; if nothing comes, move on.
    const kick = () => { if (v.paused) tryPlay(); };
    const opts: AddEventListenerOptions = { once: true, passive: true };
    window.addEventListener("pointerdown", kick, opts);
    window.addEventListener("keydown", kick, opts);
    window.addEventListener("touchstart", kick, opts);
    const stall = window.setTimeout(() => { if (v.paused) reveal(); }, STALL);
    const onErr = () => { setNovideo(true); window.setTimeout(reveal, 1300); };
    v.addEventListener("error", onErr);
    return () => {
      clearTimeout(backstop);
      clearTimeout(stall);
      window.removeEventListener("pointerdown", kick);
      window.removeEventListener("keydown", kick);
      window.removeEventListener("touchstart", kick);
      v.removeEventListener("error", onErr);
    };
  }, [stage, reveal, schedule]);

  if (stage === "done") return null;

  const introClass = ["wk-intro", stage === "closing" || stage === "gone" ? "closing" : "", stage === "gone" ? "gone" : "", novideo ? "novideo" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {splash !== "gone" && (
        <div className={`wk-splash${splash === "out" ? " out" : ""}`} aria-hidden>
          <div className="mark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-white.png" alt="" width={2036} height={720} draggable={false} />
          </div>
          <div className="bar"><s ref={bar} /></div>
          <div className="tag">Selected Work 2026</div>
        </div>
      )}
      <div className={introClass} role="presentation">
        <video
          ref={video}
          className="film"
          src={FILM}
          poster={POSTER}
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          aria-hidden
        />
        <div className="fallback" aria-hidden />
        <div className="veil" aria-hidden />
        <button type="button" className="skip" onClick={reveal} tabIndex={stage === "film" ? 0 : -1}>
          Skip
        </button>
      </div>
    </>
  );
}

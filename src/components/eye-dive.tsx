"use client";

import { useEffect, useRef } from "react";
import { WorkArchive } from "@/components/work-archive";
import { EYE_SEQ as S, seg, smoothstep as smooth, storyBus } from "@/lib/story-bus";

/**
 * The drawn eye that takes over from the solid man, the dive into its pupil,
 * and the portfolio that waits inside. Everything here is driven by the story
 * bus: the bust renderer says where the man's eye is on screen and how wide
 * it is, and this layer draws its eye exactly there, opens the lids, glances,
 * then zooms about the pupil until the dark fills the screen. The portfolio
 * ring rises out of that dark, takes the pointer for a while, then recedes.
 */

const W = 800, H = 400; // the eye is laid out at a fixed size, then scaled as a whole
const IRIS = 130, PUPIL = 52, OPENING = 760; // eye units
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function EyeDive() {
  const layer = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const lids = useRef<HTMLDivElement>(null);
  const gaze = useRef<HTMLDivElement>(null);
  const pupil = useRef<HTMLDivElement>(null);
  const dark = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastRing = "", lastEye = "";
    return storyBus.on(({ q, eyeX, eyeY, eyeR }) => {
      const el = layer.current, st = stage.current, ld = lids.current, gz = gaze.current, pu = pupil.current, dk = dark.current, rg = ring.current;
      if (!el || !st || !ld || !gz || !pu || !dk || !rg) return;

      // ---- the eye ----
      const eyeAlpha = smooth(S.HANDOVER[0], S.HANDOVER[1], q) * (1 - smooth(S.RING_IN[0] + 0.2, S.RING_IN[1], q));
      const fit = Math.max(0.02, (2 * eyeR * 1.15) / OPENING); // the drawn opening sits over the man's eye
      const u = seg(q, S.DIVE[0], S.DIVE[1]);
      const diag = Math.hypot(window.innerWidth, window.innerHeight) / 2;
      const maxZoom = Math.max(8, (diag * 1.15) / (PUPIL * 1.3 * fit));
      const zoom = Math.exp(Math.log(maxZoom) * (reduced ? u : easeInOut(u)));
      const open = 0.5 + 0.5 * smooth(S.HANDOVER[0], S.DIVE[0] + 0.15, q);
      const g = seg(q, S.HANDOVER[0], S.DIVE[0] + 0.35);
      const gx = Math.sin(g * Math.PI * 1.6) * 30 * (1 - g);
      const gy = Math.sin(g * Math.PI + 0.4) * 8 * (1 - g);
      const darkA = smooth(S.DIVE[1] - 0.4, S.DIVE[1] - 0.05, q);
      const eyeKey = `${eyeAlpha.toFixed(3)}|${eyeX.toFixed(1)}|${eyeY.toFixed(1)}|${(fit * zoom).toFixed(4)}|${open.toFixed(3)}|${gx.toFixed(1)}|${darkA.toFixed(3)}`;
      if (eyeKey !== lastEye) {
        lastEye = eyeKey;
        el.style.opacity = eyeAlpha.toFixed(3);
        el.style.visibility = eyeAlpha > 0.001 ? "visible" : "hidden";
        st.style.transform = `translate(${(eyeX - W / 2).toFixed(1)}px, ${(eyeY - H / 2).toFixed(1)}px) scale(${(fit * zoom).toFixed(4)})`;
        pu.style.transform = `scale(${(1 + 0.3 * easeInOut(u)).toFixed(3)})`;
        const ctl = 160 * open;
        ld.style.clipPath = `path("M 20 200 C 160 ${200 - ctl} 640 ${200 - ctl} 780 200 C 640 ${200 + ctl} 160 ${200 + ctl} 20 200 Z")`;
        gz.style.transform = `translate(${gx.toFixed(1)}px, ${gy.toFixed(1)}px)`;
        dk.style.opacity = darkA.toFixed(3);
      }

      // ---- the portfolio ----
      const rin = smooth(S.RING_IN[0], S.RING_IN[1], q), rout = smooth(S.RING_OUT[0], S.RING_OUT[1], q);
      const ra = rin * (1 - rout);
      const rs = 0.6 + 0.4 * rin - 0.15 * rout;
      const blur = reduced ? 0 : (1 - rin) * 14 + rout * 12;
      const live = q >= S.RING_LIVE[0] && q <= S.RING_LIVE[1];
      const ringKey = `${ra.toFixed(3)}|${rs.toFixed(4)}|${blur.toFixed(1)}|${live}`;
      if (ringKey !== lastRing) {
        lastRing = ringKey;
        rg.style.opacity = ra.toFixed(3);
        rg.style.transform = `scale(${rs.toFixed(4)})`;
        rg.style.filter = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : "";
        rg.style.pointerEvents = live ? "auto" : "none";
        rg.style.visibility = ra > 0.001 ? "visible" : "hidden";
      }
    });
  }, []);

  return (
    <>
      <div ref={layer} className="fl-eyelayer" aria-hidden>
        <div ref={stage} className="fl-eye" style={{ width: W, height: H, transformOrigin: `${W / 2}px ${H / 2}px` }}>
          <div ref={lids} className="fl-eye__lids">
            <div className="fl-eye__white" />
            <div ref={gaze} className="fl-eye__gaze">
              <div className="fl-eye__iris" style={{ left: W / 2 - IRIS, top: H / 2 - IRIS, width: IRIS * 2, height: IRIS * 2 }} />
              <div ref={pupil} className="fl-eye__pupil" style={{ left: W / 2 - PUPIL, top: H / 2 - PUPIL, width: PUPIL * 2, height: PUPIL * 2 }} />
              <div className="fl-eye__glint" style={{ left: W / 2 - 40, top: H / 2 - 44, width: 26, height: 26 }} />
              <div className="fl-eye__glint fl-eye__glint--small" style={{ left: W / 2 + 18, top: H / 2 + 22, width: 12, height: 12 }} />
            </div>
          </div>
        </div>
        <div ref={dark} className="fl-eye__dark" />
      </div>
      <div ref={ring} className="fl-ringlayer">
        <WorkArchive embedded />
      </div>
    </>
  );
}

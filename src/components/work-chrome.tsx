"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/**
 * The archive's chrome: a header with the wordmark and a Menu button that
 * folds into a cross, the full-screen menu, the studio card bottom-left, the
 * colophon bottom-right, and a difference-blended cursor dot for fine
 * pointers. Shared state (menu open, grid open) lives in WorkArchive.
 */

export function WorkHeader({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <header className={`wk-chrome wk-header${open ? " open" : ""}`}>
      <Link href="/" className="wordmark" aria-label="Flittle, home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt="" width={2036} height={720} draggable={false} />
      </Link>
      <button
        type="button"
        className="menu-btn"
        aria-expanded={open}
        aria-controls="wk-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={onToggle}
      >
        <span className="menu-label" aria-hidden>Menu</span>
        <span className="bars" aria-hidden><i /><i /></span>
      </button>
    </header>
  );
}

export function WorkMenu({ open, onClose, onArchive }: { open: boolean; onClose: () => void; onArchive: () => void }) {
  const tab = open ? 0 : -1;
  return (
    <div id="wk-menu" className={`wk-menu${open ? " open" : ""}`} aria-hidden={!open}>
      <nav aria-label="Menu">
        <a
          href="#archive"
          tabIndex={tab}
          onClick={(e) => {
            e.preventDefault();
            onArchive();
            onClose();
          }}
        >
          The Archive
        </a>
        <Link href="/" tabIndex={tab} onClick={onClose}>Home</Link>
        <Link href="/#services" tabIndex={tab} onClick={onClose}>Services</Link>
        <Link href="/#contact" tabIndex={tab} onClick={onClose}>Contact</Link>
      </nav>
      <p className="addr">
        Flittle · Software development
        <br />
        hello@flittle.example (placeholder)
      </p>
    </div>
  );
}

export function WorkBio() {
  return (
    <aside className="wk-chrome wk-bio" aria-label="About Flittle">
      <div className="who">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="avatar" src="/cat.png" alt="" width={52} height={52} draggable={false} />
        <b>Flittle</b>
      </div>
      <p>
        Flittle is the tech team you don&rsquo;t have to hire: web apps, internal tools, websites and
        integrations, scoped and shipped by one small team for companies without their own developers.
      </p>
    </aside>
  );
}

export function WorkColophon() {
  return <div className="wk-chrome wk-colophon">Selected work 2026</div>;
}

/** A small dot that follows the pointer and opens up over anything clickable. Fine pointers only. */
export function WorkCursor() {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const el = dot.current;
    if (!el) return;
    document.documentElement.classList.add("has-cursor");
    let x = -100, y = -100, cx = -100, cy = -100, raf = 0;
    const loop = () => {
      cx += (x - cx) * 0.2;
      cy += (y - cy) * 0.2;
      el.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.style.opacity = "1";
      const hot = (e.target as Element | null)?.closest?.(".wk-card, a, button, .wk-rows figure");
      el.classList.toggle("wide", !!hot);
    };
    const leave = () => { el.style.opacity = "0"; };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return <div ref={dot} className="wk-dot" aria-hidden style={{ opacity: 0 }} />;
}

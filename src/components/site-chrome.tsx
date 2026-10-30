"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/#services", label: "Services" },
  { href: "/#work", label: "Work" },
  { href: "/#contact", label: "Contact" },
];

/**
 * Everything that sits on every page: the floating header, the full-screen
 * menu and the custom cursor dot. Kept in one client component so the menu
 * state and Escape handling live in one place.
 */
export function SiteChrome() {
  // The menu is open only for the route it was opened on, so navigating closes it without an effect.
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenFor((cur) => ((typeof v === "function" ? v(cur === pathname) : v) ? pathname : null));

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenFor(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // The archive brings its own header, menu and cursor (see work-chrome.tsx).
  if (pathname === "/work" || pathname.startsWith("/work/")) return null;

  return (
    <>
      <header className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-3">
        <div
          className={`pointer-events-auto flex items-center gap-1 rounded-2xl p-1 text-[13px] font-medium backdrop-blur-xl transition-colors duration-300 ${
            open ? "bg-white/10" : "bg-charcoal/90"
          } text-white/80`}
        >
          <Link
            href="/"
            aria-label="Flittle, home"
            className="flex h-10 items-center rounded-xl bg-[#fdfdfd] px-3.5"
          >
            <Logo height={20} />
          </Link>
          <nav className="hidden items-center gap-5 px-4 md:flex" aria-label="Main">
            {LINKS.slice(1).map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/#contact"
            className="ml-1 hidden h-10 items-center gap-1.5 rounded-xl bg-sun px-4 font-semibold text-charcoal transition-transform active:scale-[.97] hover:bg-[#f9e789] sm:inline-flex"
          >
            Start a project <ArrowUpRight className="size-3.5" strokeWidth={2} />
          </Link>
          <button
            type="button"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={() => setOpen((o) => !o)}
            className="relative ml-1 flex h-10 w-12 items-center justify-center rounded-xl bg-white/10 transition-colors hover:bg-white/20"
          >
            <span className="sr-only-text">{open ? "Close menu" : "Open menu"}</span>
            <span aria-hidden className="relative block h-3 w-5">
              <i
                className="absolute inset-x-0 top-0 h-px bg-current transition-transform duration-300"
                style={{ transform: open ? "translateY(6px) rotate(45deg)" : "none" }}
              />
              <i
                className="absolute inset-x-0 bottom-0 h-px bg-current transition-transform duration-300"
                style={{ transform: open ? "translateY(-5px) rotate(-45deg)" : "none" }}
              />
            </span>
          </button>
        </div>
      </header>

      <div
        id="site-menu"
        aria-hidden={!open}
        className="fixed inset-0 z-[80] grid place-items-center bg-charcoal text-paper transition-[clip-path] duration-700 ease-[cubic-bezier(.77,0,.175,1)]"
        style={{
          clipPath: open ? "inset(0)" : "inset(0 0 100% 0)",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <nav className="flex flex-col items-center gap-2" aria-label="Menu">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              tabIndex={open ? 0 : -1}
              onClick={() => setOpen(false)}
              className="text-[clamp(40px,9vw,92px)] font-black leading-[1.02] tracking-[-0.04em] opacity-50 transition-all duration-300 hover:tracking-[-0.02em] hover:opacity-100"
              style={{
                transform: open ? "none" : "translateY(24px)",
                transitionDelay: open ? `${250 + i * 60}ms` : "0ms",
              }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <p className="absolute inset-x-6 bottom-6 text-xs leading-relaxed text-white/45">
          Flittle · Software development
          <br />
          hello@flittle.example (placeholder)
        </p>
      </div>

      <CursorDot />
    </>
  );
}

/** A small difference-blended dot that grows over anything clickable. Fine pointers only. */
function CursorDot() {
  const dot = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    if (!fine.matches) return;
    const el = dot.current!;
    document.documentElement.classList.add("has-cursor");
    let x = -100, y = -100, cx = -100, cy = -100, raf = 0;

    const loop = () => {
      cx += (x - cx) * 0.25;
      cy += (y - cy) * 0.25;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      el.style.opacity = "1";
      const hot = (e.target as HTMLElement | null)?.closest?.("a, button, [data-cursor='wide']");
      el.dataset.wide = hot ? "1" : "0";
    };
    const leave = () => (el.style.opacity = "0");
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.classList.remove("has-cursor");
    };
  }, []);

  return (
    <div
      ref={dot}
      aria-hidden
      data-wide="0"
      className="pointer-events-none fixed left-0 top-0 z-[300] opacity-0 [&[data-wide='1']>i]:size-12 [&[data-wide='1']>i]:bg-white/20"
    >
      <i className="-ml-[5px] -mt-[5px] block size-2.5 rounded-full bg-white mix-blend-difference transition-all duration-300 [[data-wide='1']>&]:-ml-6 [[data-wide='1']>&]:-mt-6" />
    </div>
  );
}

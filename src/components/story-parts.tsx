"use client";

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/** Small building blocks for the scroll screens: staggered reveal, charts and counters. */

const cssVars = (v: Record<string, string | number>) => v as CSSProperties;

/** A block that fades, lifts and un-blurs once its reveal parent gets `.is-in`. */
export function Rv({
  as: Tag = "div",
  d = 0,
  className = "",
  children,
  ...rest
}: {
  as?: ElementType;
  d?: number;
  className?: string;
  children?: ReactNode;
  [k: string]: unknown;
}) {
  return (
    <Tag className={`fl-rv ${className}`} style={cssVars({ "--d": d })} {...rest}>
      {children}
    </Tag>
  );
}

/** Title that reveals word by word; the full sentence stays available to screen readers. */
export function SplitTitle({ main, sub, start = 60 }: { main: string; sub: string; start?: number }) {
  let i = 0;
  const words = (text: string) =>
    text.split(" ").map((w, idx) => (
      <span key={`${w}-${idx}`}>
        <span aria-hidden className="fl-rv fl-rv--word" style={cssVars({ "--d": start + i++ * 45 })}>
          {w}
        </span>{" "}
      </span>
    ));
  return (
    <h2 className="fl-title" aria-label={`${main} ${sub}`}>
      {words(main)}
      <span className="fl-sub">{words(sub)}</span>
    </h2>
  );
}

export type BarSet = { values: number[]; axis: string[]; now: number };

export function Bars({ set, d = 0 }: { set: BarSet; d?: number }) {
  // Bars grow in from zero whenever the data set changes: they count as grown only once two frames have passed.
  const [grownSet, setGrownSet] = useState<BarSet | null>(null);
  const grown = grownSet === set;
  useEffect(() => {
    let a = 0, b = 0;
    a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setGrownSet(set))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [set]);

  return (
    <div className="fl-bars fl-rv" style={cssVars({ "--d": d })}>
      <div className={`fl-bars__plot ${grown ? "is-grown" : ""}`} aria-hidden>
        {set.values.map((v, j) => (
          <i
            key={j}
            className={j === set.now ? "now" : j < set.now && v > 10 ? "on" : ""}
            style={cssVars({ "--h": v, "--j": j })}
          />
        ))}
      </div>
      <div className="fl-bars__axis">
        {set.axis.map((a, i) => (
          <span key={a} className={i === set.axis.length - 1 && a === "Now" ? "is-now" : ""}>
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A panel with a segmented control that swaps the bar data (Kin-style Day / Week / Month). */
export function RangePanel({
  title,
  sets,
  initial,
  note,
}: {
  title: string;
  sets: Record<string, BarSet>;
  initial: string;
  note: ReactNode;
}) {
  const [range, setRange] = useState(initial);
  return (
    <article className="fl-panel fl-rv fl-rv--panel" data-reveal>
      <Rv className="fl-panel__head" d={160}>
        <h3 className="fl-panel__title">{title}</h3>
        <div className="fl-seg" role="tablist" aria-label="Range">
          {Object.keys(sets).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={k === range}
              className={k === range ? "is-on" : ""}
              onClick={() => setRange(k)}
            >
              {k}
            </button>
          ))}
        </div>
      </Rv>
      <Bars set={sets[range]} d={250} />
      <Rv as="p" className="fl-panel__note" d={340}>
        {note}
      </Rv>
    </article>
  );
}

export function Ticks({ count, on, d = 0 }: { count: number; on: number; d?: number }) {
  return (
    <div className="fl-ticks fl-rv" aria-hidden style={cssVars({ "--d": d })}>
      {Array.from({ length: count }, (_, j) => (
        <i key={j} className={j < on ? "on" : "now"} style={cssVars({ "--j": j })} />
      ))}
    </div>
  );
}

/** Counts up from zero every time it scrolls into view. */
export function Counter({ to, format }: { to: number; format?: "hm" }) {
  const ref = useRef<HTMLSpanElement>(null);
  const fmt = (v: number) =>
    format === "hm" ? `${Math.floor(v / 60)} h ${Math.round(v % 60)} m` : Math.round(v).toLocaleString("en-US");
  const [text, setText] = useState(fmt(to));

  useEffect(() => {
    const el = ref.current!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0, timer = 0;
    const run = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
      if (reduced) return setText(fmt(to));
      setText(fmt(0));
      timer = window.setTimeout(() => {
        const t0 = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - t0) / 1400);
          setText(fmt(to * (t >= 1 ? 1 : 1 - 2 ** (-10 * t))));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }, 250);
    };
    const io = new IntersectionObserver(([e]) => e.isIntersecting && run(), { rootMargin: "-12% 0px -20% 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, format]);

  return <span ref={ref}>{text}</span>;
}

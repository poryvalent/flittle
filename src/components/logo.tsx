import type { CSSProperties } from "react";

/**
 * The Flittle logo is one raster (1526 x 763) with generous white margins.
 * These boxes crop it to the wordmark or to just the cat character, scaled
 * from a single height so it stays crisp-edged at any size.
 */
const SRC = { w: 1526, h: 763 };
const CROPS = {
  wordmark: { x: 268, y: 203, w: 1006, h: 348 },
  cat: { x: 626, y: 208, w: 316, h: 340 },
} as const;

export function Logo({
  height = 28,
  crop = "wordmark",
  className = "",
  style,
}: {
  height?: number;
  crop?: keyof typeof CROPS;
  className?: string;
  style?: CSSProperties;
}) {
  const c = CROPS[crop];
  const k = height / c.h;
  return (
    <span
      role="img"
      aria-label="Flittle"
      className={`relative inline-block shrink-0 overflow-hidden ${className}`}
      style={{ width: c.w * k, height, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute max-w-none select-none"
        style={{
          width: SRC.w * k,
          height: SRC.h * k,
          left: -c.x * k,
          top: -c.y * k,
        }}
      />
    </span>
  );
}

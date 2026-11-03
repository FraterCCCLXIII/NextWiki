import { cn } from "~/lib/utils";

/**
 * The Kosmographica mark: a tiny RGB pixel screen. An 8x8 grid of pixels in 16 rainbow hues, assigned along a
 * Hilbert curve. The full rainbow repeats every 16 steps along the curve, so each 4x4 quarter of the screen holds the
 * whole spectrum folded the same way: a self-similar, fractal mosaic.
 * Pure SVG, 24x24 by default.
 */
const ORDER = 3;
const SIDE = 1 << ORDER; // 8 pixels per side
const HUES = 16;

/** Standard Hilbert curve: index d along the curve -> (x, y) on an n x n grid. */
function hilbert(n: number, d: number): [number, number] {
  let x = 0;
  let y = 0;
  let t = d;
  for (let s = 1; s < n; s *= 2) {
    const rx = 1 & (t >> 1);
    const ry = 1 & (t ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = s - 1 - x;
        y = s - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += s * rx;
    y += s * ry;
    t >>= 2;
  }
  return [x, y];
}

const PIXELS = Array.from({ length: SIDE * SIDE }, (_, d) => {
  const [x, y] = hilbert(SIDE, d);
  const hue = (d % HUES) * (360 / HUES); // the whole rainbow repeats every 16 steps, once in each 4x4 quarter
  return { x, y, color: `hsl(${hue} 100% 56%)` };
});

const GRID = 22; // pixels of the 24 used by the screen, leaving a 1px bezel
const CELL = GRID / SIDE; // 2.75
const GAP = 0.5;

export function KosmoLogo({ size = 24, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      role="img"
      aria-label="Kosmographica"
      shapeRendering="crispEdges"
      className={cn("shrink-0", className)}
    >
      <rect x="0.5" y="0.5" width="23" height="23" rx="3.5" fill="#0d0d0d" stroke="#303133" />
      {PIXELS.map((p) => (
        <rect
          key={`${p.x}-${p.y}`}
          x={1 + p.x * CELL + GAP / 2}
          y={1 + p.y * CELL + GAP / 2}
          width={CELL - GAP}
          height={CELL - GAP}
          fill={p.color}
        />
      ))}
    </svg>
  );
}

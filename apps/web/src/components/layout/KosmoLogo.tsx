import { cn } from "~/lib/utils";

/**
 * The Kosmographica mark: a tiny RGB pixel screen. An 8x8 grid of pixels in 16 rainbow hues, assigned along a
 * Hilbert curve. The full rainbow repeats every 16 steps along the curve, so each 4x4 quarter of the screen holds the
 * whole spectrum folded the same way: a self-similar, fractal mosaic.
 * Pure SVG, 24x24 by default; the pixels run edge to edge inside a rounded square. The colours animate: each pixel
 * cycles the rainbow, offset by its place on the curve (see .kosmo-pixel). Two 1px black eyes sit on top and blink
 * (.kosmo-eye). Both animations stop for users who prefer reduced motion.
 */
const ORDER = 3;
const SIDE = 1 << ORDER; // 8 pixels per side
const HUES = 16;
const CYCLE_SECONDS = 12; // keep in step with .kosmo-pixel in the ui package's globals.css

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
  return { x, y, d, color: `hsl(${hue} 100% 56%)` };
});

const CELL = 24 / SIDE; // 3px per pixel, edge to edge: no gaps, no bezel

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
      <clipPath id="kosmo-logo-clip">
        <rect width="24" height="24" rx="4.5" />
      </clipPath>
      <g clipPath="url(#kosmo-logo-clip)">
        {PIXELS.map((p) => (
          // a hair of overlap stops anti-aliasing seams between neighbouring pixels
          <rect
            key={`${p.x}-${p.y}`}
            className="kosmo-pixel"
            style={{ animationDelay: `${-(p.d % HUES) * (CYCLE_SECONDS / HUES)}s` }}
            x={p.x * CELL}
            y={p.y * CELL}
            width={CELL + 0.03}
            height={CELL + 0.03}
            fill={p.color}
          />
        ))}
      </g>
      {/* eyes: 1px black lines, 5px tall, mirrored about the centre of the 24px grid */}
      <rect className="kosmo-eye" x="8" y="9" width="1" height="5" fill="#000" />
      <rect className="kosmo-eye" x="15" y="9" width="1" height="5" fill="#000" />
    </svg>
  );
}

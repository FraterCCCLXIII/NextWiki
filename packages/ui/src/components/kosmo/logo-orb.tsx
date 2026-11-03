import * as React from "react";

import { cn } from "../../utils";

export interface LogoOrbProps {
  size?: number;
  className?: string;
}

/**
 * The Kosmographica orb mark: a lit sphere with a turning sheen,
 * a cool bounce from below and a breathing halo. Replicates .logo-orb
 * from kosmographica.css. Motion is disabled by the reduced-motion
 * rule in the global stylesheet (see motion-reduce classes below).
 */
export function LogoOrb({ size = 24, className }: LogoOrbProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-block flex-none overflow-hidden rounded-full animate-orb-halo motion-reduce:animate-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(circle at 36% 30%, rgba(255,255,255,.95) 0%, rgba(255,255,255,.55) 9%, transparent 26%), " +
          "radial-gradient(circle at 38% 34%, #eafcf5 0%, #bfeede 16%, #7fceb8 36%, #3f7d70 60%, #1d3630 82%, #0f1c19 100%)",
      }}
    >
      <span
        className="pointer-events-none absolute animate-orb-spin mix-blend-screen opacity-75 motion-reduce:animate-none"
        style={{
          inset: "-45%",
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(255,255,255,.85) 26deg, rgba(255,255,255,.25) 60deg, transparent 110deg, transparent 230deg, rgba(180,255,235,.35) 296deg, transparent 330deg)",
        }}
      />
      <span
        className="pointer-events-none absolute inset-0 rounded-full animate-orb-bounce opacity-60 motion-reduce:animate-none"
        style={{
          background: "radial-gradient(circle at 50% 116%, rgba(126,244,208,.65), transparent 64%)",
        }}
      />
    </span>
  );
}

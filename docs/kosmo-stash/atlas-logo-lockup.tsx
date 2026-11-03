/**
 * Stashed: the Kosmographica logo lockup that used to head the left Atlas nav
 * (lit orb, "KOSMOGRAPHICA" wordmark, "a map of everything, to scale" strapline).
 *
 * Not imported anywhere. To bring it back, copy it into apps/web/src/components/kosmo/
 * and render <AtlasLogoLockup /> at the top of AtlasNav (above the groups), or in a
 * page header. LogoOrb lives in packages/ui (components/kosmo/logo-orb.tsx).
 */
import Link from "next/link";
import { LogoOrb } from "@repo/ui";

export function AtlasLogoLockup({ href = "/kosmo" }: { href?: string }) {
  return (
    <Link href={href} className="mb-5 flex items-center gap-2 text-kosmo-text">
      <LogoOrb />
      <span className="flex flex-col leading-tight">
        <span className="text-xs font-semibold tracking-[0.22em] uppercase">Kosmographica</span>
        <span className="text-[10px] text-kosmo-dim">a map of everything, to scale</span>
      </span>
    </Link>
  );
}

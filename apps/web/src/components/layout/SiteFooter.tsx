import Link from "next/link";
import { getSettingValue } from "~/lib/utils/settings";
import { NextWikiLogo } from "./NextWikiLogo";

/** Slim footer under every page: the NextWiki mark and "Powered by NextWiki2", linking to the About page. */
export async function SiteFooter() {
  const siteLogo = await getSettingValue("site.logo");

  return (
    <footer className="flex shrink-0 flex-wrap items-center justify-center gap-x-6 gap-y-2 py-2">
      <div className="flex items-center gap-5 opacity-60 transition-opacity hover:opacity-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/kosmos-logo.svg" alt="Kosmos" className="h-3.5 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/kosmos-logo-white.svg" alt="" aria-hidden="true" className="hidden h-3.5 w-auto dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/artek-logo.svg" alt="Artek" className="h-4 w-auto dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/artek-logo-white.svg" alt="" aria-hidden="true" className="hidden h-4 w-auto dark:block" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/nasa-worm-black.svg" alt="NASA" className="h-3 w-auto rotate-180 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/images/nasa-worm-white.svg" alt="" aria-hidden="true" className="hidden h-3 w-auto rotate-180 dark:block" />
      </div>
      <Link
        href="/about"
        className="flex items-center gap-2 text-xs text-text-tertiary transition-colors hover:text-text-primary"
      >
        <NextWikiLogo src={siteLogo} className="h-4 w-4" />
        <span>Powered by NextWiki2</span>
      </Link>
    </footer>
  );
}

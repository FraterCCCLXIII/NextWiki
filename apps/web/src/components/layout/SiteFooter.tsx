import Link from "next/link";
import { getSettingValue } from "~/lib/utils/settings";
import { NextWikiLogo } from "./NextWikiLogo";

/** Slim footer under every page: the NextWiki mark and "Powered by NextWiki2", linking to the About page. */
export async function SiteFooter() {
  const siteLogo = await getSettingValue("site.logo");

  return (
    <footer className="flex h-9 shrink-0 items-center justify-center">
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

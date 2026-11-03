import { cn } from "~/lib/utils";

/**
 * The NextWiki mark: the site's configured logo in the light theme, the white version in the dark theme.
 * Falls back to the bundled logo when no `site.logo` setting exists.
 */
export function NextWikiLogo({ src, className }: { src?: string | null; className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src || "/assets/images/logo.svg"}
        alt="NextWiki"
        className={cn("object-contain dark:hidden", className)}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/images/logo-white.svg"
        alt=""
        aria-hidden="true"
        className={cn("hidden object-contain dark:block", className)}
      />
    </>
  );
}

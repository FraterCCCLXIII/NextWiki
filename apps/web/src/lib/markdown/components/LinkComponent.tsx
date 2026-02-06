import { cn } from "~/lib/utils";
import type { Components } from "react-markdown";
import React from "react";
import Link from "next/link";

const DEFAULT_INTERNAL_HOSTS = new Set(["example.com"]);

const normalizeHref = (href: string) => {
  if (!href) return href;

  try {
    const url = new URL(href, "https://placeholder.local");
    const host = url.host.toLowerCase();
    const isAbsolute = href.startsWith("http://") || href.startsWith("https://");

    if (isAbsolute && DEFAULT_INTERNAL_HOSTS.has(host)) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // Ignore invalid URLs and keep original href.
  }

  return href;
};

export const linkComponent: Components["a"] = ({
  node,
  className,
  children,
  ...props
}) => {
  void node;

  const { href: rawHref, ...rest } = props;
  const href = normalizeHref(rawHref ?? "");
  const isInternal =
    href.startsWith("/") || href.startsWith("#") || href.startsWith("?");
  const isExternal =
    !isInternal &&
    (href.includes("://") || href.startsWith("//") || href.startsWith("www."));
  const resolvedClassName = cn(
    className,
    isInternal && "internal-link",
    isExternal && "external-link"
  );

  if (!href) {
    return <span className={resolvedClassName}>{children}</span>;
  }

  if (isInternal) {
    return (
      <Link href={href} className={resolvedClassName} {...rest}>
        {children}
      </Link>
    );
  }

  const shouldOpenNewTab =
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("//") ||
    href.startsWith("www.");

  return (
    <a
      href={href}
      className={resolvedClassName}
      {...rest}
      target={shouldOpenNewTab ? "_blank" : undefined}
      rel={shouldOpenNewTab ? "noreferrer noopener" : undefined}
    >
      {children}
    </a>
  );
};

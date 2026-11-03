"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const KEY = "kosmoNavHidden";

/** Shows / hides the left Atlas nav (a slide-away); remembered between visits. Only on the Kosmographica pages, where the rail exists. */
export function KosmoNavToggle() {
  const pathname = usePathname() ?? "";
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let h = false;
    try {
      h = localStorage.getItem(KEY) === "1";
    } catch {
      /* storage blocked */
    }
    setHidden(h);
    document.documentElement.classList.toggle("kosmo-nav-hidden", h);
  }, []);

  if (!pathname.startsWith("/kosmo")) return null;

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    document.documentElement.classList.toggle("kosmo-nav-hidden", next);
    try {
      localStorage.setItem(KEY, next ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  };

  const Icon = hidden ? PanelLeftOpen : PanelLeftClose;
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? "Show the left navigation" : "Hide the left navigation"}
      title={hidden ? "Show the left navigation" : "Hide the left navigation"}
      className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary transition-colors hover:bg-background-level1 hover:text-text-primary"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

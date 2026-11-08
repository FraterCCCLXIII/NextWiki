"use client";

import { useEffect, useRef } from "react";
import { cn } from "@repo/ui";

type CrtSetting = boolean | { blur?: number; bloom?: number; blurCurve?: number; bloomCurve?: number; bloomSize?: number };
type LoaderInstance = { id: string | null; setCrt(on?: CrtSetting): void; destroy(): void };
type LoaderRuntime = {
  mount(
    el: HTMLElement,
    opts: {
      id?: string;
      tone?: "auto" | "dark" | "light";
      crt?: CrtSetting;
      sound?: boolean;
      soundButton?: boolean;
      delay?: number;
      starfield?: boolean;
      matchBg?: boolean;
      backdropEl?: HTMLElement | null;
    }
  ): LoaderInstance;
  setCrt(on: boolean): void;
  getCrt(): boolean;
  setSound(on: boolean): void;
  getSound(): boolean;
};

declare global {
  interface Window {
    KosmoLogoLoader?: LoaderRuntime;
  }
}

let runtime: Promise<LoaderRuntime> | null = null;

function loadRuntime(): Promise<LoaderRuntime> {
  runtime ??= new Promise((resolve, reject) => {
    if (window.KosmoLogoLoader) return resolve(window.KosmoLogoLoader);
    const s = document.createElement("script");
    s.src = "/logo-loader/logo-loader.js";
    s.async = true;
    s.onload = () => (window.KosmoLogoLoader ? resolve(window.KosmoLogoLoader) : reject(new Error("logo loader missing")));
    s.onerror = () => {
      runtime = null;
      reject(new Error("logo loader failed to load"));
    };
    document.head.appendChild(s);
  });
  return runtime;
}

/** Turns the CRT glow on or off for every loader that has no `crt` prop, and remembers the choice in this browser. */
export function setLogoLoaderCrt(on: boolean) {
  void loadRuntime().then((r) => r.setCrt(on));
}

/** Turns the jingles on or off for every loader that has no `sound` prop, and remembers the choice in this browser. */
export function setLogoLoaderSound(on: boolean) {
  void loadRuntime().then((r) => r.setSound(on));
}

/** Deep space navy, the loader's default background. */
export const LOGO_LOADER_NAVY = "#0a1a40";

export type LogoLoaderProps = {
  /** Pin one logo (e.g. "49"). By default each loading screen plays one random logo, and all get a turn before any repeat. */
  logoId?: string;
  /** Black parts turn white on dark backgrounds. "auto" reads the background behind the loader. */
  tone?: "auto" | "dark" | "light";
  /** Slight blur and bloom, together or as separate levels ({ blur: 1, bloom: 0 }). Leave unset to follow the saved setting (on by default). */
  crt?: CrtSetting;
  /** Play the logo's jingle. Leave unset to follow the saved setting (on by default). Browsers stay silent until the visitor has interacted with the page. */
  sound?: boolean;
  /** Show the small speaker button that switches sound on and off. */
  soundButton?: boolean;
  /** Background colour until the logo loads, and for good if `matchBackground` is off. Pass "transparent" to sit on whatever is behind the loader. */
  background?: string;
  /** Use a dark background chosen to complement each logo's own colours. */
  matchBackground?: boolean;
  /** Fly stars behind the logo. */
  starfield?: boolean;
  /** Cover the nearest positioned parent. Otherwise it centres itself in a block at least half the screen tall. */
  fill?: boolean;
  /** Wait before showing, so fast loads don't flash a logo. */
  delayMs?: number;
  label?: string;
  className?: string;
};

export function LogoLoader({
  logoId,
  tone = "auto",
  crt,
  sound,
  soundButton = true,
  background = LOGO_LOADER_NAVY,
  matchBackground = true,
  starfield = false,
  fill = false,
  delayMs = 150,
  label = "Loading",
  className,
}: LogoLoaderProps) {
  const box = useRef<HTMLDivElement>(null);
  const instance = useRef<LoaderInstance | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadRuntime()
      .then((r) => {
        if (cancelled || !box.current) return;
        instance.current = r.mount(box.current, {
          id: logoId,
          tone,
          crt: crtRef.current,
          sound,
          soundButton,
          delay: delayMs,
          starfield,
          matchBg: matchBackground,
          backdropEl: box.current.parentElement,
        });
      })
      .catch(() => {
        /* the loader is decoration: the status text below still reports loading */
      });
    return () => {
      cancelled = true;
      instance.current?.destroy();
      instance.current = null;
    };
    // the logo stays the same for the life of this loading screen, so a crt change is applied below instead of remounting
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoId, tone, delayMs, starfield, matchBackground]);

  const crtRef = useRef(crt);
  crtRef.current = crt;
  useEffect(() => {
    instance.current?.setCrt(crt);
  }, [crt]);

  return (
    <div
      role="status"
      aria-label={label}
      style={{ background }}
      className={cn(
        "flex items-center justify-center",
        fill ? "absolute inset-0 z-10 overflow-hidden" : "relative min-h-[50vh] w-full overflow-hidden",
        className
      )}
    >
      <div ref={box} aria-hidden="true" style={{ width: "min(52%, 340px)", height: "min(34vh, 240px)" }} />
      <span className="sr-only">{label}</span>
    </div>
  );
}

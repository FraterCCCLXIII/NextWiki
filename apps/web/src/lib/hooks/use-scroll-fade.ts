import { useCallback, useRef } from "react";

/**
 * Top and bottom fade for a scrollable container: returns a callback ref and keeps the `fade-t` / `fade-b`
 * classes in step with the scroll position (the `.scroll-fade` CSS lives in the ui package's globals.css).
 * A callback ref, so it also works for elements that mount later, like the Oracle rail.
 */
export function useScrollFade<T extends HTMLElement>() {
  const dispose = useRef<(() => void) | null>(null);

  return useCallback((el: T | null) => {
    dispose.current?.();
    dispose.current = null;
    if (!el) return;

    const update = () => {
      const max = el.scrollHeight - el.clientHeight;
      el.classList.toggle("fade-t", el.scrollTop > 2);
      el.classList.toggle("fade-b", max > 2 && el.scrollTop < max - 2);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    Array.from(el.children).forEach((child) => ro.observe(child));

    dispose.current = () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
}

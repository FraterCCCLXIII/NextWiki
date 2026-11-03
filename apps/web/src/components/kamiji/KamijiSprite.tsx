"use client";

import { useEffect, useRef, useState } from "react";
import {
  BLOB_RGB,
  createBlobScene,
  drawBlobScene,
  drawEyes,
  hashOf,
  seededRandom,
  setBlobShape,
  setBlobVariant,
  stepBlobScene,
} from "~/lib/kamiji/flux-engine";
import { AI_STATUS_EVENT, AI_TOGGLE_EVENT } from "~/components/ai/constants";

type Mood = "idle" | "thinking" | "happy";

/**
 * Kamiji, bottom-right: a Flux-style Kamiji from the kamiji repo, the metaball orb with pill eyes (its Flux engine, copied to lib/kamiji), wired to the AI
 * assistant. Click it to open or close the chat. It drifts in aurora colours when idle, glows neon and gets jittery while a request runs, and
 * flashes rainbow with a bounce when a reply lands. Its eyes follow the pointer.
 */
export function KamijiSprite({ color = "#ffd23f", enabled = true }: { color?: string; enabled?: boolean }) {
  const [note, setNote] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sceneRef = useRef<any>(null);

  // the Flux orb: one blob scene, stepped and painted at ~15 fps (paused when the tab is hidden or the user prefers reduced motion)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const W = 320;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scene: any = createBlobScene(W, W, seededRandom(hashOf("kamiji")));
    setBlobVariant(scene, "aurora");
    setBlobShape(scene, "blob");
    for (let i = 0; i < 40; i += 1) stepBlobScene(scene, 0.1);
    sceneRef.current = scene;
    const big = document.createElement("canvas");
    big.width = W;
    big.height = W;
    const bctx = big.getContext("2d")!;
    const off = document.createElement("canvas");
    const size = canvas.width;
    const paint = () => {
      drawBlobScene(bctx, off, scene, "smooth", BLOB_RGB, 5);
      drawEyes(bctx, scene, scene.variant.eye);
      const side = scene.base * 6.8;
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(big, scene.fx - side / 2, scene.fy - side / 2, side, side, 0, 0, size, size);
    };
    paint();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setInterval(() => {
      if (document.hidden || reduced) return;
      stepBlobScene(scene, 0.066);
      paint();
    }, 66);
    // the eyes look at the pointer
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      scene.eyes.pointer = { x: scene.fx + ((e.clientX - (r.left + r.width / 2)) / r.width) * scene.base * 6.8, y: scene.fy + ((e.clientY - (r.top + r.height / 2)) / r.height) * scene.base * 6.8, at: scene.t };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  // mood -> look
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    setBlobVariant(scene, mood === "thinking" ? "fizz" : mood === "happy" ? "rainbow" : "aurora");
    scene.bump = Math.min(0.4, scene.bump + 0.25);
  }, [mood]);

  useEffect(() => {
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent<{ working?: boolean; replied?: boolean; open?: boolean }>).detail ?? {};
      if (typeof d.open === "boolean") setOpen(d.open);
      if (d.working === true) setMood("thinking");
      else if (d.working === false) setMood((m) => (m === "thinking" ? "idle" : m));
      if (d.replied) {
        setMood("happy");
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setMood("idle"), 3500);
      }
    };
    window.addEventListener(AI_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(AI_STATUS_EVENT, onStatus);
      window.clearTimeout(timer.current);
    };
  }, []);

  const smiling = mood === "happy" || hover;
  return (
    <div
      className={`kamiji-sprite fixed bottom-1 z-[60] select-none transition-[right] duration-300 ${open ? "right-[392px]" : "right-3"}`}
      data-mood={mood}
    >
      {note && (
        <div role="status" className="absolute bottom-full right-0 mb-1 w-64 rounded-lg border border-border-default bg-background-paper px-3 py-2 text-xs text-text-primary shadow-lg">
          Kamiji is asleep: the AI assistant is switched off. An admin can turn it on under Settings → AI (it needs an API key).
        </div>
      )}
      {hover && !open && !note && (
        <div className="pointer-events-none absolute bottom-full right-0 mb-1 whitespace-nowrap rounded-lg border border-border-default bg-background-paper px-2.5 py-1 text-xs text-text-primary shadow-lg">
          Ask Kamiji
        </div>
      )}
      <button
        type="button"
        aria-label={open ? "Close the AI assistant" : "Ask Kamiji (open the AI assistant)"}
        onClick={() => {
          if (!enabled) {
            // the assistant is switched off (Admin > Settings > AI: turn it on and add an API key); say so instead of doing nothing
            setNote(true);
            window.setTimeout(() => setNote(false), 6000);
            return;
          }
          window.dispatchEvent(new CustomEvent(AI_TOGGLE_EVENT));
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        className="kamiji-sprite__btn block h-[52px] w-[52px] cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <canvas ref={canvasRef} width={104} height={104} className="kamiji-sprite__hand h-[52px] w-[52px]" aria-hidden="true" />
      </button>
    </div>
  );
}

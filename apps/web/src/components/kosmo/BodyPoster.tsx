"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

/* Live 3D bodies in the poster tiles. One shared WebGL renderer draws each visible tile's model into that tile's own 2D canvas, so a whole row of
   spinning worlds costs one GL context. three.js and kosmo-models.js are the atlas's own static files, loaded in the browser (not bundled). */

export interface BodySpec {
  name: string;
  /** shown on the tile */
  label: string;
  blurb: string;
  tag: string;
  href: string;
  /** createModel spec: type, radius_m, mass_kg, temperature_K, notes ... */
  spec: Record<string, unknown>;
  /** camera distance (the model has unit radius) */
  dist?: number;
  /** backdrop glow colour behind the model */
  glow?: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Engine = { THREE: any; renderer: any; createModel: (THREE: any, spec: any) => any };
let enginePromise: Promise<Engine> | null = null;
const W = 512;
const H = 320;

function loadEngine(): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      // @ts-expect-error a browser-side URL import, not a bundled module
      const THREE: any = await import(/* webpackIgnore: true */ "https://unpkg.com/three@0.160.0/build/three.module.js");
      // @ts-expect-error the atlas's own static module
      const models: any = await import(/* webpackIgnore: true */ "/kosmo/static/kosmo-models.js");
      try {
        const idx = await fetch("/kosmo/static/textures/index.json").then((r) => (r.ok ? r.json() : null));
        if (idx) for (const [k, v] of Object.entries(idx)) models.textures.register(k, `/kosmo/static/${v as string}`);
      } catch {
        /* textures are optional: bodies fall back to procedural surfaces */
      }
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
      renderer.setSize(W, H, false);
      renderer.setPixelRatio(1);
      renderer.setClearColor(0x000000, 0);
      return { THREE, renderer, createModel: models.createModel };
    })();
  }
  return enginePromise;
}

interface Active {
  canvas: HTMLCanvasElement;
  spec: BodySpec;
  scene?: any;
  camera?: any;
  model?: any;
  building?: boolean;
  seed: number;
}
const active = new Set<Active>();
let loopId = 0;
let last = 0;

async function ensureBuilt(a: Active, eng: Engine) {
  if (a.model || a.building) return;
  a.building = true;
  const { THREE } = eng;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.05, 100);
  camera.position.set(0, 0.15, a.spec.dist ?? 3.1);
  camera.lookAt(0, 0, 0);
  const model = eng.createModel(THREE, { ...a.spec.spec, segments: 48 });
  scene.add(model);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  a.scene = scene;
  a.camera = camera;
  a.model = model;
}

function frame(now: number) {
  loopId = active.size ? requestAnimationFrame(frame) : 0;
  if (document.hidden || now - last < 33) return; // ~30 fps
  last = now;
  enginePromise?.then((eng) => {
    const t = now / 1000;
    for (const a of active) {
      void ensureBuilt(a, eng);
      if (!a.model) continue;
      const m = a.model;
      m.rotation.y = t * 0.25 + a.seed;
      m.userData.lightDir?.set(0.85, 0.3, 0.75).normalize();
      m.tick?.(t);
      m.update?.(a.camera, eng.renderer);
      eng.renderer.render(a.scene, a.camera);
      const ctx = a.canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(eng.renderer.domElement, 0, 0, W, H);
      }
    }
  });
}

function start(a: Active) {
  active.add(a);
  void loadEngine();
  if (!loopId) loopId = requestAnimationFrame(frame);
}
function stop(a: Active) {
  active.delete(a);
}

export function BodyPoster({ b, index }: { b: BodySpec; index: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // no motion: the tile keeps its glow
    const a: Active = { canvas, spec: b, seed: (index * 1.7) % 6.28 };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) (e.isIntersecting ? start : stop)(a);
      },
      { rootMargin: "120px" }
    );
    io.observe(canvas);
    return () => {
      io.disconnect();
      stop(a);
    };
  }, [b, index]);

  return (
    <li className="w-[min(78vw,22rem)] shrink-0 snap-start transition-opacity duration-300">
      <Link
        href={b.href}
        className="group relative block aspect-[16/10] overflow-hidden rounded-xl bg-black outline-none transition-all duration-300 ease-out hover:z-20 hover:scale-[1.08] hover:shadow-[0_18px_60px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,255,255,0.18)] focus-visible:scale-[1.08] focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{ background: `radial-gradient(70% 90% at 50% 45%, ${b.glow ?? "rgba(120,150,255,0.28)"}, rgba(0,0,0,0) 70%), radial-gradient(1.2px 1.2px at 20% 30%, #fff8, transparent), radial-gradient(1px 1px at 75% 65%, #fff6, transparent), radial-gradient(1px 1px at 40% 80%, #fff5, transparent), #050608` }}
        />
        <canvas ref={canvasRef} width={W} height={H} aria-hidden="true" className="absolute inset-0 h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-110" />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent" />
        <span className="absolute left-4 top-3 text-[11px] font-medium uppercase tracking-[0.28em] text-white/60">{b.tag}</span>
        <div className="absolute inset-x-0 bottom-0 p-4">
          <span className="block text-3xl font-bold leading-none tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">{b.label}</span>
          <span className="mt-2 block max-h-0 translate-y-2 text-sm leading-snug text-white/80 opacity-0 transition-all duration-300 group-hover:max-h-16 group-hover:translate-y-0 group-hover:opacity-100">{b.blurb}</span>
        </div>
      </Link>
    </li>
  );
}

export function BodyRow({ title, items }: { title: string; items: BodySpec[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-2xl font-semibold tracking-tight text-kosmo-text">{title}</h2>
      <ul className="kosmo-scroll m-0 flex list-none snap-x gap-4 overflow-x-auto overflow-y-visible px-1 pb-8 pt-3 [&:hover_li:not(:hover)]:opacity-50">
        {items.map((b, i) => (
          <BodyPoster key={b.name} b={b} index={i} />
        ))}
      </ul>
    </section>
  );
}

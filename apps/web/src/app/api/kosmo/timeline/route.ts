import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@repo/logger";
import { timelineExtent, queryTimelineWindow, timelineAround, timelineDatasets } from "~/lib/kosmo/timeline-queries";

export const dynamic = "force-dynamic";

const num = (v: string | null, d: number) => {
  const n = v == null ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : d;
};

/**
 * GET /api/kosmo/timeline?from=-3600&to=2030&limit=4000&datasets=a,b&q=text
 * Items overlapping the window, thinned by significance to `limit`, plus the relations among them.
 * `?meta=1` returns the dataset list only.
 */
export async function GET(request: NextRequest) {
  try {
    const p = request.nextUrl.searchParams;
    if (p.get("meta")) return NextResponse.json({ datasets: await timelineDatasets() }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    const around = p.get("around");
    if (around) {
      const r = await timelineAround(around);
      return r ? NextResponse.json(r, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }) : NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const datasets = p.has("datasets") ? p.get("datasets")!.split(",").filter(Boolean) : undefined;
    const q = p.get("q")?.trim().slice(0, 80) || undefined;
    if (p.get("extent")) return NextResponse.json({ extent: await timelineExtent(datasets, q) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
    const from = num(p.get("from"), -3600);
    const to = num(p.get("to"), 2100);
    if (!(to > from)) return NextResponse.json({ error: "to must exceed from" }, { status: 400 });
    const limit = Math.min(Math.max(Math.round(num(p.get("limit"), 3000)), 50), 8000);
    const win = await queryTimelineWindow({ from, to, limit, datasets, q });
    return NextResponse.json(win, { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } });
  } catch (error) {
    logger.error("timeline window query failed", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

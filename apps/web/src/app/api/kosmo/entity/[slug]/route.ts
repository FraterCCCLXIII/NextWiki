import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@repo/logger";
import {
  getBacklinks,
  getChildren,
  getClaims,
  getEntityBySlug,
} from "~/lib/kosmo/queries";

export const dynamic = "force-dynamic";

const KINDS = ["infobox", "children", "links"] as const;
type Kind = (typeof KINDS)[number];

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

/**
 * Public read endpoint for `{{kosmo:<kind>:<slug>}}` wiki blocks.
 * `?kind=` limits the payload to what that block needs; omitted returns everything.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const kindParam = request.nextUrl.searchParams.get("kind");
    if (kindParam !== null && !(KINDS as readonly string[]).includes(kindParam)) {
      return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
    }
    const kind = kindParam as Kind | null;

    const entity = await getEntityBySlug(slug);
    if (!entity) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const wantClaims = !kind || kind === "infobox" || kind === "links";
    const wantChildren = !kind || kind === "children";
    const wantBacklinks = !kind || kind === "links";

    const [claims, children, backlinks] = await Promise.all([
      wantClaims ? getClaims(entity.id) : null,
      wantChildren ? getChildren(entity.id) : null,
      wantBacklinks ? getBacklinks(entity.id) : null,
    ]);

    const body: Record<string, unknown> = { entity };
    if (claims) body.claims = claims;
    if (children) body.children = children;
    if (backlinks) body.backlinks = backlinks;

    return NextResponse.json(body, { headers: { "Cache-Control": CACHE_CONTROL } });
  } catch (error) {
    logger.error("[KOSMO_ENTITY_API_ERROR]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

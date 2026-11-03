import { readFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@repo/logger";
import {
  catalogObjectsJson,
  datasetFile,
  historyModule,
  universityTreeModule,
} from "~/lib/kosmo/legacy-data";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";
const SAFE_KEY = /^[a-z0-9_\-./]+$/i;
const STATIC_ROOT = path.join(process.cwd(), "public", "kosmo", "static");

const JSON_TYPE = "application/json; charset=utf-8";
const JS_TYPE = "text/javascript; charset=utf-8";

async function fromDatabase(
  key: string
): Promise<{ body: string; contentType: string } | null> {
  switch (key) {
    case "catalog/objects.json": {
      const body = await catalogObjectsJson();
      return body ? { body, contentType: JSON_TYPE } : null;
    }
    case "university-tree.js": {
      const body = await universityTreeModule();
      return body ? { body, contentType: JS_TYPE } : null;
    }
    case "history-taxonomy.js": {
      const body = await historyModule();
      return body ? { body, contentType: JS_TYPE } : null;
    }
    default:
      return datasetFile(key);
  }
}

/**
 * Serves the data files the original HTML pages load, from the database, at the
 * paths they already use (next.config rewrites /kosmo/static/<file> here).
 * Falls back to the file copy in public/ if the database has nothing for the key.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string[] }> }
) {
  const key = (await params).file.join("/");
  if (!SAFE_KEY.test(key) || key.includes("..")) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 });
  }

  try {
    const result = await fromDatabase(key);
    if (result) {
      return new NextResponse(result.body, {
        headers: {
          "Content-Type": result.contentType,
          "Cache-Control": CACHE_CONTROL,
          "X-Kosmo-Source": "db",
        },
      });
    }
  } catch (error) {
    logger.error("kosmo data endpoint failed, using file copy", { key, error });
  }

  try {
    const body = await readFile(path.join(STATIC_ROOT, key), "utf8");
    return new NextResponse(body, {
      headers: {
        "Content-Type": key.endsWith(".json") ? JSON_TYPE : JS_TYPE,
        "X-Kosmo-Source": "file",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

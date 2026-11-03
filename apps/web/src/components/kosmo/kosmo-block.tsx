"use client";

import Link from "next/link";
import { Fragment, useEffect, useState, type ReactNode } from "react";

export type KosmoBlockKind = "infobox" | "children" | "links";

const KINDS: readonly KosmoBlockKind[] = ["infobox", "children", "links"];

type WikiRef = { slug: string; name: string; path: string | null };

export type KosmoEntity = {
  id: string;
  slug: string;
  kind: string;
  name: string;
  type: string | null;
  summary: string | null;
  pageId: string | null;
  path: string | null;
  data: Record<string, unknown>;
};
export type KosmoClaim = {
  predicate: string;
  valueText: string | null;
  valueNum: number | null;
  unit: string | null;
  note: string | null;
  object: WikiRef | null;
};
export type KosmoChild = { slug: string; name: string; kind: string; path: string | null };
export type KosmoBacklink = { predicate: string; subject: WikiRef };

export type KosmoEntityPayload = {
  entity: KosmoEntity;
  claims?: KosmoClaim[];
  children?: KosmoChild[];
  backlinks?: KosmoBacklink[];
};

const PREDICATE_LABELS: Record<string, string> = {
  part_of: "Part of",
  subfield_of: "Subfield of",
  orbits: "Orbits",
  prerequisite: "Prerequisites",
  prerequisites: "Prerequisites",
  taught_in: "Taught in",
};

function predicateLabel(predicate: string): string {
  if (PREDICATE_LABELS[predicate]) return PREDICATE_LABELS[predicate];
  const spaced = predicate.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function formatClaimValue(claim: KosmoClaim): string {
  if (claim.valueNum != null && Number.isFinite(Number(claim.valueNum))) {
    const n = Number(claim.valueNum).toLocaleString("en-US", { maximumSignificantDigits: 6 });
    return claim.unit ? `${n} ${claim.unit}` : n;
  }
  return claim.valueText ?? "";
}

/** Data fields may be plain values or `{ value, source }` objects. */
function formatDataField(raw: unknown): { value: string; source: string | null } {
  let source: string | null = null;
  let v: unknown = raw;
  if (v && typeof v === "object" && !Array.isArray(v) && "value" in v) {
    const o = v as { value: unknown; source?: unknown };
    v = o.value;
    if (typeof o.source === "string" && o.source) source = o.source;
  }
  if (v == null) return { value: "", source };
  if (Array.isArray(v)) return { value: v.map((x) => String(x)).join(", "), source };
  if (typeof v === "object") return { value: JSON.stringify(v), source };
  return { value: String(v), source };
}

function RefLink({ name, path }: { name: string; path: string | null }) {
  if (!path) return <span className="text-kosmo-text">{name}</span>;
  return (
    <Link
      href={path.startsWith("/") ? path : `/${path}`}
      className="text-kosmo-mint underline-offset-2 hover:underline"
    >
      {name}
    </Link>
  );
}

function Skeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading"
      className="my-6 animate-pulse space-y-2 rounded-md border border-kosmo-line bg-kosmo-panel p-4"
    >
      <div className="h-4 w-1/3 rounded bg-kosmo-line" />
      <div className="h-3 w-2/3 rounded bg-kosmo-line" />
      <div className="h-3 w-1/2 rounded bg-kosmo-line" />
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  return (
    <section className="my-6 rounded-md border border-kosmo-line bg-kosmo-panel p-4 text-sm text-kosmo-text">
      {children}
    </section>
  );
}

function Infobox({ data }: { data: KosmoEntityPayload }) {
  const { entity, claims = [] } = data;
  const dataRows = Object.entries(entity.data ?? {})
    .map(([key, raw]) => ({ key, ...formatDataField(raw) }))
    .filter((row) => row.value !== "");

  return (
    <Frame>
      <header className="mb-3 border-b border-kosmo-line pb-2">
        <div className="text-base font-semibold">{entity.name}</div>
        {entity.type && <div className="text-xs text-kosmo-dim">{entity.type}</div>}
        {entity.summary && <p className="mt-1 text-kosmo-dim">{entity.summary}</p>}
      </header>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
        {claims.map((claim, i) => (
          <Fragment key={`claim-${i}`}>
            <dt className="text-kosmo-dim">{predicateLabel(claim.predicate)}</dt>
            <dd>
              {claim.object ? (
                <RefLink name={claim.object.name} path={claim.object.path} />
              ) : (
                formatClaimValue(claim)
              )}
              {claim.note && <span className="ml-2 text-xs text-kosmo-dim">{claim.note}</span>}
            </dd>
          </Fragment>
        ))}
        {dataRows.map((row) => (
          <Fragment key={`data-${row.key}`}>
            <dt className="text-kosmo-dim">{predicateLabel(row.key)}</dt>
            <dd>
              {row.value}
              {row.source && (
                <span className="ml-2 text-xs text-kosmo-dim">
                  {/^https?:\/\//.test(row.source) ? (
                    <a href={row.source} target="_blank" rel="noreferrer noopener" className="underline-offset-2 hover:underline">
                      source
                    </a>
                  ) : (
                    row.source
                  )}
                </span>
              )}
            </dd>
          </Fragment>
        ))}
      </dl>
      {claims.length === 0 && dataRows.length === 0 && (
        <p className="text-kosmo-dim">No details recorded yet.</p>
      )}
    </Frame>
  );
}

function Children({ data }: { data: KosmoEntityPayload }) {
  const children = data.children ?? [];
  return (
    <Frame>
      <h4 className="mb-2 text-xs uppercase tracking-wide text-kosmo-dim">Contents</h4>
      {children.length === 0 ? (
        <p className="text-kosmo-dim">No entries yet.</p>
      ) : (
        <ul className="space-y-1">
          {children.map((child) => (
            <li key={child.slug} className="flex items-baseline gap-2">
              <RefLink name={child.name} path={child.path} />
              <span className="text-xs text-kosmo-dim">{child.kind}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

type LinkGroup = { key: string; title: string; items: WikiRef[] };

function groupLinks(data: KosmoEntityPayload): LinkGroup[] {
  const groups = new Map<string, LinkGroup>();
  const add = (key: string, title: string, ref: WikiRef) => {
    const group = groups.get(key) ?? { key, title, items: [] };
    group.items.push(ref);
    groups.set(key, group);
  };

  for (const claim of data.claims ?? []) {
    if (!claim.object) continue;
    add(`out:${claim.predicate}`, predicateLabel(claim.predicate), claim.object);
  }
  for (const link of data.backlinks ?? []) {
    add(`in:${link.predicate}`, `${predicateLabel(link.predicate)} (from)`, link.subject);
  }
  return [...groups.values()];
}

function Links({ data }: { data: KosmoEntityPayload }) {
  const groups = groupLinks(data);
  return (
    <Frame>
      {groups.length === 0 ? (
        <p className="text-kosmo-dim">No links yet.</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="mb-3 last:mb-0">
            <h4 className="mb-1 text-xs uppercase tracking-wide text-kosmo-dim">{group.title}</h4>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {group.items.map((item) => (
                <li key={item.slug}>
                  <RefLink name={item.name} path={item.path} />
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </Frame>
  );
}

type FetchState =
  | { status: "loading" }
  | { status: "ready"; data: KosmoEntityPayload }
  | { status: "missing" }
  | { status: "error" };

/**
 * Live `{{kosmo:<kind>:<slug>}}` block. Fetches the entity from the DB via
 * `/api/kosmo/entity/[slug]` so wiki prose can stay static while data stays fresh.
 */
export function KosmoBlock({ kind, slug }: { kind: KosmoBlockKind; slug: string }) {
  const [state, setState] = useState<FetchState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: "loading" });

    fetch(`/api/kosmo/entity/${encodeURIComponent(slug)}?kind=${kind}`, {
      signal: controller.signal,
      headers: { accept: "application/json" },
    })
      .then(async (res) => {
        if (res.status === 404) {
          setState({ status: "missing" });
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as KosmoEntityPayload;
        setState({ status: "ready", data });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: "error" });
      });

    return () => controller.abort();
  }, [kind, slug]);

  if (state.status === "loading") return <Skeleton />;
  if (state.status === "missing") {
    return <p className="my-4 text-sm text-kosmo-dim">Unknown entry: {slug}</p>;
  }
  if (state.status === "error") {
    return <p className="my-4 text-sm text-kosmo-dim">Could not load {slug}.</p>;
  }

  if (kind === "infobox") return <Infobox data={state.data} />;
  if (kind === "children") return <Children data={state.data} />;
  return <Links data={state.data} />;
}

/**
 * Adapter for the markdown component map. react-markdown passes the hast
 * properties (`kind`, `slug`) through as untyped props, so validate here.
 */
export function KosmoBlockMarkdown(props: { kind?: unknown; slug?: unknown }) {
  const kind = KINDS.find((k) => k === props.kind);
  const slug = typeof props.slug === "string" ? props.slug : "";
  if (!kind || !slug) return null;
  return <KosmoBlock kind={kind} slug={slug} />;
}

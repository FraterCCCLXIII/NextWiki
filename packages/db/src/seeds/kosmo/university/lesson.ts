/**
 * The lesson file format and its quality gate.
 *
 * A lesson is a Markdown file under `content/<stage>/…`. The id in the front matter ties it to
 * a node in the curriculum ledger (ids.json). A lesson in the tree with no file is a stub.
 *
 * ```md
 * ---
 * id: KU-L00123
 * status: drafted            # drafted | reviewed   (stub = no file)
 * kind: reading              # overview | reading | practice | video
 * minutes: 15
 * concepts: [gravity]        # concept slugs, see concepts.json
 * author: { name: claude-sonnet-5-5, kind: agent }
 * reviewer: { name: ..., kind: agent|human }   # required when status: reviewed
 * reviewedAt: 2026-11-05
 * original: true             # true when written from scratch, no source text copied
 * sources:                   # everything adapted or relied on
 *   - { name: Wikiversity, url: ..., license: CC-BY-SA-4.0, adapted: true }
 * checks:                    # 3 to 5 questions
 *   - { q: "Why does a ball fall?", a: "Gravity pulls it toward the ground.", options: [...] }
 * ---
 * ## Explanation
 * ## Worked example
 * ## Activity
 * ## Summary
 * ```
 *
 * Pure: no database, no filesystem. lint.ts walks the folder; import.ts writes the rows.
 */
import matter from "gray-matter";

export type LessonStatus = "stub" | "drafted" | "reviewed";
export const LESSON_KINDS = ["overview", "reading", "practice", "video"] as const;
export type LessonKind = (typeof LESSON_KINDS)[number];

export type Person = { name: string; kind: "agent" | "human" };
export type LessonSource = {
  name: string;
  url?: string;
  license: string;
  /** True when text or media from this source was copied or closely adapted. */
  adapted: boolean;
};
export type LessonCheck = { q: string; a: string; options?: string[] };

export type LessonSections = {
  explanation: string;
  workedExample: string;
  activity: string;
  summary: string;
};

export type LessonDoc = {
  id: string;
  status: Exclude<LessonStatus, "stub">;
  kind: LessonKind;
  minutes: number | null;
  concepts: string[];
  author: Person | null;
  reviewer: Person | null;
  reviewedAt: string | null;
  original: boolean;
  sources: LessonSource[];
  checks: LessonCheck[];
  sections: LessonSections;
  /** Licence the finished lesson is published under. */
  license: string;
};

export type Issue = { level: "error" | "warning"; message: string };

/** Licences whose text we may adapt on a possibly commercial site (research doc, Part 1c). */
export const ADAPTABLE_LICENSES = new Set([
  "CC0",
  "PD",
  "CC-BY-3.0",
  "CC-BY-4.0",
  "CC-BY-SA-3.0",
  "CC-BY-SA-4.0",
]);
const SHARE_ALIKE = /^CC-BY-SA/;

/** The licence our own lessons carry unless they adapt ShareAlike text. */
export const DEFAULT_LESSON_LICENSE = "CC-BY-4.0";

const SECTION_HEADINGS: [keyof LessonSections, RegExp][] = [
  ["explanation", /^explanation$/i],
  ["workedExample", /^worked example$/i],
  ["activity", /^activity$/i],
  ["summary", /^summary$/i],
];

/** Parses a lesson file. Never throws on content problems; returns them as issues. */
export function parseLesson(raw: string): { doc: LessonDoc | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });

  let parsed: matter.GrayMatterFile<string>;
  try {
    parsed = matter(raw);
  } catch (e) {
    err(`front matter is not valid YAML: ${(e as Error).message}`);
    return { doc: null, issues };
  }
  const fm = parsed.data as Record<string, unknown>;

  const id = typeof fm.id === "string" ? fm.id : "";
  if (!/^KU-L\d{5}$/.test(id)) err(`id must look like KU-L00123 (got ${JSON.stringify(fm.id)})`);

  const status = fm.status;
  if (status !== "drafted" && status !== "reviewed") {
    err(`status must be "drafted" or "reviewed" (a lesson with no file is the stub); got ${JSON.stringify(status)}`);
  }

  const kind = (LESSON_KINDS as readonly unknown[]).includes(fm.kind) ? (fm.kind as LessonKind) : null;
  if (!kind) err(`kind must be one of ${LESSON_KINDS.join(", ")}`);

  const person = (v: unknown, label: string): Person | null => {
    if (v == null) return null;
    const p = v as Partial<Person>;
    if (typeof p.name !== "string" || (p.kind !== "agent" && p.kind !== "human")) {
      err(`${label} must be { name, kind: agent|human }`);
      return null;
    }
    return { name: p.name, kind: p.kind };
  };

  const sources: LessonSource[] = [];
  if (fm.sources != null && !Array.isArray(fm.sources)) err("sources must be a list");
  for (const s of (Array.isArray(fm.sources) ? fm.sources : []) as Partial<LessonSource>[]) {
    if (typeof s?.name !== "string" || typeof s.license !== "string" || typeof s.adapted !== "boolean") {
      err("each source needs name, license and adapted (true/false)");
      continue;
    }
    sources.push({ name: s.name, url: s.url, license: s.license, adapted: s.adapted });
  }

  const checks: LessonCheck[] = [];
  if (fm.checks != null && !Array.isArray(fm.checks)) err("checks must be a list");
  for (const c of (Array.isArray(fm.checks) ? fm.checks : []) as Partial<LessonCheck>[]) {
    if (typeof c?.q !== "string" || typeof c.a !== "string") {
      err("each check needs q and a");
      continue;
    }
    checks.push({ q: c.q, a: c.a, options: Array.isArray(c.options) ? c.options.map(String) : undefined });
  }

  const sections = splitSections(parsed.content);
  const doc: LessonDoc = {
    id,
    status: status === "reviewed" ? "reviewed" : "drafted",
    kind: kind ?? "reading",
    minutes: typeof fm.minutes === "number" ? fm.minutes : null,
    concepts: Array.isArray(fm.concepts) ? fm.concepts.map(String) : [],
    author: person(fm.author, "author"),
    reviewer: person(fm.reviewer, "reviewer"),
    reviewedAt:
      fm.reviewedAt instanceof Date
        ? fm.reviewedAt.toISOString().slice(0, 10)
        : typeof fm.reviewedAt === "string"
          ? fm.reviewedAt
          : null,
    original: fm.original === true,
    sources,
    checks,
    sections,
    license: DEFAULT_LESSON_LICENSE,
  };
  if (sources.some((s) => s.adapted && SHARE_ALIKE.test(s.license))) doc.license = "CC-BY-SA-4.0";
  return { doc: issues.some((i) => i.level === "error") ? null : doc, issues };
}

function splitSections(body: string): LessonSections {
  const out: LessonSections = { explanation: "", workedExample: "", activity: "", summary: "" };
  let current: keyof LessonSections | null = null;
  const buf: Record<string, string[]> = {};
  for (const line of body.split("\n")) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      current = SECTION_HEADINGS.find(([, re]) => re.test(h[1]!))?.[0] ?? null;
      continue;
    }
    if (current) (buf[current] ??= []).push(line);
  }
  for (const key of Object.keys(out) as (keyof LessonSections)[]) {
    out[key] = (buf[key] ?? []).join("\n").trim();
  }
  return out;
}

// --- reading level ------------------------------------------------------------------------

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const stripped = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  return Math.max(1, stripped.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

/** Flesch-Kincaid grade level of a passage. Rough: use it to flag, never to judge. */
export function fleschKincaidGrade(text: string): number {
  const clean = text.replace(/`[^`]*`/g, " ").replace(/[#*_>|-]/g, " ");
  const sentences = clean.split(/[.!?]+\s/).filter((s) => /\w/.test(s)).length || 1;
  const words = clean.match(/[A-Za-z']+/g) ?? [];
  if (words.length === 0) return 0;
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  return 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
}

/** Highest comfortable reading grade for the Explanation, by stage key. */
export const MAX_READING_GRADE: Record<string, number> = {
  public: 10,
  preschool: 4,
  kindergarten: 5,
  primary: 7,
  middle: 9,
  high: 12,
  college: 17,
};

export const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;

// --- the gate -----------------------------------------------------------------------------

export type GateContext = {
  /** The tree's stage key for this lesson ("primary"), for the reading-level band. */
  stageKey?: string;
  /** Concept slugs that exist in concepts.json. */
  knownConcepts?: Set<string>;
};

/**
 * What a lesson must satisfy to be drafted, and what more to be reviewed. Errors block the
 * import; warnings go to the reviewer. Only the gate can move a lesson to `reviewed`.
 */
export function checkLesson(doc: LessonDoc, ctx: GateContext = {}): Issue[] {
  const issues: Issue[] = [];
  const err = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });
  const s = doc.sections;

  for (const [key, label] of [
    ["explanation", "Explanation"],
    ["workedExample", "Worked example"],
    ["activity", "Activity"],
    ["summary", "Summary"],
  ] as const) {
    if (!s[key]) err(`missing or empty "## ${label}" section`);
  }
  if (doc.checks.length < 3 || doc.checks.length > 5) {
    err(`needs 3 to 5 check questions (has ${doc.checks.length})`);
  }
  for (const c of doc.checks) {
    if (c.options && !c.options.some((o) => o.trim() === c.a.trim())) {
      warn(`check "${c.q.slice(0, 40)}": the answer is not among the listed options`);
    }
  }

  const words = wordCount(s.explanation);
  if (s.explanation && (words < 50 || words > 700)) {
    warn(`Explanation is ${words} words; aim for 50 to 700`);
  }
  if (doc.minutes == null) warn("minutes is not set");

  // Provenance and licences.
  if (!doc.original && doc.sources.length === 0) {
    err("not marked original and no sources listed: say where the content came from");
  }
  for (const src of doc.sources) {
    if (src.adapted && !ADAPTABLE_LICENSES.has(src.license)) {
      err(`"${src.name}" is ${src.license}, which we may not adapt (link it instead of copying)`);
    }
  }
  if (doc.original && doc.sources.some((x) => x.adapted)) {
    warn("marked original but lists an adapted source; pick one");
  }

  // Reading level (advisory).
  const max = ctx.stageKey ? MAX_READING_GRADE[ctx.stageKey] : undefined;
  if (max !== undefined && s.explanation) {
    const grade = fleschKincaidGrade(s.explanation);
    if (grade > max + 1) warn(`Explanation reads at about grade ${grade.toFixed(1)}; ${ctx.stageKey} should stay near ${max}`);
  }

  if (ctx.knownConcepts) {
    for (const c of doc.concepts) if (!ctx.knownConcepts.has(c)) err(`unknown concept "${c}" (add it to concepts.json)`);
  }

  // Review.
  if (doc.status === "reviewed") {
    if (!doc.reviewer) err("reviewed lessons need a reviewer");
    if (!doc.reviewedAt) err("reviewed lessons need reviewedAt");
    if (doc.reviewer && doc.author && doc.reviewer.name === doc.author.name) {
      err("the reviewer must not be the author");
    }
  } else if (doc.reviewer) {
    warn("has a reviewer but status is drafted");
  }
  if (!doc.author) warn("author is not set");
  return issues;
}

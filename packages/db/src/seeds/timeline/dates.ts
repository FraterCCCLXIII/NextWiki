/**
 * Free-text date parsing shared by every timeline source.
 * All results are ASTRONOMICAL years (year 0 = 1 BCE), so 500 BCE -> -499 and 1 CE -> 1.
 */
export const NOW_YEAR = 2026;

/** "500 BCE" (as written) -> astronomical year. */
export const bce = (n: number): number => 1 - n;
/** Historical signed year (negative = BCE, no year 0) -> astronomical. */
export const fromHistorical = (y: number): number => (y < 0 ? y + 1 : y);

export const cleanText = (s: unknown): string =>
  String(s ?? "")
    .replace(/ /g, " ")
    .replace(/\*\*|\*(?=\S)|(?<=\S)\*/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const slugifyKey = (s: string): string =>
  cleanText(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

export interface ParsedRange {
  start: number;
  end?: number;
  approx: boolean;
}

export type DefaultEra = "BCE" | "CE" | "auto" | null;

const num = (s: string) => Number(s.replace(/,/g, ""));
const eraOf = (e?: string) => (e ? (/^(BCE|BC)$/i.test(e) ? "BCE" : "CE") : null);
const scale = (v: string, unit?: string) => num(v) * (unit && /^k$/i.test(unit) ? 1e3 : unit && /^m$/i.test(unit) ? 1e6 : 1);

/**
 * Parses "c. 2000–1700", "1500 BCE", "586–539 BCE", "7th–10th c. CE", "c. 1970 →", "300 ka"-style text.
 * `defaultEra` is used when the text carries no BCE/CE marker: "BCE"/"CE" force it, "auto" guesses
 * (a descending pair such as 1200–1000 is BCE, an ascending pair is CE), null means "reject".
 */
export function parseDateText(text: string, defaultEra: DefaultEra = null): ParsedRange | null {
  const t = cleanText(text).replace(/[–—−]/g, "-");
  if (!t) return null;
  const approx = /\b(c|ca|circa)\.?\s|~|\?|\bapprox/i.test(t);

  const ord = t.match(/(\d+)(?:st|nd|rd|th)\s*(?:-\s*(\d+)(?:st|nd|rd|th))?\s*(?:centur(?:y|ies)|c\.)\s*(BCE|BC|CE|AD)?/i);
  if (ord) {
    const era = eraOf(ord[3]) ?? (defaultEra === "BCE" ? "BCE" : "CE");
    const c1 = Number(ord[1]);
    const c2 = Number(ord[2] ?? ord[1]);
    return era === "BCE"
      ? { start: bce(Math.max(c1, c2) * 100), end: bce((Math.min(c1, c2) - 1) * 100), approx: true }
      : { start: (Math.min(c1, c2) - 1) * 100 + 1, end: Math.max(c1, c2) * 100, approx: true };
  }

  const rng = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)?\s*-\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)?/i);
  if (rng) {
    const a = scale(rng[1]!, rng[2]);
    const b = scale(rng[4]!, rng[5]);
    let ea = eraOf(rng[3]);
    let eb = eraOf(rng[6]);
    if (!ea && !eb) {
      const d = defaultEra === "auto" ? (a > b ? "BCE" : "CE") : (defaultEra ?? null);
      if (!d) return null;
      ea = eb = d;
    } else if (!ea) ea = eb === "CE" && a > b ? "BCE" : eb;
    else if (!eb) eb = ea;
    const ya = ea === "BCE" ? bce(a) : a;
    const yb = eb === "BCE" ? bce(b) : b;
    return { start: Math.min(ya, yb), end: Math.max(ya, yb), approx };
  }

  const open = t.match(/(\d[\d,]*)\s*(BCE|BC|CE|AD)?\s*(?:→|->|-\s*(?:present|now))/i);
  if (open) {
    const era = eraOf(open[2]) ?? (defaultEra === "BCE" ? "BCE" : "CE");
    const v = num(open[1]!);
    return era === "BCE" ? { start: bce(v), approx } : { start: v, end: NOW_YEAR, approx };
  }

  const one = t.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(BCE|BC|CE|AD)\b/i);
  if (one) {
    const v = scale(one[1]!, one[2]);
    return { start: eraOf(one[3]) === "BCE" ? bce(v) : v, approx };
  }
  if (defaultEra && defaultEra !== "auto") {
    const bare = t.match(/(\d[\d,]*(?:\.\d+)?)/);
    if (bare) {
      const v = num(bare[1]!);
      return { start: defaultEra === "BCE" ? bce(v) : v, approx };
    }
  }
  return null;
}

/** Formats an astronomical year for messages: -499 -> "500 BCE". */
export function describeYear(y: number): string {
  const r = Math.round(y);
  return r <= 0 ? `${1 - r} BCE` : `${r} CE`;
}

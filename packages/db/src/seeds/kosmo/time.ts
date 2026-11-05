// One time axis for the whole knowledge base: signed years of the astronomical
// calendar, where year 0 is 1 BCE. A 13.8 Gyr cosmology and a dated battle are
// the same coordinate with different precision, so the viewer and the timeline
// can range-query one indexed column instead of reconciling four scales.
import type { KosmoTimeKind } from "../../schema/kosmo.js";

export interface KosmoTime {
  start: number;
  end: number | null;
  precisionYears: number;
  kind: KosmoTimeKind;
}

/** A point in time. `precisionYears` is the resolution of the claim, not an error bar. */
export function instant(year: number, precisionYears = 1): KosmoTime {
  return {
    start: year,
    end: null,
    precisionYears: Math.max(precisionYears, 0),
    kind: "instant",
  };
}

/** A span. `from`/`to` are the bounds the source actually asserts. */
export function interval(from: number, to: number, precisionYears?: number): KosmoTime {
  const precision =
    precisionYears ?? Math.max(Math.abs(to - from) / 2, 1);
  return {
    start: Math.min(from, to),
    end: Math.max(from, to),
    precisionYears: precision,
    kind: "interval",
  };
}

/**
 * Precision implied by how a year was written: an integer is good to a year,
 * a value ending in 000 is good to its last two digits ("3,300,000 years ago"
 * is archaeology, not a date).
 */
export function precisionForYear(year: number): number {
  const a = Math.abs(year);
  if (a < 1) return 1;
  if (a < 10000) return 1;
  const text = String(Math.trunc(a));
  const zeros = text.length - text.replace(/0+$/, "").length;
  return Math.max(1, Math.pow(10, zeros));
}

const KA = 1e3;
const MA = 1e6;
const GA = 1e9;

/**
 * Human form for a year on the shared axis. Deep time is abbreviated; recorded
 * history keeps its year, because "2 ka" for 1969 would be worse than useless.
 */
export function formatYear(year: number, precisionYears = 1): string {
  const a = Math.abs(year);
  if (a >= GA) return `${round(a / GA)} Ga`;
  if (a >= MA) return `${round(a / MA)} Ma`;
  if (a >= 10 * KA) return `${round(a / KA)} ka`;
  if (year < 0) return `${Math.abs(Math.round(year))} BCE`;
  if (year === 0) return "1 BCE";
  const step = precisionYears > 1 ? precisionYears : 1;
  return `${Math.round(year / step) * step} CE`;

  function round(v: number) {
    const digits = v < 100 ? 1 : 0;
    return v.toFixed(digits).replace(/\.0$/, "");
  }
}

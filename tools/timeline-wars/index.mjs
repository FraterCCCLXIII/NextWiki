// Wars dataset for the NextWiki timeline. Years are HISTORICAL (negative = BCE, no year 0).
// ROWS: { id, name, type, start, end?, approx, region, civilizations, theme?, lat?, lon?, place?, parent?, sides, outcome?, summary, confidence, sources, wikidata? }
// LINKS: { from, to, type } with type in part_of | ended_by | preceded_by | caused | same_conflict_as.
import { ROWS as ancient } from "./wars-ancient.mjs";
import { ROWS as medieval } from "./wars-medieval.mjs";
import { ROWS as earlyModern } from "./wars-early-modern.mjs";
import { ROWS as modern } from "./wars-modern.mjs";
import { LINKS as links } from "./links.mjs";

export const GROUP = "Wars";
export const ROWS = [...ancient, ...medieval, ...earlyModern, ...modern].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));
export const LINKS = links;
export { ancient, medieval, earlyModern, modern };

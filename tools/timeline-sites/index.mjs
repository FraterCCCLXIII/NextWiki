// Religious sites dataset: temples, shrines, sanctuaries, mosques, churches, megaliths and other ritual sites across religions and eras.
// Years are HISTORICAL (negative = BCE, no year 0), like tools/timeline-gapfill.mjs. Stupas live in tools/timeline-stupas.mjs and are not repeated here.
import { ROWS as S0 } from "./sites-africa-oceania.mjs";
import { ROWS as S1 } from "./sites-americas.mjs";
import { ROWS as S2 } from "./sites-east-asia.mjs";
import { ROWS as S3 } from "./sites-europe-celtic-norse-slavic.mjs";
import { ROWS as S4 } from "./sites-greco-roman.mjs";
import { ROWS as S5 } from "./sites-islamic.mjs";
import { ROWS as S6 } from "./sites-judeo-christian.mjs";
import { ROWS as S7 } from "./sites-mesopotamia-egypt.mjs";
import { ROWS as S8 } from "./sites-prehistoric.mjs";
import { ROWS as S9 } from "./sites-south-asia.mjs";
import { ROWS as S10 } from "./sites-southeast-asia.mjs";

export const GROUP = "Religious sites";
export const SHARDS = { "africa-oceania": S0, "americas": S1, "east-asia": S2, "europe-celtic-norse-slavic": S3, "greco-roman": S4, "islamic": S5, "judeo-christian": S6, "mesopotamia-egypt": S7, "prehistoric": S8, "south-asia": S9, "southeast-asia": S10 };
export const ROWS = [...S0, ...S1, ...S2, ...S3, ...S4, ...S5, ...S6, ...S7, ...S8, ...S9, ...S10].sort((a, b) => a.start - b.start || a.name.localeCompare(b.name));

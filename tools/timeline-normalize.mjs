// Shared lane/region normalization for tools/build-timeline-data.mjs and the db timeline seeds.
// Keeps source data untouched: original lane text is returned as `laneRaw` so callers can store it.

/** Bardiya/Achaemenid rows use ~35 place or tribe names as lanes; fold them into five lanes. */
const BARDIYA_LANES = [
  ["Steppe peoples (Scythians & Saka)", /scyth|saka|massaget|yautiya/i],
  ["Eastern provinces (Bactria to Punjab)", /arachosia|bactria|gandh|kapish|gandutava|sikayauvati|uv[aâ]daicaya|punjab|eastern prov|kushan|sattagyd|sindhu|kabul/i],
  ["Babylon", /^babylon/i],
  ["Egypt", /egypt|hyksos/i],
  ["West (Lydia & Greek accounts)", /lydia|greek/i],
];
export function bardiyaLane(lane) {
  const l = String(lane ?? "").trim();
  for (const [name, re] of BARDIYA_LANES) if (re.test(l)) return name;
  return "Persia & the empire";
}

export const REGION_ALIASES = {
  global: "Global",
  italy: "Italy/Roman world",
  "middle east": "Middle East",
  eastern: undefined, // unusable on its own
};

/** Default region for lanes whose source rows carry none. Only used when an item has no region of its own. */
export const LANE_REGION = {
  Celtic: "Western Europe", Armenian: "Caucasus", "Indian Buddhist": "South Asia", "Mahāyāna": "South Asia", "Vajrayāna": "South Asia",
  "Japanese Buddhist": "Japan", "Chinese Buddhist": "East Asia", Iranian: "Iran", Roman: "Italy/Roman world", Greek: "Greece",
  "Tibetan Buddhist": "Tibet", "Southeast Asian Buddhist": "Southeast Asia", Vedic: "South Asia", Egyptian: "Egypt", Mesopotamian: "Mesopotamia",
  Hindu: "South Asia", "Germanic/Norse": "Northern Europe", Slavic: "Eastern Europe", Anatolian: "Anatolia", Etruscan: "Italy/Roman world",
  "Second Temple Jewish": "Middle East", Christian: "Mediterranean", "Folk Buddhist": "East Asia", Islam: "Middle East", Baltic: "Baltic",
  "Early Israelite": "Middle East", "Finno-Ugric": "Northern Europe", "Pre-Islamic Arabian": "Middle East", Japanese: "Japan", Scythian: "Eurasian Steppe",
  "Rabbinic Judaism": "Middle East", Chinese: "East Asia", Phrygian: "Anatolia", Levantine: "Middle East", Tocharian: "Central Asia", Urartian: "Caucasus",
  "Korean Buddhist": "Korea", "Māori": "Oceania", Kongo: "Africa", Canaanite: "Middle East", Inca: "Americas", Aztec: "Americas", Sikh: "South Asia",
  "Central Asian": "Central Asia", Bakuba: "Africa", Zulu: "Africa", Ojibwe: "Americas", "Baháʼí": "Iran", Mandaean: "Mesopotamia", "Proto-Indo-European": "Pontic-Caspian Steppe",
  "Marpa Kagyu Lineage": "Tibet", "Nyingma Dzogchen Lineage": "Tibet", "Gelug Lineage": "Tibet", "Kadam Lineage": "Tibet", "Sakya Lineage": "Tibet",
  "Zhije and Chöd Lineage": "Tibet", "Jonang Lineage": "Tibet", "Shangpa Kagyu Lineage": "Tibet", "Lamdre Lineage": "Tibet", "Bön Lineage": "Tibet", "Bodong Lineage": "Tibet",
  "Zen Dharma Transmission": "East Asia", "Rinzai Lineage": "Japan", "Soto Lineage": "Japan", "Ra Luk Lineage": "Tibet",
  "Integral Yoga": "India", "Kriya Yoga Lineage": "India", "Inchagiri Sampradaya": "India", "Ramakrishna Lineage": "India",
  "Nisargadatta Maharaj Lineage": "India", "Ramana Maharshi Lineage": "India", Theosophy: "Global",
  "Evolution of God": "Global", "Hasidic and Kabbalistic lineage": "Eastern Europe", "Christian contemplative lineage": "Mediterranean",
  "Sufi lineages": "Middle East", "Advaita Vedanta lineage": "South Asia", "Daoist lineage": "East Asia", "Theravāda lineage": "Southeast Asia",
  "Korean Seon": "Korea", "Vietnamese Thiền": "Southeast Asia", Jain: "South Asia", "Modern era": "Global", Future: "Global",
  "Human origins": "Global", "Prehistoric religion": "Global", "Early modern": "Global", "Gnostic Esoteric": "Mediterranean",
  "Contemplative Christianity (Modern)": "Global",
};
/** Lanes that are already regions. */
const REGION_LANES = new Set(["Africa", "Americas", "Central Asia", "Oceania", "Southeast Asia", "Europe", "East Asia", "South Asia", "Middle East", "Anatolia", "Asia", "Eurasia", "Global"]);

export function normalizeRegion(reg) {
  if (reg == null) return undefined;
  const k = String(reg).trim().toLowerCase();
  if (!k) return undefined;
  if (k in REGION_ALIASES) return REGION_ALIASES[k];
  return String(reg).trim();
}

/** Region to store: the item's own (aliased) region, else the lane default. */
export function regionFor(lane, reg) {
  return normalizeRegion(reg) ?? LANE_REGION[lane] ?? (REGION_LANES.has(lane) ? lane : undefined);
}

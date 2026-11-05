/*
 * csv-coverage (from `run.ts --check --only csv-tables`: 9,158 valid records, 0 invalid)
 *
 * Configured: 31 tables, 3,063 records. Each is listed in CSV_TABLES below.
 *
 * Auto-detected: 81 tables, 6,095 records, in 10 datasets named csv-<folder>
 * (abrahamic, hellenic, comparative-myths, persian-achaemenid, messiah-prophets, esoteric,
 * military-political, pie-origins, mystery-cults, buddhism-dharma).
 *
 * Skipped at table level (99 of 180 non-configured candidates):
 *   no date column 39, under 60% of rows parse a date 56, too few rows 3, duplicate content 1.
 * Skipped rows inside imported tables (1,436 total):
 *   unparseable date 992, repeated header row 232, no name 109, empty date 103.
 *
 * Not considered: 211 CSVs remain after excluding -notes.csv, _audit_report.csv and the
 * archive/, ai-revisions/, ocr-text/, passages/ and meta/ folders.
 */

import type { DefaultEra } from "../dates.js";

/** A column by header text (case-insensitive; exact match first, then header-starts-with) or 0-based index. */
export type ColRef = string | number;

/** Date split across columns, e.g. "100000.0 | BCE | 40000.0 | BCE" (value and era in separate cells). */
export interface DateColumns {
  from: ColRef;
  fromEra?: ColRef;
  to?: ColRef;
  toEra?: ColRef;
}

export interface CsvColumnMap {
  name: ColRef;
  /** One text cell ("c. 2000–1700", "5800 BCE", "-27 BCE - 14 CE") or a split value/era pair. */
  date: ColRef | DateColumns;
  /** Free-text end date in its own column (ignored when `date` is a split pair with `to`). */
  dateEnd?: ColRef;
  /** Timeline lane. Falls back to the table label when absent or empty. */
  lane?: ColRef;
  region?: ColRef;
  summary?: ColRef;
  /** Latitude; when `lon` is omitted the cell is parsed as "36.9°N, 34.9°E". */
  lat?: ColRef;
  lon?: ColRef;
  type?: ColRef;
}

export interface CsvTableConfig {
  /** Path relative to .../evolution-of-god/reference/atlas/sources/. */
  file: string;
  dataset: string;
  label: string;
  /** 0-based index of the header row among non-empty rows; rows above it are preamble. null = headerless. */
  header: number | null;
  /** Era for date text without BCE/CE: "BCE" | "CE" | "auto" (descending range = BCE) | null (reject). */
  defaultEra: DefaultEra;
  columns: CsvColumnMap;
}

/**
 * Hand-configured timeline tables. Each was checked against its file's header and sample rows.
 * Everything else under the atlas sources folder is handled by the auto-detect pass in csv-tables.ts.
 */
export const CSV_TABLES: CsvTableConfig[] = [
  {
    file: "military-political/master.csv",
    dataset: "military-master",
    label: "Military & political master timeline",
    header: 1,
    defaultEra: null,
    columns: { name: "Event", date: "Date", lane: "People/Culture", region: "Location", summary: "Description" },
  },
  {
    file: "military-political/mixed-timeline.csv",
    dataset: "mixed-timeline",
    label: "Mixed deity and language timeline",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Deity / Figure",
      date: "Date",
      lane: "Language/Culture",
      region: "Region",
      summary: "Solar / Messianic / Syncretic Attributes",
    },
  },
  {
    file: "esoteric/freemasonry.csv",
    dataset: "freemasonry",
    label: "Freemasonry timeline",
    header: 1,
    defaultEra: null,
    columns: { name: "Event", date: "Date", lane: "People/Culture", region: "Location", summary: "Description" },
  },
  {
    file: "comparative-myths/temples.csv",
    dataset: "temples",
    label: "Temples and stupas",
    header: 0,
    defaultEra: null,
    columns: { name: "Name/Location", date: "Date", lane: "Region", region: 3, type: "Type", summary: 6 },
  },
  {
    file: "military-political/roman-battles.csv",
    dataset: "roman-battles",
    label: "Roman battles",
    header: 0,
    defaultEra: null,
    columns: { name: "Battle", date: "Year", summary: "Notes" },
  },
  {
    file: "military-political/roman-emperors.csv",
    dataset: "roman-emperors",
    label: "Roman emperors",
    header: 0,
    defaultEra: null,
    columns: { name: "Emperor", date: "Reign", summary: "Relations to Religious Groups" },
  },
  {
    file: "abrahamic/early-religion-timeline.csv",
    dataset: "early-religion",
    label: "Early religion",
    header: null,
    defaultEra: null,
    columns: {
      name: 4,
      date: { from: 0, fromEra: 1, to: 2, toEra: 3 },
      region: 5,
      type: 6,
      summary: 7,
    },
  },
  {
    file: "abrahamic/judaism-christianity-timeline.csv",
    dataset: "judaism-christianity",
    label: "Judaism and early Christianity",
    header: 1,
    defaultEra: null,
    columns: {
      name: "Key Events",
      date: { from: 0, fromEra: 1, to: 2, toEra: 3 },
      lane: "Group",
      region: "Location",
      summary: "Political/Religious Impact",
      type: "Event Category",
    },
  },
  {
    file: "esoteric/sacred-architecture.csv",
    dataset: "sacred-architecture",
    label: "Sacred architecture and books",
    header: 1,
    defaultEra: null,
    columns: {
      name: "Book Title",
      date: "Date",
      lane: "Architecture Type",
      region: "Location",
      summary: "Description",
    },
  },
  {
    file: "abrahamic/life-of-paul.csv",
    dataset: "life-of-paul",
    label: "Life of Paul",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Activities & Events",
      date: "Approx. Date",
      lane: "Location",
      region: "Location",
      summary: "Scripture References",
      lat: "Latitude/Longitude",
    },
  },
  {
    file: "abrahamic/life-and-places-of-jesus.csv",
    dataset: "life-and-places-of-jesus",
    label: "Life and places of Jesus",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Event/Activity",
      date: "Approx. Year/Month CE",
      lane: "Location/Region",
      region: "Location/Region",
      summary: "Significance & Notes (incl. variations, Judas)",
      lat: "Approx. Latitude/Longitude",
    },
  },
  {
    file: "hellenic/pan-timeline.csv",
    dataset: "pan-timeline",
    label: "Pan and Satyr traditions",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Deity / Figure",
      date: "Period / Era",
      lane: "Language/Culture",
      region: "Region",
      summary: "Solar / Messianic / Syncretic Attributes",
    },
  },
  {
    file: "esoteric/sex-rites-timeline.csv",
    dataset: "sex-rites",
    label: "Ritual sexuality timeline",
    header: 1,
    defaultEra: null,
    columns: { name: "Practice/Ritual", date: "Period", lane: "Tradition/Culture", summary: "Description" },
  },
  {
    file: "esoteric/tantric-traditions-timeline.csv",
    dataset: "tantric-traditions",
    label: "Tantric traditions",
    header: 1,
    defaultEra: null,
    columns: {
      name: "School/Sect",
      date: "Approximate Period",
      region: "Location",
      summary: "Philosophical Distinctions",
    },
  },
  {
    file: "buddhism-dharma/meditation-timeline.csv",
    dataset: "meditation",
    label: "Meditation timeline",
    header: 1,
    defaultEra: null,
    columns: {
      name: "Text/Source",
      date: "Year",
      lane: "Tradition",
      region: "Region",
      summary: "Description of Meditation Practices",
    },
  },
  {
    file: "messiah-prophets/maitreya-timeline.csv",
    dataset: "maitreya-timeline",
    label: "Maitreya timeline",
    header: 1,
    defaultEra: null,
    columns: { name: "Event/Development", date: "Year", lane: "Region", summary: "Description" },
  },
  {
    file: "mystery-cults/mithras-timeline.csv",
    dataset: "mithras-timeline",
    label: "Mithras timeline",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Deity / Figure",
      date: "Date",
      lane: "Language/Culture",
      region: "Region",
      summary: "Solar / Messianic / Syncretic Attributes",
    },
  },
  {
    file: "mystery-cults/eurasian-cult-timeline.csv",
    dataset: "eurasian-cults",
    label: "Eurasian mystery cults",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Cult/Tradition",
      date: "Date (BCE/CE)",
      region: "Region/Origin",
      summary: "Core Myth & Deities",
    },
  },
  {
    file: "mystery-cults/steppe-cult-timeline.csv",
    dataset: "steppe-cults",
    label: "Steppe cult timeline",
    header: 1,
    defaultEra: "BCE",
    columns: {
      name: "Hero/Group",
      date: "Date (BCE)",
      region: "Cult Center(s) & Region",
      summary: "Archaeological/Literary Evidence",
    },
  },
  {
    file: "pie-origins/cult-timeline.csv",
    dataset: "pie-cult-timeline",
    label: "Indo-European cult timeline",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Cult/Religion",
      date: "Time Period",
      region: "Region/Influence",
      summary: "Key Development",
    },
  },
  {
    file: "persian-achaemenid/civilization-timeline.csv",
    dataset: "civilization-timeline",
    label: "Civilizations timeline",
    header: 1,
    defaultEra: null,
    columns: {
      name: "Civilization / Culture",
      date: "Approx. Dates",
      region: "Region / Continent",
      summary: "Notes / Metadata",
    },
  },
  {
    file: "persian-achaemenid/saka-scythian-timeline.csv",
    dataset: "saka-scythian-timeline",
    label: "Saka and Scythian timeline",
    header: 1,
    defaultEra: "BCE",
    columns: {
      name: "Event/Period",
      date: "Date (BCE)",
      lane: "Major Figures/Tribes",
      summary: "Key Events & Interactions",
    },
  },
  {
    file: "persian-achaemenid/aramaic-timeline.csv",
    dataset: "aramaic-timeline",
    label: "Aramaic script timeline",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Script/Language Interaction",
      date: "Period",
      lane: "Region(s) & Users",
      summary: "Religious & Cultural Contexts",
    },
  },
  {
    file: "persian-achaemenid/avestan-language-timeline.csv",
    dataset: "avestan-language",
    label: "Avestan language timeline",
    header: 1,
    defaultEra: null,
    columns: {
      name: "Event/Development",
      date: "Time Period",
      lane: "Dynasty/Civilization",
      region: "Region/Area",
    },
  },
  {
    file: "abrahamic/hellenic-judaism-timeline.csv",
    dataset: "hellenic-judaism",
    label: "Hellenistic Judaism figures",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Name",
      date: "Years",
      lane: "Group",
      type: "Occupation/Role",
      summary: "Significance",
    },
  },
  {
    file: "abrahamic/jewish-hellenization-timeline.csv",
    dataset: "jewish-hellenization",
    label: "Jewish hellenization timeline",
    header: 1,
    defaultEra: "BCE",
    columns: {
      name: "Key Events & Developments",
      date: "Date (BCE)",
      lane: "Peoples/Cultures",
      summary: "Religious Beliefs & Practices",
    },
  },
  {
    file: "hellenic/apollo-timeline.csv",
    dataset: "apollo-timeline",
    label: "Apollo timeline",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Stage/Variant",
      date: "Date",
      lane: "Language/Culture",
      region: "Region",
      summary: "Meaning/Interpretation",
    },
  },
  {
    file: "comparative-myths/hekhalot-kundalini-vision-timeline.csv",
    dataset: "hekhalot-kundalini",
    label: "Hekhalot and kundalini visions",
    header: 0,
    defaultEra: null,
    columns: {
      name: "Title_Event",
      date: "Date_Label",
      lane: "Tradition_System",
      region: "Location",
      type: "Entry_Type",
      summary: "Source_Text",
    },
  },
  {
    file: "mystery-cults/inquisitions.csv",
    dataset: "inquisitions",
    label: "Inquisitions and persecutions",
    header: 1,
    defaultEra: null,
    columns: { name: "Event", date: "Year", region: "Location", summary: "Additional Context" },
  },
  {
    file: "mystery-cults/schisms.csv",
    dataset: "schisms",
    label: "Christian schisms",
    header: 1,
    defaultEra: null,
    columns: { name: "Schism Name", date: "Time Period", summary: "Description of Events" },
  },
];

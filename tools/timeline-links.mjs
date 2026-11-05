// Sourced relationship links between existing timeline items for three datasets
// that previously had no edges: Civilisations, Bardiya & Achaemenid, Evolution of God.
// Rule: a link is only listed when a source states it or standard history is unambiguous.
// No similarity-based or guessed links. ids are exactly as in apps/web/public/timeline/timeline.json.
//
// Shape: { from, to, type, cat, basis, source }
//  type: succeeded_by | preceded_by | conquered_by | part_of | contemporary_with |
//        cultural_influence | caused | teacher_of | allied_with | rebelled_against
//  cat : transmission | genealogical | influence | other
//  Direction: "from X succeeded_by Y" means Y follows X; "from X conquered_by Y" means Y conquered X.

const WP = (t) => `https://en.wikipedia.org/wiki/${t}`;
const CIV = "time-thread-web/public/data/timelines (ancient-civilizations, world-history-multi-row, asian-history, world-religions)";
const CSV = "Messiah/docs/appendices/achaemenid-bardiya-timeline.csv";
const MT = "evolution-of-god/reference/master-timeline.md, Table 1 (master timeline)";

const L = (from, to, type, cat, basis, source) => ({ from, to, type, cat, basis, source });

// ---------------------------------------------------------------- Civilisations
const c = "tt-culture-";
const civ = [
  // Mesopotamian containment (Mesopotamia = region/civilisation umbrella)
  ...["sumer", "akkadian-empire", "babylonian-empire", "assyrian-empire"].map((k) =>
    L(c + k, "tt-world-history-multi-row-mesopotamia", "part_of", "other",
      "Mesopotamian state/civilisation within the Mesopotamia umbrella item", WP("Mesopotamia"))),
  L(c + "sumer", c + "akkadian-empire", "conquered_by", "other",
    "Sargon of Akkad conquered the Sumerian city-states", WP("Akkadian_Empire")),
  L(c + "assyrian-empire", c + "babylonian-empire", "succeeded_by", "other",
    "Neo-Assyrian Empire fell 612-609 BCE, followed by the Neo-Babylonian Empire", WP("Neo-Babylonian_Empire")),
  L(c + "babylonian-empire", c + "persian-empire", "conquered_by", "other",
    "Cyrus the Great took Babylon in 539 BCE (item end -538)", WP("Fall_of_Babylon")),
  L(c + "ancient-egypt", c + "persian-empire", "conquered_by", "other",
    "Cambyses II conquered Egypt in 525 BCE (Achaemenid 27th dynasty)", WP("Achaemenid_conquest_of_Egypt")),
  L(c + "ancient-egypt", c + "roman-empire", "conquered_by", "other",
    "Egypt annexed by Rome after Actium, 30 BCE (item end -29)", WP("Ptolemaic_Kingdom")),
  L(c + "ancient-greece", c + "roman-empire", "conquered_by", "other",
    "Roman conquest of Greece, Corinth sacked 146 BCE (item end -145)", WP("Roman_Greece")),
  L(c + "roman-empire", c + "byzantine-empire", "succeeded_by", "other",
    "Byzantine Empire is the continuation of the Eastern Roman Empire after 330/476 CE", WP("Byzantine_Empire")),
  L(c + "byzantine-empire", c + "ottoman-empire", "conquered_by", "other",
    "Ottoman conquest of Constantinople 1453 (item end 1453)", WP("Fall_of_Constantinople")),
  L(c + "islamic-caliphates", c + "mongol-empire", "conquered_by", "other",
    "Mongol sack of Baghdad ended the Abbasid Caliphate in 1258 (item end 1258)", WP("Siege_of_Baghdad_(1258)")),
  L(c + "mughal-empire", c + "british-empire", "conquered_by", "other",
    "British deposed the last Mughal emperor after the 1857 rebellion (item end 1857)", WP("Mughal_Empire")),
  // China
  L(c + "shang-dynasty", c + "zhou-dynasty", "conquered_by", "other",
    "Zhou overthrew the Shang at Muye c. 1046 BCE", WP("Battle_of_Muye")),
  L(c + "zhou-dynasty", c + "qin-dynasty", "conquered_by", "other",
    "Qin extinguished the Zhou in 256-255 BCE (item end -255)", WP("Zhou_dynasty")),
  L(c + "qin-dynasty", c + "han-dynasty", "succeeded_by", "other",
    "Han followed Qin after the Chu-Han contention (206 BCE)", WP("Han_dynasty")),
  L(c + "sui-dynasty", c + "tang-dynasty", "succeeded_by", "other",
    "Tang founded 618 CE on the fall of the Sui", WP("Tang_dynasty")),
  L(c + "song-dynasty", c + "yuan-dynasty", "conquered_by", "other",
    "Mongol Yuan conquered the Southern Song, 1279", WP("Mongol_conquest_of_the_Song_dynasty")),
  L(c + "yuan-dynasty", c + "mongol-empire", "part_of", "other",
    "Yuan dynasty was the Mongol Empire's Chinese division founded by Kublai Khan", WP("Yuan_dynasty")),
  L(c + "yuan-dynasty", c + "ming-dynasty", "succeeded_by", "other",
    "Ming replaced the Yuan in 1368", WP("Ming_dynasty")),
  L(c + "ming-dynasty", c + "qing-dynasty", "succeeded_by", "other",
    "Qing replaced the Ming, 1644", WP("Qing_dynasty")),
  // Religion events (sequences stated within the same tradition)
  L("tt-world-religions-hinduism-vedas", "tt-world-religions-hinduism-upanishads", "succeeded_by", "other",
    "Vedic period followed by the Upanishadic period", WP("Vedic_period")),
  L("tt-world-religions-buddhism-birth", "tt-world-religions-buddhism-enlightenment", "succeeded_by", "other",
    "Life of the Buddha: birth precedes enlightenment", WP("Gautama_Buddha")),
  L("tt-world-religions-christianity-jesus", "tt-world-religions-christianity-crucifixion", "succeeded_by", "other",
    "Life of Jesus: birth precedes crucifixion", WP("Jesus")),
  L("tt-world-religions-christianity-crucifixion", "tt-world-religions-christianity-paul", "succeeded_by", "other",
    "Pauline mission follows the crucifixion", WP("Paul_the_Apostle")),
  L("tt-world-religions-islam-birth", "tt-world-religions-islam-hijra", "succeeded_by", "other",
    "Muhammad's birth (570) precedes the Hijra (622)", WP("Muhammad")),
  L("tt-world-religions-islam-hijra", "tt-world-religions-islam-conquest-mecca", "succeeded_by", "other",
    "Conquest of Mecca (630) follows the Hijra (622)", WP("Conquest_of_Mecca")),
  L("tt-world-religions-christianity-reformation", "tt-world-religions-christianity-counter-reformation", "caused", "other",
    "Counter-Reformation was the Catholic response to the Protestant Reformation", WP("Counter-Reformation")),
].map((l) => ({ ...l, source: `${l.source} ; item context: ${CIV}` }));

// ---------------------------------------------------------------- Bardiya & Achaemenid
const b = (n) => `bardiya-${n}`;
const row = (...n) => `${CSV} rows ${n.map((x) => b(x)).join(", ")}`;
const bard = [
  L(b(0), b(1), "succeeded_by", "other", "Semitic migration into Egypt precedes Hyksos rule of the Delta at Avaris", WP("Hyksos")),
  L(b(8), b(12), "succeeded_by", "genealogical", "Cyrus II succeeded his father Cambyses I as king of Anshan (Cambyses I named in Key figures)", WP("Cyrus_the_Great")),
  L(b(12), b(13), "succeeded_by", "other", "Cyrus, king of Anshan, then overthrew his Median overlord Astyages (source Notes)", row(12, 13)),
  L(b(13), b(14), "succeeded_by", "other", "Median overthrow (c. 549) precedes the capture of Sardis (c. 546)", WP("Cyrus_the_Great")),
  L(b(14), b(17), "succeeded_by", "other", "Capture of Sardis precedes the conquest of Babylon (539 BCE)", WP("Cyrus_the_Great")),
  L(b(17), b(19), "caused", "other", "Conquest of Babylon led to Cambyses' appointment as governor of Northern Babylonia (source Notes)", row(17, 19)),
  L(b(19), b(20), "succeeded_by", "other", "Cambyses appointed, then dismissed (source rows in sequence)", row(19, 20)),
  L(b(17), b(21), "succeeded_by", "other", "Babylon conquest precedes the Massagetae expedition and Cyrus's death (529 BCE)", WP("Cyrus_the_Great")),
  L(b(21), b(22), "succeeded_by", "genealogical", "Cambyses II succeeded Cyrus (co-ruler, buried him at Pasargadae per source Notes)", row(21, 22)),
  L(b(25), b(27), "caused", "other", "Political preparations enabled the Egyptian conquest (source Notes: death of Amasis II, Polycrates alliance)", row(25, 27)),
  L(b(26), b(27), "caused", "other", "Navy and Arab water treaty were preparations for the conquest (source Notes)", row(26, 27)),
  L(b(27), b(28), "succeeded_by", "other", "Conquest of Egypt followed by Cambyses' rule as pharaoh", WP("Cambyses_II")),
  L(b(29), b(28), "part_of", "other", "Apis bull episode took place during Cambyses' Egyptian rule (-523 within -524..-521)", row(28, 29)),
  L(b(31), b(32), "succeeded_by", "other", "Cambyses left Egypt, then died in Syria (source Notes)", row(31, 32)),
  L(b(30), b(33), "caused", "other", "Per the Behistun Inscription, Cambyses' secret killing of Bardiya enabled Gaumata to impersonate him (source marks claim as disputed)", `${row(30, 33)} ; ${WP("Behistun_Inscription")}`),
  L(b(33), b(40), "succeeded_by", "other", "Darius and six nobles killed Gaumata (Behistun Inscription)", WP("Behistun_Inscription")),
  L(b(40), b(41), "caused", "other", "Darius' accession after Gaumata's death was followed by rebellions in Elam, Media and Persia (Behistun)", WP("Behistun_Inscription")),
  L(b(40), b(51), "succeeded_by", "other", "Darius consolidated power after Gaumata's assassination", row(40, 51)),
  L(b(41), b(54), "succeeded_by", "other", "Darius' consolidation of Achaemenid rule followed suppression of the rebellions (Behistun lists)", WP("Behistun_Inscription")),
  // Vahyazdata revolt (rows appear twice in source under different spellings; battles grouped under the nearest revolt row)
  L(b(37), b(41), "part_of", "other", "Revolt of Vahyazdata (a Bardiya claimant) is one of the rebellions against Darius (Behistun)", WP("Behistun_Inscription")),
  L(b(42), b(41), "part_of", "other", "Vahyazdata's Persian rising is one of the rebellions against Darius (Behistun)", WP("Behistun_Inscription")),
  L(b(38), b(37), "part_of", "other", "Kabul Valley challenge is an episode of the Vahyazdata revolt (Key figures Vahyazdata)", row(37, 38)),
  L(b(39), b(37), "part_of", "other", "Battle at Rakha: Artavardiya suppressed Vahyazdata's rebellion (source Notes)", row(37, 39)),
  ...[43, 44, 45, 46, 48, 49, 50].map((n) =>
    L(b(n), b(42), "part_of", "other", "Battle/episode of the Vahyazdata rebellion per source Key figures and Notes", row(42, n))),
  L(b(45), b(47), "succeeded_by", "other", "Vahyazdata captured at Parga, then crucified (source Notes)", row(45, 47)),
  // Alexander and after
  L(b(64), b(65), "rebelled_against", "other", "Saka resisted Alexander (source Notes: sometimes allied with Bactrians and Sogdians)", row(64, 65)),
  L(b(57), b(65), "conquered_by", "other", "Achaemenid eastern satrapies conquered by Alexander, 330-327 BCE", WP("Wars_of_Alexander_the_Great")),
  L(b(65), b(66), "succeeded_by", "other", "Greek-Bactrian and Indo-Greek kingdoms arose from Alexander's conquests", WP("Indo-Greek_Kingdom")),
  L(b(66), b(67), "succeeded_by", "other", "Saka/Kushan rule followed the Indo-Greek kingdoms in the region", WP("Kushan_Empire")),
];

// ---------------------------------------------------------------- Evolution of God
const e = (s) => `eog-1-${s}`;
const chain = [
  ["paleolithic-shamanic", "neolithic"],
  ["neolithic", "bronze-age-urban-states"],
  ["bronze-age-urban-states", "iron-i-emergence-of-israel"],
  ["iron-i-emergence-of-israel", "iron-ii-first-temple"],
  ["iron-ii-first-temple", "babylonian-exile"],
  ["babylonian-exile", "persian-achaemenid"],
  ["persian-achaemenid", "hellenistic-early-second-temple"],
  ["hellenistic-early-second-temple", "roman-rise-of-christianity"],
  ["roman-rise-of-christianity", "late-antiquity-rabbinic-judaism-christian-orthod"],
  ["late-antiquity-rabbinic-judaism-christian-orthod", "early-islam"],
  ["early-islam", "medieval-mysticism-nondual-currents"],
  ["medieval-mysticism-nondual-currents", "reformation-early-modern"],
  ["reformation-early-modern", "enlightenment-19th-c"],
  ["enlightenment-19th-c", "20th-c-modern-theology-the-east-west-encounter"],
  ["20th-c-modern-theology-the-east-west-encounter", "late-20th-c-present-new-age-nondual-mainstream-u"],
].map(([a, z]) => L(e(a), e(z), "succeeded_by", "other",
  "Consecutive eras in the source's chronological master table", MT));
const eog = [
  ...chain,
  L(e("hellenistic-early-second-temple"), e("commagene"), "contemporary_with", "other",
    "Date ranges overlap (Hellenistic -331..-62 vs Commagene -69..-37); source places Commagene on the border of Hasmonean Judea", MT),
];

export const LINKS = [...civ, ...bard, ...eog];

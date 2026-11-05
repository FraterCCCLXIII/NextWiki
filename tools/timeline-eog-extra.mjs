// Finer-grained "Evolution of God" rows derived from
//   ~/Documents/github/evolution-of-god/reference/master-timeline.md
// Each row cites a line of that file plus a quoted fragment. Years are HISTORICAL (negative = BCE, no year 0 handling).
// Where the document dates a claim only by its era, the era's range is used and approx = true ("era-dated").
// Grades are those the document attaches to the cell/row ([IN SOURCE] / [EXTENSION] / [INTERPRETIVE]).
// Weakest grade is kept for mixed tags, as the existing seed does.

export const GROUP = "Evolution of God";

const FILE = "master-timeline.md";
const T = { 1: "Evolution of God", 2: "Satan, demons and evil", 3: "The nondual current" };

// Existing era rows (apps/web/public/timeline/timeline.json) with the range the document gives.
export const ERAS = {
  P: { id: "eog-1-paleolithic-shamanic", name: "Paleolithic / shamanic", s: -300000, e: -10000 },
  N: { id: "eog-1-neolithic", name: "Neolithic", s: -10000, e: -3000 },
  B: { id: "eog-1-bronze-age-urban-states", name: "Bronze Age urban states", s: -3000, e: -1200 },
  I1: { id: "eog-1-iron-i-emergence-of-israel", name: "Iron I - emergence of Israel", s: -1200, e: -1000 },
  I2: { id: "eog-1-iron-ii-first-temple", name: "Iron II / First Temple", s: -1000, e: -586 },
  EX: { id: "eog-1-babylonian-exile", name: "Babylonian Exile", s: -586, e: -539 },
  PE: { id: "eog-1-persian-achaemenid", name: "Persian / Achaemenid", s: -539, e: -332 },
  HE: { id: "eog-1-hellenistic-early-second-temple", name: "Hellenistic / early Second Temple", s: -332, e: -63 },
  CO: { id: "eog-1-commagene", name: "Commagene", s: -70, e: -38 },
  RO: { id: "eog-1-roman-rise-of-christianity", name: "Roman / rise of Christianity", s: 1, e: 400 },
  LA: { id: "eog-1-late-antiquity-rabbinic-judaism-christian-orthod", name: "Late Antiquity: Rabbinic Judaism & Christian orthodoxy", s: 70, e: 600 },
  IS: { id: "eog-1-early-islam", name: "Early Islam", s: 600, e: 1000 },
  MD: { id: "eog-1-medieval-mysticism-nondual-currents", name: "Medieval mysticism & nondual currents", s: 800, e: 1500 },
  RF: { id: "eog-1-reformation-early-modern", name: "Reformation & Early Modern", s: 1500, e: 1700 },
  EN: { id: "eog-1-enlightenment-19th-c", name: "Enlightenment & 19th c.", s: 1700, e: 1900 },
  M20: { id: "eog-1-20th-c-modern-theology-the-east-west-encounter", name: "20th c.: modern theology & the East-West encounter", s: 1900, e: 1970 },
  NA: { id: "eog-1-late-20th-c-present-new-age-nondual-mainstream-u", name: "Late 20th c.-present: New Age, nondual mainstream, universal God", s: 1970, e: 2026 },
};

const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

export const ROWS = [];

/**
 * r(table, name, era, start, end, approx, grade, line, quote, desc)
 * start === null -> use the era's range, approx forced true (era-dated).
 */
function r(table, name, eraKey, start, end, approx, grade, line, quote, desc) {
  const era = ERAS[eraKey];
  if (!era) throw new Error("bad era " + eraKey);
  let s = start, e = end, ap = approx;
  if (start === null) { s = era.s; e = era.e; ap = true; }
  const row = {
    id: `eog-${table}-${slug(name)}`,
    name,
    start: s,
    ...(e != null ? { end: e } : {}),
    approx: !!ap,
    lane: T[table],
    era: era.name,
    eraId: era.id,
    description: `${desc}${start === null ? " (Dated only by its era in the document; the era's range is used.)" : ""}`,
    grade,
    source: `${FILE}:${line} - "${quote}"`,
  };
  ROWS.push(row);
}
const IS_ = "IN SOURCE", EXT = "EXTENSION", INT = "INTERPRETIVE";

// ===================================================================== TABLE 1 =====================================
// Paleolithic (line 29) [EXTENSION]
r(1, "Chauvet cave art", "P", -36000, undefined, true, EXT, 29, "Cave art (Chauvet ~36k, Lascaux ~17k)", "Cave art cited as evidence of Paleolithic ritual life; document gives '~36k' (read here as years before the present, approximate).");
r(1, "Lascaux cave art", "P", -17000, undefined, true, EXT, 29, "Cave art (Chauvet ~36k, Lascaux ~17k)", "Second cave-art example; '~17k', read as years before the present, approximate.");
r(1, "Ritual burial with grave goods", "P", null, null, true, EXT, 29, "ritual burial with grave goods", "Cited material evidence of Paleolithic religion.");
r(1, "Shamanic specialists (part-time)", "P", null, null, true, EXT, 29, "Religion = *part-time* shamanic specialists.", "Egalitarian foraging bands with no priesthood; religious specialists are part-time shamans.");
r(1, "Animism and totemism", "P", null, null, true, EXT, 29, "**Animism**: spirits in animals, weather, places; ancestor spirits; totemism", "Concept of God: no sovereign personal creator; at most a diffuse sky/high god.");
r(1, "The shaman as mediator", "P", null, null, true, EXT, 29, "The **shaman** - ecstatic soul-flight between worlds; healer and psychopomp.", "Mediator figure of the era.");
r(1, "Layered cosmos and axis mundi", "P", null, null, true, EXT, 29, "Layered cosmos on an *axis mundi* / world-tree (upper-middle-lower).", "Cosmos: three layers; death as passage to an ancestor realm, not morally sorted.");
// Neolithic (30)
r(1, "Goebekli Tepe", "N", -9600, undefined, true, EXT, 30, "**Goebekli Tepe** (c. 9600 BCE) - a monumental temple *before* farming.", "Monumental temple predating agriculture.");
r(1, "Agriculture and surplus", "N", null, null, true, EXT, 30, "Agriculture, sedentism, **surplus**, property, rising density.", "Material driver of the era; world population ~5 to 14 M+.");
r(1, "Catalhoeyuek", "N", null, null, true, EXT, 30, "Catalhoeyuek ~5-8k people", "Large Neolithic settlement cited for rising density.");
r(1, "Jericho skull caches (ancestor cult)", "N", null, null, true, EXT, 30, "ancestor cult (skull caches at Jericho)", "Ancestor veneration; secondary burial.");
r(1, "Mother-goddess figurines and horned/bull gods", "N", null, null, true, EXT, 30, "mother-goddess figurines, ... the contested \"Great Goddess.\" Storm/sky gods emerging.", "Fertility powers and an emerging storm/sky-god stratum.");
// Bronze (31) [IN SOURCE - deep background]
r(1, "Earliest writing", "B", -3200, undefined, true, IS_, 31, "**writing** (c. 3200)", "Writing as one of the material drivers of temple economies.");
r(1, "Uruk, first city", "B", null, null, true, IS_, 31, "First **cities** (Uruk ~40-80k)", "First cities; temple economies, kingship, full-time priesthoods.");
r(1, "Hammurabi law code", "B", -1750, undefined, true, IS_, 31, "law codes (Hammurabi c. 1750)", "Law-code example for the Bronze-Age state.");
r(1, "El spreads west with the Amorites", "B", -2300, -1800, true, IS_, 31, "**El** spreads west with the Amorites (c. 2300-1800).", "Spread of the high god El in West Semitic religion.");
r(1, "Polytheistic pantheons and divine council", "B", null, null, true, IS_, 31, "Developed **polytheistic pantheons + divine council** (Anu/Enlil/Enki; Ptah, Ra).", "Concept of God in Mesopotamia and Egypt.");
r(1, "Substitute-king ritual and human sacrifice", "B", null, null, true, IS_, 31, "Substitute-king ritual & human sacrifice attested.", "Attested ritual practice.");
r(1, "Sacral kingship (pharaoh as god)", "B", null, null, true, IS_, 31, "The **divine / sacral king** (pharaoh *as* god; Mesopotamian king as the god's steward).", "Mediator figure of the era.");
r(1, "House of Dust and the weighing of the heart", "B", null, null, true, IS_, 31, "Egypt the early exception** - moral judgment of the dead (weighing of the heart).", "Mesopotamian 'House of Dust' (neutral, like Sheol) vs Egypt's moral judgment of the dead.");
// Iron I (32) [IN SOURCE]
r(1, "Late-Bronze collapse", "I1", -1177, undefined, true, IS_, 32, "Late-Bronze **collapse** (~1177)", "Followed by hundreds of highland villages (four-room houses, no pig bones, terracing).");
r(1, "Yahweh as one of El's sons (Deut 32:8-9)", "I1", null, null, true, IS_, 32, "**El** heads the council; **Yahweh one of El's sons** (Deut 32:8-9)", "Yahweh described as a southern storm-warrior from Seir/Edom/Teman.");
r(1, "Household polytheism and Asherah", "I1", null, null, true, IS_, 32, "Household polytheism (Asherah).", "Popular religion of early Israel.");
r(1, "Judges as charismatic war-leaders (no king, no messiah)", "I1", null, null, true, IS_, 32, "Charismatic \"judges\" / war-leaders. **No king, no messiah** yet.", "Mediator figure of the era.");
// Iron II (33) [IN SOURCE]
r(1, "Temple built (Temple as microcosm)", "I2", -957, undefined, true, IS_, 33, "**Temple as microcosm** (built c. 957).", "Cosmos column: Temple as microcosm; Sheol still neutral.");
r(1, "Monolatry (Yahweh alone)", "I2", -750, -586, true, IS_, 33, "**monolatry** (\"Yahweh-alone,\" 750-586; Exod 20:3-5)", "National Yahweh absorbs Baal's storm functions.");
r(1, "Asherah as consort in popular cult", "I2", null, null, true, IS_, 33, "Consort **Asherah** in popular cult.", "Popular religion persists alongside monolatry.");
r(1, "Divine council in archaic strata (Ps 82)", "I2", null, null, true, IS_, 33, "Divine council still visible in archaic strata (Ps 82).", "Residue of the older council framework.");
r(1, "Hezekiah/Josiah centralization", "I2", null, null, true, IS_, 33, "Hezekiah/Josiah **centralization** = fiscal *and* cultic consolidation", "Rural bamot suppressed.");
r(1, "Hilkiah finds Deuteronomy (Josiah's reform)", "I2", -622, undefined, false, IS_, 33, "**622 BCE**: Hilkiah \"finds\" Deuteronomy; rural *bamot* suppressed", "Josiah's cultic centralization.");
r(1, "Josiah killed at Megiddo", "I2", -609, undefined, false, IS_, 33, "Josiah's death at Megiddo, 609** - killed by Necho II against Huldah's explicit oracle that he would die in peace (2 Kgs 22:20 vs 23:29-30)", "Described as the first failure of the Deuteronomic retribution scheme and the opening of the theodicy crisis.");
r(1, "Reigning Davidic king as mashiach", "I2", null, null, true, IS_, 33, "The **reigning Davidic king** = *mashiach* (anointed).", "Mediator figure of the era.");
// Exile (34) [IN SOURCE]
r(1, "Destruction of Jerusalem and Temple; deportation", "EX", -586, undefined, false, IS_, 34, "Jerusalem & Temple destroyed; Judean elite **deported**", "Loss of king, land and Temple forces religion onto text/Torah.");
r(1, "Deutero-Isaiah: ontological monotheism", "EX", null, null, true, IS_, 34, "**Ontological monotheism** - \"there is no other\" (Deutero-Isaiah).", "God deterritorialized and mobile.");
r(1, "Ezekiel's chariot-throne", "EX", null, null, true, IS_, 34, "God **deterritorialized & mobile** (Ezekiel's chariot-throne).", "Mobile divine presence.");
r(1, "Cyrus called mashiach (Isa 45:1)", "EX", null, null, true, IS_, 34, "the foreign king **Cyrus** is called *mashiach* (Isa 45:1)", "Alongside hope for a future ideal Davidide.");
r(1, "Priestly creation account (Genesis 1)", "EX", null, null, true, IS_, 34, "Genesis 1 (Priestly) ordered creation.", "Cosmos abstracted and moralized.");
// Persian (35) [IN SOURCE]
r(1, "Second Temple built", "PE", -516, undefined, true, IS_, 35, "Return + **Second Temple** (c. 516)", "Yehud a small temple-state.");
r(1, "Torah codified (Ezra-Nehemiah)", "PE", null, null, true, IS_, 35, "**Torah codified** (Ezra-Nehemiah)", "Priesthood as governing class under empire.");
r(1, "Elephantine polytheism", "PE", null, null, true, IS_, 35, "*Popular* religion still polytheistic (Elephantine).", "Popular religion lags the elite monotheism.");
r(1, "Named angels and cosmic dualism emerge", "PE", null, null, true, IS_, 35, "named angels, Satan splitting off, cosmic dualism (Zoroastrian-tinged)", "Metaphysical expansion of the consolidated monotheism.");
r(1, "Transcendent heaven and judgment emerge", "PE", null, null, true, IS_, 35, "Transcendent **heaven** displaces the localized mountain; **judgment** emerges.", "Cosmos and afterlife column.");
// Hellenistic (36) [IN SOURCE]
r(1, "Septuagint and Alexandrian Judaism", "HE", null, null, true, IS_, 36, "Alexandrian Judaism, **Septuagint**", "Greek koine as vector.");
r(1, "Maccabean revolt", "HE", -167, undefined, false, IS_, 36, "Maccabean revolt (167)", "Followed by apocalyptic sectarianism.");
r(1, "Qumran apocalyptic sectarianism", "HE", null, null, true, IS_, 36, "apocalyptic sectarianism (Qumran)", "Source of the 'two messiahs' idea.");
r(1, "Wisdom/Sophia as cosmic agent; two powers in heaven", "HE", null, null, true, IS_, 36, "**Wisdom / Sophia** as cosmic agent; \"**two powers in heaven**\"", "Hypostatic expansion of the divine.");
r(1, "Daniel 7 Son of Man", "HE", -165, undefined, true, IS_, 36, "apocalyptic **\"Son of Man\"** (Daniel 7, c. 165)", "Mediator column; alongside the priestly messiah.");
r(1, "Qumran two messiahs", "HE", null, null, true, IS_, 36, "**Priestly messiah** (Qumran's *two* messiahs)", "Mediator column.");
r(1, "Daniel 12 bodily resurrection and last judgment", "HE", -165, undefined, true, IS_, 36, "**Bodily resurrection + last judgment** explicit (Daniel 12, c. 165).", "Cosmos and afterlife column.");
// Roman (37) [IN SOURCE -> EXTENSION] -> weakest = EXTENSION
r(1, "Destruction of the Temple", "RO", 70, undefined, false, EXT, 37, "Temple destroyed **70 CE**.", "Pax Romana context; diaspora networks as the vector of Christian spread.");
r(1, "Revelation and the New Jerusalem", "RO", 95, undefined, true, EXT, 37, "**New Jerusalem** / heavenly Temple (Revelation c. 95)", "Developed heaven and hell, resurrection, final judgment.");
r(1, "Constantine (312)", "RO", 312, undefined, false, EXT, 37, "Constantine (312)", "Step toward state religion.");
r(1, "Council of Nicaea", "RO", 325, undefined, false, EXT, 37, "the **Trinity** (Nicaea 325, Constantinople 381, Chalcedon 451)", "Trinitarian fixing of the Logos Christology.");
r(1, "Theodosius: state religion", "RO", 380, undefined, false, EXT, 37, "state religion under Theodosius (380)", "Christianity becomes the empire's religion.");
r(1, "Council of Constantinople", "RO", 381, undefined, false, EXT, 37, "Nicaea 325, Constantinople 381, Chalcedon 451", "Trinity.");
r(1, "Council of Chalcedon", "RO", 451, undefined, false, EXT, 37, "Nicaea 325, Constantinople 381, Chalcedon 451", "Falls after the Roman era's nominal 1st-4th c. range; dated by the document itself.");
r(1, "Christians ~10% of the empire", "RO", 300, undefined, true, EXT, 37, "perhaps ~10% of the empire by 300", "From a tiny sect to a notable minority.");
r(1, "Logos Christology / Christ as fusion figure", "RO", null, null, true, EXT, 37, "**Christ** - the fusion of king, Son of Man, Wisdom/Logos, and pre-existent messiah.", "Mediator column.");
// Commagene (38) [EXTENSION - cross-ref IN SOURCE]
r(1, "Nomos of Antiochus: Mithra = Apollo-Helios-Hermes", "CO", -62, undefined, true, EXT, 38, "**Nomos** (~62 BCE) equates **Mithra = Apollo-Helios-Hermes**", "Iranian-Greek divine fusion in official ideology.");
r(1, "Nemrud lion horoscope", "CO", -62, undefined, true, EXT, 38, "**lion horoscope** at Nemrud dated astronomically to **~7 July 62 BCE**", "Royal astral cult; epoch marker. Given as a specific day, with '~'.");
// Late antiquity (39) [EXTENSION]
r(1, "Antonine and Cyprianic plagues", "LA", null, null, true, EXT, 39, "Antonine & Cyprianic plagues", "Material context of Late Antiquity.");
r(1, "Fall of the Western Roman Empire", "LA", 476, undefined, false, EXT, 39, "Western Rome falls (476)", "Christianization of the Mediterranean.");
r(1, "Synagogue and Torah-study Judaism", "LA", null, null, true, EXT, 39, "Sacrifice ends -> **synagogue + Torah-study** Judaism.", "Imageless, transcendent God met through study and law.");
r(1, "Shekhinah develops", "LA", null, null, true, EXT, 39, "**Shekhinah** (indwelling presence) develops; \"two powers\" policed as heresy.", "Rabbinic counter-pole of immanence.");
r(1, "Augustine: original sin and predestination", "LA", null, null, true, EXT, 39, "Augustine - **original sin**, predestination, the two cities", "Cosmos and afterlife column; purgatory formalized later.");
r(1, "Mishnah", "LA", 200, undefined, true, EXT, 95, "Mishnah c. 200", "Rabbinic compilation named in the reception-history section.");
r(1, "Talmuds", "LA", 400, 600, true, EXT, 95, "Talmuds c. 400-600", "Rabbinic compilations named in the reception-history section.");
// Islam (40) [EXTENSION]
r(1, "Muhammad and the Qur'an", "IS", null, null, true, EXT, 40, "**Muhammad** (the \"seal\"); the **Qur'an** as the divine Word", "Mediator column; Jesus revered as prophet, not divine.");
r(1, "Tawhid", "IS", null, null, true, EXT, 40, "**Allah** - rigorous **tawhid** (unity), aniconic, transcendent", "Document places Islam at 7th c. (line 101).");
r(1, "Arab conquests of Byzantium and Sasanian Persia", "IS", null, null, true, EXT, 40, "conquest of plague-exhausted Byzantium & Sasanian Persia", "Umayyad/Abbasid empire.");
r(1, "Baghdad and the translation movement", "IS", null, null, true, EXT, 40, "Baghdad a world center; **translation movement** preserves Greek thought.", "Material context.");
// Medieval (41) [EXTENSION]
r(1, "Purgatory formalized", "MD", 1274, undefined, false, EXT, 41, "purgatory formalized (1274)", "Cosmos and afterlife column.");
r(1, "Ibn Arabi dies", "MD", 1240, undefined, false, EXT, 41, "Sufi ***wahdat al-wujud*** (Ibn Arabi d. 1240)", "Wahdat al-wujud as part of the apophatic/nondual turn.");
r(1, "Zohar", "MD", 1280, 1289, true, EXT, 41, "Zohar c. 1280s", "Kabbalah's Ein Sof + Sefirot + Shekhinah.");
r(1, "Dante's hells and heavens", "MD", 1320, undefined, true, EXT, 41, "**Dante**, c. 1320", "Elaborated hells and heavens; demonic hierarchies.");
r(1, "Eckhart dies", "MD", 1328, undefined, false, EXT, 41, "Christian **Godhead-beyond-God** (Eckhart d. 1328)", "Christian apophatic strand, with Cusa's coincidence of opposites.");
r(1, "Black Death", "MD", 1347, 1351, false, EXT, 41, "**Black Death** (1347-51, ~30-60% of Europe", "World ~430 to 350 M.");
r(1, "Scholasticism and Aquinas", "MD", null, null, true, EXT, 41, "Scholasticism (Aquinas); universities.", "Knowledge hubs.");
// Reformation (42) [EXTENSION]
r(1, "Printing press", "RF", 1450, undefined, true, EXT, 42, "**Printing press** (c. 1450)", "Democratizes scripture.");
r(1, "Reformation begins", "RF", 1517, undefined, false, EXT, 42, "**Reformation** (1517)", "Confessional fragmentation and wars of religion.");
r(1, "Witch-hunt peak", "RF", 1560, 1660, true, EXT, 42, "**Witch-hunt peak** (~1560-1660)", "Matches Table 2 'Satan at his cultural maximum'.");
r(1, "Columbian exchange", "RF", null, null, true, EXT, 42, "the **Columbian exchange** (~90% indigenous American death from disease", "Religion exported by conquest.");
r(1, "Spinoza: Deus sive Natura", "RF", 1677, undefined, false, EXT, 42, "**Spinoza** (d. 1677) - ***Deus sive Natura***", "Excommunicated; a European immanent/nondual rupture. Dated at his death.");
r(1, "Three-tier cosmos breaks (Copernicus to Newton)", "RF", null, null, true, EXT, 42, "the **three-tier cosmos finally breaks** (Copernicus -> Galileo -> Newton)", "Cosmos column.");
// Enlightenment (43) [EXTENSION]
r(1, "World population reaches 1 billion", "EN", 1804, undefined, false, EXT, 43, "World **1 B (1804) -> 1.6 B (1900)**", "Material context.");
r(1, "Wellhausen and higher criticism", "EN", null, null, true, EXT, 43, "Higher criticism (**Wellhausen**) - the scholarship that produced this very timeline.", "Scholarly context.");
r(1, "Deism", "EN", null, null, true, EXT, 43, "**Deism** (non-intervening \"clockmaker\")", "Kant/Hume critiques.");
r(1, "Hegel's Geist", "EN", null, null, true, EXT, 43, "**Hegel's** God as unfolding **Spirit (Geist)**", "Immanent, historical God.");
r(1, "Emerson's Over-Soul", "EN", null, null, true, EXT, 43, "Transcendentalism's **Over-Soul** (Emerson, reading imported Vedanta)", "Early East-West contact in the West.");
// 20th (44) [EXTENSION]
r(1, "Vivekananda at the Parliament of Religions (1893)", "M20", 1893, undefined, false, EXT, 44, "Vivekananda 1893", "Vedanta arrives in the West. Falls before the era's nominal 1900 start; dated by the document.");
r(1, "Yogananda 1920: Kriya Yoga to the West", "M20", 1920, undefined, false, EXT, 44, "**Yogananda 1920** -> Kriya Yoga to the West", "East-West encounter.");
r(1, "Huxley, The Perennial Philosophy", "M20", 1945, undefined, false, EXT, 44, "Huxley's *Perennial Philosophy* 1945", "Perennialism in print.");
r(1, "Death of God theology", "M20", 1960, 1969, true, EXT, 44, "\"**Death of God**\" theology (1960s)", "Concept of God column.");
r(1, "Tillich: Ground of Being", "M20", null, null, true, EXT, 44, "**\"Ground of Being\"** (Tillich)", "Concept of God column.");
r(1, "Process theology (Whitehead, Hartshorne)", "M20", null, null, true, EXT, 44, "**process / dipolar** God evolving with the world (Whitehead, Hartshorne - panentheism)", "Concept of God column.");
r(1, "Teilhard: Cosmic Christ / Omega Point", "M20", null, null, true, EXT, 44, "**Cosmic Christ / Omega Point** (Teilhard)", "Christ as cosmic/evolutionary principle.");
// New Age (45) [EXTENSION / INTERPRETIVE] -> weakest = INTERPRETIVE
r(1, "World population reaches 8 billion", "NA", 2023, undefined, true, INT, 45, "World **3.6 -> 8 B+** (2023)", "Material context.");
r(1, "Rise of the nones", "NA", null, null, true, INT, 45, "rise of the **\"nones\"** and \"spiritual-but-not-religious\"", "Commodified spirituality; internet-era syncretism.");
r(1, "Christ Consciousness as universal state", "NA", null, null, true, INT, 45, "**\"Christ Consciousness\"** = a *universal* divine state, not Jesus alone.", "Concept of God column; perennialist reading.");
r(1, "Tolle: presence", "NA", null, null, true, INT, 45, "\"**presence**\" (Tolle)", "Mediator column: the Self / awareness itself.");

// ===================================================================== TABLE 2 =====================================
r(2, "Malevolent spirits and sorcery", "P", null, null, true, EXT, 55, "Malevolent **spirits**, sorcery, illness-causing entities; no single cosmic evil.", "Evil is local and personal, not metaphysical. Anchoring source: Eliade, Shamanism.");
r(2, "Lamashtu, Pazuzu, utukku", "B", null, null, true, EXT, 56, "**Named demons** (Lamashtu, Pazuzu, *utukku*)", "Named Mesopotamian demons; anchoring source: Mesopotamian incantations.");
r(2, "Apophis and Tiamat as chaos-prototypes", "B", null, null, true, EXT, 56, "Egypt's **Apophis** (serpent attacking Ra nightly) and Mesopotamia's **Tiamat**", "The first 'cosmic adversary' figures, though not rivals to a single good God. Sources: Enuma Elish; Apophis ritual.");
r(2, "No devil: evil from Yahweh (Isa 45:7)", "I2", null, null, true, IS_, 57, "\"I form light and create darkness... I make weal and create woe\" (Isa 45:7)", "Ha-satan not yet a personal enemy. Document's row is 'First-Temple Israel'.");
r(2, "Satan splits off: 1 Chr 21:1 rewrites 2 Sam 24:1", "PE", null, null, true, IS_, 58, "the \"**satan**\" function **splits off** into an independent agent (1 Chr 21:1 rewriting 2 Sam 24:1, where *Yahweh* once incited David)", "Persian impetus is tagged [MAJORITY/DEBATED] in the cell.");
r(2, "Zoroastrian dualism as template", "PE", null, null, true, INT, 58, "**Zoroastrian dualism** (Ahura Mazda vs. **Angra Mainyu / Ahriman**) supplies a template", "Document marks the Persian impetus [MAJORITY/DEBATED]; kept as the weaker, interpretive grade here.");
r(2, "Job 1-2 and Zechariah 3 (satan as agent)", "PE", null, null, true, IS_, 58, "1 Chr 21:1; Job 1-2; Zechariah 3", "Anchoring sources for the Persian-period satan.");
r(2, "Watchers (1 Enoch) and demons from giants", "HE", null, null, true, IS_, 59, "the **Watchers** fall and beget giants whose spirits become **demons** (*1 Enoch*)", "Full demonology blooms.");
r(2, "Belial / Mastema and cosmic war (Jubilees, Scrolls)", "HE", null, null, true, IS_, 59, "Satan becomes **Belial / Mastema**, prince of darkness, leader in a **cosmic war** (Jubilees, the Scrolls).", "Sources: Jubilees; Qumran War Scroll.");
r(2, "Satan as ruler of this world; exorcism central", "RO", null, null, true, EXT, 60, "Satan is \"**the ruler of this world**,\" tempter and accuser; **demons** are everywhere and **exorcism** is central to Jesus' ministry", "Sources: Gospels. Mapped to the Roman era.");
r(2, "Dragon of Revelation 12", "RO", 95, undefined, true, EXT, 60, "the **dragon of Revelation**", "Date taken from the document's Revelation c. 95 (line 37).");
r(2, "Augustine: Satan as fallen angel, privatio boni", "LA", null, null, true, EXT, 61, "Satan a **fallen angel** (pride); evil as ***privatio boni***", "Source: Augustine, City of God.");
r(2, "Desert monasticism: Anthony's demon-combat", "LA", null, null, true, EXT, 61, "the demon-combat of **desert monasticism** (Anthony)", "Source: Athanasius, Life of Anthony.");
r(2, "Rabbinic downgrading of Satan: yetzer ha-ra, Samael", "LA", null, null, true, EXT, 62, "folded into the ***yetzer ha-ra*** (the evil inclination *within*), or **Samael**", "Firmly non-dualist; sources: Talmud, midrash.");
r(2, "Iblis / Shaytan and the jinn", "IS", null, null, true, EXT, 63, "**Iblis / Shaytan** refuses to bow to Adam (pride)... **Jinn** as a created order of beings.", "Wholly under God's sovereignty; source: Qur'an (Q 2, 7, 15).");
r(2, "Ranked demon hierarchies, Dante's Inferno", "MD", null, null, true, EXT, 64, "ranked demon hierarchies, the geography of Hell (**Dante**), demonic pacts", "Maximal elaboration; scholastic demonology (Aquinas).");
r(2, "Malleus Maleficarum", "RF", 1487, undefined, false, EXT, 65, "*Malleus Maleficarum* 1487", "Part of Satan's 'cultural maximum'.");
r(2, "Witch-hunts and Satan's cultural maximum", "RF", 1560, 1660, true, EXT, 65, "the **witch-hunts** (... peak ~1560-1660) - then a sharp **waning**.", "Source: trial records.");
r(2, "Milton's sympathetic Satan", "EN", 1667, undefined, false, EXT, 66, "Milton's *sympathetic* Satan (1667)", "Source: Paradise Lost.");
r(2, "Romantic rebel Satan (Blake, Shelley)", "EN", null, null, true, EXT, 66, "the **Romantic rebel** (Blake, Shelley)", "Demythologization: Satan as symbol or psychology.");
r(2, "Jung: Satan as shadow archetype", "M20", null, null, true, EXT, 67, "**Jung** - Satan as the **shadow** archetype", "Source: Jung, Answer to Job. Row tagged [EXTENSION / INTERPRETIVE]; the dated claim is EXTENSION.");
r(2, "LaVeyan Satanism", "M20", 1966, undefined, false, EXT, 67, "**LaVeyan Satanism** (1966) makes \"Satan\" a *symbol* of nature/self, not a deity.", "Source: LaVey, Satanic Bible.");
r(2, "Evil dissolved in the nondual frame", "NA", null, null, true, INT, 67, "\"evil\" collapses entirely into **separation, ego, illusion, or lower consciousness**", "No cosmic adversary, only un-awareness.");

// ===================================================================== TABLE 3 =====================================
r(3, "Philo's Logos and the One beyond being", "HE", null, null, true, IS_, 80, "**Philo's Logos** and Middle-Platonic \"**the One beyond being**\"", "Source: Philo of Alexandria. Philo is not dated in the document; mapped to the Hellenistic era.");
r(3, "Plotinus: the One and emanation", "RO", null, null, true, EXT, 81, "**Plotinus** - **the One**, ineffable, beyond being", "Master-template for all three Abrahamic mysticisms; sources: Enneads, Pseudo-Dionysius. Not dated in the document; mapped to the Roman era.");
r(3, "Kabbalah: Ein Sof and the Sefirot", "MD", null, null, true, EXT, 82, "**Ein Sof** - the **Infinite**, utterly unknowable - emanates through the **Sefirot**", "Source: Zohar (c. 1280s).");
r(3, "Hasidism: no place devoid of Him", "MD", null, null, true, EXT, 82, "\"there is no place devoid of Him\" (panentheism)", "Source: Baal Shem Tov. Not dated in the document; the Medieval era range is used (the Hasidic period is later, which the document does not state).");
r(3, "Sufism: wahdat al-wujud, fana, al-Hallaj", "MD", null, null, true, EXT, 83, "***Wahdat al-wujud*** - the **oneness of being**; **fana**... al-Hallaj's \"**I am the Truth**.\"", "Sources: Ibn Arabi (d. 1240); Rumi.");
r(3, "Eckhart's Godhead (Grunt) and Cusa", "MD", null, null, true, EXT, 84, "**Eckhart's Godhead** (*Grunt*) beyond the personal \"God\"; **Cusa's** coincidence of opposites", "Eckhart d. 1328.");
r(3, "Rohr's Universal Christ", "NA", null, null, true, EXT, 84, "**Rohr's \"Universal Christ.\"**", "Row also lists Tillich's Ground of Being.");
r(3, "Spinoza, Hegel, Whitehead: God as immanent", "EN", null, null, true, EXT, 85, "**Spinoza** (*Deus sive Natura*); **Hegel** (Absolute Spirit); **process/panentheism** (Whitehead)", "Spans Early Modern to 20th c. in other rows; Enlightenment era range used for the grouped node.");
r(3, "Vivekananda 1893 and Vedanta import", "M20", 1893, undefined, false, EXT, 86, "**Vedanta** (Brahman = Atman) imported via **Vivekananda** (1893)", "East-West fusion; row also tagged [INTERPRETIVE] for the perennialist element.");
r(3, "Huxley's Perennial Philosophy", "M20", 1945, undefined, false, INT, 86, "**Huxley's Perennial Philosophy** (1945) - *all* mysticisms point to one Reality.", "Sources: Vivekananda; Emerson; Huxley; Schuon. The perennialist claim is the interpretive part.");
r(3, "A Course in Miracles", "NA", 1976, undefined, false, INT, 87, "*A Course in Miracles* (1976)", "New Age mainstream node: Christ Consciousness, Neo-Advaita (Tolle), Integral stages (Wilber), Keating, Bourgeault.");
r(3, "Neo-Advaita, Integral, contemplative Christianity", "NA", null, null, true, INT, 87, "**Neo-Advaita** \"presence\" (Tolle); **Integral** stages (Wilber); nondual contemplative Christianity (Keating, Bourgeault).", "The personal God becomes one face of a formless Absolute.");
r(3, "Perennialists vs constructivists (Katz)", "NA", null, null, true, INT, 113, "**Constructivists** (notably Steven Katz) argue that mystical experience is *shaped* by the tradition", "From the closing 'universalizing turn' section; complicates the perennialist equation (Huxley, Schuon, Huston Smith, Wilber).");

// ===================================================================== LINKS ======================================
// era -> contained row (contains); consecutive eras chained with preceded_by (chronological, Commagene sits between
// Hellenistic and Roman rather than at its line position).
export const LINKS = [];
for (const row of ROWS) LINKS.push({ from: row.eraId, to: row.id, type: "contains" });
const ORDER = ["P", "N", "B", "I1", "I2", "EX", "PE", "HE", "CO", "RO", "LA", "IS", "MD", "RF", "EN", "M20", "NA"];
for (let i = 1; i < ORDER.length; i++) LINKS.push({ from: ERAS[ORDER[i]].id, to: ERAS[ORDER[i - 1]].id, type: "preceded_by" });

// Self-check on import
{
  const ids = ROWS.map((x) => x.id);
  const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (dup.length) throw new Error("duplicate ids: " + [...new Set(dup)].join(", "));
}

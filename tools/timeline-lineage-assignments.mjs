// Lineage-chart assignments for Sacred-Lineage masters that have no master_lineages row.
// Consumed by tools/build-timeline-data.mjs (timeline item id = `sl-m${masterId}`).
// Evidence kinds in `basis`:
//   "seed tag <key>"  - the master's own overview carries a [lineage-seed:<tradition>:<slug>] tag that names the chart
//   "same person as charted <name>" - duplicate of a master already on the chart
//   source URL        - Wikipedia / Lotsawa House / Treasury of Lives
// NOTE: the db's relationships rows for the lotsawa/rigpa imports are unreliable (they all point at
// lineage_id 3, "Zen Dharma Transmission", which holds Tibetan figures), so they are not used as evidence.
// Several lotsawa/rigpa masters also carry a wrong name or birth/death years; identity here follows the overview text.

const LS = "https://www.lotsawahouse.org/tibetan-masters/";
const WZ = "https://en.wikipedia.org/wiki/Zen_lineage_charts";
const seed = (k) => `seed tag lineage-seed:${k}`;

export const ASSIGNMENTS = [
  // --- Zen / Chan
  { masterId: 19, name: "Shakyamuni Buddha", lane: "Zen Dharma Transmission", basis: WZ, confidence: "medium" },
  { masterId: 27, name: "Bodhidharma", lane: "Zen Dharma Transmission", basis: seed("buddhism:bodhidharma") + "; " + WZ, confidence: "high" },
  { masterId: 29, name: "Huike", lane: "Zen Dharma Transmission", basis: seed("zen-buddhism:huike"), confidence: "high" },
  { masterId: 33, name: "Huineng", lane: "Zen Dharma Transmission", basis: seed("zen-buddhism:huineng"), alsoIn: ["Rinzai Lineage", "Soto Lineage"], confidence: "high" },
  { masterId: 38, name: "Linji Yixuan", lane: "Rinzai Lineage", basis: seed("zen-buddhism:linji-yixuan") + " (duplicate of charted Linji Yixuan)", confidence: "high" },
  { masterId: 39, name: "Dongshan Liangjie", lane: "Soto Lineage", basis: seed("zen-buddhism:dongshan-liangjie") + " (duplicate of charted Dongshan Liangjie)", confidence: "high" },
  { masterId: 24, name: "Nagarjuna", lane: "Zen Dharma Transmission", basis: "same person as charted Nagarjuna (14th Indian patriarch); " + WZ, alsoIn: ["Indian Buddhist Masters"], confidence: "medium" },
  { masterId: 26, name: "Vasubandhu", lane: "Zen Dharma Transmission", basis: "same person as charted Vasubandhu (21st Indian patriarch); " + WZ, alsoIn: ["Indian Buddhist Masters"], confidence: "medium" },
  // --- Indian Buddhist scholars (new lane)
  { masterId: 25, name: "Asanga", lane: "Indian Buddhist Masters", newLane: true, basis: LS + "asanga", confidence: "medium" },
  { masterId: 1079, name: "Śāntarakṣita", lane: "Indian Buddhist Masters", newLane: true, basis: LS + "shantarakshita (overview: 8th-century abbot of Samye; db years 1933-2004 are wrong)", confidence: "medium" },
  { masterId: 1134, name: "Dharmakirti of Suvarnadvipa", lane: "Indian Buddhist Masters", newLane: true, basis: LS + "dharmakirti (overview: Indian philosopher Dharmakīrti; db name and years 1862-1943 are wrong)", confidence: "low" },
  { masterId: 1137, name: "Kamalaśīla", lane: "Indian Buddhist Masters", newLane: true, basis: LS + "kamalashila", confidence: "medium" },
  // --- Christianity
  ...[[89, "Jesus of Nazareth", "jesus"], [97, "Anthony the Great", "anthony"], [98, "Pachomius", "pachomius"], [99, "Basil the Great", "basil"], [100, "Benedict of Nursia", "benedict"], [101, "Gregory the Great", "gregory"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Christian Monastic Succession", newLane: true, basis: seed("christianity:" + k), confidence: "medium" })),
  // --- Judaism
  ...[[105, "Hillel the Elder", "hillel"], [107, "Yohanan ben Zakkai", "yohanan"], [108, "Rabbi Akiva", "akiva"], [109, "Judah ha-Nasi", "judah-nasi"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Rabbinic Chain of Transmission", newLane: true, basis: seed("judaism:" + k), confidence: "medium" })),
  ...[[110, "Baal Shem Tov", "besht"], [111, "Dov Ber (Maggid of Mezeritch)", "maggid"], [112, "Schneur Zalman of Liadi", "schneur-zalman"], [113, "Levi Yitzchok of Berditchev", "levi-yitzchok"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Hasidic Dynasties", newLane: true, basis: seed("judaism:" + k), confidence: "medium" })),
  // --- Hindu acharyas
  ...[[115, "Adi Shankara", "shankara"], [118, "Ramanuja", "ramanuja"], [119, "Madhva", "madhva"], [121, "Chaitanya Mahaprabhu", "chaitanya"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Vedanta Acharya Lineages", newLane: true, basis: seed("hinduism:" + k), confidence: "medium" })),
  // --- Islam
  ...[[124, "Muhammad", "muhammad"], [125, "Ali ibn Abi Talib", "ali"], [126, "Hasan al-Basri", "hasan-basri"], [127, "Junayd al-Baghdadi", "junayd"], [128, "Abdul-Qadir Gilani", "gilani"], [129, "Moinuddin Chishti", "chishti"], [131, "Jalaluddin Rumi", "rumi"], [132, "Baha ad-Din Naqshband", "naqshband"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Sufi Silsila", newLane: true, basis: seed("islam:" + k), confidence: "medium" })),
  // --- Ramakrishna
  ...[[134, "Ramakrishna", "ramakrishna"], [135, "Swami Vivekananda", "vivekananda"], [136, "Sarada Devi", "sarada-devi"], [137, "Sister Nivedita", "nivedita"], [138, "Swami Brahmananda", "brahmananda"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Ramakrishna Lineage", basis: seed("modern-spiritual:" + k) + " (duplicate of charted master)", confidence: "high" })),
  // --- New Thought
  ...[[142, "Phineas Quimby", "quimby"], [143, "Mary Baker Eddy", "eddy"], [144, "Emma Curtis Hopkins", "hopkins"], [145, "Charles Fillmore", "charles-fillmore"], [146, "Myrtle Fillmore", "myrtle-fillmore"], [147, "Ernest Holmes", "holmes"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "New Thought Lineage", newLane: true, basis: seed("new-thought:" + k), confidence: "high" })),
  // --- Kriya Yoga
  ...[[182, "Panchanan Bhattacharya", "panchanan"], [183, "Swami Pranabananda", "pranabananda"], [185, "Swami Kebalananda", "kebalananda"], [186, "Swami Hariharananda Giri", "hariharananda"], [187, "Swami Satyananda Giri", "satyananda"]]
    .map(([masterId, name, k]) => ({ masterId, name, lane: "Kriya Yoga Lineage", basis: seed("kriya-yoga-lineage:" + k), confidence: "high" })),
  // --- Tibetan lineage-seed tagged
  { masterId: 484, name: "Mokchok Rinchen Tsondrü", lane: "Shangpa Kagyu Lineage", basis: seed("kagyu-lineage:mokchok-rinchen-tsondru") + "; overview: principal successor of Khyungpo Naljor (charted in Shangpa Kagyu)", alsoIn: ["Marpa Kagyu Lineage"], confidence: "high" },
  { masterId: 493, name: "Dagchen Rinpoche (H.H. lineage)", lane: "Sakya Lineage", basis: seed("sakya-lineage:dagchen-rinpoche-line"), confidence: "high" },
  { masterId: 503, name: "Lama Zopa Rinpoche", lane: "Gelug Lineage", basis: seed("gelug-lineage:lama-zopa-rinpoche"), confidence: "high" },
  { masterId: 516, name: "Yongdzin Lopon Tenzin Namdak", lane: "Bön Lineage", basis: seed("bon-lineage:yongdzin-lopon-tenzin-namdak"), confidence: "high" },
  { masterId: 517, name: "Menri Trizin (33rd)", lane: "Bön Lineage", basis: seed("bon-lineage:menri-trizin"), confidence: "high" },
  { masterId: 749, name: "Marpa Lotsāwa", lane: "Marpa Kagyu Lineage", basis: seed("kagyu-lineage:marpa-chokyi-lodro") + " (duplicate of charted Marpa Chökyi Lodrö)", confidence: "high" },
  { masterId: 757, name: "Tulku Pema Dorje", lane: "Marpa Kagyu Lineage", basis: seed("kagyu-lineage:lingrepa-pema-dorje") + "; overview: student of Pakmodrupa, teacher of Tsangpa Gyare (Drukpa Kagyu)", confidence: "high" },
  // --- Tibetan lotsawa/rigpa imports (identity per overview text)
  { masterId: 1049, name: "Adzom Gyalse Gyurme Dorje", lane: "Nyingma Dzogchen Lineage", basis: LS + "adzom-gyalse-gyurme-dorje (Adzom Drukpa family, Nyingma)", confidence: "medium" },
  { masterId: 1051, name: "Drakkar Lobzang Palden", lane: "Gelug Lineage", basis: LS + "drakkar-lobzang-palden (fetched: described as a Gelugpa geshe)", confidence: "medium" },
  { masterId: 1053, name: "Chatral Rinpoche", lane: "Nyingma Dzogchen Lineage", basis: LS + "chatral-rinpoche (overview: great Dzogchen master)", confidence: "high" },
  { masterId: 1060, name: "Tertön Sogyal Biography", lane: "Nyingma Dzogchen Lineage", basis: "rigpa-wiki Tertön Sogyal (Nyingma treasure-revealer, Dzogchen); db name is a mislabel", confidence: "high" },
  { masterId: 1061, name: "Dzagyal Khenpo Bumthar", lane: "Nyingma Dzogchen Lineage", basis: LS + "dzagyal-khenpo-bumthar (Dzagyal Monastery, Nyingma)", confidence: "medium" },
  { masterId: 1062, name: "Dzogchen Pema Rigdzin", lane: "Nyingma Dzogchen Lineage", basis: LS + "dzogchen-rinpoche (first Dzogchen Rinpoche, Dzogchen Monastery)", confidence: "high" },
  { masterId: 1065, name: "Gatön Ngawang Lekpa", lane: "Sakya Lineage", basis: LS + "gaton-ngawang-lekpa (overview: Sakya lama, foremost Lamdré master)", alsoIn: ["Lamdre Lineage"], confidence: "high" },
  { masterId: 1071, name: "Gyalwa Phakpa Lha", lane: "Marpa Kagyu Lineage", basis: LS + "gyalwa-yangonpa (overview: Drukpa Kagyü adept Yangönpa; db name is a mislabel)", confidence: "high" },
  { masterId: 1082, name: "Longsal Nyingpo", lane: "Nyingma Dzogchen Lineage", basis: LS + "longsal-nyingpo (Nyingma tertön)", confidence: "high" },
  { masterId: 1088, name: "Minling Terchen Gyurme Dorje", lane: "Nyingma Dzogchen Lineage", basis: LS + "minling-terchen (overview: founder of Mindrolling, Nyingma)", confidence: "high" },
  { masterId: 1094, name: "Trulshik Wangdrak Gyatso", lane: "Nyingma Dzogchen Lineage", basis: LS + "trulshik-rinpoche (Nyingma, Dilgo Khyentse's disciple)", confidence: "medium" },
  { masterId: 1098, name: "Rago Choktrul Tupten Shedrup Gyatso", lane: "Nyingma Dzogchen Lineage", basis: "masters.overview: prolific author of the Palyul tradition (Nyingma)", confidence: "medium" },
  { masterId: 1102, name: "Rongtön Sheja Kunrig", lane: "Sakya Lineage", basis: LS + "rongton (Sakya scholar, Sakya Pandita's line)", confidence: "high" },
  { masterId: 1103, name: "Sangye Lingpa", lane: "Nyingma Dzogchen Lineage", basis: LS + "sangye-lingpa (Nyingma tertön)", confidence: "high" },
  { masterId: 1111, name: "Tashi Tobgyal", lane: "Nyingma Dzogchen Lineage", basis: "masters.overview: figure in the Northern Treasures lineage (Nyingma)", confidence: "medium" },
  { masterId: 1112, name: "Thinley Norbu Rinpoche", lane: "Nyingma Dzogchen Lineage", basis: LS + "thinley-norbu-rinpoche (overview: son of Dudjom Rinpoche, Nyingma)", confidence: "high" },
  { masterId: 1116, name: "Tsasum Lingpa", lane: "Nyingma Dzogchen Lineage", basis: LS + "tsasum-terdak-lingpa (Nyingma tertön)", confidence: "medium" },
  { masterId: 1126, name: "Yukhok Chatralwa Chöying Rangdrol", lane: "Nyingma Dzogchen Lineage", basis: LS + "yukhok-chatralwa (Nyingma Dzogchen yogin)", confidence: "high" },
];

export const UNRESOLVED = [
  { masterId: 1050, name: "Gendün Drup", reason: "Content is Gendün Chöpel (1903-1951), an independent intellectual trained at Drepung; no cited transmission lineage. Db name and slug conflate two people." },
];

export const NEW_LANES = [...new Set(ASSIGNMENTS.filter((a) => a.newLane).map((a) => a.lane))];

# Timeline gap register

Recorded 2026-11-05 after the first gap-fill pass (186 curated rows in `tools/timeline-gapfill.mjs`, group "World context").
Nothing below has been filled yet. Status: `open` | `in progress` | `done`.

Measured on `apps/web/public/timeline/timeline.json` (1,833 items). Years are astronomical.

## Progress

**Pass 2 (2026-11-05), 192 more rows, World context now 378.** Done: all A1 windows (2900–2250 BCE, 1750–1500 BCE, 250 BCE–1 CE, 250–500 CE, 1959–2025, a small Future set to 2084). Partly done in A2: Pantheons Egyptian, Mesopotamian, Greek, Hindu, Islam, Christian, Canaanite, Anatolian, Urartian, Scythian, Tocharian, Mandaean, Aztec, Norse, Baltic, Celtic, Māori, Ojibwe and Baháʼí now have later or extra entries; new lineage lanes for Hasidic/Kabbalistic, Christian contemplative, Sufi, Advaita, Daoist, Theravāda, Korean Seon and Vietnamese Thiền. Still open: everything in A3, sections B and C, Evolution of God coverage, the 80 unassigned figures, and depth in the Inca, Kongo, Zulu, Bakuba, Sikh and Central Asian Pantheons lanes.
Rows were written from memory and have not been checked against sources.

**A3 pass (2026-11-05).** Done: Bardiya lanes folded from about 35 to 6 (original place kept as region); regions backfilled from lane defaults (1,915 of 2,000 items now have one; shared logic in `tools/timeline-normalize.mjs`); 25 World context rows that duplicated existing items were dropped; 4 teacher/lineage links added for the new lineage lanes. Not done: edges for Civilisations, Bardiya, Evolution of God (no source data to link them without inventing), per-row citations beyond the file name, and the other seeds (Pantheons, Lineages, Civilisations) still need `pnpm db:seed:timeline` to pick up region backfill in the database.

## A. Main timeline (`timeline.json`, `/kosmo/timeline`)

### A1. Thin eras (items per 250-year window)

| Window | Items | Status | What is missing |
|---|---|---|---|
| 3000–2500 BCE | 4 | open | Early Dynastic Sumer, Old Kingdom Egypt rise, Indus Valley (Harappan) urbanism, early Chinese Neolithic cultures (Liangzhu, Longshan) |
| 2750–2250 BCE | 0 / 0 | open | Sargon of Akkad, Giza pyramids, Ebla, Minoan Crete start, Corded Ware / Indo-European expansion |
| 1750–1500 BCE | 10 | open | Minoan palaces, Hyksos, Shang dynasty rise, Vedic composition, Babylon fall (1595 BCE), Thera eruption |
| 250 BCE–1 CE | 33 | open | Han dynasty founding, Maurya successors, Parthia, Roman Republic late period, Hellenistic religion (Isis, Mithras cults) |
| 250–500 CE | 31 | open | Constantine to Fall of Rome, Gupta rise, Sasanian Persia, Three Kingdoms to Jin China, Kofun Japan, Early Christian monasticism, Augustine, Jerome |
| 1970–2026 | 2 / 0 / 0 / 8 / 4 / 4 | open | Nothing in the 1980s or 1990s, only a handful in 2000+. Needs: 1979 Iranian Revolution, 1989 fall of Berlin Wall, Internet and WWW, 1990s new religious movements, Dalai Lama exile era, Tibetan diaspora, Western dharma centres, 2010s secularization data points |
| Future (2027+) | 0 | open | Scheduled or forecast events: 2030 SDG deadline, 2050 climate targets, population peak estimates |

### A2. Lanes and regions with almost nothing

| Lane / region | Items | Status | Notes |
|---|---|---|---|
| Civilisations: Africa | 4 + 13 new | partial | Still thin: Egypt vs Nubia vs Ethiopia; Berber/Maghreb, Yoruba/Ife, Bantu expansion (c. 1000 BCE–1000 CE), Ethiopian Orthodoxy |
| Civilisations: Americas | 5 + 13 new | partial | Missing: North America (Haudenosaunee, Plains cultures), Amazonia, Mississippian religion, Andean pre-Inca (Wari, Chimú) |
| Civilisations: Central Asia | 3 + 4 new | partial | Missing: Sogdian trade, Bactria/Greco-Bactrian, Hephthalites, Khazars, Uyghur Khaganate |
| Oceania | 5 new | partial | Missing: Aboriginal Australian traditions, Melanesian cargo cults, Lapita to Polynesia details |
| Southeast Asia | 8 new | partial | Missing: Philippines, Vietnam Buddhism, Champa |
| Pantheons: Germanic, Mandaean, Canaanite, Tocharian, Urartian, Phrygian, Scythian | 1–4 each | open | One date range each; need more deities and period markers |
| Pantheons: Inca, Aztec, Māori, Kongo, Zulu, Ojibwe, Bakuba, Central Asian | 1–2 each | open | Only a single deity each; no Mesoamerican (Maya, Olmec), Polynesian, Yoruba, Akan, Aboriginal, Native North American traditions |
| Pantheons: Egyptian, Mesopotamian end dates | end -1349 / -1199 | open | Lanes stop at the New Kingdom and Late Bronze Age; no later periods (Ptolemaic, Neo-Assyrian gods) |
| Pantheons: Greek end date | -299 | open | Nothing for Hellenistic or Roman-era Greek religion |
| Pantheons: Hindu | 15 | open | Ends -499; no epic or Puranic deities (Vishnu avatars, Shakta tradition) |
| Pantheons: Islam | 8, all at 610 | open | One year only; no later developments (Sufi orders, Shia, Ismaili) |
| Pantheons: Christian | 8 | open | Ends 400; no Orthodox, Catholic or Protestant developments |
| Lineages: Jewish, Christian, Sufi, Advaita, Daoist, Hindu Bhakti | 0 | open | The Lineages group is entirely Buddhist, Hindu-yoga and Zen/Tibetan; no non-Asian-Buddhist transmission chains |
| Lineages: Rinzai / Soto / Ramana | 3–4 each | partial | Thin despite being major schools |
| Lineages: "Unassigned lineage" | 80 | open | 80 figures with no lineage chart; need assigning |
| Lineages: Theravāda, Chan (China), Korean Seon, Vietnamese Thiền | 0–2 | open | Missing as lanes |
| Evolution of God: coverage | 17 | open | Only era-level rows; 3 tables, many cells not yet parsed (`skipped:master-timeline`) |
| Traditions lane | 12 | open | Founding dates only for 12 traditions |

### A3. Structure and data quality

| Issue | Status | Notes |
|---|---|---|
| Bardiya & Achaemenid has ~35 single-item lanes | open | Lanes named by place or tribe (e.g. "Arachosia", "Gandutava"); should collapse to a few lanes |
| 1,377 of 1,833 items have no region | open | Hurts map and filter views |
| Edges missing for 223 Lineages and 58 Pantheons items, and for every Civilisations, Bardiya, Evolution of God and World context item | open | Branches view is empty for these groups |
| Duplicate-looking names across groups (e.g. Mahāyāna deities vs lineage figures) | open | Not checked |
| No sources on most curated rows beyond file name | open | Add citations or confidence grades |
| Lane name drift (`Middle East` vs `Mesopotamian` vs `Levantine`) | open | Same region split across naming schemes |

## B. Oracle timeline (`oracle/timeline-data.js`, computation and AI)

| Gap | Status |
|---|---|
| 1614–1837: no Pascal (1642), Leibniz stepped reckoner (1673), Jacquard loom (1804), Difference Engine (1822) | open |
| 1890–1936: no Hilbert, Gödel (1931), Church or the Entscheidungsproblem | open |
| 1936–1956 thin: McCulloch–Pitts (1943), ENIAC (1945) fine, Shannon (1948), cybernetics (1948), Perceptron (1958) | open |
| 1975–2005: only 1987, 1993, 1997, 2005. Missing backprop (1986), LeCun CNNs (1989), LSTM (1997), Watson era, Moore-law milestones, Dennard scaling end (c. 2005) | open |
| 2006–2019: missing ImageNet (2009), GPU/CUDA (2007), GANs (2014), attention and Transformer (2017) is present, AlphaGo (2016), BERT/GPT-2 (2018–19) | open |
| 2020–2026: missing GPT-3, AlphaFold 2, Copilot, Stable Diffusion, o1-style reasoning models | open |
| Compute points start 2020 | open |
| Forecasts all 2026+; no earlier forecasts for track record (e.g. 1960s predictions) | open |

## C. Universe timeline (`universe-timeline.html`)

| Gap | Status |
|---|---|
| Geological extinctions: Ordovician (445 Ma), Late Devonian (372 Ma), End-Triassic (201 Ma); PETM (56 Ma) | open |
| First tetrapods on land (c. 375 Ma), Carboniferous coal forests | open |
| Pleistocene glacial cycles begin (2.6 Ma), Younger Dryas, Holocene start (11.7 ka) | open |
| Humans: nothing between "Agriculture" and "Writing" except placed events; no Bronze Age, Iron Age, Black Death, Columbian exchange | open |
| Placed events almost all in Eurasia; thin in Africa, the Americas and the Southern Hemisphere | open |
| Future beyond 10¹¹ yr: stellar era end, black hole era, proton decay (if any), heat death | open |
| Cosmic events before 8.8 Gyr: inflation, nucleosynthesis, recombination are probably in `cosmoEvents`; verify | open |

## D. Suggested order

1. A1 empty windows (1980–2026, 2750–2250 BCE, 250–500 CE) and the Future window.
2. A2 Pantheons end dates for Egyptian, Greek, Hindu, Islam, Christian.
3. A2 non-Asian lineages (Jewish, Christian, Sufi) as new lanes.
4. A3 Bardiya lane collapse and region backfill.
5. B and C, which are separate files with their own data shapes.

**Pass 3 (2026-11-05), 162 rows, World context now 540.** Fills the lanes in section E: Australia and Oceania, North and South America, Mesoamerica, Africa before 1000 CE, Southeast Asia, Central Asia, Anatolia, Arabia, Greece after 0 CE, Egypt after 1000 BCE, the Levant and Mesopotamia, South Asia, and non-Western philosophy. These lanes are still thinner than Europe and East Asia. Wars and stupas are being compiled separately by subagents (`tools/timeline-wars/`, `tools/timeline-stupas.mjs`).

## E. Civilization sweep (database, all datasets)

Measured on `kosmo_entities` after the full reseed (about 46,000 timeline entities; the largest is the World History Timeline workbook at 18,763 rows, then Wikidata events at 8,365). Earlier sections measured only `timeline.json` (about 2,000 items) and understate coverage. Per-lane counts from the workbook, by era (4000–3000 BCE | 3000–2000 | 2000–1000 | 1000 BCE–0 | 0–1000 CE | 1000–2025):

| Lane | Counts | Gap |
|---|---|---|
| Australia | 3 / 0 / 0 / 0 / 2 / 351 | Nothing before European contact; Aboriginal history from 65,000 years ago absent from this dataset |
| Africa | 34 / 13 / 26 / 51 / 103 / 376 | Pre-1000 CE thin: Kush, Aksum, Nok, Bantu expansion, Carthage, Swahili coast |
| Southeast Asia | 4 / 10 / 5 / 26 / 93 / 419 | Before 0 CE almost empty; Funan, Dong Son, Srivijaya, Khmer origins |
| Central Asia | 0 / 3 / 0 / 21 / 23 / 49 | Smallest lane (96 total): Scythians, Kushan, Sogdia, Turkic khaganates |
| South America | 38 / 6 / 13 / 41 / 31 / 363 | 3000–0 BCE and 0–1000 CE thin: Norte Chico, Chavín, Nazca, Moche, Wari, Tiwanaku |
| Mesoamerica | 22 / 6 / 23 / 38 / 67 / 185 | Olmec to Classic Maya detail thin |
| Anatolia & Turkey | 4 / 4 / 66 / 29 / 6 / 73 | 0–1000 CE almost empty (Roman and Byzantine Anatolia) |
| Arabian Peninsula | 2 / 1 / 5 / 17 / 25 / 123 | Pre-Islamic Arabia (South Arabian kingdoms, Nabataeans, Himyar) |
| Greece | 36 / 12 / 75 / 436 / 18 / 30 | After 0 CE only 48: Byzantine and Ottoman Greece |
| Egypt | 17 / 42 / 62 / 38 / 17 / 37 | After 1000 BCE thin: Ptolemaic, Roman, Coptic, medieval Islamic Egypt |
| Mesopotamia & Levant | 25 / 40 / 76 / 92 / 75 / 123 | 3000–2000 BCE and post-1000 CE light |
| South Asia / Hinduism / Buddhism | 3 / 3 / 5 / 21 / 32 / 125 and similar | Very little before 1000 BCE; Buddhism lane has 168 rows in total |
| Canada | 1 / 1 / 0 / 0 / 6 / 193 | Indigenous history before contact |
| Philosophy, Great Books | none before 1000 BCE; Philosophy 36 in 0–1000 CE | Non-Western philosophy absent |

Also: `(none)` is the region for 22,322 of the entities, so any region view only covers about half the data. Many regions are spelled several ways (Rome, Rome Italy, Italy/Roman world, Roman Empire).

Added in this pass: the Golden Chain philosophers (see below).

## F. Golden Chain (panentheon site)

Source: `panentheon/docs/lineage.md` ("Paradosis: The Golden Chain and Transmission of Light"; the copy in `panentheon-2` is identical). 177 figures from 180 headings (3 duplicates across sections) are now a `Golden Chain` group in `timeline.json` and a `golden-chain` dataset in the database, grouped by the page's own sections (Legendary Period to Contemporary Evolutionary Thinkers). Musaeus has no date on the page and is skipped. Parser: `tools/timeline-goldenchain.mjs`. The page itself says its list is not exhaustive, with Eastern and Abrahamic sages still to be added.

## G. Archived workbooks and stupas (ingested)

- `tools/extract-archive-workbooks.py` exports all 205 sheets of the five archived Kosmographica workbooks (Christodex Alpha, Vol 2, Indexes BETA, Greek Philosophers List, Daimonologia) to `packages/db/data/archive-workbooks/`. The three copies of each workbook (evolution-of-god, Messiah-Complex, Philosophy) are byte-identical; only the evolution-of-god copy is read. Seed source `archive-workbooks` runs the csv-tables auto-detect on them, one dataset per workbook (`wb-*`), sheet name as lane.
- Importer option `dedupe: true` (run.ts) drops records whose normalized name matches an entity in another dataset within 100 years (250 if approximate), or a repeat within the same source. Of 8,277 workbook rows, 7,649 were already held elsewhere; 625 were written. Only exact-name matches are caught, so near-duplicates with different spellings can remain.
- 241 stupas written to the database (248 in `timeline.json`, which dedupes only against itself), with coordinates and Commons image URLs (`data.image` in the database, `img` in the JSON).
- Still not parsed: sheets whose dates are split across columns or are prose (929 unparseable, 72 sheets with fewer than 60% parseable dates). Listed in the seed's `--check` output.

## H. Wars, pantheon extras, citations, lineage assignments (all ingested)

- **Wars** (`tools/timeline-wars/`, seed source `wars`): 8,926 wars, campaigns, battles, sieges, revolts and treaties with 6,753 relations (part_of, ended_by, preceded_by, caused, same_conflict_as). Database only; not added to `timeline.json` because of size. Items with a Wikidata Q-id replace the same item in the `wikidata` dataset (which dropped from 8,365 to 4,649 rows). Lane is "<region>: <battles & sieges | wars & campaigns | treaties>". Weak spots: South Asia before 1500, Sub-Saharan Africa before 1800, Southeast Asia before 1500 and the Americas before 1500 are thin; Wikidata-sourced rows have empty `sides`; 666 battles have no parent war; 144 rows are low confidence; a bounding-box refetch (`build/fetch5.mjs`) timed out and is the first thing to retry.
- **Pantheon extras**: 127 rows across 15 lanes (Wikipedia-sourced only).
- **Citations**: all 577 curated rows checked; 12 corrected and applied, 3 unverified (marked low confidence).
- **Lineage assignments**: 79 of 80 figures placed; 7 new lanes proposed; Sacred-Lineage database has wrong names/years for ids 1050, 1060, 1071, 1079, 1134.
- **Known bugs in shared files (not fixed)**: `dates.ts` ends Nth-century BCE spans one year late; `csv-tables.ts` CITATION regex rejects names like "Battle of X (1389)".

## I. Royal houses and religious sites (ingested)

- **Royals** (`tools/timeline-royals/`, seed source `royals`): 665 houses and 3,939 monarchs (4,604 entities after duplicate ids) with 9,916 relations (member_of_house, succeeded_by, parent_of, sibling_of, spouse_of, usurped, branch_of, regent_for). Lanes "Royal houses: <region>" and "Monarchs: <region>". 64 legendary monarchs, 787 low confidence. Gaps: Europe from 1500 thin (HRE, Habsburg Spain, German states), African kingdoms (about 20 rulers), Andean/Maya/Mixtec/North American lines, Pacific beyond Hawaii/Tonga/Tahiti/Maori, Indonesian and Philippine sultanates, post-Timurid Central Asia, Indian regional dynasties, Warring States and Northern/Southern Dynasties. Realm labels differ between the Wikidata and curated layers ("Ancient Rome" vs "Roman Empire"), so some succession chains are not joined. Curated "high" rows rest on the agent's knowledge, not cross-checks; spot-check early Japanese reigns, Mughal/Ottoman fathers, Goryeo and Silla.
- **Religious sites** (`tools/timeline-sites/`, seed source `sites`, dedupe on): 6,443 compiled, 6,109 written after dropping 334 already held elsewhere. Taxonomy: Getty AAT type (6,365 verified), Wikidata id on every row, Pleiades id on 288, UNESCO id on 348, religion family, site kind, date basis (curated rows only), Commons images on 3,359. Gaps: pre-Christian Slavic/Baltic/Norse, small and extinct traditions, Chinese and Korean state/folk temples, Zoroastrian India, Jain derasars, Bronze Age Mediterranean and Pacific sites without inception dates. Curated seeds' dates and descriptions are unverified; some bulk rows get a religion by country and date and can be wrong (e.g. Minoan Anemospilia as Greek polytheism). 78 rows have no AAT id (holy-mountain, other); PeriodO ids were not added.

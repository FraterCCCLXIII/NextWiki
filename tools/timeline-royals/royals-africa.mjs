// Rulers of Sub-Saharan and North African kingdoms (Kush, Aksum, Ethiopia, Mali, Songhai, Benin, Ashanti, Dahomey, Zulu, Buganda, Madagascar, Kongo, Morocco, Numidia).
import { makeShard, SSA, NAF } from "./curated/lib.mjs";
const S = makeShard("africa"); const { H, R } = S;
const sa = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, SSA, st, en, sum, o);
const na = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, NAF, st, en, sum, o);
sa("kush-meroe", "Kushite royal line (Napata and Meroë)", "Kingdom of Kush", "Nubian civilization", -760, 350, "Kings and queens (kandake) of Kush, based at Napata and later Meroë.", { cap: "Napata / Meroë", ll: [18.54, 31.81], c: "m", ap: true });
sa("aksum", "Aksumite royal line", "Kingdom of Aksum", "Aksumite civilization", 100, 940, "Kings of Aksum in northern Ethiopia and Eritrea.", { cap: "Aksum", ll: [14.12, 38.72], c: "m", ap: true });
sa("solomonic", "Solomonic dynasty (Ethiopia)", "Ethiopian Empire", "Ethiopian civilization", 1270, 1974, "Ethiopian imperial dynasty claiming descent from Solomon and the Queen of Sheba.", { cap: "Gondar / Addis Ababa", ll: [9.03, 38.74], c: "h", ap: false });
sa("keita", "Keita dynasty (Mali)", "Mali Empire", "Mande civilization", 1235, 1600, "Ruling dynasty of the Mali Empire.", { cap: "Niani", c: "m", ap: true });
sa("songhai", "Sunni and Askia dynasties (Songhai)", "Songhai Empire", "Songhai civilization", 1464, 1591, "Dynasties of the Songhai Empire at Gao.", { cap: "Gao", ll: [16.27, -0.04], c: "m", ap: false });
sa("benin-eweka", "Eweka dynasty (Benin)", "Kingdom of Benin", "Edo civilization", 1180, null, "Obas of Benin, a continuing line.", { cap: "Benin City", ll: [6.34, 5.63], c: "m", ap: true });
sa("ashanti", "Oyoko dynasty (Ashanti)", "Ashanti Empire", "Akan civilization", 1701, null, "Asantehenes of Ashanti, a continuing line.", { cap: "Kumasi", ll: [6.69, -1.62], c: "m", ap: false });
sa("dahomey", "Alladaxonou dynasty (Dahomey)", "Kingdom of Dahomey", "Fon civilization", 1600, 1900, "Kings of Dahomey.", { cap: "Abomey", ll: [7.18, 1.99], c: "m", ap: true });
sa("zulu", "House of Zulu", "Zulu Kingdom", "Zulu civilization", 1816, null, "Royal house of the Zulu Kingdom founded by Shaka.", { cap: "Ulundi", ll: [-28.33, 31.42], c: "h", ap: false });
sa("buganda", "Kings of Buganda", "Kingdom of Buganda", "Ganda civilization", 1300, null, "Kabaka of Buganda, a continuing line.", { cap: "Mengo / Kampala", ll: [0.3, 32.55], c: "m", ap: true });
sa("merina", "Merina royal house (Madagascar)", "Kingdom of Madagascar", "Merina civilization", 1787, 1897, "Dynasty of Andrianampoinimerina that unified much of Madagascar.", { cap: "Antananarivo", ll: [-18.88, 47.51], c: "h", ap: false });
sa("kongo", "Kingdom of Kongo royal houses", "Kingdom of Kongo", "Kongo civilization", 1390, 1914, "Manikongo of the Kingdom of Kongo.", { cap: "Mbanza Kongo", ll: [-6.27, 14.25], c: "m", ap: true });
sa("ndongo", "Ndongo and Matamba rulers", "Ndongo and Matamba", "Mbundu civilization", 1624, 1663, "Rulers of the Mbundu states.", { c: "m", ap: false });
na("numidia", "Numidian royal house", "Numidia", "Berber civilization", -202, -46, "Berber kings of Numidia.", { c: "h", ap: false });
na("mauretania", "Mauretanian royal house", "Mauretania", "Berber civilization", -25, 40, "Client kings of Mauretania under Rome.", { c: "h", ap: false });
na("almoravid", "Almoravid dynasty", "Almoravid Empire", "Berber civilization", 1040, 1147, "Berber dynasty of the Sahara, Morocco and al-Andalus.", { cap: "Marrakesh", ll: [31.63, -8.0], c: "h", ap: false });
na("almohad", "Almohad dynasty", "Almohad Caliphate", "Berber civilization", 1121, 1269, "Berber dynasty ruling the Maghreb and al-Andalus.", { cap: "Marrakesh", c: "h", ap: false });
na("alaouite", "Alaouite dynasty", "Morocco", "Moroccan civilization", 1631, null, "Ruling dynasty of Morocco since the 17th century.", { cap: "Fez / Rabat", ll: [34.02, -6.84], c: "h", ap: false });
R("af-kush", "Kingdom of Kush", "kush-meroe", "king", [
  ["alara", "Alara of Kush", -780, -760, { c: "l", ap: true, s: "First known king of Kush, remembered by later Kushite kings as the founder." }],
  ["kashta", "Kashta", -760, -747, { c: "m", ap: true, after: "alara" }],
  ["amanirenas", "Amanirenas", -40, -10, { t: "kandake (queen)", c: "m", ap: true, after: null, s: "Kandake of Kush who fought Rome in the war of 25-22 BCE." }],
]);
R("af-aksum", "Kingdom of Aksum", "aksum", "king", [
  ["ezana", "Ezana of Aksum", 320, 360, { c: "m", ap: true, s: "King who adopted Christianity for Aksum in the mid-fourth century." }],
  ["kaleb", "Kaleb of Axum", 510, 540, { c: "m", ap: true, s: "Aksumite king who invaded Himyar in southern Arabia." }],
]);
R("af-eth", "Ethiopian Empire", "solomonic", "emperor (negus negest)", [
  ["yekuno-amlak", "Yekuno Amlak", 1270, 1285, { c: "m", ap: false, acc: "u", s: "Founder of the Solomonic dynasty, ending Zagwe rule." }],
  ["amda-seyon", "Amda Seyon I", 1314, 1344, { c: "m", ap: false, acc: "i", after: "yekuno-amlak" }],
  ["zara-yaqob", "Zara Yaqob", 1434, 1468, { f: "~Dawit I", c: "m", ap: false, acc: "i", s: "Strengthened the Ethiopian Church and state." }],
  ["lebna-dengel", "Lebna Dengel", 1508, 1540, { c: "m", ap: false, acc: "i", s: "Reigned during Ahmad Gragn's invasion; sought Portuguese help." }],
  ["susenyos", "Susenyos I", 1607, 1632, { c: "m", ap: false, acc: "u", s: "Converted to Catholicism and abdicated amid civil unrest." }],
  ["fasilides", "Fasilides", 1632, 1667, { f: "susenyos", c: "m", ap: false, acc: "i", s: "Founded Gondar as the capital and restored the Orthodox Church." }],
  ["tewodros2", "Tewodros II", 1855, 1868, { c: "h", ap: false, acc: "u", en: "d", s: "Ended the Zemene Mesafint; died at the siege of Magdala." }],
  ["yohannes4", "Yohannes IV", 1871, 1889, { c: "h", ap: false, acc: "u", en: "d", s: "Killed fighting Mahdist forces at Gallabat." }],
  ["menelik2", "Menelik II", 1889, 1913, { c: "h", ap: false, acc: "u", s: "Defeated Italy at Adwa in 1896 and founded Addis Ababa." }],
  ["iyasu5", "Lij Iyasu", 1913, 1916, { c: "h", ap: false, acc: "i", en: "p", f: "~Negus Mikael" }],
  ["zewditu", "Zewditu", 1916, 1930, { t: "empress regnant", f: "menelik2", c: "h", ap: false, acc: "a", en: "d" }],
  ["haile-selassie", "Haile Selassie", 1930, 1974, { f: "~Ras Makonnen", c: "h", ap: false, acc: "i", en: "p", s: "Last emperor of Ethiopia, deposed by the Derg in 1974." }],
]);
R("af-mali", "Mali Empire", "keita", "mansa", [
  ["sundiata", "Sundiata Keita", 1235, 1255, { f: "~Maghan Kon Fatta", c: "m", ap: true, s: "Legendary founder of the Mali Empire after the Battle of Kirina." }],
  ["mansa-musa", "Mansa Musa", 1312, 1337, { f: "~Faga Leye", c: "m", ap: true, after: null, s: "Mali ruler famed for his 1324 pilgrimage to Mecca." }],
]);
R("af-songhai", "Songhai Empire", "songhai", "sonni / askia", [
  ["sunni-ali", "Sunni Ali", 1464, 1492, { c: "m", ap: false, s: "Expanded Songhai and captured Timbuktu and Djenné." }],
  ["askia-muhammad", "Askia Muhammad I", 1493, 1528, { c: "m", ap: false, acc: "u", us: "@af-songhai-sunni-ali", s: "Founder of the Askia dynasty; consolidated Songhai as an Islamic empire." }],
]);
R("af-benin", "Kingdom of Benin", "benin-eweka", "oba", [
  ["ewuare", "Ewuare the Great", 1440, 1473, { c: "m", ap: true, s: "Oba who expanded Benin and rebuilt Benin City." }],
  ["esigie", "Esigie", 1504, 1550, { c: "m", ap: true, f: "~Ozolua", s: "Oba who dealt with the Portuguese in the early sixteenth century." }],
]);
R("af-ashanti", "Ashanti Empire", "ashanti", "asantehene", [
  ["osei-tutu", "Osei Tutu I", 1701, 1717, { c: "m", ap: true, s: "Founder of the Ashanti Empire and the Golden Stool tradition." }],
  ["opoku-ware", "Opoku Ware I", 1720, 1750, { c: "m", ap: true }],
]);
R("af-dahomey", "Kingdom of Dahomey", "dahomey", "king", [
  ["agaja", "Agaja", 1708, 1740, { c: "m", ap: false, s: "Dahomey king who conquered the coastal kingdoms of Allada and Whydah." }],
  ["ghezo", "Ghezo", 1818, 1858, { c: "m", ap: false, acc: "u" }],
]);
R("af-zulu", "Zulu Kingdom", "zulu", "king", [
  ["shaka", "Shaka", 1816, 1828, { c: "h", ap: false, b: 1787, d: 1828, en: "d", s: "Founder of the Zulu Kingdom who reformed its military; assassinated by his half-brothers." }],
  ["dingane", "Dingane", 1828, 1840, { f: "~Senzangakhona", sib: ["shaka"], c: "h", ap: false, acc: "u", us: "shaka", en: "p" }],
  ["mpande", "Mpande", 1840, 1872, { f: "~Senzangakhona", sib: ["shaka", "dingane"], c: "h", ap: false, acc: "u", us: "dingane" }],
  ["cetshwayo", "Cetshwayo", 1873, 1879, { f: "mpande", c: "h", ap: false, acc: "i", en: "c", s: "Led the Zulu in the Anglo-Zulu War of 1879." }],
]);
R("af-bug", "Kingdom of Buganda", "buganda", "kabaka", [
  ["mutesa1", "Mutesa I of Buganda", 1856, 1884, { c: "h", ap: false }],
  ["mwanga2", "Mwanga II of Buganda", 1884, 1897, { f: "mutesa1", c: "h", ap: false, acc: "i", en: "p" }],
]);
R("af-mad", "Kingdom of Madagascar", "merina", "king / queen", [
  ["andrianampoinimerina", "Andrianampoinimerina", 1787, 1810, { c: "h", ap: false }],
  ["radama1", "Radama I", 1810, 1828, { f: "andrianampoinimerina", c: "h", ap: false, acc: "i", en: "d" }],
  ["ranavalona1", "Ranavalona I", 1828, 1861, { t: "queen regnant", sp: ["radama1"], c: "h", ap: false, acc: "u", s: "Reigned for 33 years, resisting European influence." }],
]);
R("af-kongo", "Kingdom of Kongo", "kongo", "manikongo", [
  ["afonso1", "Afonso I of Kongo", 1509, 1543, { f: "~Nzinga a Nkuvu", c: "h", ap: false, acc: "u", s: "Christian king of Kongo who corresponded with the Portuguese and the Pope." }],
]);
R("af-ndongo", "Ndongo and Matamba", "ndongo", "queen", [["nzinga", "Nzinga of Ndongo and Matamba", 1624, 1663, { t: "queen", c: "h", ap: false, f: "~Kiluanji", s: "Queen who resisted Portuguese colonisation in Angola." }]]);
R("af-numid", "Numidia", "numidia", "king", [
  ["masinissa", "Masinissa", -202, -148, { c: "h", ap: false, s: "First king of a unified Numidia, ally of Rome against Carthage." }],
  ["jugurtha", "Jugurtha", -118, -105, { c: "h", ap: false, en: "c", s: "Numidian king defeated by Rome in the Jugurthine War." }],
]);
R("af-maur", "Mauretania", "mauretania", "king", [["juba2", "Juba II", -25, 23, { c: "h", ap: false, sp: ["~Cleopatra Selene II"], s: "Roman client king of Mauretania, scholar and husband of Cleopatra VII's daughter." }]]);
R("af-almor", "Almoravid Empire", "almoravid", "emir", [["yusuf-tashfin", "Yusuf ibn Tashfin", 1061, 1106, { c: "h", ap: false, s: "Founder of Marrakesh; won the Battle of Sagrajas in 1086." }]]);
R("af-almoh", "Almohad Caliphate", "almohad", "caliph", [
  ["abd-mumin", "Abd al-Mu'min", 1130, 1163, { c: "h", ap: false }],
  ["abu-yaqub", "Abu Yaqub Yusuf", 1163, 1184, { f: "abd-mumin", c: "h", ap: false, acc: "i" }],
]);
R("af-alaouite", "Morocco", "alaouite", "sultan / king", [
  ["ismail", "Moulay Ismail", 1672, 1727, { c: "h", ap: false, s: "Long-reigning Alaouite sultan who founded the Moroccan state apparatus at Meknes." }],
  ["mohammed5", "Mohammed V of Morocco", 1927, 1961, { c: "h", ap: false, after: null }],
  ["hassan2", "Hassan II of Morocco", 1961, 1999, { f: "mohammed5", c: "h", ap: false, acc: "i" }],
  ["mohammed6", "Mohammed VI of Morocco", 1999, null, { f: "hassan2", c: "h", ap: false, acc: "i", b: 1963 }],
]);
export const { houses, monarchs, links } = S;

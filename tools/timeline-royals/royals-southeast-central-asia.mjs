// Southeast Asian kingdoms (Khmer, Burma, Siam, Java, Laos, Cambodia, Malacca) and steppe / Central Asian khans (Xiongnu, Huns, Gokturks, Mongols, Ilkhanate, Golden Horde, Timurids).
import { makeShard, SEA, CA } from "./curated/lib.mjs";
const S = makeShard("southeast-central-asia"); const { H, R } = S;
const se = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, SEA, st, en, sum, o);
se("khmer-angkor", "Angkorian royal line", "Khmer Empire", "Khmer civilization", 802, 1431, "Kings of the Khmer Empire from Jayavarman II to the abandonment of Angkor.", { cap: "Angkor", ll: [13.41, 103.87], c: "m", ap: false });
se("cambodia-norodom", "Norodom dynasty", "Cambodia", "Khmer civilization", 1860, null, "Royal house of modern Cambodia.", { cap: "Phnom Penh", ll: [11.56, 104.92], c: "h", ap: false });
se("pagan", "Pagan royal line", "Pagan Kingdom", "Burmese civilization", 1044, 1287, "Kings of the Pagan Kingdom, first unified Burmese state.", { cap: "Pagan", ll: [21.17, 94.86], c: "m", ap: false });
se("toungoo", "Toungoo dynasty", "Toungoo Empire", "Burmese civilization", 1531, 1752, "Dynasty of Bayinnaung's empire.", { cap: "Toungoo / Pegu", c: "m", ap: false });
se("konbaung", "Konbaung dynasty", "Konbaung Burma", "Burmese civilization", 1752, 1885, "Last royal dynasty of Burma.", { cap: "Ava / Amarapura / Mandalay", ll: [21.97, 96.08], c: "h", ap: false });
se("sukhothai-ayutthaya", "Sukhothai and Ayutthaya kings", "Siam", "Thai civilization", 1279, 1782, "Kings of the Thai kingdoms before the Chakri dynasty.", { cap: "Sukhothai / Ayutthaya", ll: [14.35, 100.57], c: "m", ap: false });
se("chakri", "Chakri dynasty", "Siam / Thailand", "Thai civilization", 1782, null, "Ruling dynasty of Siam and Thailand since 1782.", { cap: "Bangkok", ll: [13.75, 100.5], c: "h", ap: false });
se("majapahit", "Rajasa dynasty (Majapahit)", "Majapahit", "Javanese civilization", 1293, 1527, "Rulers of the Majapahit Empire in Java.", { cap: "Trowulan", ll: [-7.56, 112.38], c: "m", ap: false });
se("melaka", "Melaka sultanate", "Malacca Sultanate", "Malay civilization", 1400, 1511, "Malay sultanate at Melaka.", { cap: "Melaka", ll: [2.2, 102.25], c: "m", ap: true });
se("lanxang", "Lan Xang royal house", "Lan Xang", "Lao civilization", 1353, 1707, "Kingdom of a Million Elephants.", { cap: "Luang Prabang", c: "m", ap: false });
se("mataram", "Mataram Sultanate rulers", "Mataram Sultanate", "Javanese civilization", 1587, 1755, "Javanese sultanate under Sultan Agung.", { cap: "Kotagede", c: "m", ap: false });
se("aceh", "Aceh sultanate", "Aceh Sultanate", "Acehnese civilization", 1496, 1903, "Sultanate on Sumatra.", { cap: "Banda Aceh", c: "m", ap: false });
R("sea-khmer", "Khmer Empire", "khmer-angkor", "king", [
  ["jayavarman2", "Jayavarman II", 802, 850, { c: "m", ap: true, s: "Founder of the Khmer Empire, traditionally consecrating himself universal monarch on Mount Kulen." }],
  ["indravarman1", "Indravarman I", 877, 889, { c: "m", ap: true, after: "jayavarman2" }],
  ["yasovarman1", "Yasovarman I", 889, 910, { f: "indravarman1", c: "m", ap: true, acc: "i", s: "Founded Yasodharapura, the first city at Angkor." }],
  ["suryavarman1", "Suryavarman I", 1006, 1050, { c: "m", ap: false, acc: "u" }],
  ["suryavarman2", "Suryavarman II", 1113, 1150, { c: "m", ap: false, acc: "u", s: "Builder of Angkor Wat." }],
  ["jayavarman7", "Jayavarman VII", 1181, 1218, { c: "m", ap: false, s: "Khmer king who expelled the Cham invaders and built Angkor Thom and the Bayon." }],
]);
R("sea-camb", "Cambodia", "cambodia-norodom", "king", [
  ["norodom", "Norodom of Cambodia", 1860, 1904, { c: "h", ap: false }],
  ["sisowath", "Sisowath", 1904, 1927, { sib: ["norodom"], c: "h", ap: false }],
  ["sihanouk", "Norodom Sihanouk", 1941, 1955, { c: "h", ap: false, after: "sisowath", s: "King of Cambodia 1941-1955 and again 1993-2004." }],
  ["sihamoni", "Norodom Sihamoni", 2004, null, { f: "sihanouk", c: "h", ap: false, acc: "e" }],
]);
R("sea-pagan", "Pagan Kingdom", "pagan", "king", [
  ["anawrahta", "Anawrahta", 1044, 1077, { c: "m", ap: false, s: "Founder of the Pagan Kingdom, who took Theravada Buddhism from the Mon." }],
  ["kyansittha", "Kyansittha", 1084, 1113, { c: "m", ap: false, after: "anawrahta" }],
  ["narathihapate", "Narathihapate", 1256, 1287, { c: "m", ap: false, en: "d", s: "Last effective Pagan king, whose reign saw the Mongol invasions." }],
]);
R("sea-toungoo", "Toungoo Empire", "toungoo", "king", [["bayinnaung", "Bayinnaung", 1550, 1581, { c: "m", ap: false, s: "Toungoo king who built the largest empire in Southeast Asian history." }]]);
R("sea-konb", "Konbaung Burma", "konbaung", "king", [
  ["alaungpaya", "Alaungpaya", 1752, 1760, { c: "h", ap: false, s: "Founder of the Konbaung dynasty." }],
  ["hsinbyushin", "Hsinbyushin", 1763, 1776, { f: "alaungpaya", c: "h", ap: false, acc: "i", after: "alaungpaya" }],
  ["bodawpaya", "Bodawpaya", 1782, 1819, { f: "alaungpaya", sib: ["hsinbyushin"], c: "h", ap: false, acc: "u" }],
  ["mindon", "Mindon Min", 1853, 1878, { c: "h", ap: false, acc: "u", after: null }],
  ["thibaw", "Thibaw Min", 1878, 1885, { f: "mindon", c: "h", ap: false, acc: "i", en: "c", s: "Last king of Burma, deposed by the British in 1885." }],
]);
R("sea-siam", "Siam", "sukhothai-ayutthaya", "king", [
  ["ramkhamhaeng", "Ram Khamhaeng", 1279, 1298, { c: "m", ap: true, s: "King of Sukhothai traditionally credited with creating the Thai script." }],
  ["ramathibodi1", "Ramathibodi I", 1351, 1369, { c: "m", ap: false, after: null, s: "Founder of Ayutthaya." }],
  ["naresuan", "Naresuan", 1590, 1605, { c: "m", ap: false, after: null }],
  ["narai", "Narai the Great", 1656, 1688, { c: "m", ap: false, after: null }],
  ["taksin", "Taksin", 1767, 1782, { c: "m", ap: false, after: null, en: "d", s: "Reunified Siam after the fall of Ayutthaya in 1767." }],
]);
R("sea-chakri", "Siam / Thailand", "chakri", "king", [
  ["rama1", "Rama I (Phutthayotfa Chulalok)", 1782, 1809, { c: "h", ap: false, after: "@sea-siam-taksin", acc: "u", us: "@sea-siam-taksin" }],
  ["rama2", "Rama II", 1809, 1824, { f: "rama1", c: "h", ap: false, acc: "i" }],
  ["rama3", "Rama III", 1824, 1851, { f: "rama2", c: "h", ap: false, acc: "i" }],
  ["rama4", "Mongkut (Rama IV)", 1851, 1868, { f: "rama2", sib: ["rama3"], c: "h", ap: false, acc: "i" }],
  ["rama5", "Chulalongkorn (Rama V)", 1868, 1910, { f: "rama4", c: "h", ap: false, acc: "i", s: "Modernised Siam and preserved its independence." }],
  ["rama6", "Vajiravudh (Rama VI)", 1910, 1925, { f: "rama5", c: "h", ap: false, acc: "i" }],
  ["rama7", "Prajadhipok (Rama VII)", 1925, 1935, { f: "rama5", sib: ["rama6"], c: "h", ap: false, acc: "i", en: "a", s: "Last absolute monarch of Siam; abdicated in 1935." }],
  ["rama8", "Ananda Mahidol (Rama VIII)", 1935, 1946, { f: "~Mahidol Adulyadej", c: "h", ap: false, acc: "e", en: "d" }],
  ["rama9", "Bhumibol Adulyadej (Rama IX)", 1946, 2016, { f: "~Mahidol Adulyadej", sib: ["rama8"], c: "h", ap: false, acc: "i", en: "d", s: "Longest-reigning Thai monarch." }],
  ["rama10", "Vajiralongkorn (Rama X)", 2016, null, { f: "rama9", c: "h", ap: false, acc: "i", b: 1952 }],
]);
R("sea-maj", "Majapahit", "majapahit", "king / queen", [
  ["wijaya", "Raden Wijaya", 1293, 1309, { c: "m", ap: false, s: "Founder of Majapahit, who used Mongol forces to defeat Jayakatwang." }],
  ["tribhuwana", "Tribhuwana Wijayatunggadewi", 1328, 1350, { t: "queen", c: "m", ap: false, after: "wijaya" }],
  ["hayam-wuruk", "Hayam Wuruk", 1350, 1389, { m: "tribhuwana", c: "m", ap: false, acc: "i", s: "Majapahit king at its height, with the minister Gajah Mada." }],
]);
R("sea-mel", "Malacca Sultanate", "melaka", "sultan", [
  ["parameswara", "Parameswara", 1400, 1414, { c: "m", ap: true, s: "Founder of Melaka." }],
  ["mahmud-shah", "Mahmud Shah of Malacca", 1488, 1511, { c: "m", ap: false, after: null, en: "p", s: "Last sultan of Malacca before the Portuguese conquest." }],
]);
R("sea-lao", "Lan Xang", "lanxang", "king", [["fa-ngum", "Fa Ngum", 1353, 1373, { c: "m", ap: false, s: "Founder of the Lan Xang kingdom." }]]);
R("sea-java", "Mataram Sultanate", "mataram", "sultan", [["agung", "Sultan Agung", 1613, 1645, { c: "m", ap: false, s: "Greatest Mataram sultan; attacked Dutch Batavia in 1628-1629." }]]);
R("sea-aceh", "Aceh Sultanate", "aceh", "sultan", [["iskandar-muda", "Iskandar Muda", 1607, 1636, { c: "m", ap: false, s: "Sultan who brought Aceh to its height." }]]);
// ---- Steppe / Central Asia ----
const st = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, CA, st, en, sum, o);
st("xiongnu", "Luanti clan (Xiongnu)", "Xiongnu", "Steppe nomads", -209, 93, "Rulers of the Xiongnu confederation (chanyu).", { c: "m", ap: true });
st("hunnic", "Hunnic royal house", "Hunnic Empire", "Steppe nomads", 434, 469, "Rulers of the Hunnic Empire in the Carpathian Basin.", { c: "m", ap: true, region: "Eastern Europe" });
st("ashina", "Ashina clan (Gokturks)", "Göktürk Khaganate", "Steppe nomads", 552, 744, "Founders of the First Turkic Khaganate.", { c: "m", ap: true });
st("borjigin", "Borjigin (Genghisid) house", "Mongol Empire", "Mongol civilization", 1206, 1634, "Descendants of Genghis Khan ruling the Mongol Empire and its successors.", { cap: "Karakorum", ll: [47.2, 102.82], c: "h", ap: false });
st("ilkhanate", "Ilkhanid line (Hulaguids)", "Ilkhanate", "Mongol civilization", 1256, 1335, "Mongol khans of Iran, descended from Hulagu.", { cap: "Tabriz / Sultaniyya", parent: "borjigin", c: "h", ap: false, region: "Middle East" });
st("golden-horde", "Jochid line (Golden Horde)", "Golden Horde", "Mongol civilization", 1227, 1502, "Khans of the Golden Horde, descended from Jochi.", { cap: "Sarai", parent: "borjigin", c: "h", ap: false, region: "Eastern Europe" });
st("chagatai", "Chagataid line", "Chagatai Khanate", "Mongol civilization", 1226, 1347, "Khans descended from Chagatai in Central Asia.", { parent: "borjigin", c: "h", ap: false });
st("timurid", "Timurid dynasty", "Timurid Empire", "Turco-Persian civilization", 1370, 1507, "Dynasty founded by Timur (Tamerlane).", { cap: "Samarkand / Herat", ll: [39.65, 66.96], c: "h", ap: false });
R("st-xn", "Xiongnu", "xiongnu", "chanyu", [
  ["touman", "Touman Chanyu", -220, -209, { c: "l", ap: true }],
  ["modu", "Modu Chanyu", -209, -174, { f: "touman", acc: "u", c: "m", ap: true, s: "Founder of the Xiongnu Empire, who united the nomads of the steppe." }],
  ["laoshang", "Laoshang Chanyu", -174, -160, { f: "modu", acc: "i", c: "m", ap: true }],
]);
R("st-hun", "Hunnic Empire", "hunnic", "king", [
  ["bleda", "Bleda", 434, 445, { c: "m", ap: true, f: "~Mundzuk", en: "d" }],
  ["attila", "Attila", 434, 453, { f: "~Mundzuk", sib: ["bleda"], c: "h", ap: true, en: "d", after: null, s: "King of the Huns who invaded Gaul and Italy; died in 453." }],
  ["ellac", "Ellac", 453, 454, { f: "attila", c: "m", ap: true, acc: "i", en: "d" }],
]);
R("st-gok", "Göktürk Khaganate", "ashina", "khagan", [
  ["bumin", "Bumin Qaghan", 552, 552, { c: "m", ap: true, s: "Founder of the First Turkic Khaganate." }],
  ["muqan", "Muqan Qaghan", 553, 572, { f: "bumin", c: "m", ap: true, acc: "i", after: "bumin" }],
]);
R("st-mon", "Mongol Empire", "borjigin", "khagan", [
  ["guyuk", "Güyük Khan", 1246, 1248, { f: "@cn-yuan-ogedei", m: "~Töregene Khatun", c: "h", ap: false, acc: "e", after: "@cn-yuan-ogedei" }],
  ["toregene", "Töregene Khatun", 1241, 1246, { t: "regent", sp: ["@cn-yuan-ogedei"], acc: "r", rg: "guyuk", c: "h", ap: false, nolink: true, after: "@cn-yuan-ogedei" }],
]);
R("st-ilk", "Ilkhanate", "ilkhanate", "ilkhan", [
  ["hulagu", "Hulagu Khan", 1256, 1265, { f: "~Tolui", c: "h", ap: false, s: "Sacked Baghdad in 1258 and founded the Ilkhanate." }],
  ["abaqa", "Abaqa Khan", 1265, 1282, { f: "hulagu", c: "h", ap: false, acc: "i" }],
  ["tegudar", "Ahmad Tegüder", 1282, 1284, { f: "hulagu", sib: ["abaqa"], c: "h", ap: false, acc: "u", us: "abaqa" }],
  ["arghun", "Arghun Khan", 1284, 1291, { f: "abaqa", c: "h", ap: false, acc: "u", us: "tegudar" }],
  ["ghazan", "Ghazan", 1295, 1304, { f: "arghun", c: "h", ap: false, acc: "u", s: "Converted to Islam and reformed the Ilkhanate." }],
  ["oljeitu", "Öljaitü", 1304, 1316, { f: "arghun", sib: ["ghazan"], c: "h", ap: false, acc: "i" }],
  ["abu-said", "Abu Said Bahadur Khan", 1316, 1335, { f: "oljeitu", c: "h", ap: false, acc: "i", s: "Last effective Ilkhan." }],
]);
R("st-gh", "Golden Horde", "golden-horde", "khan", [
  ["batu", "Batu Khan", 1227, 1255, { f: "~Jochi", c: "h", ap: false, s: "Led the Mongol invasion of Rus' and Europe and founded the Golden Horde." }],
  ["berke", "Berke Khan", 1257, 1266, { f: "~Jochi", sib: ["batu"], c: "h", ap: false, acc: "i", s: "First Golden Horde khan to convert to Islam." }],
  ["ozbeg", "Özbeg Khan", 1313, 1341, { c: "h", ap: false, after: null, s: "Made Islam the state religion of the Golden Horde." }],
  ["tokhtamysh", "Tokhtamysh", 1380, 1395, { c: "h", ap: false, after: null, s: "Sacked Moscow in 1382 before being defeated by Timur." }],
]);
R("st-chag", "Chagatai Khanate", "chagatai", "khan", [["chagatai", "Chagatai Khan", 1226, 1242, { f: "@cn-yuan-genghis", c: "h", ap: false }]]);
R("st-tim", "Timurid Empire", "timurid", "emir / sultan", [
  ["timur", "Timur", 1370, 1405, { c: "h", ap: false, b: 1336, d: 1405, acc: "c", s: "Founder of the Timurid Empire; defeated the Ottomans at Ankara in 1402." }],
  ["shah-rukh", "Shah Rukh", 1405, 1447, { f: "timur", c: "h", ap: false, acc: "i" }],
  ["ulugh-beg", "Ulugh Beg", 1447, 1449, { f: "shah-rukh", c: "h", ap: false, acc: "i", en: "d", s: "Astronomer-ruler of Samarkand." }],
  ["husayn-bayqara", "Husayn Bayqara", 1469, 1506, { c: "h", ap: false, after: null }],
]);
export const { houses, monarchs, links } = S;

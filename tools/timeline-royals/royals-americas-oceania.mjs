// Rulers of Mesoamerica and the Andes (Aztec, Maya, Mixtec, Inca) and of Polynesian chiefly lines (Hawai'i, Tonga, Tahiti, Maori King movement).
import { makeShard, MES, SAM, OC } from "./curated/lib.mjs";
const S = makeShard("americas-oceania"); const { H, R } = S;
const mx = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, MES, st, en, sum, o);
mx("mexica", "Mexica royal house (Tenochtitlan)", "Aztec Empire", "Aztec civilization", 1375, 1521, "Tlatoque of Tenochtitlan, who led the Aztec Triple Alliance.", { cap: "Tenochtitlan", ll: [19.43, -99.13], c: "m", ap: false });
mx("texcoco", "Acolhua royal house of Texcoco", "Texcoco", "Aztec civilization", 1431, 1520, "Rulers of Texcoco, a partner in the Triple Alliance.", { cap: "Texcoco", c: "m" });
mx("palenque", "Palenque dynasty", "Palenque", "Maya civilization", 431, 799, "Ruling line of the Classic Maya city of Palenque (B'aakal).", { cap: "Palenque", ll: [17.48, -92.05], c: "m", ap: true });
mx("tikal", "Tikal dynasty (Mutal)", "Tikal", "Maya civilization", 90, 869, "Ruling line of Tikal, one of the great Classic Maya cities.", { cap: "Tikal", ll: [17.22, -89.62], c: "m", ap: true });
mx("copan", "Copán dynasty (Xukpi)", "Copán", "Maya civilization", 426, 822, "Ruling line of Copán in Honduras, founded by K'inich Yax K'uk' Mo'.", { cap: "Copán", ll: [14.84, -89.14], c: "m", ap: true });
mx("tilantongo", "Tilantongo royal house (Mixtec)", "Tilantongo", "Mixtec civilization", 692, 1521, "Mixtec ruling house known from the codices.", { c: "l", ap: true });
mx("toltec", "Toltec rulers (Tollan)", "Tollan", "Toltec civilization", 900, 1150, "Legendary rulers of Tollan known from later Aztec accounts.", { c: "l", ap: true });
R("mx-az", "Aztec Empire", "mexica", "tlatoani", [
  ["acamapichtli", "Acamapichtli", 1375, 1395, { c: "m", ap: false, s: "First tlatoani of Tenochtitlan." }],
  ["huitzilihuitl", "Huitzilihuitl", 1396, 1417, { f: "acamapichtli", acc: "e", c: "m", ap: false }],
  ["chimalpopoca", "Chimalpopoca", 1417, 1427, { f: "huitzilihuitl", acc: "e", c: "m", ap: false, en: "d" }],
  ["itzcoatl", "Itzcoatl", 1427, 1440, { f: "acamapichtli", acc: "e", c: "m", ap: false, s: "Led the Mexica to independence from Azcapotzalco and formed the Triple Alliance." }],
  ["moctezuma1", "Moctezuma I", 1440, 1469, { f: "huitzilihuitl", acc: "e", c: "m", ap: false }],
  ["axayacatl", "Axayacatl", 1469, 1481, { f: "~Tezozomoc", acc: "e", c: "m", ap: false }],
  ["tizoc", "Tizoc", 1481, 1486, { f: "~Tezozomoc", sib: ["axayacatl"], acc: "e", c: "m", ap: false }],
  ["ahuitzotl", "Ahuitzotl", 1486, 1502, { f: "~Tezozomoc", sib: ["axayacatl", "tizoc"], acc: "e", c: "m", ap: false }],
  ["moctezuma2", "Moctezuma II", 1502, 1520, { f: "axayacatl", acc: "e", c: "h", ap: false, en: "d", s: "Tlatoani at the arrival of Cortés; died during the Spanish occupation of Tenochtitlan." }],
  ["cuitlahuac", "Cuitláhuac", 1520, 1520, { f: "axayacatl", sib: ["moctezuma2"], acc: "e", c: "h", ap: false, en: "d", s: "Led the Noche Triste victory over the Spanish; died of smallpox." }],
  ["cuauhtemoc", "Cuauhtémoc", 1520, 1521, { f: "ahuitzotl", acc: "e", c: "h", ap: false, en: "c", s: "Last Aztec tlatoani, captured when Tenochtitlan fell on 13 August 1521." }],
]);
R("mx-tx", "Texcoco", "texcoco", "tlatoani", [["nezahualcoyotl", "Nezahualcoyotl", 1431, 1472, { c: "m", ap: false, s: "Poet-ruler of Texcoco who helped found the Triple Alliance." }]]);
R("mx-pal", "Palenque", "palenque", "ajaw", [
  ["pakal", "K'inich Janaab' Pakal I", 615, 683, { b: 603, d: 683, m: "~Sak K'uk'", c: "h", ap: false, acc: "i", s: "Palenque ruler who built the Temple of the Inscriptions, where he was entombed." }],
  ["kan-bahlam2", "K'inich Kan Bahlam II", 684, 702, { f: "pakal", c: "h", ap: false, acc: "i" }],
  ["kinich-ahkal-mo-nahb3", "K'inich Ahkal Mo' Nahb III", 721, 736, { c: "m", ap: false, acc: "i" }],
]);
R("mx-tik", "Tikal", "tikal", "ajaw", [
  ["yax-nuun-ayiin1", "Yax Nuun Ayiin I", 379, 404, { c: "m", ap: false, acc: "?", s: "Tikal ruler associated with Teotihuacan's intervention in 378." }],
  ["jasaw", "Jasaw Chan K'awiil I", 682, 734, { c: "m", ap: false, s: "Tikal ruler who defeated Calakmul in 695 and began a Late Classic revival." }],
  ["yik-in", "Yik'in Chan K'awiil", 734, 746, { f: "jasaw", c: "m", ap: false, acc: "i" }],
]);
R("mx-cop", "Copán", "copan", "ajaw", [
  ["yax-kuk-mo", "K'inich Yax K'uk' Mo'", 426, 437, { c: "m", ap: false, s: "Founder of the Copán dynasty." }],
  ["waxaklajuun", "Waxaklajuun Ub'aah K'awiil", 695, 738, { c: "m", ap: false, en: "d", s: "Copán ruler captured and killed by Quiriguá's K'ak' Tiliw." }],
  ["yax-pasaj", "Yax Pasaj Chan Yopaat", 763, 810, { c: "m", ap: false, s: "Last major Copán ruler." }],
]);
R("mx-mix", "Tilantongo", "tilantongo", "king", [["eight-deer", "Eight Deer Jaguar Claw", 1063, 1115, { c: "m", ap: false, s: "Mixtec lord of Tilantongo whose life is recorded in several codices." }]]);
R("mx-tol", "Tollan", "toltec", "king", [["topiltzin", "Topiltzin Quetzalcoatl", 923, 947, { leg: true, c: "l", s: "Legendary priest-king of Tollan, possibly based on a historical ruler." }]]);
const inc = (id, name, st, en, sum, o = {}) => H(id, name, "Inca Empire", "Inca civilization", SAM, st, en, sum, { cap: "Cusco", ll: [-13.52, -71.97], c: "m", ...o });
inc("inca-hanan", "Hanan and Hurin Cusco dynasties (Inca)", 1200, 1572, "Sapa Inca lineages of Cusco; the early rulers are legendary.", { ap: true });
R("sa-inca", "Inca Empire", "inca-hanan", "sapa inca", [
  ["manco-capac", "Manco Cápac", 1200, null, { leg: true, c: "l", s: "Legendary founder of the Inca dynasty and Cusco." }],
  ["viracocha", "Viracocha Inca", 1410, 1438, { c: "l", ap: true, after: null, s: "Eighth Sapa Inca, father of Pachacuti." }],
  ["pachacuti", "Pachacuti", 1438, 1471, { f: "viracocha", c: "m", ap: false, acc: "u", s: "Transformed Cusco into an empire and probably built Machu Picchu." }],
  ["topa-inca", "Topa Inca Yupanqui", 1471, 1493, { f: "pachacuti", c: "m", ap: false, acc: "i" }],
  ["huayna-capac", "Huayna Cápac", 1493, 1527, { f: "topa-inca", c: "m", ap: false, acc: "i", en: "d", s: "Died of an epidemic, probably smallpox, leaving a succession crisis." }],
  ["huascar", "Huáscar", 1527, 1532, { f: "huayna-capac", c: "h", ap: false, acc: "i", en: "p", s: "Defeated and captured by his half-brother Atahualpa in the Inca civil war." }],
  ["atahualpa", "Atahualpa", 1532, 1533, { f: "huayna-capac", sib: ["huascar"], c: "h", ap: false, acc: "u", us: "huascar", en: "d", s: "Captured by Francisco Pizarro at Cajamarca in 1532 and executed in 1533." }],
  ["manco-inca", "Manco Inca Yupanqui", 1533, 1544, { f: "huayna-capac", c: "h", ap: false, acc: "a", s: "Installed by the Spanish, he rebelled in 1536 and founded the Neo-Inca State at Vilcabamba." }],
  ["tupac-amaru", "Túpac Amaru", 1571, 1572, { f: "huayna-capac", c: "h", ap: false, acc: "i", after: "manco-inca", en: "c", s: "Last Sapa Inca of Vilcabamba, executed by the Spanish in 1572." }],
]);
const oc = (id, name, realm, civ, st, en, sum, o = {}) => H(id, name, realm, civ, OC, st, en, sum, o);
oc("kamehameha", "House of Kamehameha", "Kingdom of Hawaiʻi", "Hawaiian civilization", 1795, 1872, "Dynasty founded by Kamehameha I that unified the Hawaiian Islands.", { cap: "Lahaina / Honolulu", c: "h", ap: false });
oc("kalakaua", "House of Kalākaua", "Kingdom of Hawaiʻi", "Hawaiian civilization", 1874, 1893, "Last dynasty of the Kingdom of Hawaiʻi.", { c: "h", ap: false });
oc("tupou", "House of Tupou", "Kingdom of Tonga", "Tongan civilization", 1845, null, "Ruling dynasty of Tonga founded by Tāufaʻāhau Tupou I.", { cap: "Nukuʻalofa", c: "h", ap: false });
oc("pomare", "House of Pōmare", "Kingdom of Tahiti", "Tahitian civilization", 1791, 1880, "Dynasty that unified Tahiti.", { c: "m", ap: false });
oc("kingitanga", "Māori King Movement (Kīngitanga)", "Māori King Movement", "Māori civilization", 1858, null, "Hereditary Māori kingship founded in 1858 to unite tribes.", { cap: "Ngāruawāhia", c: "h", ap: false });
R("oc-hi", "Kingdom of Hawaiʻi", "kamehameha", "king", [
  ["kamehameha1", "Kamehameha I", 1795, 1819, { c: "h", ap: false, s: "Unified the Hawaiian Islands under one rule." }],
  ["kamehameha2", "Kamehameha II", 1819, 1824, { f: "kamehameha1", c: "h", ap: false, acc: "i" }],
  ["kamehameha3", "Kamehameha III", 1825, 1854, { f: "kamehameha1", sib: ["kamehameha2"], c: "h", ap: false, acc: "i" }],
  ["kamehameha4", "Kamehameha IV", 1855, 1863, { f: "~Mataio Kekūanāoʻa", c: "h", ap: false, acc: "i" }],
  ["kamehameha5", "Kamehameha V", 1863, 1872, { f: "~Mataio Kekūanāoʻa", sib: ["kamehameha4"], c: "h", ap: false, acc: "i" }],
  ["lunalilo", "Lunalilo", 1873, 1874, { c: "h", ap: false, acc: "e" }],
]);
R("oc-hi2", "Kingdom of Hawaiʻi", "kalakaua", "monarch", [
  ["kalakaua", "Kalākaua", 1874, 1891, { f: "~Caesar Kapaʻakea", c: "h", ap: false, acc: "e", after: "@oc-hi-lunalilo" }],
  ["liliuokalani", "Liliʻuokalani", 1891, 1893, { t: "queen regnant", f: "~Caesar Kapaʻakea", sib: ["kalakaua"], c: "h", ap: false, acc: "i", en: "p", s: "Last monarch of the Kingdom of Hawaiʻi, deposed in 1893." }],
]);
R("oc-to", "Kingdom of Tonga", "tupou", "king", [
  ["tupou1", "George Tupou I", 1845, 1893, { c: "h", ap: false, s: "Unified Tonga and granted its 1875 constitution." }],
  ["tupou2", "George Tupou II", 1893, 1918, { c: "h", ap: false, acc: "i" }],
  ["salote", "Salote Tupou III", 1918, 1965, { t: "queen regnant", f: "tupou2", c: "h", ap: false, acc: "i" }],
  ["tupou4", "Tāufaʻāhau Tupou IV", 1965, 2006, { m: "salote", c: "h", ap: false, acc: "i" }],
  ["tupou5", "George Tupou V", 2006, 2012, { f: "tupou4", c: "h", ap: false, acc: "i", en: "d" }],
  ["tupou6", "Tupou VI", 2012, null, { f: "tupou4", c: "h", ap: false, acc: "i" }],
]);
R("oc-ta", "Kingdom of Tahiti", "pomare", "king", [
  ["pomare1", "Pōmare I", 1791, 1803, { c: "m", ap: false }],
  ["pomare2", "Pōmare II", 1803, 1821, { f: "pomare1", c: "m", ap: false, acc: "i" }],
  ["pomare4", "Pōmare IV", 1827, 1877, { t: "queen regnant", f: "pomare2", c: "m", ap: false, acc: "i", after: "pomare2" }],
]);
R("oc-nz", "Māori King Movement", "kingitanga", "Māori king / queen", [
  ["potatau", "Pōtatau Te Wherowhero", 1858, 1860, { c: "h", ap: false }],
  ["tawhiao", "Tāwhiao", 1860, 1894, { f: "potatau", c: "h", ap: false, acc: "i" }],
  ["mahuta", "Mahuta Tāwhiao", 1894, 1912, { f: "tawhiao", c: "h", ap: false, acc: "i" }],
  ["te-rata", "Te Rata", 1912, 1933, { f: "mahuta", c: "h", ap: false, acc: "i" }],
  ["koroki", "Korokī Mahuta", 1933, 1966, { f: "mahuta", c: "h", ap: false, acc: "i" }],
  ["atairangikaahu", "Te Atairangikaahu", 1966, 2006, { t: "Māori queen", f: "koroki", c: "h", ap: false, acc: "i" }],
  ["tuheitia", "Tūheitia Paki", 2006, 2024, { m: "atairangikaahu", c: "h", ap: false, acc: "i", en: "d" }],
  ["nga-wai", "Nga wai hono i te pō", 2024, null, { t: "Māori queen", f: "tuheitia", c: "h", ap: false, acc: "i" }],
]);
export const { houses, monarchs, links } = S;

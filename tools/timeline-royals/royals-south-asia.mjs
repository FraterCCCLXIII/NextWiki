// Rulers of South Asia (Maurya to Mughal, Chola, Delhi, Maratha, Sikh, Mysore, Sri Lanka) and the Tibetan Empire.
import { makeShard, SA, CA } from "./curated/lib.mjs";
const S = makeShard("south-asia"); const { H, R } = S;
const sa = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Indian civilization", SA, st, en, sum, o);
sa("maurya", "Maurya dynasty", "Maurya Empire", -321, -185, "Dynasty founded by Chandragupta Maurya, which under Ashoka controlled most of the subcontinent.", { cap: "Pataliputra", ll: [25.6, 85.14], c: "h" });
sa("gupta", "Gupta dynasty", "Gupta Empire", 320, 550, "Dynasty of the classical age of northern India.", { cap: "Pataliputra", ll: [25.6, 85.14], c: "h" });
sa("pushyabhuti", "Pushyabhuti dynasty", "Thanesar / Kannauj", 606, 647, "Dynasty of Harsha in northern India.", { c: "m" });
sa("pala", "Pala dynasty", "Pala Empire", 750, 1161, "Buddhist dynasty of Bengal and Bihar.", { cap: "Pataliputra / Gauda", c: "m" });
sa("chola", "Chola dynasty", "Chola Empire", 848, 1279, "Tamil dynasty of the medieval Chola Empire.", { cap: "Thanjavur / Gangaikonda Cholapuram", ll: [10.79, 79.14], c: "h" });
sa("mamluk-delhi", "Delhi Sultanate (Mamluk dynasty)", "Delhi Sultanate", 1206, 1290, "First of the five dynasties of the Delhi Sultanate.", { cap: "Delhi", ll: [28.61, 77.21], c: "h", ap: false });
sa("khalji", "Khalji dynasty", "Delhi Sultanate", 1290, 1320, "Second dynasty of the Delhi Sultanate.", { cap: "Delhi", c: "h", ap: false });
sa("tughlaq", "Tughlaq dynasty", "Delhi Sultanate", 1320, 1414, "Third Delhi Sultanate dynasty.", { cap: "Delhi", c: "h", ap: false });
sa("lodi", "Lodi dynasty", "Delhi Sultanate", 1451, 1526, "Last dynasty of the Delhi Sultanate, of Pashtun origin.", { cap: "Delhi / Agra", c: "h", ap: false });
sa("vijayanagara", "Vijayanagara royal houses", "Vijayanagara Empire", 1336, 1646, "Rulers of the Vijayanagara Empire in the Deccan.", { cap: "Vijayanagara (Hampi)", ll: [15.34, 76.47], c: "h" });
sa("mughal", "Mughal dynasty (Timurid)", "Mughal Empire", 1526, 1857, "Timurid-Mongol dynasty founded by Babur that ruled much of South Asia.", { cap: "Agra / Delhi", ll: [28.66, 77.23], c: "h", ap: false });
sa("sur", "Sur dynasty", "Sur Empire", 1540, 1556, "Pashtun dynasty that interrupted Mughal rule under Sher Shah Suri.", { c: "h", ap: false });
sa("bhonsle", "Bhonsle dynasty (Maratha)", "Maratha Empire", 1674, 1818, "Chhatrapati line of the Maratha Empire founded by Shivaji.", { cap: "Raigad / Satara", ll: [18.23, 73.44], c: "h", ap: false });
sa("sikh-sukerchakia", "Sukerchakia family (Sikh Empire)", "Sikh Empire", 1799, 1849, "Ruling family of the Sikh Empire in Punjab.", { cap: "Lahore", ll: [31.55, 74.34], c: "h", ap: false });
sa("mysore-hyder", "Hyder Ali and Tipu Sultan (Mysore)", "Kingdom of Mysore", 1761, 1799, "De facto rulers of Mysore.", { cap: "Seringapatam", c: "h", ap: false });
sa("lanka", "Sinhalese royal lines", "Sri Lanka", -247, 1186, "Kings of the Anuradhapura and Polonnaruwa kingdoms.", { c: "m", ap: true });
H("tibet-yarlung", "Yarlung dynasty (Tibetan Empire)", "Tibetan Empire", "Tibetan civilization", CA, 618, 842, "Dynasty of the Tibetan Empire from Songtsen Gampo to Langdarma.", { cap: "Lhasa", ll: [29.65, 91.1], c: "m" });
R("in-maurya", "Maurya Empire", "maurya", "emperor", [
  ["chandragupta", "Chandragupta Maurya", -321, -297, { c: "m", acc: "c", s: "Founder of the Maurya Empire, who overthrew the Nanda dynasty." }],
  ["bindusara", "Bindusara", -297, -273, { f: "chandragupta", acc: "i", c: "m" }],
  ["ashoka", "Ashoka", -268, -232, { f: "bindusara", acc: "i", c: "m", s: "Maurya emperor who embraced Buddhism after the Kalinga war and left rock and pillar edicts." }],
  ["dasharatha", "Dasharatha Maurya", -232, -224, { c: "l", acc: "i", s: "Grandson of Ashoka and the next Maurya ruler." }],
  ["brihadratha", "Brihadratha Maurya", -187, -185, { c: "m", en: "d", s: "Last Maurya emperor, killed by his general Pushyamitra Shunga." }],
]);
R("in-gupta", "Gupta Empire", "gupta", "emperor", [
  ["chandragupta1", "Chandragupta I", 320, 335, { c: "m" }],
  ["samudragupta", "Samudragupta", 335, 375, { f: "chandragupta1", acc: "i", c: "m", s: "Conquering Gupta emperor celebrated in the Allahabad pillar inscription." }],
  ["chandragupta2", "Chandragupta II Vikramaditya", 375, 415, { f: "samudragupta", acc: "i", c: "m" }],
  ["kumaragupta1", "Kumaragupta I", 415, 455, { f: "chandragupta2", acc: "i", c: "m" }],
  ["skandagupta", "Skandagupta", 455, 467, { f: "kumaragupta1", acc: "i", c: "m", s: "Repelled the Hephthalite (Huna) invasions." }],
]);
R("in-harsha", "Kannauj", "pushyabhuti", "emperor", [["harsha", "Harsha", 606, 647, { c: "h", ap: false, s: "Northern Indian emperor who united much of the north; patron of Xuanzang's visit." }]]);
R("in-pala", "Pala Empire", "pala", "king", [
  ["gopala", "Gopala I", 750, 770, { acc: "e", c: "m", s: "Founder of the Pala dynasty, elected king by regional chiefs after a period of anarchy." }],
  ["dharmapala", "Dharmapala", 770, 810, { f: "gopala", acc: "i", c: "m" }],
  ["devapala", "Devapala", 810, 850, { f: "dharmapala", acc: "i", c: "m" }],
]);
R("in-chola", "Chola Empire", "chola", "king", [
  ["vijayalaya", "Vijayalaya Chola", 848, 871, { c: "m", s: "Founder of the medieval Chola dynasty, taking Thanjavur." }],
  ["aditya1", "Aditya I", 871, 907, { f: "vijayalaya", acc: "i", c: "m" }],
  ["parantaka1", "Parantaka I", 907, 955, { f: "aditya1", acc: "i", c: "m" }],
  ["parantaka2", "Parantaka II (Sundara Chola)", 957, 970, { c: "m", after: "parantaka1" }],
  ["uttama", "Uttama Chola", 970, 985, { c: "m", acc: "i" }],
  ["rajaraja1", "Rajaraja I", 985, 1014, { f: "parantaka2", acc: "a", c: "h", ap: false, s: "Chola emperor who built the Brihadisvara temple at Thanjavur and expanded into Sri Lanka and the Maldives." }],
  ["rajendra1", "Rajendra I", 1014, 1044, { f: "rajaraja1", acc: "i", c: "h", ap: false, s: "Extended Chola power to the Ganges and across the sea to Srivijaya." }],
  ["rajadhiraja", "Rajadhiraja I", 1044, 1052, { f: "rajendra1", acc: "i", c: "h", ap: false, en: "d" }],
  ["rajendra2", "Rajendra II", 1052, 1064, { f: "rajendra1", sib: ["rajadhiraja"], acc: "i", c: "h", ap: false }],
  ["virarajendra", "Virarajendra", 1063, 1070, { f: "rajendra1", sib: ["rajendra2"], acc: "i", c: "h", ap: false }],
  ["kulottunga1", "Kulothunga I", 1070, 1122, { c: "h", ap: false, acc: "i", s: "Son of the Eastern Chalukya Rajaraja Narendra, who united the Chalukya and Chola lines." }],
]);
R("in-delhi", "Delhi Sultanate", "mamluk-delhi", "sultan", [
  ["aibak", "Qutb ud-Din Aibak", 1206, 1210, { c: "h", ap: false, s: "First sultan of Delhi, a former slave-general of Muhammad of Ghor." }],
  ["iltutmish", "Shams ud-Din Iltutmish", 1211, 1236, { c: "h", ap: false, acc: "u" }],
  ["razia", "Razia Sultana", 1236, 1240, { t: "sultana", f: "iltutmish", c: "h", ap: false, acc: "i", en: "p", s: "Only woman to rule the Delhi Sultanate." }],
  ["balban", "Ghiyas ud-Din Balban", 1266, 1287, { c: "h", ap: false, acc: "a", after: "razia" }],
]);
R("in-khalji", "Delhi Sultanate", "khalji", "sultan", [
  ["jalaluddin", "Jalal ud-Din Khalji", 1290, 1296, { c: "h", ap: false, acc: "u", en: "d" }],
  ["alauddin", "Alauddin Khalji", 1296, 1316, { c: "h", ap: false, acc: "u", us: "jalaluddin", s: "Murdered his uncle Jalal ud-Din, repelled Mongol invasions and expanded into the Deccan." }],
]);
R("in-tughlaq", "Delhi Sultanate", "tughlaq", "sultan", [
  ["ghiyasuddin", "Ghiyath al-Din Tughluq", 1320, 1325, { c: "h", ap: false, acc: "u", en: "d" }],
  ["muhammad-tughluq", "Muhammad bin Tughluq", 1325, 1351, { f: "ghiyasuddin", c: "h", ap: false, acc: "i" }],
  ["firuz", "Firuz Shah Tughlaq", 1351, 1388, { c: "h", ap: false, acc: "i", s: "Cousin of Muhammad bin Tughluq, remembered for canals and public works." }],
]);
R("in-lodi", "Delhi Sultanate", "lodi", "sultan", [
  ["bahlul", "Bahlul Lodi", 1451, 1489, { c: "h", ap: false, s: "Founder of the Lodi dynasty." }],
  ["sikandar", "Sikandar Lodi", 1489, 1517, { f: "bahlul", c: "h", ap: false, acc: "i" }],
  ["ibrahim", "Ibrahim Lodi", 1517, 1526, { f: "sikandar", c: "h", ap: false, acc: "i", en: "d", s: "Last Delhi sultan, killed at the First Battle of Panipat." }],
]);
R("in-vijayanagara", "Vijayanagara Empire", "vijayanagara", "king", [
  ["harihara1", "Harihara I", 1336, 1356, { c: "m", ap: false, s: "Co-founder of Vijayanagara with his brother Bukka." }],
  ["bukka1", "Bukka Raya I", 1356, 1377, { sib: ["harihara1"], c: "m", ap: false }],
  ["krishnadevaraya", "Krishnadevaraya", 1509, 1529, { f: "~Tuluva Narasa Nayaka", c: "h", ap: false, after: null, s: "Greatest Vijayanagara emperor; patron of Telugu literature." }],
  ["achyuta", "Achyuta Deva Raya", 1529, 1542, { f: "~Tuluva Narasa Nayaka", sib: ["krishnadevaraya"], c: "h", ap: false, acc: "i" }],
]);
R("in-mughal", "Mughal Empire", "mughal", "emperor", [
  ["babur", "Babur", 1526, 1530, { f: "~Umar Sheikh Mirza II", b: 1483, d: 1530, c: "h", ap: false, acc: "c", s: "Founder of the Mughal dynasty after victory at Panipat (1526)." }],
  ["humayun", "Humayun", 1530, 1540, { f: "babur", acc: "i", c: "h", ap: false, en: "p" }],
  ["akbar", "Akbar", 1556, 1605, { f: "humayun", b: 1542, d: 1605, acc: "i", c: "h", ap: false, after: "humayun2", s: "Expanded the Mughal Empire and pursued religious tolerance and administrative reform." }],
  ["jahangir", "Jahangir", 1605, 1627, { f: "akbar", acc: "i", c: "h", ap: false }],
  ["shahjahan", "Shah Jahan", 1628, 1658, { f: "jahangir", sp: ["~Mumtaz Mahal"], acc: "i", c: "h", ap: false, en: "p", s: "Builder of the Taj Mahal; deposed by his son Aurangzeb." }],
  ["aurangzeb", "Aurangzeb", 1658, 1707, { f: "shahjahan", acc: "u", us: "shahjahan", c: "h", ap: false, s: "Took the throne after a war of succession and ruled the empire at its greatest extent." }],
  ["bahadur1", "Bahadur Shah I", 1707, 1712, { f: "aurangzeb", acc: "i", c: "h", ap: false }],
  ["jahandar", "Jahandar Shah", 1712, 1713, { f: "bahadur1", acc: "i", c: "h", ap: false, en: "p" }],
  ["farrukhsiyar", "Farrukhsiyar", 1713, 1719, { acc: "u", c: "h", ap: false, en: "p" }],
  ["muhammadshah", "Muhammad Shah", 1719, 1748, { acc: "a", c: "h", ap: false, s: "Reigned during Nader Shah's sack of Delhi in 1739." }],
  ["ahmadshah", "Ahmad Shah Bahadur", 1748, 1754, { f: "muhammadshah", acc: "i", c: "h", ap: false, en: "p" }],
  ["alamgir2", "Alamgir II", 1754, 1759, { f: "jahandar", acc: "a", c: "h", ap: false, en: "d" }],
  ["shahalam2", "Shah Alam II", 1759, 1806, { f: "alamgir2", acc: "i", c: "h", ap: false }],
  ["akbar2", "Akbar II", 1806, 1837, { f: "shahalam2", acc: "i", c: "h", ap: false }],
  ["bahadur2", "Bahadur Shah II (Zafar)", 1837, 1857, { f: "akbar2", acc: "i", c: "h", ap: false, en: "c", s: "Last Mughal emperor, exiled by the British after the 1857 rebellion." }],
]);
// Humayun's restoration is inserted before Akbar via an explicit second row
R("in-mughal", "Mughal Empire", "mughal", "emperor", [["humayun2", "Humayun (second reign)", 1555, 1556, { f: "babur", acc: "c", c: "h", ap: false, after: "@in-sur-sher-shah", en: "d", s: "Regained Delhi from the Suri in 1555 and died after an accident a year later." }]]);
R("in-sur", "Sur Empire", "sur", "sultan", [["sher-shah", "Sher Shah Suri", 1540, 1545, { c: "h", ap: false, acc: "c", us: "@in-mughal-humayun", after: "@in-mughal-humayun", s: "Defeated Humayun and founded the Sur Empire; introduced administrative reforms and the Grand Trunk Road." }]]);
R("in-maratha", "Maratha Empire", "bhonsle", "chhatrapati", [
  ["shivaji", "Shivaji", 1674, 1680, { b: 1630, d: 1680, c: "h", ap: false, f: "~Shahaji", s: "Founder of the Maratha Empire, crowned Chhatrapati at Raigad in 1674." }],
  ["sambhaji", "Sambhaji", 1681, 1689, { f: "shivaji", acc: "i", c: "h", ap: false, en: "d" }],
  ["rajaram", "Rajaram I", 1689, 1700, { f: "shivaji", sib: ["sambhaji"], acc: "i", c: "h", ap: false }],
  ["shahu", "Shahu I", 1707, 1749, { f: "sambhaji", acc: "i", c: "h", ap: false, s: "Son of Sambhaji, released from Mughal captivity; empowered the Peshwas." }],
]);
R("in-sikh", "Sikh Empire", "sikh-sukerchakia", "maharaja", [
  ["ranjit", "Ranjit Singh", 1799, 1839, { b: 1780, d: 1839, c: "h", ap: false, f: "~Maha Singh", s: "Founder of the Sikh Empire, ruling Punjab from Lahore." }],
  ["kharak", "Kharak Singh", 1839, 1840, { f: "ranjit", acc: "i", c: "h", ap: false }],
  ["sher", "Sher Singh", 1841, 1843, { f: "ranjit", sib: ["kharak"], acc: "i", c: "h", ap: false, en: "d" }],
  ["duleep", "Duleep Singh", 1843, 1849, { f: "ranjit", acc: "i", c: "h", ap: false, en: "c", s: "Last maharaja of the Sikh Empire, annexed by the British in 1849." }],
]);
R("in-mysore", "Mysore", "mysore-hyder", "sultan", [
  ["hyder", "Hyder Ali", 1761, 1782, { c: "h", ap: false, acc: "u" }],
  ["tipu", "Tipu Sultan", 1782, 1799, { f: "hyder", c: "h", ap: false, acc: "i", en: "d", s: "Known as the Tiger of Mysore; killed at the fall of Seringapatam." }],
]);
R("lk", "Sri Lanka", "lanka", "king", [
  ["devanampiya", "Devanampiya Tissa", -247, -207, { c: "m", s: "King of Anuradhapura said to have received Buddhism through Mahinda, son of Ashoka." }],
  ["dutugamunu", "Dutugamunu", -161, -137, { c: "m", s: "Sinhalese king who defeated the Chola ruler Elara and unified the island." }],
  ["parakramabahu1", "Parakramabahu I", 1153, 1186, { c: "h", ap: false }],
]);
R("tb", "Tibetan Empire", "tibet-yarlung", "emperor (tsenpo)", [
  ["songtsen", "Songtsen Gampo", 629, 650, { c: "m", ap: false, s: "Traditional founder of the Tibetan Empire and patron of the early Buddhist introduction." }],
  ["trisong", "Trisong Detsen", 755, 797, { c: "m", ap: false, s: "Emperor who invited Padmasambhava and founded Samye monastery." }],
  ["ralpacan", "Ralpacan", 815, 838, { c: "m", ap: false, en: "d" }],
  ["langdarma", "Langdarma", 838, 842, { c: "m", ap: false, sib: ["ralpacan"], en: "d", s: "Last emperor of the Tibetan Empire, associated with the persecution of Buddhism." }],
]);
export const { houses, monarchs, links } = S;

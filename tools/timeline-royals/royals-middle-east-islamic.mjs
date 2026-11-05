// Persian (Median to Pahlavi), Islamic caliphates and dynasties, and the Ottoman dynasty.
import { makeShard, ME, AN, NAF, MED, CA } from "./curated/lib.mjs";
const S = makeShard("middle-east-islamic"); const { H, R } = S;
const pe = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Persian civilization", ME, st, en, sum, o);
pe("media", "Median royal house", "Median Empire", -678, -550, "Rulers of the Median kingdom in Iran, known mainly from Greek and Assyrian sources.", { c: "l", ap: true });
pe("achaemenid", "Achaemenid dynasty", "Achaemenid Empire", -550, -330, "Persian dynasty founded by Cyrus the Great that ruled the largest empire of the ancient world.", { cap: "Pasargadae / Persepolis / Susa", ll: [29.93, 52.89], c: "h" });
pe("arsacid", "Arsacid dynasty (Parthia)", "Parthian Empire", -247, 224, "Parthian dynasty of Arsaces I that ruled Iran and Mesopotamia.", { cap: "Nisa / Ctesiphon", c: "m" });
pe("sasanian", "Sasanian dynasty", "Sasanian Empire", 224, 651, "Last pre-Islamic Persian dynasty, founded by Ardashir I.", { cap: "Ctesiphon", ll: [33.09, 44.58], c: "h", ap: false });
pe("safavid", "Safavid dynasty", "Safavid Iran", 1501, 1736, "Dynasty that made Twelver Shia Islam the state religion of Iran.", { cap: "Tabriz / Qazvin / Isfahan", ll: [32.65, 51.67], c: "h", ap: false });
pe("afsharid", "Afsharid dynasty", "Afsharid Iran", 1736, 1796, "Dynasty of Nader Shah.", { cap: "Mashhad", c: "h", ap: false });
pe("zand", "Zand dynasty", "Zand Iran", 1751, 1794, "Dynasty of Karim Khan Zand ruling from Shiraz.", { cap: "Shiraz", c: "h", ap: false });
pe("qajar", "Qajar dynasty", "Qajar Iran", 1789, 1925, "Turkic dynasty that ruled Iran until the Pahlavi coup.", { cap: "Tehran", ll: [35.69, 51.39], c: "h", ap: false });
pe("pahlavi", "Pahlavi dynasty", "Iran", 1925, 1979, "Last Iranian dynasty before the Islamic Republic.", { cap: "Tehran", ll: [35.69, 51.39], c: "h", ap: false });
const ca = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Islamic civilization", ME, st, en, sum, o);
ca("rashidun", "Rashidun Caliphate", "Rashidun Caliphate", 632, 661, "The first four caliphs after Muhammad, elected or appointed from his companions.", { cap: "Medina", ll: [24.47, 39.61], c: "h", ap: false });
ca("umayyad", "Umayyad dynasty", "Umayyad Caliphate", 661, 750, "First hereditary caliphal dynasty, ruling from Damascus.", { cap: "Damascus", ll: [33.51, 36.28], c: "h", ap: false });
ca("umayyad-cordoba", "Umayyad dynasty of Córdoba", "Al-Andalus", 756, 1031, "Branch of the Umayyads that ruled Iberia as emirs and then caliphs.", { cap: "Córdoba", ll: [37.88, -4.78], parent: "umayyad", region: MED, c: "h", ap: false });
ca("abbasid", "Abbasid dynasty", "Abbasid Caliphate", 750, 1258, "Caliphal dynasty descended from al-Abbas, ruling from Baghdad.", { cap: "Baghdad", ll: [33.31, 44.37], c: "h", ap: false });
ca("fatimid", "Fatimid dynasty", "Fatimid Caliphate", 909, 1171, "Ismaili Shia caliphate based in Ifriqiya and Egypt.", { cap: "Mahdia / Cairo", ll: [30.04, 31.24], c: "h", ap: false });
ca("ayyubid", "Ayyubid dynasty", "Ayyubid Sultanate", 1171, 1260, "Kurdish dynasty founded by Saladin.", { cap: "Cairo / Damascus", c: "h", ap: false });
ca("mamluk", "Mamluk Sultanate", "Mamluk Sultanate", 1250, 1517, "Slave-soldier sultanate in Egypt and Syria.", { cap: "Cairo", c: "h", ap: false });
ca("seljuk", "Seljuk dynasty", "Seljuk Empire", 1037, 1194, "Turkic dynasty that ruled Iran, Iraq and Anatolia.", { cap: "Nishapur / Isfahan", c: "h", ap: false });
ca("ghaznavid", "Ghaznavid dynasty", "Ghaznavid Empire", 977, 1186, "Turkic dynasty of Sabuktigin and Mahmud of Ghazni.", { cap: "Ghazni", c: "h", ap: false });
const ot = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Ottoman civilization", AN, st, en, sum, o);
ot("osmanli", "House of Osman (Ottoman dynasty)", "Ottoman Empire", 1299, 1922, "Dynasty that ruled the Ottoman Empire for over six centuries.", { cap: "Söğüt / Bursa / Edirne / Constantinople", ll: [41.01, 28.98], alt: ["Ottoman dynasty"], c: "h", ap: false });
const gr = "royals-middle-east-islamic";
R("ir-media", "Median Empire", "media", "king", [
  ["deioces", "Deioces", -678, -656, { leg: true, c: "l", s: "Founder of the Median kingdom according to Herodotus; historicity is uncertain." }],
  ["cyaxares", "Cyaxares", -625, -585, { c: "m", s: "Median king who allied with Babylon to destroy Assyria." }],
  ["astyages", "Astyages", -585, -550, { f: "cyaxares", acc: "i", c: "m", en: "c", s: "Last Median king, defeated by his grandson Cyrus the Great." }],
]);
R("ir-ach", "Achaemenid Empire", "achaemenid", "king of kings", [
  ["cyrus2", "Cyrus the Great", -559, -530, { f: "~Cambyses I", m: "~Mandane", c: "h", ap: false, acc: "i", s: "Founder of the Achaemenid Empire; conquered Media, Lydia and Babylon." }],
  ["cambyses2", "Cambyses II", -530, -522, { f: "cyrus2", c: "h", ap: false, acc: "i", s: "Conquered Egypt in 525 BCE." }],
  ["bardiya", "Bardiya (Smerdis)", -522, -522, { f: "cyrus2", sib: ["cambyses2"], c: "m", ap: false, acc: "?", s: "Brother of Cambyses II or an impostor, according to Darius's Behistun inscription." }],
  ["darius1", "Darius I", -522, -486, { f: "~Hystaspes", c: "h", ap: false, acc: "u", s: "Reorganised the empire into satrapies and built Persepolis; recorded his rise on the Behistun inscription." }],
  ["xerxes1", "Xerxes I", -486, -465, { f: "darius1", m: "~Atossa", c: "h", ap: false, acc: "i", en: "d", s: "Led the 480 BCE invasion of Greece." }],
  ["artaxerxes1", "Artaxerxes I", -465, -424, { f: "xerxes1", c: "h", ap: false, acc: "i" }],
  ["xerxes2", "Xerxes II", -424, -424, { f: "artaxerxes1", c: "h", ap: false, acc: "i", en: "d" }],
  ["darius2", "Darius II", -424, -404, { f: "artaxerxes1", c: "h", ap: false, acc: "u" }],
  ["artaxerxes2", "Artaxerxes II", -404, -358, { f: "darius2", c: "h", ap: false, acc: "i" }],
  ["artaxerxes3", "Artaxerxes III", -358, -338, { f: "artaxerxes2", c: "h", ap: false, acc: "i", en: "d" }],
  ["arses", "Arses (Artaxerxes IV)", -338, -336, { f: "artaxerxes3", c: "h", ap: false, acc: "a", en: "d" }],
  ["darius3", "Darius III", -336, -330, { f: "~Arsames", c: "h", ap: false, acc: "a", en: "d", s: "Last Achaemenid king, defeated by Alexander the Great and murdered by Bessus." }],
]);
R("ir-par", "Parthian Empire", "arsacid", "king of kings", [
  ["arsaces1", "Arsaces I", -247, -211, { c: "m", s: "Founder of the Arsacid dynasty of Parthia." }],
  ["mithridates1", "Mithridates I of Parthia", -171, -132, { c: "m", s: "Expanded Parthia into Mesopotamia and Media." }],
  ["mithridates2", "Mithridates II of Parthia", -124, -91, { c: "m" }],
  ["orodes2", "Orodes II", -57, -38, { c: "m", s: "Parthian king whose general Surena defeated Crassus at Carrhae in 53 BCE." }],
  ["phraates4", "Phraates IV", -38, -2, { f: "orodes2", c: "m", acc: "i" }],
  ["vologases1", "Vologases I", 51, 78, { c: "m", ap: false }],
  ["artabanus4", "Artabanus IV", 216, 224, { c: "m", ap: false, en: "c", s: "Last Parthian king, defeated by Ardashir I." }],
]);
R("ir-sas", "Sasanian Empire", "sasanian", "king of kings", [
  ["ardashir1", "Ardashir I", 224, 242, { c: "h", ap: false, acc: "c", s: "Overthrew the Parthians and founded the Sasanian Empire." }],
  ["shapur1", "Shapur I", 240, 270, { f: "ardashir1", c: "h", ap: false, acc: "i", s: "Captured the Roman emperor Valerian in 260." }],
  ["narseh", "Narseh", 293, 302, { c: "h", ap: false, acc: "u", after: null }],
  ["shapur2", "Shapur II", 309, 379, { f: "~Hormizd II", c: "h", ap: false, acc: "i", s: "Crowned in the womb according to tradition; ruled for 70 years." }],
  ["kavad1", "Kavad I", 488, 531, { c: "h", ap: false, acc: "i", after: null }],
  ["khosrow1", "Khosrow I", 531, 579, { f: "kavad1", c: "h", ap: false, acc: "i", s: "Sasanian king remembered for administrative and tax reforms." }],
  ["hormizd4", "Hormizd IV", 579, 590, { f: "khosrow1", c: "h", ap: false, acc: "i", en: "p" }],
  ["khosrow2", "Khosrow II", 590, 628, { f: "hormizd4", c: "h", ap: false, acc: "i", en: "p", s: "Conquered Roman Egypt and Syria in the Last Great War, then was deposed and executed." }],
  ["yazdegerd3", "Yazdegerd III", 632, 651, { f: "~Shahriyar", c: "h", ap: false, acc: "e", en: "d", s: "Last Sasanian king; the Arab conquest ended the empire during his reign." }],
]);
R("ir-saf", "Safavid Iran", "safavid", "shah", [
  ["ismail1", "Ismail I", 1501, 1524, { c: "h", ap: false, b: 1487, d: 1524, s: "Founder of the Safavid dynasty, who made Twelver Shiism the state religion." }],
  ["tahmasp1", "Tahmasp I", 1524, 1576, { f: "ismail1", c: "h", ap: false, acc: "i" }],
  ["abbas1", "Abbas the Great", 1588, 1629, { f: "~Mohammad Khodabanda", c: "h", ap: false, acc: "i", s: "Greatest Safavid shah, who moved the capital to Isfahan." }],
  ["sultan-husayn", "Sultan Husayn", 1694, 1722, { c: "h", ap: false, acc: "i", en: "p", s: "Last effective Safavid shah, deposed after the Afghan siege of Isfahan." }],
]);
R("ir-afs", "Afsharid Iran", "afsharid", "shah", [["nader", "Nader Shah", 1736, 1747, { c: "h", ap: false, b: 1688, d: 1747, acc: "e", en: "d", s: "Founder of the Afsharid dynasty; sacked Delhi in 1739." }]]);
R("ir-zand", "Zand Iran", "zand", "vakil", [["karim", "Karim Khan Zand", 1751, 1779, { c: "h", ap: false, s: "Ruled Iran from Shiraz as Vakil e-Ra'aya (regent of the people)." }]]);
R("ir-qajar", "Qajar Iran", "qajar", "shah", [
  ["agha-mohammad", "Agha Mohammad Khan", 1789, 1797, { c: "h", ap: false, s: "Founder of the Qajar dynasty." }],
  ["fath-ali", "Fath-Ali Shah Qajar", 1797, 1834, { c: "h", ap: false, acc: "i", s: "Nephew of Agha Mohammad Khan." }],
  ["mohammad-shah", "Mohammad Shah Qajar", 1834, 1848, { f: "~Abbas Mirza", c: "h", ap: false, acc: "i" }],
  ["naser", "Naser al-Din Shah Qajar", 1848, 1896, { f: "mohammad-shah", c: "h", ap: false, acc: "i", en: "d", s: "Longest-reigning Qajar shah; assassinated in 1896." }],
  ["mozaffar", "Mozaffar ad-Din Shah Qajar", 1896, 1907, { f: "naser", c: "h", ap: false, acc: "i", s: "Granted the Constitution of 1906." }],
]);
R("ir-pahlavi", "Iran", "pahlavi", "shah", [
  ["reza", "Reza Shah Pahlavi", 1925, 1941, { b: 1878, d: 1944, c: "h", ap: false, acc: "e", en: "a", s: "Army officer who founded the Pahlavi dynasty." }],
  ["mohammad-reza", "Mohammad Reza Pahlavi", 1941, 1979, { f: "reza", b: 1919, d: 1980, c: "h", ap: false, acc: "i", en: "p", s: "Last shah of Iran, overthrown in the 1979 revolution." }],
]);
R("ar-rash", "Rashidun Caliphate", "rashidun", "caliph", [
  ["abubakr", "Abu Bakr", 632, 634, { c: "h", ap: false, acc: "e", s: "First caliph; elected after Muhammad's death." }],
  ["umar", "Umar ibn al-Khattab", 634, 644, { c: "h", ap: false, acc: "a", en: "d", s: "Second caliph; directed the early conquests of Syria, Egypt and Iraq." }],
  ["uthman", "Uthman ibn Affan", 644, 656, { c: "h", ap: false, acc: "e", en: "d", s: "Third caliph; commissioned the standard text of the Quran." }],
  ["ali", "Ali ibn Abi Talib", 656, 661, { c: "h", ap: false, acc: "e", en: "d", s: "Fourth caliph and first Shia imam; his reign saw the First Fitna." }],
]);
R("ar-umay", "Umayyad Caliphate", "umayyad", "caliph", [
  ["muawiya1", "Muawiya I", 661, 680, { f: "~Abu Sufyan", c: "h", ap: false, acc: "u", s: "Founder of the Umayyad dynasty." }],
  ["yazid1", "Yazid I", 680, 683, { f: "muawiya1", c: "h", ap: false, acc: "i", s: "Reign saw the Battle of Karbala." }],
  ["marwan1", "Marwan I", 684, 685, { c: "h", ap: false, acc: "e", after: null }],
  ["abdalmalik", "Abd al-Malik", 685, 705, { f: "marwan1", c: "h", ap: false, acc: "i", s: "Built the Dome of the Rock and reformed the coinage." }],
  ["walid1", "al-Walid I", 705, 715, { f: "abdalmalik", c: "h", ap: false, acc: "i" }],
  ["sulayman", "Sulayman ibn Abd al-Malik", 715, 717, { f: "abdalmalik", sib: ["walid1"], c: "h", ap: false, acc: "i" }],
  ["umar2", "Umar II", 717, 720, { c: "h", ap: false, acc: "a" }],
  ["yazid2", "Yazid II", 720, 724, { f: "abdalmalik", c: "h", ap: false, acc: "i" }],
  ["hisham", "Hisham ibn Abd al-Malik", 724, 743, { f: "abdalmalik", c: "h", ap: false, acc: "i" }],
  ["marwan2", "Marwan II", 744, 750, { c: "h", ap: false, acc: "u", en: "d", s: "Last Umayyad caliph, defeated by the Abbasids at the Zab." }],
]);
R("ar-abb", "Abbasid Caliphate", "abbasid", "caliph", [
  ["saffah", "al-Saffah", 750, 754, { c: "h", ap: false, acc: "c", after: "@ar-umay-marwan2", s: "First Abbasid caliph after the revolution against the Umayyads." }],
  ["mansur", "al-Mansur", 754, 775, { c: "h", ap: false, acc: "i", sib: ["saffah"], s: "Founded Baghdad in 762." }],
  ["mahdi", "al-Mahdi", 775, 785, { f: "mansur", c: "h", ap: false, acc: "i" }],
  ["hadi", "al-Hadi", 785, 786, { f: "mahdi", c: "h", ap: false, acc: "i" }],
  ["harun", "Harun al-Rashid", 786, 809, { f: "mahdi", sib: ["hadi"], b: 763, c: "h", ap: false, acc: "i", s: "Fifth Abbasid caliph, whose court at Baghdad figures in the Arabian Nights." }],
  ["amin", "al-Amin", 809, 813, { f: "harun", c: "h", ap: false, acc: "i", en: "d" }],
  ["mamun", "al-Ma'mun", 813, 833, { f: "harun", sib: ["amin"], c: "h", ap: false, acc: "u", us: "amin", s: "Won the civil war against al-Amin; patron of the House of Wisdom." }],
  ["mutasim", "al-Mu'tasim", 833, 842, { f: "harun", sib: ["mamun"], c: "h", ap: false, acc: "i" }],
  ["wathiq", "al-Wathiq", 842, 847, { f: "mutasim", c: "h", ap: false, acc: "i" }],
  ["mutawakkil", "al-Mutawakkil", 847, 861, { f: "mutasim", sib: ["wathiq"], c: "h", ap: false, acc: "i", en: "d" }],
  ["nasir", "al-Nasir", 1180, 1225, { c: "h", ap: false, after: null }],
  ["mustasim", "al-Musta'sim", 1242, 1258, { c: "h", ap: false, after: "nasir", en: "c", s: "Last Abbasid caliph in Baghdad, killed in the Mongol sack of 1258." }],
]);
R("ar-cord", "Al-Andalus", "umayyad-cordoba", "emir / caliph", [
  ["abdalrahman1", "Abd al-Rahman I", 756, 788, { c: "h", ap: false, acc: "c", s: "Umayyad survivor who founded the emirate of Córdoba." }],
  ["abdalrahman3", "Abd al-Rahman III", 912, 961, { c: "h", ap: false, acc: "i", after: null, s: "Proclaimed the Caliphate of Córdoba in 929." }],
  ["hakam2", "al-Hakam II", 961, 976, { f: "abdalrahman3", c: "h", ap: false, acc: "i" }],
]);
R("ar-fat", "Fatimid Caliphate", "fatimid", "caliph", [
  ["mahdi", "Ubayd Allah al-Mahdi Billah", 909, 934, { c: "h", ap: false, s: "First Fatimid caliph, founder of Mahdia." }],
  ["muizz", "al-Mu'izz", 953, 975, { c: "h", ap: false, after: "mahdi", s: "Conquered Egypt in 969 and founded Cairo." }],
  ["hakim", "al-Hakim bi-Amr Allah", 996, 1021, { c: "h", ap: false, acc: "i", s: "Erratic Fatimid ruler who disappeared in 1021." }],
  ["mustansir", "al-Mustansir", 1036, 1094, { c: "h", ap: false, acc: "i", s: "Fatimid caliph with a 60-year reign, the longest of any Islamic ruler." }],
]);
R("ar-ayy", "Ayyubid Sultanate", "ayyubid", "sultan", [["saladin", "Saladin", 1174, 1193, { f: "~Najm ad-Din Ayyub", c: "h", ap: false, acc: "c", s: "Founder of the Ayyubid dynasty; retook Jerusalem in 1187." }]]);
R("ar-mam", "Mamluk Sultanate", "mamluk", "sultan", [
  ["baybars", "Baybars", 1260, 1277, { c: "h", ap: false, acc: "u", s: "Mamluk sultan who defeated the Mongols at Ain Jalut as a commander and consolidated Mamluk rule." }],
  ["qalawun", "Qalawun", 1279, 1290, { c: "h", ap: false, acc: "u", after: "baybars" }],
  ["khalil", "al-Ashraf Khalil", 1290, 1293, { f: "qalawun", c: "h", ap: false, acc: "i", s: "Captured Acre in 1291." }],
  ["nasir-muhammad", "al-Nasir Muhammad", 1293, 1341, { f: "qalawun", sib: ["khalil"], c: "h", ap: false, acc: "i", s: "Reigned in three stints; one of the longest-ruling Mamluk sultans." }],
]);
R("ar-selj", "Seljuk Empire", "seljuk", "sultan", [
  ["tughril", "Tughril", 1037, 1063, { c: "h", ap: false, s: "Founder of the Seljuk Empire; took Baghdad in 1055." }],
  ["alparslan", "Alp Arslan", 1063, 1072, { f: "~Chaghri Beg", c: "h", ap: false, acc: "i", s: "Defeated the Byzantines at Manzikert in 1071." }],
  ["malikshah", "Malik-Shah I", 1072, 1092, { f: "alparslan", c: "h", ap: false, acc: "i" }],
]);
R("ar-ghaz", "Ghaznavid Empire", "ghaznavid", "sultan", [
  ["sabuktigin", "Sabuktigin", 977, 997, { c: "h", ap: false }],
  ["mahmud", "Mahmud of Ghazni", 998, 1030, { f: "sabuktigin", c: "h", ap: false, acc: "u", s: "Raided northern India seventeen times and made Ghazni a centre of Persianate culture." }],
]);
const ott = [
  ["osman1", "Osman I", 1299, 1326, {}], ["orhan", "Orhan", 1326, 1362, { f: "osman1" }], ["murad1", "Murad I", 1362, 1389, { f: "orhan", en: "d" }],
  ["bayezid1", "Bayezid I", 1389, 1402, { f: "murad1", en: "c", s: "Captured by Timur at the Battle of Ankara in 1402." }],
  ["mehmed1", "Mehmed I", 1413, 1421, { f: "bayezid1", acc: "u", s: "Won the Ottoman Interregnum and reunified the realm." }],
  ["murad2", "Murad II", 1421, 1451, { f: "mehmed1", s: "Reigned in two stints (1421-1444, 1446-1451)." }],
  ["mehmed2", "Mehmed II", 1451, 1481, { f: "murad2", s: "Conqueror of Constantinople in 1453; also reigned briefly in 1444-1446." }],
  ["bayezid2", "Bayezid II", 1481, 1512, { f: "mehmed2", en: "a" }], ["selim1", "Selim I", 1512, 1520, { f: "bayezid2", acc: "u", us: "bayezid2", s: "Conquered the Mamluk Sultanate in 1516-1517 and took the caliphate." }],
  ["suleiman1", "Suleiman the Magnificent", 1520, 1566, { f: "selim1", sp: ["~Hürrem Sultan"], b: 1494, d: 1566, s: "Tenth sultan; took Belgrade, Rhodes and Hungary and codified Ottoman law." }],
  ["selim2", "Selim II", 1566, 1574, { f: "suleiman1" }], ["murad3", "Murad III", 1574, 1595, { f: "selim2" }], ["mehmed3", "Mehmed III", 1595, 1603, { f: "murad3" }],
  ["ahmed1", "Ahmed I", 1603, 1617, { f: "mehmed3" }], ["mustafa1", "Mustafa I", 1617, 1618, { f: "mehmed3", sib: ["ahmed1"], en: "p", s: "Reigned briefly in 1617-1618 and again in 1622-1623." }],
  ["osman2", "Osman II", 1618, 1622, { f: "ahmed1", en: "d", s: "Deposed and killed by the Janissaries." }], ["murad4", "Murad IV", 1623, 1640, { f: "ahmed1" }],
  ["ibrahim", "Ibrahim", 1640, 1648, { f: "ahmed1", en: "p" }], ["mehmed4", "Mehmed IV", 1648, 1687, { f: "ibrahim", en: "p" }],
  ["suleiman2", "Suleiman II", 1687, 1691, { f: "ibrahim", sib: ["mehmed4"] }], ["ahmed2", "Ahmed II", 1691, 1695, { f: "ibrahim", sib: ["mehmed4"] }],
  ["mustafa2", "Mustafa II", 1695, 1703, { f: "mehmed4", en: "p" }], ["ahmed3", "Ahmed III", 1703, 1730, { f: "mehmed4", sib: ["mustafa2"], en: "p" }],
  ["mahmud1", "Mahmud I", 1730, 1754, { f: "mustafa2" }], ["osman3", "Osman III", 1754, 1757, { f: "mustafa2", sib: ["mahmud1"] }],
  ["mustafa3", "Mustafa III", 1757, 1774, { f: "ahmed3" }], ["abdulhamid1", "Abdul Hamid I", 1774, 1789, { f: "ahmed3", sib: ["mustafa3"] }],
  ["selim3", "Selim III", 1789, 1807, { f: "mustafa3", en: "p", s: "Reformer deposed by a Janissary revolt." }], ["mustafa4", "Mustafa IV", 1807, 1808, { f: "abdulhamid1", en: "p" }],
  ["mahmud2", "Mahmud II", 1808, 1839, { f: "abdulhamid1", sib: ["mustafa4"], s: "Abolished the Janissaries in 1826 and began the Tanzimat-era reforms." }],
  ["abdulmejid1", "Abdulmejid I", 1839, 1861, { f: "mahmud2" }], ["abdulaziz", "Abdulaziz", 1861, 1876, { f: "mahmud2", sib: ["abdulmejid1"], en: "p" }],
  ["murad5", "Murad V", 1876, 1876, { f: "abdulmejid1", en: "p" }], ["abdulhamid2", "Abdul Hamid II", 1876, 1909, { f: "abdulmejid1", sib: ["murad5"], en: "p" }],
  ["mehmed5", "Mehmed V", 1909, 1918, { f: "abdulmejid1", sib: ["abdulhamid2"] }],
  ["mehmed6", "Mehmed VI", 1918, 1922, { f: "abdulmejid1", sib: ["mehmed5"], en: "p", s: "Last Ottoman sultan; the sultanate was abolished on 1 November 1922." }],
];
R("ot", "Ottoman Empire", "osmanli", "sultan", ott.map(([s, n, a, b, o]) => [s, n, a, b, { c: "h", ap: false, acc: o.f ? "i" : undefined, ...o }]));
export const { houses, monarchs, links } = S;

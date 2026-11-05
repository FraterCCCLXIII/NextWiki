// Pharaohs of Egypt (Early Dynastic to Ptolemaic) and kings of Sumer, Akkad, Babylon and Assyria. Hand-written layer; BCE dates are conventional and approximate.
import { makeShard, NAF, ME } from "./curated/lib.mjs";
const S = makeShard("egypt-mesopotamia"); const { H, R } = S;
const EG = "Ancient Egypt";
const eg = (id, name, ro, st, en, sum, o = {}) => H(id, name, "Egypt", EG, NAF, st, en, sum, { ll: [30.04, 31.24], ...o });
eg("egypt-dyn1", "First Dynasty of Egypt", 0, -3100, -2890, "Founding dynasty of unified Egypt, ruling from This/Memphis in the Early Dynastic Period.", { ap: true, c: "l" });
eg("egypt-dyn2", "Second Dynasty of Egypt", 0, -2890, -2686, "Early Dynastic dynasty ending with Khasekhemwy; see Old Kingdom beginnings.", { ap: true, c: "l" });
eg("egypt-dyn3", "Third Dynasty of Egypt", 0, -2686, -2613, "First dynasty of the Old Kingdom; built the Step Pyramid at Saqqara.", { cap: "Memphis" });
eg("egypt-dyn4", "Fourth Dynasty of Egypt", 0, -2613, -2494, "Pyramid-building dynasty of Sneferu, Khufu, Khafre and Menkaure.", { cap: "Memphis" });
eg("egypt-dyn5", "Fifth Dynasty of Egypt", 0, -2494, -2345, "Old Kingdom dynasty that built smaller pyramids and sun temples.", { cap: "Memphis" });
eg("egypt-dyn6", "Sixth Dynasty of Egypt", 0, -2345, -2181, "Last dynasty of the Old Kingdom; Pepi II had a very long reign.", { cap: "Memphis" });
eg("egypt-dyn11", "Eleventh Dynasty of Egypt", 0, -2125, -1985, "Theban dynasty that reunified Egypt under Mentuhotep II and began the Middle Kingdom.", { cap: "Thebes", ll: [25.7, 32.64] });
eg("egypt-dyn12", "Twelfth Dynasty of Egypt", 0, -1985, -1773, "Middle Kingdom high point under Amenemhat I and the Senusrets.", { cap: "Itjtawy" });
eg("egypt-dyn15", "Fifteenth Dynasty of Egypt (Hyksos)", 0, -1650, -1550, "Hyksos rulers of Asiatic origin who held the Delta from Avaris.", { cap: "Avaris", c: "m" });
eg("egypt-dyn17", "Seventeenth Dynasty of Egypt", 0, -1580, -1550, "Theban dynasty that fought the Hyksos and prepared the reunification of Egypt.", { cap: "Thebes", ll: [25.7, 32.64] });
eg("egypt-dyn18", "Eighteenth Dynasty of Egypt", 0, -1550, -1292, "Dynasty of Ahmose I, Hatshepsut, Thutmose III, Akhenaten and Tutankhamun at the height of the New Kingdom.", { cap: "Thebes", ll: [25.7, 32.64], c: "h" });
eg("egypt-dyn19", "Nineteenth Dynasty of Egypt", 0, -1292, -1189, "Ramesside dynasty of Seti I and Ramesses II.", { cap: "Pi-Ramesses", c: "h" });
eg("egypt-dyn20", "Twentieth Dynasty of Egypt", 0, -1189, -1077, "Last dynasty of the New Kingdom, dominated by Ramesses III and his namesakes.", { cap: "Pi-Ramesses", c: "h" });
eg("egypt-dyn21", "Twenty-first Dynasty of Egypt", 0, -1077, -943, "Tanis-based dynasty of the Third Intermediate Period alongside the high priests of Amun at Thebes.", { cap: "Tanis", c: "m" });
eg("egypt-dyn22", "Twenty-second Dynasty of Egypt (Libyan)", 0, -943, -722, "Dynasty of Libyan descent founded by Shoshenq I.", { cap: "Bubastis", c: "m" });
eg("egypt-dyn25", "Twenty-fifth Dynasty of Egypt (Kushite)", 0, -744, -656, "Kushite kings from Napata who ruled Egypt and Nubia.", { cap: "Napata", c: "m" });
eg("egypt-dyn26", "Twenty-sixth Dynasty of Egypt (Saite)", 0, -664, -525, "Last native dynasty before the Persian conquest, ruling from Sais.", { cap: "Sais", c: "h" });
eg("egypt-dyn30", "Thirtieth Dynasty of Egypt", 0, -380, -343, "Last native dynasty of pharaonic Egypt, founded by Nectanebo I.", { cap: "Sebennytos", c: "h" });
eg("ptolemaic", "Ptolemaic dynasty", 0, -305, -30, "Macedonian Greek dynasty founded by Ptolemy I that ruled Egypt until the death of Cleopatra VII.", { cap: "Alexandria", ll: [31.2, 29.92], alt: ["Lagid dynasty"], c: "h", ap: false });
// Early Dynastic
R("eg", "Egypt", "egypt-dyn1", "pharaoh", [
  ["narmer", "Narmer", -3100, -3050, { c: "l", s: "Early king associated with the unification of Upper and Lower Egypt; known from the Narmer Palette." }],
  ["hor-aha", "Hor-Aha", -3050, -3000, { c: "l" }],
  ["djer", "Djer", -3000, -2950, { c: "l" }],
  ["djet", "Djet", -2950, -2930, { c: "l" }],
  ["den", "Den", -2930, -2900, { c: "l" }],
  ["anedjib", "Anedjib", -2900, -2890, { c: "l" }],
  ["semerkhet", "Semerkhet", -2890, -2880, { c: "l" }],
  ["qaa", "Qa'a", -2880, -2850, { c: "l" }],
]);
R("eg", "Egypt", "egypt-dyn2", "pharaoh", [
  ["hotepsekhemwy", "Hotepsekhemwy", -2850, -2820, { c: "l", after: "qaa" }],
  ["nynetjer", "Nynetjer", -2800, -2760, { c: "l" }],
  ["khasekhemwy", "Khasekhemwy", -2700, -2686, { c: "l", s: "Last king of the Second Dynasty, who reunited the country after internal strife." }],
]);
R("eg", "Egypt", "egypt-dyn3", "pharaoh", [
  ["djoser", "Djoser", -2670, -2650, { c: "m", s: "Pharaoh whose architect Imhotep built the Step Pyramid at Saqqara, the first monumental stone building." }],
  ["sekhemkhet", "Sekhemkhet", -2650, -2640, { c: "m" }],
  ["huni", "Huni", -2630, -2613, { c: "l" }],
]);
R("eg", "Egypt", "egypt-dyn4", "pharaoh", [
  ["sneferu", "Sneferu", -2613, -2589, { c: "m", after: "huni" }],
  ["khufu", "Khufu", -2589, -2566, { f: "sneferu", c: "m", acc: "i", s: "Builder of the Great Pyramid of Giza." }],
  ["djedefre", "Djedefre", -2566, -2558, { f: "khufu", c: "m", acc: "i" }],
  ["khafre", "Khafre", -2558, -2532, { f: "khufu", c: "m", acc: "i", sib: ["djedefre"], s: "Builder of the second Giza pyramid, traditionally associated with the Great Sphinx." }],
  ["menkaure", "Menkaure", -2532, -2503, { f: "khafre", c: "m", acc: "i" }],
  ["shepseskaf", "Shepseskaf", -2503, -2498, { f: "menkaure", c: "m", acc: "i" }],
]);
R("eg", "Egypt", "egypt-dyn5", "pharaoh", [
  ["userkaf", "Userkaf", -2494, -2487, { c: "m", after: "shepseskaf" }],
  ["sahure", "Sahure", -2487, -2475, { c: "m", f: "userkaf" }],
  ["neferirkare", "Neferirkare Kakai", -2475, -2455, { c: "m" }],
  ["nyuserre", "Nyuserre Ini", -2445, -2422, { c: "m", f: "neferirkare" }],
  ["djedkare", "Djedkare Isesi", -2414, -2375, { c: "m" }],
  ["unas", "Unas", -2375, -2345, { c: "m", f: "djedkare" }],
]);
R("eg", "Egypt", "egypt-dyn6", "pharaoh", [
  ["teti", "Teti", -2345, -2333, { c: "m", after: "unas", s: "First king of the Sixth Dynasty; possibly assassinated by his guards." }],
  ["pepi1", "Pepi I", -2332, -2283, { c: "m", f: "teti", acc: "i" }],
  ["merenre1", "Merenre Nemtyemsaf I", -2283, -2278, { c: "m", f: "pepi1", acc: "i" }],
  ["pepi2", "Pepi II", -2278, -2184, { c: "m", f: "pepi1", acc: "i", sib: ["merenre1"], s: "Came to the throne as a child; his reign of about 90 years is among the longest recorded and ended the Old Kingdom's strength." }],
]);
// Middle Kingdom
R("eg", "Egypt", "egypt-dyn11", "pharaoh", [
  ["mentuhotep2", "Mentuhotep II", -2055, -2004, { c: "m", s: "Reunified Egypt after the First Intermediate Period, founding the Middle Kingdom." }],
  ["mentuhotep3", "Mentuhotep III", -2004, -1992, { f: "mentuhotep2", acc: "i" }],
  ["mentuhotep4", "Mentuhotep IV", -1992, -1985, { acc: "i" }],
]);
R("eg", "Egypt", "egypt-dyn12", "pharaoh", [
  ["amenemhat1", "Amenemhat I", -1991, -1962, { after: "mentuhotep4", acc: "?", en: "d", s: "Founder of the Twelfth Dynasty, probably the vizier of Mentuhotep IV; reportedly assassinated." }],
  ["senusret1", "Senusret I", -1971, -1926, { f: "amenemhat1", acc: "i" }],
  ["amenemhat2", "Amenemhat II", -1929, -1895, { f: "senusret1", acc: "i" }],
  ["senusret2", "Senusret II", -1897, -1878, { f: "amenemhat2", acc: "i" }],
  ["senusret3", "Senusret III", -1878, -1839, { f: "senusret2", acc: "i" }],
  ["amenemhat3", "Amenemhat III", -1860, -1814, { f: "senusret3", acc: "i" }],
  ["amenemhat4", "Amenemhat IV", -1814, -1805, { acc: "i" }],
  ["sobekneferu", "Sobekneferu", -1806, -1802, { t: "pharaoh (female)", f: "amenemhat3", acc: "i", s: "Female pharaoh and last ruler of the Twelfth Dynasty." }],
]);
R("eg", "Egypt", "egypt-dyn15", "pharaoh", [
  ["apepi", "Apepi", -1570, -1530, { after: null, c: "m", s: "Hyksos king ruling from Avaris whose dispute with the Theban king Seqenenre Tao is told in a later tale." }],
]);
R("eg", "Egypt", "egypt-dyn17", "pharaoh", [
  ["seqenenre", "Seqenenre Tao", -1558, -1553, { after: null, en: "?", c: "m", s: "Theban king whose mummy shows violent head wounds; fought the Hyksos." }],
  ["kamose", "Kamose", -1555, -1550, { f: "seqenenre", acc: "i", c: "m", s: "Last king of the Seventeenth Dynasty, who campaigned against the Hyksos." }],
]);
const ex = { c: "h", ap: false };
R("eg", "Egypt", "egypt-dyn18", "pharaoh", [
  ["ahmose1", "Ahmose I", -1550, -1525, { f: "seqenenre", m: "~Ahhotep I", sp: ["~Ahmose-Nefertari"], sib: ["kamose"], acc: "i", c: "m", ap: true, s: "Expelled the Hyksos and reunified Egypt, founding the Eighteenth Dynasty and the New Kingdom." }],
  ["amenhotep1", "Amenhotep I", -1525, -1504, { f: "ahmose1", m: "~Ahmose-Nefertari", acc: "i", c: "m", ap: true }],
  ["thutmose1", "Thutmose I", -1504, -1492, { acc: "?", c: "m", ap: true, s: "Campaigned in Nubia and the Levant; his successor line came through his children." }],
  ["thutmose2", "Thutmose II", -1492, -1479, { f: "thutmose1", sp: ["hatshepsut"], acc: "i", c: "m", ap: true }],
  ["hatshepsut", "Hatshepsut", -1479, -1458, { t: "pharaoh (female)", f: "thutmose1", sp: ["thutmose2"], acc: "r", rg: "thutmose3", c: "m", ap: true, after: "thutmose2", s: "Regent for Thutmose III who took the full pharaonic titulary and sent the expedition to Punt." }],
  ["thutmose3", "Thutmose III", -1479, -1425, { f: "thutmose2", acc: "i", after: "hatshepsut", c: "m", ap: true, s: "Led some seventeen campaigns and expanded Egypt's empire to its greatest extent." }],
  ["amenhotep2", "Amenhotep II", -1427, -1401, { f: "thutmose3", acc: "i", c: "m", ap: true }],
  ["thutmose4", "Thutmose IV", -1401, -1391, { f: "amenhotep2", acc: "i", c: "m", ap: true }],
  ["amenhotep3", "Amenhotep III", -1391, -1353, { f: "thutmose4", sp: ["~Tiye"], acc: "i", c: "m", ap: true }],
  ["akhenaten", "Akhenaten", -1353, -1336, { f: "amenhotep3", m: "~Tiye", sp: ["~Nefertiti"], acc: "i", c: "m", ap: true, alt: ["Amenhotep IV"], s: "Replaced the traditional cults with the worship of the Aten and moved the capital to Akhetaten (Amarna)." }],
  ["smenkhkare", "Smenkhkare", -1335, -1334, { c: "l", ap: true, s: "Obscure ruler of the Amarna period, possibly a co-regent of Akhenaten." }],
  ["tutankhamun", "Tutankhamun", -1332, -1323, { f: "akhenaten", sp: ["~Ankhesenamun"], acc: "i", c: "m", ap: true, s: "Boy king who restored the traditional gods; his intact tomb was found in 1922." }],
  ["ay", "Ay", -1323, -1319, { c: "m", ap: true, acc: "?" }],
  ["horemheb", "Horemheb", -1319, -1292, { c: "m", ap: true, acc: "a", s: "General who became king after Ay and ended the Amarna period; appointed Ramesses I as his successor." }],
]);
R("eg", "Egypt", "egypt-dyn19", "pharaoh", [
  ["ramesses1", "Ramesses I", -1292, -1290, { c: "m", ap: true, acc: "a", s: "Founder of the Nineteenth Dynasty, a military officer named heir by Horemheb." }],
  ["seti1", "Seti I", -1290, -1279, { f: "ramesses1", c: "m", acc: "i" }],
  ["ramesses2", "Ramesses II", -1279, -1213, { f: "seti1", sp: ["~Nefertari", "~Isetnofret"], acc: "i", c: "h", s: "Long-reigning pharaoh remembered for the Battle of Kadesh, the Egyptian-Hittite treaty and the temples of Abu Simbel." }],
  ["merneptah", "Merneptah", -1213, -1203, { f: "ramesses2", acc: "i", c: "h" }],
  ["seti2", "Seti II", -1203, -1197, { f: "merneptah", acc: "i", c: "m" }],
  ["amenmesse", "Amenmesse", -1203, -1200, { c: "m", acc: "u", after: "merneptah", s: "Probable rival claimant to the throne during the reign of Seti II." }],
  ["siptah", "Siptah", -1197, -1191, { acc: "i", c: "m", after: "seti2" }],
  ["twosret", "Twosret", -1191, -1189, { t: "pharaoh (female)", sp: ["seti2"], acc: "i", c: "m", s: "Queen of Seti II who ruled in her own right; last ruler of the Nineteenth Dynasty." }],
]);
R("eg", "Egypt", "egypt-dyn20", "pharaoh", [
  ["setnakhte", "Setnakhte", -1189, -1186, { c: "m", acc: "u", after: "twosret" }],
  ["ramesses3", "Ramesses III", -1186, -1155, { f: "setnakhte", acc: "i", c: "h", s: "Last great New Kingdom pharaoh, who repelled the Sea Peoples; murdered in the harem conspiracy." }],
  ["ramesses4", "Ramesses IV", -1155, -1149, { f: "ramesses3", acc: "i", c: "h" }],
  ["ramesses5", "Ramesses V", -1149, -1145, { f: "ramesses4", acc: "i", c: "h" }],
  ["ramesses6", "Ramesses VI", -1145, -1137, { f: "ramesses3", acc: "i", c: "h" }],
  ["ramesses7", "Ramesses VII", -1137, -1130, { f: "ramesses6", acc: "i", c: "h" }],
  ["ramesses8", "Ramesses VIII", -1130, -1129, { f: "ramesses3", acc: "i", c: "h" }],
  ["ramesses9", "Ramesses IX", -1129, -1111, { c: "h" }],
  ["ramesses10", "Ramesses X", -1111, -1107, { c: "h" }],
  ["ramesses11", "Ramesses XI", -1107, -1077, { c: "h", s: "Last king of the New Kingdom, whose later years saw Egypt effectively split between north and south." }],
]);
R("eg", "Egypt", "egypt-dyn21", "pharaoh", [
  ["smendes1", "Smendes I", -1077, -1051, { c: "m", s: "Founder of the Twenty-first Dynasty at Tanis after the death of Ramesses XI." }],
  ["psusennes1", "Psusennes I", -1047, -1001, { c: "m" }],
  ["amenemope", "Amenemope", -993, -984, { c: "m", f: "psusennes1" }],
  ["siamun", "Siamun", -978, -959, { c: "m" }],
  ["psusennes2", "Psusennes II", -959, -945, { c: "m" }],
]);
R("eg", "Egypt", "egypt-dyn22", "pharaoh", [
  ["shoshenq1", "Shoshenq I", -945, -924, { c: "m", after: "psusennes2", s: "Libyan-descended founder of the Twenty-second Dynasty, associated with a campaign into Israel and Judah." }],
  ["osorkon1", "Osorkon I", -924, -889, { f: "shoshenq1", acc: "i", c: "m" }],
  ["takelot1", "Takelot I", -889, -874, { c: "m" }],
  ["osorkon2", "Osorkon II", -874, -850, { f: "takelot1", acc: "i", c: "m" }],
  ["takelot2", "Takelot II", -850, -825, { c: "m" }],
  ["shoshenq3", "Shoshenq III", -825, -773, { c: "m" }],
]);
R("eg", "Egypt", "egypt-dyn25", "pharaoh", [
  ["piye", "Piye", -744, -714, { after: null, c: "m", acc: "c", s: "Kushite king who conquered Egypt and recorded his campaign on the Victory Stele." }],
  ["shabaka", "Shabaka", -714, -705, { sib: ["piye"], acc: "i", c: "m" }],
  ["shebitku", "Shebitku", -705, -690, { f: "piye", acc: "i", c: "m" }],
  ["taharqa", "Taharqa", -690, -664, { f: "piye", acc: "i", c: "m", s: "Kushite pharaoh who fought the Assyrians under Esarhaddon and Ashurbanipal." }],
  ["tantamani", "Tantamani", -664, -656, { f: "shabaka", acc: "i", c: "m", en: "c", s: "Last Kushite king of Egypt, driven out of the north by Ashurbanipal's Assyria." }],
]);
R("eg", "Egypt", "egypt-dyn26", "pharaoh", [
  ["psamtik1", "Psamtik I", -664, -610, { c: "h", acc: "a", after: null, s: "Founder of the Saite dynasty, who reunified Egypt after throwing off Assyrian overlordship." }],
  ["necho2", "Necho II", -610, -595, { f: "psamtik1", acc: "i", c: "h" }],
  ["psamtik2", "Psamtik II", -595, -589, { f: "necho2", acc: "i", c: "h" }],
  ["apries", "Apries", -589, -570, { f: "psamtik2", acc: "i", c: "h", en: "p" }],
  ["amasis2", "Amasis II", -570, -526, { acc: "u", us: "apries", c: "h", s: "General who overthrew Apries after a military revolt and ruled during Egypt's last prosperous native era." }],
  ["psamtik3", "Psamtik III", -526, -525, { f: "amasis2", acc: "i", c: "h", en: "c", s: "Last Saite king, defeated by Cambyses II of Persia at Pelusium." }],
]);
R("eg", "Egypt", "egypt-dyn30", "pharaoh", [
  ["nectanebo1", "Nectanebo I", -380, -362, { after: null, c: "h", acc: "u", s: "Founder of the Thirtieth Dynasty, who fended off Persian invasions." }],
  ["teos", "Teos", -362, -360, { f: "nectanebo1", acc: "i", c: "h", en: "p" }],
  ["nectanebo2", "Nectanebo II", -360, -343, { acc: "u", us: "teos", c: "h", en: "c", s: "Last native pharaoh of Egypt, defeated by Artaxerxes III." }],
]);
// Ptolemies
R("pt", "Egypt", "ptolemaic", "pharaoh", [
  ["ptolemy1", "Ptolemy I Soter", -305, -282, { f: "~Lagus", m: "~Arsinoe", sp: ["~Eurydice", "~Berenice I"], acc: "c", c: "h", ap: false, s: "Macedonian general of Alexander who made himself king of Egypt and founded the Ptolemaic dynasty." }],
  ["ptolemy2", "Ptolemy II Philadelphus", -282, -246, { f: "ptolemy1", m: "~Berenice I", sp: ["~Arsinoe I", "~Arsinoe II"], acc: "i", c: "h", ap: false }],
  ["ptolemy3", "Ptolemy III Euergetes", -246, -222, { f: "ptolemy2", m: "~Arsinoe I", sp: ["~Berenice II"], acc: "i", c: "h", ap: false }],
  ["ptolemy4", "Ptolemy IV Philopator", -222, -204, { f: "ptolemy3", m: "~Berenice II", sp: ["~Arsinoe III"], acc: "i", c: "h", ap: false }],
  ["ptolemy5", "Ptolemy V Epiphanes", -204, -180, { f: "ptolemy4", m: "~Arsinoe III", sp: ["~Cleopatra I"], acc: "i", c: "h", ap: false, s: "Boy king in whose reign the Rosetta Stone decree was issued (196 BCE)." }],
  ["ptolemy6", "Ptolemy VI Philometor", -180, -145, { f: "ptolemy5", m: "~Cleopatra I", sp: ["~Cleopatra II"], acc: "r", c: "h", ap: false }],
  ["ptolemy8", "Ptolemy VIII Physcon", -145, -116, { f: "ptolemy5", m: "~Cleopatra I", sp: ["~Cleopatra II", "~Cleopatra III"], sib: ["ptolemy6"], acc: "u", c: "h", ap: false }],
  ["ptolemy9", "Ptolemy IX Soter II (Lathyros)", -116, -107, { f: "ptolemy8", m: "~Cleopatra III", acc: "i", c: "h", ap: false }],
  ["ptolemy10", "Ptolemy X Alexander I", -107, -88, { f: "ptolemy8", m: "~Cleopatra III", acc: "i", c: "h", ap: false, sib: ["ptolemy9"] }],
  ["ptolemy11", "Ptolemy XI Alexander II", -80, -80, { f: "ptolemy10", acc: "i", c: "m", ap: false, s: "Briefly king in 80 BCE; murdered by the Alexandrians after killing his wife Berenice III." }],
  ["ptolemy12", "Ptolemy XII Auletes", -80, -51, { acc: "i", c: "h", ap: false, s: "Ptolemaic king restored to his throne with Roman help; father of Cleopatra VII." }],
  ["cleopatra7", "Cleopatra VII", -51, -30, { t: "queen regnant", f: "ptolemy12", sp: ["ptolemy13", "ptolemy14", "~Mark Antony"], acc: "i", c: "h", ap: false, en: "d", s: "Last active ruler of Ptolemaic Egypt; allied with Julius Caesar and Mark Antony; died after the defeat at Actium." }],
  ["ptolemy13", "Ptolemy XIII Theos Philopator", -51, -47, { f: "ptolemy12", sp: ["cleopatra7"], sib: ["cleopatra7"], acc: "i", c: "h", ap: false, nolink: true, after: "ptolemy12" }],
  ["ptolemy14", "Ptolemy XIV", -47, -44, { f: "ptolemy12", sp: ["cleopatra7"], sib: ["cleopatra7"], acc: "a", c: "h", ap: false, nolink: true, after: "ptolemy13" }],
  ["ptolemy15", "Ptolemy XV Caesarion", -44, -30, { m: "cleopatra7", f: "~Julius Caesar", acc: "i", c: "h", ap: false, en: "c", nolink: true, after: "ptolemy14" }],
]);
// ---------- Mesopotamia ----------
const mes = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Ancient Mesopotamia", ME, st, en, sum, o);
mes("sumer-kinglist", "Kings of the Sumerian King List", "Sumer", -2900, -2334, "Rulers of the Sumerian city states as listed in the Sumerian King List, mixing mythical and historical figures.", { c: "l" });
mes("akkad-sargonic", "Sargonic dynasty (Akkad)", "Akkadian Empire", -2334, -2154, "Dynasty of Sargon of Akkad, ruler of the first Mesopotamian empire.", { cap: "Akkad", c: "m" });
mes("ur3", "Third Dynasty of Ur", "Ur III", -2112, -2004, "Neo-Sumerian dynasty founded by Ur-Nammu, ruling Sumer and Akkad from Ur.", { cap: "Ur", ll: [30.96, 46.1], c: "m" });
mes("babylon-amorite", "First Babylonian dynasty (Amorite)", "Babylon", -1894, -1595, "Amorite dynasty of Hammurabi, which made Babylon a major power.", { cap: "Babylon", ll: [32.54, 44.42], c: "m" });
mes("assyria-ashur", "Assyrian royal line", "Assyria", -1363, -609, "Kings of Assyria in the Middle and Neo-Assyrian periods, from Ashur-uballit I to the fall of Nineveh.", { cap: "Assur / Nimrud / Nineveh", ll: [36.36, 43.15], c: "m" });
mes("babylon-chaldean", "Neo-Babylonian (Chaldean) dynasty", "Babylon", -626, -539, "Dynasty of Nabopolassar that destroyed Assyria and ruled Babylon until its conquest by Cyrus.", { cap: "Babylon", ll: [32.54, 44.42], c: "h" });
R("su", "Sumer", "sumer-kinglist", "king", [
  ["alulim", "Alulim", -2900, null, { leg: true, s: "First king of the Sumerian King List, said to have ruled Eridu for a mythically long time." }],
  ["etana", "Etana", -2800, null, { leg: true, s: "Legendary king of Kish who, in myth, ascended to heaven on an eagle." }],
  ["gilgamesh", "Gilgamesh", -2700, null, { leg: true, c: "l", s: "King of Uruk in the Sumerian King List, hero of the Epic of Gilgamesh and possibly a historical ruler." }],
]);
R("ak", "Akkadian Empire", "akkad-sargonic", "king", [
  ["sargon", "Sargon of Akkad", -2334, -2279, { c: "m", acc: "u", s: "Founder of the Akkadian Empire, who united Mesopotamian city states and reached the Mediterranean." }],
  ["rimush", "Rimush", -2279, -2270, { f: "sargon", acc: "i", c: "m" }],
  ["manishtushu", "Manishtushu", -2270, -2255, { f: "sargon", sib: ["rimush"], acc: "i", c: "m" }],
  ["naram-sin", "Naram-Sin", -2254, -2218, { f: "manishtushu", acc: "i", c: "m", s: "Grandson of Sargon, who took the title King of the Four Quarters." }],
  ["shar-kali-sharri", "Shar-Kali-Sharri", -2217, -2193, { f: "naram-sin", acc: "i", c: "m" }],
]);
R("ur", "Ur III", "ur3", "king", [
  ["ur-nammu", "Ur-Nammu", -2112, -2095, { c: "m", s: "Founder of the Third Dynasty of Ur, to whom the oldest surviving law code is attributed." }],
  ["shulgi", "Shulgi", -2094, -2047, { f: "ur-nammu", acc: "i", c: "m" }],
  ["amar-sin", "Amar-Sin", -2046, -2038, { f: "shulgi", acc: "i", c: "m" }],
  ["shu-sin", "Shu-Sin", -2037, -2029, { f: "shulgi", sib: ["amar-sin"], acc: "i", c: "m" }],
  ["ibbi-sin", "Ibbi-Sin", -2028, -2004, { f: "shu-sin", acc: "i", c: "m", en: "c", s: "Last king of Ur III, whose state collapsed under Amorite pressure and an Elamite sack of Ur." }],
]);
R("bb", "Babylon", "babylon-amorite", "king", [
  ["sumu-abum", "Sumu-abum", -1894, -1881, { c: "m", s: "Founder of the first dynasty of Babylon." }],
  ["sumu-la-el", "Sumu-la-El", -1880, -1845, { c: "m" }],
  ["sabium", "Sabium", -1844, -1831, { f: "sumu-la-el", acc: "i", c: "m" }],
  ["apil-sin", "Apil-Sin", -1830, -1813, { f: "sabium", acc: "i", c: "m" }],
  ["sin-muballit", "Sin-Muballit", -1812, -1793, { f: "apil-sin", acc: "i", c: "m" }],
  ["hammurabi", "Hammurabi", -1792, -1750, { f: "sin-muballit", acc: "i", c: "h", s: "Sixth king of Babylon, who unified much of Mesopotamia and issued the famous law stele." }],
  ["samsu-iluna", "Samsu-iluna", -1750, -1712, { f: "hammurabi", acc: "i", c: "m" }],
  ["abi-eshuh", "Abi-Eshuh", -1711, -1684, { f: "samsu-iluna", acc: "i", c: "m" }],
  ["ammi-ditana", "Ammi-Ditana", -1683, -1647, { f: "abi-eshuh", acc: "i", c: "m" }],
  ["ammi-saduqa", "Ammi-Saduqa", -1646, -1627, { f: "ammi-ditana", acc: "i", c: "m" }],
  ["samsu-ditana", "Samsu-Ditana", -1626, -1595, { f: "ammi-saduqa", acc: "i", c: "m", en: "c", s: "Last king of the dynasty; Babylon fell to the Hittite king Mursili I." }],
]);
R("as", "Assyria", "assyria-ashur", "king", [
  ["ashur-uballit1", "Ashur-uballit I", -1363, -1328, { c: "m", s: "Freed Assyria from Mitanni domination and began the Middle Assyrian Empire." }],
  ["adad-nirari1", "Adad-nirari I", -1305, -1274, { c: "m", after: "ashur-uballit1" }],
  ["shalmaneser1", "Shalmaneser I", -1273, -1244, { f: "adad-nirari1", acc: "i", c: "m" }],
  ["tukulti-ninurta1", "Tukulti-Ninurta I", -1243, -1207, { f: "shalmaneser1", acc: "i", c: "m", en: "d", s: "Conquered Babylon; later murdered in a revolt led by his son." }],
  ["tiglath-pileser1", "Tiglath-Pileser I", -1114, -1076, { c: "m", after: "tukulti-ninurta1" }],
  ["tukulti-ninurta2", "Tukulti-Ninurta II", -890, -884, { c: "m", after: "tiglath-pileser1" }],
  ["ashurnasirpal2", "Ashurnasirpal II", -883, -859, { f: "tukulti-ninurta2", acc: "i", c: "h", s: "Neo-Assyrian king who built a new capital at Nimrud and campaigned with notorious brutality." }],
  ["shalmaneser3", "Shalmaneser III", -859, -824, { f: "ashurnasirpal2", acc: "i", c: "h" }],
  ["shamshi-adad5", "Shamshi-Adad V", -824, -811, { f: "shalmaneser3", acc: "i", c: "h" }],
  ["adad-nirari3", "Adad-nirari III", -811, -783, { f: "shamshi-adad5", acc: "i", c: "h" }],
  ["tiglath-pileser3", "Tiglath-Pileser III", -745, -727, { acc: "u", c: "h", after: "adad-nirari3", s: "Seized the throne during a revolt and reorganised the Neo-Assyrian empire." }],
  ["shalmaneser5", "Shalmaneser V", -727, -722, { f: "tiglath-pileser3", acc: "i", c: "h" }],
  ["sargon2", "Sargon II", -722, -705, { acc: "u", us: "shalmaneser5", c: "h", s: "Neo-Assyrian king who took Samaria and built the capital Dur-Sharrukin." }],
  ["sennacherib", "Sennacherib", -705, -681, { f: "sargon2", acc: "i", c: "h", en: "d", s: "Destroyed Babylon in 689 BCE, besieged Jerusalem, and was murdered by his sons." }],
  ["esarhaddon", "Esarhaddon", -681, -669, { f: "sennacherib", acc: "i", c: "h" }],
  ["ashurbanipal", "Ashurbanipal", -669, -631, { f: "esarhaddon", acc: "i", c: "h", s: "Last great Assyrian king; assembled the library of Nineveh." }],
  ["ashur-etil-ilani", "Ashur-etil-ilani", -631, -627, { f: "ashurbanipal", acc: "i", c: "m" }],
  ["sinsharishkun", "Sinsharishkun", -627, -612, { f: "ashurbanipal", sib: ["ashur-etil-ilani"], acc: "i", c: "m", en: "d" }],
  ["ashur-uballit2", "Ashur-uballit II", -612, -609, { c: "m", en: "c", s: "Last king of Assyria, who held out at Harran after the fall of Nineveh." }],
]);
R("nb", "Babylon", "babylon-chaldean", "king", [
  ["nabopolassar", "Nabopolassar", -626, -605, { c: "h", acc: "u", s: "Founder of the Neo-Babylonian empire, who allied with the Medes to destroy Assyria." }],
  ["nebuchadnezzar2", "Nebuchadnezzar II", -605, -562, { f: "nabopolassar", acc: "i", c: "h", s: "Greatest Neo-Babylonian king; destroyed Jerusalem in 587/586 BCE and rebuilt Babylon." }],
  ["amel-marduk", "Amel-Marduk", -562, -560, { f: "nebuchadnezzar2", acc: "i", c: "h", en: "d" }],
  ["neriglissar", "Neriglissar", -560, -556, { sp: [], acc: "u", us: "amel-marduk", c: "h" }],
  ["labashi-marduk", "Labashi-Marduk", -556, -556, { f: "neriglissar", acc: "i", c: "h", en: "p" }],
  ["nabonidus", "Nabonidus", -556, -539, { acc: "u", us: "labashi-marduk", c: "h", en: "c", s: "Last king of Babylon, defeated by Cyrus the Great in 539 BCE." }],
]);
export const { houses, monarchs, links } = S;

// Kings of Rome, Roman emperors (Augustus to the fall of the West), Byzantine emperors, and Macedonian / Hellenistic kings.
import { makeShard, MED, AN, ME } from "./curated/lib.mjs";
const S = makeShard("rome-byzantium-hellenistic"); const { H, R } = S;
const ro = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Roman civilization", MED, st, en, sum, { ll: [41.89, 12.49], ...o });
ro("rome-kings", "Roman kings", "Kingdom of Rome", -753, -509, "Traditional seven kings of Rome, known largely through later legend.", { c: "l" });
ro("julio-claudian", "Julio-Claudian dynasty", "Roman Empire", -27, 68, "First imperial dynasty of Rome, from Augustus to Nero.", { c: "h", ap: false });
ro("year-four-emperors", "Year of the Four Emperors rulers", "Roman Empire", 68, 69, "Galba, Otho and Vitellius, who held the throne between the Julio-Claudians and the Flavians.", { c: "h", ap: false });
ro("flavian", "Flavian dynasty", "Roman Empire", 69, 96, "Dynasty of Vespasian, Titus and Domitian.", { c: "h", ap: false });
ro("nerva-antonine", "Nerva-Antonine dynasty", "Roman Empire", 96, 192, "Dynasty of the Five Good Emperors and their adoptive successors, ending with Commodus.", { c: "h", ap: false });
ro("severan", "Severan dynasty", "Roman Empire", 193, 235, "Dynasty of Septimius Severus and his descendants.", { c: "h", ap: false });
ro("crisis-emperors", "Soldier-emperors of the Crisis of the Third Century", "Roman Empire", 235, 284, "Short-reigning emperors, often raised by the army, during the third-century crisis.", { c: "m", ap: false });
ro("tetrarchy", "Tetrarchy and Constantinian dynasty", "Roman Empire", 284, 363, "Diocletian's tetrarchy and the Constantinian dynasty that followed it.", { c: "h", ap: false, alt: ["Constantinian dynasty"] });
ro("valentinian-theodosian", "Valentinianic and Theodosian dynasties", "Roman Empire", 364, 455, "Emperors of the late fourth and early fifth centuries, ending in the West with Valentinian III.", { c: "h", ap: false });
ro("late-western", "Late Western emperors", "Western Roman Empire", 455, 480, "Short-lived emperors of the final decades of the Western Roman Empire.", { c: "h", ap: false });
const bz = (id, name, st, en, sum, o = {}) => H(id, name, "Byzantine Empire", "Byzantine civilization", MED, st, en, sum, { cap: "Constantinople", ll: [41.01, 28.98], c: "h", ap: false, ...o });
bz("leonid", "Leonid dynasty", 457, 518, "Dynasty of Leo I and Zeno in the East.");
bz("justinian-house", "Justinian dynasty", 518, 602, "Dynasty of Justin I and Justinian I.");
bz("heraclian", "Heraclian dynasty", 610, 711, "Dynasty founded by Heraclius.");
bz("isaurian", "Isaurian (Syrian) dynasty", 717, 802, "Dynasty of Leo III and his descendants, associated with Iconoclasm.");
bz("amorian-nikephorian", "Nikephorian and Amorian dynasties", 802, 867, "Dynasties from Nikephoros I to Michael III.");
bz("macedonian", "Macedonian dynasty", 867, 1056, "Dynasty of Basil I that presided over the empire's medieval revival.");
bz("doukas-and-others", "Interim emperors 1056-1081", 1056, 1081, "Short reigns between the Macedonian and Komnenian dynasties (Doukas, Diogenes, Botaneiates and others).");
bz("komnenos", "Komnenos dynasty", 1081, 1185, "Dynasty of Alexios I, John II and Manuel I.");
bz("angelos", "Angelos dynasty", 1185, 1204, "Dynasty ruling just before the Fourth Crusade.");
bz("laskaris", "Laskaris dynasty (Nicaea)", 1204, 1261, "Dynasty of the empire in exile at Nicaea.", { cap: "Nicaea" });
bz("palaiologos", "Palaiologos dynasty", 1259, 1453, "Last Byzantine dynasty, restoring Constantinople in 1261.");
const hl = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Hellenistic civilization", MED, st, en, sum, o);
hl("argead", "Argead dynasty", "Macedon", -700, -310, "Royal house of Macedon, from Philip II and Alexander the Great.", { c: "m", ap: true });
hl("seleucid", "Seleucid dynasty", "Seleucid Empire", -312, -63, "Hellenistic dynasty founded by Seleucus I Nicator.", { cap: "Antioch", ll: [36.2, 36.16], c: "h", ap: false });
hl("antigonid", "Antigonid dynasty", "Macedon", -306, -168, "Hellenistic dynasty ruling Macedon.", { c: "h", ap: false });
hl("mithridatic", "Mithridatic dynasty (Pontus)", "Kingdom of Pontus", -302, -63, "Persian-descended dynasty of Pontus on the Black Sea.", { c: "h", ap: false, region: AN });
hl("herodian", "Herodian dynasty", "Judea", -37, 100, "Client kings of Judea under Rome.", { c: "h", ap: false, region: ME });
// ---- Rome ----
R("rm-k", "Kingdom of Rome", "rome-kings", "king", [
  ["romulus", "Romulus", -753, -716, { leg: true, s: "Legendary founder and first king of Rome." }],
  ["numa", "Numa Pompilius", -715, -673, { leg: true, s: "Legendary second king, credited with Rome's early religious institutions." }],
  ["tullus", "Tullus Hostilius", -673, -642, { leg: true }],
  ["ancus", "Ancus Marcius", -642, -617, { leg: true }],
  ["tarquinius-priscus", "Tarquinius Priscus", -616, -579, { leg: true }],
  ["servius", "Servius Tullius", -578, -535, { leg: true }],
  ["tarquinius-superbus", "Tarquinius Superbus", -535, -509, { leg: true, en: "p", s: "Last king of Rome, traditionally expelled in 509 BCE, founding the Republic." }],
]);
R("rm", "Roman Empire", "julio-claudian", "emperor", [
  ["augustus", "Augustus", -27, 14, { f: "~Gaius Octavius", sp: ["~Livia Drusilla"], b: -62, d: 14, acc: "a", c: "h", s: "First Roman emperor, adopted heir of Julius Caesar." }],
  ["tiberius", "Tiberius", 14, 37, { f: "~Tiberius Claudius Nero", b: -41, d: 37, acc: "a", c: "h" }],
  ["caligula", "Caligula", 37, 41, { f: "~Germanicus", b: 12, d: 41, acc: "a", c: "h", en: "d" }],
  ["claudius", "Claudius", 41, 54, { f: "~Nero Claudius Drusus", b: -10, d: 54, acc: "a", c: "h", en: "d", s: "Proclaimed emperor by the Praetorian Guard after Caligula's murder; conquered Britain." }],
  ["nero", "Nero", 54, 68, { f: "~Gnaeus Domitius Ahenobarbus", m: "~Agrippina the Younger", sp: ["~Poppaea Sabina"], b: 37, d: 68, acc: "a", c: "h", en: "d", s: "Last Julio-Claudian emperor; died by suicide during a rebellion." }],
]);
R("rm", "Roman Empire", "year-four-emperors", "emperor", [
  ["galba", "Galba", 68, 69, { acc: "?", c: "h", en: "d" }], ["otho", "Otho", 69, 69, { acc: "u", us: "galba", c: "h", en: "d" }], ["vitellius", "Vitellius", 69, 69, { acc: "u", us: "otho", c: "h", en: "d" }],
]);
R("rm", "Roman Empire", "flavian", "emperor", [
  ["vespasian", "Vespasian", 69, 79, { b: 9, d: 79, acc: "u", us: "vitellius", c: "h", s: "Founder of the Flavian dynasty who emerged victorious in the Year of the Four Emperors." }],
  ["titus", "Titus", 79, 81, { f: "vespasian", acc: "i", c: "h", s: "Destroyed Jerusalem's Temple in 70 and reigned during the eruption of Vesuvius." }],
  ["domitian", "Domitian", 81, 96, { f: "vespasian", sib: ["titus"], acc: "i", c: "h", en: "d" }],
]);
R("rm", "Roman Empire", "nerva-antonine", "emperor", [
  ["nerva", "Nerva", 96, 98, { acc: "a", c: "h", s: "Chosen by the Senate after Domitian's assassination." }],
  ["trajan", "Trajan", 98, 117, { f: "~Marcus Ulpius Traianus", acc: "a", c: "h", s: "Took the empire to its greatest territorial extent." }],
  ["hadrian", "Hadrian", 117, 138, { acc: "a", c: "h" }],
  ["antoninus", "Antoninus Pius", 138, 161, { acc: "a", c: "h" }],
  ["marcus", "Marcus Aurelius", 161, 180, { f: "~Marcus Annius Verus", acc: "a", c: "h", en: "d", s: "Philosopher-emperor and author of the Meditations." }],
  ["verus", "Lucius Verus", 161, 169, { f: "~Lucius Aelius Caesar", acc: "a", c: "h", en: "d", nolink: true, after: "antoninus" }],
  ["commodus", "Commodus", 177, 192, { f: "marcus", acc: "i", c: "h", en: "d", after: "marcus", s: "Co-emperor with his father from 177; assassinated in 192." }],
]);
R("rm", "Roman Empire", "severan", "emperor", [
  ["pertinax", "Pertinax", 193, 193, { acc: "a", c: "h", en: "d", h: "severan", after: "commodus" }],
  ["didius", "Didius Julianus", 193, 193, { acc: "a", c: "h", en: "d", h: "severan" }],
  ["septimius", "Septimius Severus", 193, 211, { acc: "u", us: "didius", c: "h", sp: ["~Julia Domna"] }],
  ["caracalla", "Caracalla", 198, 217, { f: "septimius", m: "~Julia Domna", acc: "i", c: "h", en: "d", after: "septimius", s: "Granted citizenship to nearly all free inhabitants in 212 (Constitutio Antoniniana)." }],
  ["geta", "Geta", 209, 211, { f: "septimius", m: "~Julia Domna", sib: ["caracalla"], acc: "i", c: "h", en: "d", nolink: true, after: "septimius" }],
  ["macrinus", "Macrinus", 217, 218, { acc: "u", us: "caracalla", c: "h", en: "d" }],
  ["elagabalus", "Elagabalus", 218, 222, { acc: "u", us: "macrinus", c: "h", en: "d" }],
  ["severus-alexander", "Severus Alexander", 222, 235, { acc: "a", c: "h", en: "d" }],
]);
R("rm", "Roman Empire", "crisis-emperors", "emperor", [
  ["maximinus", "Maximinus Thrax", 235, 238, { acc: "u", us: "severus-alexander", c: "h", en: "d" }],
  ["gordian3", "Gordian III", 238, 244, { acc: "a", c: "h", en: "d" }],
  ["philip", "Philip the Arab", 244, 249, { acc: "u", us: "gordian3", c: "h", en: "d", s: "Presided over Rome's thousandth anniversary in 248." }],
  ["decius", "Decius", 249, 251, { acc: "u", us: "philip", c: "h", en: "d", s: "Ordered an empire-wide sacrifice decree that led to a persecution of Christians." }],
  ["trebonianus", "Trebonianus Gallus", 251, 253, { acc: "?", c: "h", en: "d" }],
  ["valerian", "Valerian", 253, 260, { acc: "u", c: "h", en: "c", s: "Captured by Shapur I of Persia, the only Roman emperor taken prisoner." }],
  ["gallienus", "Gallienus", 253, 268, { f: "valerian", acc: "i", c: "h", en: "d", nolink: true, after: "trebonianus" }],
  ["claudius2", "Claudius Gothicus", 268, 270, { acc: "?", c: "h", en: "d", after: "gallienus" }],
  ["aurelian", "Aurelian", 270, 275, { acc: "?", c: "h", en: "d", s: "Reunified the breakaway Gallic and Palmyrene empires." }],
  ["probus", "Probus", 276, 282, { acc: "?", c: "h", en: "d" }],
  ["carus", "Carus", 282, 283, { acc: "u", c: "h", en: "d" }],
  ["carinus", "Carinus", 283, 285, { f: "carus", acc: "i", c: "h", en: "d" }],
]);
R("rm", "Roman Empire", "tetrarchy", "emperor", [
  ["diocletian", "Diocletian", 284, 305, { acc: "?", c: "h", en: "a", after: "carinus", s: "Ended the Crisis of the Third Century and created the tetrarchy; abdicated voluntarily in 305." }],
  ["constantius1", "Constantius I Chlorus", 293, 306, { sp: ["~Helena"], acc: "a", c: "h", en: "d", nolink: true, after: "diocletian" }],
  ["constantine1", "Constantine the Great", 306, 337, { f: "constantius1", m: "~Helena", acc: "i", c: "h", s: "First Christian emperor; founded Constantinople and issued the Edict of Milan (313)." }],
  ["constantine2", "Constantine II", 337, 340, { f: "constantine1", acc: "i", c: "h", en: "d" }],
  ["constans", "Constans", 337, 350, { f: "constantine1", sib: ["constantine2"], acc: "i", c: "h", en: "d", nolink: true, after: "constantine1" }],
  ["constantius2", "Constantius II", 337, 361, { f: "constantine1", sib: ["constantine2", "constans"], acc: "i", c: "h", en: "d", nolink: true, after: "constantine1" }],
  ["julian", "Julian", 360, 363, { acc: "e", c: "h", en: "d", after: "constantius2", s: "Last pagan emperor; attempted to restore traditional cults." }],
  ["jovian", "Jovian", 363, 364, { acc: "a", c: "h", en: "d" }],
]);
R("rm", "Roman Empire", "valentinian-theodosian", "emperor", [
  ["valentinian1", "Valentinian I", 364, 375, { acc: "a", c: "h", en: "d", after: "jovian" }],
  ["valens", "Valens", 364, 378, { sib: ["valentinian1"], acc: "a", c: "h", en: "d", nolink: true, after: "jovian", s: "Killed at the Battle of Adrianople in 378." }],
  ["gratian", "Gratian", 367, 383, { f: "valentinian1", acc: "i", c: "h", en: "d", nolink: true, after: "valentinian1" }],
  ["valentinian2", "Valentinian II", 375, 392, { f: "valentinian1", sib: ["gratian"], acc: "i", c: "h", en: "d", nolink: true, after: "valentinian1" }],
  ["theodosius1", "Theodosius I", 379, 395, { acc: "a", c: "h", en: "d", nolink: true, after: "valens", s: "Last emperor to rule both halves of the empire; made Nicene Christianity the state religion." }],
]);
R("rm-w", "Western Roman Empire", "valentinian-theodosian", "emperor", [
  ["honorius", "Honorius", 393, 423, { f: "@rm-theodosius1", acc: "i", c: "h", en: "d", after: "@rm-theodosius1", s: "First emperor of the separate Western empire; reigned through the sack of Rome in 410." }],
  ["valentinian3", "Valentinian III", 425, 455, { f: "~Constantius III", m: "~Galla Placidia", acc: "i", c: "h", en: "d", s: "Western emperor under the regency of his mother Galla Placidia." }],
]);
R("rm-w", "Western Roman Empire", "late-western", "emperor", [
  ["petronius", "Petronius Maximus", 455, 455, { acc: "u", us: "valentinian3", c: "h", en: "d", after: "valentinian3" }],
  ["avitus", "Avitus", 455, 456, { acc: "a", c: "h", en: "p" }],
  ["majorian", "Majorian", 457, 461, { acc: "a", c: "h", en: "d" }],
  ["anthemius", "Anthemius", 467, 472, { acc: "a", c: "h", en: "d" }],
  ["julius-nepos", "Julius Nepos", 474, 475, { acc: "a", c: "h", en: "p", s: "Last legitimate Western emperor by Eastern reckoning; died in 480." }],
  ["romulus-augustulus", "Romulus Augustulus", 475, 476, { acc: "u", us: "julius-nepos", c: "h", en: "p", s: "Last Western Roman emperor, deposed by Odoacer in 476." }],
]);
// ---- Byzantine ----
R("bz", "Byzantine Empire", "valentinian-theodosian", "emperor", [
  ["arcadius", "Arcadius", 395, 408, { f: "@rm-theodosius1", acc: "i", c: "h", en: "d", after: null, s: "First emperor of the separate Eastern Roman Empire." }],
  ["theodosius2", "Theodosius II", 408, 450, { f: "arcadius", acc: "i", c: "h", en: "d", s: "Issued the Theodosian Code and built the Theodosian Walls." }],
  ["marcian", "Marcian", 450, 457, { acc: "a", c: "h", en: "d", h: "leonid", sp: ["~Pulcheria"] }],
]);
R("bz", "Byzantine Empire", "leonid", "emperor", [
  ["leo1", "Leo I", 457, 474, { acc: "a", c: "h", en: "d", after: "marcian" }], ["zeno", "Zeno", 474, 491, { acc: "i", c: "h", en: "d", s: "Reigned when the Western empire ended in 476." }],
  ["anastasius1", "Anastasius I", 491, 518, { acc: "a", c: "h", en: "d", h: "justinian-house" }],
]);
R("bz", "Byzantine Empire", "justinian-house", "emperor", [
  ["justin1", "Justin I", 518, 527, { acc: "e", c: "h", en: "d", after: "anastasius1" }],
  ["justinian1", "Justinian I", 527, 565, { sp: ["~Theodora"], acc: "a", c: "h", en: "d", s: "Reconquered much of the western Mediterranean, codified Roman law and built Hagia Sophia." }],
  ["justin2", "Justin II", 565, 578, { acc: "a", c: "h", en: "a" }],
  ["tiberius2", "Tiberius II Constantine", 574, 582, { acc: "a", c: "h", en: "d" }],
  ["maurice", "Maurice", 582, 602, { acc: "a", c: "h", en: "d" }],
  ["phocas", "Phocas", 602, 610, { acc: "u", us: "maurice", c: "h", en: "d" }],
]);
R("bz", "Byzantine Empire", "heraclian", "emperor", [
  ["heraclius", "Heraclius", 610, 641, { acc: "u", us: "phocas", c: "h", en: "d", s: "Defeated Sasanian Persia in 628 but lost Syria and Egypt to the Arab conquests." }],
  ["constantine3", "Constantine III", 641, 641, { f: "heraclius", acc: "i", c: "h", en: "d" }],
  ["constans2", "Constans II", 641, 668, { f: "constantine3", acc: "i", c: "h", en: "d", nolink: false }],
  ["constantine4", "Constantine IV", 668, 685, { f: "constans2", acc: "i", c: "h", en: "d" }],
  ["justinian2", "Justinian II", 685, 695, { f: "constantine4", acc: "i", c: "h", en: "p", s: "Deposed and mutilated in 695; regained the throne in 705." }],
]);
R("bz", "Byzantine Empire", "isaurian", "emperor", [
  ["leo3", "Leo III the Isaurian", 717, 741, { acc: "u", c: "h", en: "d", after: null, s: "Repelled the Arab siege of Constantinople (717-718) and began Iconoclasm." }],
  ["constantine5", "Constantine V", 741, 775, { f: "leo3", acc: "i", c: "h", en: "d" }],
  ["leo4", "Leo IV the Khazar", 775, 780, { f: "constantine5", acc: "i", c: "h", en: "d" }],
  ["constantine6", "Constantine VI", 780, 797, { f: "leo4", acc: "i", c: "h", en: "p" }],
  ["irene", "Irene of Athens", 797, 802, { t: "empress regnant", sp: ["leo4"], acc: "u", us: "constantine6", c: "h", en: "p", s: "Blinded her son Constantine VI and ruled as sole empress; presided over the restoration of icon veneration at Nicaea II (787) as regent." }],
]);
R("bz", "Byzantine Empire", "amorian-nikephorian", "emperor", [
  ["nikephoros1", "Nikephoros I", 802, 811, { acc: "u", us: "irene", c: "h", en: "d" }],
  ["michael1", "Michael I Rangabe", 811, 813, { acc: "a", c: "h", en: "a" }],
  ["leo5", "Leo V the Armenian", 813, 820, { acc: "u", c: "h", en: "d" }],
  ["michael2", "Michael II the Amorian", 820, 829, { acc: "u", us: "leo5", c: "h", en: "d" }],
  ["theophilos", "Theophilos", 829, 842, { f: "michael2", acc: "i", c: "h", en: "d" }],
  ["michael3", "Michael III", 842, 867, { f: "theophilos", acc: "i", c: "h", en: "d", s: "Murdered by Basil I, who succeeded him." }],
]);
R("bz", "Byzantine Empire", "macedonian", "emperor", [
  ["basil1", "Basil I the Macedonian", 867, 886, { acc: "u", us: "michael3", c: "h", en: "d", s: "Peasant-born founder of the Macedonian dynasty." }],
  ["leo6", "Leo VI the Wise", 886, 912, { f: "basil1", acc: "i", c: "h", en: "d" }],
  ["alexander", "Alexander", 912, 913, { f: "basil1", sib: ["leo6"], acc: "i", c: "h", en: "d" }],
  ["constantine7", "Constantine VII Porphyrogenitus", 913, 959, { f: "leo6", acc: "i", c: "h", en: "d", s: "Scholar-emperor; effectively sole ruler from 945." }],
  ["romanos1", "Romanos I Lekapenos", 920, 944, { acc: "r", rg: "constantine7", c: "h", en: "p", nolink: true, after: "constantine7", h: "macedonian" }],
  ["romanos2", "Romanos II", 959, 963, { f: "constantine7", acc: "i", c: "h", en: "d", after: "constantine7" }],
  ["nikephoros2", "Nikephoros II Phokas", 963, 969, { acc: "u", c: "h", en: "d", s: "Soldier-emperor who reconquered Crete and Cilicia." }],
  ["john1", "John I Tzimiskes", 969, 976, { acc: "u", us: "nikephoros2", c: "h", en: "d" }],
  ["basil2", "Basil II", 976, 1025, { f: "romanos2", acc: "i", c: "h", en: "d", s: "The Bulgar-Slayer; brought the empire to its medieval height." }],
  ["constantine8", "Constantine VIII", 1025, 1028, { f: "romanos2", sib: ["basil2"], acc: "i", c: "h", en: "d" }],
  ["zoe", "Zoe Porphyrogenita", 1028, 1050, { t: "empress regnant", f: "constantine8", acc: "i", c: "h", en: "d", nolink: true, after: "constantine8" }],
]);
R("bz", "Byzantine Empire", "doukas-and-others", "emperor", [
  ["romanos4", "Romanos IV Diogenes", 1068, 1071, { acc: "?", c: "h", en: "p", after: "@bz-zoe", s: "Defeated and captured at Manzikert in 1071." }],
  ["nikephoros3", "Nikephoros III Botaneiates", 1078, 1081, { acc: "u", c: "h", en: "a" }],
]);
R("bz", "Byzantine Empire", "komnenos", "emperor", [
  ["alexios1", "Alexios I Komnenos", 1081, 1118, { acc: "u", us: "nikephoros3", c: "h", en: "d", s: "Restored the empire and called for Western aid that led to the First Crusade." }],
  ["john2", "John II Komnenos", 1118, 1143, { f: "alexios1", acc: "i", c: "h", en: "d" }],
  ["manuel1", "Manuel I Komnenos", 1143, 1180, { f: "john2", acc: "i", c: "h", en: "d", s: "Lost to the Seljuks at Myriokephalon in 1176." }],
  ["alexios2", "Alexios II Komnenos", 1180, 1183, { f: "manuel1", acc: "i", c: "h", en: "d" }],
  ["andronikos1", "Andronikos I Komnenos", 1183, 1185, { acc: "u", us: "alexios2", c: "h", en: "d" }],
]);
R("bz", "Byzantine Empire", "angelos", "emperor", [
  ["isaac2", "Isaac II Angelos", 1185, 1195, { acc: "u", us: "andronikos1", c: "h", en: "p" }],
  ["alexios3", "Alexios III Angelos", 1195, 1203, { sib: ["isaac2"], acc: "u", us: "isaac2", c: "h", en: "p" }],
]);
R("bz", "Byzantine Empire", "laskaris", "emperor", [
  ["theodore1", "Theodore I Laskaris", 1205, 1221, { after: null, acc: "?", c: "h", s: "Founder of the Empire of Nicaea after the Fourth Crusade." }],
  ["john3", "John III Doukas Vatatzes", 1221, 1254, { acc: "i", c: "h" }],
]);
R("bz", "Byzantine Empire", "palaiologos", "emperor", [
  ["michael8", "Michael VIII Palaiologos", 1259, 1282, { after: null, acc: "u", c: "h", s: "Recovered Constantinople in 1261 and founded the Palaiologan dynasty." }],
  ["andronikos2", "Andronikos II Palaiologos", 1282, 1328, { f: "michael8", acc: "i", c: "h", en: "p" }],
  ["andronikos3", "Andronikos III Palaiologos", 1328, 1341, { acc: "u", us: "andronikos2", c: "h", en: "d" }],
  ["john5", "John V Palaiologos", 1341, 1391, { f: "andronikos3", acc: "i", c: "h", en: "d" }],
  ["manuel2", "Manuel II Palaiologos", 1391, 1425, { f: "john5", acc: "i", c: "h", en: "d" }],
  ["john8", "John VIII Palaiologos", 1425, 1448, { f: "manuel2", acc: "i", c: "h", en: "d" }],
  ["constantine11", "Constantine XI Palaiologos", 1449, 1453, { f: "manuel2", sib: ["john8"], acc: "i", c: "h", en: "c", s: "Last Byzantine emperor, killed in the fall of Constantinople on 29 May 1453." }],
]);
// ---- Hellenistic ----
R("hl-mac", "Macedon", "argead", "king", [
  ["philip2", "Philip II of Macedon", -359, -336, { c: "h", ap: false, en: "d", s: "Unified Greece under Macedonian hegemony; assassinated in 336 BCE." }],
  ["alexander3", "Alexander the Great", -336, -323, { f: "philip2", m: "~Olympias", c: "h", ap: false, acc: "i", b: -356, d: -323, en: "d", s: "King of Macedon who conquered the Achaemenid Empire." }],
  ["alexander4", "Alexander IV of Macedon", -323, -309, { f: "alexander3", m: "~Roxana", c: "h", ap: false, acc: "i", en: "d" }],
]);
R("hl-sel", "Seleucid Empire", "seleucid", "king", [
  ["seleucus1", "Seleucus I Nicator", -305, -281, { c: "h", ap: false, s: "Macedonian general who founded the Seleucid Empire." }],
  ["antiochus1", "Antiochus I Soter", -281, -261, { f: "seleucus1", c: "h", ap: false, acc: "i" }],
  ["antiochus2", "Antiochus II Theos", -261, -246, { f: "antiochus1", c: "h", ap: false, acc: "i" }],
  ["seleucus2", "Seleucus II Callinicus", -246, -225, { f: "antiochus2", c: "h", ap: false, acc: "i" }],
  ["antiochus3", "Antiochus III the Great", -222, -187, { f: "seleucus2", c: "h", ap: false, acc: "i", after: "seleucus2", s: "Restored the empire's eastern reach before defeat by Rome at Magnesia in 190 BCE." }],
  ["seleucus4", "Seleucus IV Philopator", -187, -175, { f: "antiochus3", c: "h", ap: false, acc: "i" }],
  ["antiochus4", "Antiochus IV Epiphanes", -175, -164, { f: "antiochus3", sib: ["seleucus4"], c: "h", ap: false, acc: "u", s: "His persecution of Jews provoked the Maccabean revolt." }],
]);
R("hl-ant", "Macedon", "antigonid", "king", [
  ["demetrius1", "Demetrius I Poliorcetes", -294, -288, { c: "h", ap: false }],
  ["antigonus2", "Antigonus II Gonatas", -277, -239, { f: "demetrius1", c: "h", ap: false, acc: "i", after: "demetrius1" }],
  ["philip5", "Philip V of Macedon", -221, -179, { c: "h", ap: false, acc: "a", s: "Fought the First and Second Macedonian Wars against Rome." }],
  ["perseus", "Perseus of Macedon", -179, -168, { f: "philip5", c: "h", ap: false, acc: "i", en: "c", s: "Last Antigonid king, defeated at Pydna." }],
]);
R("hl-pont", "Kingdom of Pontus", "mithridatic", "king", [["mithridates6", "Mithridates VI of Pontus", -120, -63, { c: "h", ap: false, s: "Fought three wars against Rome." }]]);
R("hl-jud", "Judea", "herodian", "king", [["herod", "Herod the Great", -37, -4, { c: "h", ap: false, s: "Roman client king of Judea who rebuilt the Second Temple." }]]);
export const { houses, monarchs, links } = S;

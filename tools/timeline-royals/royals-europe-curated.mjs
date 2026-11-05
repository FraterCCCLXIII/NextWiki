// Hand-written core lines for England, France and Russia (the rest of Europe comes from the Wikidata-derived shards).
import { makeShard, WE, EE } from "./curated/lib.mjs";
const S = makeShard("europe-curated"); const { H, R } = S;
const en = (id, name, st, en2, sum, o = {}) => H(id, name, "England / United Kingdom", "English civilization", WE, st, en2, sum, { cap: "London", ll: [51.51, -0.13], c: "h", ap: false, ...o });
en("wessex", "House of Wessex", 871, 1066, "West Saxon dynasty that unified England.", { cap: "Winchester" });
en("knytlinga", "House of Knýtlinga (Danish kings of England)", 1016, 1042, "Danish dynasty of Cnut the Great.");
en("godwin", "House of Godwin", 1066, 1066, "Family of Harold Godwinson.");
en("normandy-eng", "House of Normandy", 1066, 1135, "Norman dynasty of William the Conqueror.");
en("blois", "House of Blois", 1135, 1154, "Dynasty of King Stephen.");
en("plantagenet", "House of Plantagenet (Angevin)", 1154, 1399, "Angevin dynasty from Henry II to Richard II.", { alt: ["Angevin dynasty"] });
en("lancaster", "House of Lancaster", 1399, 1471, "Cadet branch of the Plantagenets; Henry IV, V and VI.", { parent: "plantagenet" });
en("york", "House of York", 1461, 1485, "Cadet branch of the Plantagenets in the Wars of the Roses.", { parent: "plantagenet" });
en("tudor", "House of Tudor", 1485, 1603, "Dynasty from Henry VII to Elizabeth I.");
en("stuart", "House of Stuart", 1603, 1714, "Scottish dynasty that ruled England from 1603.");
en("orange-eng", "House of Orange-Nassau (English crown)", 1689, 1702, "William III of Orange, who ruled jointly with Mary II.");
en("hanover", "House of Hanover", 1714, 1901, "German dynasty from George I to Victoria.");
en("saxe-coburg", "House of Saxe-Coburg and Gotha", 1901, 1917, "Dynasty of Edward VII; renamed Windsor in 1917.");
en("windsor", "House of Windsor", 1917, null, "Current British royal house, renamed from Saxe-Coburg and Gotha in 1917.", { parent: "saxe-coburg" });
R("eu-en", "England", "wessex", "king", [
  ["alfred", "Alfred the Great", 871, 899, { b: 849, d: 899, c: "h" }],
  ["edward-elder", "Edward the Elder", 899, 924, { f: "alfred", acc: "i" }],
  ["athelstan", "Æthelstan", 924, 939, { f: "edward-elder", acc: "i", s: "First king of the whole of England." }],
  ["edmund1", "Edmund I", 939, 946, { f: "edward-elder", sib: ["athelstan"], acc: "i", en: "d" }],
  ["eadred", "Eadred", 946, 955, { f: "edward-elder", sib: ["athelstan", "edmund1"], acc: "i" }],
  ["eadwig", "Eadwig", 955, 959, { f: "edmund1", acc: "i" }],
  ["edgar", "Edgar the Peaceful", 959, 975, { f: "edmund1", sib: ["eadwig"], acc: "i" }],
  ["edward-martyr", "Edward the Martyr", 975, 978, { f: "edgar", acc: "i", en: "d" }],
  ["aethelred2", "Æthelred the Unready", 978, 1016, { f: "edgar", sib: ["edward-martyr"], acc: "i", en: "d" }],
  ["edmund2", "Edmund Ironside", 1016, 1016, { f: "aethelred2", acc: "i", en: "d" }],
]);
R("eu-en", "England", "knytlinga", "king", [
  ["cnut", "Cnut the Great", 1016, 1035, { f: "~Sweyn Forkbeard", acc: "c", c: "h", s: "King of England, Denmark and Norway." }],
  ["harold1", "Harold Harefoot", 1035, 1040, { f: "cnut", acc: "i" }],
  ["harthacnut", "Harthacnut", 1040, 1042, { f: "cnut", sib: ["harold1"], acc: "i" }],
]);
R("eu-en", "England", "wessex", "king", [["edward-confessor", "Edward the Confessor", 1042, 1066, { f: "aethelred2", sib: ["edmund2"], acc: "e", en: "d", s: "Last king of the House of Wessex." }]]);
R("eu-en", "England", "godwin", "king", [["harold2", "Harold Godwinson", 1066, 1066, { f: "~Godwin of Wessex", acc: "e", en: "d", s: "Last Anglo-Saxon king, killed at Hastings." }]]);
R("eu-en", "England", "normandy-eng", "king", [
  ["william1", "William the Conqueror", 1066, 1087, { f: "~Robert I, Duke of Normandy", sp: ["~Matilda of Flanders"], acc: "c", s: "Conquered England at Hastings in 1066." }],
  ["william2", "William II Rufus", 1087, 1100, { f: "william1", acc: "i", en: "d" }],
  ["henry1", "Henry I of England", 1100, 1135, { f: "william1", sib: ["william2"], sp: ["~Matilda of Scotland"], acc: "u", en: "d" }],
]);
R("eu-en", "England", "blois", "king", [["stephen", "Stephen of England", 1135, 1154, { f: "~Stephen, Count of Blois", m: "~Adela of Normandy", acc: "u", s: "Reigned during the civil war known as the Anarchy." }]]);
R("eu-en", "England", "plantagenet", "king", [
  ["henry2", "Henry II of England", 1154, 1189, { f: "~Geoffrey Count of Anjou", m: "~Empress Matilda", sp: ["~Eleanor of Aquitaine"], acc: "e", s: "First Plantagenet king, ruling the Angevin Empire." }],
  ["richard1", "Richard I of England", 1189, 1199, { f: "henry2", sp: ["~Berengaria of Navarre"], acc: "i", en: "d" }],
  ["john", "John of England", 1199, 1216, { f: "henry2", sib: ["richard1"], sp: ["~Isabella of Angoulême"], acc: "i", s: "Sealed Magna Carta in 1215." }],
  ["henry3", "Henry III of England", 1216, 1272, { f: "john", acc: "i" }],
  ["edward1", "Edward I of England", 1272, 1307, { f: "henry3", sp: ["~Eleanor of Castile"], acc: "i" }],
  ["edward2", "Edward II of England", 1307, 1327, { f: "edward1", sp: ["~Isabella of France"], acc: "i", en: "p" }],
  ["edward3", "Edward III of England", 1327, 1377, { f: "edward2", sp: ["~Philippa of Hainault"], acc: "i", s: "Began the Hundred Years' War." }],
  ["richard2", "Richard II of England", 1377, 1399, { f: "~Edward the Black Prince", sp: ["~Anne of Bohemia"], acc: "i", en: "p" }],
]);
R("eu-en", "England", "lancaster", "king", [
  ["henry4", "Henry IV of England", 1399, 1413, { f: "~John of Gaunt", acc: "u", us: "richard2" }],
  ["henry5", "Henry V of England", 1413, 1422, { f: "henry4", sp: ["~Catherine of Valois"], acc: "i", s: "Victor at Agincourt (1415)." }],
  ["henry6", "Henry VI of England", 1422, 1461, { f: "henry5", sp: ["~Margaret of Anjou"], acc: "i", en: "p", s: "Reigned in two stints (1422-1461, 1470-1471)." }],
]);
R("eu-en", "England", "york", "king", [
  ["edward4", "Edward IV of England", 1461, 1483, { f: "~Richard, Duke of York", sp: ["~Elizabeth Woodville"], acc: "u", us: "henry6", s: "Reigned in two stints (1461-1470, 1471-1483)." }],
  ["edward5", "Edward V of England", 1483, 1483, { f: "edward4", acc: "i", en: "p", s: "One of the Princes in the Tower." }],
  ["richard3", "Richard III of England", 1483, 1485, { f: "~Richard, Duke of York", sib: ["edward4"], acc: "u", us: "edward5", en: "d", s: "Last Plantagenet king, killed at Bosworth." }],
]);
R("eu-en", "England", "tudor", "king", [
  ["henry7", "Henry VII of England", 1485, 1509, { f: "~Edmund Tudor", sp: ["~Elizabeth of York"], acc: "c", us: "richard3" }],
  ["henry8", "Henry VIII of England", 1509, 1547, { f: "henry7", sp: ["~Catherine of Aragon", "~Anne Boleyn", "~Jane Seymour", "~Anne of Cleves", "~Catherine Howard", "~Catherine Parr"], acc: "i", s: "Broke with Rome and founded the Church of England." }],
  ["edward6", "Edward VI of England", 1547, 1553, { f: "henry8", m: "~Jane Seymour", acc: "i", en: "d" }],
  ["jane", "Lady Jane Grey", 1553, 1553, { t: "queen regnant", acc: "a", en: "p", c: "h", s: "Proclaimed queen for nine days after Edward VI's death." }],
  ["mary1", "Mary I of England", 1553, 1558, { t: "queen regnant", f: "henry8", m: "~Catherine of Aragon", sp: ["@eu-es-philip2"], acc: "u", us: "jane" }],
  ["elizabeth1", "Elizabeth I of England", 1558, 1603, { t: "queen regnant", f: "henry8", m: "~Anne Boleyn", sib: ["edward6", "mary1"], acc: "i", s: "The last Tudor monarch." }],
]);
R("eu-en", "England", "stuart", "king", [
  ["james1", "James I of England (James VI of Scotland)", 1603, 1625, { f: "~Henry Stuart, Lord Darnley", m: "~Mary, Queen of Scots", sp: ["~Anne of Denmark"], acc: "i", s: "Union of the Crowns." }],
  ["charles1", "Charles I of England", 1625, 1649, { f: "james1", sp: ["~Henrietta Maria of France"], acc: "i", en: "d", s: "Executed in 1649 after the English Civil War." }],
  ["charles2", "Charles II of England", 1660, 1685, { f: "charles1", acc: "i", after: "charles1", s: "Restored to the throne in 1660 after the Interregnum." }],
  ["james2", "James II of England", 1685, 1688, { f: "charles1", sib: ["charles2"], acc: "i", en: "p", s: "Deposed in the Glorious Revolution." }],
]);
R("eu-en", "England", "orange-eng", "king / queen", [
  ["william3", "William III of England", 1689, 1702, { f: "~William II, Prince of Orange", m: "~Mary, Princess Royal", sp: ["mary2"], acc: "u", us: "james2" }],
  ["mary2", "Mary II of England", 1689, 1694, { t: "queen regnant", f: "james2", sp: ["william3"], acc: "u", us: "james2", nolink: true, after: "james2" }],
]);
R("eu-en", "England", "stuart", "queen", [["anne", "Anne, Queen of Great Britain", 1702, 1714, { t: "queen regnant", f: "james2", sib: ["mary2"], acc: "i", after: "william3", s: "Last Stuart monarch; the Acts of Union took effect in 1707." }]]);
R("eu-en", "England", "hanover", "king", [
  ["george1", "George I of Great Britain", 1714, 1727, { f: "~Ernest Augustus, Elector of Hanover", acc: "i" }],
  ["george2", "George II of Great Britain", 1727, 1760, { f: "george1", acc: "i" }],
  ["george3", "George III of the United Kingdom", 1760, 1820, { f: "~Frederick, Prince of Wales", sp: ["~Charlotte of Mecklenburg-Strelitz"], acc: "i" }],
  ["george4", "George IV of the United Kingdom", 1820, 1830, { f: "george3", acc: "i" }],
  ["william4", "William IV of the United Kingdom", 1830, 1837, { f: "george3", sib: ["george4"], acc: "i" }],
  ["victoria", "Queen Victoria", 1837, 1901, { t: "queen regnant", f: "~Prince Edward, Duke of Kent", sp: ["~Prince Albert"], b: 1819, d: 1901, acc: "i", s: "Queen of the United Kingdom and Empress of India." }],
]);
R("eu-en", "United Kingdom", "saxe-coburg", "king", [["edward7", "Edward VII", 1901, 1910, { f: "victoria", sp: ["~Alexandra of Denmark"], acc: "i" }]]);
R("eu-en", "United Kingdom", "windsor", "king", [
  ["george5", "George V", 1910, 1936, { f: "edward7", sp: ["~Mary of Teck"], acc: "i" }],
  ["edward8", "Edward VIII", 1936, 1936, { f: "george5", acc: "i", en: "a", s: "Abdicated in 1936 to marry Wallis Simpson." }],
  ["george6", "George VI", 1936, 1952, { f: "george5", sib: ["edward8"], sp: ["~Elizabeth Bowes-Lyon"], acc: "i" }],
  ["elizabeth2", "Elizabeth II", 1952, 2022, { t: "queen regnant", f: "george6", sp: ["~Prince Philip, Duke of Edinburgh"], b: 1926, d: 2022, acc: "i", en: "d", s: "Longest-reigning British monarch." }],
  ["charles3", "Charles III", 2022, null, { f: "~Prince Philip, Duke of Edinburgh", m: "elizabeth2", sp: ["~Camilla Parker Bowles"], b: 1948, acc: "i" }],
]);
// ---- France ----
const fr = (id, name, st, en2, sum, o = {}) => H(id, name, "France", "French civilization", WE, st, en2, sum, { cap: "Paris", ll: [48.86, 2.35], c: "h", ap: false, ...o });
fr("merovingian", "Merovingian dynasty", 481, 751, "First royal dynasty of the Franks.", { cap: "Soissons / Paris" });
fr("carolingian", "Carolingian dynasty", 751, 987, "Dynasty of Pepin the Short and Charlemagne.", { cap: "Aachen" });
fr("capet", "House of Capet", 987, 1328, "Direct Capetian kings of France.");
fr("valois", "House of Valois", 1328, 1589, "Cadet branch of the Capets that ruled France.", { parent: "capet" });
fr("bourbon", "House of Bourbon", 1589, 1848, "Cadet branch of the Capets from Henry IV.", { parent: "capet" });
fr("bonaparte", "House of Bonaparte", 1804, 1870, "Imperial family of Napoleon I and Napoleon III.", { region: WE });
R("eu-fr", "France", "merovingian", "king", [["clovis1", "Clovis I", 481, 511, { c: "h", s: "Founder of the Frankish kingdom; baptised as a Catholic." }]]);
R("eu-fr", "France", "carolingian", "king / emperor", [
  ["pepin", "Pepin the Short", 751, 768, { f: "~Charles Martel", acc: "u", s: "First Carolingian king of the Franks." }],
  ["charlemagne", "Charlemagne", 768, 814, { f: "pepin", sp: ["~Hildegard of Vinzgau"], acc: "i", b: 748, d: 814, s: "King of the Franks and first emperor in the West since antiquity (crowned 800)." }],
  ["louis-pious", "Louis the Pious", 814, 840, { f: "charlemagne", acc: "i" }],
  ["charles-bald", "Charles the Bald", 843, 877, { f: "louis-pious", acc: "i", after: "louis-pious", s: "King of West Francia after the Treaty of Verdun." }],
]);
R("eu-fr", "France", "capet", "king", [
  ["hugh-capet", "Hugh Capet", 987, 996, { f: "~Hugh the Great", acc: "e", after: null }],
  ["robert2", "Robert II of France", 996, 1031, { f: "hugh-capet", acc: "i" }],
  ["henry1", "Henry I of France", 1031, 1060, { f: "robert2", acc: "i" }],
  ["philip1", "Philip I of France", 1060, 1108, { f: "henry1", acc: "i" }],
  ["louis6", "Louis VI of France", 1108, 1137, { f: "philip1", acc: "i" }],
  ["louis7", "Louis VII of France", 1137, 1180, { f: "louis6", sp: ["~Eleanor of Aquitaine"], acc: "i" }],
  ["philip2", "Philip II of France", 1180, 1223, { f: "louis7", acc: "i" }],
  ["louis8", "Louis VIII of France", 1223, 1226, { f: "philip2", acc: "i" }],
  ["louis9", "Louis IX of France (Saint Louis)", 1226, 1270, { f: "louis8", acc: "i", en: "d" }],
  ["philip3", "Philip III of France", 1270, 1285, { f: "louis9", acc: "i" }],
  ["philip4", "Philip IV of France", 1285, 1314, { f: "philip3", sp: ["~Joan I of Navarre"], acc: "i" }],
  ["louis10", "Louis X of France", 1314, 1316, { f: "philip4", acc: "i" }],
  ["john1", "John I of France", 1316, 1316, { f: "louis10", acc: "i", en: "d", s: "Posthumous son of Louis X who lived five days." }],
  ["philip5", "Philip V of France", 1316, 1322, { f: "philip4", sib: ["louis10"], acc: "i" }],
  ["charles4", "Charles IV of France", 1322, 1328, { f: "philip4", sib: ["louis10", "philip5"], acc: "i", en: "d", s: "Last direct Capetian king." }],
]);
R("eu-fr", "France", "valois", "king", [
  ["philip6", "Philip VI of France", 1328, 1350, { f: "~Charles of Valois", acc: "e" }],
  ["john2", "John II of France", 1350, 1364, { f: "philip6", acc: "i" }],
  ["charles5", "Charles V of France", 1364, 1380, { f: "john2", acc: "i" }],
  ["charles6", "Charles VI of France", 1380, 1422, { f: "charles5", acc: "i" }],
  ["charles7", "Charles VII of France", 1422, 1461, { f: "charles6", acc: "i", s: "Crowned with the help of Joan of Arc." }],
  ["louis11", "Louis XI of France", 1461, 1483, { f: "charles7", acc: "i" }],
  ["charles8", "Charles VIII of France", 1483, 1498, { f: "louis11", acc: "i" }],
  ["louis12", "Louis XII of France", 1498, 1515, { f: "~Charles, Duke of Orléans", acc: "i" }],
  ["francis1", "Francis I of France", 1515, 1547, { f: "~Charles, Count of Angoulême", acc: "i" }],
  ["henry2", "Henry II of France", 1547, 1559, { f: "francis1", sp: ["~Catherine de' Medici"], acc: "i", en: "d" }],
  ["francis2", "Francis II of France", 1559, 1560, { f: "henry2", acc: "i", en: "d" }],
  ["charles9", "Charles IX of France", 1560, 1574, { f: "henry2", sib: ["francis2"], acc: "i", en: "d" }],
  ["henry3", "Henry III of France", 1574, 1589, { f: "henry2", sib: ["francis2", "charles9"], acc: "i", en: "d", s: "Last Valois king, assassinated in 1589." }],
]);
R("eu-fr", "France", "bourbon", "king", [
  ["henry4", "Henry IV of France", 1589, 1610, { f: "~Antoine of Navarre", sp: ["~Margaret of Valois", "~Marie de' Medici"], acc: "i", en: "d" }],
  ["louis13", "Louis XIII of France", 1610, 1643, { f: "henry4", sp: ["~Anne of Austria"], acc: "i" }],
  ["louis14", "Louis XIV of France", 1643, 1715, { f: "louis13", sp: ["~Maria Theresa of Spain"], acc: "i", b: 1638, d: 1715, s: "The Sun King; longest-reigning monarch in European history." }],
  ["louis15", "Louis XV of France", 1715, 1774, { f: "~Louis, Duke of Burgundy", acc: "i" }],
  ["louis16", "Louis XVI of France", 1774, 1792, { f: "~Louis, Dauphin of France", sp: ["~Marie Antoinette"], acc: "i", en: "p", s: "Deposed during the French Revolution and executed in 1793." }],
]);
R("eu-fr", "France", "bonaparte", "emperor", [["napoleon1", "Napoleon I", 1804, 1815, { f: "~Carlo Buonaparte", sp: ["~Joséphine de Beauharnais", "~Marie Louise of Austria"], acc: "e", after: "louis16", en: "a", s: "Emperor of the French; abdicated in 1814 and again in 1815." }]]);
R("eu-fr", "France", "bourbon", "king", [
  ["louis18", "Louis XVIII of France", 1814, 1824, { f: "~Louis, Dauphin of France", sib: ["louis16"], acc: "i", after: "napoleon1" }],
  ["charles10", "Charles X of France", 1824, 1830, { f: "~Louis, Dauphin of France", sib: ["louis16", "louis18"], acc: "i", en: "p" }],
]);
R("eu-fr", "France", "bourbon", "king", [["louis-philippe", "Louis Philippe I", 1830, 1848, { f: "~Philippe Égalité", acc: "e", en: "a", h: "bourbon", s: "King of the French of the House of Orléans, a cadet Bourbon line." }]]);
R("eu-fr", "France", "bonaparte", "emperor", [["napoleon3", "Napoleon III", 1852, 1870, { f: "~Louis Bonaparte", acc: "e", after: null, en: "p", s: "President then Emperor of the French, deposed after Sedan." }]]);
// ---- Russia ----
const ru = (id, name, st, en2, sum, o = {}) => H(id, name, "Russia", "Russian civilization", EE, st, en2, sum, { c: "h", ap: false, ...o });
ru("rurik", "Rurikid dynasty", 862, 1598, "Dynasty of Kyivan Rus' and Muscovy, claiming descent from Rurik.", { cap: "Novgorod / Kyiv / Moscow" });
ru("godunov", "House of Godunov", 1598, 1605, "Short-lived dynasty of Boris Godunov.", { cap: "Moscow" });
ru("romanov", "House of Romanov", 1613, 1917, "Imperial dynasty of Russia from Michael I to Nicholas II.", { cap: "Moscow / St Petersburg", ll: [59.93, 30.34] });
R("eu-ru", "Russia", "rurik", "prince / grand prince / tsar", [
  ["rurik", "Rurik", 862, 879, { c: "l", ap: true, leg: true, s: "Semi-legendary Varangian founder of the Rurikid dynasty." }],
  ["oleg", "Oleg of Novgorod", 879, 912, { c: "l", ap: true, s: "Prince who moved the capital to Kyiv, according to the Primary Chronicle." }],
  ["igor", "Igor of Kyiv", 912, 945, { c: "m", ap: true, en: "d" }],
  ["sviatoslav1", "Sviatoslav I of Kyiv", 945, 972, { f: "igor", m: "~Olga of Kyiv", c: "m", ap: false, en: "d" }],
  ["vladimir1", "Vladimir the Great", 980, 1015, { f: "sviatoslav1", c: "h", ap: false, s: "Baptised Rus' in 988." }],
  ["yaroslav", "Yaroslav the Wise", 1019, 1054, { f: "vladimir1", c: "h", ap: false }],
  ["ivan1", "Ivan I Kalita", 1325, 1340, { c: "h", ap: false, after: null }],
  ["dmitry", "Dmitry Donskoy", 1359, 1389, { c: "h", ap: false, after: null }],
  ["ivan3", "Ivan III", 1462, 1505, { f: "~Vasily II of Moscow", c: "h", ap: false, after: null, s: "Ended Mongol overlordship over Moscow." }],
  ["vasily3", "Vasily III", 1505, 1533, { f: "ivan3", c: "h", ap: false, acc: "i" }],
  ["ivan4", "Ivan the Terrible", 1533, 1584, { f: "vasily3", c: "h", ap: false, acc: "i", s: "First tsar of Russia (crowned 1547)." }],
  ["feodor1", "Feodor I of Russia", 1584, 1598, { f: "ivan4", c: "h", ap: false, acc: "i", s: "Last Rurikid ruler of Russia." }],
]);
R("eu-ru", "Russia", "godunov", "tsar", [["boris", "Boris Godunov", 1598, 1605, { c: "h", ap: false, acc: "e", s: "Elected tsar by the Zemsky Sobor; his reign led into the Time of Troubles." }]]);
R("eu-ru", "Russia", "romanov", "tsar / emperor", [
  ["michael", "Michael of Russia", 1613, 1645, { c: "h", ap: false, acc: "e", after: null, s: "First Romanov tsar, chosen by the Zemsky Sobor." }],
  ["alexis", "Alexis of Russia", 1645, 1676, { f: "michael", c: "h", ap: false, acc: "i" }],
  ["feodor3", "Feodor III of Russia", 1676, 1682, { f: "alexis", c: "h", ap: false, acc: "i" }],
  ["peter1", "Peter the Great", 1682, 1725, { f: "alexis", c: "h", ap: false, acc: "e", sib: ["feodor3"], s: "Reformed and westernised Russia; first to take the title emperor (1721)." }],
  ["catherine1", "Catherine I of Russia", 1725, 1727, { t: "empress regnant", sp: ["peter1"], c: "h", ap: false, acc: "a" }],
  ["peter2", "Peter II of Russia", 1727, 1730, { f: "~Alexei Petrovich", c: "h", ap: false, acc: "a", en: "d" }],
  ["anna", "Anna of Russia", 1730, 1740, { t: "empress regnant", c: "h", ap: false, acc: "e" }],
  ["ivan6", "Ivan VI of Russia", 1740, 1741, { c: "h", ap: false, acc: "a", en: "p" }],
  ["elizabeth", "Elizabeth of Russia", 1741, 1762, { t: "empress regnant", f: "peter1", c: "h", ap: false, acc: "u", us: "ivan6" }],
  ["peter3", "Peter III of Russia", 1762, 1762, { f: "~Charles Frederick, Duke of Holstein-Gottorp", m: "~Anna Petrovna", c: "h", ap: false, acc: "a", en: "p" }],
  ["catherine2", "Catherine the Great", 1762, 1796, { t: "empress regnant", sp: ["peter3"], c: "h", ap: false, acc: "u", us: "peter3", s: "Expanded Russia and patronised the Enlightenment." }],
  ["paul1", "Paul I of Russia", 1796, 1801, { f: "peter3", m: "catherine2", c: "h", ap: false, acc: "i", en: "d" }],
  ["alexander1", "Alexander I of Russia", 1801, 1825, { f: "paul1", c: "h", ap: false, acc: "i" }],
  ["nicholas1", "Nicholas I of Russia", 1825, 1855, { f: "paul1", sib: ["alexander1"], c: "h", ap: false, acc: "i" }],
  ["alexander2", "Alexander II of Russia", 1855, 1881, { f: "nicholas1", c: "h", ap: false, acc: "i", en: "d", s: "Emancipated the serfs in 1861; assassinated in 1881." }],
  ["alexander3", "Alexander III of Russia", 1881, 1894, { f: "alexander2", c: "h", ap: false, acc: "i" }],
  ["nicholas2", "Nicholas II of Russia", 1894, 1917, { f: "alexander3", sp: ["~Alexandra Feodorovna"], c: "h", ap: false, acc: "i", en: "a", s: "Last emperor of Russia, abdicated in the February Revolution." }],
]);
// Spain: one anchor row (Philip II) to resolve the spouse reference from Mary I of England
H("habsburg-spain", "Spanish Habsburgs", "Spain", "Spanish civilization", WE, 1516, 1700, "Spanish branch of the House of Habsburg.", { cap: "Madrid", c: "h", ap: false });
R("eu-es", "Spain", "habsburg-spain", "king", [["philip2", "Philip II of Spain", 1556, 1598, { sp: ["@eu-en-mary1"], c: "h", ap: false, acc: "i", s: "King of Spain, Portugal (from 1580) and, by marriage, jure uxoris King of England." }]]);
export const { houses, monarchs, links } = S;

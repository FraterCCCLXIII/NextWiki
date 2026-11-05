// Extra curated rows (to 1800) filling non-Western and secondary European gaps.
import { makeR, WE, EE, MED, ME, AN, CA, SA, EA, SEA, OC, SSA, NAF, NAM, MES, SAM, GL } from "./lib.mjs";
export const rows = [];
const R = makeR(rows);

// ---------- East Asia ----------
R("tang-founding-wars","Wars of Tang unification","war",617,628,EA,["Tang dynasty","Sui remnants","Xia","Zheng"],"Li Yuan and Li Shimin defeated Sui successor states and rebel regimes to found the Tang dynasty.",{out:"Tang unifies China",theme:"dynastic"});
R("hulao-621","Battle of Hulao","battle",621,null,EA,["Tang dynasty","Xia","Zheng"],"Li Shimin captured Dou Jiande of Xia and forced Wang Shichong of Zheng to surrender.",{ll:[34.83,113.07],parent:"tang-founding-wars",place:"Hulao Pass"});
R("xuanwu-gate-626","Xuanwu Gate Incident","civil-war",626,null,EA,["Tang dynasty"],"Li Shimin killed his brothers in a palace coup and soon took the throne as Emperor Taizong.",{ll:[34.27,108.95],theme:"dynastic",place:"Chang'an"});
R("tang-eastern-turks","Tang conquest of the Eastern Turkic Khaganate","conquest",629,630,CA,["Tang dynasty","Eastern Turkic Khaganate"],"Tang armies destroyed the Eastern Turks and captured Illig Qaghan.",{theme:"imperial expansion",out:"Eastern Turkic Khaganate collapses"});
R("tang-western-regions","Tang conquest of the Tarim Basin","conquest",640,659,CA,["Tang dynasty","Western Turkic Khaganate","Gaochang"],"Tang took Turfan, Kucha and the Western Turks' lands, establishing the Protectorate of the Western Regions.",{approx:true,conf:"medium",theme:"imperial expansion"});
R("tang-silla-allied","Tang conquest of Goguryeo","conquest",666,668,EA,["Tang dynasty","Silla","Goguryeo"],"Tang and Silla forces captured Pyongyang and ended Goguryeo.",{approx:false});
R("ming-conquest-yunnan","Ming conquest of Yunnan","conquest",1381,1382,EA,["Ming dynasty","Yuan loyalists in Yunnan"],"Ming armies conquered the last Yuan-controlled province.",{theme:"imperial expansion"});
R("wokou-raids","Wokou raids","campaign",1550,1565,EA,["Ming dynasty","Wokou pirates"],"Large pirate raids on the Chinese coast, countered by Qi Jiguang and others.",{approx:true,conf:"medium",theme:"trade"});
R("battle-of-nanjing-1853","Taiping capture of Nanjing","siege",1853,null,EA,["Taiping Heavenly Kingdom","Qing dynasty"],"Taiping forces took Nanjing and made it their capital Tianjing.",{ll:[32.06,118.8],parent:"taiping-rebellion"});
R("jinchuan-campaigns","Jinchuan campaigns","war",1747,1776,EA,["Qing dynasty","Jinchuan Tibetans"],"Two Qing campaigns in Sichuan against the Gyalrong chiefs.",{parent:"ten-great-campaigns"});
R("sino-nepalese-war","Sino-Nepalese War","war",1788,1792,SA,["Qing dynasty","Nepal"],"Qing army drove Gorkha forces out of Tibet.",{parent:"ten-great-campaigns"});
R("qing-conquest-tibet","Qing expedition to Tibet (1720)","campaign",1720,null,EA,["Qing dynasty","Dzungar Khanate"],"Qing army expelled the Dzungars from Lhasa.",{ll:[29.65,91.1],parent:"dzungar-qing"});
R("taiping-hunan","Zeng Guofan's Xiang Army campaigns","campaign",1853,1864,EA,["Qing dynasty","Taiping Heavenly Kingdom"],"Provincial armies raised by Zeng Guofan did much of the fighting against the Taiping.",{parent:"taiping-rebellion"});
R("tungning-penghu-1683","Battle of Penghu","naval-battle",1683,null,EA,["Qing dynasty","Kingdom of Tungning"],"Admiral Shi Lang destroyed the Tungning fleet, leading to the surrender of Taiwan.",{ll:[23.57,119.57],parent:"qing-conquest-taiwan"});

// ---------- Japan / Korea ----------
R("gosannen-war","Later Three-Year War","war",1083,1087,EA,["Minamoto","Kiyohara"],"Minamoto no Yoshiie intervened in a succession dispute in Dewa and Mutsu provinces.",{});
R("kamakura-fall-1333","Siege of Kamakura (1333)","siege",1333,null,EA,["Nitta Yoshisada","Hojo clan"],"Nitta Yoshisada took Kamakura, ending the Kamakura shogunate.",{ll:[35.32,139.55],parent:"genko-war"});
R("kyushu-campaign","Kyushu campaign (1587)","campaign",1587,null,EA,["Toyotomi Hideyoshi","Shimazu clan"],"Hideyoshi subdued the Shimazu of Satsuma, unifying Kyushu under his rule.",{parent:"sengoku-wars"});
R("odawara-1590","Siege of Odawara (1590)","siege",1590,null,EA,["Toyotomi Hideyoshi","Later Hojo clan"],"Hideyoshi's siege of the Hojo fortress completed his unification of Japan.",{ll:[35.25,139.15],parent:"sengoku-wars"});
R("manchu-invasions-korea","Qing invasions of Joseon","war",1627,1637,EA,["Later Jin","Qing dynasty","Joseon"],"Two Manchu invasions made Joseon a tributary of the Qing.",{});
R("khitan-invasions-balhae","Khitan conquest of Balhae","conquest",926,null,EA,["Liao dynasty","Balhae"],"Abaoji's Khitan forces took the Balhae capital, ending the kingdom.",{});
R("goryeo-song-uprising","Rebellion of Myocheong","revolt",1135,1136,EA,["Goryeo"],"Monk Myocheong's attempt to move the capital to Pyongyang failed.",{});
R("hongbyeong","Hong Gyeong-rae's Rebellion","revolt",1811,1812,EA,["Joseon"],"Regional rebellion in northwestern Korea.",{});

// ---------- Southeast Asia ----------
R("dai-viet-sack-vijaya-1044","Dai Viet sack of Vijaya (1044)","siege",1044,null,SEA,["Dai Viet","Champa"],"Ly Thai Tong's army sacked the Cham capital and killed King Sa Dau.",{ll:[13.9,109.1]});
R("majapahit-bali","Majapahit conquest of Bali","conquest",1343,null,SEA,["Majapahit","Bali"],"Gajah Mada's expedition subjugated Bali.",{approx:true,conf:"medium"});
R("bubat-1357","Battle of Bubat","battle",1357,null,SEA,["Majapahit","Sunda Kingdom"],"Majapahit forces killed the Sundanese king's party at Bubat.",{approx:true,conf:"low"});
R("burmese-conquest-shan","Toungoo conquest of the Shan states","conquest",1557,1564,SEA,["Toungoo Burma","Shan states","Lan Na"],"Bayinnaung subjugated the Shan states and Lan Na.",{approx:true,conf:"medium"});
R("siamese-vietnamese-1841","Siamese-Vietnamese War (1841-1845)","war",1841,1845,SEA,["Siam","Vietnam","Cambodia"],"Struggle for control of Cambodia.",{});
R("nguyen-conquest-champa","Vietnamese annexation of Champa","conquest",1692,1832,SEA,["Dai Viet","Champa"],"Nguyen lords gradually absorbed the last Cham territories.",{approx:true,conf:"medium"});

// ---------- South Asia ----------
R("tripartite-struggle","Tripartite struggle for Kannauj","war",750,950,SA,["Pala Empire","Gurjara-Pratihara","Rashtrakuta"],"Three dynasties contested the Gangetic city of Kannauj.",{approx:true,conf:"medium"});
R("chola-chalukya-wars","Chola-Chalukya wars","war",1000,1130,SA,["Chola Empire","Western Chalukya"],"Repeated wars over the Vengi and Raichur regions.",{approx:true,conf:"medium"});
R("raichur-1520","Battle of Raichur (1520)","battle",1520,null,SA,["Vijayanagara Empire","Bijapur Sultanate"],"Krishnadevaraya took the Raichur fort from Ismail Adil Shah.",{ll:[16.2,77.35],parent:"vijayanagara-bahmani"});
R("chittorgarh-1568","Siege of Chittorgarh (1567-1568)","siege",1567,1568,SA,["Mughal Empire","Mewar"],"Akbar captured the Mewar fortress of Chittorgarh.",{ll:[24.88,74.64],parent:"mughal-conquest-india"});
R("mughal-succession-war","Mughal war of succession (1657-1659)","civil-war",1657,1659,SA,["Mughal Empire"],"Shah Jahan's sons fought; Aurangzeb defeated Dara Shikoh and took the throne.",{theme:"dynastic"});
R("samugarh-1658","Battle of Samugarh","battle",1658,null,SA,["Aurangzeb","Dara Shikoh"],"Aurangzeb's decisive victory in the succession war.",{ll:[27.1,78.1],parent:"mughal-succession-war"});
R("pratapgad-1659","Battle of Pratapgad","battle",1659,null,SA,["Maratha","Adilshahi Sultanate"],"Shivaji killed Afzal Khan and routed his army.",{ll:[17.94,73.58]});
R("assaye-1803","Battle of Assaye","battle",1803,null,SA,["East India Company","Maratha Empire"],"Arthur Wellesley defeated a larger Maratha force.",{ll:[20.25,75.95],parent:"second-anglo-maratha"});
R("anglo-nepalese-war","Anglo-Nepalese War","war",1814,1816,SA,["East India Company","Nepal"],"Ended by the Treaty of Sugauli.",{theme:"colonial"});
R("treaty-sugauli","Treaty of Sugauli","treaty",1816,null,SA,["East India Company","Nepal"],"Nepal ceded territory and accepted a British resident.",{links:[["ended_by_of","anglo-nepalese-war"]]});
R("sino-sikh-war","Sino-Sikh War","war",1841,1842,SA,["Sikh Empire","Qing dynasty","Tibet"],"Dogra general Zorawar Singh invaded Ladakh and Tibet.",{});
R("kandahar-1649","Mughal sieges of Kandahar","war",1649,1653,CA,["Mughal Empire","Safavids"],"Three failed Mughal attempts to retake Kandahar.",{});

// ---------- Middle East, Mediterranean ----------
R("fatimid-conquest-egypt","Fatimid conquest of Egypt","conquest",969,null,NAF,["Fatimid Caliphate","Ikhshidid dynasty"],"Jawhar the Sicilian took Egypt and founded Cairo.",{});
R("qatwan-1141","Battle of Qatwan","battle",1141,null,CA,["Kara-Khitan Khanate","Seljuk Empire"],"Yelu Dashi defeated Sultan Sanjar.",{ll:[39.7,66.9]});
R("mongol-qara-khitai","Mongol conquest of Qara Khitai","conquest",1218,null,CA,["Mongol Empire","Qara Khitai"],"Jebe overthrew Kuchlug.",{parent:"mongol-conquests"});
R("rhodes-1522","Siege of Rhodes (1522)","siege",1522,null,MED,["Ottoman Empire","Knights Hospitaller"],"Suleiman the Magnificent took Rhodes.",{ll:[36.44,28.22],parent:"ottoman-habsburg-wars"});
R("preveza-1538","Battle of Preveza","naval-battle",1538,null,MED,["Ottoman Empire","Holy League"],"Barbarossa Hayreddin defeated Andrea Doria.",{ll:[38.95,20.75]});
R("djerba-1560","Battle of Djerba","naval-battle",1560,null,MED,["Ottoman Empire","Spain","Knights Hospitaller"],"Ottoman fleet defeated a Christian expedition.",{ll:[33.8,10.9]});
R("khotyn-1621","Battle of Khotyn (1621)","battle",1621,null,EE,["Poland-Lithuania","Ottoman Empire"],"Polish-Cossack forces held Khotyn against Osman II.",{ll:[48.52,26.5]});
R("zenta-1697","Battle of Zenta","battle",1697,null,EE,["Habsburg Monarchy","Ottoman Empire"],"Prince Eugene of Savoy destroyed the Ottoman army at the Tisza.",{ll:[45.9,20.1],parent:"great-turkish-war"});
R("prut-1711","Prut River Campaign","campaign",1711,null,EE,["Russia","Ottoman Empire"],"Peter the Great's army was surrounded and forced to cede Azov.",{ll:[46.2,28.1]});
R("hormuz-1622","Capture of Hormuz (1622)","siege",1622,null,ME,["Safavids","England","Portugal"],"Safavid-English force took Hormuz from the Portuguese.",{ll:[27.06,56.46],theme:"trade"});

// ---------- Africa ----------
R("tacfarinas","Tacfarinas' revolt","revolt",17,24,NAF,["Rome","Musulamii","Garamantes"],"Numidian revolt against Roman Africa suppressed under Tiberius.",{approx:true});
R("berber-revolt-740","Great Berber Revolt","revolt",740,743,NAF,["Umayyad Caliphate","Berbers"],"Kharijite-inspired revolt that ended Umayyad control west of Ifriqiya.",{theme:"religious"});
R("anglo-ashanti-wars","Anglo-Ashanti wars","war",1824,1900,SSA,["Britain","Ashanti Empire"],"Five conflicts ending in British annexation of Ashanti.",{theme:"colonial"});
R("magdala-1868","British expedition to Abyssinia","campaign",1868,null,SSA,["Britain","Ethiopia"],"Napier's expedition stormed Magdala; Tewodros II died.",{ll:[11.78,39.65],theme:"colonial"});
R("samori-wars","Franco-Samori wars","war",1882,1898,SSA,["France","Wassoulou Empire"],"Resistance of Samori Ture ended with his capture.",{theme:"colonial"});
R("franco-dahomean","Franco-Dahomean Wars","war",1890,1894,SSA,["France","Dahomey"],"French conquest of Dahomey.",{theme:"colonial"});
R("franco-malagasy","Franco-Hova Wars","war",1883,1896,SSA,["France","Merina Kingdom"],"French conquest of Madagascar.",{theme:"colonial"});
R("zanzibar-war","Anglo-Zanzibar War","war",1896,null,SSA,["Britain","Zanzibar"],"Shortest recorded war, about 40 minutes.",{theme:"colonial",ll:[-6.16,39.19]});
R("kanem-bornu","Sayfawa conquest of Kanem-Bornu","war",1380,1400,SSA,["Kanem","Bulala","Bornu"],"Bulala pressure drove the Sayfawa from Kanem to Bornu.",{approx:true,conf:"low"});
R("battle-of-ulundi","Battle of Ulundi","battle",1879,null,SSA,["Britain","Zulu Kingdom"],"Decisive British victory ending the Anglo-Zulu War.",{ll:[-28.3,31.4],parent:"anglo-zulu-war"});

// ---------- Americas ----------
R("tikal-calakmul","Caracol defeat of Tikal","war",562,null,MES,["Caracol","Calakmul","Tikal"],"Caracol, allied with Calakmul, defeated Tikal.",{approx:true,conf:"medium"});
R("inca-chimu","Inca conquest of the Chimu","conquest",1470,null,SAM,["Inca","Chimu"],"Topa Inca took Chan Chan.",{approx:true,conf:"medium",ll:[-8.11,-79.07]});
R("powhatan-wars","Anglo-Powhatan Wars","war",1610,1646,NAM,["Virginia colonists","Powhatan Confederacy"],"Three wars between Virginia and the Powhatan.",{theme:"colonial"});
R("tuscarora-war","Tuscarora War","war",1711,1715,NAM,["North Carolina","Tuscarora"],"War ending Tuscarora power in the Carolinas.",{});
R("natchez-war","Natchez Wars","war",1716,1731,NAM,["France","Natchez"],"Franco-Natchez conflicts.",{approx:true});
R("anglo-cherokee-war","Anglo-Cherokee War","war",1758,1761,NAM,["Britain","Cherokee"],"War on the Carolina frontier.",{parent:"french-indian-war"});
R("fox-wars","Fox Wars","war",1712,1733,NAM,["France","Meskwaki"],"French campaigns against the Meskwaki (Fox).",{});
R("tippecanoe-1811","Battle of Tippecanoe","battle",1811,null,NAM,["United States","Tecumseh's Confederacy"],"Harrison attacked Prophetstown.",{ll:[40.52,-86.84]});
R("creek-war","Creek War","war",1813,1814,NAM,["United States","Red Sticks"],"Jackson defeated the Red Stick Creeks at Horseshoe Bend.",{});
R("caste-war-yucatan","Caste War of Yucatan","war",1847,1901,MES,["Mexico","Yucatan Maya"],"Maya uprising that persisted for over half a century.",{});
R("red-river-rebellion","Red River Rebellion","revolt",1869,1870,NAM,["Metis","Canada"],"Louis Riel's provisional government at Red River.",{});
R("nez-perce-war","Nez Perce War","war",1877,null,NAM,["United States","Nez Perce"],"Chief Joseph's retreat across the northwest.",{});
R("modoc-war","Modoc War","war",1872,1873,NAM,["United States","Modoc"],"Captain Jack's resistance in the lava beds.",{});
R("black-war-tasmania","Black War (Tasmania)","war",1824,1832,OC,["British colonists","Aboriginal Tasmanians"],"Violent conflict in Van Diemen's Land.",{theme:"colonial",approx:false});
R("eureka-stockade","Eureka Rebellion","revolt",1854,null,OC,["Ballarat miners","Victoria colony"],"Armed miners' revolt at Ballarat.",{ll:[-37.56,143.86]});
R("flagstaff-war","Flagstaff War","war",1845,1846,OC,["Britain","Ngapuhi"],"First major clash of the New Zealand Wars.",{parent:"new-zealand-wars",theme:"colonial"});
R("waikato-war","Invasion of the Waikato","war",1863,1864,OC,["Britain","Kingitanga"],"British invasion of the Maori King's territory.",{parent:"new-zealand-wars",theme:"colonial"});

// ---------- Europe, secondary ----------
R("brunanburh-937","Battle of Brunanburh","battle",937,null,WE,["England","Scotland","Dublin Norse"],"Athelstan defeated a northern coalition.",{});
R("clontarf-1014","Battle of Clontarf","battle",1014,null,WE,["Brian Boru","Leinster","Dublin Norse"],"Brian Boru's forces defeated Leinster and the Norse of Dublin but he was killed.",{ll:[53.36,-6.2]});
R("second-barons-war","Second Barons' War","civil-war",1264,1267,WE,["Simon de Montfort","Henry III"],"Baronial rebellion against Henry III.",{});
R("lewes-1264","Battle of Lewes","battle",1264,null,WE,["Simon de Montfort","Henry III"],"Montfort captured the king.",{ll:[50.88,0.01],parent:"second-barons-war"});
R("evesham-1265","Battle of Evesham","battle",1265,null,WE,["Prince Edward","Simon de Montfort"],"Montfort killed.",{ll:[52.09,-1.95],parent:"second-barons-war"});
R("aljubarrota-1385","Battle of Aljubarrota","battle",1385,null,WE,["Portugal","Castile"],"Portuguese victory secured the House of Aviz.",{ll:[39.6,-8.9],parent:"crisis-1383-1385"});
R("crisis-1383-1385","1383-1385 Crisis in Portugal","civil-war",1383,1385,WE,["Portugal","Castile"],"Succession crisis resolved at Aljubarrota.",{theme:"dynastic"});
R("castilian-succession-war","War of the Castilian Succession","war",1475,1479,WE,["Castile","Portugal"],"Isabella's claim secured against Joanna and Portugal.",{theme:"dynastic"});
R("courtrai-1302","Battle of the Golden Spurs","battle",1302,null,WE,["Flemish towns","France"],"Flemish militia defeated French knights.",{ll:[50.82,3.27],alias:["Battle of Courtrai (1302)"]});
R("muret-1213","Battle of Muret","battle",1213,null,WE,["Crusaders","Aragon","Toulouse"],"Simon de Montfort defeated Peter II of Aragon.",{ll:[43.46,1.33],parent:"albigensian-crusade"});
R("monsegur-1244","Siege of Montsegur","siege",1243,1244,WE,["France","Cathars"],"Fall of the Cathar stronghold.",{ll:[42.88,1.83],parent:"albigensian-crusade",alias:["Siege of Montségur"]});
R("benevento-1266","Battle of Benevento","battle",1266,null,MED,["Charles of Anjou","Hohenstaufen"],"Manfred of Sicily killed.",{ll:[41.13,14.78]});
R("tagliacozzo-1268","Battle of Tagliacozzo","battle",1268,null,MED,["Charles of Anjou","Conradin"],"End of Hohenstaufen rule in Sicily.",{ll:[42.07,13.25]});
R("campaldino-1289","Battle of Campaldino","battle",1289,null,MED,["Florence","Arezzo"],"Guelph Florence defeated Ghibelline Arezzo.",{ll:[43.76,11.48]});
R("anghiari-1440","Battle of Anghiari (1440)","battle",1440,null,MED,["Florence","Milan"],"Florence defeated Milan.",{ll:[43.54,12.06]});
R("wars-in-lombardy","Wars in Lombardy","war",1423,1454,MED,["Milan","Venice","Florence"],"Italian city-state wars ended by the Peace of Lodi.",{});
R("peace-of-lodi","Peace of Lodi","treaty",1454,null,MED,["Milan","Venice"],"Ended the Wars in Lombardy.",{links:[["ended_by_of","wars-in-lombardy"]]});
R("swabian-war","Swabian War","war",1499,null,WE,["Swiss Confederacy","Swabian League"],"Swiss de facto independence from the Empire.",{});
R("treaty-basel-1499","Peace of Basel (1499)","treaty",1499,null,WE,["Swiss Confederacy","Holy Roman Empire"],"Ended the Swabian War.",{links:[["ended_by_of","swabian-war"]]});
R("flodden-1513","Battle of Flodden","battle",1513,null,WE,["England","Scotland"],"James IV killed.",{ll:[55.62,-2.14]});
R("pinkie-1547","Battle of Pinkie Cleugh","battle",1547,null,WE,["England","Scotland"],"English victory in the Rough Wooing.",{ll:[55.93,-3.02]});
R("scanian-war","Scanian War","war",1675,1679,WE,["Sweden","Denmark-Norway","Brandenburg"],"Danish attempt to retake Scania.",{});
R("kalmar-war","Kalmar War","war",1611,1613,WE,["Denmark-Norway","Sweden"],"War over Baltic control.",{});
R("dunbar-1650","Battle of Dunbar (1650)","battle",1650,null,WE,["England","Scotland"],"Cromwell defeated the Scottish Covenanters.",{ll:[55.98,-2.5],parent:"english-civil-wars"});
R("londonderry-1689","Siege of Derry","siege",1689,null,WE,["Williamites","Jacobites"],"Derry held for 105 days.",{ll:[54.99,-7.32],parent:"williamite-war"});
R("prestonpans-1745","Battle of Prestonpans","battle",1745,null,WE,["Jacobites","Great Britain"],"Jacobite victory.",{ll:[55.96,-2.97],parent:"jacobite-rising-1745"});
R("kappel-wars","Kappel Wars","war",1529,1531,WE,["Zurich","Catholic cantons"],"Swiss Reformation conflicts; Zwingli killed in 1531.",{theme:"religious"});
R("sonderbund-war","Sonderbund War","civil-war",1847,null,WE,["Swiss Confederation","Sonderbund"],"Brief Swiss civil war between liberals and Catholic cantons.",{theme:"religious"});
R("landshut-succession","War of the Succession of Landshut","war",1503,1505,WE,["Bavaria-Munich","Palatinate"],"Wittelsbach succession war.",{theme:"dynastic"});
R("pavia-siege-773","Siege of Pavia (773-774)","siege",773,774,MED,["Franks","Lombards"],"Charlemagne took the Lombard capital.",{ll:[45.19,9.16],parent:"frankish-lombard-war"});
R("battle-of-soissons-486","Battle of Soissons (486)","battle",486,null,WE,["Franks","Gallo-Roman state"],"Clovis defeated Syagrius.",{ll:[49.38,3.32],approx:true,conf:"medium"});
R("tolbiac-496","Battle of Tolbiac","battle",496,null,WE,["Franks","Alemanni"],"Clovis victory, traditional context of his conversion.",{approx:true,conf:"low"});
R("rus-attack-constantinople-860","Rus' attack on Constantinople (860)","siege",860,null,AN,["Rus'","Byzantine Empire"],"First recorded Rus' raid on Constantinople.",{ll:[41.01,28.98]});
R("magyar-raids-europe","Magyar raids on Europe","campaign",899,955,WE,["Magyars","Holy Roman Empire","East Francia"],"Magyar raids ended at Lechfeld.",{approx:true,conf:"medium"});

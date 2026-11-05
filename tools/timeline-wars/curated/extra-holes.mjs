// Curated rows deliberately added for coverage holes: South Asia, Africa, Southeast Asia, the Americas, Oceania, Central Asia.
import { makeR, WE, EE, MED, ME, AN, CA, SA, EA, SEA, OC, SSA, NAF, NAM, MES, SAM, GL } from "./lib.mjs";
export const rows = [];
const R = makeR(rows);

// ---------- South Asia ----------
R("eltekeh-701","Battle of Eltekeh","battle",-701,null,ME,["Assyria","Egypt","Kush","Judah"],"Sennacherib defeated an Egyptian-Kushite relief force sent to aid Hezekiah's allies.",{ll:[31.8,34.9],parent:"sennacherib-judah-campaign",approx:true,conf:"medium"});
R("arab-conquest-sindh","Umayyad conquest of Sindh","conquest",711,713,SA,["Umayyad Caliphate","Sindh"],"Muhammad bin Qasim conquered Sindh for the Umayyad Caliphate.",{theme:"religious"});
R("aror-712","Battle of Aror","battle",712,null,SA,["Umayyad Caliphate","Sindh"],"Muhammad bin Qasim defeated Raja Dahir's successors and took Aror.",{ll:[27.8,68.9],parent:"arab-conquest-sindh",approx:true,conf:"medium"});
R("rajasthan-738","Battle of Rajasthan","battle",738,null,SA,["Gurjara-Pratihara","Umayyad Caliphate"],"Rajput kingdoms under Nagabhata I stopped the Arab advance into India.",{approx:true,conf:"low"});
R("vatapi-642","Siege of Vatapi","siege",642,null,SA,["Pallava","Chalukya"],"Narasimhavarman I of the Pallavas took the Chalukya capital and killed Pulakeshin II.",{ll:[15.92,75.68],approx:true,conf:"medium"});
R("koppam-1054","Battle of Koppam","battle",1054,null,SA,["Western Chalukya","Chola Empire"],"Chola ruler Rajadhiraja was killed but the Cholas won the day under Rajendra II.",{ll:[15.5,76.1],parent:"chola-chalukya-wars",approx:true,conf:"medium"});
R("peshawar-1001","Battle of Peshawar (1001)","battle",1001,null,SA,["Ghaznavids","Hindu Shahi"],"Mahmud of Ghazni defeated Jayapala of the Hindu Shahis.",{ll:[34.0,71.57],parent:"ghaznavid-india"});
R("waihind-1008","Battle of Waihind","battle",1008,null,SA,["Ghaznavids","Hindu Shahi"],"Mahmud defeated a Hindu Shahi-led Indian alliance.",{ll:[34.1,72.2],parent:"ghaznavid-india",approx:true,conf:"medium"});
R("chandawar-1194","Battle of Chandawar","battle",1194,null,SA,["Ghurids","Gahadavala"],"Muhammad of Ghor defeated Jayachandra of Kannauj.",{ll:[27.2,78.4],parent:"ghurid-conquest-india"});
R("khalji-gujarat","Delhi Sultanate conquest of Gujarat","conquest",1299,null,SA,["Delhi Sultanate","Gujarat"],"Alauddin Khalji's generals Ulugh Khan and Nusrat Khan overran Gujarat.",{approx:true});
R("ranthambore-1301","Siege of Ranthambore (1301)","siege",1301,null,SA,["Delhi Sultanate","Chahamana"],"Alauddin Khalji captured the Ranthambore fort.",{ll:[26.02,76.5]});
R("chittor-1303","Siege of Chittorgarh (1303)","siege",1303,null,SA,["Delhi Sultanate","Guhila"],"Alauddin Khalji took Chittor.",{ll:[24.88,74.64]});
R("delhi-1303","Mongol siege of Delhi (1303)","siege",1303,null,SA,["Mongol Empire","Delhi Sultanate"],"Chagatai army under Taraghai besieged Delhi and withdrew after two months.",{ll:[28.65,77.23],parent:"mongol-delhi"});
R("warangal-1323","Siege of Warangal (1323)","siege",1323,null,SA,["Delhi Sultanate","Kakatiya dynasty"],"Ulugh Khan took Warangal and ended Kakatiya rule.",{ll:[17.98,79.6]});
R("parwan-1221","Battle of Parwan","battle",1221,null,CA,["Khwarazmian Empire","Mongol Empire"],"Jalal ad-Din Mingburnu defeated a Mongol detachment.",{ll:[35.0,69.2],parent:"mongol-khwarazmian-war"});
R("indus-1221","Battle of the Indus","battle",1221,null,SA,["Mongol Empire","Khwarazmian Empire"],"Genghis Khan defeated Jalal ad-Din on the Indus.",{ll:[33.9,72.2],parent:"mongol-khwarazmian-war"});
R("sack-surat-1664","Sack of Surat (1664)","siege",1664,null,SA,["Maratha","Mughal Empire"],"Shivaji plundered the Mughal port of Surat.",{ll:[21.17,72.83],parent:"mughal-deccan-wars",approx:true});
R("sinhagad-1670","Battle of Sinhagad","battle",1670,null,SA,["Maratha","Mughal Empire"],"Tanaji Malusare's Marathas captured Kondhana (Sinhagad).",{ll:[18.37,73.76]});
R("palkhed-1728","Battle of Palkhed","battle",1728,null,SA,["Maratha","Hyderabad"],"Peshwa Baji Rao I outmanoeuvred the Nizam.",{ll:[20.0,74.1]});
R("bhopal-1737","Battle of Bhopal (1737)","battle",1737,null,SA,["Maratha","Mughal Empire","Hyderabad"],"Baji Rao I defeated the Mughal-Nizam army.",{ll:[23.26,77.41]});
R("bargi-raids","Maratha invasions of Bengal","campaign",1741,1751,SA,["Maratha","Bengal Subah"],"Repeated raids on Bengal by Bhonsle forces.",{approx:false});
R("udgir-1760","Battle of Udgir","battle",1760,null,SA,["Maratha","Hyderabad"],"Sadashivrao Bhau defeated the Nizam's army.",{ll:[18.4,77.1]});
R("jamrud-1837","Battle of Jamrud","battle",1837,null,SA,["Sikh Empire","Afghanistan"],"Sikhs under Hari Singh Nalwa clashed with Dost Mohammad's forces; Nalwa was killed.",{ll:[34.0,71.4]});
R("randeniwela-1630","Battle of Randeniwela","battle",1630,null,SA,["Kingdom of Kandy","Portuguese Ceylon"],"Kandyan victory over a Portuguese army.",{ll:[7.1,80.6]});
R("gannoruwa-1638","Battle of Gannoruwa","battle",1638,null,SA,["Kingdom of Kandy","Portuguese Ceylon"],"Kandy under Rajasinghe II destroyed a Portuguese force.",{ll:[7.26,80.6]});
R("portuguese-ceylon-wars","Portuguese-Kandyan wars","war",1505,1658,SA,["Portugal","Kingdom of Kandy","Kotte"],"Portugal's conquest of coastal Sri Lanka and its wars with Kandy.",{approx:true,theme:"colonial"});
R("ahom-mughal-wars","Ahom-Mughal conflicts","war",1615,1682,SA,["Ahom Kingdom","Mughal Empire"],"Mughal attempts to subdue Assam, ending with Ahom victory at Itakhuli.",{approx:true});

// ---------- Central Asia ----------
R("qutayba-transoxiana","Qutayba ibn Muslim's conquest of Transoxiana","conquest",705,715,CA,["Umayyad Caliphate","Sogdians","Turgesh"],"Umayyad governor of Khurasan conquered Bukhara, Samarkand and Khwarazm.",{theme:"religious"});
R("merv-1510","Battle of Merv (1510)","battle",1510,null,CA,["Shaybanids","Safavids"],"Ismail I defeated and killed Muhammad Shaybani.",{ll:[37.66,62.19]});
R("tashkent-1865","Fall of Tashkent","siege",1865,null,CA,["Russian Empire","Kokand Khanate"],"General Chernyayev took Tashkent.",{ll:[41.3,69.27],theme:"colonial"});
R("khiva-1873","Russian conquest of Khiva","campaign",1873,null,CA,["Russian Empire","Khiva Khanate"],"Russian columns forced Khiva into vassalage.",{ll:[41.38,60.36],theme:"colonial"});
R("geok-tepe-1881","Siege of Geok Tepe","siege",1881,null,CA,["Russian Empire","Teke Turkmens"],"Skobelev stormed the Turkmen fortress.",{ll:[38.0,58.2],theme:"colonial"});
R("basmachi-revolt","Basmachi movement","revolt",1916,1934,CA,["Soviet Union","Basmachi"],"Guerrilla revolt against Russian and Soviet rule in Central Asia.",{theme:"independence"});

// ---------- Sub-Saharan Africa ----------
R("aksum-himyar","Aksumite invasion of Himyar","conquest",525,null,ME,["Aksum","Himyarite Kingdom"],"Kaleb of Aksum invaded Yemen and defeated Dhu Nuwas.",{approx:true,conf:"medium",theme:"religious"});
R("amda-seyon","Campaigns of Amda Seyon I","campaign",1316,1332,SSA,["Ethiopian Empire","Ifat","Adal"],"Ethiopian expansion against Muslim sultanates culminating in the conquest of Ifat.",{approx:true,conf:"medium"});
R("abushiri","Abushiri revolt","revolt",1888,1889,SSA,["German East Africa Company","Swahili coast"],"Coastal revolt against German company rule.",{theme:"colonial"});
R("dogali-1887","Battle of Dogali","battle",1887,null,SSA,["Ethiopia","Italy"],"Ras Alula's force destroyed an Italian column.",{ll:[15.58,39.45]});
R("metemma-1889","Battle of Gallabat (Metemma)","battle",1889,null,SSA,["Mahdist State","Ethiopia"],"Mahdist forces defeated Yohannes IV, who died in the battle.",{ll:[12.97,36.15],parent:"mahdist-war"});
R("amba-alagi-1895","Battle of Amba Alagi","battle",1895,null,SSA,["Ethiopia","Italy"],"Ethiopians destroyed Major Toselli's detachment.",{ll:[12.9,39.5],parent:"first-italo-ethiopian"});
R("somali-dervish","Dervish movement (Somaliland campaign)","war",1899,1920,SSA,["Dervish State","Britain","Italy","Ethiopia"],"Mohammed Abdullah Hassan's long resistance, ended by RAF bombing in 1920.",{theme:"colonial"});
R("first-matabele-war","First Matabele War","war",1893,1894,SSA,["British South Africa Company","Ndebele Kingdom"],"BSAC defeated Lobengula's Ndebele kingdom.",{theme:"colonial"});
R("second-matabele-war","Second Matabele War (First Chimurenga)","revolt",1896,1897,SSA,["Ndebele","Shona","British South Africa Company"],"Ndebele and Shona rising against BSAC rule.",{theme:"colonial"});
R("hut-tax-war","Hut Tax War of 1898","revolt",1898,null,SSA,["Britain","Temne","Mende"],"Uprising in Sierra Leone against the hut tax.",{theme:"colonial"});
R("nsamankow-1824","Battle of Nsamankow","battle",1824,null,SSA,["Ashanti Empire","Britain"],"Ashanti killed Governor Charles MacCarthy.",{ll:[5.6,-1.4],parent:"anglo-ashanti-wars"});
R("kiriji-war","Kiriji War","war",1877,1893,SSA,["Ibadan","Ekitiparapo"],"Last great Yoruba civil war.",{});
R("tukulor-jihad","Toucouleur jihad of El Hadj Umar","war",1848,1864,SSA,["Toucouleur Empire","Bambara","Massina"],"Umar Tall's jihad created the Toucouleur Empire.",{theme:"religious"});
R("segou-1861","Fall of Segou","siege",1861,null,SSA,["Toucouleur Empire","Bambara Empire"],"Umar Tall took Segou.",{ll:[13.43,-6.27],parent:"tukulor-jihad"});
R("xhosa-wars","Xhosa Wars (Cape Frontier Wars)","war",1779,1879,SSA,["Xhosa","Cape Colony","Britain"],"Nine wars on the eastern Cape frontier.",{theme:"colonial"});
R("kambula-1879","Battle of Kambula","battle",1879,null,SSA,["Britain","Zulu Kingdom"],"British victory over the main Zulu impi.",{ll:[-27.7,30.6],parent:"anglo-zulu-war"});
R("congella-1842","Battle of Congella","battle",1842,null,SSA,["Voortrekkers","Britain"],"Boer attack on the British camp at Port Natal.",{ll:[-29.9,31.0]});
R("portuguese-conquest-angola","Portuguese conquest of Angola","conquest",1575,1630,SSA,["Portugal","Ndongo","Kongo"],"Portuguese wars against Ndongo and neighbours.",{approx:true,conf:"low",theme:"colonial"});
R("mali-gao-conquest","Mali conquest of Gao","conquest",1325,null,SSA,["Mali Empire","Gao"],"Mansa Musa's forces took Gao, traditionally.",{approx:true,conf:"low"});
R("askia-songhai-jihad","Askia Muhammad's expansion of Songhai","conquest",1493,1528,SSA,["Songhai Empire","Mossi","Hausa states"],"Askia the Great extended Songhai to its greatest size.",{approx:true,conf:"medium"});

// ---------- Southeast Asia ----------
R("bach-dang-938","Battle of Bach Dang (938)","naval-battle",938,null,SEA,["Ngo Quyen","Southern Han"],"Ngo Quyen's stakes trap destroyed the Southern Han fleet, ending Chinese rule.",{ll:[20.9,106.8],theme:"independence"});
R("song-dai-viet-981","Song-Dai Viet war (981)","war",981,null,SEA,["Dai Viet","Song dynasty"],"Le Hoan repelled the Song invasion.",{});
R("dong-bo-dau-1258","Battle of Dong Bo Dau","battle",1258,null,SEA,["Mongol Empire","Dai Viet"],"Mongols defeated the Tran army and briefly took Thang Long.",{ll:[21.1,105.6],parent:"mongol-invasions-vietnam",approx:true,conf:"medium"});
R("van-kiep-1285","Battle of Van Kiep","battle",1285,null,SEA,["Yuan dynasty","Dai Viet"],"Tran forces defeated the second Yuan invasion near Van Kiep.",{ll:[21.1,106.4],parent:"mongol-invasions-vietnam",approx:true,conf:"medium"});
R("tot-dong-1426","Battle of Tot Dong-Chuc Dong","battle",1426,null,SEA,["Lam Son","Ming dynasty"],"Le Loi's forces defeated the Ming relief army.",{ll:[20.9,105.8],parent:"lam-son"});
R("chi-lang-1427","Battle of Chi Lang","battle",1427,null,SEA,["Lam Son","Ming dynasty"],"Ambush that destroyed a Ming army and ended the war.",{ll:[21.6,106.7],parent:"lam-son"});
R("ngasaungyan-1277","Battle of Ngasaungyan","battle",1277,null,SEA,["Yuan dynasty","Pagan Kingdom"],"Yuan forces defeated the Burmese army on the Burma-Yunnan border.",{ll:[24.0,98.0],parent:"mongol-invasions-burma"});
R("thaton-1057","Conquest of Thaton","siege",1057,null,SEA,["Pagan Kingdom","Thaton"],"Anawrahta of Pagan took the Mon capital.",{ll:[16.92,97.37],approx:true,conf:"medium"});
R("forty-years-war-burma","Forty Years' War (Ava-Hanthawaddy)","war",1385,1424,SEA,["Ava Kingdom","Hanthawaddy Kingdom"],"Long war between Ava and the Mon kingdom of Hanthawaddy.",{});
R("tonle-sap-1177","Battle of Tonle Sap","naval-battle",1177,null,SEA,["Khmer Empire","Champa"],"Jayavarman VII's fleet defeated the Cham fleet.",{ll:[13.0,104.0],parent:"khmer-cham-war",approx:true,conf:"low"});
R("khmer-conquest-champa-1203","Khmer conquest of Champa","conquest",1203,null,SEA,["Khmer Empire","Champa"],"Jayavarman VII annexed Champa.",{approx:true,conf:"medium",parent:"khmer-cham-war"});
R("ayutthaya-sukhothai","Ayutthaya's subjugation of Sukhothai","war",1378,null,SEA,["Ayutthaya","Sukhothai"],"Ayutthaya reduced Sukhothai to a vassal.",{approx:true,conf:"medium"});
R("lan-na-ayutthaya","Ayutthaya-Lan Na war","war",1441,1474,SEA,["Ayutthaya","Lan Na"],"Long war over the upper Chao Phraya.",{});
R("chenla-funan","Chenla conquest of Funan","conquest",550,627,SEA,["Chenla","Funan"],"Funan was absorbed by Chenla.",{approx:true,conf:"low"});
R("demak-majapahit","Demak conquest of Majapahit","conquest",1527,null,SEA,["Demak Sultanate","Majapahit"],"Traditional date of Majapahit's fall to Demak.",{approx:true,conf:"low"});
R("sunda-kelapa-1527","Conquest of Sunda Kelapa","siege",1527,null,SEA,["Demak Sultanate","Sunda Kingdom","Portugal"],"Fatahillah took Sunda Kelapa (later Jakarta).",{ll:[-6.12,106.81],approx:true,conf:"medium"});
R("mactan-1521","Battle of Mactan","battle",1521,null,SEA,["Cebu","Lapulapu","Spain"],"Lapulapu's warriors killed Ferdinand Magellan.",{ll:[10.31,123.98]});
R("spanish-conquest-philippines","Spanish conquest of the Philippines","conquest",1565,1571,SEA,["Spain","Philippine polities"],"Legazpi's settlement of Cebu and conquest of Manila.",{theme:"colonial"});
R("limahong-manila-1574","Limahong's attack on Manila","siege",1574,null,SEA,["Limahong","Spain"],"Pirate Limahong attacked Spanish Manila and was repulsed.",{ll:[14.6,120.97],parent:"spanish-conquest-philippines"});
R("philippine-revolution","Philippine Revolution","revolt",1896,1898,SEA,["Katipunan","Spain"],"Revolt against Spanish rule.",{theme:"independence"});
R("french-tonkin-campaign","Tonkin campaign","campaign",1883,1886,SEA,["France","Black Flag Army","Qing dynasty"],"French conquest of northern Vietnam.",{parent:"french-conquest-vietnam"});

// ---------- Americas ----------
R("inca-civil-war","Inca civil war (Huascar vs Atahualpa)","civil-war",1529,1532,SAM,["Inca","Huascar","Atahualpa"],"Succession war that weakened the Inca state before the Spanish arrival.",{theme:"dynastic",parent:"conquest-inca"});
R("quipaipan-1532","Battle of Quipaipan","battle",1532,null,SAM,["Atahualpa","Huascar"],"Atahualpa's generals captured Huascar.",{ll:[-13.5,-72.0],parent:"inca-civil-war",approx:true,conf:"medium"});
R("conquest-guatemala","Spanish conquest of Guatemala","conquest",1524,1541,MES,["Spain","K'iche'","Kaqchikel"],"Alvarado's campaigns against highland Maya kingdoms.",{theme:"colonial",approx:true,conf:"medium"});
R("utatlan-1524","Battle of Utatlan","battle",1524,null,MES,["Spain","K'iche'"],"Alvarado defeated the K'iche' and burned Q'umarkaj.",{ll:[15.02,-91.18],parent:"conquest-guatemala"});
R("conquest-muisca","Spanish conquest of the Muisca","conquest",1537,1540,SAM,["Spain","Muisca"],"Jimenez de Quesada's conquest of the Muisca confederation.",{theme:"colonial",approx:true});
R("tucapel-1553","Battle of Tucapel","battle",1553,null,SAM,["Mapuche","Spain"],"Lautaro's Mapuche killed Pedro de Valdivia.",{ll:[-37.6,-73.3],parent:"arauco-war"});
R("conquistador-civil-wars","Civil wars of the Conquistadors (Peru)","civil-war",1537,1554,SAM,["Pizarristas","Almagristas","Spanish Crown"],"Conflicts among the Spanish conquerors of Peru.",{approx:false});
R("las-salinas-1538","Battle of Las Salinas (1538)","battle",1538,null,SAM,["Pizarro","Almagro"],"Pizarro's faction defeated Almagro.",{ll:[-13.55,-71.9],parent:"conquistador-civil-wars"});
R("chupas-1542","Battle of Chupas","battle",1542,null,SAM,["Spanish Crown","Almagristas"],"Royalists defeated the son of Almagro.",{ll:[-13.0,-74.0],parent:"conquistador-civil-wars"});
R("jaquijahuana-1548","Battle of Jaquijahuana","battle",1548,null,SAM,["Spanish Crown","Gonzalo Pizarro"],"La Gasca defeated Gonzalo Pizarro.",{ll:[-13.55,-72.0],parent:"conquistador-civil-wars"});
R("mabila-1540","Battle of Mabila","battle",1540,null,NAM,["Spain","Mobile chiefdom"],"De Soto's expedition fought Tuskaloosa's warriors.",{ll:[31.5,-87.8]});
R("tiguex-war","Tiguex War","war",1540,1541,NAM,["Spain","Pueblo peoples"],"Coronado's expedition vs the Tiwa pueblos.",{ll:[35.3,-106.5]});
R("axochco-1478","Aztec-Tarascan war (Battle of Axochco)","war",1478,null,MES,["Aztec Empire","Tarascan state"],"Tarascans defeated Axayacatl's invasion.",{approx:true,conf:"medium"});
R("emboabas-war","War of the Emboabas","civil-war",1707,1709,SAM,["Paulistas","Emboabas"],"Gold-rush conflict in Minas Gerais.",{});
R("canudos-war","War of Canudos","civil-war",1896,1897,SAM,["Brazil","Canudos"],"Brazilian army destroyed the Canudos settlement.",{ll:[-9.9,-39.1]});
R("farroupilha","Ragamuffin War (Farroupilha)","civil-war",1835,1845,SAM,["Brazil","Rio Grande do Sul"],"Republican rebellion in southern Brazil.",{theme:"independence"});
R("thousand-days-war","Thousand Days' War","civil-war",1899,1902,SAM,["Colombia"],"Liberal-Conservative civil war.",{theme:"civil"});
R("cristero-war","Cristero War","civil-war",1926,1929,MES,["Mexico","Cristeros"],"Catholic uprising against anticlerical laws.",{theme:"religious"});
R("banana-wars","Banana Wars","campaign",1898,1934,MES,["United States","Caribbean and Central American states"],"US interventions in the Caribbean and Central America.",{theme:"colonial"});
R("chilean-civil-war-1891","Chilean Civil War of 1891","civil-war",1891,null,SAM,["Congress","President Balmaceda"],"War between the Congress and President Balmaceda.",{theme:"civil"});
R("argentine-civil-wars","Argentine Civil Wars","civil-war",1814,1880,SAM,["Unitarians","Federalists"],"Decades of conflict over the shape of Argentina.",{approx:false,theme:"civil"});
R("venezuelan-federal-war","Federal War (Venezuela)","civil-war",1859,1863,SAM,["Liberals","Conservatives"],"Venezuelan civil war.",{theme:"civil"});

// ---------- Oceania ----------
R("castle-hill-1804","Castle Hill convict rebellion","revolt",1804,null,OC,["Irish convicts","New South Wales"],"Convict uprising suppressed at Vinegar Hill.",{ll:[-33.73,150.99]});
R("rum-rebellion","Rum Rebellion","revolt",1808,null,OC,["New South Wales Corps","Governor Bligh"],"Military coup deposing Governor Bligh.",{ll:[-33.86,151.21]});
R("wairau-1843","Wairau Affray","battle",1843,null,OC,["Ngati Toa","New Zealand Company"],"Armed clash that killed 22 settlers.",{ll:[-41.5,173.9],parent:"new-zealand-wars",theme:"colonial"});
R("ruapekapeka-1846","Battle of Ruapekapeka","battle",1846,null,OC,["Britain","Ngapuhi"],"Final battle of the Flagstaff War.",{ll:[-35.4,174.1],parent:"flagstaff-war"});
R("taranaki-war","First Taranaki War","war",1860,1861,OC,["Britain","Taranaki Maori"],"War over land at Waitara.",{parent:"new-zealand-wars",theme:"colonial"});
R("gate-pa-1864","Battle of Gate Pa","battle",1864,null,OC,["Ngai Te Rangi","Britain"],"Maori defenders repulsed a British assault.",{ll:[-37.7,176.1],parent:"new-zealand-wars"});
R("orakau-1864","Siege of Orakau","siege",1864,null,OC,["Kingitanga","Britain"],"Defence of Orakau pa.",{ll:[-38.1,175.2],parent:"waikato-war"});
R("te-kooti-war","Te Kooti's War","war",1868,1872,OC,["Te Kooti","New Zealand government"],"Guerrilla war led by Te Kooti.",{parent:"new-zealand-wars"});
R("franco-tahitian-war","Franco-Tahitian War","war",1844,1847,OC,["France","Tahiti"],"French conquest of Tahiti.",{theme:"colonial"});
R("samoan-civil-wars","Samoan Civil Wars","civil-war",1886,1899,OC,["Samoa","Germany","United States","Britain"],"Succession wars with great-power involvement.",{approx:false});
R("kanak-revolt-1878","Kanak revolt of 1878","revolt",1878,1879,OC,["France","Kanak"],"Ataï's revolt in New Caledonia.",{theme:"colonial"});
R("tarawa-1943","Battle of Tarawa","battle",1943,null,OC,["United States","Japan"],"Marines took Betio atoll with heavy losses.",{ll:[1.36,172.93],parent:"pacific-war"});
R("saipan-1944","Battle of Saipan","battle",1944,null,OC,["United States","Japan"],"US capture of the Marianas bastion.",{ll:[15.18,145.75],parent:"pacific-war"});
R("peleliu-1944","Battle of Peleliu","battle",1944,null,OC,["United States","Japan"],"Costly amphibious battle in the Palau Islands.",{ll:[7.0,134.25],parent:"pacific-war"});
R("bougainville-campaign","Bougainville campaign","campaign",1943,1945,OC,["Allies","Japan"],"Allied operations on Bougainville.",{parent:"pacific-war"});
R("new-guinea-campaign","New Guinea campaign","campaign",1942,1945,OC,["Allies","Japan"],"Long Allied campaign against Japanese forces on New Guinea.",{parent:"pacific-war"});

// Curated medieval rows (500-1500): Mongols, Asia, Africa, Americas, Oceania.
import { makeR, WE, EE, MED, ME, AN, CA, SA, EA, SEA, OC, SSA, NAF, NAM, MES, SAM, GL } from "./lib.mjs";
export const rows = [];
const R = makeR(rows);

// ---------- Mongols ----------
R("mongol-conquests","Mongol conquests","conquest",1206,1368,GL,["Mongol Empire","Yuan dynasty","Golden Horde","Ilkhanate"],"Mongol expansion across Eurasia from the proclamation of Genghis Khan to the fall of Yuan.",{theme:"imperial expansion",approx:false});
R("mongol-jin-war","Mongol conquest of the Jin dynasty","war",1211,1234,EA,["Mongol Empire","Jin dynasty"],"Mongols destroyed Jin in northern China.",{parent:"mongol-conquests",sides:[["Mongol Empire","Song (late)"],["Jin dynasty"]]});
R("zhongdu-1215","Siege of Zhongdu","siege",1213,1215,EA,["Mongol Empire","Jin dynasty"],"Mongol capture of the Jin capital (Beijing).",{ll:[39.9,116.4],parent:"mongol-jin-war"});
R("mongol-khwarazmian-war","Mongol conquest of the Khwarazmian Empire","war",1219,1221,CA,["Mongol Empire","Khwarazmian Empire"],"Genghis Khan's campaign after the Otrar incident.",{parent:"mongol-conquests"});
R("samarkand-1220","Siege of Samarkand (1220)","siege",1220,null,CA,["Mongol Empire","Khwarazmian Empire"],"Mongol capture of Samarkand.",{ll:[39.65,66.96],parent:"mongol-khwarazmian-war"});
R("kalka-river-1223","Battle of the Kalka River","battle",1223,null,EE,["Mongol Empire","Kievan Rus'","Cumans"],"Subutai and Jebe destroyed a Rus-Cuman coalition.",{ll:[47.3,37.6],parent:"mongol-conquests"});
R("mongol-invasion-rus","Mongol invasion of Rus'","conquest",1237,1242,EE,["Mongol Empire","Rus' principalities"],"Batu Khan's conquest of the Rus' principalities.",{parent:"mongol-conquests"});
R("kyiv-1240","Siege of Kiev (1240)","siege",1240,null,EE,["Mongol Empire","Kiev"],"Mongol sack of Kiev.",{ll:[50.45,30.52],parent:"mongol-invasion-rus"});
R("mongol-invasion-europe","Mongol invasion of Europe","campaign",1241,1242,EE,["Mongol Empire","Poland","Hungary"],"Subutai and Batu's campaign into Poland and Hungary.",{parent:"mongol-conquests"});
R("legnica-1241","Battle of Legnica","battle",1241,null,EE,["Mongol Empire","Poland"],"Mongols defeated a Polish-German army.",{ll:[51.2,16.2],parent:"mongol-invasion-europe"});
R("mohi-1241","Battle of Mohi","battle",1241,null,EE,["Mongol Empire","Hungary"],"Mongol victory over Bela IV.",{ll:[47.9,21.1],parent:"mongol-invasion-europe"});
R("mongol-conquest-song","Mongol conquest of the Song dynasty","war",1235,1279,EA,["Mongol Empire","Yuan dynasty","Southern Song"],"Kublai Khan's conquest of southern China.",{parent:"mongol-conquests"});
R("xiangyang-1273","Siege of Xiangyang","siege",1268,1273,EA,["Yuan dynasty","Southern Song"],"Six-year siege.",{ll:[32.04,112.1],parent:"mongol-conquest-song"});
R("yamen-1279","Battle of Yamen","naval-battle",1279,null,EA,["Yuan dynasty","Southern Song"],"Last Song resistance destroyed.",{ll:[22.2,113.0],parent:"mongol-conquest-song"});
R("mongol-conquest-baghdad","Mongol conquest of the Abbasid Caliphate","conquest",1258,null,ME,["Ilkhanate","Abbasid Caliphate"],"Hulagu Khan's capture of Baghdad.",{parent:"mongol-conquests",ll:[33.31,44.37]});
R("baghdad-1258","Siege of Baghdad (1258)","siege",1258,null,ME,["Ilkhanate","Abbasid Caliphate"],"Hulagu Khan sacked Baghdad and ended the Abbasid Caliphate there.",{ll:[33.31,44.37],parent:"mongol-conquest-baghdad"});
R("ain-jalut-1260","Battle of Ain Jalut","battle",1260,null,ME,["Mamluk Sultanate","Ilkhanate"],"Mamluks stopped the Mongol advance.",{ll:[32.55,35.35],parent:"mamluk-ilkhanid-war"});
R("mamluk-ilkhanid-war","Mamluk-Ilkhanid War","war",1260,1323,ME,["Mamluk Sultanate","Ilkhanate"],"Fights over Syria.",{});
R("mongol-invasions-japan","Mongol invasions of Japan","war",1274,1281,EA,["Yuan dynasty","Kamakura Shogunate"],"Two failed Yuan invasions.",{parent:"mongol-conquests"});
R("bunnei-1274","First Mongol invasion of Japan (Bun'ei)","campaign",1274,null,EA,["Yuan dynasty","Japan"],"Landing at Hakata Bay.",{ll:[33.6,130.4],parent:"mongol-invasions-japan"});
R("koan-1281","Second Mongol invasion of Japan (Koan)","campaign",1281,null,EA,["Yuan dynasty","Japan"],"Typhoon destroyed much of the fleet.",{ll:[33.6,130.3],parent:"mongol-invasions-japan"});
R("mongol-invasions-vietnam","Mongol invasions of Vietnam","war",1258,1288,SEA,["Mongol Empire","Yuan dynasty","Dai Viet","Champa"],"Three Mongol invasions of Dai Viet.",{parent:"mongol-conquests",sides:[["Yuan dynasty"],["Dai Viet","Champa"]],out:"Vietnamese victory"});
R("bach-dang-1288","Battle of Bach Dang (1288)","naval-battle",1288,null,SEA,["Dai Viet","Yuan dynasty"],"Tran Hung Dao destroyed the Yuan fleet.",{ll:[20.9,106.8],parent:"mongol-invasions-vietnam"});
R("mongol-invasions-burma","Mongol invasions of Burma","war",1277,1287,SEA,["Yuan dynasty","Pagan Kingdom"],"Yuan campaigns that destroyed the Pagan kingdom.",{parent:"mongol-conquests"});
R("mongol-invasion-java","Mongol invasion of Java","campaign",1293,null,SEA,["Yuan dynasty","Singhasari","Majapahit"],"Failed Yuan expedition; Majapahit founded.",{parent:"mongol-conquests"});
R("goryeo-mongol-war","Mongol invasions of Korea","war",1231,1259,EA,["Mongol Empire","Goryeo"],"Six major Mongol invasions of Goryeo.",{parent:"mongol-conquests"});
R("kulikovo-1380","Battle of Kulikovo","battle",1380,null,EE,["Muscovy","Golden Horde"],"Dmitry Donskoy defeated Mamai.",{ll:[53.65,38.65]});
R("timurid-conquests","Timur's conquests","conquest",1370,1405,CA,["Timurid Empire"],"Timur's wars across Central Asia, Persia, India and Anatolia.",{theme:"imperial expansion"});
R("timur-delhi-1398","Sack of Delhi (1398)","siege",1398,null,SA,["Timurid Empire","Delhi Sultanate"],"Timur sacked Delhi.",{ll:[28.65,77.23],parent:"timurid-conquests"});
R("ankara-1402","Battle of Ankara","battle",1402,null,AN,["Timurid Empire","Ottoman Empire"],"Timur captured Bayezid I.",{ll:[39.93,32.86],parent:"timurid-conquests"});
R("tokhtamysh-timur","Tokhtamysh-Timur war","war",1386,1395,CA,["Timurid Empire","Golden Horde"],"Timur broke the Golden Horde.",{parent:"timurid-conquests"});

// ---------- China ----------
R("an-lushan","An Lushan Rebellion","civil-war",755,763,EA,["Tang dynasty","An Lushan"],"Devastating revolt that weakened the Tang.",{theme:"dynastic"});
R("huang-chao","Huang Chao rebellion","revolt",874,884,EA,["Tang dynasty","Huang Chao"],"Salt-smuggler uprising that sacked Chang'an.",{theme:"civil"});
R("tang-tibet-wars","Tang-Tibetan wars","war",634,866,EA,["Tang dynasty","Tibetan Empire"],"Contest for the Tarim Basin.",{approx:true,conf:"medium"});
R("five-dynasties-wars","Wars of the Five Dynasties and Ten Kingdoms","war",907,979,EA,["Five Dynasties","Ten Kingdoms"],"Period of fragmentation.",{theme:"dynastic"});
R("song-reunification","Song reunification wars","conquest",960,979,EA,["Song dynasty","Ten Kingdoms"],"Song conquered most of the Ten Kingdoms.",{});
R("song-liao-wars","Song-Liao wars","war",986,1005,EA,["Song dynasty","Liao dynasty"],"Wars ended by Chanyuan.",{});
R("treaty-chanyuan","Treaty of Chanyuan","treaty",1005,null,EA,["Song dynasty","Liao dynasty"],"Annual tribute treaty with Liao.",{links:[["ended_by_of","song-liao-wars"]]});
R("jurchen-liao","Jurchen overthrow of the Liao","war",1114,1125,EA,["Jin dynasty","Liao dynasty"],"Jurchen conquered the Liao.",{});
R("jin-song-wars","Jin-Song wars","war",1125,1141,EA,["Jin dynasty","Song dynasty"],"Jurchen invasion of Song.",{});
R("jingkang-1127","Jingkang incident","siege",1126,1127,EA,["Jin dynasty","Northern Song"],"Fall of Kaifeng and capture of two emperors.",{ll:[34.8,114.3],parent:"jin-song-wars"});
R("treaty-shaoxing","Treaty of Shaoxing","treaty",1141,null,EA,["Jin dynasty","Southern Song"],"Border treaty ending the first Jin-Song wars.",{links:[["ended_by_of","jin-song-wars"]]});
R("xi-xia-wars","Song-Western Xia wars","war",1038,1044,EA,["Song dynasty","Western Xia"],"Frontier wars.",{});
R("red-turban","Red Turban Rebellion","revolt",1351,1368,EA,["Yuan dynasty","Red Turbans"],"Revolt that ended Mongol rule in China.",{theme:"dynastic"});
R("poyang-lake-1363","Battle of Lake Poyang","naval-battle",1363,null,EA,["Zhu Yuanzhang","Chen Youliang"],"Zhu Yuanzhang's fleet won.",{ll:[29.0,116.3],parent:"red-turban"});
R("ming-founding-wars","Ming conquest of the Yuan","conquest",1368,1388,EA,["Ming dynasty","Yuan dynasty"],"Ming expulsion of the Mongols.",{});
R("jingnan","Jingnan campaign","civil-war",1399,1402,EA,["Ming dynasty"],"Prince of Yan took the throne from Jianwen.",{theme:"dynastic"});
R("tumu-1449","Tumu crisis","battle",1449,null,EA,["Ming dynasty","Oirat Mongols"],"Esen captured the Zhengtong Emperor.",{ll:[40.3,115.7]});
R("ming-vietnam","Ming-Ho War and Ming occupation of Dai Viet","war",1406,1427,SEA,["Ming dynasty","Dai Viet"],"Ming occupation ended by Le Loi.",{theme:"independence"});
R("lam-son","Lam Son uprising","revolt",1418,1427,SEA,["Le Loi","Ming dynasty"],"Vietnamese independence.",{parent:"ming-vietnam",theme:"independence"});

// ---------- Japan ----------
R("hogen-1156","Hogen rebellion","civil-war",1156,null,EA,["Japan"],"Succession conflict in Kyoto.",{theme:"dynastic"});
R("heiji-1160","Heiji rebellion","civil-war",1160,null,EA,["Taira","Minamoto"],"Taira no Kiyomori defeated the Minamoto.",{});
R("genpei-war","Genpei War","civil-war",1180,1185,EA,["Taira","Minamoto"],"Wars between Taira and Minamoto.",{theme:"dynastic",out:"Kamakura shogunate"});
R("ichinotani-1184","Battle of Ichi-no-Tani","battle",1184,null,EA,["Minamoto","Taira"],"Yoshitsune's attack.",{ll:[34.67,135.15],parent:"genpei-war"});
R("yashima-1185","Battle of Yashima","battle",1185,null,EA,["Minamoto","Taira"],"Yashima.",{ll:[34.36,134.1],parent:"genpei-war"});
R("dannoura-1185","Battle of Dan-no-ura","naval-battle",1185,null,EA,["Minamoto","Taira"],"Final defeat of the Taira.",{ll:[33.96,130.93],parent:"genpei-war"});
R("jokyu-1221","Jokyu War","war",1221,null,EA,["Kamakura Shogunate","Retired Emperor Go-Toba"],"Failed imperial attempt to overthrow the shogunate.",{});
R("genko-war","Genko War","civil-war",1331,1333,EA,["Kamakura Shogunate","Go-Daigo"],"Fall of the Kamakura shogunate.",{});
R("nanboku-cho","Nanboku-cho wars","civil-war",1336,1392,EA,["Northern Court","Southern Court"],"Rival imperial courts.",{theme:"dynastic"});
R("onin-war","Onin War","civil-war",1467,1477,EA,["Hosokawa","Yamana"],"Triggered the Sengoku period.",{});

// ---------- Korea, SE Asia ----------
R("goryeo-khitan-war","Goryeo-Khitan War","war",993,1019,EA,["Goryeo","Liao dynasty"],"Khitan invasions repelled.",{});
R("kuju-1019","Battle of Kuju","battle",1019,null,EA,["Goryeo","Liao dynasty"],"Gang Gamchan's victory.",{ll:[39.9,125.6],parent:"goryeo-khitan-war"});
R("ly-song-war","Ly-Song War","war",1075,1077,SEA,["Dai Viet","Song dynasty"],"Ly Thuong Kiet's pre-emptive attack; Song invasion repelled.",{});
R("cham-sack-angkor","Cham sack of Angkor","siege",1177,null,SEA,["Champa","Khmer Empire"],"Cham fleet sacked Yasodharapura.",{ll:[13.44,103.86]});
R("khmer-cham-war","Khmer-Cham wars","war",1177,1220,SEA,["Khmer Empire","Champa"],"Jayavarman VII defeated Champa and invaded Cham lands.",{approx:true,conf:"medium"});
R("ayutthaya-angkor-1431","Siege of Angkor (1431)","siege",1431,null,SEA,["Ayutthaya","Khmer Empire"],"Ayutthaya captured Angkor.",{ll:[13.44,103.86],approx:true,conf:"medium"});
R("dai-viet-champa-1471","Dai Viet conquest of Vijaya","war",1471,null,SEA,["Dai Viet","Champa"],"Le Thanh Tong destroyed Cham capital Vijaya.",{ll:[13.9,109.1]});
R("chola-srivijaya","Chola invasion of Srivijaya","war",1025,null,SEA,["Chola Empire","Srivijaya"],"Rajendra Chola's naval expedition.",{ll:[2.9,101.0],approx:true,conf:"medium"});

// ---------- India and Sri Lanka ----------
R("ghaznavid-india","Ghaznavid raids on India","campaign",1000,1027,SA,["Ghaznavids","Hindu Shahis","Rajput kingdoms"],"Mahmud of Ghazni's raids.",{approx:true});
R("somnath-1025","Sack of Somnath","siege",1025,null,SA,["Ghaznavids","Chaulukya"],"Mahmud of Ghazni sacked Somnath.",{ll:[20.89,70.4],parent:"ghaznavid-india"});
R("tarain-1191","First Battle of Tarain","battle",1191,null,SA,["Chahamana","Ghurids"],"Prithviraj Chauhan defeated Muhammad of Ghor.",{ll:[29.8,76.9],parent:"ghurid-conquest-india"});
R("tarain-1192","Second Battle of Tarain","battle",1192,null,SA,["Ghurids","Chahamana"],"Muhammad of Ghor's victory.",{ll:[29.8,76.9],parent:"ghurid-conquest-india"});
R("ghurid-conquest-india","Ghurid conquest of northern India","conquest",1175,1206,SA,["Ghurids","Rajput kingdoms"],"Foundation of the Delhi Sultanate.",{});
R("chola-sri-lanka","Chola conquest of Sri Lanka","conquest",993,1014,SA,["Chola Empire","Anuradhapura"],"Rajaraja I and Rajendra I.",{approx:true,conf:"medium"});
R("khalji-deccan","Delhi Sultanate invasions of the Deccan","campaign",1296,1311,SA,["Delhi Sultanate","Yadavas","Hoysalas"],"Alauddin Khalji and Malik Kafur's campaigns south.",{});
R("vijayanagara-bahmani","Vijayanagara-Bahmani wars","war",1347,1500,SA,["Vijayanagara Empire","Bahmani Sultanate"],"Continuing conflict over the Raichur Doab.",{approx:true,conf:"medium"});
R("mongol-delhi","Mongol invasions of India","war",1221,1327,SA,["Mongol Empire","Delhi Sultanate"],"Repeated raids.",{approx:true});

// ---------- Anatolia/Middle East ----------
R("dandanqan-1040","Battle of Dandanaqan","battle",1040,null,CA,["Seljuks","Ghaznavids"],"Seljuk victory.",{ll:[37.5,62.0]});
R("zengid-nur-ad-din","Zengid campaigns against the crusader states","campaign",1128,1174,ME,["Zengids","Crusader states"],"Zengi, Nur ad-Din.",{approx:true,parent:"crusades"});
R("fall-edessa-1144","Siege of Edessa (1144)","siege",1144,null,AN,["Zengids","County of Edessa"],"Zengi captured Edessa.",{ll:[37.16,38.79],parent:"crusades"});
R("mamluk-conquest-acre","Mamluk-Crusader wars","war",1250,1291,ME,["Mamluks","Crusader states"],"Baibars and Qalawun.",{parent:"crusades"});
R("assassins","Ismaili strongholds campaign (Alamut)","campaign",1256,null,ME,["Ilkhanate","Nizari Ismailis"],"Mongol destruction of Alamut.",{ll:[36.44,50.58]});

// ---------- Africa ----------
R("almoravid-ghana","Almoravid conquest of Ghana","war",1076,null,SSA,["Almoravids","Ghana Empire"],"Almoravids took Koumbi Saleh (traditional date).",{approx:true,conf:"low"});
R("kirina-1235","Battle of Kirina","battle",1235,null,SSA,["Mali","Sosso"],"Sundiata defeated Sumanguru, founding Mali.",{ll:[12.0,-8.3],approx:true,conf:"low"});
R("sonni-ali","Conquests of Sonni Ali","conquest",1464,1492,SSA,["Songhai Empire","Mali","Mossi"],"Songhai expansion.",{approx:false});
R("timbuktu-1468","Capture of Timbuktu by Sonni Ali","siege",1468,null,SSA,["Songhai Empire","Timbuktu"],"Sonni Ali took Timbuktu.",{ll:[16.77,-3.0],approx:true,parent:"sonni-ali"});
R("almohad-conquest","Almohad conquests","conquest",1121,1172,NAF,["Almohads","Almoravids"],"Almohad conquest of the Maghreb and Al-Andalus.",{approx:true});
R("ethiopian-adal-1","Ethiopian-Adal wars (first phase)","war",1415,1520,SSA,["Ethiopian Empire","Adal Sultanate"],"Early conflict.",{approx:true,conf:"medium"});
R("kilwa-sack","Portuguese capture of Kilwa","siege",1505,null,SSA,["Portugal","Kilwa Sultanate"],"Portuguese captured Kilwa.",{ll:[-8.96,39.5]});
R("zagwe-solomonic","Fall of the Zagwe dynasty","civil-war",1270,null,SSA,["Zagwe","Solomonic"],"Yekuno Amlak overthrew the Zagwe.",{approx:true,theme:"dynastic",conf:"medium"});

// ---------- Americas ----------
R("tepanec-war","Tepanec War","war",1426,1428,MES,["Mexica","Tepanecs","Triple Alliance"],"Tenochtitlan, Texcoco, Tlacopan overthrew Azcapotzalco.",{approx:true,conf:"medium"});
R("chanka-war","Inca-Chanka war","war",1438,null,SAM,["Inca","Chanka"],"Pachacuti defeated the Chanka, traditional start of Inca expansion.",{approx:true,conf:"low",ll:[-13.5,-72.0]});
R("inca-expansion","Inca expansion under Pachacuti and Topa Inca","conquest",1438,1493,SAM,["Inca"],"Rise of Tawantinsuyu.",{approx:true,conf:"medium",theme:"imperial expansion"});
R("aztec-triple-alliance-conquests","Aztec Triple Alliance expansion","conquest",1428,1519,MES,["Aztec Empire","Mesoamerican states"],"Expansion of the Aztec Empire.",{approx:true,theme:"imperial expansion"});
R("flower-wars","Flower wars","war",1450,1519,MES,["Aztec Empire","Tlaxcala","Huexotzinco"],"Ritual wars to take captives.",{approx:true,conf:"low"});

// ---------- Oceania ----------

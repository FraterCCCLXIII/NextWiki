// Curated ancient rows outside the Greco-Roman world: China, Korea, Central Asia, India, Africa, Americas.
import { makeR, WE, EE, MED, ME, AN, CA, SA, EA, SEA, OC, SSA, NAF, NAM, MES, SAM, GL } from "./lib.mjs";
export const rows = [];
const R = makeR(rows);

// ---------- China ----------
R("spring-autumn-wars","Spring and Autumn period wars","war",-770,-476,EA,["Zhou states","Jin","Chu","Qi","Qin"],"Ongoing interstate warfare among Zhou feudal states under nominal Zhou kings and hegemons.",{approx:true,theme:"dynastic"});
R("chengpu-632","Battle of Chengpu","battle",-632,null,EA,["Jin","Chu"],"Duke Wen of Jin defeated Chu, establishing Jin hegemony.",{ll:[35.0,115.2],parent:"spring-autumn-wars"});
R("bi-597","Battle of Bi","battle",-597,null,EA,["Chu","Jin"],"King Zhuang of Chu defeated Jin at Bi, and became hegemon.",{ll:[34.9,113.7],parent:"spring-autumn-wars"});
R("yanling-575","Battle of Yanling","battle",-575,null,EA,["Jin","Chu"],"Jin defeated Chu at Yanling.",{ll:[34.1,114.2],parent:"spring-autumn-wars"});
R("wu-yue-war","Wu-Yue wars","war",-510,-473,EA,["Wu","Yue"],"Conflicts between Wu and Yue ended with Yue's conquest of Wu.",{approx:true});
R("boju-506","Battle of Boju","battle",-506,null,EA,["Wu","Chu"],"Wu under Sun Wu and Wu Zixu defeated Chu and occupied Ying.",{ll:[31.1,115.2],parent:"spring-autumn-wars",alias:["Battle of Boju"]});
R("warring-states-wars","Warring States period wars","war",-475,-221,EA,["Qin","Zhao","Wei","Han","Qi","Yan","Chu"],"Two and a half centuries of wars among seven major states ending with Qin's unification.",{approx:true});
R("partition-of-jin","Partition of Jin","civil-war",-453,-403,EA,["Han","Zhao","Wei","Jin"],"The three families Han, Zhao and Wei divided the state of Jin.",{approx:true,theme:"dynastic",parent:"warring-states-wars"});
R("guiling-353","Battle of Guiling","battle",-353,null,EA,["Qi","Wei","Zhao"],"Sun Bin led Qi to relieve Handan, defeating Wei.",{ll:[35.0,114.8],parent:"warring-states-wars"});
R("maling-341","Battle of Maling","battle",-341,null,EA,["Qi","Wei"],"Sun Bin ambushed and destroyed the Wei army.",{ll:[36.2,115.1],parent:"warring-states-wars"});
R("yique-293","Battle of Yique","battle",-293,null,EA,["Qin","Wei","Han"],"Bai Qi reportedly killed 240,000 Han-Wei troops; the figure is from Sima Qian.",{ll:[34.5,112.4],parent:"warring-states-wars"});
R("changping-260","Battle of Changping","battle",-260,null,EA,["Qin","Zhao"],"Qin crushed Zhao in the largest Warring States battle.",{ll:[35.9,112.9],parent:"warring-states-wars",sides:[["Qin"],["Zhao"]]});
R("qin-unification-wars","Qin unification of China","conquest",-230,-221,EA,["Qin","Han","Zhao","Wei","Chu","Yan","Qi"],"Qin conquered the six rival states one after another.",{theme:"imperial expansion",parent:"warring-states-wars",out:"Qin dynasty founded"});
R("chen-sheng-wu-guang-uprising","Dazexiang uprising","revolt",-209,-208,EA,["Qin dynasty","Chen Sheng and Wu Guang"],"Peasant rebellion that started the collapse of Qin.",{ll:[33.5,116.9],theme:"civil"});
R("chu-han-contention","Chu-Han Contention","civil-war",-206,-202,EA,["Chu","Han"],"War between Xiang Yu and Liu Bang after the fall of Qin.",{theme:"dynastic",out:"Liu Bang founds the Han dynasty"});
R("julu-207","Battle of Julu","battle",-207,null,EA,["Chu","Qin"],"Xiang Yu destroyed the main Qin army.",{ll:[37.2,115.0],parent:"chu-han-contention",approx:false});
R("gaixia-202","Battle of Gaixia","battle",-202,null,EA,["Han","Chu"],"Liu Bang defeated Xiang Yu, who died shortly after.",{ll:[33.3,117.9],parent:"chu-han-contention"});
R("xiongnu-han-war","Han-Xiongnu War","war",-133,89,EA,["Han","Xiongnu"],"Long conflict between Han China and the Xiongnu confederation.",{sides:[["Han dynasty"],["Xiongnu"]]});
R("mayi-133","Battle of Mayi","battle",-133,null,EA,["Han","Xiongnu"],"Failed Han ambush that started the war.",{ll:[39.6,112.4],parent:"xiongnu-han-war"});
R("mobei-119","Battle of Mobei","battle",-119,null,EA,["Han","Xiongnu"],"Wei Qing and Huo Qubing's deep campaign into Mongolia.",{ll:[47.0,104.0],parent:"xiongnu-han-war"});
R("revolt-seven-states","Rebellion of the Seven States","civil-war",-154,null,EA,["Han","Wu","Chu","Zhao"],"Revolt of seven kings against Emperor Jing.",{theme:"dynastic"});
R("han-conquest-nanyue","Han conquest of Nanyue","conquest",-111,null,SEA,["Han","Nanyue"],"Han annexed Nanyue in modern Guangdong and northern Vietnam.",{theme:"imperial expansion"});
R("war-heavenly-horses","War of the Heavenly Horses","war",-104,-101,CA,["Han","Dayuan"],"Han expedition to Ferghana.",{});
R("wang-mang-war","Lülin and Red Eyebrows rebellions","revolt",17,27,EA,["Xin dynasty","Han rebels"],"Rebellions toppling Wang Mang.",{theme:"civil",approx:true});
R("trung-sisters-revolt","Trung Sisters' rebellion","revolt",40,43,SEA,["Han","Giao Chi"],"Revolt against Han rule in Vietnam, crushed by Ma Yuan.",{theme:"independence",ll:[21.2,105.7]});
R("yellow-turban-rebellion","Yellow Turban Rebellion","revolt",184,205,EA,["Han","Yellow Turbans"],"Daoist-inspired peasant rebellion that weakened Han authority.",{theme:"religious"});
R("three-kingdoms-wars","Wars of the Three Kingdoms","war",184,280,EA,["Wei","Shu","Wu","Han"],"Collapse of Han and wars among Wei, Shu and Wu until Jin reunified China.",{theme:"dynastic",approx:false});
R("guandu-200","Battle of Guandu","battle",200,null,EA,["Cao Cao","Yuan Shao"],"Cao Cao defeated Yuan Shao, securing northern China.",{ll:[34.7,114.0],parent:"three-kingdoms-wars"});
R("red-cliffs-208","Battle of Red Cliffs","battle",208,null,EA,["Sun Quan","Liu Bei","Cao Cao"],"Allied fireships routed Cao Cao's fleet on the Yangtze.",{ll:[29.8,113.7],parent:"three-kingdoms-wars",sides:[["Sun Quan","Liu Bei"],["Cao Cao"]]});
R("yiling-222","Battle of Yiling","battle",222,null,EA,["Shu","Wu"],"Wu's Lu Xun burned Liu Bei's camps.",{ll:[30.7,111.3],parent:"three-kingdoms-wars"});
R("northern-expeditions","Zhuge Liang's Northern Expeditions","campaign",228,234,EA,["Shu","Wei"],"Five campaigns by Shu against Wei, ending with Zhuge Liang's death at Wuzhang Plains.",{parent:"three-kingdoms-wars"});
R("jin-conquest-wu","Jin conquest of Wu","conquest",279,280,EA,["Jin","Wu"],"Western Jin conquered Eastern Wu and reunified China.",{parent:"three-kingdoms-wars"});
R("eight-princes","War of the Eight Princes","civil-war",291,306,EA,["Western Jin"],"Succession struggle among Jin princes.",{theme:"dynastic"});
R("disaster-yongjia","Disaster of Yongjia","war",311,316,EA,["Western Jin","Han-Zhao"],"Xiongnu-led Han-Zhao captured Luoyang and Chang'an.",{});
R("sixteen-kingdoms-wars","Wars of the Sixteen Kingdoms","war",304,439,EA,["Jin","Sixteen Kingdoms"],"Fragmentation of northern China.",{});
R("northern-wei-unification","Northern Wei unification of the north","conquest",386,439,EA,["Northern Wei"],"Tuoba Wei united northern China.",{});
R("hou-jing-rebellion","Rebellion of Hou Jing","revolt",548,552,EA,["Liang dynasty"],"Devastating revolt against Liang.",{});
R("sui-conquest-chen","Sui conquest of Chen","conquest",589,null,EA,["Sui","Chen"],"Sui reunified China.",{});
R("sui-goguryeo-wars","Goguryeo-Sui War","war",598,614,EA,["Sui","Goguryeo"],"Failed Sui invasions of Goguryeo.",{});
R("salsu-612","Battle of Salsu","battle",612,null,EA,["Goguryeo","Sui"],"Eulji Mundeok destroyed an invading Sui army at the Salsu river.",{ll:[39.5,125.0],parent:"sui-goguryeo-wars"});

// ---------- Korea and Japan ----------
R("han-gojoseon","Han conquest of Gojoseon","conquest",-109,-108,EA,["Han","Gojoseon"],"Emperor Wu conquered Wiman Joseon and set up four commanderies.",{theme:"imperial expansion"});
R("silla-baekje-wars","Silla-Baekje wars","war",554,660,EA,["Silla","Baekje"],"Wars between Silla and Baekje.",{approx:true,conf:"medium"});
R("silla-tang-allied-war","Silla-Tang campaigns against Baekje and Goguryeo","war",660,668,EA,["Silla","Tang","Baekje","Goguryeo"],"Allied conquest of Baekje and Goguryeo.",{sides:[["Silla","Tang"],["Baekje","Goguryeo"]]});
R("hwangsanbeol-660","Battle of Hwangsanbeol","battle",660,null,EA,["Silla","Baekje"],"Kim Yushin defeated General Gyebaek.",{ll:[36.2,127.0],parent:"silla-tang-allied-war"});
R("baekgang-663","Battle of Baekgang","naval-battle",663,null,EA,["Tang","Silla","Yamato Japan","Baekje"],"Tang-Silla fleet crushed the Japanese-Baekje fleet.",{ll:[36.0,126.7],parent:"silla-tang-allied-war"});
R("silla-tang-war","Silla-Tang War","war",670,676,EA,["Silla","Tang"],"Silla expelled Tang from the peninsula.",{});
R("jinshin-672","Jinshin War","civil-war",672,null,EA,["Japan"],"Succession war between Prince Otomo and Prince Oama (later Emperor Tenmu).",{theme:"dynastic"});
R("emishi-wars","Heian-Emishi wars","war",774,811,EA,["Yamato Japan","Emishi"],"Imperial campaigns against the Emishi.",{});
R("later-three-kingdoms","Later Three Kingdoms of Korea","war",892,936,EA,["Silla","Later Baekje","Taebong"],"Wars ending with Goryeo unification.",{});

// ---------- Central Asia ----------
R("battle-of-talas","Battle of Talas","battle",751,null,CA,["Tang","Abbasid Caliphate"],"An Abbasid army defeated Tang forces near the Talas river.",{ll:[42.52,72.23],parent:"abbasid-tang-contest"});
R("abbasid-tang-contest","Abbasid-Tang contest for Transoxiana","war",715,751,CA,["Tang","Umayyad Caliphate","Abbasid Caliphate"],"Contest for Central Asian control.",{approx:true,conf:"medium"});
R("kushan-sassanid-wars","Kushan-Sasanian wars","war",225,350,CA,["Kushan","Sasanian Empire"],"Sasanian conquests in Bactria.",{approx:true,conf:"low"});
R("hephthalite-wars","Hephthalite wars","war",420,560,CA,["Hephthalites","Sasanian Empire","Gupta Empire"],"Persian and Gupta wars with the Hephthalites.",{approx:true,conf:"medium"});
R("hephthalite-gupta","Gupta-Huna wars","war",450,528,SA,["Gupta Empire","Hephthalites"],"Skandagupta and later rulers fought Huna invaders.",{approx:true});

// ---------- India ----------
R("nanda-conquest","Mauryan conquest of Magadha","conquest",-322,-321,SA,["Maurya","Nanda Empire"],"Chandragupta Maurya overthrew the Nanda dynasty.",{approx:true,conf:"medium"});
R("mauryan-expansion","Mauryan expansion","conquest",-322,-261,SA,["Maurya"],"Chandragupta and Bindusara unified much of the subcontinent.",{approx:true,conf:"medium",theme:"imperial expansion"});
R("samudragupta","Conquests of Samudragupta","campaign",335,375,SA,["Gupta Empire"],"Gupta expansion in northern and southern India.",{approx:true,conf:"medium",theme:"imperial expansion"});

// ---------- Africa ----------
R("aksum-kush","Aksumite conquest of Kush","conquest",350,null,SSA,["Aksum","Kush"],"Ezana of Aksum invaded Meroe, according to Ezana's stele.",{approx:true,conf:"low"});
R("roman-nubian-war","Kushite-Roman war","war",-25,-22,NAF,["Rome","Kush"],"Kandake Amanirenas attacked Roman Egypt; Rome counterattacked, peace at Samos.",{approx:false});
R("battle-of-thapsus","Battle of Thapsus","battle",-46,null,NAF,["Caesar","Optimates"],"Caesar defeated Scipio and Juba I.",{ll:[35.6,11.0],parent:"caesars-civil-war"});
R("vandalic-conquest-africa","Vandal conquest of Roman Africa","conquest",429,439,NAF,["Vandals","Western Roman Empire"],"Vandals took Carthage in 439.",{});

// ---------- Americas ----------
R("tikal-uaxactun","Tikal conquest of Uaxactun","conquest",378,null,MES,["Teotihuacan","Tikal","Uaxactun"],"Entrada of Sihyaj K'ahk' in 378 CE linked to Teotihuacan; Tikal dominates the region.",{approx:true,conf:"medium"});

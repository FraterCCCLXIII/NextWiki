// Emperors and kings of China from the traditional Xia and Shang through the Qing. Early rulers are legendary or traditionally dated.
import { makeShard, EA } from "./curated/lib.mjs";
const S = makeShard("east-asia-china"); const { H, R } = S;
const ch = (id, name, realm, st, en, sum, o = {}) => H(id, name, realm, "Chinese civilization", EA, st, en, sum, o);
ch("xia", "Xia dynasty", "Xia", -2070, -1600, "Traditional first Chinese dynasty, known from later texts; archaeological identification is debated.", { c: "l", ap: true });
ch("shang", "Shang dynasty", "Shang", -1600, -1046, "Bronze Age dynasty with oracle-bone inscriptions, centred at Anyang in its late phase.", { cap: "Anyang", ll: [36.1, 114.3], c: "m" });
ch("zhou", "Zhou dynasty", "Zhou", -1046, -256, "Longest Chinese dynasty, split into Western Zhou and Eastern Zhou (Spring and Autumn, Warring States).", { cap: "Haojing / Luoyi", c: "h" });
ch("qin", "House of Ying (Qin)", "Qin", -221, -206, "Dynasty of the first unified Chinese empire.", { cap: "Xianyang", ll: [34.33, 108.7], c: "h", ap: false });
ch("han-w", "Western Han dynasty (House of Liu)", "Han", -202, 9, "Imperial dynasty founded by Liu Bang with its capital at Chang'an.", { cap: "Chang'an", ll: [34.27, 108.95], c: "h", ap: false });
ch("xin", "Xin dynasty", "Xin", 9, 23, "Short-lived dynasty of the usurper Wang Mang.", { cap: "Chang'an", c: "h" });
ch("han-e", "Eastern Han dynasty (House of Liu)", "Han", 25, 220, "Restoration of the Han under Emperor Guangwu with the capital at Luoyang.", { cap: "Luoyang", ll: [34.62, 112.45], parent: "han-w", c: "h" });
ch("cao-wei", "Cao Wei", "Wei", 220, 266, "Northern state of the Three Kingdoms founded by Cao Pi.", { cap: "Luoyang", c: "h" });
ch("shu-han", "Shu Han", "Shu Han", 221, 263, "Three Kingdoms state in Sichuan founded by Liu Bei.", { cap: "Chengdu", c: "h" });
ch("wu-sun", "Eastern Wu (House of Sun)", "Wu", 229, 280, "Southern Three Kingdoms state founded by Sun Quan.", { cap: "Jianye", c: "h" });
ch("jin-sima", "Jin dynasty (House of Sima)", "Jin", 266, 420, "Dynasty of the Sima family, divided into Western Jin and Eastern Jin.", { cap: "Luoyang / Jiankang", c: "h" });
ch("n-wei", "Northern Wei (House of Tuoba)", "Northern Wei", 386, 535, "Xianbei dynasty that unified northern China and promoted sinicisation.", { cap: "Pingcheng / Luoyang", c: "h" });
ch("sui", "Sui dynasty (House of Yang)", "Sui", 581, 618, "Dynasty that reunified China and built the Grand Canal.", { cap: "Chang'an", c: "h" });
ch("tang", "Tang dynasty (House of Li)", "Tang", 618, 907, "Imperial dynasty regarded as a golden age of Chinese culture, interrupted by the Wu Zhou interregnum.", { cap: "Chang'an", ll: [34.27, 108.95], c: "h" });
ch("song", "Song dynasty (House of Zhao)", "Song", 960, 1279, "Dynasty split into Northern Song (Kaifeng) and Southern Song (Hangzhou).", { cap: "Kaifeng / Hangzhou", ll: [34.8, 114.3], c: "h" });
ch("liao", "Liao dynasty (House of Yelü)", "Liao", 907, 1125, "Khitan empire in northern China and Mongolia.", { cap: "Shangjing", c: "h" });
ch("jin-jurchen", "Jin dynasty (House of Wanyan)", "Jin (Jurchen)", 1115, 1234, "Jurchen dynasty that conquered the Liao and northern Song territory.", { cap: "Zhongdu", c: "h" });
ch("yuan", "Yuan dynasty (Borjigin)", "Yuan", 1271, 1368, "Mongol dynasty of Kublai Khan ruling China.", { cap: "Dadu", ll: [39.9, 116.4], c: "h" });
ch("ming", "Ming dynasty (House of Zhu)", "Ming", 1368, 1644, "Dynasty that expelled the Mongols and ruled China until the Li Zicheng rebellion.", { cap: "Nanjing / Beijing", ll: [39.9, 116.4], c: "h" });
ch("qing", "Qing dynasty (Aisin Gioro)", "Qing", 1636, 1912, "Manchu dynasty, last imperial dynasty of China.", { cap: "Beijing", ll: [39.9, 116.4], c: "h", ap: false });
ch("china-5d", "Five Dynasties founders", "Five Dynasties", 907, 960, "Short-lived northern dynasties between the Tang and the Song.", { c: "h" });
ch("china-south", "Southern dynasties founders", "Southern dynasties", 420, 589, "Dynasties based at Jiankang between the Jin and the Sui.", { c: "h" });
ch("xixia", "Western Xia (House of Li)", "Western Xia", 1038, 1227, "Tangut empire in the Gansu corridor.", { cap: "Xingqing", c: "m" });
// legendary and traditional
R("cn", "China", "xia", "king", [
  ["huangdi", "Yellow Emperor", -2697, -2597, { leg: true, s: "Legendary sovereign and cultural hero, traditional ancestor of the Han people.", alt: ["Huangdi"] }],
  ["yao", "Emperor Yao", -2356, -2255, { leg: true, s: "Legendary sage-king of the Five Emperors, said to have passed the throne to Shun on merit.", acc: "?" }],
  ["shun", "Emperor Shun", -2255, -2205, { leg: true, s: "Legendary sage-king chosen by Yao, who in turn chose Yu.", acc: "a" }],
  ["yu", "Yu the Great", -2070, -2030, { leg: true, s: "Legendary founder of the Xia dynasty, credited with taming the floods.", acc: "a" }],
  ["qi", "Qi of Xia", -2029, -1996, { leg: true, f: "yu", acc: "i", s: "Son of Yu, traditionally the first Chinese dynastic king to inherit the throne from his father." }],
  ["jie", "Jie of Xia", -1728, -1675, { leg: true, en: "c", s: "Traditional last Xia king, said to have been overthrown by Tang of Shang." }],
  ["tang", "Tang of Shang", -1675, -1646, { leg: true, h: "shang", acc: "c", s: "Traditional founder of the Shang dynasty who defeated Jie." }],
]);
R("cn-shang", "Shang", "shang", "king", [
  ["wuding", "Wu Ding", -1250, -1192, { f: "~Xiao Yi", c: "m", s: "Shang king whose reign is richly documented in oracle bone inscriptions." }],
  ["dixin", "Di Xin (King Zhou of Shang)", -1075, -1046, { f: "~Di Yi", c: "m", en: "c", s: "Last Shang king, traditionally portrayed as tyrannical and defeated by King Wu of Zhou at Muye." }],
]);
R("cn-zhou", "Zhou", "zhou", "king", [
  ["wu", "King Wu of Zhou", -1046, -1043, { f: "~King Wen of Zhou", acc: "c", c: "m", s: "Overthrew the Shang and founded the Zhou dynasty." }],
  ["cheng", "King Cheng of Zhou", -1042, -1021, { f: "wu", acc: "r", c: "m", s: "Child king for whom his uncle the Duke of Zhou acted as regent." }],
  ["kang", "King Kang of Zhou", -1020, -996, { f: "cheng", acc: "i", c: "m" }],
  ["zhao", "King Zhao of Zhou", -995, -977, { f: "kang", acc: "i", c: "m" }],
  ["mu", "King Mu of Zhou", -976, -922, { f: "zhao", acc: "i", c: "m" }],
  ["li", "King Li of Zhou", -877, -841, { c: "m", en: "p", s: "Exiled after popular revolt; followed by the Gonghe regency." }],
  ["xuan", "King Xuan of Zhou", -827, -782, { f: "li", acc: "i", c: "m" }],
  ["you", "King You of Zhou", -781, -771, { f: "xuan", acc: "i", c: "m", en: "d", s: "Last king of the Western Zhou, killed when the capital was sacked." }],
  ["ping", "King Ping of Zhou", -770, -720, { f: "you", acc: "i", c: "m", s: "Moved the capital east to Luoyi, beginning the Eastern Zhou." }],
  ["nan", "King Nan of Zhou", -314, -256, { c: "m", en: "c", s: "Last Zhou king, whose domain was absorbed by Qin." }],
]);
R("cn-qin", "Qin", "qin", "emperor", [
  ["shihuang", "Qin Shi Huang", -221, -210, { f: "~King Zhuangxiang of Qin", b: -259, d: -210, acc: "i", c: "h", ap: false, s: "King of Qin from 247 BCE who conquered the other states in 221 BCE and became the first emperor of China." }],
  ["ershi", "Qin Er Shi (Huhai)", -210, -207, { f: "shihuang", acc: "u", c: "h", ap: false, en: "d" }],
  ["ziying", "Ziying", -207, -207, { acc: "i", c: "m", ap: false, en: "c", s: "Last Qin ruler, surrendered to Liu Bang." }],
]);
R("cn-hanw", "Han", "han-w", "emperor", [
  ["gaozu", "Emperor Gaozu of Han (Liu Bang)", -202, -195, { acc: "c", c: "h", ap: false, f: "~Liu Taigong", s: "Founder of the Han dynasty, victorious in the Chu-Han contention over Xiang Yu." }],
  ["hui", "Emperor Hui of Han", -195, -188, { f: "gaozu", acc: "i", c: "h", ap: false }],
  ["lu", "Empress Dowager Lü", -188, -180, { t: "empress dowager (regent)", sp: ["gaozu"], acc: "r", rg: "hui", c: "h", ap: false, nolink: true, s: "Wife of Gaozu who dominated the court after Emperor Hui's death." }],
  ["wen", "Emperor Wen of Han", -180, -157, { f: "gaozu", acc: "e", c: "h", ap: false, after: "hui" }],
  ["jing", "Emperor Jing of Han", -157, -141, { f: "wen", acc: "i", c: "h", ap: false }],
  ["wu", "Emperor Wu of Han", -141, -87, { f: "jing", acc: "i", c: "h", ap: false, s: "Long-reigning emperor who expanded the empire and made Confucianism the state doctrine." }],
  ["zhao", "Emperor Zhao of Han", -87, -74, { f: "wu", acc: "i", c: "h", ap: false }],
  ["xuan", "Emperor Xuan of Han", -74, -49, { acc: "e", c: "h", ap: false, after: "zhao" }],
  ["yuan", "Emperor Yuan of Han", -49, -33, { f: "xuan", acc: "i", c: "h", ap: false }],
  ["cheng", "Emperor Cheng of Han", -33, -7, { f: "yuan", acc: "i", c: "h", ap: false }],
  ["ai", "Emperor Ai of Han", -7, -1, { acc: "i", c: "h", ap: false }],
  ["ping", "Emperor Ping of Han", -1, 6, { acc: "i", c: "h", ap: false, en: "d" }],
  ["ruzi", "Ruzi Ying", 6, 9, { acc: "r", c: "h", ap: false, en: "p", s: "Infant emperor under the regency of Wang Mang, who then took the throne himself." }],
]);
R("cn-xin", "Xin", "xin", "emperor", [["wangmang", "Wang Mang", 9, 23, { acc: "u", us: "@cn-hanw-ruzi", after: "@cn-hanw-ruzi", c: "h", ap: false, en: "d", s: "Han regent who proclaimed the Xin dynasty; killed during the Lülin uprising." }]]);
R("cn-hane", "Han", "han-e", "emperor", [
  ["guangwu", "Emperor Guangwu of Han", 25, 57, { after: "@cn-xin-wangmang", acc: "c", c: "h", ap: false, s: "Descendant of the Han imperial house who restored the dynasty after Wang Mang." }],
  ["ming", "Emperor Ming of Han", 57, 75, { f: "guangwu", acc: "i", c: "h", ap: false }],
  ["zhang", "Emperor Zhang of Han", 75, 88, { f: "ming", acc: "i", c: "h", ap: false }],
  ["he", "Emperor He of Han", 88, 105, { f: "zhang", acc: "i", c: "h", ap: false }],
  ["shang", "Emperor Shang of Han", 106, 106, { f: "he", acc: "i", c: "h", ap: false }],
  ["an", "Emperor An of Han", 106, 125, { acc: "i", c: "h", ap: false }],
  ["shun", "Emperor Shun of Han", 125, 144, { f: "an", acc: "i", c: "h", ap: false, en: "d" }],
  ["chong", "Emperor Chong of Han", 144, 145, { f: "shun", acc: "i", c: "h", ap: false }],
  ["zhi", "Emperor Zhi of Han", 145, 146, { acc: "i", c: "h", ap: false }],
  ["huan", "Emperor Huan of Han", 146, 168, { acc: "i", c: "h", ap: false }],
  ["ling", "Emperor Ling of Han", 168, 189, { acc: "i", c: "h", ap: false }],
  ["shao", "Emperor Shao of Han (Liu Bian)", 189, 189, { f: "ling", acc: "i", c: "h", ap: false, en: "p" }],
  ["xian", "Emperor Xian of Han", 189, 220, { f: "ling", acc: "a", c: "h", ap: false, en: "a", s: "Last Han emperor, a puppet of Dong Zhuo and Cao Cao who abdicated to Cao Pi." }],
]);
R("cn-wei", "Wei", "cao-wei", "emperor", [
  ["caopi", "Cao Pi (Emperor Wen of Wei)", 220, 226, { after: "@cn-hane-xian", f: "~Cao Cao", acc: "c", c: "h", ap: false, s: "Accepted the abdication of Emperor Xian and proclaimed the Wei dynasty." }],
  ["caorui", "Cao Rui (Emperor Ming of Wei)", 226, 239, { f: "caopi", acc: "i", c: "h", ap: false }],
  ["caofang", "Cao Fang", 239, 254, { acc: "i", c: "h", ap: false, en: "p" }],
  ["caomao", "Cao Mao", 254, 260, { acc: "a", c: "h", ap: false, en: "d" }],
  ["caohuan", "Cao Huan", 260, 266, { acc: "a", c: "h", ap: false, en: "a", s: "Last Wei emperor, who abdicated to Sima Yan." }],
]);
R("cn-shu", "Shu Han", "shu-han", "emperor", [
  ["liubei", "Liu Bei", 221, 223, { acc: "c", c: "h", ap: false, s: "Founder of Shu Han who claimed to continue the Han line." }],
  ["liushan", "Liu Shan", 223, 263, { f: "liubei", acc: "i", c: "h", ap: false, en: "c" }],
]);
R("cn-wu", "Wu", "wu-sun", "emperor", [
  ["sunquan", "Sun Quan", 229, 252, { c: "h", ap: false, acc: "c", s: "Founder of Eastern Wu, ruling from 222 as King of Wu and proclaiming himself emperor in 229." }],
  ["sunliang", "Sun Liang", 252, 258, { f: "sunquan", acc: "i", c: "h", ap: false, en: "p" }],
  ["sunxiu", "Sun Xiu", 258, 264, { f: "sunquan", acc: "u", c: "h", ap: false, sib: ["sunliang"] }],
  ["sunhao", "Sun Hao", 264, 280, { acc: "e", c: "h", ap: false, en: "c", s: "Last Wu ruler, who surrendered to Jin." }],
]);
R("cn-jin", "Jin", "jin-sima", "emperor", [
  ["wu", "Emperor Wu of Jin (Sima Yan)", 266, 290, { f: "~Sima Zhao", acc: "a", c: "h", ap: false, s: "Founder of the Jin dynasty who reunified China by conquering Wu in 280." }],
  ["hui", "Emperor Hui of Jin", 290, 307, { f: "wu", acc: "i", c: "h", ap: false }],
  ["huai", "Emperor Huai of Jin", 307, 311, { f: "wu", acc: "i", c: "h", ap: false, en: "c" }],
  ["min", "Emperor Min of Jin", 313, 316, { acc: "e", c: "h", ap: false, en: "c" }],
  ["yuan", "Emperor Yuan of Jin", 318, 323, { acc: "c", c: "h", ap: false, s: "Founder of the Eastern Jin dynasty at Jiankang." }],
  ["ming", "Emperor Ming of Jin", 323, 325, { f: "yuan", acc: "i", c: "h", ap: false }],
  ["cheng", "Emperor Cheng of Jin", 325, 342, { f: "ming", acc: "i", c: "h", ap: false }],
  ["kang", "Emperor Kang of Jin", 342, 344, { f: "ming", sib: ["cheng"], acc: "i", c: "h", ap: false }],
  ["mu", "Emperor Mu of Jin", 344, 361, { f: "kang", acc: "i", c: "h", ap: false }],
  ["ai", "Emperor Ai of Jin", 361, 365, { f: "cheng", acc: "i", c: "h", ap: false }],
  ["fei", "Emperor Fei of Jin", 365, 371, { f: "cheng", sib: ["ai"], acc: "i", c: "h", ap: false, en: "p" }],
  ["jianwen", "Emperor Jianwen of Jin", 371, 372, { f: "yuan", acc: "a", c: "h", ap: false }],
  ["xiaowu", "Emperor Xiaowu of Jin", 372, 396, { f: "jianwen", acc: "i", c: "h", ap: false }],
  ["an", "Emperor An of Jin", 396, 418, { f: "xiaowu", acc: "i", c: "h", ap: false }],
  ["gong", "Emperor Gong of Jin", 418, 420, { f: "xiaowu", sib: ["an"], acc: "i", c: "h", ap: false, en: "a" }],
]);
R("cn-nwei", "Northern Wei", "n-wei", "emperor", [
  ["daowu", "Emperor Daowu of Northern Wei", 386, 409, { c: "m", ap: false, s: "Founder of Northern Wei (Tuoba Gui), who took the imperial title in 398." }],
  ["taiwu", "Emperor Taiwu of Northern Wei", 423, 452, { c: "m", ap: false, after: "daowu", s: "Unified northern China; persecuted Buddhism from 446." }],
  ["xiaowen", "Emperor Xiaowen of Northern Wei", 471, 499, { c: "m", ap: false, s: "Moved the capital to Luoyang and promoted sinicisation." }],
]);
R("cn-south", "Southern dynasties", "china-south", "emperor", [
  ["liusong-wu", "Emperor Wu of Liu Song", 420, 422, { c: "h", ap: false, acc: "c" }],
  ["liang-wu", "Emperor Wu of Liang", 502, 549, { c: "h", ap: false, acc: "c", after: null, h: "china-south", s: "Founder of the Liang dynasty, a devout Buddhist patron who died during the Hou Jing rebellion." }],
  ["chen-wu", "Emperor Wu of Chen", 557, 559, { c: "h", ap: false, acc: "c", after: null }],
]);
R("cn-sui", "Sui", "sui", "emperor", [
  ["wen", "Emperor Wen of Sui", 581, 604, { acc: "u", c: "h", ap: false, s: "Founder of the Sui dynasty (Yang Jian), who reunified China in 589." }],
  ["yang", "Emperor Yang of Sui", 604, 618, { f: "wen", acc: "i", c: "h", ap: false, en: "d", s: "Completed the Grand Canal and launched failed Goguryeo campaigns; murdered in a coup." }],
  ["gong", "Emperor Gong of Sui (Yang You)", 617, 618, { acc: "a", c: "h", ap: false, nolink: true, after: "wen", en: "a" }],
]);
R("cn-tang", "Tang", "tang", "emperor", [
  ["gaozu", "Emperor Gaozu of Tang", 618, 626, { f: "~Li Hu", acc: "c", c: "h", ap: false, after: "@cn-sui-gong", s: "Founder of the Tang dynasty (Li Yuan)." }],
  ["taizong", "Emperor Taizong of Tang", 626, 649, { f: "gaozu", acc: "u", c: "h", ap: false, us: "gaozu", s: "Seized the throne after the Xuanwu Gate incident; consolidated Tang power." }],
  ["gaozong", "Emperor Gaozong of Tang", 649, 683, { f: "taizong", acc: "i", c: "h", ap: false, sp: ["wuzetian"] }],
  ["zhongzong", "Emperor Zhongzong of Tang", 684, 684, { f: "gaozong", m: "wuzetian", acc: "i", c: "h", ap: false, en: "p" }],
  ["ruizong", "Emperor Ruizong of Tang", 684, 690, { f: "gaozong", m: "wuzetian", acc: "i", c: "h", ap: false, en: "a" }],
  ["wuzetian", "Wu Zetian", 690, 705, { t: "empress regnant", h: "wu-zhou", sp: ["taizong", "gaozong"], acc: "u", us: "ruizong", c: "h", ap: false, en: "p", s: "The only woman to rule China as emperor in her own right, founding the Zhou interregnum." }],
  ["zhongzong2", "Emperor Zhongzong of Tang (second reign)", 705, 710, { f: "gaozong", m: "wuzetian", acc: "i", c: "h", ap: false, after: "wuzetian", en: "d" }],
  ["ruizong2", "Emperor Ruizong of Tang (second reign)", 710, 712, { f: "gaozong", m: "wuzetian", acc: "i", c: "h", ap: false, en: "a" }],
  ["xuanzong", "Emperor Xuanzong of Tang", 712, 756, { f: "ruizong2", acc: "i", c: "h", ap: false, en: "a", s: "Presided over the Tang peak and the An Lushan Rebellion." }],
  ["suzong", "Emperor Suzong of Tang", 756, 762, { f: "xuanzong", acc: "i", c: "h", ap: false }],
  ["daizong", "Emperor Daizong of Tang", 762, 779, { f: "suzong", acc: "i", c: "h", ap: false }],
  ["dezong", "Emperor Dezong of Tang", 779, 805, { f: "daizong", acc: "i", c: "h", ap: false }],
  ["shunzong", "Emperor Shunzong of Tang", 805, 805, { f: "dezong", acc: "i", c: "h", ap: false, en: "a" }],
  ["xianzong", "Emperor Xianzong of Tang", 805, 820, { f: "shunzong", acc: "i", c: "h", ap: false }],
  ["muzong", "Emperor Muzong of Tang", 820, 824, { f: "xianzong", acc: "i", c: "h", ap: false }],
  ["jingzong", "Emperor Jingzong of Tang", 824, 826, { f: "muzong", acc: "i", c: "h", ap: false }],
  ["wenzong", "Emperor Wenzong of Tang", 826, 840, { f: "muzong", acc: "i", c: "h", ap: false }],
  ["wuzong", "Emperor Wuzong of Tang", 840, 846, { f: "muzong", acc: "i", c: "h", ap: false, s: "Carried out the Huichang persecution of Buddhism." }],
  ["xuanzong2", "Emperor Xuānzong of Tang (Li Chen)", 846, 859, { f: "xianzong", acc: "i", c: "h", ap: false }],
  ["yizong", "Emperor Yizong of Tang", 859, 873, { f: "xuanzong2", acc: "i", c: "h", ap: false }],
  ["xizong", "Emperor Xizong of Tang", 873, 888, { f: "yizong", acc: "i", c: "h", ap: false }],
  ["zhaozong", "Emperor Zhaozong of Tang", 888, 904, { f: "yizong", sib: ["xizong"], acc: "i", c: "h", ap: false, en: "d" }],
  ["aidi", "Emperor Ai of Tang", 904, 907, { f: "zhaozong", acc: "i", c: "h", ap: false, en: "a", s: "Last Tang emperor, forced to abdicate to Zhu Wen." }],
]);
H("wu-zhou", "Wu Zhou", "Zhou (Wu Zetian)", "Chinese civilization", EA, 690, 705, "Interregnum dynasty proclaimed by Wu Zetian between two Tang reigns.", { cap: "Luoyang", c: "h", parent: "tang" });
R("cn-5d", "Five Dynasties", "china-5d", "emperor", [
  ["zhuwen", "Zhu Wen (Emperor Taizu of Later Liang)", 907, 912, { acc: "c", c: "h", ap: false, after: "@cn-tang-aidi", s: "Warlord who ended the Tang dynasty and founded the Later Liang." }],
  ["licunxu", "Li Cunxu (Emperor Zhuangzong of Later Tang)", 923, 926, { acc: "c", c: "h", ap: false, after: null }],
  ["shijingtang", "Shi Jingtang", 936, 942, { acc: "c", c: "h", ap: false, after: null, s: "Founder of the Later Jin who ceded the Sixteen Prefectures to the Liao." }],
  ["liuzhiyuan", "Liu Zhiyuan", 947, 948, { acc: "c", c: "h", ap: false, after: null }],
  ["guowei", "Guo Wei (Emperor Taizu of Later Zhou)", 951, 954, { acc: "c", c: "h", ap: false, after: null }],
  ["chairong", "Chai Rong", 954, 959, { acc: "i", c: "h", ap: false, after: "guowei", s: "Adopted heir of Guo Wei and the ablest Later Zhou ruler; the Song dynasty arose from his general Zhao Kuangyin." }],
]);
R("cn-song", "Song", "song", "emperor", [
  ["taizu", "Emperor Taizu of Song (Zhao Kuangyin)", 960, 976, { acc: "u", after: null, c: "h", ap: false, s: "Founder of the Song dynasty who took power in the Chenqiao mutiny." }],
  ["taizong", "Emperor Taizong of Song", 976, 997, { sib: ["taizu"], acc: "i", c: "h", ap: false }],
  ["zhenzong", "Emperor Zhenzong of Song", 997, 1022, { f: "taizong", acc: "i", c: "h", ap: false, s: "Concluded the Chanyuan treaty with the Liao in 1005." }],
  ["renzong", "Emperor Renzong of Song", 1022, 1063, { f: "zhenzong", acc: "i", c: "h", ap: false }],
  ["yingzong", "Emperor Yingzong of Song", 1063, 1067, { acc: "a", c: "h", ap: false }],
  ["shenzong", "Emperor Shenzong of Song", 1067, 1085, { f: "yingzong", acc: "i", c: "h", ap: false, s: "Backed Wang Anshi's New Policies." }],
  ["zhezong", "Emperor Zhezong of Song", 1085, 1100, { f: "shenzong", acc: "i", c: "h", ap: false }],
  ["huizong", "Emperor Huizong of Song", 1100, 1126, { f: "shenzong", sib: ["zhezong"], acc: "i", c: "h", ap: false, en: "a", s: "Artist-emperor who lost the north to the Jurchen Jin." }],
  ["qinzong", "Emperor Qinzong of Song", 1126, 1127, { f: "huizong", acc: "i", c: "h", ap: false, en: "c", s: "Captured with his father in the Jingkang incident." }],
  ["gaozong", "Emperor Gaozong of Song", 1127, 1162, { f: "huizong", sib: ["qinzong"], acc: "i", c: "h", ap: false, en: "a", s: "Founder of the Southern Song, moving the court south to Hangzhou." }],
  ["xiaozong", "Emperor Xiaozong of Song", 1162, 1189, { acc: "a", c: "h", ap: false, en: "a" }],
  ["guangzong", "Emperor Guangzong of Song", 1189, 1194, { f: "xiaozong", acc: "i", c: "h", ap: false, en: "p" }],
  ["ningzong", "Emperor Ningzong of Song", 1194, 1224, { f: "guangzong", acc: "i", c: "h", ap: false }],
  ["lizong", "Emperor Lizong of Song", 1224, 1264, { acc: "a", c: "h", ap: false }],
  ["duzong", "Emperor Duzong of Song", 1264, 1274, { acc: "a", c: "h", ap: false }],
  ["gong", "Emperor Gong of Song", 1274, 1276, { f: "duzong", acc: "i", c: "h", ap: false, en: "c", s: "Child emperor who surrendered to the Yuan in 1276." }],
  ["duanzong", "Emperor Duanzong of Song", 1276, 1278, { f: "duzong", sib: ["gong"], acc: "a", c: "h", ap: false }],
  ["bing", "Zhao Bing (Emperor Bing of Song)", 1278, 1279, { f: "duzong", sib: ["duanzong"], acc: "a", c: "h", ap: false, en: "d", s: "Last Song emperor, who died at the naval battle of Yamen." }],
]);
R("cn-liao", "Liao", "liao", "emperor", [
  ["abaoji", "Abaoji (Emperor Taizu of Liao)", 907, 926, { c: "h", ap: false, s: "Khitan leader who founded the Liao state, proclaiming himself emperor in 916." }],
  ["taizong", "Emperor Taizong of Liao (Yelü Deguang)", 926, 947, { f: "abaoji", acc: "i", c: "h", ap: false }],
  ["shizong", "Emperor Shizong of Liao", 947, 951, { acc: "u", c: "h", ap: false }],
  ["muzong", "Emperor Muzong of Liao", 951, 969, { f: "taizong", acc: "i", c: "h", ap: false }],
  ["jingzong", "Emperor Jingzong of Liao", 969, 982, { f: "shizong", acc: "i", c: "h", ap: false }],
  ["shengzong", "Emperor Shengzong of Liao", 982, 1031, { f: "jingzong", acc: "r", c: "h", ap: false, s: "Child emperor under the regency of his mother Xiao Yanyan; signed the Chanyuan treaty." }],
  ["xingzong", "Emperor Xingzong of Liao", 1031, 1055, { f: "shengzong", acc: "i", c: "h", ap: false }],
  ["daozong", "Emperor Daozong of Liao", 1055, 1101, { f: "xingzong", acc: "i", c: "h", ap: false }],
  ["tianzuo", "Emperor Tianzuo of Liao", 1101, 1125, { acc: "i", c: "h", ap: false, en: "c" }],
]);
R("cn-jin", "Jin (Jurchen)", "jin-jurchen", "emperor", [
  ["aguda", "Aguda (Emperor Taizu of Jin)", 1115, 1123, { c: "h", ap: false, s: "Jurchen chieftain who founded the Jin dynasty and attacked the Liao." }],
  ["wuqimai", "Emperor Taizong of Jin (Wuqimai)", 1123, 1135, { sib: ["aguda"], acc: "i", c: "h", ap: false }],
  ["xizong", "Emperor Xizong of Jin", 1135, 1149, { acc: "i", c: "h", ap: false }],
  ["hailing", "Prince Hailing (Wanyan Liang)", 1149, 1161, { acc: "u", us: "xizong", c: "h", ap: false, en: "d" }],
  ["shizong", "Emperor Shizong of Jin", 1161, 1189, { acc: "u", us: "hailing", c: "h", ap: false }],
  ["zhangzong", "Emperor Zhangzong of Jin", 1189, 1208, { acc: "i", c: "h", ap: false }],
  ["aizong", "Emperor Aizong of Jin", 1224, 1234, { c: "h", ap: false, en: "c", s: "Last Jin emperor, who died as the Mongols and Song took Caizhou." }],
]);
R("cn-xixia", "Western Xia", "xixia", "emperor", [
  ["yuanhao", "Li Yuanhao (Emperor Jingzong of Western Xia)", 1038, 1048, { c: "h", ap: false, s: "Founder of the Western Xia, who proclaimed himself emperor in 1038 and devised the Tangut script." }],
]);
R("cn-yuan", "Yuan", "yuan", "emperor", [
  ["genghis", "Genghis Khan", 1206, 1227, { c: "h", ap: false, h: "borjigin", s: "Founder of the Mongol Empire; posthumously Emperor Taizu of Yuan.", alt: ["Temüjin"] }],
  ["ogedei", "Ögedei Khan", 1229, 1241, { h: "borjigin", f: "genghis", c: "h", ap: false, acc: "e" }],
  ["mongke", "Möngke Khan", 1251, 1259, { h: "borjigin", c: "h", ap: false, acc: "e", after: "ogedei", f: "~Tolui" }],
  ["kublai", "Kublai Khan", 1260, 1294, { f: "~Tolui", sib: ["mongke"], c: "h", ap: false, acc: "e", s: "Founded the Yuan dynasty in 1271 and completed the conquest of Song China in 1279." }],
  ["temur", "Temür Khan (Emperor Chengzong)", 1294, 1307, { c: "h", ap: false, acc: "e", f: "~Zhenjin" }],
  ["wuzong", "Külüg Khan (Emperor Wuzong)", 1307, 1311, { c: "h", ap: false, acc: "e" }],
  ["renzong", "Ayurbarwada (Emperor Renzong)", 1311, 1320, { c: "h", ap: false, acc: "i" }],
  ["yingzong", "Gegeen Khan (Emperor Yingzong)", 1320, 1323, { f: "renzong", c: "h", ap: false, acc: "i", en: "d" }],
  ["taiding", "Yesün Temür (Taidingdi)", 1323, 1328, { c: "h", ap: false, acc: "u" }],
  ["wenzong", "Tugh Temür (Emperor Wenzong)", 1328, 1332, { c: "h", ap: false, acc: "u" }],
  ["shundi", "Toghon Temür (Emperor Huizong)", 1333, 1370, { c: "h", ap: false, acc: "i", en: "p", s: "Last Yuan emperor in China, driven from Dadu by the Ming in 1368." }],
]);
R("cn-ming", "Ming", "ming", "emperor", [
  ["hongwu", "Hongwu Emperor (Zhu Yuanzhang)", 1368, 1398, { after: "@cn-yuan-shundi", f: "~Zhu Shizhen", c: "h", ap: false, acc: "c", s: "Peasant rebel who founded the Ming dynasty and expelled the Mongols." }],
  ["jianwen", "Jianwen Emperor", 1398, 1402, { f: "~Zhu Biao", acc: "i", c: "h", ap: false, en: "p", s: "Grandson of Hongwu, deposed in the Jingnan campaign; his fate is uncertain." }],
  ["yongle", "Yongle Emperor", 1402, 1424, { f: "hongwu", acc: "u", us: "jianwen", c: "h", ap: false, s: "Seized the throne from his nephew, moved the capital to Beijing and sponsored Zheng He's voyages." }],
  ["hongxi", "Hongxi Emperor", 1424, 1425, { f: "yongle", acc: "i", c: "h", ap: false }],
  ["xuande", "Xuande Emperor", 1425, 1435, { f: "hongxi", acc: "i", c: "h", ap: false }],
  ["zhengtong", "Zhengtong Emperor", 1435, 1449, { f: "xuande", acc: "i", c: "h", ap: false, en: "c", s: "Captured by the Oirat Mongols at Tumu in 1449; restored in 1457 as the Tianshun Emperor." }],
  ["jingtai", "Jingtai Emperor", 1449, 1457, { f: "xuande", sib: ["zhengtong"], acc: "r", c: "h", ap: false, en: "p" }],
  ["tianshun", "Tianshun Emperor (Zhengtong, second reign)", 1457, 1464, { f: "xuande", acc: "u", us: "jingtai", c: "h", ap: false }],
  ["chenghua", "Chenghua Emperor", 1464, 1487, { f: "tianshun", acc: "i", c: "h", ap: false }],
  ["hongzhi", "Hongzhi Emperor", 1487, 1505, { f: "chenghua", acc: "i", c: "h", ap: false }],
  ["zhengde", "Zhengde Emperor", 1505, 1521, { f: "hongzhi", acc: "i", c: "h", ap: false }],
  ["jiajing", "Jiajing Emperor", 1521, 1567, { f: "~Zhu Youyuan", acc: "i", c: "h", ap: false, s: "Cousin of Zhengde who succeeded him; a long, Daoist-leaning reign." }],
  ["longqing", "Longqing Emperor", 1567, 1572, { f: "jiajing", acc: "i", c: "h", ap: false }],
  ["wanli", "Wanli Emperor", 1572, 1620, { f: "longqing", acc: "i", c: "h", ap: false, s: "Ming emperor with the longest reign (48 years)." }],
  ["taichang", "Taichang Emperor", 1620, 1620, { f: "wanli", acc: "i", c: "h", ap: false }],
  ["tianqi", "Tianqi Emperor", 1620, 1627, { f: "taichang", acc: "i", c: "h", ap: false }],
  ["chongzhen", "Chongzhen Emperor", 1627, 1644, { f: "taichang", sib: ["tianqi"], acc: "i", c: "h", ap: false, en: "d", s: "Last Ming emperor, who hanged himself as rebels entered Beijing." }],
]);
R("cn-qing", "Qing", "qing", "emperor", [
  ["nurhaci", "Nurhaci", 1616, 1626, { f: "~Taksi", c: "h", ap: false, h: "qing", s: "Jurchen leader who founded the Later Jin (precursor of the Qing) and the Eight Banners." }],
  ["hongtaiji", "Hong Taiji", 1626, 1643, { f: "nurhaci", acc: "e", c: "h", ap: false, s: "Renamed the state Qing in 1636 and took the imperial title." }],
  ["shunzhi", "Shunzhi Emperor", 1643, 1661, { f: "hongtaiji", acc: "i", c: "h", ap: false, s: "First Qing emperor to rule from Beijing; regency under Dorgon until 1650." }],
  ["kangxi", "Kangxi Emperor", 1661, 1722, { f: "shunzhi", acc: "i", c: "h", ap: false, s: "Longest-reigning Chinese emperor (61 years); consolidated Qing rule." }],
  ["yongzheng", "Yongzheng Emperor", 1722, 1735, { f: "kangxi", acc: "i", c: "h", ap: false }],
  ["qianlong", "Qianlong Emperor", 1735, 1796, { f: "yongzheng", acc: "i", c: "h", ap: false, en: "a", s: "Presided over the Qing zenith; abdicated formally to avoid exceeding his grandfather's reign." }],
  ["jiaqing", "Jiaqing Emperor", 1796, 1820, { f: "qianlong", acc: "i", c: "h", ap: false }],
  ["daoguang", "Daoguang Emperor", 1820, 1850, { f: "jiaqing", acc: "i", c: "h", ap: false, s: "Reign of the First Opium War and the Treaty of Nanjing." }],
  ["xianfeng", "Xianfeng Emperor", 1850, 1861, { f: "daoguang", acc: "i", c: "h", ap: false }],
  ["tongzhi", "Tongzhi Emperor", 1861, 1875, { f: "xianfeng", acc: "i", c: "h", ap: false, en: "d" }],
  ["cixi", "Empress Dowager Cixi", 1861, 1908, { t: "empress dowager (regent)", sp: ["xianfeng"], acc: "r", rg: "tongzhi", c: "h", ap: false, nolink: true, s: "Dominant figure of the late Qing court, regent for the Tongzhi and Guangxu emperors." }],
  ["guangxu", "Guangxu Emperor", 1875, 1908, { f: "~Yixuan (Prince Chun)", acc: "a", c: "h", ap: false, after: "tongzhi", s: "Child emperor chosen by Cixi; his Hundred Days' Reform of 1898 was crushed." }],
  ["puyi", "Xuantong Emperor (Puyi)", 1908, 1912, { f: "~Zaifeng (Prince Chun)", acc: "a", c: "h", ap: false, en: "a", s: "Last emperor of China, abdicated in 1912." }],
]);
export const { houses, monarchs, links } = S;

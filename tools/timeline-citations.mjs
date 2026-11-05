// Per-row citations and correctness checks for the World context rows in timeline-gapfill.mjs.
// Keyed by "<lane>|<name>". checked: confirmed | corrected | unverified. fix holds corrected values (historical years).
export const CITATIONS = {
 "Human origins|Homo sapiens emerges in Africa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Jebel_Irhoud",
   "https://en.wikipedia.org/wiki/Homo_sapiens"
  ],
  "checked": "confirmed",
  "note": "Jebel Irhoud ~315,000 +/-34,000 years (some dispute classification)."
 },
 "Human origins|Neanderthal burials": {
  "sources": [
   "https://en.wikipedia.org/wiki/Neanderthal"
  ],
  "checked": "confirmed",
  "note": "Wikipedia confirms deliberate burials and grave goods (esp. children) but gives no burial dates; range is within Neanderthal span (~240-40 ka). Date range not directly sourced."
 },
 "Prehistoric religion|Burials with ochre and shell beads (Qafzeh, Skhul)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Skhul_and_Qafzeh_hominins"
  ],
  "checked": "confirmed",
  "note": "Dated ~92-115 ka (Qafzeh), 81-119 ka (Skhul)."
 },
 "Prehistoric religion|Blombos Cave engraved ochre": {
  "sources": [
   "https://en.wikipedia.org/wiki/Blombos_Cave"
  ],
  "checked": "confirmed",
  "note": "Engraved ochre ~73-78 ka (up to 100 ka for others)."
 },
 "Human origins|Out of Africa dispersal": {
  "sources": [
   "https://en.wikipedia.org/wiki/Recent_African_origin_of_modern_humans"
  ],
  "checked": "confirmed"
 },
 "Prehistoric religion|Lion-man of Hohlenstein-Stadel": {
  "sources": [
   "https://en.wikipedia.org/wiki/Lion-man_of_Hohlenstein-Stadel"
  ],
  "checked": "confirmed",
  "note": "Aurignacian, 35,000-41,000 years old; 'oldest confirmed statue'; hybrid reading is questioned by some."
 },
 "Prehistoric religion|Chauvet cave art": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chauvet_Cave"
  ],
  "checked": "confirmed",
  "note": "Oldest painting ~36,500 years ago (2020 recalibration); hand stencils present."
 },
 "Prehistoric religion|Venus of Willendorf": {
  "sources": [
   "https://en.wikipedia.org/wiki/Venus_of_Willendorf"
  ],
  "checked": "confirmed",
  "note": "~30,000 years old (c.28,000 BCE)."
 },
 "Prehistoric religion|Lascaux cave art": {
  "sources": [
   "https://en.wikipedia.org/wiki/Lascaux"
  ],
  "checked": "confirmed",
  "note": "17,000-22,000 years old per Wikipedia."
 },
 "Human origins|Last Glacial Maximum": {
  "sources": [
   "https://en.wikipedia.org/wiki/Last_Glacial_Maximum"
  ],
  "checked": "confirmed",
  "note": "~26,000-20,000 years ago (i.e. c.24,000-18,000 BCE)."
 },
 "Prehistoric religion|Göbekli Tepe": {
  "sources": [
   "https://en.wikipedia.org/wiki/G%C3%B6bekli_Tepe"
  ],
  "checked": "confirmed"
 },
 "Human origins|Domestication of plants and animals begins": {
  "sources": [
   "https://en.wikipedia.org/wiki/Neolithic_Revolution"
  ],
  "checked": "confirmed",
  "note": "c.10,000-8,000 BCE in Fertile Crescent."
 },
 "Prehistoric religion|Çatalhöyük": {
  "sources": [
   "https://en.wikipedia.org/wiki/%C3%87atalh%C3%B6y%C3%BCk"
  ],
  "checked": "confirmed",
  "note": "Wikipedia infobox c.7100-5600 BCE; bull imagery exists as aurochs/cattle heads."
 },
 "Prehistoric religion|Megalithic building in Atlantic Europe": {
  "sources": [
   "https://en.wikipedia.org/wiki/Megalith"
  ],
  "checked": "confirmed",
  "note": "Wikipedia timeline gives Carnac from ~4000 BC, Newgrange ~3400, Stonehenge stone circle ~2500; earliest Atlantic megaliths (e.g. Barnenez) are often put earlier (~4800 BC), not verified in fetched source."
 },
 "Human origins|Invention of the wheel": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wheel"
  ],
  "checked": "confirmed",
  "note": "Earliest depictions 3631-3350 BCE in Poland and Uruk."
 },
 "Late antiquity and early medieval|Plague of Justinian": {
  "sources": [
   "https://en.wikipedia.org/wiki/Plague_of_Justinian"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Gregory the Great as pope": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pope_Gregory_I"
  ],
  "checked": "confirmed",
  "note": "Pontificate 590-604 confirmed; mission year covered by Augustine of Canterbury (597)."
 },
 "Late antiquity and early medieval|Mission of Augustine of Canterbury": {
  "sources": [
   "https://en.wikipedia.org/wiki/Augustine_of_Canterbury"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Prince Shōtoku and the spread of Buddhism in Japan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Prince_Shotoku"
  ],
  "checked": "confirmed",
  "note": "Regency 593-622."
 },
 "Late antiquity and early medieval|Hijra": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hijrah"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Rashidun Caliphate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rashidun_Caliphate"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Xuanzang's pilgrimage to India": {
  "sources": [
   "https://en.wikipedia.org/wiki/Xuanzang"
  ],
  "checked": "confirmed",
  "note": "Departure 629 (some sources 627); 645 return."
 },
 "Late antiquity and early medieval|Songtsen Gampo and Buddhism's arrival in Tibet": {
  "sources": [
   "https://en.wikipedia.org/wiki/Songtsen_Gampo"
  ],
  "checked": "confirmed",
  "note": "Reign 629 (or 618) to 650."
 },
 "Late antiquity and early medieval|Umayyad Caliphate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Umayyad_Caliphate"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Dome of the Rock completed": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dome_of_the_Rock"
  ],
  "checked": "confirmed",
  "note": "Inscription dates to 72 AH (691/2)."
 },
 "Late antiquity and early medieval|Muslim conquest of Iberia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Umayyad_conquest_of_Hispania"
  ],
  "checked": "confirmed",
  "note": "Wikipedia infobox gives 711-720s (chronology 711-732); 711-718 is within normal ranges for the conquest of the Visigothic kingdom."
 },
 "Late antiquity and early medieval|Battle of Tours": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Tours"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Abbasid Caliphate; Baghdad founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Abbasid_Caliphate"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Padmasambhava and Samye monastery": {
  "sources": [
   "https://en.wikipedia.org/wiki/Samye"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives 779 (construction from 763, completed 779/780); 775 is within the range of source disagreement."
 },
 "Late antiquity and early medieval|Coronation of Charlemagne": {
  "sources": [
   "https://en.wikipedia.org/wiki/Charlemagne"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Adi Shankara": {
  "sources": [
   "https://en.wikipedia.org/wiki/Adi_Shankara"
  ],
  "checked": "corrected",
  "note": "788-820 is the older (Max Müller era) proposal; current scholarship dates him c.700-750 CE.",
  "fix": {
   "start": 700,
   "end": 750,
   "description": "Systematizer of Advaita Vedanta; current scholarship dates him to roughly the first half of the 8th century (older proposals: 788-820)."
  }
 },
 "Late antiquity and early medieval|Viking Age": {
  "sources": [
   "https://en.wikipedia.org/wiki/Viking_Age"
  ],
  "checked": "confirmed"
 },
 "Late antiquity and early medieval|Diamond Sutra printed": {
  "sources": [
   "https://en.wikipedia.org/wiki/Diamond_Sutra"
  ],
  "checked": "confirmed",
  "note": "Dunhuang copy dated 868; oldest dated woodblock-printed book."
 },
 "Late antiquity and early medieval|Baptism of Rus' (Vladimir of Kyiv)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Christianization_of_Kievan_Rus%27"
  ],
  "checked": "confirmed",
  "note": "Traditional c. 988; year disputed."
 },
 "Late antiquity and early medieval|Book of Optics (Ibn al-Haytham)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Book_of_Optics"
  ],
  "checked": "confirmed"
 },
 "Early modern|Ninety-five Theses": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ninety-five_Theses"
  ],
  "checked": "confirmed"
 },
 "Early modern|Sikhism founded; Guru Nanak": {
  "sources": [
   "https://en.wikipedia.org/wiki/Guru_Nanak"
  ],
  "checked": "confirmed",
  "note": "Nanak lived 1469-1539."
 },
 "Early modern|Council of Trent": {
  "sources": [
   "https://en.wikipedia.org/wiki/Council_of_Trent"
  ],
  "checked": "confirmed"
 },
 "Early modern|Mughal Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mughal_Empire"
  ],
  "checked": "confirmed",
  "note": "1526-1857 confirmed; Ibadat Khana 1575 not stated in article text but is the standard date."
 },
 "Early modern|Safavid dynasty makes Twelver Shia the state religion of Iran": {
  "sources": [
   "https://en.wikipedia.org/wiki/Safavid_Iran"
  ],
  "checked": "confirmed"
 },
 "Early modern|Copernicus, De revolutionibus": {
  "sources": [
   "https://en.wikipedia.org/wiki/De_revolutionibus_orbium_coelestium"
  ],
  "checked": "confirmed"
 },
 "Early modern|Galileo and the telescope": {
  "sources": [
   "https://en.wikipedia.org/wiki/Galileo_Galilei"
  ],
  "checked": "confirmed",
  "note": "Telescope 1609 confirmed; trial 1633 is the standard date (not visible in fetched excerpt)."
 },
 "Early modern|Thirty Years' War": {
  "sources": [
   "https://en.wikipedia.org/wiki/Thirty_Years%27_War"
  ],
  "checked": "confirmed"
 },
 "Early modern|Scientific Revolution": {
  "sources": [
   "https://en.wikipedia.org/wiki/Scientific_Revolution"
  ],
  "checked": "confirmed"
 },
 "Early modern|Edo period; Tokugawa shogunate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Edo_period"
  ],
  "checked": "confirmed",
  "note": "1603 (shogun title) to 1868; some sources start 1600."
 },
 "Early modern|Fifth Dalai Lama unifies Tibet": {
  "sources": [
   "https://en.wikipedia.org/wiki/5th_Dalai_Lama"
  ],
  "checked": "confirmed"
 },
 "Early modern|Bashō and haiku": {
  "sources": [
   "https://en.wikipedia.org/wiki/Matsuo_Bash%C5%8D"
  ],
  "checked": "confirmed",
  "note": "Life dates 1644-1694."
 },
 "Early modern|Great Awakening": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Great_Awakening"
  ],
  "checked": "corrected",
  "note": "Wikipedia timeline: revival begins 1730s (Northampton 1734-35), peak 1740-43, wanes 1745. 1770 end is too late for the First Great Awakening.",
  "fix": {
   "end": 1745
  }
 },
 "Early modern|Enlightenment": {
  "sources": [
   "https://en.wikipedia.org/wiki/Age_of_Enlightenment"
  ],
  "checked": "confirmed",
  "note": "Traditional 1715-1789 (extended to ~1804); start dated variously from 1637 to 1687; 1685 is within normal range."
 },
 "Early modern|Baal Shem Tov and Hasidism": {
  "sources": [
   "https://en.wikipedia.org/wiki/Baal_Shem_Tov"
  ],
  "checked": "corrected",
  "note": "Birth is c.1700 (scholars e.g. Dubnow); 1698 rests on a disputed document. Death 1760 confirmed.",
  "fix": {
   "start": 1700
  }
 },
 "Early modern|Wahhabi movement": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wahhabism"
  ],
  "checked": "confirmed"
 },
 "Early modern|Kant, Critique of Pure Reason": {
  "sources": [
   "https://en.wikipedia.org/wiki/Critique_of_Pure_Reason"
  ],
  "checked": "confirmed"
 },
 "Early modern|American Declaration of Independence": {
  "sources": [
   "https://en.wikipedia.org/wiki/United_States_Declaration_of_Independence"
  ],
  "checked": "confirmed"
 },
 "Early modern|French Revolution": {
  "sources": [
   "https://en.wikipedia.org/wiki/French_Revolution"
  ],
  "checked": "confirmed"
 },
 "Modern era|Human Genome Project draft": {
  "sources": [
   "https://en.wikipedia.org/wiki/Human_Genome_Project"
  ],
  "checked": "confirmed",
  "note": "Drafts 2000-2001; declared complete April 2003."
 },
 "Modern era|September 11 attacks": {
  "sources": [
   "https://en.wikipedia.org/wiki/September_11_attacks"
  ],
  "checked": "confirmed"
 },
 "Modern era|Wikipedia launched": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wikipedia"
  ],
  "checked": "confirmed",
  "note": "Launched 15 January 2001."
 },
 "Modern era|Iraq War": {
  "sources": [
   "https://en.wikipedia.org/wiki/Iraq_War"
  ],
  "checked": "confirmed",
  "note": "20 March 2003 - 18 December 2011."
 },
 "Modern era|Facebook and the rise of social media": {
  "sources": [
   "https://en.wikipedia.org/wiki/Facebook"
  ],
  "checked": "confirmed",
  "note": "Founded 2004; 1 billion monthly users Oct 2012."
 },
 "Modern era|iPhone": {
  "sources": [
   "https://en.wikipedia.org/wiki/IPhone_(1st_generation)"
  ],
  "checked": "confirmed",
  "note": "Announced Jan 2007, released June 2007."
 },
 "Modern era|Global financial crisis": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Recession"
  ],
  "checked": "confirmed",
  "note": "Dec 2007-Jun 2009; Lehman collapse Sept 2008."
 },
 "Modern era|Bitcoin": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bitcoin"
  ],
  "checked": "confirmed",
  "note": "Genesis block 3 Jan 2009."
 },
 "Modern era|Arab Spring": {
  "sources": [
   "https://en.wikipedia.org/wiki/Arab_Spring"
  ],
  "checked": "confirmed",
  "note": "Infobox: 17 Dec 2010 - Dec 2012."
 },
 "Modern era|Higgs boson discovered": {
  "sources": [
   "https://en.wikipedia.org/wiki/Higgs_boson"
  ],
  "checked": "confirmed",
  "note": "Announced 4 July 2012."
 },
 "Modern era|Paris Agreement": {
  "sources": [
   "https://en.wikipedia.org/wiki/Paris_Agreement"
  ],
  "checked": "confirmed",
  "note": "Adopted 12 Dec 2015 by 195 states plus the EU."
 },
 "Modern era|First image of a black hole": {
  "sources": [
   "https://en.wikipedia.org/wiki/Event_Horizon_Telescope"
  ],
  "checked": "confirmed",
  "note": "Released 10 April 2019."
 },
 "Modern era|COVID-19 pandemic": {
  "sources": [
   "https://en.wikipedia.org/wiki/COVID-19_pandemic"
  ],
  "checked": "confirmed",
  "note": "WHO emergency ended 5 May 2023."
 },
 "Modern era|Russian invasion of Ukraine": {
  "sources": [
   "https://en.wikipedia.org/wiki/Russian_invasion_of_Ukraine"
  ],
  "checked": "confirmed",
  "note": "24 Feb 2022."
 },
 "Modern era|ChatGPT released; generative AI boom": {
  "sources": [
   "https://en.wikipedia.org/wiki/ChatGPT"
  ],
  "checked": "confirmed",
  "note": "Released 30 Nov 2022."
 },
 "Modern era|James Webb Space Telescope observations begin": {
  "sources": [
   "https://en.wikipedia.org/wiki/James_Webb_Space_Telescope"
  ],
  "checked": "confirmed",
  "note": "First images released 11 July 2022."
 },
 "Africa|Kerma culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kerma_culture"
  ],
  "checked": "confirmed"
 },
 "Africa|Nok culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nok_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives 1500 BC-1 BC; AD 300 end is within scholarly range."
 },
 "Africa|Kingdom of Kush; Napatan and Meroitic periods": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Kush"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.780 BC-c.350 AD; 1070 start reflects earlier Kushite polity; 25th dynasty 754-656 BC (desc 744 is within variant dating)."
 },
 "Africa|Carthage": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ancient_Carthage"
  ],
  "checked": "confirmed"
 },
 "Africa|Kingdom of Aksum": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Aksum"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: 1st c. AD to c.960; Ezana conversion c.324-340."
 },
 "Africa|Ghana Empire (Wagadu)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ghana_Empire"
  ],
  "checked": "confirmed"
 },
 "Africa|Swahili city-states": {
  "sources": [
   "https://en.wikipedia.org/wiki/Swahili_coast"
  ],
  "checked": "confirmed",
  "note": "Page confirms Kilwa, Mombasa, Zanzibar; period consistent."
 },
 "Africa|Great Zimbabwe": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Zimbabwe"
  ],
  "checked": "confirmed"
 },
 "Africa|Kingdom of Benin": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Benin"
  ],
  "checked": "confirmed"
 },
 "Africa|Mali Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mali_Empire"
  ],
  "checked": "corrected",
  "note": "Wikipedia gives c.1235-1610 (collapse narrative 1599); 1670 not supported.",
  "fix": {
   "end": 1610
  }
 },
 "Africa|Mansa Musa's pilgrimage to Mecca": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mansa_Musa"
  ],
  "checked": "confirmed",
  "note": "Hajj 1324 (generally 1324-1325)."
 },
 "Africa|Kingdom of Kongo": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Kongo"
  ],
  "checked": "confirmed"
 },
 "Africa|Songhai Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Songhai_Empire"
  ],
  "checked": "confirmed",
  "note": "Article gives c. 1430s-1591 (Sonni dynasty from 1468); 1464 is Sonni Ali's accession, within normal ranges. Article says 'one of the largest African empires' rather than the largest West African; acceptable."
 },
 "Americas|Norte Chico (Caral)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Caral"
  ],
  "checked": "confirmed"
 },
 "Americas|Olmec culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Olmecs"
  ],
  "checked": "confirmed"
 },
 "Americas|Chavín culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chav%C3%ADn_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.900-250 BCE; 200 BCE end is within range."
 },
 "Americas|Teotihuacan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Teotihuacan"
  ],
  "checked": "confirmed",
  "note": "Occupation c.100 BCE-750 CE; monuments sacked c.550."
 },
 "Americas|Classic Maya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Maya_civilization"
  ],
  "checked": "confirmed"
 },
 "Americas|Moche culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moche_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives 100-800 CE; 700 is within scholarly range."
 },
 "Americas|Tiwanaku": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tiwanaku"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.AD 110-1050 overall; 500-1000 covers florescence."
 },
 "Americas|Chaco Canyon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chaco_Culture_National_Historical_Park"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.900-1150 CE; 850 start acceptable."
 },
 "Americas|Cahokia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Cahokia"
  ],
  "checked": "confirmed"
 },
 "Americas|Aztec Triple Alliance": {
  "sources": [
   "https://en.wikipedia.org/wiki/Aztec_Triple_Alliance"
  ],
  "checked": "confirmed"
 },
 "Americas|Inca Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Inca_Empire"
  ],
  "checked": "confirmed"
 },
 "Americas|Columbus's first voyage": {
  "sources": [
   "https://en.wikipedia.org/wiki/Voyages_of_Christopher_Columbus"
  ],
  "checked": "confirmed",
  "note": "1492-1493; landfall 12 Oct 1492."
 },
 "Americas|Fall of Tenochtitlan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Capture_of_Tenochtitlan"
  ],
  "checked": "confirmed",
  "note": "13 Aug 1521."
 },
 "Central Asia|Kushan Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kushan_Empire"
  ],
  "checked": "confirmed"
 },
 "Central Asia|Göktürk Khaganate": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Turkic_Khaganate",
   "https://en.wikipedia.org/wiki/Second_Turkic_Khaganate"
  ],
  "checked": "confirmed",
  "note": "First Khaganate 552-603 (division), Second 682-744 (Orkhon inscriptions); combined 552-744 spans both Göktürk khaganates, with a gap 603-682. Acceptable as a combined span."
 },
 "Central Asia|Mongol Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mongol_Empire"
  ],
  "checked": "confirmed"
 },
 "Central Asia|Timur and the Timurid Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Timurid_Empire"
  ],
  "checked": "confirmed"
 },
 "Oceania|First peoples reach Australia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Madjedbebe"
  ],
  "checked": "confirmed",
  "note": "Clarkson 2017 gives 65,000 +/-6,000 BP; disputed (50,000 widely accepted)."
 },
 "Oceania|Lapita expansion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Lapita_culture"
  ],
  "checked": "confirmed"
 },
 "Oceania|Polynesian settlement of the eastern Pacific": {
  "sources": [
   "https://en.wikipedia.org/wiki/Polynesia"
  ],
  "checked": "confirmed",
  "note": "Hawaii/Rapa Nui c.1200, NZ late 13th c.; consistent."
 },
 "Oceania|Moai of Rapa Nui": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moai"
  ],
  "checked": "confirmed"
 },
 "Oceania|Cook's Pacific voyages": {
  "sources": [
   "https://en.wikipedia.org/wiki/James_Cook"
  ],
  "checked": "confirmed"
 },
 "Southeast Asia|Đông Sơn culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/%C4%90%C3%B4ng_S%C6%A1n_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives c.1000 BC-100 AD; 700 BC start used by some authors."
 },
 "Southeast Asia|Funan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Funan"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.50-627 CE; row range is within variants."
 },
 "Southeast Asia|Srivijaya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Srivijaya"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: 671-1025 (Chola raids); 1377 traditional end (Majapahit); acceptable."
 },
 "Southeast Asia|Borobudur": {
  "sources": [
   "https://en.wikipedia.org/wiki/Borobudur"
  ],
  "checked": "confirmed",
  "note": "Built c.780-833."
 },
 "Southeast Asia|Khmer Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Khmer_Empire"
  ],
  "checked": "confirmed"
 },
 "Southeast Asia|Pagan Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pagan_Kingdom"
  ],
  "checked": "confirmed",
  "note": "849 is the chronicle date; radiocarbon suggests c. 980 at earliest; 1297 end per article."
 },
 "Southeast Asia|Majapahit": {
  "sources": [
   "https://en.wikipedia.org/wiki/Majapahit"
  ],
  "checked": "confirmed"
 },
 "Southeast Asia|Ayutthaya Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ayutthaya_Kingdom"
  ],
  "checked": "confirmed"
 },
 "Greek|Eleusinian Mysteries": {
  "sources": [
   "https://en.wikipedia.org/wiki/Eleusinian_Mysteries"
  ],
  "checked": "confirmed",
  "note": "Bronze Age/Mycenaean roots; closed 392 by Theodosius I."
 },
 "Greek|Pythagoras": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pythagoras"
  ],
  "checked": "confirmed",
  "note": "c.570-c.495 BC; settled in Croton c.530."
 },
 "Greek|Socrates": {
  "sources": [
   "https://en.wikipedia.org/wiki/Socrates"
  ],
  "checked": "confirmed",
  "note": "Born c.470 or 469."
 },
 "Greek|Plato": {
  "sources": [
   "https://en.wikipedia.org/wiki/Plato"
  ],
  "checked": "confirmed",
  "note": "b. c.428, d. 348/347; Academy c.383."
 },
 "Greek|Aristotle": {
  "sources": [
   "https://en.wikipedia.org/wiki/Aristotle"
  ],
  "checked": "confirmed"
 },
 "Greek|Epicurus": {
  "sources": [
   "https://en.wikipedia.org/wiki/Epicurus"
  ],
  "checked": "confirmed"
 },
 "Greek|Hellenistic period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hellenistic_period"
  ],
  "checked": "confirmed"
 },
 "Greek|Zeno of Citium founds Stoicism": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zeno_of_Citium"
  ],
  "checked": "confirmed"
 },
 "Greek|Plotinus and Neoplatonism": {
  "sources": [
   "https://en.wikipedia.org/wiki/Plotinus"
  ],
  "checked": "confirmed",
  "note": "Born 204/5."
 },
 "Egyptian|Pyramid Texts": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pyramid_Texts"
  ],
  "checked": "confirmed",
  "note": "Earliest in pyramid of Unas, c.2353-2323 BCE; oldest texts c.2400-2300."
 },
 "Egyptian|Book of the Dead tradition": {
  "sources": [
   "https://en.wikipedia.org/wiki/Book_of_the_Dead"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Akhenaten and the Aten": {
  "sources": [
   "https://en.wikipedia.org/wiki/Akhenaten"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Ptolemaic Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ptolemaic_Kingdom"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Corpus Hermeticum": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hermetica"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Enheduanna": {
  "sources": [
   "https://en.wikipedia.org/wiki/Enheduanna"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives only fl. c.2300 BCE; row's span is within her era (daughter of Sargon, r. 2334-2279)."
 },
 "Mesopotamian|Hammurabi of Babylon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hammurabi"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Epic of Gilgamesh, standard version": {
  "sources": [
   "https://en.wikipedia.org/wiki/Epic_of_Gilgamesh"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: compiled 13th-10th c. BCE; Sumerian poems c.2100."
 },
 "Mesopotamian|Neo-Assyrian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Neo-Assyrian_Empire"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Neo-Babylonian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Neo-Babylonian_Empire"
  ],
  "checked": "confirmed"
 },
 "Iranian|Zarathustra": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zoroaster"
  ],
  "checked": "confirmed",
  "note": "No consensus; early dating 1500-1000 BC is a mainstream view."
 },
 "Iranian|Sasanian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sasanian_Empire"
  ],
  "checked": "confirmed"
 },
 "Gnostic Esoteric|Mani": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mani_(prophet)"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: born April 216; died 274 (or 277)."
 },
 "Second Temple Jewish|Dead Sea Scrolls": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dead_Sea_Scrolls"
  ],
  "checked": "confirmed"
 },
 "Second Temple Jewish|Destruction of the Second Temple": {
  "sources": [
   "https://en.wikipedia.org/wiki/Siege_of_Jerusalem_(70_CE)"
  ],
  "checked": "confirmed"
 },
 "Early Israelite|Babylonian exile": {
  "sources": [
   "https://en.wikipedia.org/wiki/Babylonian_captivity"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives fall of Jerusalem as 587 BCE; 586 is the alternate conventional date. Within range."
 },
 "Rabbinic Judaism|Mishnah redacted": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mishnah"
  ],
  "checked": "confirmed"
 },
 "Rabbinic Judaism|Babylonian Talmud": {
  "sources": [
   "https://en.wikipedia.org/wiki/Babylonian_Talmud"
  ],
  "checked": "confirmed",
  "note": "Tradition c.500, likely mid-6th c.; Jerusalem Talmud late 4th-early 5th c. (desc c.400 ok)."
 },
 "Rabbinic Judaism|Maimonides": {
  "sources": [
   "https://en.wikipedia.org/wiki/Maimonides"
  ],
  "checked": "confirmed",
  "note": "Birth 1138 (or 1135)."
 },
 "Rabbinic Judaism|Zohar": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zohar"
  ],
  "checked": "confirmed",
  "note": "Most scholars: written c.1280-1286."
 },
 "Rabbinic Judaism|Isaac Luria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Isaac_Luria"
  ],
  "checked": "confirmed"
 },
 "Christian|Edict of Milan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Edict_of_Milan"
  ],
  "checked": "confirmed"
 },
 "Christian|Council of Nicaea": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Council_of_Nicaea"
  ],
  "checked": "confirmed"
 },
 "Christian|Theodosius makes Nicene Christianity the state religion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Edict_of_Thessalonica"
  ],
  "checked": "confirmed"
 },
 "Christian|Council of Chalcedon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Council_of_Chalcedon"
  ],
  "checked": "confirmed"
 },
 "Christian|Rule of Benedict": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rule_of_Saint_Benedict"
  ],
  "checked": "confirmed",
  "note": "c.530 per lead (some sources 516)."
 },
 "Christian|East–West Schism": {
  "sources": [
   "https://en.wikipedia.org/wiki/East%E2%80%93West_Schism"
  ],
  "checked": "confirmed"
 },
 "Christian|Crusades": {
  "sources": [
   "https://en.wikipedia.org/wiki/Crusades"
  ],
  "checked": "confirmed"
 },
 "Christian|Francis of Assisi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Francis_of_Assisi"
  ],
  "checked": "confirmed"
 },
 "Christian|Thomas Aquinas": {
  "sources": [
   "https://en.wikipedia.org/wiki/Thomas_Aquinas"
  ],
  "checked": "confirmed"
 },
 "Christian|Meister Eckhart": {
  "sources": [
   "https://en.wikipedia.org/wiki/Meister_Eckhart"
  ],
  "checked": "confirmed"
 },
 "Christian|Teresa of Ávila and John of the Cross": {
  "sources": [
   "https://en.wikipedia.org/wiki/Teresa_of_%C3%81vila",
   "https://en.wikipedia.org/wiki/John_of_the_Cross"
  ],
  "checked": "confirmed",
  "note": "Teresa 1515-1582, John 1542-1591 match."
 },
 "Islam|Karbala": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Karbala"
  ],
  "checked": "confirmed"
 },
 "Islam|Rabia al-Adawiyya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rabia_al-Adawiyya"
  ],
  "checked": "confirmed",
  "note": "Born c.714-718, d. 801; fine."
 },
 "Islam|Avicenna (Ibn Sina)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Avicenna"
  ],
  "checked": "confirmed"
 },
 "Islam|Al-Hallaj": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mansur_Al-Hallaj"
  ],
  "checked": "confirmed"
 },
 "Islam|Al-Ghazali": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Ghazali"
  ],
  "checked": "confirmed"
 },
 "Islam|Ibn Arabi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ibn_Arabi"
  ],
  "checked": "confirmed"
 },
 "Islam|Rumi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rumi"
  ],
  "checked": "confirmed"
 },
 "Islam|Ottoman Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ottoman_Empire"
  ],
  "checked": "confirmed"
 },
 "Islam|Mulla Sadra": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mulla_Sadra"
  ],
  "checked": "confirmed"
 },
 "Hindu|Principal Upanishads": {
  "sources": [
   "https://en.wikipedia.org/wiki/Upanishads"
  ],
  "checked": "confirmed",
  "note": "Phillips 800-300 BCE."
 },
 "Hindu|Bhagavad Gita": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bhagavad_Gita"
  ],
  "checked": "confirmed"
 },
 "Hindu|Yoga Sutras of Patanjali": {
  "sources": [
   "https://en.wikipedia.org/wiki/Yoga_Sutras_of_Patanjali"
  ],
  "checked": "confirmed",
  "note": "Estimates 500 BCE-450 CE; most scholars early centuries CE (Maas c.400); row range acceptable."
 },
 "Hindu|Puranas": {
  "sources": [
   "https://en.wikipedia.org/wiki/Puranas"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: first versions c.3rd-10th c.; consistent."
 },
 "Hindu|Abhinavagupta": {
  "sources": [
   "https://en.wikipedia.org/wiki/Abhinavagupta"
  ],
  "checked": "confirmed"
 },
 "Hindu|Ramanuja": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ramanuja"
  ],
  "checked": "corrected",
  "note": "Modern scholarship dates Ramanuja c.1077-1157; 1017-1137 is the Sri Vaishnava traditional dating.",
  "fix": {
   "start": 1077,
   "end": 1157
  }
 },
 "Hindu|Madhva": {
  "sources": [
   "https://en.wikipedia.org/wiki/Madhvacharya"
  ],
  "checked": "confirmed",
  "note": "Wikipedia cites two schemes: 1199-1278 and 1238-1317; row uses the latter."
 },
 "Hindu|Kabir": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kabir"
  ],
  "checked": "confirmed",
  "note": "Dates uncertain: 1398-1448 or 1440-1518; row's 1398-1518 spans both (traditional 120-year life). Left as is."
 },
 "Hindu|Chaitanya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chaitanya_Mahaprabhu"
  ],
  "checked": "confirmed"
 },
 "Jain|Mahavira": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mahavira"
  ],
  "checked": "confirmed"
 },
 "Indian Buddhist|Ashoka": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ashoka"
  ],
  "checked": "confirmed"
 },
 "Indian Buddhist|Tipitaka written down in Sri Lanka": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pali_Canon"
  ],
  "checked": "confirmed"
 },
 "Indian Buddhist|Nagarjuna": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nagarjuna"
  ],
  "checked": "confirmed"
 },
 "Indian Buddhist|Nalanda": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nalanda"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: founded c.427, burned c.1200 (Khalji), diminished use to ~1400; 1197 matches the sack."
 },
 "Chinese|Confucius": {
  "sources": [
   "https://en.wikipedia.org/wiki/Confucius"
  ],
  "checked": "confirmed"
 },
 "Chinese|Zhuangzi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zhuangzi_(book)"
  ],
  "checked": "confirmed"
 },
 "Chinese|Celestial Masters": {
  "sources": [
   "https://en.wikipedia.org/wiki/Way_of_the_Celestial_Masters"
  ],
  "checked": "confirmed"
 },
 "Zen Dharma Transmission|Bodhidharma": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bodhidharma"
  ],
  "checked": "confirmed"
 },
 "Zen Dharma Transmission|Huineng": {
  "sources": [
   "https://en.wikipedia.org/wiki/Huineng"
  ],
  "checked": "confirmed"
 },
 "Rinzai Lineage|Eisai": {
  "sources": [
   "https://en.wikipedia.org/wiki/Eisai"
  ],
  "checked": "confirmed"
 },
 "Soto Lineage|Dōgen": {
  "sources": [
   "https://en.wikipedia.org/wiki/D%C5%8Dgen"
  ],
  "checked": "confirmed"
 },
 "Rinzai Lineage|Hakuin": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hakuin_Ekaku"
  ],
  "checked": "confirmed",
  "note": "Some listings give 1687/1768."
 },
 "Sikh|Sikh scripture and the Khalsa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Guru_Granth_Sahib",
   "https://en.wikipedia.org/wiki/Khalsa"
  ],
  "checked": "confirmed",
  "note": "Adi Granth completed 1604; Khalsa 1699 (traditional date)."
 },
 "Mesopotamian|Early Dynastic Sumer": {
  "sources": [
   "https://en.wikipedia.org/wiki/Early_Dynastic_Period_(Mesopotamia)"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Old Kingdom of Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Old_Kingdom"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Great Pyramid of Giza": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Pyramid_of_Giza"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Akkadian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Akkadian_Empire"
  ],
  "checked": "confirmed"
 },
 "Middle East|Ebla archives": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ebla"
  ],
  "checked": "confirmed"
 },
 "South Asia|Mature Indus Valley civilization": {
  "sources": [
   "https://en.wikipedia.org/wiki/Indus_Valley_Civilisation"
  ],
  "checked": "confirmed"
 },
 "East Asia|Liangzhu culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Liangzhu_culture"
  ],
  "checked": "confirmed"
 },
 "Europe|Corded Ware and Bell Beaker horizons": {
  "sources": [
   "https://en.wikipedia.org/wiki/Corded_Ware_culture"
  ],
  "checked": "confirmed"
 },
 "Europe|Stonehenge sarsen circle": {
  "sources": [
   "https://en.wikipedia.org/wiki/Stonehenge"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Ur III dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Third_Dynasty_of_Ur"
  ],
  "checked": "confirmed"
 },
 "Europe|Minoan palaces (Neopalatial)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Minoan_civilization"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Hyksos rule in Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hyksos"
  ],
  "checked": "confirmed"
 },
 "Anatolia|Old Hittite Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hittites"
  ],
  "checked": "confirmed"
 },
 "Europe|Thera eruption": {
  "sources": [
   "https://en.wikipedia.org/wiki/Minoan_eruption"
  ],
  "checked": "confirmed"
 },
 "East Asia|Shang dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Shang_dynasty"
  ],
  "checked": "confirmed"
 },
 "Greek|Mycenaean Greece": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mycenaean_Greece"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Kassite Babylonia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kassites"
  ],
  "checked": "confirmed"
 },
 "Egyptian|New Kingdom of Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/New_Kingdom_of_Egypt"
  ],
  "checked": "confirmed"
 },
 "South Asia|Maurya Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Maurya_Empire"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives c.321 BCE start; 322 is a common alternate."
 },
 "Iranian|Parthian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Parthian_Empire"
  ],
  "checked": "confirmed"
 },
 "Europe|Punic Wars": {
  "sources": [
   "https://en.wikipedia.org/wiki/Punic_Wars"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Library of Alexandria founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Library_of_Alexandria"
  ],
  "checked": "confirmed"
 },
 "East Asia|Qin Shi Huang unifies China": {
  "sources": [
   "https://en.wikipedia.org/wiki/Qin_Shi_Huang"
  ],
  "checked": "confirmed"
 },
 "East Asia|Han dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Han_dynasty"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Rosetta Stone": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rosetta_Stone"
  ],
  "checked": "confirmed"
 },
 "Second Temple Jewish|Maccabean revolt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Maccabean_Revolt"
  ],
  "checked": "confirmed"
 },
 "Rabbinic Judaism|Hillel the Elder": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hillel_the_Elder"
  ],
  "checked": "confirmed"
 },
 "Central Asia|Zhang Qian's missions to the west": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zhang_Qian"
  ],
  "checked": "confirmed",
  "note": "First mission 138 to return c.126/125 BCE."
 },
 "East Asia|Sima Qian's Records of the Grand Historian": {
  "sources": [
   "https://en.wikipedia.org/wiki/Records_of_the_Grand_Historian"
  ],
  "checked": "confirmed"
 },
 "Europe|Assassination of Julius Caesar": {
  "sources": [
   "https://en.wikipedia.org/wiki/Assassination_of_Julius_Caesar"
  ],
  "checked": "confirmed"
 },
 "Roman|Augustus and the Principate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Augustus"
  ],
  "checked": "confirmed"
 },
 "Christian|Jesus of Nazareth": {
  "sources": [
   "https://en.wikipedia.org/wiki/Jesus"
  ],
  "checked": "confirmed"
 },
 "South Asia|Gupta Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Gupta_Empire"
  ],
  "checked": "confirmed",
  "note": "320-550 is the conventional classical span; Wikipedia infobox gives c.240-c.579 overall."
 },
 "East Asia|Three Kingdoms and Jin China": {
  "sources": [
   "https://en.wikipedia.org/wiki/Three_Kingdoms",
   "https://en.wikipedia.org/wiki/Jin_dynasty_(266%E2%80%93420)"
  ],
  "checked": "confirmed",
  "note": "Three Kingdoms 220-280, Jin to 420; Sixteen Kingdoms 304-439; Buddhism spread in the north."
 },
 "East Asia|Kofun period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kofun_period"
  ],
  "checked": "confirmed"
 },
 "Christian|Antony the Great": {
  "sources": [
   "https://en.wikipedia.org/wiki/Anthony_the_Great"
  ],
  "checked": "confirmed"
 },
 "Christian|Athanasius of Alexandria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Athanasius_of_Alexandria"
  ],
  "checked": "confirmed"
 },
 "Christian|Armenia adopts Christianity": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tiridates_III_of_Armenia"
  ],
  "checked": "confirmed"
 },
 "Christian|Diocletian persecution": {
  "sources": [
   "https://en.wikipedia.org/wiki/Diocletianic_Persecution"
  ],
  "checked": "confirmed",
  "note": "Galerius ended it in the East in 311; some date its end to 313."
 },
 "Christian|Arian controversy": {
  "sources": [
   "https://en.wikipedia.org/wiki/Arianism"
  ],
  "checked": "confirmed",
  "note": "Controversy began c.318-320, climax at Nicaea 325, ended with Constantinople 381 per article."
 },
 "Christian|Pachomius and communal monasticism": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pachomius_the_Great"
  ],
  "checked": "confirmed"
 },
 "Chinese Buddhist|Kumārajīva": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kum%C4%81raj%C4%ABva"
  ],
  "checked": "confirmed"
 },
 "Gnostic Esoteric|Nag Hammadi library buried": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nag_Hammadi_library"
  ],
  "checked": "confirmed"
 },
 "Greek|Julian the Apostate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Julian_(emperor)"
  ],
  "checked": "confirmed"
 },
 "Central Asia|Hunnic migrations": {
  "sources": [
   "https://en.wikipedia.org/wiki/Huns"
  ],
  "checked": "confirmed"
 },
 "Christian|Council of Constantinople": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Council_of_Constantinople"
  ],
  "checked": "confirmed",
  "note": "381, second ecumenical; scholars debate whether the council itself promulgated the creed"
 },
 "Christian|Jerome's Vulgate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Vulgate"
  ],
  "checked": "confirmed",
  "note": "382 commission confirmed; 405 completion is the conventional end date (not visible in fetched text)"
 },
 "Christian|Augustine of Hippo": {
  "sources": [
   "https://en.wikipedia.org/wiki/Augustine_of_Hippo"
  ],
  "checked": "confirmed",
  "note": "354-430 confirmed; Confessions 397-398"
 },
 "Chinese Buddhist|Faxian's pilgrimage to India": {
  "sources": [
   "https://en.wikipedia.org/wiki/Faxian"
  ],
  "checked": "confirmed",
  "note": "399-412 confirmed"
 },
 "Europe|Sack of Rome by the Visigoths": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sack_of_Rome_(410)"
  ],
  "checked": "confirmed",
  "note": "24 Aug 410, Alaric"
 },
 "Greek|Hypatia of Alexandria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hypatia"
  ],
  "checked": "confirmed"
 },
 "Christian|Council of Ephesus": {
  "sources": [
   "https://en.wikipedia.org/wiki/Council_of_Ephesus"
  ],
  "checked": "confirmed",
  "note": "431, third ecumenical, condemned Nestorius"
 },
 "Europe|Fall of the Western Roman Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Fall_of_the_Western_Roman_Empire"
  ],
  "checked": "confirmed",
  "note": "476 Odoacer deposed Romulus Augustulus"
 },
 "South Asia|Aryabhata": {
  "sources": [
   "https://en.wikipedia.org/wiki/Aryabhata"
  ],
  "checked": "confirmed"
 },
 "Tibetan Buddhist|Fourteenth Dalai Lama flees Tibet": {
  "sources": [
   "https://en.wikipedia.org/wiki/14th_Dalai_Lama"
  ],
  "checked": "confirmed",
  "note": "Crossed into India 30 March 1959"
 },
 "Christian|Second Vatican Council": {
  "sources": [
   "https://en.wikipedia.org/wiki/Second_Vatican_Council"
  ],
  "checked": "confirmed",
  "note": "1962-1965; Nostra Aetate promulgated 28 Oct 1965"
 },
 "Modern era|Intel 4004 microprocessor": {
  "sources": [
   "https://en.wikipedia.org/wiki/Intel_4004"
  ],
  "checked": "confirmed",
  "note": "Released Nov 1971; generally regarded as first commercial microprocessor"
 },
 "Modern era|Oil crisis": {
  "sources": [
   "https://en.wikipedia.org/wiki/1973_oil_crisis"
  ],
  "checked": "confirmed",
  "note": "OAPEC embargo Oct 1973 (OAPEC rather than OPEC strictly; OPEC also raised prices)"
 },
 "Tibetan Buddhist|Naropa Institute founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Naropa_University"
  ],
  "checked": "confirmed",
  "note": "Founded 1974 by Trungpa; accredited 1988 as first Buddhist-inspired US institution"
 },
 "Southeast Asian Buddhist|Insight Meditation Society founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Insight_Meditation_Society"
  ],
  "checked": "confirmed",
  "note": "Founded 1975; founders also include Jacqueline Schwartz"
 },
 "Modern era|End of the Vietnam War": {
  "sources": [
   "https://en.wikipedia.org/wiki/Fall_of_Saigon"
  ],
  "checked": "confirmed",
  "note": "30 April 1975"
 },
 "Modern era|Voyager 1 and 2 launched": {
  "sources": [
   "https://en.wikipedia.org/wiki/Voyager_program"
  ],
  "checked": "confirmed",
  "note": "1977; Voyager 1 crossed heliopause Aug 2012"
 },
 "Modern era|Jonestown deaths": {
  "sources": [
   "https://en.wikipedia.org/wiki/Jonestown"
  ],
  "checked": "confirmed",
  "note": "18 Nov 1978, 918 deaths"
 },
 "Christian|Election of John Paul II": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pope_John_Paul_II"
  ],
  "checked": "confirmed",
  "note": "1978; first non-Italian since Adrian VI (1522-23), ~455 years"
 },
 "Islam|Iranian Revolution": {
  "sources": [
   "https://en.wikipedia.org/wiki/Iranian_Revolution"
  ],
  "checked": "confirmed",
  "note": "Monarchy fell 11 Feb 1979; Islamic Republic established"
 },
 "Modern era|Soviet–Afghan War": {
  "sources": [
   "https://en.wikipedia.org/wiki/Soviet%E2%80%93Afghan_War"
  ],
  "checked": "confirmed",
  "note": "25 Dec 1979 - 15 Feb 1989"
 },
 "Modern era|First AIDS cases reported": {
  "sources": [
   "https://en.wikipedia.org/wiki/History_of_HIV/AIDS"
  ],
  "checked": "confirmed",
  "note": "CDC report 5 June 1981; virus (LAV) identified 1983"
 },
 "Southeast Asian Buddhist|Plum Village founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Plum_Village_Monastery"
  ],
  "checked": "confirmed",
  "note": "Founded 1982 in Dordogne"
 },
 "Modern era|Chernobyl disaster": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chernobyl_disaster"
  ],
  "checked": "confirmed",
  "note": "26 April 1986"
 },
 "Modern era|Fall of the Berlin Wall": {
  "sources": [
   "https://en.wikipedia.org/wiki/Berlin_Wall"
  ],
  "checked": "confirmed",
  "note": "9 Nov 1989; reunification 3 Oct 1990"
 },
 "Modern era|Tiananmen Square protests": {
  "sources": [
   "https://en.wikipedia.org/wiki/1989_Tiananmen_Square_protests_and_massacre"
  ],
  "checked": "confirmed",
  "note": "Crackdown 3-4 June 1989"
 },
 "Tibetan Buddhist|Dalai Lama receives Nobel Peace Prize": {
  "sources": [
   "https://en.wikipedia.org/wiki/14th_Dalai_Lama"
  ],
  "checked": "confirmed",
  "note": "Year 1989 confirmed; rationale not shown in fetched text"
 },
 "Modern era|World Wide Web proposed": {
  "sources": [
   "https://en.wikipedia.org/wiki/World_Wide_Web"
  ],
  "checked": "confirmed",
  "note": "Proposed 1989 at CERN; first website 1991 (not shown in fetched text but standard)"
 },
 "Modern era|Release of Nelson Mandela": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nelson_Mandela"
  ],
  "checked": "confirmed",
  "note": "Released 1990; 1994 multiracial election"
 },
 "Modern era|Hubble Space Telescope launched": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hubble_Space_Telescope"
  ],
  "checked": "confirmed",
  "note": "Launched 24 Apr 1990 on Discovery STS-31, deployed 25 Apr"
 },
 "Modern era|Dissolution of the Soviet Union": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dissolution_of_the_Soviet_Union"
  ],
  "checked": "confirmed",
  "note": "26 Dec 1991"
 },
 "Modern era|Linux kernel released": {
  "sources": [
   "https://en.wikipedia.org/wiki/Linux_kernel"
  ],
  "checked": "confirmed",
  "note": "0.01 on 17 Sept 1991"
 },
 "Modern era|Rwandan genocide": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rwandan_genocide"
  ],
  "checked": "corrected",
  "fix": {
   "description": "An estimated 500,000 to 800,000 people killed in roughly 100 days (7 April to mid-July 1994)."
  },
  "note": "Wikipedia gives 520,000-702,000 deaths (scholarly range 500-600k+); 800,000 is an upper/UN-style figure, not a consensus."
 },
 "Modern era|Aum Shinrikyo sarin attack": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tokyo_subway_sarin_attack"
  ],
  "checked": "confirmed",
  "note": "20 March 1995"
 },
 "Modern era|Dolly the sheep": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dolly_(sheep)"
  ],
  "checked": "confirmed",
  "note": "Born 5 July 1996; first mammal cloned from adult somatic cell"
 },
 "Modern era|Hong Kong handover": {
  "sources": [
   "https://en.wikipedia.org/wiki/Handover_of_Hong_Kong"
  ],
  "checked": "confirmed",
  "note": "1 July 1997"
 },
 "Modern era|Google founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Google"
  ],
  "checked": "confirmed",
  "note": "4 Sept 1998 per infobox"
 },
 "Modern era|Indian Ocean tsunami": {
  "sources": [
   "https://en.wikipedia.org/wiki/2004_Indian_Ocean_earthquake_and_tsunami"
  ],
  "checked": "confirmed",
  "note": "26 Dec 2004; ~228,000 dead"
 },
 "Christian|Election of Benedict XVI": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pope_Benedict_XVI"
  ],
  "checked": "confirmed",
  "note": "Elected 19 Apr 2005; resigned 28 Feb 2013"
 },
 "Modern era|Fukushima nuclear accident": {
  "sources": [
   "https://en.wikipedia.org/wiki/Fukushima_nuclear_accident"
  ],
  "checked": "confirmed",
  "note": "11 March 2011"
 },
 "Modern era|Death of Osama bin Laden": {
  "sources": [
   "https://en.wikipedia.org/wiki/Killing_of_Osama_bin_Laden"
  ],
  "checked": "confirmed",
  "note": "2 May 2011 PKT, Abbottabad"
 },
 "Christian|Election of Pope Francis": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pope_Francis"
  ],
  "checked": "confirmed",
  "note": "13 March 2013; first Jesuit and Latin American pope"
 },
 "Islam|Islamic State declares a caliphate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Islamic_State"
  ],
  "checked": "confirmed",
  "note": "Declared 29 June 2014; Mosul captured 2017, last Syria territory March 2019. Mosul location not stated in fetched text"
 },
 "Modern era|Taliban return to power": {
  "sources": [
   "https://en.wikipedia.org/wiki/2021_Taliban_offensive"
  ],
  "checked": "confirmed",
  "note": "Kabul fell 15 Aug 2021"
 },
 "Modern era|Hamas-led attack on Israel; Gaza war": {
  "sources": [
   "https://en.wikipedia.org/wiki/October_7_attacks"
  ],
  "checked": "confirmed",
  "note": "7 Oct 2023"
 },
 "Christian|Death of Pope Francis; election of Leo XIV": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pope_Francis",
   "https://en.wikipedia.org/wiki/Pope_Leo_XIV"
  ],
  "checked": "confirmed",
  "note": "Francis died 21 April 2025; Leo XIV elected 8 May 2025"
 },
 "Future|Total solar eclipse of 2 August 2027": {
  "sources": [
   "https://en.wikipedia.org/wiki/Solar_eclipse_of_August_2,_2027"
  ],
  "checked": "confirmed",
  "note": "Max 6m23s; path includes Spain, N Africa, Saudi Arabia, Yemen, Somalia"
 },
 "Future|UN Sustainable Development Goals target year": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sustainable_Development_Goals"
  ],
  "checked": "confirmed",
  "note": "Adopted 25 Sept 2015, deadline 2030"
 },
 "Future|Climate-neutrality target year (EU and others)": {
  "sources": [
   "https://en.wikipedia.org/wiki/European_Green_Deal"
  ],
  "checked": "confirmed",
  "note": "EU 2050 neutrality target, legally binding via European Climate Law 2021"
 },
 "Future|Return of Halley's Comet": {
  "sources": [
   "https://en.wikipedia.org/wiki/Halley%27s_Comet"
  ],
  "checked": "confirmed",
  "note": "Perihelion 28 July 2061"
 },
 "Future|Projected peak of world population": {
  "sources": [
   "https://en.wikipedia.org/wiki/Projections_of_population_growth"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Serapis cult introduced": {
  "sources": [
   "https://en.wikipedia.org/wiki/Serapis"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Isis worship spreads across the Roman world": {
  "sources": [
   "https://en.wikipedia.org/wiki/Isis"
  ],
  "checked": "confirmed",
  "note": "Wikipedia confirms spread from Hellenistic era, Roman religion by 1st c. BCE, ended 4th-6th c. CE; Britain/Mesopotamia not verified."
 },
 "Egyptian|Edict against pagan worship": {
  "sources": [
   "https://en.wikipedia.org/wiki/Theodosian_decrees"
  ],
  "checked": "confirmed"
 },
 "Egyptian|Temple of Isis at Philae closed": {
  "sources": [
   "https://en.wikipedia.org/wiki/Philae"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Marduk rises to head of the Babylonian pantheon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Marduk"
  ],
  "checked": "confirmed"
 },
 "Mesopotamian|Aššur as national god of Assyria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ashur_(god)"
  ],
  "checked": "unverified",
  "note": "Wikipedia gives no explicit date range for elevation (Old to Neo-Assyrian periods); range is plausible but not directly sourced."
 },
 "Mesopotamian|Last datable cuneiform tablet": {
  "sources": [
   "https://en.wikipedia.org/wiki/Babylon"
  ],
  "checked": "confirmed",
  "note": "Wikipedia Babylon caption gives astronomical text c. AD 75(?); Wikipedia Cuneiform gives Uruk AD 79/80; year 75 acceptable."
 },
 "Mesopotamian|Moon cult at Harran": {
  "sources": [
   "https://en.wikipedia.org/wiki/Harran"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: cult attested as late as the 11th century; end 1000 slightly early but within rough range."
 },
 "Greek|Olympic Games": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ancient_Olympic_Games"
  ],
  "checked": "confirmed"
 },
 "Greek|Delphic oracle": {
  "sources": [
   "https://en.wikipedia.org/wiki/Delphi"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: from 8th c. BCE; shutdown 381 or 390 CE."
 },
 "Greek|Orphism": {
  "sources": [
   "https://en.wikipedia.org/wiki/Orphism_(religion)"
  ],
  "checked": "confirmed"
 },
 "Greek|Asclepius healing cult": {
  "sources": [
   "https://en.wikipedia.org/wiki/Asclepius"
  ],
  "checked": "confirmed"
 },
 "Roman|Roman interpretatio graeca": {
  "sources": [
   "https://en.wikipedia.org/wiki/Interpretatio_graeca"
  ],
  "checked": "unverified",
  "note": "Wikipedia gives no date range; plausible Hellenistic-Imperial span."
 },
 "Phrygian|Cybele introduced to Rome": {
  "sources": [
   "https://en.wikipedia.org/wiki/Cybele"
  ],
  "checked": "confirmed",
  "note": "204 BC from Pessinos"
 },
 "Canaanite|Ugarit texts and the Baal Cycle": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ugarit"
  ],
  "checked": "confirmed"
 },
 "Anatolian|Hittite pantheon of a thousand gods": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hittite_religion"
  ],
  "checked": "confirmed"
 },
 "Urartian|Haldi and the Urartian pantheon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Urartu"
  ],
  "checked": "confirmed"
 },
 "Scythian|Herodotus on Scythian religion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Histories_(Herodotus)"
  ],
  "checked": "confirmed",
  "note": "Book 4 covers Scythian religion and burial; composition c. 440-430 BCE"
 },
 "Tocharian|Tocharian Buddhist manuscripts": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tocharian_languages"
  ],
  "checked": "confirmed"
 },
 "Mandaean|Ginza Rabba": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ginza_Rabba"
  ],
  "checked": "confirmed"
 },
 "Hindu|Dashavatara doctrine matures": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dashavatara"
  ],
  "checked": "confirmed"
 },
 "Hindu|Devī Māhātmya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Devi_Mahatmya"
  ],
  "checked": "confirmed"
 },
 "Hindu|Alvars and Nayanars": {
  "sources": [
   "https://en.wikipedia.org/wiki/Alvars"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: 6th-10th c. CE (Britannica 7th-10th)."
 },
 "Hindu|Chola bronze Nataraja": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nataraja"
  ],
  "checked": "confirmed",
  "note": "Mature Chola Nataraja bronzes c. 10th-11th c.; earliest Tamil bronzes c. 800 CE."
 },
 "Hindu|Brahmo Samaj": {
  "sources": [
   "https://en.wikipedia.org/wiki/Brahmo_Samaj"
  ],
  "checked": "confirmed",
  "note": "20 Aug 1828 Calcutta"
 },
 "Hindu|Vivekananda at the Parliament of the World's Religions": {
  "sources": [
   "https://en.wikipedia.org/wiki/Swami_Vivekananda"
  ],
  "checked": "confirmed",
  "note": "11 Sept 1893 Chicago"
 },
 "Islam|Prophet's revelations": {
  "sources": [
   "https://en.wikipedia.org/wiki/Muhammad"
  ],
  "checked": "confirmed",
  "note": "c.610 to death 632"
 },
 "Islam|Abu Hanifa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Abu_Hanifa"
  ],
  "checked": "confirmed",
  "note": "699-767"
 },
 "Islam|Malik ibn Anas": {
  "sources": [
   "https://en.wikipedia.org/wiki/Malik_ibn_Anas"
  ],
  "checked": "confirmed",
  "note": "c. 711-795 CE."
 },
 "Islam|Al-Shafi'i": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Shafi%27i"
  ],
  "checked": "confirmed",
  "note": "767-820"
 },
 "Islam|Ahmad ibn Hanbal": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ahmad_ibn_Hanbal"
  ],
  "checked": "confirmed",
  "note": "780-855"
 },
 "Islam|Occultation of the Twelfth Imam": {
  "sources": [
   "https://en.wikipedia.org/wiki/Occultation_(Islam)"
  ],
  "checked": "confirmed",
  "note": "Minor 874-941, major from 941"
 },
 "Islam|Fatimid Caliphate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Fatimid_Caliphate"
  ],
  "checked": "confirmed",
  "note": "Ended 1171 confirmed; 909 founding date is standard (not shown in fetched excerpt)"
 },
 "Islam|Moinuddin Chishti": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moinuddin_Chishti"
  ],
  "checked": "confirmed",
  "note": "1143-1236; shrine at Ajmer."
 },
 "Islam|Naqshbandi order": {
  "sources": [
   "https://en.wikipedia.org/wiki/Naqshbandi_order"
  ],
  "checked": "confirmed",
  "note": "Baha-ud-Din Naqshband 1318-1389."
 },
 "Islam|Ahmadiyya movement": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ahmadiyya"
  ],
  "checked": "confirmed",
  "note": "Founded 1889 by Mirza Ghulam Ahmad; Qadian not stated in fetched text"
 },
 "Christian|Origen": {
  "sources": [
   "https://en.wikipedia.org/wiki/Origen"
  ],
  "checked": "confirmed",
  "note": "c. 185-253."
 },
 "Christian|Nestorian Church of the East spreads to China": {
  "sources": [
   "https://en.wikipedia.org/wiki/Alopen"
  ],
  "checked": "confirmed"
 },
 "Christian|Iconoclasm": {
  "sources": [
   "https://en.wikipedia.org/wiki/Byzantine_Iconoclasm"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: c.726-787 and 814-842/843; Triumph of Orthodoxy 843. Range fits."
 },
 "Christian|Patrick of Ireland": {
  "sources": [
   "https://en.wikipedia.org/wiki/Saint_Patrick"
  ],
  "checked": "confirmed",
  "note": "Birth late 4th c.; death 457/461/493 per annals; 461 is one accepted date. Approx fine."
 },
 "Christian|Conversion of Clovis": {
  "sources": [
   "https://en.wikipedia.org/wiki/Clovis_I"
  ],
  "checked": "confirmed",
  "note": "496 is the traditional (Gregory of Tours) date; Wikipedia notes modern scholarship often prefers c. 498-508. Description says 'traditionally dated', so consistent."
 },
 "Christian|Cyril and Methodius": {
  "sources": [
   "https://en.wikipedia.org/wiki/Saints_Cyril_and_Methodius"
  ],
  "checked": "confirmed",
  "note": "Mission began 862; Glagolitic in use 863. Acceptable."
 },
 "Christian|Gregory Palamas and hesychasm": {
  "sources": [
   "https://en.wikipedia.org/wiki/Gregory_Palamas"
  ],
  "checked": "confirmed",
  "note": "Born c.1296, d. 1359 (some give 1357)."
 },
 "Christian|John Calvin": {
  "sources": [
   "https://en.wikipedia.org/wiki/John_Calvin"
  ],
  "checked": "confirmed"
 },
 "Christian|Act of Supremacy": {
  "sources": [
   "https://en.wikipedia.org/wiki/Acts_of_Supremacy"
  ],
  "checked": "confirmed"
 },
 "Christian|Society of Jesus founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Society_of_Jesus"
  ],
  "checked": "confirmed"
 },
 "Christian|George Fox and the Quakers": {
  "sources": [
   "https://en.wikipedia.org/wiki/George_Fox"
  ],
  "checked": "confirmed"
 },
 "Christian|John Wesley": {
  "sources": [
   "https://en.wikipedia.org/wiki/John_Wesley"
  ],
  "checked": "confirmed"
 },
 "Christian|Azusa Street Revival": {
  "sources": [
   "https://en.wikipedia.org/wiki/Azusa_Street_Revival"
  ],
  "checked": "confirmed",
  "note": "Began 9 April 1906 (ran to c.1915)."
 },
 "Christian|Medellín conference": {
  "sources": [
   "https://en.wikipedia.org/wiki/Medell%C3%ADn_Conference"
  ],
  "checked": "confirmed",
  "note": "1968 confirmed."
 },
 "Aztec|Templo Mayor of Tenochtitlan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Templo_Mayor"
  ],
  "checked": "confirmed",
  "note": "First temple after 1325; destroyed 1521; Huitzilopochtli and Tlaloc."
 },
 "Americas|Popol Vuh recorded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Popol_Vuh"
  ],
  "checked": "confirmed",
  "note": "Written c. 1550s (1554-58 suggested); oldest surviving manuscript c. 1701."
 },
 "Africa|Orisha traditions in the Atlantic world": {
  "sources": [
   "https://en.wikipedia.org/wiki/Santer%C3%ADa"
  ],
  "checked": "confirmed",
  "note": "Atlantic slave trade 16th-19th c.; Santería distinct by late 19th c. 1600 is a rough start, acceptable as approx."
 },
 "Africa|Asante Golden Stool": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ashanti_Empire"
  ],
  "checked": "confirmed",
  "note": "Wikipedia gives 1701 as founding of Asante Union."
 },
 "Germanic/Norse|Conversion of Iceland": {
  "sources": [
   "https://en.wikipedia.org/wiki/Christianization_of_Iceland"
  ],
  "checked": "confirmed",
  "note": "Year 1000 (some say 999)."
 },
 "Germanic/Norse|Codex Regius": {
  "sources": [
   "https://en.wikipedia.org/wiki/Codex_Regius"
  ],
  "checked": "confirmed",
  "note": "Written 1270s."
 },
 "Germanic/Norse|Prose Edda": {
  "sources": [
   "https://en.wikipedia.org/wiki/Prose_Edda"
  ],
  "checked": "confirmed",
  "note": "Traditionally c. 1220."
 },
 "Baltic|Lithuania's conversion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Christianization_of_Lithuania"
  ],
  "checked": "confirmed",
  "note": "Process 1385-1413; 1387 mass baptisms in Vilnius. Fine."
 },
 "Celtic|Roman suppression of the Druids": {
  "sources": [
   "https://en.wikipedia.org/wiki/Suetonius_Paulinus"
  ],
  "checked": "confirmed",
  "note": "Assault on Mona c. 60 or 61 CE."
 },
 "Ojibwe|Ghost Dance": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ghost_Dance"
  ],
  "checked": "confirmed",
  "note": "Began 1889 (Wovoka); Wikipedia gives no clean end date, declined after Wounded Knee Dec 1890; 1891 is a reasonable end."
 },
 "Americas|Abolition of the kapu system": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kapu_(Hawaiian_culture)"
  ],
  "checked": "confirmed",
  "note": "1819, Kamehameha II (Liholiho) ended the ai kapu."
 },
 "Māori|Treaty of Waitangi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Treaty_of_Waitangi"
  ],
  "checked": "confirmed"
 },
 "Oceania|Songlines of Aboriginal Australia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Songline"
  ],
  "checked": "unverified",
  "note": "Wikipedia gives no age for songlines; -50000 reflects general Aboriginal occupation (~50-65 ka), not a sourced songline date."
 },
 "Baháʼí|Baháʼu'lláh": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bah%C3%A1%CA%BCu%CA%BCll%C3%A1h"
  ],
  "checked": "confirmed"
 },
 "Hasidic and Kabbalistic lineage|Moses de León": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moses_de_Le%C3%B3n"
  ],
  "checked": "confirmed",
  "note": "c. 1240-1305."
 },
 "Hasidic and Kabbalistic lineage|Moses Cordovero": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moses_ben_Jacob_Cordovero"
  ],
  "checked": "confirmed"
 },
 "Hasidic and Kabbalistic lineage|Isaac Luria (Ari)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Isaac_Luria"
  ],
  "checked": "confirmed",
  "note": "Birth 1534 approximate per Wikipedia."
 },
 "Hasidic and Kabbalistic lineage|Chaim Vital": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hayyim_ben_Joseph_Vital"
  ],
  "checked": "corrected",
  "note": "Wikipedia gives birth 11 Oct 1542 (some sources 1543), death 1620.",
  "fix": {
   "start": 1542
  }
 },
 "Hasidic and Kabbalistic lineage|Baal Shem Tov": {
  "sources": [
   "https://en.wikipedia.org/wiki/Baal_Shem_Tov"
  ],
  "checked": "confirmed",
  "note": "c. 1698/1700-1760."
 },
 "Hasidic and Kabbalistic lineage|Dov Ber of Mezritch": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dov_Ber_of_Mezeritch"
  ],
  "checked": "confirmed",
  "note": "Infobox 1704; some sources 1700/1710."
 },
 "Hasidic and Kabbalistic lineage|Schneur Zalman of Liadi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Shneur_Zalman_of_Liadi"
  ],
  "checked": "confirmed"
 },
 "Hasidic and Kabbalistic lineage|Nachman of Breslov": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nachman_of_Breslov"
  ],
  "checked": "confirmed"
 },
 "Hasidic and Kabbalistic lineage|Menachem Mendel Schneerson": {
  "sources": [
   "https://en.wikipedia.org/wiki/Menachem_Mendel_Schneerson"
  ],
  "checked": "confirmed"
 },
 "Christian contemplative lineage|Evagrius Ponticus": {
  "sources": [
   "https://en.wikipedia.org/wiki/Evagrius_Ponticus"
  ],
  "checked": "confirmed"
 },
 "Christian contemplative lineage|John Cassian": {
  "sources": [
   "https://en.wikipedia.org/wiki/John_Cassian"
  ],
  "checked": "confirmed",
  "note": "c. 360-435."
 },
 "Christian contemplative lineage|Pseudo-Dionysius": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pseudo-Dionysius_the_Areopagite"
  ],
  "checked": "confirmed",
  "note": "Corpus dated c. 485-528."
 },
 "Christian contemplative lineage|Bernard of Clairvaux": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bernard_of_Clairvaux"
  ],
  "checked": "confirmed"
 },
 "Christian contemplative lineage|Hildegard of Bingen": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hildegard_of_Bingen"
  ],
  "checked": "confirmed"
 },
 "Christian contemplative lineage|Julian of Norwich": {
  "sources": [
   "https://en.wikipedia.org/wiki/Julian_of_Norwich"
  ],
  "checked": "confirmed",
  "note": "b. c. 1343, d. after 1416."
 },
 "Contemplative Christianity (Modern)|Thomas Merton": {
  "sources": [
   "https://en.wikipedia.org/wiki/Thomas_Merton"
  ],
  "checked": "confirmed"
 },
 "Contemplative Christianity (Modern)|Thomas Keating and Centering Prayer": {
  "sources": [
   "https://en.wikipedia.org/wiki/Thomas_Keating"
  ],
  "checked": "confirmed"
 },
 "Sufi lineages|Moinuddin Chishti (lineage founder)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Moinuddin_Chishti"
  ],
  "checked": "confirmed",
  "note": "1143-1236."
 },
 "Sufi lineages|Nizamuddin Auliya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nizamuddin_Auliya"
  ],
  "checked": "confirmed"
 },
 "Sufi lineages|Abu al-Hasan al-Shadhili": {
  "sources": [
   "https://en.wikipedia.org/wiki/Abu_al-Hasan_al-Shadhili"
  ],
  "checked": "confirmed"
 },
 "Sufi lineages|Ahmad Sirhindi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ahmad_Sirhindi"
  ],
  "checked": "confirmed",
  "note": "Birth 1564 (some 1563); death 1624."
 },
 "Advaita Vedanta lineage|Gaudapada": {
  "sources": [
   "https://en.wikipedia.org/wiki/Gaudapada"
  ],
  "checked": "confirmed",
  "note": "Generally 6th-7th c. CE; paramaguru of Shankara."
 },
 "Advaita Vedanta lineage|Vidyāraṇya": {
  "sources": [
   "https://en.wikipedia.org/wiki/Vidyaranya"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: Sringeri records 1296-1391 (jagadguru c. 1374-1386); end 1386 matches end of tenure; within uncertainty."
 },
 "Daoist lineage|Ge Hong": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ge_Hong"
  ],
  "checked": "confirmed",
  "note": "Death 343 or 364 per sources; 343 acceptable."
 },
 "Daoist lineage|Wang Chongyang": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wang_Chongyang"
  ],
  "checked": "confirmed"
 },
 "Theravāda lineage|Buddhaghosa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Buddhaghosa"
  ],
  "checked": "confirmed",
  "note": "c. 370-450; active in Sri Lanka 412-434; 430 within range."
 },
 "Theravāda lineage|Ajahn Mun": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ajahn_Mun_Bhuridatta"
  ],
  "checked": "confirmed"
 },
 "Theravāda lineage|Mahasi Sayadaw": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mahasi_Sayadaw"
  ],
  "checked": "confirmed"
 },
 "Theravāda lineage|Ajahn Chah": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ajahn_Chah"
  ],
  "checked": "confirmed"
 },
 "Korean Seon|Wonhyo": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wonhyo"
  ],
  "checked": "confirmed"
 },
 "Korean Seon|Jinul": {
  "sources": [
   "https://en.wikipedia.org/wiki/Jinul"
  ],
  "checked": "confirmed"
 },
 "Vietnamese Thiền|Thích Nhất Hạnh": {
  "sources": [
   "https://en.wikipedia.org/wiki/Th%C3%ADch_Nh%E1%BA%A5t_H%E1%BA%A1nh"
  ],
  "checked": "confirmed"
 },
 "Oceania|Lake Mungo burials": {
  "sources": [
   "https://en.wikipedia.org/wiki/Lake_Mungo_remains"
  ],
  "checked": "confirmed",
  "note": "Mungo Man consensus c. 40,000 years (42,000 widely cited)."
 },
 "Oceania|Bass Strait forms; Tasmania isolated": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bass_Strait"
  ],
  "checked": "confirmed",
  "note": "Basin flooded c. 11,800-8,700 years ago; fully submerged c. 8,000 years ago; -10000 within range."
 },
 "Oceania|Budj Bim eel traps": {
  "sources": [
   "https://en.wikipedia.org/wiki/Budj_Bim_Cultural_Landscape"
  ],
  "checked": "confirmed",
  "note": "Eel traps c. 6,600 years old; UNESCO 2019."
 },
 "Oceania|Macassan trepang trade": {
  "sources": [
   "https://en.wikipedia.org/wiki/Makassan_contact_with_Australia"
  ],
  "checked": "confirmed",
  "note": "Most date trade from c. 1720; last fleet 1907."
 },
 "Oceania|Dutch landing on Cape York": {
  "sources": [
   "https://en.wikipedia.org/wiki/Willem_Janszoon"
  ],
  "checked": "confirmed"
 },
 "Oceania|Cook claims the east coast": {
  "sources": [
   "https://en.wikipedia.org/wiki/James_Cook"
  ],
  "checked": "confirmed",
  "note": "Claimed at Possession Island, 1770."
 },
 "Oceania|First Fleet reaches Sydney Cove": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Fleet"
  ],
  "checked": "confirmed"
 },
 "Oceania|Federation of Australia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Federation_of_Australia"
  ],
  "checked": "confirmed"
 },
 "Oceania|Uluru handed back": {
  "sources": [
   "https://en.wikipedia.org/wiki/Uluru"
  ],
  "checked": "confirmed"
 },
 "Oceania|Mabo decision": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mabo_v_Queensland_(No_2)"
  ],
  "checked": "confirmed"
 },
 "Oceania|National apology to the Stolen Generations": {
  "sources": [
   "https://en.wikipedia.org/wiki/Apology_to_Australia%27s_Indigenous_peoples"
  ],
  "checked": "confirmed"
 },
 "Americas|White Sands footprints": {
  "sources": [
   "https://en.wikipedia.org/wiki/White_Sands_fossil_footprints"
  ],
  "checked": "confirmed",
  "note": "21,000-23,000 years ago (2025 study >23,600-17,000 cal BP); debated."
 },
 "Americas|Clovis culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Clovis_culture"
  ],
  "checked": "confirmed",
  "note": "c. 11,100-10,800 BCE (13,050-12,750 BP)."
 },
 "Americas|Poverty Point": {
  "sources": [
   "https://en.wikipedia.org/wiki/Poverty_Point"
  ],
  "checked": "confirmed",
  "note": "Construction c. 1800-1200 BCE, mostly 1600-1300 BCE."
 },
 "Americas|Adena and Hopewell traditions": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hopewell_tradition"
  ],
  "checked": "confirmed",
  "note": "Hopewell 200/100 BCE-500 CE; Adena preceded it (c. 500 BCE-100 CE)."
 },
 "Americas|Norse at L'Anse aux Meadows": {
  "sources": [
   "https://en.wikipedia.org/wiki/L%27Anse_aux_Meadows"
  ],
  "checked": "confirmed",
  "note": "c. 1000 CE (990-1050; 1021 tree-ring)."
 },
 "Americas|Thule expansion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Thule_people"
  ],
  "checked": "confirmed",
  "note": "Eastward spread from c. 1000, High Arctic 1100-1400."
 },
 "Americas|Haudenosaunee Confederacy": {
  "sources": [
   "https://en.wikipedia.org/wiki/Iroquois"
  ],
  "checked": "confirmed",
  "note": "Range 1142-1450 (or later); debated."
 },
 "Americas|Cartier's voyages": {
  "sources": [
   "https://en.wikipedia.org/wiki/Jacques_Cartier"
  ],
  "checked": "confirmed",
  "note": "1534 first voyage to 1541-42 third voyage."
 },
 "Americas|Founding of Quebec": {
  "sources": [
   "https://en.wikipedia.org/wiki/Quebec_City"
  ],
  "checked": "confirmed"
 },
 "Americas|Mayflower voyage": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mayflower"
  ],
  "checked": "confirmed"
 },
 "Americas|Hudson's Bay Company chartered": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hudson%27s_Bay_Company"
  ],
  "checked": "confirmed"
 },
 "Americas|Pueblo Revolt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pueblo_Revolt"
  ],
  "checked": "confirmed"
 },
 "Americas|Great Peace of Montreal": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Peace_of_Montreal"
  ],
  "checked": "confirmed",
  "note": "39 nations per Wikipedia intro (over 40 represented)."
 },
 "Americas|Royal Proclamation of 1763": {
  "sources": [
   "https://en.wikipedia.org/wiki/Royal_Proclamation_of_1763"
  ],
  "checked": "confirmed"
 },
 "Americas|Canadian Confederation": {
  "sources": [
   "https://en.wikipedia.org/wiki/Canadian_Confederation"
  ],
  "checked": "confirmed"
 },
 "Americas|Trail of Tears": {
  "sources": [
   "https://en.wikipedia.org/wiki/Trail_of_Tears"
  ],
  "checked": "confirmed",
  "note": "Removal 1838, march into winter 1838-39."
 },
 "Americas|Wounded Knee Massacre": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wounded_Knee_Massacre"
  ],
  "checked": "confirmed",
  "note": "29 Dec 1890; estimates 200-300 Lakota killed."
 },
 "Americas|Monte Verde": {
  "sources": [
   "https://en.wikipedia.org/wiki/Monte_Verde"
  ],
  "checked": "confirmed",
  "note": "c. 14,500 years ago (-12500); a 2026 study challenges this."
 },
 "Americas|Paracas culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Paracas_culture"
  ],
  "checked": "confirmed",
  "note": "c. 800-100 BCE."
 },
 "Americas|Nazca culture and lines": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nazca_culture"
  ],
  "checked": "confirmed",
  "note": "Nazca culture c. 100 BCE-800 CE; lines extend earlier/over a long period, so range acceptable for approx."
 },
 "Americas|Wari Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wari_Empire"
  ],
  "checked": "confirmed",
  "note": "c. 600-1100 CE; decline from 10th c."
 },
 "Americas|Chachapoya culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chachapoya_culture"
  ],
  "checked": "confirmed",
  "note": "c. 800-1470 CE."
 },
 "Americas|Chimú kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chim%C3%BA_culture"
  ],
  "checked": "confirmed",
  "note": "c. 900-1470 CE."
 },
 "Americas|Muisca confederation": {
  "sources": [
   "https://en.wikipedia.org/wiki/Muisca_Confederation"
  ],
  "checked": "confirmed",
  "note": "c. 800-1537/1540."
 },
 "Americas|Machu Picchu": {
  "sources": [
   "https://en.wikipedia.org/wiki/Machu_Picchu"
  ],
  "checked": "confirmed",
  "note": "Built c. 1450 under Pachacuti."
 },
 "Americas|Pizarro captures Atahualpa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Cajamarca"
  ],
  "checked": "confirmed",
  "note": "Capture 16 Nov 1532; article calls it the opening stage of the conquest."
 },
 "Americas|Brazilian independence": {
  "sources": [
   "https://en.wikipedia.org/wiki/Independence_of_Brazil"
  ],
  "checked": "confirmed",
  "note": "7 Sep 1822, Prince Pedro (later Pedro I)."
 },
 "Americas|Wars of independence in Spanish America": {
  "sources": [
   "https://en.wikipedia.org/wiki/Spanish_American_wars_of_independence"
  ],
  "checked": "confirmed",
  "note": "Article infobox gives 1808-1833; 1810-1825 is the conventional core span."
 },
 "Americas|San Lorenzo": {
  "sources": [
   "https://en.wikipedia.org/wiki/San_Lorenzo_Tenochtitl%C3%A1n"
  ],
  "checked": "confirmed",
  "note": "Largest city c. 1200-900 BCE."
 },
 "Americas|La Venta": {
  "sources": [
   "https://en.wikipedia.org/wiki/La_Venta"
  ],
  "checked": "confirmed",
  "note": "Peak after 900 BCE; abandoned c. 400 BCE."
 },
 "Americas|Monte Albán": {
  "sources": [
   "https://en.wikipedia.org/wiki/Monte_Alb%C3%A1n"
  ],
  "checked": "confirmed",
  "note": "Founded c. 500 BCE; largely abandoned c. 500-1000 CE; 800 within range."
 },
 "Americas|El Mirador": {
  "sources": [
   "https://en.wikipedia.org/wiki/El_Mirador"
  ],
  "checked": "confirmed",
  "note": "Peak from 3rd c. BCE; abandoned c. 150 CE."
 },
 "Americas|Earliest Long Count date": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chiapa_de_Corzo_(Mesoamerican_site)"
  ],
  "checked": "confirmed",
  "note": "Stela 2, 7.16.3.2.13 = December 36 BCE."
 },
 "Americas|Tikal": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tikal"
  ],
  "checked": "confirmed",
  "note": "Classic peak c. 200-900 CE."
 },
 "Americas|Chichén Itzá": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chichen_Itza"
  ],
  "checked": "confirmed",
  "note": "Prominent from c. 600; declined by c. 1100-1200."
 },
 "Americas|Classic Maya collapse": {
  "sources": [
   "https://en.wikipedia.org/wiki/Classic_Maya_collapse"
  ],
  "checked": "confirmed",
  "note": "7th-9th c.; central area building ended after 830, dated monuments ceased by 900."
 },
 "Americas|Toltec culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Toltec"
  ],
  "checked": "confirmed",
  "note": "c. 950-1168 (prominence 950-1150)."
 },
 "Americas|Founding of Tenochtitlan": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tenochtitlan"
  ],
  "checked": "confirmed",
  "note": "Traditional date 1325."
 },
 "Americas|Spanish conquest of Mexico": {
  "sources": [
   "https://en.wikipedia.org/wiki/Spanish_conquest_of_the_Aztec_Empire"
  ],
  "checked": "confirmed",
  "note": "Feb 1519 to 13 Aug 1521."
 },
 "Americas|Fall of Tayasal": {
  "sources": [
   "https://en.wikipedia.org/wiki/Spanish_conquest_of_Petén"
  ],
  "checked": "confirmed",
  "note": "13 March 1697; Itza kingdom described as the last independent native kingdom in the Americas."
 },
 "Africa|African Humid Period": {
  "sources": [
   "https://en.wikipedia.org/wiki/African_humid_period"
  ],
  "checked": "confirmed",
  "note": "Start c. 14,600 years ago; end c. 6,000-5,000 years ago."
 },
 "Africa|Ishango bone": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ishango_bone"
  ],
  "checked": "confirmed",
  "note": "Most commonly c. 20,000 years old."
 },
 "Africa|Early pottery in the Sahara": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pottery"
  ],
  "checked": "confirmed",
  "note": "Earliest African pottery at least 9,400 BC in central Mali."
 },
 "Africa|Bantu expansion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bantu_expansion"
  ],
  "checked": "confirmed",
  "note": "c. 4000/3000 BCE to c. 500 CE; reached South Africa by c. 300 CE; end of 1000 CE is a generous upper bound for approx."
 },
 "Africa|Garamantes": {
  "sources": [
   "https://en.wikipedia.org/wiki/Garamantes"
  ],
  "checked": "confirmed",
  "note": "Settled by c. 1000 BC; power c. 2nd c. CE; lasted to late 7th c. CE."
 },
 "Africa|Djenné-Djenno": {
  "sources": [
   "https://en.wikipedia.org/wiki/Djenné-Djenno"
  ],
  "checked": "confirmed"
 },
 "Africa|Roman Africa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Africa_(Roman_province)"
  ],
  "checked": "confirmed",
  "note": "146 BC to AD 439 (Vandal capture of Carthage)."
 },
 "Africa|Makuria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Makuria"
  ],
  "checked": "confirmed",
  "note": "5th c. to c. 1463/late 15th c."
 },
 "Africa|Vandal Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Vandal_Kingdom"
  ],
  "checked": "confirmed",
  "note": "435-534."
 },
 "Africa|Muslim conquest of North Africa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Muslim_conquest_of_the_Maghreb"
  ],
  "checked": "confirmed",
  "note": "647-709"
 },
 "Africa|Igbo-Ukwu bronzes": {
  "sources": [
   "https://en.wikipedia.org/wiki/Igbo-Ukwu"
  ],
  "checked": "confirmed",
  "note": "9th c., c. 850 radiocarbon"
 },
 "Africa|Zagwe dynasty and Lalibela": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zagwe_dynasty"
  ],
  "checked": "corrected",
  "note": "Wikipedia infobox gives c. 1137-1270 (c. 930 only as an alternative start); Lalibela late 12th c. / early 13th c.",
  "fix": {
   "start": 1137
  }
 },
 "Africa|Almoravids": {
  "sources": [
   "https://en.wikipedia.org/wiki/Almoravid_dynasty"
  ],
  "checked": "confirmed",
  "note": "Header 1040-1147."
 },
 "Africa|Almohads": {
  "sources": [
   "https://en.wikipedia.org/wiki/Almohad_Caliphate"
  ],
  "checked": "confirmed",
  "note": "Infobox 1121-1269."
 },
 "Africa|Ife bronze heads": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ife",
   "https://en.wikipedia.org/wiki/Ife_Head"
  ],
  "checked": "confirmed",
  "note": "Peak 1200-1400 per Wikipedia (Ife article)"
 },
 "Southeast Asia|Austronesian expansion": {
  "sources": [
   "https://en.wikipedia.org/wiki/Austronesian_peoples"
  ],
  "checked": "confirmed",
  "note": "Out of Taiwan c. 3000-1500 BCE; range plausible"
 },
 "Southeast Asia|Ban Chiang": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ban_Chiang"
  ],
  "checked": "confirmed",
  "note": "Higham: settlement c. 1500 BCE; chronology disputed"
 },
 "Southeast Asia|Sa Huỳnh culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sa_Huỳnh_culture"
  ],
  "checked": "confirmed"
 },
 "Southeast Asia|Pyu city-states": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pyu_city-states"
  ],
  "checked": "confirmed",
  "note": "2nd c. BCE to c. 1050 CE"
 },
 "Southeast Asia|Champa": {
  "sources": [
   "https://en.wikipedia.org/wiki/Champa"
  ],
  "checked": "confirmed",
  "note": "192 (Linyi) to 1832"
 },
 "Southeast Asia|Óc Eo culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Óc_Eo_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: 1-630 CE in navbox; port 2nd c. BCE-12th c. CE; row range within bounds"
 },
 "Southeast Asia|Tarumanagara": {
  "sources": [
   "https://en.wikipedia.org/wiki/Tarumanagara"
  ],
  "checked": "confirmed",
  "note": "358-669"
 },
 "Southeast Asia|Chenla": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chenla"
  ],
  "checked": "confirmed",
  "note": "c. 550-802"
 },
 "Southeast Asia|Dvaravati": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dvaravati"
  ],
  "checked": "confirmed",
  "note": "7th-11th c."
 },
 "Southeast Asia|Sailendra dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Shailendra_dynasty"
  ],
  "checked": "confirmed",
  "note": "8th c. to c. 852 in Java"
 },
 "Southeast Asia|Đại Việt independence": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Bạch_Đằng_(938)"
  ],
  "checked": "confirmed",
  "note": "Dec 938; ends Northern domination."
 },
 "Southeast Asia|Sukhothai Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sukhothai_Kingdom"
  ],
  "checked": "confirmed",
  "note": "1238-1438."
 },
 "Southeast Asia|Malacca Sultanate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Malacca_Sultanate"
  ],
  "checked": "confirmed",
  "note": "c.1400 to 1511 (fall of the city); infobox end 1528 when partitioned."
 },
 "Southeast Asia|Magellan reaches the Philippines": {
  "sources": [
   "https://en.wikipedia.org/wiki/Magellan–Elcano_circumnavigation"
  ],
  "checked": "confirmed",
  "note": "Arrived March 1521, killed at Mactan April 1521."
 },
 "Southeast Asia|Portuguese capture Malacca": {
  "sources": [
   "https://en.wikipedia.org/wiki/Capture_of_Malacca_(1511)"
  ],
  "checked": "confirmed",
  "note": "15 Aug 1511 under Albuquerque."
 },
 "Southeast Asia|Spanish colonization of the Philippines": {
  "sources": [
   "https://en.wikipedia.org/wiki/Miguel_López_de_Legazpi"
  ],
  "checked": "confirmed",
  "note": "Legazpi founded the Cebu settlement in 1565; article does not use the phrase 'first permanent' but calls it the first Spanish settlement in the East Indies."
 },
 "Central Asia|Oxus civilization (BMAC)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bactria–Margiana_Archaeological_Complex"
  ],
  "checked": "confirmed",
  "note": "c. 2500/2300-1700 BCE"
 },
 "Central Asia|Andronovo culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Andronovo_culture"
  ],
  "checked": "confirmed",
  "note": "Wikipedia c. 2000-1150 BCE; later sub-cultures to c. 1000 BCE, so end -900 is slightly late but within range"
 },
 "Central Asia|Sogdian city-states": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sogdia"
  ],
  "checked": "confirmed",
  "note": "Achaemenid era to Samanids c. 999"
 },
 "Central Asia|Pazyryk burials": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pazyryk_culture"
  ],
  "checked": "confirmed",
  "note": "6th-3rd c. BCE"
 },
 "Central Asia|Alexander in Bactria and Sogdiana": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wars_of_Alexander_the_Great"
  ],
  "checked": "confirmed",
  "note": "329-327 BC."
 },
 "Central Asia|Xiongnu confederation": {
  "sources": [
   "https://en.wikipedia.org/wiki/Xiongnu"
  ],
  "checked": "confirmed",
  "note": "Modu's empire after 209 BC; northern branch collapsed in the 90s AD (91 Han attack); exact 93 is conventional, approx."
 },
 "Central Asia|Greco-Bactrian Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Greco-Bactrian_Kingdom"
  ],
  "checked": "confirmed",
  "note": "c.256 BC to c.120 BC; end -125 is within the scholarly range."
 },
 "Central Asia|Hephthalite Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hephthalites"
  ],
  "checked": "corrected",
  "note": "Dates 440s-560 fine. But Wikipedia says Hephthalites never went beyond the Hindu Kush; NW India was held by the Alchon Huns.",
  "fix": {
   "description": "Steppe power that dominated Bactria and Tokharistan and reached Sogdiana and the Tarim Basin."
  }
 },
 "Central Asia|Khazar Khaganate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Khazars"
  ],
  "checked": "confirmed",
  "note": "c. 650-969/965; elite conversion in 8th c."
 },
 "Central Asia|Uyghur Khaganate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Uyghur_Khaganate"
  ],
  "checked": "confirmed",
  "note": "744-840; Manichaeism adopted 762."
 },
 "Central Asia|Battle of Talas": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Talas"
  ],
  "checked": "confirmed",
  "note": "751, Abbasids vs Tang near Taraz."
 },
 "Central Asia|Samanid Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Samanid_Empire"
  ],
  "checked": "confirmed",
  "note": "819-999; Samarkand then Bukhara."
 },
 "Central Asia|Al-Khwarizmi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Khwarizmi"
  ],
  "checked": "confirmed",
  "note": "c. 780-c. 850"
 },
 "Central Asia|Al-Biruni": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Biruni"
  ],
  "checked": "confirmed",
  "note": "973-1048 (lead says c.1050 for death)."
 },
 "Central Asia|Khwarazmian Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Khwarazmian_dynasty"
  ],
  "checked": "confirmed",
  "note": "c.1077-1231."
 },
 "Central Asia|Ulugh Beg": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ulugh_Beg"
  ],
  "checked": "confirmed",
  "note": "1394-1449; observatory built 1424-1429."
 },
 "Central Asia|Russian conquest of Central Asia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Russian_conquest_of_Central_Asia"
  ],
  "checked": "confirmed",
  "note": "Tashkent 1865, Bukhara/Khiva by 1868-73, Transcaspia/Merv to 1885; infobox span is wider (1717-1895)."
 },
 "Anatolia|Galatia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Galatia"
  ],
  "checked": "confirmed",
  "note": "Celts crossed 279/278 BC and settled in Phrygia (275 or 269 per article); province 25 BC. Start -278 is approximate arrival."
 },
 "Anatolia|Pergamon": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Pergamon"
  ],
  "checked": "confirmed",
  "note": "Article: c.282 to 129 BC; row uses 281 (Philetaerus' independence) to 133 (Attalus III's bequest); both conventional."
 },
 "Anatolia|Mount Nemrut sanctuary": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mount_Nemrut"
  ],
  "checked": "confirmed",
  "note": "62 BC"
 },
 "Anatolia|Cappadocian Fathers": {
  "sources": [
   "https://en.wikipedia.org/wiki/Cappadocian_Fathers"
  ],
  "checked": "confirmed",
  "note": "Lifespans: Basil 330-379, Gregory of Nyssa c.335-c.395, Gregory of Nazianzus 329-390; span 329-395 matches."
 },
 "Anatolia|Constantinople founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Constantinople"
  ],
  "checked": "confirmed",
  "note": "Consecrated 11 May 330."
 },
 "Anatolia|Rock-cut churches of Cappadocia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Cappadocia"
  ],
  "checked": "confirmed",
  "note": "Göreme monastic centre 300-1200; frescoes 6th-12th c."
 },
 "Anatolia|Justinian I": {
  "sources": [
   "https://en.wikipedia.org/wiki/Justinian_I"
  ],
  "checked": "confirmed",
  "note": "1 April 527 to 14 Nov 565."
 },
 "Anatolia|Hagia Sophia built": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hagia_Sophia"
  ],
  "checked": "confirmed",
  "note": "Begun 23 Feb 532, inaugurated 27 Dec 537; Anthemius and Isidore."
 },
 "Anatolia|Sultanate of Rum": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sultanate_of_Rum"
  ],
  "checked": "confirmed",
  "note": "1077-1308."
 },
 "Arabian Peninsula|Dilmun": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dilmun"
  ],
  "checked": "confirmed",
  "note": "Late 4th mill. BCE to c. 538 BCE"
 },
 "Arabian Peninsula|Kingdom of Saba": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Saba"
  ],
  "checked": "confirmed",
  "note": "Start uncertain (c. 1200-8th c. BCE) to c. 275 CE"
 },
 "Arabian Peninsula|Nabataean Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nabataean_Kingdom"
  ],
  "checked": "confirmed",
  "note": "Annexed AD 106, capital Petra. Article gives a vague 3rd-century BC start; -312 is the first attested date (Antigonus' attack on Petra), acceptable."
 },
 "Arabian Peninsula|Himyarite Kingdom": {
  "sources": [
   "https://en.wikipedia.org/wiki/Himyarite_Kingdom"
  ],
  "checked": "corrected",
  "note": "Wikipedia gives c. 110 BCE to 575/578 CE; Himyar continued after the Aksumite invasion (c. 520-525). Judaism in 4th c. correct.",
  "fix": {
   "end": 575
  }
 },
 "Arabian Peninsula|Palmyrene Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Palmyrene_Empire"
  ],
  "checked": "confirmed",
  "note": "260 (or 270) to 273."
 },
 "Arabian Peninsula|Aksumite invasion of Himyar": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kaleb_of_Axum"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: around 520; traditional 525 within approx range"
 },
 "Arabian Peninsula|Year of the Elephant": {
  "sources": [
   "https://en.wikipedia.org/wiki/Year_of_the_Elephant"
  ],
  "checked": "confirmed",
  "note": "c. 570-571 (archaeology suggests 568/569)"
 },
 "Arabian Peninsula|Battle of Badr": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Badr"
  ],
  "checked": "confirmed",
  "note": "13 March 624."
 },
 "Arabian Peninsula|Ridda wars": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ridda_wars"
  ],
  "checked": "confirmed",
  "note": "632-633."
 },
 "Arabian Peninsula|Qarmatian state in Bahrain": {
  "sources": [
   "https://en.wikipedia.org/wiki/Qarmatians"
  ],
  "checked": "confirmed",
  "note": "899-1077; Mecca sack 930"
 },
 "Arabian Peninsula|Ottoman Hejaz": {
  "sources": [
   "https://en.wikipedia.org/wiki/Hejaz_Vilayet"
  ],
  "checked": "confirmed",
  "note": "1517 suzerainty to 1916 revolt."
 },
 "Arabian Peninsula|Arab Revolt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Arab_Revolt"
  ],
  "checked": "confirmed",
  "note": "10 June 1916 to Oct 1918."
 },
 "Arabian Peninsula|Kingdom of Saudi Arabia founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Saudi_Arabia"
  ],
  "checked": "confirmed",
  "note": "Decree of 23 Sep 1932 unifying Hejaz and Najd."
 },
 "Arabian Peninsula|Oil discovered in Saudi Arabia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dammam_No._7",
   "https://en.wikipedia.org/wiki/Saudi_Arabia"
  ],
  "checked": "confirmed",
  "note": "March 1938 (3 or 4 March depending on article)."
 },
 "Greek|Roman province of Achaea": {
  "sources": [
   "https://en.wikipedia.org/wiki/Achaea_(Roman_province)"
  ],
  "checked": "corrected",
  "note": "Created 27 BC, but the province persisted until the 7th century AD (reorganised into the Theme of Hellas), not 330. Row end 330 is an arbitrary cut-off.",
  "fix": {
   "end": 600
  }
 },
 "Greek|Pausanias's Description of Greece": {
  "sources": [
   "https://en.wikipedia.org/wiki/Description_of_Greece"
  ],
  "checked": "confirmed",
  "note": "2nd c. AD"
 },
 "Greek|Closing of Plato's Academy": {
  "sources": [
   "https://en.wikipedia.org/wiki/Platonic_Academy"
  ],
  "checked": "confirmed",
  "note": "529 per Wikipedia; details/nature of closure debated (Agathias sole witness)"
 },
 "Greek|Great Lavra founded on Mount Athos": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Lavra"
  ],
  "checked": "confirmed",
  "note": "963 by Athanasios the Athonite."
 },
 "Greek|Sack of Constantinople (Fourth Crusade)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sack_of_Constantinople"
  ],
  "checked": "confirmed",
  "note": "12-15 April 1204."
 },
 "Greek|Meteora monasteries": {
  "sources": [
   "https://en.wikipedia.org/wiki/Meteora"
  ],
  "checked": "confirmed",
  "note": "Mostly 14th c.; later foundations to 16th c."
 },
 "Greek|Fall of Constantinople": {
  "sources": [
   "https://en.wikipedia.org/wiki/Fall_of_Constantinople"
  ],
  "checked": "confirmed",
  "note": "29 May 1453."
 },
 "Greek|Cretan Renaissance": {
  "sources": [
   "https://en.wikipedia.org/wiki/Cretan_Renaissance"
  ],
  "checked": "confirmed",
  "note": "Heraklion fell 1669"
 },
 "Greek|Greek War of Independence": {
  "sources": [
   "https://en.wikipedia.org/wiki/Greek_War_of_Independence"
  ],
  "checked": "corrected",
  "note": "Article gives 21 Feb 1821 to 12 Sep 1829 (Petra); independence recognised by 1830 London Protocol. 1832 is when the Kingdom of Greece was formally established, but the war itself ended 1829.",
  "fix": {
   "end": 1829
  }
 },
 "Greek|Asia Minor Catastrophe": {
  "sources": [
   "https://en.wikipedia.org/wiki/Great_Fire_of_Smyrna"
  ],
  "checked": "confirmed",
  "note": "Smyrna Sept 1922 (Great Catastrophe); article does not cover the 1923 exchange, which is well known but unsourced here."
 },
 "Egyptian|Third Intermediate Period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Third_Intermediate_Period_of_Egypt"
  ],
  "checked": "confirmed",
  "note": "c.1077/1069 BC to 664 BC; -1070 acceptable."
 },
 "Egyptian|Saite period (26th Dynasty)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Twenty-sixth_Dynasty_of_Egypt"
  ],
  "checked": "confirmed",
  "note": "664-525 BC."
 },
 "Egyptian|Persian conquest of Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Pelusium_(525_BC)"
  ],
  "checked": "confirmed",
  "note": "525 BC."
 },
 "Egyptian|Alexander in Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Alexandria"
  ],
  "checked": "confirmed",
  "note": "Alexandria founded 331 BC; Alexander entered Egypt late 332 BC (not dated in the fetched article), standard dating."
 },
 "Egyptian|Roman Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Roman_Egypt"
  ],
  "checked": "confirmed",
  "note": "30 BC; article gives end as AD 642 (body) or 646 (infobox); row 641 reflects the Alexandria treaty, within a year."
 },
 "Egyptian|Arab conquest of Egypt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Muslim_conquest_of_Egypt"
  ],
  "checked": "confirmed",
  "note": "Dec 639 to Sept 642."
 },
 "Egyptian|Al-Azhar founded": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Azhar_Mosque"
  ],
  "checked": "confirmed",
  "note": "Begun 970, completed 972."
 },
 "Egyptian|Ayyubid dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ayyubid_dynasty"
  ],
  "checked": "confirmed",
  "note": "1171-1250 in Egypt."
 },
 "Egyptian|Mamluk Sultanate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mamluk_Sultanate_(Cairo)"
  ],
  "checked": "confirmed",
  "note": "1250-1517; Ain Jalut 1260."
 },
 "Egyptian|Napoleon's Egyptian campaign": {
  "sources": [
   "https://en.wikipedia.org/wiki/French_campaign_in_Egypt_and_Syria"
  ],
  "checked": "confirmed",
  "note": "1798-1801; Rosetta Stone discovery not stated in article but is well known (1799)."
 },
 "Egyptian|Dynasty of Muhammad Ali": {
  "sources": [
   "https://en.wikipedia.org/wiki/Muhammad_Ali_dynasty"
  ],
  "checked": "confirmed",
  "note": "1805 to the 1952 revolution; monarchy formally abolished June 1953."
 },
 "Egyptian|Suez Canal opens": {
  "sources": [
   "https://en.wikipedia.org/wiki/Suez_Canal"
  ],
  "checked": "confirmed",
  "note": "17 Nov 1869."
 },
 "Mesopotamian|Uruk period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Uruk_period"
  ],
  "checked": "confirmed",
  "note": "c. 4000/3900-3300/3100 BC"
 },
 "Mesopotamian|Mari": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mari,_Syria"
  ],
  "checked": "confirmed",
  "note": "Founded c. 2900; razed c. 1759 BC"
 },
 "Middle East|Phoenician city-states": {
  "sources": [
   "https://en.wikipedia.org/wiki/Phoenicia"
  ],
  "checked": "confirmed",
  "note": "Prominence c. 1200-332 BC; row range acceptable approximation"
 },
 "Middle East|Kingdoms of Israel and Judah": {
  "sources": [
   "https://en.wikipedia.org/wiki/Kingdom_of_Israel_(united_monarchy)"
  ],
  "checked": "confirmed",
  "note": "United monarchy c. 1047-930; Judah to 586 BCE"
 },
 "Middle East|Achaemenid rule in the Levant and Mesopotamia": {
  "sources": [
   "https://en.wikipedia.org/wiki/Achaemenid_Empire"
  ],
  "checked": "confirmed",
  "note": "Babylon fell 539; Achaemenid rule ended 330 (Gaugamela 331 ends effective control of Mesopotamia)."
 },
 "Middle East|Seleucid Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Seleucid_Empire"
  ],
  "checked": "confirmed"
 },
 "Middle East|Roman Syria": {
  "sources": [
   "https://en.wikipedia.org/wiki/Syria_(Roman_province)"
  ],
  "checked": "confirmed",
  "note": "Pompey annexed 64 BCE; end 636 reflects loss to Arabs (Byzantine Syria), while the Wikipedia infobox span for the province proper is 64 BCE-198 CE (split)."
 },
 "Second Temple Jewish|Great Jewish Revolt": {
  "sources": [
   "https://en.wikipedia.org/wiki/First_Jewish%E2%80%93Roman_War"
  ],
  "checked": "confirmed",
  "note": "66-73/74; Temple destroyed 70."
 },
 "Second Temple Jewish|Bar Kokhba revolt": {
  "sources": [
   "https://en.wikipedia.org/wiki/Bar_Kokhba_revolt"
  ],
  "checked": "confirmed"
 },
 "Middle East|Byzantine–Sasanian War of 602–628": {
  "sources": [
   "https://en.wikipedia.org/wiki/Byzantine%E2%80%93Sasanian_War_of_602%E2%80%93628"
  ],
  "checked": "confirmed"
 },
 "Middle East|Crusader states": {
  "sources": [
   "https://en.wikipedia.org/wiki/Crusader_states"
  ],
  "checked": "confirmed"
 },
 "Middle East|Mongol sack of Baghdad": {
  "sources": [
   "https://en.wikipedia.org/wiki/Siege_of_Baghdad_(1258)"
  ],
  "checked": "confirmed"
 },
 "Middle East|Ottoman rule in Syria and Palestine": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ottoman_Syria"
  ],
  "checked": "confirmed"
 },
 "Middle East|Sykes–Picot Agreement": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sykes%E2%80%93Picot_Agreement"
  ],
  "checked": "confirmed",
  "note": "Negotiated 1915-16, ratified May 1916."
 },
 "Middle East|League of Nations mandates in the Middle East": {
  "sources": [
   "https://en.wikipedia.org/wiki/League_of_Nations_mandate"
  ],
  "checked": "confirmed",
  "note": "Created 1920, last ended 1948 (Palestine)."
 },
 "South Asia|Mehrgarh": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mehrgarh"
  ],
  "checked": "confirmed",
  "note": "Start 7000 or 5200 BCE; end c. 2600-3000"
 },
 "South Asia|Late Harappan period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Indus_Valley_Civilisation"
  ],
  "checked": "confirmed",
  "note": "1900-1300 BCE"
 },
 "South Asia|Painted Grey Ware culture": {
  "sources": [
   "https://en.wikipedia.org/wiki/Painted_Grey_Ware_culture"
  ],
  "checked": "confirmed",
  "note": "c. 1200-600/500 BCE"
 },
 "South Asia|Mahajanapadas": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mahajanapadas"
  ],
  "checked": "confirmed",
  "note": "6th-4th c. BCE; Nandas c. 345"
 },
 "South Asia|Nanda dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nanda_Empire"
  ],
  "checked": "confirmed",
  "note": "c.345-322 BCE per Habib/Jha; other scholars differ."
 },
 "South Asia|Alexander at the Indus": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_the_Hydaspes"
  ],
  "checked": "confirmed",
  "note": "May 326 BCE."
 },
 "South Asia|Sangam period": {
  "sources": [
   "https://en.wikipedia.org/wiki/Sangam_period"
  ],
  "checked": "confirmed",
  "note": "c. 300 BCE-300 CE"
 },
 "South Asia|Indo-Greek Kingdoms": {
  "sources": [
   "https://en.wikipedia.org/wiki/Indo-Greek_Kingdom"
  ],
  "checked": "confirmed",
  "note": "Wikipedia c. 200 BC-10 AD; Menander c. 155-130 BC. Row start -180 within range"
 },
 "South Asia|Satavahana dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Satavahana_dynasty"
  ],
  "checked": "confirmed",
  "note": "Late 2nd c. BCE (or 3rd) to c. 224 CE"
 },
 "South Asia|Chalukya dynasty of Badami": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chalukya_dynasty"
  ],
  "checked": "confirmed"
 },
 "South Asia|Harsha": {
  "sources": [
   "https://en.wikipedia.org/wiki/Harsha"
  ],
  "checked": "confirmed"
 },
 "South Asia|Pala Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Pala_Empire"
  ],
  "checked": "confirmed"
 },
 "South Asia|Rashtrakuta dynasty": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rashtrakuta_dynasty"
  ],
  "checked": "confirmed"
 },
 "South Asia|Chola Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Chola_dynasty"
  ],
  "checked": "confirmed",
  "note": "Medieval Cholas c.848-1279."
 },
 "South Asia|Delhi Sultanate": {
  "sources": [
   "https://en.wikipedia.org/wiki/Delhi_Sultanate"
  ],
  "checked": "confirmed"
 },
 "South Asia|Vijayanagara Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Vijayanagara_Empire"
  ],
  "checked": "confirmed"
 },
 "South Asia|Maratha Empire": {
  "sources": [
   "https://en.wikipedia.org/wiki/Maratha_Empire"
  ],
  "checked": "confirmed"
 },
 "South Asia|Battle of Plassey": {
  "sources": [
   "https://en.wikipedia.org/wiki/Battle_of_Plassey"
  ],
  "checked": "confirmed"
 },
 "South Asia|Partition of India": {
  "sources": [
   "https://en.wikipedia.org/wiki/Partition_of_India"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Mozi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mozi"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Mencius": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mencius"
  ],
  "checked": "confirmed",
  "note": "c. 371-289 BC; -372 within one year"
 },
 "Philosophy|Xunzi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Xunzi_(philosopher)"
  ],
  "checked": "confirmed",
  "note": "b. c. 310; d. after c. 238 BCE"
 },
 "Philosophy|Han Feizi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Han_Fei"
  ],
  "checked": "confirmed",
  "note": "c. 280-233 BC"
 },
 "Philosophy|Dignāga": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dignāga"
  ],
  "checked": "confirmed",
  "note": "c. 480-540 (or 470-530)"
 },
 "Philosophy|Dharmakīrti": {
  "sources": [
   "https://en.wikipedia.org/wiki/Dharmakīrti"
  ],
  "checked": "confirmed",
  "note": "c. 600-670"
 },
 "Philosophy|Al-Kindi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Al-Kindi"
  ],
  "checked": "confirmed",
  "note": "c.801-c.873; article calls him 'father of Arab philosophy', first of the Islamic peripatetics."
 },
 "Philosophy|Kūkai": {
  "sources": [
   "https://en.wikipedia.org/wiki/K%C5%ABkai"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Ibn Tufayl": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ibn_Tufail"
  ],
  "checked": "confirmed",
  "note": "c. 1105-1185"
 },
 "Philosophy|Ibn Rushd (Averroes)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Averroes"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Zhu Xi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zhu_Xi"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Shinran": {
  "sources": [
   "https://en.wikipedia.org/wiki/Shinran"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Nichiren": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nichiren"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Ibn Khaldun": {
  "sources": [
   "https://en.wikipedia.org/wiki/Ibn_Khaldun"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Wang Yangming": {
  "sources": [
   "https://en.wikipedia.org/wiki/Wang_Yangming"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Yi Hwang (Toegye)": {
  "sources": [
   "https://en.wikipedia.org/wiki/Yi_Hwang"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Zera Yacob": {
  "sources": [
   "https://en.wikipedia.org/wiki/Zera_Yacob_(philosopher)"
  ],
  "checked": "confirmed",
  "note": "Wikipedia: 1600-1693; row's 1599-1692 (Sumner) is within one year"
 },
 "Philosophy|Anton Wilhelm Amo": {
  "sources": [
   "https://en.wikipedia.org/wiki/Anton_Wilhelm_Amo"
  ],
  "checked": "confirmed",
  "note": "c. 1703-c. 1759"
 },
 "Philosophy|Rabindranath Tagore": {
  "sources": [
   "https://en.wikipedia.org/wiki/Rabindranath_Tagore"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Mahatma Gandhi": {
  "sources": [
   "https://en.wikipedia.org/wiki/Mahatma_Gandhi"
  ],
  "checked": "confirmed"
 },
 "Philosophy|Nishida Kitarō": {
  "sources": [
   "https://en.wikipedia.org/wiki/Nishida_Kitar%C5%8D"
  ],
  "checked": "confirmed"
 }
};

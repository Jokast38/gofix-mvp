"""Vocabulary for the rule-based RequestIntent parser (FR / AR / common Algerian darija / EN).
Category/subject names from the taxonomy are added automatically at runtime; these lists add synonyms and symptoms.
Keys must exist in the taxonomy (unknown keys are ignored)."""

CATEGORY_SYNONYMS = {
    "plumber": ["plombier", "plomberie", "fuite", "fuit", "robinet", "tuyau", "evier", "chauffe eau", "chauffe-eau", "sanitaire", "wc",
                "toilette", "canalisation", "bouche", "debouchage", "lavabo", "douche", "سباك", "ترصيص", "تسرب", "تسريب", "الماء يقطر",
                "plombi", "lplombi", "robini"],
    "electrician": ["electricien", "electricite", "courant", "prise", "disjoncteur", "court circuit", "panne electrique", "lumiere",
                    "eclairage", "tableau electrique", "كهربائي", "كهرباء", "الضو", "trisiti", "tricity", "electrique"],
    "air_conditioning": ["clim", "climatiseur", "climatisation", "climatiseurs", "مكيف", "مكيفات", "klimatizor", "climatizour"],
    "cleaning": ["menage", "nettoyage", "femme de menage", "nettoyer", "تنظيف", "منظفة"],
    "moving": ["demenagement", "demenager", "transport meubles", "نقل الأثاث", "ترحيل"],
    "locksmith": ["serrure", "serrurier", "cle", "porte bloquee", "porte claquee", "قفل", "مفتاح"],
    "painter": ["peinture", "peintre", "repeindre", "دهان", "صباغة", "sbagh"],
    "mason": ["macon", "maconnerie", "beton", "mur", "dalle", "بناء", "بنّاء", "ماصو", "masson"],
    "carpenter": ["menuisier", "menuiserie", "bois", "placard", "porte en bois", "نجار", "نجارة"],
    "tiler": ["carrelage", "carreleur", "faience", "dalle de sol", "بلاط", "زليج"],
    "welder": ["soudure", "soudeur", "ferronnier", "fer forge", "portail", "حداد", "تلحيم"],
    "car_mechanic": ["mecanicien", "mecanique", "garage", "voiture en panne", "moteur", "vidange", "frein", "ميكانيكي", "طونوبيل", "tomobil"],
    "auto_electrician": ["electricien auto", "batterie voiture", "demarreur", "alternateur"],
    "bodywork": ["carrosserie", "carrossier", "tolerie", "سمكري"],
    "hairdresser": ["coiffeur", "coiffeuse", "coiffure", "coupe de cheveux", "brushing", "حلاق", "حلاقة", "كوافير", "coiffeur a domicile"],
    "beautician": ["estheticienne", "epilation", "soin visage", "manucure", "تجميل"],
    "computer_repair": ["ordinateur", "pc", "laptop", "portable pc", "informaticien", "réparation pc", "حاسوب", "كمبيوتر"],
    "phone_repair": ["telephone", "smartphone", "ecran casse", "iphone", "samsung", "هاتف", "تيليفون", "portable casse"],
    "network_installer": ["wifi", "reseau", "box internet", "fibre", "شبكة", "انترنت"],
    "pastry": ["patisserie", "patissier", "gateau", "gateaux", "حلويات", "حلوة", "gato"],
    "cooking": ["cuisinier", "traiteur", "repas", "cuisine pour fete", "طباخ"],
    "delivery": ["livraison", "livreur", "colis", "توصيل"],
    "gardening": ["jardin", "jardinier", "pelouse", "حديقة", "بستاني"],
    "appliance_repair": ["machine a laver", "frigo", "refrigerateur", "four", "lave vaisselle", "غسالة", "ثلاجة"],
    "photography": ["photographe", "photo mariage", "مصور"],
}
EN_CATEGORY_SYNONYMS = {
    "plumber": ["plumber", "plumbing", "leak", "leaking", "tap", "faucet", "pipe", "sink", "water heater", "toilet", "drain", "blocked drain", "shower"],
    "electrician": ["electrician", "electricity", "electrical", "power cut", "socket", "fuse", "wiring", "lighting"],
    "air_conditioning": ["air conditioning", "air conditioner", "aircon", "ac unit"],
    "cleaning": ["cleaning", "cleaner", "housekeeping"],
    "moving": ["moving", "movers", "removal", "furniture transport"],
    "locksmith": ["locksmith", "lock", "locked out", "key"],
    "painter": ["painter", "painting", "repaint"],
    "mason": ["mason", "masonry", "concrete", "wall"],
    "carpenter": ["carpenter", "carpentry", "wood", "cupboard"],
    "tiler": ["tiler", "tiling", "tiles"],
    "welder": ["welder", "welding", "ironwork", "gate"],
    "car_mechanic": ["mechanic", "car repair", "car broke down", "engine", "oil change", "brakes"],
    "auto_electrician": ["car electrician", "car battery", "starter motor", "alternator"],
    "bodywork": ["bodywork", "body shop", "panel beater"],
    "hairdresser": ["hairdresser", "hairdressing", "haircut", "hair salon"],
    "beautician": ["beautician", "manicure", "waxing", "facial"],
    "computer_repair": ["computer", "computer repair", "broken laptop"],
    "phone_repair": ["phone", "phone repair", "broken screen", "cracked screen"],
    "network_installer": ["network", "internet", "router", "cctv"],
    "pastry": ["pastry", "cake", "cakes", "baker"],
    "cooking": ["cook", "caterer", "catering", "meal"],
    "delivery": ["delivery", "courier", "parcel"],
    "gardening": ["garden", "gardener", "gardening", "lawn"],
    "appliance_repair": ["washing machine", "fridge", "oven", "dishwasher"],
    "photography": ["photographer", "wedding photos"],
}
for _key, _words in EN_CATEGORY_SYNONYMS.items():
    CATEGORY_SYNONYMS.setdefault(_key, []).extend(_words)

# Words that switch the request to GoFix Academy (teacher search)
ACADEMY_MARKERS = ["prof", "professeur", "cours", "soutien", "lecon", "lecons", "repetiteur", "tuteur", "enseignant", "revision",
                   "أستاذ", "استاذ", "دروس", "درس", "دعم", "معلم", "prof de",
                   "teacher", "tutor", "tutoring", "lesson", "lessons", "class", "classes"]

SUBJECT_SYNONYMS = {
    "math": ["maths", "math", "mathematiques", "mathematique", "algebre", "geometrie", "probabilites", "analyse", "رياضيات", "رياضة"],
    "physics": ["physique", "chimie", "physique chimie", "فيزياء", "كيمياء"],
    "sciences": ["svt", "sciences naturelles", "biologie", "علوم", "علوم طبيعية"],
    "french": ["francais", "french", "فرنسية", "الفرنسية", "fransia"],
    "arabic": ["arabe", "عربية", "العربية", "لغة عربية"],
    "english": ["anglais", "english", "إنجليزية", "انجليزية", "الانجليزية"],
    "philosophy": ["philo", "philosophie", "فلسفة"],
    "history_geo": ["histoire", "geographie", "histoire geo", "تاريخ", "جغرافيا"],
    "computer_science": ["informatique", "programmation", "python", "إعلام آلي", "اعلام الي"],
    "tamazight": ["tamazight", "amazigh", "kabyle", "أمازيغية"],
}
for _key, _words in {"math": ["mathematics", "algebra", "geometry"], "physics": ["physics", "chemistry"], "sciences": ["science", "biology"],
                     "arabic": ["arabic"], "philosophy": ["philosophy"], "history_geo": ["history", "geography"],
                     "computer_science": ["computer science", "programming", "coding"]}.items():
    SUBJECT_SYNONYMS[_key].extend(_words)

# Algerian school grades -> level key (+ the grade kept as-is for the explanation)
LEVEL_PATTERNS = [
    (r"\b([1-5])\s*ap\b", "primary"), (r"\bprimaire\b", "primary"), (r"ابتدائي", "primary"),
    (r"\b([1-4])\s*am\b", "middle"), (r"\bbem\b", "middle"), (r"\bcem\b", "middle"), (r"\bcollege\b", "middle"), (r"متوسط", "middle"),
    (r"\b([1-3])\s*as\b", "secondary"), (r"\bbac\b", "secondary"), (r"\blycee\b", "secondary"), (r"\bterminale\b", "secondary"),
    (r"ثانوي", "secondary"), (r"بكالوريا", "secondary"), (r"باك", "secondary"),
    (r"\buniversite\b", "university"), (r"\bfac\b", "university"), (r"\blicence\b", "university"), (r"\bmaster\b", "university"),
    (r"\bl[1-3]\b", "university"), (r"جامعي|جامعة", "university"),
    (r"\bconcours\b", "competitive"), (r"مسابقة", "competitive"),
    (r"\bprimary\b", "primary"), (r"\bmiddle school\b", "middle"), (r"\bhigh school\b", "secondary"), (r"\bsecondary\b", "secondary"),
    (r"\buniversity\b", "university"), (r"\bcompetitive exams?\b", "competitive"),
]

URGENCY_WORDS = ["urgent", "urgence", "urgemment", "vite", "rapidement", "immediatement", "tout de suite", "maintenant", "au plus vite",
                 "asap", "emergency", "immediately", "right away", "right now", "quickly", "as soon as possible", "عاجل", "ضروري", "حالا", "دروك", "درك", "dorka", "drk", "zerb", "zerbe", "dghya", "دغيا"]

DAY_WORDS = {
    "today": ["aujourd hui", "aujourdhui", "ce matin", "ce soir", "cet apres midi", "today", "this morning", "this afternoon", "this evening", "tonight", "اليوم", "lyoum", "el youm"],
    "tomorrow": ["demain", "tomorrow", "غدا", "غدوة", "ghodwa", "ghedwa"],
    "mon": ["lundi", "monday", "الاثنين", "الإثنين"], "tue": ["mardi", "tuesday", "الثلاثاء"], "wed": ["mercredi", "wednesday", "الأربعاء", "الاربعاء"],
    "thu": ["jeudi", "thursday", "الخميس"], "fri": ["vendredi", "friday", "الجمعة"], "sat": ["samedi", "saturday", "السبت"], "sun": ["dimanche", "sunday", "الأحد", "الاحد"],
}
SLOT_WORDS = {
    "morning": ["matin", "matinee", "morning", "صباح", "الصباح", "sbah"],
    "afternoon": ["apres midi", "apres-midi", "aprem", "afternoon", "بعد الظهر", "العشية", "l3chia"],
    "evening": ["soir", "soiree", "ce soir", "evening", "tonight", "مساء", "الليل", "lil"],
}
MODE_WORDS = {
    "online": ["visio", "en ligne", "a distance", "online", "remote", "video call", "zoom", "google meet", "teams", "عن بعد", "اونلاين", "أونلاين"],
    "home": ["a domicile", "chez moi", "chez nous", "domicile", "at home", "at my place", "at my house", "في الدار", "في المنزل", "فالدار"],
    "center": ["en centre", "centre", "ecole", "center", "at a center", "مركز"],
}

"""Vocabulary for the rule-based RequestIntent parser (FR / AR / common Algerian darija).
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

# Words that switch the request to GoFix Academy (teacher search)
ACADEMY_MARKERS = ["prof", "professeur", "cours", "soutien", "lecon", "lecons", "repetiteur", "tuteur", "enseignant", "revision",
                   "أستاذ", "استاذ", "دروس", "درس", "دعم", "معلم", "prof de"]

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

# Algerian school grades -> level key (+ the grade kept as-is for the explanation)
LEVEL_PATTERNS = [
    (r"\b([1-5])\s*ap\b", "primary"), (r"\bprimaire\b", "primary"), (r"ابتدائي", "primary"),
    (r"\b([1-4])\s*am\b", "middle"), (r"\bbem\b", "middle"), (r"\bcem\b", "middle"), (r"\bcollege\b", "middle"), (r"متوسط", "middle"),
    (r"\b([1-3])\s*as\b", "secondary"), (r"\bbac\b", "secondary"), (r"\blycee\b", "secondary"), (r"\bterminale\b", "secondary"),
    (r"ثانوي", "secondary"), (r"بكالوريا", "secondary"), (r"باك", "secondary"),
    (r"\buniversite\b", "university"), (r"\bfac\b", "university"), (r"\blicence\b", "university"), (r"\bmaster\b", "university"),
    (r"\bl[1-3]\b", "university"), (r"جامعي|جامعة", "university"),
    (r"\bconcours\b", "competitive"), (r"مسابقة", "competitive"),
]

URGENCY_WORDS = ["urgent", "urgence", "urgemment", "vite", "rapidement", "immediatement", "tout de suite", "maintenant", "au plus vite",
                 "asap", "عاجل", "ضروري", "حالا", "دروك", "درك", "dorka", "drk", "zerb", "zerbe", "dghya", "دغيا"]

DAY_WORDS = {
    "today": ["aujourd hui", "aujourdhui", "ce matin", "ce soir", "cet apres midi", "اليوم", "lyoum", "el youm"],
    "tomorrow": ["demain", "غدا", "غدوة", "ghodwa", "ghedwa"],
    "mon": ["lundi", "الاثنين", "الإثنين"], "tue": ["mardi", "الثلاثاء"], "wed": ["mercredi", "الأربعاء", "الاربعاء"],
    "thu": ["jeudi", "الخميس"], "fri": ["vendredi", "الجمعة"], "sat": ["samedi", "السبت"], "sun": ["dimanche", "الأحد", "الاحد"],
}
SLOT_WORDS = {
    "morning": ["matin", "matinee", "صباح", "الصباح", "sbah"],
    "afternoon": ["apres midi", "apres-midi", "aprem", "بعد الظهر", "العشية", "l3chia"],
    "evening": ["soir", "soiree", "ce soir", "مساء", "الليل", "lil"],
}
MODE_WORDS = {
    "online": ["visio", "en ligne", "a distance", "online", "zoom", "google meet", "teams", "عن بعد", "اونلاين", "أونلاين"],
    "home": ["a domicile", "chez moi", "chez nous", "domicile", "في الدار", "في المنزل", "فالدار"],
    "center": ["en centre", "centre", "ecole", "مركز"],
}

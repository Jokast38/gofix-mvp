"""EDU AI question bank, from the GOFIX EDU AI documents (November 2026). Demonstration content: every item starts as
"draft" (to be validated by Algerian teachers); the admin archives an item to take it out, or publishes it once validated.

Three sources:
- tests by class (1AP to 3AS, 5 tests of 6 questions): the documents build each test from the same formulas, so the
  numbers below are the documents' parameters and the questions, answers and wrong options are computed from them;
- language quizzes (French, English, Arabic, 5 levels of 6 questions), with the documents' explanations;
- the developer specification's bank (4 questions per class, 2 per higher-education track), with explanations.
Options are stored as (correct, 3 wrong ones); the API shuffles them for every attempt."""

PRIMARY = ("1AP", "2AP", "3AP", "4AP", "5AP")
MIDDLE = ("1AM", "2AM", "3AM", "4AM")
SECONDARY = ("1AS", "2AS", "3AS")
CLASSES = PRIMARY + MIDDLE + SECONDARY
CYCLE = {**{c: "primary" for c in PRIMARY}, **{c: "middle" for c in MIDDLE}, **{c: "secondary" for c in SECONDARY}}
SOURCE = "gofix_edu_ai_2026_11"

# --- Tests by class -------------------------------------------------------------------------------------------------
# French and science questions are shared by every class of a cycle (test n uses entry n).
POOLS = {
    "primary": [
        (("Quel mot désigne un animal ?", "Chat", ["Route", "Maison", "Table"], "« Chat » est un nom d'animal."),
         ("Quelle partie du corps permet de voir ?", "Œil", ["Pied", "Main", "Oreille"], "On voit avec les yeux.")),
        (("Dans « Le chat dort », quel mot désigne l’animal ?", "chat", ["Le", "aucun", "dort"], "« chat » désigne l'animal ; « dort » est le verbe."),
         ("Quel organe sert à entendre ?", "Oreille", ["Main", "Langue", "Nez"], "L'oreille sert à entendre.")),
        (("Quel mot est au pluriel ?", "maisons", ["livre", "arbre", "stylo"], "« maisons » porte la marque du pluriel."),
         ("Quelle matière est généralement liquide à température ambiante ?", "Eau", ["Bois", "Pierre", "Verre"], "L'eau est liquide à température ambiante.")),
        (("Dans « Les enfants jouent », quel est le verbe ?", "jouent", ["aucun", "enfants", "Les"], "« jouent » est le verbe conjugué."),
         ("Quel astre éclaire naturellement la Terre le jour ?", "Soleil", ["Lune", "Mars", "Vénus"], "Le Soleil éclaire la Terre le jour.")),
        (("Quel mot est un adjectif qualificatif ?", "rapide", ["courir", "demain", "avec"], "« rapide » qualifie un nom : c'est un adjectif."),
         ("Quel phénomène transforme l’eau liquide en vapeur ?", "Évaporation", ["Solidification", "Condensation", "Fusion"],
          "L'évaporation transforme l'eau liquide en vapeur.")),
    ],
    "middle": [
        (("Dans « Nous écrivons », quel est le temps du verbe ?", "Présent", ["Imparfait", "Futur", "Passé simple"], "« écrivons » est au présent de l'indicatif."),
         ("Quel organe permet principalement les échanges gazeux ?", "Poumons", ["Reins", "Foie", "Estomac"], "Les poumons assurent les échanges gazeux.")),
        (("Dans « Ils ont terminé », quel est le temps ?", "Passé composé", ["Présent", "Imparfait", "Futur simple"],
          "Auxiliaire au présent + participe passé : passé composé."),
         ("Quel gaz est utilisé par les plantes lors de la photosynthèse ?", "Dioxyde de carbone", ["Diazote", "Dioxygène", "Hélium"],
          "Les plantes utilisent le dioxyde de carbone (CO₂).")),
        (("Dans « Si tu viens, nous partirons », quelle proposition exprime la condition ?", "Si tu viens", ["tu viens nous", "nous partirons", "partirons"],
          "« Si tu viens » pose la condition."),
         ("Quelle grandeur s’exprime en newtons ?", "Force", ["Masse", "Température", "Énergie"], "Le newton est l'unité de force.")),
        (("Quelle phrase contient une proposition relative ?", "Le livre que je lis est utile.", ["Nous irons demain.", "Viens ici !", "Il mange vite."],
          "« que je lis » est une proposition relative."),
         ("Quel dispositif mesure une intensité électrique ?", "Ampèremètre", ["Voltmètre", "Baromètre", "Thermomètre"], "L'ampèremètre mesure l'intensité.")),
        (("Quelle phrase contient une concession ?", "Bien qu’il pleuve, elle sort.",
          ["Elle sort et revient.", "Elle sort demain.", "Elle sort parce qu’il fait beau."], "« Bien que » introduit une concession."),
         ("Dans un circuit en série, l’intensité du courant est :", "identique en tout point", ["égale à la tension", "toujours variable", "nulle partout"],
          "En série, la même intensité traverse tout le circuit.")),
    ],
    "secondary": [
        (("Quelle forme verbale est au subjonctif présent ?", "qu’il vienne", ["il venait", "il vient", "il viendra"], "« qu'il vienne » est au subjonctif présent."),
         ("Quelle grandeur caractérise la quantité de matière ?", "Mole", ["Newton", "Volt", "Watt"], "La mole mesure la quantité de matière.")),
        (("Dans « Il aurait réussi », quel est le mode ?", "Conditionnel", ["Subjonctif", "Impératif", "Indicatif"], "« aurait réussi » est au conditionnel passé."),
         ("Quelle grandeur s’exprime en joules ?", "Énergie", ["Puissance", "Intensité", "Résistance"], "L'énergie s'exprime en joules.")),
        (("Quelle phrase exprime une hypothèse irréelle au présent ?", "S’il venait, je serais heureux.",
          ["S’il vient, je serai heureux.", "Il vient souvent.", "Viens demain."], "Si + imparfait, puis conditionnel présent : irréel du présent."),
         ("Quelle particule porte une charge électrique négative ?", "Électron", ["Proton", "Photon", "Neutron"], "L'électron porte une charge négative.")),
        (("Quelle figure de style rapproche deux éléments avec « comme » ?", "Comparaison", ["Hyperbole", "Métaphore", "Antithèse"],
          "L'outil « comme » marque une comparaison."),
         ("Quelle loi relie tension, résistance et intensité ?", "Loi d’Ohm", ["Loi de Kepler", "Loi de Boyle", "Loi de Hooke"], "Loi d'Ohm : U = R × I.")),
        (("Quelle proposition définit une antithèse ?", "Opposition de deux idées", ["Exagération volontaire", "Répétition d’un mot", "Association de sons"],
          "L'antithèse oppose deux idées."),
         ("Dans une réaction chimique équilibrée, quelle grandeur est conservée ?", "Masse totale", ["Couleur", "Volume gazeux", "Température"],
          "Lors d'une réaction chimique, la masse totale est conservée.")),
    ],
}

# Parameters of the 5 tests of each class, in the documents' order.
PARAMS = {
    "1AP": dict(add=[(6, 7), (7, 9), (8, 11), (9, 13), (10, 15)], nxt=[15, 18, 21, 24, 27],
                sub=[(17, 9), (20, 11), (23, 13), (26, 15), (29, 17)], box=[9, 12, 15, 18, 21]),
    "2AP": dict(add=[(9, 7), (11, 9), (13, 11), (15, 13), (17, 15)], nxt=[18, 22, 26, 30, 34],
                sub=[(20, 9), (24, 11), (28, 13), (32, 15), (36, 17)], box=[12, 16, 20, 24, 28]),
    "3AP": dict(mul=[(12, 7), (15, 9), (18, 11), (21, 13), (24, 15)], lot=[(13, 8), (16, 10), (19, 12), (22, 14), (25, 16)],
                rect=[(14, 9), (17, 11), (20, 13), (23, 15), (26, 17)], box=[15, 20, 25, 30, 35]),
    "4AP": dict(mul=[(15, 7), (19, 9), (23, 11), (27, 13), (31, 15)], lot=[(16, 8), (20, 10), (24, 12), (28, 14), (32, 16)],
                rect=[(17, 9), (21, 11), (25, 13), (29, 15), (33, 17)], box=[18, 24, 30, 36, 42]),
    "5AP": dict(mul=[(18, 7), (23, 9), (28, 11), (33, 13), (38, 15)], lot=[(19, 8), (24, 10), (29, 12), (34, 14), (39, 16)],
                rect=[(20, 9), (25, 11), (30, 13), (35, 15), (40, 17)], box=[21, 28, 35, 42, 49]),
    "1AM": dict(mul=[(21, 7), (27, 9), (33, 11), (39, 13), (45, 15)], sd=[(22, 8), (28, 10), (34, 12), (40, 14), (46, 16)],
                price=[90, 120, 150, 180, 210]),
    "2AM": dict(mul=[(24, 7), (31, 9), (38, 11), (45, 13), (52, 15)], sd=[(25, 8), (32, 10), (39, 12), (46, 14), (53, 16)],
                price=[120, 160, 200, 240, 280]),
    "3AM": dict(mul=[(27, 7), (35, 9), (43, 11), (51, 13), (59, 15)], sd=[(28, 8), (36, 10), (44, 12), (52, 14), (60, 16)],
                price=[150, 200, 250, 300, 350]),
    "4AM": dict(mul=[(30, 7), (39, 9), (48, 11), (57, 13), (66, 15)], sd=[(31, 8), (40, 10), (49, 12), (58, 14), (67, 16)],
                price=[180, 240, 300, 360, 420]),
    "1AS": dict(eq=[(7, 36, 57), (9, 47, 83), (11, 58, 113), (13, 69, 147), (15, 80, 185)], sq=[37, 48, 59, 70, 81],
                f=[(38, 9, 2), (49, 11, 3), (60, 13, 4), (71, 15, 5), (82, 17, 6)], seq=[(9, 4), (12, 5), (15, 6), (18, 7), (21, 8)]),
    "2AS": dict(eq=[(7, 39, 60), (9, 51, 87), (11, 63, 118), (13, 75, 153), (15, 87, 192)], sq=[40, 52, 64, 76, 88],
                f=[(41, 9, 2), (53, 11, 3), (65, 13, 4), (77, 15, 5), (89, 17, 6)], seq=[(12, 4), (16, 5), (20, 6), (24, 7), (28, 8)]),
    "3AS": dict(eq=[(7, 42, 63), (9, 55, 91), (11, 68, 123), (13, 81, 159), (15, 94, 199)], sq=[43, 56, 69, 82, 95],
                f=[(44, 9, 2), (57, 11, 3), (70, 13, 4), (83, 15, 5), (96, 17, 6)], seq=[(15, 4), (20, 5), (25, 6), (30, 7), (35, 8)]),
}


def _q(subject, skill, question, correct, wrong, explanation):
    return {"subject": subject, "skill": skill, "question": question, "correct": str(correct),
            "distractors": [str(w) for w in wrong], "explanation": explanation}


def _crayons(c, n):
    x, y = 4 + n, 3 + n
    ans = c + x - y
    return _q("reasoning", "Problèmes", f"Une boîte contient {c} crayons. On ajoute {x} crayons puis on en donne {y}. Combien reste-t-il de crayons ?",
              ans, [c, c + x, ans - 2], f"{c} + {x} - {y} = {ans}.")


def _math_questions(level: str, n: int) -> list[dict]:
    p = PARAMS[level]
    if level in ("1AP", "2AP"):
        (a, b), m, (t, r) = p["add"][n], p["nxt"][n], p["sub"][n]
        return [
            _q("math", "Addition", f"Combien font {a} + {b} ?", a + b, [a + b - 1, a + b + 1, a + b + 2], f"{a} + {b} = {a + b}."),
            _q("math", "Nombres", f"Quel nombre vient immédiatement après {m} ?", m + 1, [m - 1, m + 3, m + 2], f"Après {m} vient {m + 1}."),
            _q("math", "Soustraction", f"Il y a {t} billes. On en retire {r}. Combien reste-t-il de billes ?", t - r, [t, t - r + 1, t - r - 1],
               f"{t} - {r} = {t - r}."),
        ], _crayons(p["box"][n], n)
    if level in ("3AP", "4AP", "5AP"):
        (a, b), (o, k), (L, w) = p["mul"][n], p["lot"][n], p["rect"][n]
        return [
            _q("math", "Multiplication", f"Combien font {a} × {b} ?", a * b, [a * b + b, a * b - b, a * b + 2 * b], f"{a} × {b} = {a * b}."),
            _q("math", "Multiplication", f"Un lot contient {o} objets. Combien y en a-t-il dans {k} lots ?", o * k, [o * k + o, o + k, o * k - o],
               f"{o} × {k} = {o * k}."),
            _q("math", "Géométrie", f"Un rectangle a {L} cm de longueur et {w} cm de largeur. Quel est son périmètre en cm ?", 2 * (L + w),
               [L * w, 2 * L + w, L + w], f"2 × ({L} + {w}) = {2 * (L + w)} cm."),
        ], _crayons(p["box"][n], n)
    if level in MIDDLE:
        (a, b), (c, d), k, price = p["mul"][n], p["sd"][n], 9 + 2 * n, p["price"][n]
        final = price * 9 // 10
        return [
            _q("math", "Calcul", f"Calculer {a} × {b} - {b}.", a * b - b, [a * b, a * b - 1, a * b + b], f"{a} × {b} = {a * b}, puis {a * b} - {b} = {a * b - b}."),
            _q("math", "Calcul", f"Quel est le résultat de ({c}+{d}) - ({c}-{d}) ?", 2 * d, [2 * c, d, c], f"({c}+{d}) - ({c}-{d}) = 2 × {d} = {2 * d}."),
            _q("math", "Nombres relatifs", f"Une quantité augmente de {k} puis diminue de {k}. Quelle est sa variation totale ?", 0, [k, 2 * k, -k],
               f"+{k} puis -{k} : la variation totale est 0."),
        ], _q("reasoning", "Pourcentages", f"Un article coûte {price} DA. Une remise de 10 % est appliquée. Quel est le prix final en DA ?", final,
              [price * 8 // 10, price * 11 // 10, price], f"10 % de {price} = {price // 10}, donc {price} - {price // 10} = {final} DA.")
    (a, b, c), m, (fa, fb, fk), (u, r) = p["eq"][n], p["sq"][n], p["f"][n], p["seq"][n]
    x = (c - b) // a
    assert a * x + b == c, (level, n)
    return [
        _q("math", "Équations", f"Résoudre : {a}x + {b} = {c}.", x, [x - 2, x - 1, x + 1], f"{a}x = {c} - {b} = {c - b}, donc x = {x}."),
        _q("math", "Calcul littéral", f"Quelle est la valeur de {m}² - ({m}-1)² ?", 2 * m - 1, [2 * m + 1, m * m, 2 * m],
           f"n² - (n-1)² = 2n - 1, soit {2 * m - 1}."),
        _q("math", "Fonctions", f"Pour f(x) = {fa}x + {fb}, combien vaut f({fk}) ?", fa * fk + fb, [fa * (fk + 1) + fb, fa * fk - fb, fa * (fk - 1) + fb],
           f"f({fk}) = {fa} × {fk} + {fb} = {fa * fk + fb}."),
    ], _q("reasoning", "Suites", f"Une suite arithmétique a pour premier terme u₀={u} et pour raison r={r}. Que vaut u₃ ?", u + 3 * r,
          [u + 4 * r, u + 2 * r, u + r], f"u₃ = u₀ + 3r = {u} + {3 * r} = {u + 3 * r}.")


def class_items() -> list[dict]:
    items = []
    for level in CLASSES:
        pool = POOLS[CYCLE[level]]
        for n in range(5):
            maths, reasoning = _math_questions(level, n)
            fr, sci = pool[n]
            questions = [*maths, _q("french", "Langue", *fr), _q("sciences", "Sciences", *sci), reasoning]
            for i, q in enumerate(questions, 1):
                items.append(q | {"key": f"C-{level}-{n + 1}-{i}", "test_key": f"class-{level}-{n + 1}", "position": i, "kind": "class",
                                  "level": level, "lang": "fr", "difficulty": n + 1})
    return items


# --- Language quizzes ------------------------------------------------------------------------------------------------
LANGUAGE = {
    "fr": [
        [("Quel mot désigne un animal ?", "chat", ["chaise", "table", "lampe"], "« Chat » est un nom d'animal."),
         ("Complète : « Je ___ à l'école. »", "vais", ["va", "vont", "aller"], "Avec « je », le verbe aller au présent est « vais »."),
         ("Quel mot est au pluriel ?", "livres", ["maison", "stylo", "livre"], "« Livres » porte la marque du pluriel."),
         ("Quel signe termine une question ?", "?", [",", ".", "!"], "Une phrase interrogative se termine par un point d'interrogation."),
         ("Dans « Le ciel bleu », quel mot est l'adjectif ?", "bleu", ["ciel", "le", "aucun"], "« Bleu » qualifie le nom « ciel »."),
         ("Quel est le contraire de « grand » ?", "petit", ["haut", "long", "large"], "« Petit » est l'antonyme de « grand »."),],
        [("Complète : « Nous ___ un livre. »", "lisons", ["lisez", "lisent", "lit"], "« Nous lisons » est la conjugaison correcte au présent."),
         ("Quel groupe contient seulement des noms communs ?", "maison, jardin, école", ["beau, grand, petit", "courir, chanter, jouer", "vite, très, assez"],
          "Les trois mots désignent des choses ou des lieux."),
         ("Dans « Elles chantent », quel est le sujet ?", "Elles", ["chantent", "elles chantent", "aucun"], "Le pronom « Elles » est le sujet du verbe."),
         ("Choisis la phrase correctement ponctuée.", "Où vas-tu ?", ["Où vas-tu.", "Où vas-tu,", "Où vas-tu!"], "L'interrogation directe prend un point d'interrogation."),
         ("Quel est le féminin de « acteur » ?", "actrice", ["acteurice", "acteure", "acteuse"], "Le féminin usuel est « actrice »."),
         ("Quel mot est un adverbe ?", "rapidement", ["rapideur", "rapide", "rapidité"], "« Rapidement » modifie notamment la manière d'une action."),],
        [("Dans « Le livre que tu lis est passionnant », « que tu lis » est une proposition...", "relative", ["principale", "indépendante", "infinitive"],
          "Le pronom relatif « que » introduit une relative."),
         ("Quel temps est employé dans « Nous avions terminé » ?", "plus-que-parfait", ["passé composé", "imparfait", "futur antérieur"],
          "Auxiliaire à l'imparfait + participe passé : plus-que-parfait."),
         ("Choisis l'accord correct : « Les fleurs sont ___ ».", "belles", ["beaux", "bel", "belle"], "L'adjectif s'accorde au féminin pluriel."),
         ("Quel mot est un synonyme de « néanmoins » ?", "cependant", ["ensuite", "donc", "parce que"], "« Néanmoins » marque une opposition ou concession."),
         ("Quelle phrase est à la voix passive ?", "La lettre est écrite par Sara.", ["Sara écrit la lettre.", "Sara écrira la lettre.", "Sara a écrit la lettre."],
          "Le sujet « la lettre » subit l'action."),
         ("Dans « Il faut que tu viennes », quel est le mode de « viennes » ?", "subjonctif", ["indicatif", "impératif", "conditionnel"],
          "« Il faut que » commande ici le subjonctif."),],
        [("Dans « Bien qu'il pleuve, nous sortons », la subordonnée exprime...", "la concession", ["la conséquence", "le but", "la cause"],
          "« Bien que » introduit une concession."),
         ("Quelle phrase utilise correctement le conditionnel passé ?", "J'aurais accepté si j'avais su.",
          ["J'accepterais si j'aurai su.", "J'aurai accepté si j'avais su.", "J'avais accepté si j'aurais su."],
          "L'irréel du passé associe plus-que-parfait et conditionnel passé."),
         ("Dans « Ce livre, je l'ai lu », « l' » est...", "un pronom personnel COD", ["un article défini", "un pronom relatif", "un adverbe"],
          "« L' » reprend « ce livre » comme complément d'objet direct."),
         ("Quelle phrase comporte une métaphore ?", "Cet homme est un lion.", ["Il court comme un lion.", "Il ressemble à un lion.", "Il voit un lion."],
          "L'identification directe sans outil comparatif constitue une métaphore."),
         ("Quel connecteur introduit une conséquence ?", "par conséquent", ["bien que", "malgré", "tandis que"],
          "« Par conséquent » introduit une conclusion ou conséquence."),
         ("Quelle forme est correctement accordée ?", "Les lettres qu'elle a écrites.",
          ["Les lettres qu'elle a écrite.", "Les lettres qu'elle a écrit.", "Les lettres qu'elle est écrit."],
          "Avec avoir, le participe s'accorde avec le COD placé avant."),],
        [("Dans « Quoiqu'il soit tard », « quoique » signifie...", "bien que", ["quoi que ce soit", "parce que", "de sorte que"],
          "En un mot, « quoique » est une conjonction concessive."),
         ("Quelle phrase emploie correctement « quelque » ?", "Quelques élèves sont absents.",
          ["Quelque élèves sont absents.", "Quelques élève est absent.", "Quelque élèves est absents."], "Déterminant pluriel devant « élèves » : « quelques »."),
         ("Dans « Elle s'est lavé les mains », pourquoi « lavé » reste-t-il invariable ?", "Le COD « les mains » suit le verbe.",
          ["Le verbe est au présent.", "Tous les verbes pronominaux sont invariables.", "Le sujet est féminin."], "Le COD est placé après le participe passé."),
         ("Quelle proposition est une interrogative indirecte ?", "Je me demande où il habite.", ["Quel beau quartier !", "Où habite-t-il ?", "Habite-t-il ici ?"],
          "La question est intégrée à une proposition dépendante."),
         ("Dans « À peine était-il parti que la pluie commença », l'inversion sert surtout à...", "marquer une construction temporelle soutenue",
          ["former une question directe", "indiquer une négation", "mettre au pluriel"], "La structure « à peine... que » peut entraîner l'inversion littéraire."),
         ("Quel énoncé contient une litote ?", "Ce n'est pas mauvais.", ["C'est absolument parfait.", "C'est très mauvais.", "C'est mauvais comme tout."],
          "La négation atténuée peut suggérer une appréciation positive."),],
    ],
    "en": [
        [("Choose the correct greeting for the morning.", "Good morning", ["See you later", "Good night", "Goodbye"], "« Good morning » is used as a morning greeting."),
         ("Complete: « I ___ a student. »", "am", ["is", "are", "be"], "The verb « be » takes « am » with « I »."),
         ("Which word means « pomme » ?", "apple", ["orange", "pear", "grape"], "« Apple » translates as « pomme »."),
         ("Choose the plural of « book ».", "books", ["bookies", "book's", "bookes"], "The regular plural adds -s."),
         ("Complete: « She ___ happy. »", "is", ["be", "am", "are"], "Third-person singular uses « is »."),
         ("Which sentence is a question ?", "Where are you?", ["You are here.", "I am here.", "They are here."], "The interrogative form asks for information."),],
        [("Complete: « He ___ football every Sunday. »", "plays", ["play", "playing", "played"], "Simple present third-person singular takes -s."),
         ("Choose the past tense of « go ».", "went", ["gone", "going", "goed"], "The simple past of « go » is « went »."),
         ("Which sentence is grammatically correct ?", "There are two cats.", ["There be two cats.", "There is two cats.", "There are a cat."],
          "Plural « two cats » takes « there are »."),
         ("Complete: « I have lived here ___ 2020. »", "since", ["for", "during", "until"], "« Since » introduces a starting point."),
         ("Which word is an adjective ?", "beautiful", ["beauty", "beautifully", "beautify"], "« Beautiful » describes a noun."),
         ("Complete: « Can you ___ me? »", "help", ["helped", "helping", "helps"], "A modal is followed by the bare infinitive."),],
        [("Complete: « If it rains, we ___ at home. »", "will stay", ["had stayed", "would stay", "stayed"], "First conditional uses present + will."),
         ("Choose the passive form of « They built the bridge ».", "The bridge was built.", ["The bridge has build.", "The bridge built.", "The bridge is building."],
          "Simple past passive uses was/were + past participle."),
         ("Complete: « She is interested ___ science. »", "in", ["on", "at", "for"], "The adjective « interested » takes « in »."),
         ("Choose the correct reported speech: « He said, 'I am tired.' »", "He said that he was tired.",
          ["He said that he is tired tomorrow.", "He said that he tired.", "He said that I am tired."], "Backshift commonly changes am to was."),
         ("Complete: « By the time we arrived, they ___ ».", "had left", ["will leave", "have left", "leave"], "Past perfect marks an earlier past event."),
         ("Which sentence uses a relative clause ?", "The teacher who called is here.", ["The teacher called.", "Call the teacher.", "The teacher is here."],
          "« Who called » modifies « the teacher »."),],
        [("Choose the correct inversion: « Rarely ___ such a result. »", "have we seen", ["we have seen", "we saw have", "seen we have"],
          "A negative-frequency adverb at the front triggers inversion."),
         ("Complete: « Had I known, I ___ earlier. »", "would have arrived", ["would arrive", "had arrived", "will arrive"],
          "Third conditional uses would have + past participle."),
         ("Choose the most natural collocation.", "make a decision", ["make a research", "do a decision", "take a homework"],
          "English commonly uses « make a decision »."),
         ("In « Despite being tired, she continued », « despite » introduces...", "concession", ["purpose", "result", "condition"],
          "« Despite » marks contrast with an obstacle."),
         ("Choose the correct form: « I wish I ___ more time. »", "had", ["have", "will have", "having"], "Wish about present unreal situation takes past form."),
         ("Which sentence contains a cleft construction ?", "It was Sara who solved the problem.",
          ["Sara may solve the problem.", "The problem was solved.", "Sara solved the problem."], "« It was... who... » foregrounds the person."),],
        [("Which sentence correctly uses the subjunctive in formal English ?", "It is essential that he be present.",
          ["It is essential that he being present.", "It is essential that he is be present.", "It is essential that he was be present."],
          "Mandative subjunctive uses base form « be »."),
         ("Complete: « No sooner had she arrived ___ the meeting began. »", "than", ["when", "then", "that"], "The fixed correlative is « no sooner... than »."),
         ("Which sentence is grammatically parallel ?", "She enjoys reading, writing, and swimming.",
          ["She enjoys reading, to write, and swimming.", "She enjoys read, writing, and to swim.", "She enjoys reading, wrote, and swim."],
          "All list elements use the -ing form."),
         ("What does « notwithstanding » mean in « Notwithstanding the delay, we finished » ?", "despite", ["after", "in addition to", "because of"],
          "« Notwithstanding » can mean « despite »."),
         ("Choose the correct reduced relative clause.", "The documents submitted yesterday were approved.",
          ["The documents to submitted yesterday were approved.", "The documents submitting yesterday were approved.",
           "The documents were submit yesterday approved."], "« Submitted yesterday » is a reduced passive relative."),
         ("Which option correctly completes « Scarcely ___ when the alarm rang » ?", "had we left", ["we had left", "we have leave", "did we leaving"],
          "Fronted « scarcely » requires auxiliary inversion."),],
    ],
    "ar": [
        [("ما جمع كلمة «كتاب»؟", "كتب", ["مكتبة", "كتابة", "كاتب"], "جمع «كتاب» هو «كتب»."),
         ("أكمل: «أنا ___ إلى المدرسة».", "أذهب", ["ذهبوا", "يذهب", "تذهبون"], "الفعل «أذهب» يناسب ضمير المتكلم المفرد."),
         ("أي كلمة تدل على لون؟", "أحمر", ["قلم", "يجري", "مدرسة"], "«أحمر» اسم لون."),
         ("ما ضد كلمة «كبير»؟", "صغير", ["طويل", "واسع", "قوي"], "«صغير» ضد «كبير»."),
         ("أي جملة اسمية؟", "الجو جميل.", ["اكتب الدرس.", "لن أتأخر.", "يقرأ الطفل."], "الجملة الاسمية تبدأ باسم."),
         ("ما المفرد من «أقلام»؟", "قلم", ["قلمات", "قلام", "قلمة"], "المفرد الصحيح هو «قلم»."),],
        [("ما نوع كلمة «يكتب»؟", "فعل مضارع", ["فعل ماض", "اسم فاعل", "حرف جر"], "«يكتب» فعل يدل على الحاضر أو المستقبل."),
         ("أكمل: «الطالبتان ___».", "مجتهدتان", ["مجتهدون", "مجتهدة", "مجتهد"], "الخبر يطابق المبتدأ المثنى المؤنث."),
         ("ما الفاعل في «قرأ التلميذ الدرس»؟", "التلميذ", ["الدرس", "لا يوجد فاعل", "قرأ"], "«التلميذ» من قام بالفعل."),
         ("ما جمع المؤنث السالم من «معلمة»؟", "معلمات", ["معلمين", "معلمون", "معالم"], "جمع المؤنث السالم يكون غالبا بزيادة ألف وتاء."),
         ("أي كلمة حرف جر؟", "إلى", ["هذا", "كتب", "جميل"], "«إلى» حرف جر."),
         ("ما علامة رفع المثنى؟", "الألف", ["الواو", "الياء", "الفتحة"], "يرفع المثنى بالألف."),],
        [("ما إعراب «العلم» في «إن العلم نور»؟", "اسم إن منصوب", ["خبر إن مرفوع", "مفعول به منصوب", "مبتدأ مرفوع"], "«العلم» اسم إن منصوب."),
         ("ما نوع «لم» في «لم يذهب»؟", "حرف نفي وجزم", ["حرف جر", "حرف نصب", "حرف عطف"], "«لم» تنفي وتجزم المضارع."),
         ("ما جمع التكسير من «رجل»؟", "رجال", ["رجلون", "رجلان", "رجلات"], "«رجال» جمع تكسير."),
         ("ما وظيفة «الذي» في «جاء الطالب الذي نجح»؟", "اسم موصول", ["حرف شرط", "اسم استفهام", "فعل ماض"], "«الذي» اسم موصول يربط الصلة بالموصول."),
         ("ما إعراب «مسرعا» في «عاد الطفل مسرعا»؟", "حال منصوب", ["مبتدأ", "مضاف إليه", "فاعل مرفوع"], "«مسرعا» يبين هيئة الطفل عند العودة."),
         ("أي أسلوب يتضمن تشبيها صريحا؟", "العلم كالنور", ["العلم طريق", "العلم نور", "العلم ينفع"], "الكاف أداة تشبيه ظاهرة."),],
        [("ما نوع الاستثناء في «حضر الطلاب إلا طالبا»؟", "تام مثبت", ["ناقص منفي", "تام منفي", "مفرغ"], "ذُكر المستثنى منه والكلام مثبت."),
         ("ما إعراب «الحق» في «لا تهمل الحق»؟", "مفعول به منصوب", ["فاعل مرفوع", "مبتدأ مرفوع", "مضاف إليه"], "«الحق» وقع عليه فعل الإهمال."),
         ("أي جملة تحتوي على استعارة مكنية؟", "ابتسم الصباح.", ["الصباح كالبدر.", "جاء الصباح مبكرا.", "الصباح جميل."],
          "أُسند الابتسام إلى الصباح على سبيل الاستعارة."),
         ("ما نوع «ما» في «ما أجمل السماء!»؟", "تعجبية", ["استفهامية", "نافية", "موصولة"], "التركيب «ما أفعل» من صيغ التعجب."),
         ("ما علامة نصب جمع المذكر السالم؟", "الياء", ["الواو", "الألف", "الضمة"], "ينصب جمع المذكر السالم بالياء."),
         ("ما وظيفة «كي» في «أدرس كي أنجح»؟", "حرف نصب وتعليل", ["حرف جر فقط", "حرف جزم", "حرف عطف"], "«كي» تنصب المضارع وتفيد التعليل."),],
        [("ما إعراب «زيد» في «ما جاء إلا زيد»؟", "فاعل مرفوع", ["مفعول به", "خبر مرفوع", "مستثنى منصوب وجوبا"],
          "الاستثناء المفرغ يعرب فيه الاسم بحسب موقعه؛ هنا فاعل."),
         ("أي جملة تتضمن طباقا؟", "يحيي ويميت", ["البحر واسع", "العلم نور", "جاء الرجل"], "«يحيي» و«يميت» لفظان متضادان."),
         ("ما نوع «إن» في «إن تجتهد تنجح»؟", "حرف شرط جازم", ["حرف توكيد ونصب", "حرف تفسير", "حرف نفي"], "«إن» الشرطية تجزم فعلين مضارعين."),
         ("ما نوع اللام في «ليكتب الطالب واجبه» إذا كانت بمعنى الأمر؟", "لام الأمر", ["لام التعليل", "لام الجر", "لام الابتداء"], "لام الأمر تجزم الفعل المضارع."),
         ("ما إعراب «طالب» في «يا طالب العلم اجتهد»؟", "منادى مضاف منصوب", ["فاعل مرفوع", "مبتدأ مرفوع", "منادى علم مبني"], "المنادى المضاف يكون منصوبا."),
         ("ما المحسن البديعي في «العلم يرفع والجهل يضع»؟", "مقابلة", ["تشبيه", "جناس تام", "سجع"], "تتجاور معان متقابلة في العبارة."),],
    ],
}
LANGUAGE_SUBJECT = {"fr": "french", "en": "english", "ar": "arabic"}


def language_items() -> list[dict]:
    items = []
    for lang, levels in LANGUAGE.items():
        for n, questions in enumerate(levels):
            for i, (question, correct, wrong, explanation) in enumerate(questions, 1):
                items.append(_q(LANGUAGE_SUBJECT[lang], "Langue", question, correct, wrong, explanation)
                             | {"key": f"L-{lang}-{n + 1}-{i}", "test_key": f"lang-{lang}-{n + 1}", "position": i, "kind": "language",
                                "level": f"{lang}-{n + 1}", "lang": lang, "difficulty": n + 1})
    return items


# --- Developer specification bank (GFEDU-0001 to GFEDU-0072) ---------------------------------------------------------
# (id, level or higher-education track, subject, skill, question, correct, wrong options, explanation)
SPEC = [
    (1, "1AP", "math", "Compter", "Combien font 2 + 3 ?", "5", ["4", "6", "7"], "2 + 3 = 5."),
    (2, "1AP", "math", "Comparer", "Quel nombre est le plus grand ?", "4", ["2", "1", "3"], "4 est le plus grand."),
    (3, "1AP", "sciences", "Éveil / Temps", "Quel moment vient après la nuit ?", "Le matin", ["Le soir", "Hier", "Le mois"], "Après la nuit vient le matin."),
    (4, "1AP", "french", "Langage / Vocabulaire", "Quel mot désigne un animal ?", "Chat", ["Table", "Porte", "Livre"], "Un chat est un animal."),
    (5, "2AP", "math", "Addition", "8 + 5 = ?", "13", ["11", "12", "14"], "8 + 5 = 13."),
    (6, "2AP", "math", "Soustraction", "15 - 7 = ?", "8", ["6", "7", "9"], "15 - 7 = 8."),
    (7, "2AP", "french", "Vocabulaire", "Quel mot est un fruit ?", "Pomme", ["Chaise", "Cahier", "Lampe"], "La pomme est un fruit."),
    (8, "2AP", "sciences", "Éveil / Corps humain", "Avec quel organe voit-on ?", "Yeux", ["Oreilles", "Nez", "Mains"], "On voit avec les yeux."),
    (9, "3AP", "math", "Multiplication", "4 × 3 = ?", "12", ["7", "14", "16"], "4 groupes de 3 font 12."),
    (10, "3AP", "math", "Mesures", "1 mètre = combien de centimètres ?", "100", ["10", "50", "1000"], "Un mètre vaut 100 centimètres."),
    (11, "3AP", "french", "Grammaire", "Dans « Le chat dort », quel est le verbe ?", "dort", ["Le", "chat", "aucun"], "Dort est le verbe."),
    (12, "3AP", "sciences", "Vivant", "De quoi une plante a-t-elle notamment besoin pour pousser ?", "Eau", ["Plastique", "Métal", "Verre"],
     "L’eau est nécessaire à la croissance."),
    (13, "4AP", "math", "Division", "24 ÷ 6 = ?", "4", ["3", "5", "6"], "6 × 4 = 24."),
    (14, "4AP", "math", "Fractions", "Quelle fraction représente la moitié ?", "1/2", ["1/4", "2/3", "3/4"], "Une moitié correspond à 1/2."),
    (15, "4AP", "french", "Accord", "Complétez : « Les filles sont ... »", "contentes", ["content", "contente", "contents"], "Le féminin pluriel est contentes."),
    (16, "4AP", "sciences", "États de l’eau", "À 0 °C, l’eau pure peut devenir :", "Glace", ["Vapeur", "Huile", "Sable"], "Elle peut se solidifier en glace."),
    (17, "5AP", "math", "Problèmes", "Un cahier coûte 40 DA. Combien coûtent 3 cahiers ?", "120 DA", ["80 DA", "100 DA", "140 DA"], "40 × 3 = 120 DA."),
    (18, "5AP", "math", "Géométrie", "Combien de côtés possède un triangle ?", "3", ["2", "4", "5"], "Un triangle possède trois côtés."),
    (19, "5AP", "french", "Conjugaison", "Choisissez le futur : « Demain, je ... »", "partirai", ["pars", "partais", "suis parti"], "Partirai est au futur simple."),
    (20, "5AP", "sciences", "Électricité", "Quel matériau conduit généralement l’électricité ?", "Cuivre", ["Bois sec", "Plastique", "Verre"], "Le cuivre est conducteur."),
    (21, "1AM", "math", "Nombres relatifs", "(-3) + 7 = ?", "4", ["-10", "-4", "10"], "-3 + 7 = 4."),
    (22, "1AM", "math", "Proportionnalité", "Si 2 kg coûtent 300 DA, 4 kg coûtent :", "600", ["450", "500", "900"], "Le double de 300 est 600."),
    (23, "1AM", "french", "Nature des mots", "Dans « rapidement », quelle est la nature du mot ?", "Adverbe", ["Nom", "Verbe", "Adjectif"], "Rapidement est un adverbe."),
    (24, "1AM", "sciences", "Cellule", "La cellule est :", "Une unité du vivant", ["Une planète", "Un métal", "Une force"],
     "La cellule est une unité fondamentale du vivant."),
    (25, "2AM", "math", "Fractions", "1/2 + 1/4 = ?", "3/4", ["1/6", "2/6", "1/8"], "2/4 + 1/4 = 3/4."),
    (26, "2AM", "math", "Géométrie", "La somme des angles d’un triangle vaut :", "180°", ["90°", "270°", "360°"], "La somme vaut 180°."),
    (27, "2AM", "physics", "Électricité", "Dans un circuit ouvert, le courant :", "Ne circule pas", ["Circule toujours", "Double", "Devient négatif"],
     "Le circuit ouvert interrompt le courant."),
    (28, "2AM", "english", "Présent simple", "She ... to school every day.", "goes", ["go", "going", "gone"], "À la troisième personne : goes."),
    (29, "3AM", "math", "Équations", "Résoudre 2x + 3 = 11.", "x=4", ["x=3", "x=5", "x=7"], "2x = 8 donc x = 4."),
    (30, "3AM", "math", "Pythagore", "Triangle rectangle de côtés 3 et 4 : hypoténuse ?", "5", ["6", "7", "8"], "3² + 4² = 25, racine = 5."),
    (31, "3AM", "physics", "Vitesse", "Une voiture parcourt 120 km en 2 h. Vitesse moyenne ?", "60 km/h", ["40 km/h", "50 km/h", "80 km/h"], "120 ÷ 2 = 60 km/h."),
    (32, "3AM", "french", "Argumentation", "Quel connecteur exprime la cause ?", "Parce que", ["Cependant", "Enfin", "Pourtant"], "Parce que introduit une cause."),
    (33, "4AM", "math", "Équations", "3(x - 2) = 12. x = ?", "6", ["4", "5", "8"], "x - 2 = 4 donc x = 6."),
    (34, "4AM", "math", "Statistiques", "Moyenne de 8, 10 et 12 ?", "10", ["9", "11", "12"], "(8+10+12)/3 = 10."),
    (35, "4AM", "physics", "Loi d’Ohm", "U = 12 V et R = 4 ohms. I = ?", "3 A", ["2 A", "4 A", "8 A"], "I = U/R = 3 A."),
    (36, "4AM", "french", "Grammaire", "« Bien que » introduit généralement :", "Une concession", ["Une addition", "Une conséquence", "Une comparaison"],
     "Bien que introduit une concession."),
    (37, "1AS", "math", "Fonctions", "Si f(x)=2x+1, f(3)= ?", "7", ["5", "6", "8"], "f(3)=2×3+1=7."),
    (38, "1AS", "physics", "Unités", "Unité SI de la force :", "Newton", ["Joule", "Watt", "Pascal"], "La force se mesure en newtons."),
    (39, "1AS", "sciences", "SVT / Génétique", "L’ADN porte principalement :", "L’information génétique", ["L’énergie thermique", "Le sang", "L’oxygène"],
     "L’ADN est support de l’information génétique."),
    (40, "1AS", "french", "Figures de style", "« Il est rapide comme l’éclair » est :", "Comparaison", ["Métaphore", "Hyperbole", "Oxymore"],
     "Le mot comme indique une comparaison."),
    (41, "2AS", "math", "Second degré", "Racines de x² - 9 = 0 ?", "-3 et 3", ["-9 et 9", "0 et 9", "1 et 9"], "x²=9 donc x=±3."),
    (42, "2AS", "physics", "Énergie cinétique", "Pour une masse m et vitesse v, Ec = ?", "1/2 mv²", ["mv", "mv²", "m/v"], "Ec = 1/2 mv²."),
    (43, "2AS", "sciences", "Photosynthèse", "La photosynthèse utilise principalement :", "Lumière et CO₂", ["Oxygène uniquement", "Azote uniquement", "Sable"],
     "La lumière et le CO₂ sont nécessaires."),
    (44, "2AS", "economics", "Marché", "Lorsque le prix augmente, la demande baisse généralement :", "Toutes choses égales par ailleurs",
     ["Toujours à zéro", "Seulement la nuit", "Jamais"], "C’est la relation usuelle, toutes choses égales par ailleurs."),
    (45, "3AS", "math", "Dérivation", "Dérivée de f(x)=x³ ?", "3x²", ["x²", "2x", "3x"], "(x³)’=3x²."),
    (46, "3AS", "math", "Probabilités", "Dé équilibré : probabilité d’obtenir 6 ?", "1/6", ["1/2", "1/3", "1/12"], "Une issue favorable sur six."),
    (47, "3AS", "physics", "Circuits", "Deux résistances en série de 2 et 3 ohms : résistance totale ?", "5", ["1", "6", "2/3"],
     "En série, les résistances s’additionnent."),
    (48, "3AS", "philosophy", "Méthodologie", "Une problématique de dissertation est :", "Une question directrice argumentée",
     ["Une simple citation", "Un résumé", "Une liste de dates"], "Elle organise la réflexion autour d’une question."),
    (49, "info_l1", "computer_science", "Algorithmique / Complexité", "Une recherche linéaire sur n éléments a une complexité au pire :", "O(n)",
     ["O(1)", "O(log n)", "O(n²)"], "Il faut potentiellement inspecter n éléments."),
    (50, "info_l1", "computer_science", "Programmation / Structures", "Une pile fonctionne selon :", "LIFO", ["FIFO", "Tri alphabétique", "Aléatoire"],
     "Dernier entré, premier sorti."),
    (51, "eng_l1", "math", "Algèbre linéaire", "Le déterminant de [[1,2],[3,4]] vaut :", "-2", ["2", "10", "0"], "1×4 - 2×3 = -2."),
    (52, "eng_l1", "physics", "Mécanique", "Deuxième loi de Newton :", "F=ma", ["E=mc²", "P=UI", "U=RI"], "La résultante des forces vaut ma."),
    (53, "com_l1", "management", "Comptabilité / Bilan", "L’équation fondamentale du bilan est :", "Actif = Passif",
     ["Ventes = Charges", "Résultat = Stocks", "Trésorerie = Capital"], "Le total de l’actif égale le total du passif."),
    (54, "com_l1", "management", "Marketing / Segmentation", "Segmenter un marché consiste à :", "Diviser les clients en groupes homogènes",
     ["Fixer un seul prix", "Supprimer les concurrents", "Créer une facture"], "La segmentation regroupe des profils proches."),
    (55, "eco_l1", "economics", "Microéconomie / Coût marginal", "Le coût marginal mesure :", "Coût d’une unité supplémentaire",
     ["Coût total / quantité", "Coût fixe uniquement", "Profit moyen"], "Il mesure la variation de coût pour une unité supplémentaire."),
    (56, "eco_l1", "math", "Statistiques / Moyenne", "Moyenne de 2, 4, 6 et 8 ?", "5", ["4", "6", "7"], "La somme 20 divisée par 4 vaut 5."),
    (57, "med_l1", "sciences", "Biologie / Cellule", "Quel organite produit l’essentiel de l’ATP dans la cellule eucaryote ?", "Mitochondrie",
     ["Noyau", "Ribosome", "Lysosome"], "La mitochondrie joue un rôle majeur dans la production d’ATP."),
    (58, "med_l1", "sciences", "Anatomie / Circulation", "Le cœur humain possède normalement :", "4 cavités", ["2 cavités", "3 cavités", "5 cavités"],
     "Deux oreillettes et deux ventricules."),
    (59, "law_l1", "law", "Droit / Normes", "Une constitution est généralement :", "Une norme fondamentale",
     ["Une simple facture", "Une décision privée", "Un contrat commercial"], "Elle organise les institutions et principes fondamentaux."),
    (60, "law_l1", "law", "Méthodologie / Cas pratique", "Le raisonnement juridique confronte :", "Faits et règles de droit",
     ["Deux publicités", "Deux prix", "Deux cartes"], "Il applique les règles pertinentes aux faits."),
    (61, "archi_l1", "math", "Géométrie / Échelles", "À l’échelle 1:100, 2 cm sur le plan représentent :", "2 m", ["20 cm", "20 m", "200 m"],
     "2 × 100 = 200 cm, soit 2 m."),
    (62, "archi_l1", "architecture", "Construction / Matériaux", "Le béton armé associe principalement :", "Béton et acier",
     ["Bois et verre", "Cuivre et papier", "Pierre et plastique"], "L’armature en acier complète le béton."),
    (63, "lang_l1", "languages", "Linguistique / Phonétique", "La phonétique étudie principalement :", "Les sons de la parole",
     ["Les prix", "Les équations", "Les climats"], "Elle décrit les sons du langage."),
    (64, "lang_l1", "languages", "Traduction / Sens", "Une bonne traduction vise d’abord à préserver :", "Le sens dans son contexte",
     ["Le nombre exact de lettres", "L’ordre de tous les mots", "La ponctuation uniquement"], "La fidélité au sens et au contexte prime."),
    (65, "bio_l1", "sciences", "Biologie / Génétique", "Dans l’ADN, l’adénine s’apparie avec :", "Thymine", ["Cytosine", "Guanine", "Uracile"],
     "A s’apparie avec T dans l’ADN."),
    (66, "bio_l1", "sciences", "Biochimie / Protéines", "Les protéines sont constituées de :", "Acides aminés",
     ["Nucléotides", "Acides gras uniquement", "Glucose uniquement"], "Les protéines sont des chaînes d’acides aminés."),
    (67, "math_l1", "math", "Analyse / Limites", "Limite de sin(x)/x lorsque x tend vers 0 :", "1", ["0", "Infini", "-1"],
     "C’est une limite remarquable égale à 1."),
    (68, "math_l1", "math", "Algèbre / Matrices", "La matrice identité I vérifie :", "AI=A", ["AI=0", "AI=I pour tout A", "AI=-A"],
     "Multiplier par l’identité conserve A."),
    (69, "mgmt_m1", "management", "Finance / VAN", "Une VAN positive signifie généralement que le projet :", "Crée de la valeur au taux retenu",
     ["Détruit de la valeur au taux retenu", "N’a aucun risque", "Est sans coût"], "Une VAN positive suggère une création de valeur selon les hypothèses."),
    (70, "mgmt_m1", "management", "Stratégie / SWOT", "SWOT distingue :", "Forces, faiblesses, opportunités, menaces",
     ["Ventes et salaires", "Actifs et passifs", "Produits et stocks"], "Ce sont les quatre dimensions SWOT."),
    (71, "info_m1", "computer_science", "Données / Apprentissage", "Le surapprentissage se manifeste souvent par :", "Écart train/test élevé",
     ["Bonne généralisation", "Aucune erreur train et test", "Modèle sans paramètres"], "Le modèle mémorise l’entraînement et généralise mal."),
    (72, "info_m1", "computer_science", "Sécurité / Chiffrement", "Le chiffrement asymétrique utilise :", "Une paire de clés",
     ["Une clé unique partagée", "Aucune clé", "Seulement un mot de passe"], "Il repose sur une clé publique et une clé privée."),
]
# Higher-education tracks, in the specification's order.
TRACKS = ["info_l1", "eng_l1", "com_l1", "eco_l1", "med_l1", "law_l1", "archi_l1", "lang_l1", "bio_l1", "math_l1", "mgmt_m1", "info_m1"]


def spec_items() -> list[dict]:
    items, position = [], {}
    for num, level, subject, skill, question, correct, wrong, explanation in SPEC:
        higher = level in TRACKS
        test_key = f"higher-{level}" if higher else f"express-{level}"
        position[test_key] = position.get(test_key, 0) + 1
        items.append(_q(subject, skill, question, correct, wrong, explanation)
                     | {"key": f"GFEDU-{num:04d}", "test_key": test_key, "position": position[test_key], "kind": "higher" if higher else "express",
                        "level": level, "lang": "fr", "difficulty": None})
    return items


def all_items() -> list[dict]:
    return class_items() + language_items() + spec_items()

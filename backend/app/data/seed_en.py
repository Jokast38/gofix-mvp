"""English names of the reference data. Applied by seed.seed_english() only where the field is empty, so a text changed in the
back office is never overwritten. Wilayas and communes keep their French spelling unless listed here."""

WILAYAS = {16: "Algiers"}
COMMUNES = {(16, "Alger"): "Algiers", (16, "Alger Centre"): "Algiers Centre"}

FAMILIES = {
    "home_services": "Home services", "building": "Building & Construction", "auto_moto": "Cars & Motorbikes", "beauty": "Beauty & Wellness",
    "tech": "IT & Electronics", "academy": "Tutoring / Academy", "food": "Food & Pastry", "transport": "Transport & Delivery",
    "wellness": "Health & Sports", "events": "Events & Photo",
}

CATEGORIES = {
    "plumber": "Plumber", "electrician": "Electrician", "air_conditioning": "Air conditioning", "cleaning": "Cleaning", "moving": "Moving",
    "locksmith": "Locksmith", "painter": "Painter", "mason": "Mason", "carpenter": "Carpenter", "tiler": "Tiler", "welder": "Welder / Ironworker",
    "car_mechanic": "Car mechanic", "auto_electrician": "Car electrician", "bodywork": "Body repair", "moto_repair": "Motorbike repair",
    "hairdresser": "Hairdresser", "beautician": "Beautician", "barber": "Barber", "computer_repair": "Computer repair", "phone_repair": "Phone repair",
    "network_installer": "Network / camera installer", "private_tutoring": "Private lessons", "garage": "Garage", "pastry": "Pastry",
    "cooking": "Cooking / Catering", "delivery": "Delivery", "transport": "Transport & Moving", "housekeeping": "Housekeeping", "languages": "Languages",
    "coaching": "Coaching", "health": "Health & Wellness", "fitness": "Sports & Fitness", "appliance_repair": "Home appliances", "gardening": "Gardening",
    "photography": "Photographer / Videographer", "events": "Event planning", "tailor": "Sewing / Alterations", "makeup": "Makeup",
    "web_dev": "Web development", "design": "Graphic design",
}

ROLES = {
    "independent": "Self-employed tradesperson", "company": "Company", "apprentice": "Apprentice",
    "private_teacher": "Private teacher", "institution_teacher": "Teacher in an institution",
}

SPECIALTIES = {
    "leak_repair": "Leak repair", "water_heater": "Water heater", "sanitary_install": "Sanitary installation", "panel_upgrade": "Electrical panel",
    "lighting": "Lighting", "ac_install": "AC installation", "ac_gas": "Gas recharge", "diagnosis": "Diagnostics", "brakes": "Brakes",
}

SUBJECTS = {
    "math": "Mathematics", "physics": "Physics-Chemistry", "sciences": "Natural sciences", "french": "French", "arabic": "Arabic", "english": "English",
    "philosophy": "Philosophy", "history_geo": "History-Geography", "computer_science": "Computer science", "tamazight": "Tamazight",
}

LEVELS = {
    "primary": "Primary school", "middle": "Middle school (CEM) – BEM", "secondary": "High school – BAC", "university": "University", "competitive": "Competitive exams",
}

PLANS = {
    "professional_free": ("Free", ["Receive requests: 30 days or 5 requests"]),
    "professional_pro": ("Pro", ["Unlimited requests", "Featured profile"]),
    "professional_premium": ("Premium", ["Unlimited requests", "Priority in results", "Statistics"]),
    "client_free": ("Free", ["Blurred list"]),
    "client_pro": ("Pro", ["Full profiles (N views/month)"]),
    "client_premium": ("Premium", ["Unlimited profiles", "Direct contact"]),
    "student_student_pass": ("Student Pass", ["Access to teachers", "Multiple requests"]),
}

# French question -> (question, answer, variants the chatbot also recognizes)
FAQ = {
    "Bonjour": ("Hello", "Hello and welcome to GoFix! Ask me your question: sign-up, plans, payment, tutoring, security…",
                ["hi", "hey", "good morning", "good evening"]),
    "Qu'est-ce que GoFix ?": ("What is GoFix?", "GoFix is an Algerian platform that connects individuals with trusted professionals (trades, services) and students with teachers (GoFix Academy).",
                              ["what does gofix do", "about gofix", "what is this site for"]),
    "GoFix est-il disponible dans toute l'Algérie ?": ("Is GoFix available throughout Algeria?", "Yes, GoFix covers all 58 wilayas. Filter the results by wilaya and commune to find a professional near you.",
                                                       ["which wilayas", "available in my city", "coverage"]),
    "Y a-t-il une application mobile ?": ("Is there a mobile app?", "The iOS and Android app is coming soon. In the meantime, install the web version from your browser (\"Add to home screen\").",
                                          ["android app", "iphone app", "download the app", "play store"]),
    "Comment fonctionne la recherche d'un professionnel ?": ("How does the search for a professional work?", "Choose a service and a wilaya: GoFix shows the matching professionals, ranked by relevance (trade, proximity, availability, trust, reviews).",
                                                             ["find a tradesperson", "find a plumber", "search for a service", "how are results ranked"]),
    "Comment créer un compte ?": ("How do I create an account?", "Click \"Sign up\", enter your name, your Algerian phone number (05, 06 or 07), your e-mail and a password, then accept the Terms of Use and the privacy policy.",
                                  ["sign up", "register", "open an account"]),
    "Je n'ai pas reçu le code SMS": ("I did not receive the SMS code", "Check the number you entered (format 05/06/07 xx xx xx xx), then request a new code after one minute. The code is valid for 5 minutes. If the problem persists, contact an advisor.",
                                     ["otp code", "sms not received", "no code", "verification code"]),
    "J'ai oublié mon mot de passe": ("I forgot my password", "On the Log in page, click \"Forgot your password?\": a reset link valid for 1 hour is sent to you by e-mail.",
                                     ["forgot password", "reset password", "change password", "cannot log in"]),
    "Quelle différence entre client, professionnel et professeur ?": ("What is the difference between a client, a professional and a teacher?", "A client looks for a service; a professional offers services; a teacher gives lessons through GoFix Academy. One account can be both client and professional (or teacher) thanks to the mode switch.",
                                                                      ["mode", "change role", "difference client pro", "mode switch"]),
    "Comment supprimer mon compte ?": ("How do I delete my account?", "In \"My account\", \"My data\" section, click \"Delete my account\" and confirm with your password. Your personal data is then erased.",
                                       ["delete account", "unsubscribe", "close my account", "erase my data"]),
    "Comment exporter mes données ?": ("How do I export my data?", "In \"My account\", \"My data\" section, click \"Export my data\": you download a file containing all the information about you.",
                                       ["download my data", "right of access", "copy of my data"]),
    "Comment devenir professionnel sur GoFix ?": ("How do I become a professional on GoFix?", "Click \"Become a pro\" and follow the 7 steps: identity, trade, status, areas, rates, photo and documents, summary. Your draft is saved automatically.",
                                                  ["professional registration", "offer my services", "become a tradesperson", "join gofix"]),
    "Mon métier n'est pas dans la liste": ("My trade is not in the list", "Choose \"Other\" at the Trade step and describe your activity: the request is sent to the GoFix team, who can add the category.",
                                           ["other trade", "missing category", "add a category"]),
    "Comment obtenir le badge « Vérifié » ?": ("How do I get the \"Verified\" badge?", "Send your documents (ID, trade register or craftsman card, diploma for teachers) from your space. After review by the team, the badge appears on your profile.",
                                               ["verified badge", "profile verification", "verification documents", "supporting documents"]),
    "Combien de temps dure l'accès gratuit pour les professionnels ?": ("How long does free access last for professionals?", "A free professional receives requests for 30 days or up to 5 requests (whichever comes first). After that, a Pro or Premium subscription is needed to read new requests.",
                                                                        ["free access", "trial period", "5 requests", "30 days", "blocked requests"]),
    "Qu'est-ce que l'indice de confiance (Trust Score) ?": ("What is the Trust Score?", "It is a score from 0 to 100 calculated from verifiable data: verified identity, approved documents, seniority, response rate, reviews and reports. It cannot be bought and is not a legal certification.",
                                                            ["trust score", "trust rating", "confidence score"]),
    "Comment contester mon indice de confiance ?": ("How do I appeal my Trust Score?", "In your dashboard, under \"My Trust Score\", view the calculation details and click \"Appeal\": the team reviews your request within 72 hours.",
                                                    ["appeal score", "trust score mistake", "score complaint"]),
    "Comment ajouter une photo de profil et une image de couverture ?": ("How do I add a profile photo and a cover image?", "In your dashboard, under \"My profile\", add a profile photo (square) and a cover image (banner format). JPG, PNG or WebP, 5 MB maximum.",
                                                                         ["profile photo", "cover image", "change my photo", "banner"]),
    "Comment publier une demande ?": ("How do I post a request?", "From the search or a profile, click \"Send a request\" and describe what you need: GoFix sends it to the most relevant professionals, who can accept or decline.",
                                      ["post a request", "ask for a quote", "send a request"]),
    "Comment suivre mes demandes ?": ("How do I follow my requests?", "Go to \"My requests\": each recipient shows their status (sent, seen, accepted, declined). An accepted request opens a conversation in messaging.",
                                      ["track a request", "request status", "my requests", "accepted request"]),
    "Comment laisser un avis ?": ("How do I leave a review?", "After an accepted request, open \"My requests\" and click \"Rate\". For a teacher, the rating is given per subject.",
                                  ["rate a professional", "give a review", "leave a rating"]),
    "Comment signaler un profil ou un message ?": ("How do I report a profile or a message?", "Click \"Report\" on the profile or message concerned and choose a reason. The moderation team reviews every report.",
                                                   ["report", "fake profile", "scam", "abuse", "harassment"]),
    "Pourquoi la liste des professionnels est-elle floutée ?": ("Why is the list of professionals blurred?", "With free access, you see the number and type of results. Names, photos and contact details are unlocked with a Pro or Premium plan.",
                                                                ["blurred list", "unlock the list", "why blurred", "hidden names"]),
    "Comment débloquer la liste des professionnels ?": ("How do I unlock the list of professionals?", "Click \"Unlock the list\", choose the Pro plan (full profiles, limited number of views) or Premium (unlimited + direct contact), then pay by CIB or Edahabia.",
                                                        ["unlock", "see the names", "access profiles", "see the phone number"]),
    "Quelles sont les offres et leurs prix ?": ("What are the plans and their prices?", "GoFix offers three plans: Free, Pro and Premium, as well as a Student Pass for the Academy. Prices in dinars and benefits are shown on the Plans page.",
                                                ["price", "prices", "rates", "subscription", "how much does it cost", "premium plan"]),
    "Mon abonnement se renouvelle-t-il automatiquement ?": ("Does my subscription renew automatically?", "No. There is no automatic debit: you receive a reminder before expiry and you renew manually from the Plans page.",
                                                            ["renewal", "automatic debit", "cancel subscription", "subscription expiry"]),
    "Comment payer mon abonnement ?": ("How do I pay for my subscription?", "Payment is made online by CIB or Edahabia card, on SATIM's secure page. No international card is needed.",
                                       ["payment", "cib", "edahabia", "dahabia card", "pay online"]),
    "Mon paiement a échoué, que faire ?": ("My payment failed, what should I do?", "No subscription is activated without confirmation from the payment server and you are not charged if it fails. Check your balance and your card limit, then try again from the Plans page.",
                                           ["payment declined", "payment error", "failed payment", "charged without subscription"]),
    "Y a-t-il un portefeuille ou une recharge de solde ?": ("Is there a wallet or balance top-up?", "No. Each subscription is paid directly, order by order. There is no wallet or top-up.",
                                                            ["wallet", "top up", "balance", "credit"]),
    "Où trouver ma facture ?": ("Where can I find my invoice?", "After each confirmed payment, a numbered invoice is available in \"My account\" > \"Subscription and invoices\", as a PDF download.",
                                ["invoice", "receipt", "download invoice", "proof of payment"]),
    "Comment trouver un professeur de soutien scolaire ?": ("How do I find a tutor?", "Go to \"Tutoring\", choose the subject, the level and your city (or \"online\"), then send your request to several teachers at once.",
                                                            ["private lessons", "maths teacher", "tutoring", "find a teacher"]),
    "Qu'est-ce que le Pass étudiant ?": ("What is the Student Pass?", "The Student Pass is a simple, low-cost access reserved for students: it unlocks teacher profiles and sending multiple requests.",
                                         ["student pass", "student subscription", "student plan"]),
    "Mon enfant a moins de 18 ans, peut-il s'inscrire ?": ("My child is under 18, can they sign up?", "Yes, with the explicit consent of a parent or guardian at registration. The data collected is kept to a minimum.",
                                                           ["minor", "child", "parental consent", "under 18"]),
    "Les cours se font-ils en ligne ou à domicile ?": ("Are lessons online or at home?", "Each teacher shows their formats: at home, online or at a center. Filter the list by the format that suits you.",
                                                       ["online lessons", "home lessons", "video lessons", "lesson format"]),
    "Mes données sont-elles protégées ?": ("Is my data protected?", "Your data is hosted in Algeria, encrypted in transit and processed in accordance with Law No. 18-07. You can export it or delete your account at any time.",
                                           ["personal data", "privacy", "data security"]),
    "Comment éviter les arnaques ?": ("How can I avoid scams?", "Favor \"Verified\" profiles with a good Trust Score, talk through GoFix messaging, never pay a suspicious deposit and report any doubtful behavior.",
                                      ["scam", "fraud", "safety tips", "reliable professional"]),
    "Comment contacter GoFix ?": ("How do I contact GoFix?", "Use the Contact page or click \"Talk to an advisor\" in the support bubble. An advisor will reply as soon as possible.",
                                  ["contact", "support", "advisor", "customer service", "talk to someone"]),
}

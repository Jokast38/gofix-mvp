// AUTO-COPIED from frontend/src/i18n/fr.legal.js — edit the web file, then run `npm run i18n:sync`.
// Textes légaux (CGU, CGV, confidentialité, mentions légales) — d'après les « Conditions générales GoFix » v1.0 fournies par
// GoFix Digital, adaptées au fonctionnement réel de la plateforme. Les champs {entre accolades} viennent du back-office
// (Société & mentions légales) ; un champ vide s'affiche « [à compléter] ». Fusionné après fr.lots2.js.
const legal = {
  legal: {
    disclaimer: "Textes en cours de validation juridique. Ils seront définitifs après relecture par un juriste algérien.",
    missing: "à compléter",
    version: "Version {legal_version} – en vigueur depuis le {legal_effective_date}",
    nav: "Autres documents",
    mentions: {
      title: "Mentions légales",
      sections: [
        { h: "Éditeur de la plateforme", items: [
          "Raison sociale : {company_name}", "Capital social : {company_capital}", "Registre de commerce (RC) : {company_rc}",
          "Numéro d'identification fiscale (NIF) : {company_nif}", "Numéro d'identification statistique (NIS) : {company_nis}",
          "Article d'imposition : {company_tax_article}", "Siège social : {company_address}",
        ] },
        { h: "Directeur de la publication", p: "{publication_director}" },
        { h: "Hébergement", p: "{hosting_provider}. Le site, l'API et les données de GoFix sont hébergés sur des serveurs situés en Algérie." },
        { h: "Contact", items: ["E-mail : {contact_email}", "Téléphone : {contact_phone}", "Signalement des abus : {abuse_email}",
          "Formulaire : page « Contact » du site et de l'application"] },
        { h: "Propriété intellectuelle", p: "La marque GoFix, les logos, graphismes, textes et logiciels de la plateforme sont protégés par l'ordonnance n° 03-05 du 19 juillet 2003 relative aux droits d'auteur et aux droits voisins et par l'ordonnance n° 03-06 du 19 juillet 2003 relative aux marques. Toute reproduction sans autorisation écrite est interdite." },
        { h: "Données personnelles", p: "Le traitement des données personnelles est décrit dans la Politique de confidentialité (loi n° 18-07 du 10 juin 2018). Déclaration auprès de l'Autorité nationale de protection des données à caractère personnel (ANPDP) : {anpdp_declaration}." },
      ],
    },
    cgu: {
      title: "Conditions générales d'utilisation",
      sections: [
        { h: "Préambule", p: [
          "Les présentes Conditions générales d'utilisation (« CGU ») définissent les règles d'accès et d'utilisation de la plateforme GoFix, éditée par {company_name} (« GoFix », « nous »), disponible sur le site internet et l'application mobile.",
          "GoFix propose aujourd'hui deux services : GoFix Services, la mise en relation entre des clients (particuliers ou entreprises) et des professionnels ou artisans ; et GoFix Academy, la mise en relation entre des élèves (ou leurs parents) et des professeurs pour du soutien scolaire et des cours particuliers, à domicile, en ligne ou en centre.",
          "D'autres services sont en préparation (paiement sécurisé des prestations, formations en ligne certifiantes, GoFix Jobs, appels audio et vidéo). Ils ne sont pas encore ouverts : leurs conditions spécifiques seront publiées avant leur lancement.",
          "Les CGU s'appliquent conformément à la législation algérienne, notamment la loi n° 18-05 du 10 mai 2018 relative au commerce électronique et la loi n° 18-07 du 10 juin 2018 relative à la protection des personnes physiques dans le traitement des données à caractère personnel.",
        ] },
        { h: "Définitions", items: [
          "Utilisateur : toute personne physique ou morale qui accède à la plateforme.",
          "Client : utilisateur qui recherche un professionnel ou publie une demande de prestation.",
          "Professionnel / Artisan : prestataire inscrit sur GoFix Services dont la fiche a été validée.",
          "Professeur : enseignant inscrit sur GoFix Academy dont la fiche a été validée.",
          "Élève : utilisateur de GoFix Academy ; s'il est mineur, il agit avec l'accord de son représentant légal.",
          "Compte : espace personnel protégé par un mot de passe ; un même compte peut cumuler plusieurs rôles.",
          "Abonnement : offre payante donnant accès à des fonctionnalités supplémentaires (voir les CGV).",
          "Indice de confiance (Trust Score) : indicateur calculé à partir de la vérification des pièces, de la réactivité, de la satisfaction et de la fiabilité.",
        ] },
        { h: "Acceptation des conditions", p: "La création d'un compte et l'utilisation de la plateforme impliquent l'acceptation sans réserve des présentes CGU et de la Politique de confidentialité. Cette acceptation est enregistrée et horodatée lors de l'inscription." },
        { h: "Article 1 – Inscription", p: "L'inscription se fait avec une adresse e-mail, un numéro de téléphone mobile algérien et un mot de passe. GoFix peut vérifier le numéro par un code à usage unique (OTP) envoyé par SMS. Les professionnels et professeurs complètent ensuite leur fiche (métier ou matières, zones, disponibilités) et transmettent leurs justificatifs ; la fiche est publiée après validation par GoFix." },
        { h: "Article 2 – Capacité", p: "L'utilisateur déclare avoir la capacité juridique de contracter (être majeur ou mineur émancipé). Pour un mineur non émancipé, l'accord d'un représentant légal est obligatoire : il est recueilli et horodaté lors de l'inscription, avec les coordonnées du parent ou du tuteur." },
        { h: "Article 3 – Exactitude des informations", p: "L'utilisateur s'engage à fournir des informations exactes et sincères et à les tenir à jour depuis « Mon compte ». Toute fausse déclaration, notamment sur l'identité, les qualifications ou les justificatifs, entraîne la suspension immédiate du compte." },
        { h: "Article 4 – Sécurité du compte", p: "L'utilisateur est seul responsable de la confidentialité de son mot de passe et des codes reçus. Toute action effectuée depuis son compte est présumée émaner de lui. En cas de doute, il change son mot de passe (« Mot de passe oublié ») et prévient GoFix via la page Contact." },
        { h: "Article 5 – Rôle de la plateforme", p: "GoFix est une plateforme technique de mise en relation. Elle n'est pas partie aux contrats conclus entre clients et professionnels ou entre élèves et professeurs, qui fixent librement le prix et les modalités de la prestation. GoFix n'est ni employeur, ni mandant, ni assureur des professionnels et professeurs." },
        { h: "Article 6 – Coordonnées et contournement", p: [
          "Les coordonnées des professionnels et professeurs (nom complet, téléphone, photo) ne sont visibles que selon l'offre souscrite. Il est interdit de contourner ce mécanisme, de collecter des coordonnées en masse ou d'utiliser la plateforme pour solliciter les utilisateurs dans le but d'échapper à ses règles (avis vérifiés, signalement, modération, abonnements).",
          "Sanctions : avertissement, puis suspension ; en cas de récidive, bannissement définitif, sans préjudice de poursuites judiciaires.",
        ] },
        { h: "Article 7 – Communication intégrée", p: "Avant une prestation, les échanges se font de préférence par la messagerie GoFix : elle permet la modération, le signalement et le traitement des litiges. GoFix ne peut intervenir sur des échanges menés hors de la plateforme." },
        { h: "Article 8 – Avis et indice de confiance", p: "Seul un client ayant eu un rendez-vous terminé avec le professionnel ou le professeur peut laisser un avis. L'indice de confiance est un indicateur informatif et non une certification : il ne peut pas être acheté (un abonnement n'a aucun effet sur son calcul) et peut être contesté depuis l'espace professionnel. Les faux avis sont interdits." },
        { h: "Article 9 – Propriété intellectuelle", p: [
          "Les marques, logos, graphismes, textes, photographies et logiciels de la plateforme sont la propriété exclusive de GoFix ou de ses partenaires (ordonnances n° 03-05 et 03-06 du 19 juillet 2003). Toute reproduction ou représentation, totale ou partielle, sans autorisation préalable est interdite.",
          "L'utilisateur garantit détenir les droits sur les contenus qu'il publie (photos, descriptions, avis) et concède à GoFix une licence gratuite et non exclusive pour les afficher sur la plateforme pendant la durée de leur publication.",
        ] },
        { h: "Article 10 – Usages détournés", items: [
          "Contournement des mécanismes de la plateforme (déverrouillage, paiement, avis).",
          "Fausses annulations, faux rendez-vous ou faux avis.",
          "Usurpation d'identité, faux documents ou fausses qualifications.",
          "Contenus illicites, trompeurs, discriminatoires ou contraires à l'ordre public.",
          "Spam, prospection non sollicitée, collecte automatisée de données.",
        ] },
        { h: "Article 11 – Statut d'intermédiaire", p: "GoFix agit en qualité d'intermédiaire technique et n'a pas d'obligation générale de surveillance des contenus publiés par les utilisateurs. Elle retire promptement tout contenu manifestement illicite qui lui est signalé et peut suspendre le compte concerné." },
        { h: "Article 12 – Responsabilité", p: [
          "GoFix est tenue à une obligation de moyens pour le fonctionnement de la plateforme. Elle ne peut être tenue responsable des ralentissements liés aux réseaux de télécommunication, des dysfonctionnements du matériel de l'utilisateur, des opérations de maintenance, ni des cas de force majeure (catastrophes naturelles, grèves, pannes majeures des réseaux, cyberattaques, décisions administratives…).",
          "La qualité, le prix et l'exécution des prestations relèvent de la seule responsabilité des parties. Le montant total des dommages-intérêts pouvant être mis à la charge de GoFix est limité aux sommes versées par l'utilisateur à GoFix au cours des six (6) mois précédant le litige. Les dommages indirects (perte de chiffre d'affaires, préjudice commercial, manque à gagner) sont exclus.",
        ] },
        { h: "Article 13 – Tolérance zéro", p: [
          "GoFix applique une politique de « tolérance zéro » envers tout comportement inapproprié, verbal ou physique : harcèlement moral ou sexuel, violence verbale ou physique, intimidation, abus ou exploitation.",
          "Fondements : Constitution algérienne, Code pénal (notamment tel que modifié par la loi n° 04-15 du 10 novembre 2004), loi n° 90-11 du 21 avril 1990 relative aux relations de travail.",
        ] },
        { h: "Article 14 – Signalement", p: [
          "Tout utilisateur peut signaler un profil, un message ou un comportement : bouton « Signaler » dans la plateforme, e-mail {abuse_email} ou formulaire de contact (numéro vert à venir).",
          "GoFix accuse réception sous 24 heures, peut prendre des mesures conservatoires (masquage, suspension), mène une vérification interne (en principe sous 5 à 10 jours) et transmet aux autorités compétentes tout fait susceptible de constituer une infraction pénale. Aucune représaille n'est tolérée contre une personne ayant signalé de bonne foi.",
        ] },
        { h: "Article 15 – Échelle des sanctions", table: { head: ["Gravité", "Comportement", "Sanction"], rows: [
          ["Niveau 1", "Propos déplacés isolés", "Avertissement"],
          ["Niveau 2", "Insultes, intimidation", "Suspension de 15 à 30 jours"],
          ["Niveau 3", "Harcèlement, menaces", "Bannissement définitif et signalement aux autorités"],
          ["Niveau 4", "Agression physique, violences", "Bannissement immédiat et plainte systématique"],
        ] }, p: "Pour les professionnels et professeurs, la sanction peut inclure le retrait de la fiche et l'inscription sur une liste interne interdisant toute réinscription. GoFix oriente les victimes vers les services d'aide et les autorités compétentes et coopère avec elles." },
        { h: "Article 16 – Litiges", items: [
          "1. Recherche d'une solution amiable entre les parties.",
          "2. Médiation GoFix : pour un rendez-vous pris sur la plateforme, un litige peut être ouvert dans les 7 jours suivant la prestation ; la décision est notifiée aux deux parties.",
          "3. Médiation professionnelle (Chambre algérienne de commerce et d'industrie).",
          "4. À défaut, compétence des tribunaux d'Alger.",
        ] },
        { h: "Article 17 – Modification des conditions", p: "GoFix peut modifier les présentes CGU. Les utilisateurs sont informés de toute modification importante par notification avant son entrée en vigueur ; la poursuite de l'utilisation vaut acceptation de la nouvelle version." },
        { h: "Article 18 – Droit applicable et dispositions finales", p: "Les CGU sont régies par le droit algérien ; tout litige relève de la compétence exclusive des tribunaux d'Alger. Le fait pour GoFix de ne pas se prévaloir d'une disposition ne vaut pas renonciation. Si une clause était déclarée nulle, les autres resteraient en vigueur." },
      ],
    },
    cgv: {
      title: "Conditions générales de vente",
      sections: [
        { h: "Article 1 – Objet", p: "Les présentes Conditions générales de vente (« CGV ») s'appliquent aux offres payantes souscrites sur GoFix (abonnements des clients, des professionnels, des professeurs et des élèves). Elles complètent les CGU. Le vendeur est {company_name}, {company_address}, RC {company_rc}, NIF {company_nif}." },
        { h: "Article 2 – Offres et prix", p: [
          "Les offres (Gratuit, Pro, Premium, Pass étudiant) et leur contenu sont décrits sur la page « Offres ». Les prix sont indiqués en dinars algériens (DA), toutes taxes comprises ; le prix applicable est celui affiché au moment de la commande.",
          "Les nouveaux professionnels et professeurs bénéficient d'un accès gratuit de découverte dont la durée et le nombre de demandes sont indiqués dans leur espace.",
        ] },
        { h: "Article 3 – Conditions propres aux professionnels", items: [
          "Être immatriculé au Registre de commerce ou titulaire d'une carte d'artisan en cours de validité (ou justifier du statut adapté pour les professeurs).",
          "Fournir les justificatifs demandés : pièce d'identité, RC ou carte d'artisan, NIF, diplômes le cas échéant. Les pièces sont conservées dans un espace privé et ne sont vues que par l'équipe de validation.",
          "Être couvert par une assurance de responsabilité civile professionnelle adaptée à l'activité, dont GoFix peut demander le justificatif à tout moment.",
          "Garantir détenir les droits sur les photos publiées (photo, couverture, réalisations).",
        ] },
        { h: "Article 4 – Commande et paiement", p: [
          "Le paiement s'effectue en ligne par carte CIB ou Edahabia sur la page sécurisée de la SATIM. Les données de carte sont saisies uniquement chez la SATIM : GoFix ne les reçoit ni ne les conserve.",
          "L'abonnement est activé dès que le paiement est confirmé par la SATIM au serveur de GoFix. Un paiement refusé ou annulé n'entraîne aucun débit et aucune activation.",
        ] },
        { h: "Article 5 – Durée et renouvellement", p: "Chaque abonnement est conclu pour la durée indiquée dans l'offre. Il n'est pas reconduit automatiquement : aucun prélèvement n'a lieu sans nouvelle commande. Des rappels sont envoyés avant l'échéance ; à expiration, le compte repasse à l'offre gratuite sans perte des données." },
        { h: "Article 6 – Facturation", p: "Une facture numérotée, portant les mentions légales du vendeur, est émise après chaque paiement et téléchargeable depuis « Abonnement et factures ». Les registres informatisés de GoFix font foi des transactions, conformément à la législation en vigueur sur la preuve électronique." },
        { h: "Article 7 – Réclamations et remboursement", p: "Toute réclamation est adressée via la page Contact ou à {contact_email}, en précisant le numéro de commande. En cas de double paiement ou d'activation impossible imputable à GoFix, la somme indue est remboursée. Les droits du consommateur prévus par la loi n° 18-05 du 10 mai 2018 relative au commerce électronique restent applicables." },
        { h: "Article 8 – Annulations de rendez-vous et fiabilité", p: "Les annulations tardives ou répétées d'un professionnel ou d'un professeur réduisent son indice de confiance. En cas d'abus répétés, GoFix peut adresser un avertissement puis suspendre la fiche ; une nouvelle récidive peut entraîner le bannissement définitif." },
        { h: "Article 9 – Fraude au paiement", p: "Toute fraude ou tentative de fraude au paiement (moyen de paiement volé, contestation abusive) entraîne la suspension immédiate du compte, sans préjudice de poursuites." },
        { h: "Article 10 – Partenaires bancaires", p: "GoFix ne peut être tenue responsable de l'indisponibilité des systèmes de paiement CIB ou Edahabia, des refus de paiement décidés par les banques, des retards de traitement bancaire ni des difficultés liées au compte bancaire de l'utilisateur." },
        { h: "Article 11 – Services à venir", p: "Les services suivants, annoncés dans la feuille de route de GoFix, ne sont pas encore ouverts et ne font l'objet d'aucune vente à ce jour : paiement sécurisé des prestations avec séquestre des fonds jusqu'à la bonne exécution (commission annoncée de 15 % HT par transaction), mise en avant payante « Sponsorisé » (Boost), formations en ligne avec certificats (GoFix Academy e-learning), GoFix Jobs (recrutement) et appels audio ou vidéo. Leurs conditions spécifiques seront publiées et acceptées avant toute souscription." },
      ],
    },
    privacy: {
      title: "Politique de confidentialité",
      sections: [
        { h: "Responsable du traitement", p: "{company_name}, {company_address}. Contact pour toute question relative à vos données : {contact_email}. Déclaration auprès de l'ANPDP : {anpdp_declaration}. La présente politique applique la loi n° 18-07 du 10 juin 2018." },
        { h: "Hébergement", p: [
          "Les données sont hébergées en Algérie ({hosting_provider}).",
          "Deux services techniques interviennent hors de nos serveurs : la SATIM (Algérie) pour le paiement par carte ; et, si vous les activez, les notifications push du téléphone, dont le titre et un court extrait transitent par les services d'Apple ou de Google (via Expo) pour être affichés sur votre appareil.",
        ] },
        { h: "Données collectées", table: { head: ["Catégorie", "Exemples", "Utilisation"], rows: [
          ["Identification et contact", "Nom, e-mail, téléphone, photo de profil (facultative), wilaya", "Compte, mise en relation, assistance"],
          ["Profil professionnel", "Métier ou matières, zones, disponibilités, tarifs indicatifs, réalisations", "Fiche publique, recherche, AI MATCH"],
          ["Justificatifs", "Pièce d'identité, RC, NIF, diplômes", "Vérification ; stockage privé, accès limité à l'équipe de validation"],
          ["Activité", "Demandes, messages, rendez-vous, avis, signalements", "Service, modération, indice de confiance, litiges"],
          ["Paiement", "Commandes, montants, factures (aucune donnée de carte)", "Abonnements, comptabilité"],
          ["Localisation (facultative)", "Position approximative, sur demande", "Proposer votre wilaya ; la position n'est pas conservée"],
          ["Appareil (facultatif)", "Jeton de notification du téléphone", "Envoyer les notifications que vous avez acceptées"],
          ["Sécurité", "Adresse IP, journaux techniques", "Prévention des abus et de la fraude, journal d'audit"],
        ] } },
        { h: "Mineurs", p: "Pour un élève mineur, le consentement d'un parent ou d'un tuteur est recueilli et horodaté. Seules les données nécessaires au soutien scolaire sont traitées ; aucun résultat ou profil d'élève n'est rendu public." },
        { h: "Destinataires", p: "Les données de votre fiche sont visibles par les autres utilisateurs selon leur offre ; vos coordonnées complètes ne sont partagées qu'avec les personnes avec qui vous êtes en relation. Les données sont accessibles à l'équipe GoFix habilitée, à la SATIM et aux banques pour les paiements, et aux autorités sur réquisition légale. GoFix ne vend ni ne loue vos données et n'utilise aucun traceur publicitaire." },
        { h: "Durées de conservation", items: [
          "Compte inactif : 36 mois, puis suppression.",
          "Messages : 24 mois.",
          "Journaux de sécurité et d'audit : 12 mois.",
          "Pièces comptables (commandes, factures) : 10 ans (obligation légale).",
          "Justificatifs des professionnels : pendant la durée d'activité de la fiche.",
        ] },
        { h: "Vos droits", p: "Vous disposez des droits d'accès, de rectification, d'effacement et d'opposition. Depuis « Mon compte », vous pouvez modifier vos informations, exporter vos données et supprimer votre compte : vos fichiers sont alors effacés et votre nom est anonymisé dans les échanges conservés pour l'autre partie. Pour toute demande : {contact_email}. Vous pouvez également saisir l'ANPDP." },
        { h: "Sécurité", p: "Échanges chiffrés (HTTPS/TLS), mots de passe chiffrés de manière irréversible, pièces d'identité en stockage privé, contrôle d'accès par rôle, journal d'audit des actions sensibles et sauvegardes régulières." },
        { h: "Cookies et stockage local", p: "GoFix n'utilise que le stockage technique nécessaire au fonctionnement (session, langue, thème). Aucun cookie publicitaire ni outil de mesure d'audience tiers n'est utilisé." },
        { h: "Notifications et localisation", p: "Les notifications push et la localisation ne sont activées qu'avec votre accord, demandé par l'application. Vous pouvez les retirer à tout moment dans les réglages de votre téléphone ; à la déconnexion, votre appareil ne reçoit plus les notifications du compte." },
        { h: "Modifications", p: "Cette politique peut évoluer ; toute modification importante vous est notifiée avant son entrée en vigueur." },
      ],
    },
  },
};

export default legal;

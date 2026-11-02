// AUTO-COPIED from frontend/src/i18n/en.legal.js — edit the web file, then run `npm run i18n:sync`.
// Legal texts (Terms of Use, Terms of Sale, privacy, legal notice): English translation of fr.legal.js, which remains the reference.
// The {bracketed} fields come from the back office (Company & legal notice); an empty field shows "[to be completed]". Merged after en.lots2.js.
const legal = {
  legal: {
    disclaimer: "Texts under legal review: they will be final once reviewed by an Algerian lawyer. This English version is a translation for information only; the French version prevails.",
    missing: "to be completed",
    version: "Version {legal_version} – in force since {legal_effective_date}",
    nav: "Other documents",
    mentions: {
      title: "Legal notice",
      sections: [
        { h: "Publisher of the platform", items: [
          "Company name: {company_name}", "Share capital: {company_capital}", "Trade register (RC): {company_rc}",
          "Tax identification number (NIF): {company_nif}", "Statistical identification number (NIS): {company_nis}",
          "Tax article: {company_tax_article}", "Registered office: {company_address}",
        ] },
        { h: "Publication director", p: "{publication_director}" },
        { h: "Hosting", p: "{hosting_provider}. The GoFix website, API and data are hosted on servers located in Algeria." },
        { h: "Contact", items: ["E-mail: {contact_email}", "Phone: {contact_phone}", "Abuse reports: {abuse_email}",
          "Form: \"Contact\" page of the website and the app"] },
        { h: "Intellectual property", p: "The GoFix brand, logos, graphics, texts and software of the platform are protected by Ordinance No. 03-05 of 19 July 2003 on copyright and related rights and by Ordinance No. 03-06 of 19 July 2003 on trademarks. Any reproduction without written permission is prohibited." },
        { h: "Personal data", p: "The processing of personal data is described in the Privacy Policy (Law No. 18-07 of 10 June 2018). Declaration to the National Authority for the Protection of Personal Data (ANPDP): {anpdp_declaration}." },
      ],
    },
    cgu: {
      title: "Terms of Use",
      sections: [
        { h: "Preamble", p: [
          "These Terms of Use (the \"Terms\") set out the rules for accessing and using the GoFix platform, published by {company_name} (\"GoFix\", \"we\"), available on the website and the mobile app.",
          "GoFix currently offers two services: GoFix Services, which connects clients (individuals or businesses) with professionals or tradespeople; and GoFix Academy, which connects students (or their parents) with teachers for tutoring and private lessons, at home, online or at a center.",
          "Other services are in preparation (secure payment for jobs, certified online training, GoFix Jobs, audio and video calls). They are not open yet: their specific terms will be published before launch.",
          "The Terms apply in accordance with Algerian legislation, in particular Law No. 18-05 of 10 May 2018 on e-commerce and Law No. 18-07 of 10 June 2018 on the protection of natural persons in the processing of personal data.",
        ] },
        { h: "Definitions", items: [
          "User: any natural or legal person who accesses the platform.",
          "Client: a user who looks for a professional or posts a service request.",
          "Professional / Tradesperson: a service provider registered on GoFix Services whose profile has been approved.",
          "Teacher: an educator registered on GoFix Academy whose profile has been approved.",
          "Student: a user of GoFix Academy; if a minor, they act with the agreement of their legal representative.",
          "Account: a personal space protected by a password; one account can hold several roles.",
          "Subscription: a paid plan giving access to additional features (see the Terms of Sale).",
          "Trust Score: an indicator calculated from document verification, responsiveness, satisfaction and reliability.",
        ] },
        { h: "Acceptance of the terms", p: "Creating an account and using the platform implies unreserved acceptance of these Terms and of the Privacy Policy. This acceptance is recorded and time-stamped at registration." },
        { h: "Article 1 – Registration", p: "Registration requires an e-mail address, an Algerian mobile phone number and a password. GoFix may verify the number with a one-time password (OTP) sent by SMS. Professionals and teachers then complete their profile (trade or subjects, areas, availability) and submit their supporting documents; the profile is published after approval by GoFix." },
        { h: "Article 2 – Capacity", p: "The user declares that they have the legal capacity to enter into contracts (being of age or an emancipated minor). For a non-emancipated minor, the agreement of a legal representative is mandatory: it is collected and time-stamped at registration, along with the contact details of the parent or guardian." },
        { h: "Article 3 – Accuracy of information", p: "The user undertakes to provide accurate and truthful information and to keep it up to date from \"My account\". Any false statement, in particular regarding identity, qualifications or supporting documents, results in the immediate suspension of the account." },
        { h: "Article 4 – Account security", p: "The user is solely responsible for the confidentiality of their password and of the codes received. Any action carried out from their account is presumed to come from them. If in doubt, they change their password (\"Forgot password\") and notify GoFix via the Contact page." },
        { h: "Article 5 – Role of the platform", p: "GoFix is a technical platform for connecting people. It is not a party to the contracts concluded between clients and professionals or between students and teachers, who freely set the price and terms of the service. GoFix is neither the employer, the principal nor the insurer of professionals and teachers." },
        { h: "Article 6 – Contact details and circumvention", p: [
          "The contact details of professionals and teachers (full name, phone, photo) are only visible according to the plan subscribed to. It is forbidden to circumvent this mechanism, to collect contact details in bulk or to use the platform to solicit users in order to escape its rules (verified reviews, reporting, moderation, subscriptions).",
          "Sanctions: warning, then suspension; in the event of a repeat offense, permanent ban, without prejudice to legal action.",
        ] },
        { h: "Article 7 – Built-in communication", p: "Before a job, communication should preferably take place through GoFix messaging: it allows moderation, reporting and dispute handling. GoFix cannot intervene in exchanges conducted outside the platform." },
        { h: "Article 8 – Reviews and Trust Score", p: "Only a client who has completed an appointment with the professional or teacher can leave a review. The Trust Score is an informative indicator and not a certification: it cannot be bought (a subscription has no effect on its calculation) and can be appealed from the professional space. Fake reviews are prohibited." },
        { h: "Article 9 – Intellectual property", p: [
          "The trademarks, logos, graphics, texts, photographs and software of the platform are the exclusive property of GoFix or its partners (Ordinances No. 03-05 and 03-06 of 19 July 2003). Any full or partial reproduction or representation without prior permission is prohibited.",
          "The user guarantees that they hold the rights to the content they publish (photos, descriptions, reviews) and grants GoFix a free, non-exclusive license to display it on the platform for the duration of its publication.",
        ] },
        { h: "Article 10 – Misuse", items: [
          "Circumventing the platform's mechanisms (unlocking, payment, reviews).",
          "False cancellations, fake appointments or fake reviews.",
          "Identity theft, fake documents or fake qualifications.",
          "Illegal, misleading or discriminatory content, or content contrary to public order.",
          "Spam, unsolicited marketing, automated data collection.",
        ] },
        { h: "Article 11 – Intermediary status", p: "GoFix acts as a technical intermediary and has no general obligation to monitor the content published by users. It promptly removes any manifestly illegal content reported to it and may suspend the account concerned." },
        { h: "Article 12 – Liability", p: [
          "GoFix is bound by an obligation of means for the operation of the platform. It cannot be held liable for slowdowns linked to telecommunications networks, malfunctions of the user's equipment, maintenance operations, or cases of force majeure (natural disasters, strikes, major network failures, cyberattacks, administrative decisions…).",
          "The quality, price and performance of services are the sole responsibility of the parties. The total amount of damages that may be charged to GoFix is limited to the sums paid by the user to GoFix during the six (6) months preceding the dispute. Indirect damages (loss of turnover, commercial harm, loss of earnings) are excluded.",
        ] },
        { h: "Article 13 – Zero tolerance", p: [
          "GoFix applies a \"zero tolerance\" policy towards any inappropriate behavior, verbal or physical: moral or sexual harassment, verbal or physical violence, intimidation, abuse or exploitation.",
          "Legal basis: the Algerian Constitution, the Penal Code (in particular as amended by Law No. 04-15 of 10 November 2004), Law No. 90-11 of 21 April 1990 on labor relations.",
        ] },
        { h: "Article 14 – Reporting", p: [
          "Any user can report a profile, a message or a behavior: \"Report\" button on the platform, e-mail {abuse_email} or the contact form (toll-free number to come).",
          "GoFix acknowledges receipt within 24 hours, may take protective measures (hiding, suspension), carries out an internal review (in principle within 5 to 10 days) and passes on to the competent authorities any facts likely to constitute a criminal offense. No retaliation is tolerated against a person who has reported in good faith.",
        ] },
        { h: "Article 15 – Scale of sanctions", table: { head: ["Severity", "Behavior", "Sanction"], rows: [
          ["Level 1", "Isolated inappropriate remarks", "Warning"],
          ["Level 2", "Insults, intimidation", "Suspension of 15 to 30 days"],
          ["Level 3", "Harassment, threats", "Permanent ban and report to the authorities"],
          ["Level 4", "Physical assault, violence", "Immediate ban and systematic complaint"],
        ] }, p: "For professionals and teachers, the sanction may include the removal of the profile and listing on an internal register preventing any re-registration. GoFix directs victims to support services and the competent authorities and cooperates with them." },
        { h: "Article 16 – Disputes", items: [
          "1. Seeking an amicable solution between the parties.",
          "2. GoFix mediation: for an appointment made on the platform, a dispute can be opened within 7 days of the service; the decision is sent to both parties.",
          "3. Professional mediation (Algerian Chamber of Commerce and Industry).",
          "4. Failing that, the courts of Algiers have jurisdiction.",
        ] },
        { h: "Article 17 – Changes to the terms", p: "GoFix may change these Terms. Users are informed of any significant change by notification before it takes effect; continued use constitutes acceptance of the new version." },
        { h: "Article 18 – Governing law and final provisions", p: "The Terms are governed by Algerian law; any dispute falls under the exclusive jurisdiction of the courts of Algiers. GoFix's failure to rely on a provision does not constitute a waiver. If a clause were declared void, the others would remain in force." },
      ],
    },
    cgv: {
      title: "Terms of Sale",
      sections: [
        { h: "Article 1 – Purpose", p: "These Terms of Sale apply to paid plans purchased on GoFix (subscriptions for clients, professionals, teachers and students). They supplement the Terms of Use. The seller is {company_name}, {company_address}, RC {company_rc}, NIF {company_nif}." },
        { h: "Article 2 – Plans and prices", p: [
          "The plans (Free, Pro, Premium, Student Pass) and their content are described on the \"Plans\" page. Prices are shown in Algerian dinars (DA), all taxes included; the applicable price is the one displayed at the time of the order.",
          "New professionals and teachers benefit from free trial access, the duration and number of requests of which are shown in their space.",
        ] },
        { h: "Article 3 – Conditions specific to professionals", items: [
          "Be registered in the Trade Register or hold a valid craftsman card (or provide proof of the appropriate status for teachers).",
          "Provide the requested documents: ID, RC or craftsman card, NIF, diplomas where applicable. Documents are kept in a private space and are only seen by the approval team.",
          "Be covered by professional liability insurance suited to the activity, proof of which GoFix may request at any time.",
          "Guarantee holding the rights to the photos published (photo, cover, past work).",
        ] },
        { h: "Article 4 – Order and payment", p: [
          "Payment is made online by CIB or Edahabia card on SATIM's secure page. Card details are entered only at SATIM: GoFix neither receives nor stores them.",
          "The subscription is activated as soon as the payment is confirmed by SATIM to the GoFix server. A declined or cancelled payment results in no charge and no activation.",
        ] },
        { h: "Article 5 – Duration and renewal", p: "Each subscription is taken out for the duration stated in the plan. It is not renewed automatically: no debit takes place without a new order. Reminders are sent before expiry; on expiry, the account returns to the free plan with no loss of data." },
        { h: "Article 6 – Invoicing", p: "A numbered invoice bearing the seller's legal information is issued after each payment and can be downloaded from \"Subscription and invoices\". GoFix's computerized records are proof of transactions, in accordance with the legislation in force on electronic evidence." },
        { h: "Article 7 – Complaints and refunds", p: "Any complaint should be sent via the Contact page or to {contact_email}, stating the order number. In the event of a double payment or an activation failure attributable to GoFix, the undue amount is refunded. Consumer rights under Law No. 18-05 of 10 May 2018 on e-commerce remain applicable." },
        { h: "Article 8 – Appointment cancellations and reliability", p: "Late or repeated cancellations by a professional or teacher lower their Trust Score. In the event of repeated abuse, GoFix may issue a warning and then suspend the profile; a further repeat offense may result in a permanent ban." },
        { h: "Article 9 – Payment fraud", p: "Any payment fraud or attempted fraud (stolen payment method, abusive chargeback) results in the immediate suspension of the account, without prejudice to legal action." },
        { h: "Article 10 – Banking partners", p: "GoFix cannot be held liable for the unavailability of CIB or Edahabia payment systems, payment refusals decided by banks, bank processing delays or difficulties related to the user's bank account." },
        { h: "Article 11 – Upcoming services", p: "The following services, announced in the GoFix roadmap, are not open yet and are not on sale to date: secure payment for jobs with funds held in escrow until proper completion (announced commission of 15% excluding tax per transaction), paid \"Sponsored\" promotion (Boost), online training with certificates (GoFix Academy e-learning), GoFix Jobs (recruitment) and audio or video calls. Their specific terms will be published and accepted before any subscription." },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      sections: [
        { h: "Data controller", p: "{company_name}, {company_address}. Contact for any question about your data: {contact_email}. Declaration to the ANPDP: {anpdp_declaration}. This policy applies Law No. 18-07 of 10 June 2018." },
        { h: "Hosting", p: [
          "Data is hosted in Algeria ({hosting_provider}).",
          "Two technical services operate outside our servers: SATIM (Algeria) for card payments; and, if you enable them, phone push notifications, whose title and a short excerpt pass through Apple's or Google's services (via Expo) to be displayed on your device.",
        ] },
        { h: "Data collected", table: { head: ["Category", "Examples", "Use"], rows: [
          ["Identification and contact", "Name, e-mail, phone, profile photo (optional), wilaya", "Account, connecting people, support"],
          ["Professional profile", "Trade or subjects, areas, availability, indicative rates, past work", "Public profile, search, AI MATCH"],
          ["Supporting documents", "ID, RC, NIF, diplomas", "Verification; private storage, access limited to the approval team"],
          ["Activity", "Requests, messages, appointments, reviews, reports", "Service, moderation, Trust Score, disputes"],
          ["Payment", "Orders, amounts, invoices (no card data)", "Subscriptions, accounting"],
          ["Location (optional)", "Approximate position, on request", "Suggesting your wilaya; the position is not kept"],
          ["Device (optional)", "Phone notification token", "Sending the notifications you have accepted"],
          ["Security", "IP address, technical logs", "Preventing abuse and fraud, audit log"],
        ] } },
        { h: "Minors", p: "For a minor student, the consent of a parent or guardian is collected and time-stamped. Only the data needed for tutoring is processed; no student result or profile is made public." },
        { h: "Recipients", p: "The data on your profile is visible to other users according to their plan; your full contact details are only shared with the people you are in contact with. Data is accessible to authorized GoFix staff, to SATIM and banks for payments, and to the authorities upon legal request. GoFix neither sells nor rents your data and uses no advertising trackers." },
        { h: "Retention periods", items: [
          "Inactive account: 36 months, then deletion.",
          "Messages: 24 months.",
          "Security and audit logs: 12 months.",
          "Accounting records (orders, invoices): 10 years (legal obligation).",
          "Professionals' supporting documents: for as long as the profile is active.",
        ] },
        { h: "Your rights", p: "You have the rights of access, rectification, erasure and objection. From \"My account\", you can change your information, export your data and delete your account: your files are then erased and your name is anonymized in the conversations kept for the other party. For any request: {contact_email}. You may also refer the matter to the ANPDP." },
        { h: "Security", p: "Encrypted exchanges (HTTPS/TLS), irreversibly encrypted passwords, ID documents in private storage, role-based access control, audit log of sensitive actions and regular backups." },
        { h: "Cookies and local storage", p: "GoFix only uses the technical storage needed for operation (session, language, theme). No advertising cookies or third-party audience measurement tools are used." },
        { h: "Notifications and location", p: "Push notifications and location are only enabled with your consent, requested by the app. You can withdraw it at any time in your phone's settings; on logout, your device no longer receives the account's notifications." },
        { h: "Changes", p: "This policy may change; any significant change is notified to you before it takes effect." },
      ],
    },
  },
};

export default legal;

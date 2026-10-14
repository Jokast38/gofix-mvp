// App-only texts (navigation, native permissions, offline). Everything else comes from the shared web dictionaries.
export const mobileFr = {
  auth: { forgot: "Mot de passe oublié ?", forgotSent: "Si un compte existe, un lien de réinitialisation a été envoyé par e-mail (valable 1 h)." },
  match: { placeholder: "Ex. : fuite à Kouba aujourd'hui" },
  tabs: { home: "Accueil", search: "Chercher", messages: "Messages", publish: "Publier", pro: "Espace pro", account: "Compte" },
  mobile: {
    offline: "Hors connexion – les données affichées peuvent ne pas être à jour.", retry: "Réessayer", pullToRefresh: "Tirer pour actualiser",
    pickPhoto: "Choisir une photo", pickFile: "Choisir un fichier", more: "Plus", menu: "Menu", openWeb: "Ouvrir sur le site",
    adminOnWeb: "Le back-office est disponible sur la version web (ordinateur ou tablette).", select: "Choisir…", searchIn: "Rechercher…",
    day: "Jour", time: "Heure", today: "Aujourd'hui", tomorrow: "Demain", invoiceShared: "Facture prête à être partagée.",
    exportShared: "Export prêt à être partagé.", languageReload: "L'application redémarre pour appliquer l'arabe (de droite à gauche).",
    paymentBrowser: "La page de paiement sécurisée s'ouvre dans votre navigateur.", paymentCancelled: "Paiement interrompu : aucune somme n'a été débitée.",
    version: "Version {v}", apiServer: "Serveur : {url}", notifications: "Notifications", assistant: "Assistant",
  },
  notifPush: {
    title: "Activer les notifications ?", enable: "Activer les notifications", later: "Plus tard",
    text: "Soyez prévenu immédiatement, même quand l'application est fermée :",
    items: ["Un professionnel ou un professeur répond à votre demande", "Un nouveau message arrive", "Un rendez-vous est proposé, confirmé ou approche"],
    note: "Vous pourrez les désactiver à tout moment dans les réglages du téléphone.",
    enabled: "Notifications activées.", deniedHelp: "Les notifications sont bloquées pour GoFix. Ouvrez les réglages du téléphone pour les autoriser.",
    openSettings: "Ouvrir les réglages", rowTitle: "Notifications sur ce téléphone",
    status: { granted: "Activées", denied: "Bloquées", undetermined: "Non activées", unsupported: "Indisponibles sur cet appareil" },
    tokenLater: "Autorisation enregistrée. La réception sera active dans l'application installée depuis le store.",
  },
};

export const mobileAr = {
  auth: { forgot: "نسيت كلمة المرور؟", forgotSent: "إذا كان الحساب موجودًا فقد أُرسل رابط إعادة التعيين بالبريد (صالح ساعة)." },
  match: { placeholder: "مثال: تسرّب ماء في القبة اليوم" },
  tabs: { home: "الرئيسية", search: "بحث", messages: "الرسائل", publish: "نشر", pro: "فضائي المهني", account: "حسابي" },
  mobile: {
    offline: "غير متصل – قد لا تكون البيانات محدّثة.", retry: "إعادة المحاولة", pullToRefresh: "اسحب للتحديث",
    pickPhoto: "اختيار صورة", pickFile: "اختيار ملف", more: "المزيد", menu: "القائمة", openWeb: "فتح على الموقع",
    adminOnWeb: "لوحة الإدارة متاحة على نسخة الويب (حاسوب أو لوحي).", select: "اختر…", searchIn: "بحث…",
    day: "اليوم", time: "الساعة", today: "اليوم", tomorrow: "غدًا", invoiceShared: "الفاتورة جاهزة للمشاركة.",
    exportShared: "التصدير جاهز للمشاركة.", languageReload: "سيُعاد تشغيل التطبيق لتطبيق العربية (من اليمين إلى اليسار).",
    paymentBrowser: "تُفتح صفحة الدفع الآمنة في متصفحك.", paymentCancelled: "توقّف الدفع: لم يُخصم أي مبلغ.",
    version: "الإصدار {v}", apiServer: "الخادم: {url}", notifications: "الإشعارات", assistant: "المساعد",
  },
  notifPush: {
    title: "تفعيل الإشعارات؟", enable: "تفعيل الإشعارات", later: "لاحقًا",
    text: "كن على علم فورًا، حتى عندما يكون التطبيق مغلقًا:",
    items: ["مهني أو أستاذ يرد على طلبك", "وصول رسالة جديدة", "اقتراح موعد أو تأكيده أو اقترابه"],
    note: "يمكنك إيقافها في أي وقت من إعدادات الهاتف.",
    enabled: "تم تفعيل الإشعارات.", deniedHelp: "الإشعارات محظورة لتطبيق GoFix. افتح إعدادات الهاتف للسماح بها.",
    openSettings: "فتح الإعدادات", rowTitle: "الإشعارات على هذا الهاتف",
    status: { granted: "مفعّلة", denied: "محظورة", undetermined: "غير مفعّلة", unsupported: "غير متاحة على هذا الجهاز" },
    tokenLater: "تم حفظ الإذن. سيعمل الاستقبال في التطبيق المثبّت من المتجر.",
  },
};

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
    exportShared: "Export prêt à être partagé.", languageReload: "L'application redémarre pour appliquer l'arabe (de droite à gauche).", restartManual: "Fermez puis rouvrez l'application pour terminer le changement de sens d'affichage.", reloadExpoGo: "Langue enregistrée. Dans Expo Go, rechargez l'application (secouez le téléphone → Reload) pour appliquer le sens d'affichage (droite à gauche ou gauche à droite).",
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

export const mobileEn = {
  auth: { forgot: "Forgot your password?", forgotSent: "If an account exists, a reset link has been sent by e-mail (valid for 1 hour)." },
  match: { placeholder: "E.g. leak in Kouba today" },
  tabs: { home: "Home", search: "Search", messages: "Messages", publish: "Post", pro: "Pro space", account: "Account" },
  mobile: {
    offline: "Offline – the data shown may not be up to date.", retry: "Try again", pullToRefresh: "Pull to refresh",
    pickPhoto: "Choose a photo", pickFile: "Choose a file", more: "More", menu: "Menu", openWeb: "Open on the website",
    adminOnWeb: "The back office is available on the web version (computer or tablet).", select: "Choose…", searchIn: "Search…",
    day: "Day", time: "Time", today: "Today", tomorrow: "Tomorrow", invoiceShared: "Invoice ready to share.",
    exportShared: "Export ready to share.", languageReload: "The app restarts to apply Arabic (right to left).", restartManual: "Close and reopen the app to finish changing the display direction.", reloadExpoGo: "Language saved. In Expo Go, reload the app (shake the phone → Reload) to apply the display direction (right to left or left to right).",
    paymentBrowser: "The secure payment page opens in your browser.", paymentCancelled: "Payment interrupted: no amount was charged.",
    version: "Version {v}", apiServer: "Server: {url}", notifications: "Notifications", assistant: "Assistant",
  },
  notifPush: {
    title: "Turn on notifications?", enable: "Turn on notifications", later: "Later",
    text: "Be told right away, even when the app is closed:",
    items: ["A professional or teacher replies to your request", "A new message arrives", "An appointment is proposed, confirmed or coming up"],
    note: "You can turn them off at any time in your phone's settings.",
    enabled: "Notifications turned on.", deniedHelp: "Notifications are blocked for GoFix. Open your phone's settings to allow them.",
    openSettings: "Open settings", rowTitle: "Notifications on this phone",
    status: { granted: "On", denied: "Blocked", undetermined: "Off", unsupported: "Unavailable on this device" },
    tokenLater: "Permission saved. Delivery will work in the app installed from the store.",
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
    exportShared: "التصدير جاهز للمشاركة.", languageReload: "سيُعاد تشغيل التطبيق لتطبيق العربية (من اليمين إلى اليسار).", restartManual: "أغلق التطبيق ثم افتحه من جديد لإتمام تغيير اتجاه العرض.", reloadExpoGo: "تم حفظ اللغة. في Expo Go، أعد تحميل التطبيق (هزّ الهاتف ← Reload) لتطبيق اتجاه العرض.",
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

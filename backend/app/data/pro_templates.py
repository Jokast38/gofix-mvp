"""PRO AI writing assistant: message drafts built from templates (no generative model, no data sent anywhere).
The pro always edits and sends the text himself: the assistant never sends anything.

Placeholders: {client} client's first name, {service} the trade or subject, quoted (" « Plombier »") or empty, {pro} the pro's display name,
{ref} quote reference, {total} quote total ("4 500 DA"), {valid} quote validity date, {date} appointment date.
"""

PURPOSES = ("reply", "quote_intro", "followup", "followup_quote", "reschedule", "thanks", "decline")
TONES = ("formal", "friendly")

TEMPLATES = {
    "reply": {
        "fr": {
            "formal": "Bonjour {client},\n\nMerci pour votre demande{service}. Pour vous proposer un devis précis, pourriez-vous me donner quelques détails (dimensions, état actuel, photos si possible) ainsi que vos disponibilités ?\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client} 👋\n\nMerci pour votre message ! Je peux m'occuper de votre demande{service}. Envoyez-moi quelques photos et dites-moi quand je peux passer, je vous prépare un devis rapidement.\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nشكرًا على طلبك{service}. حتى أقدّم لك عرض سعر دقيقًا، هل يمكنك تزويدي ببعض التفاصيل (المقاسات، الحالة الحالية، صور إن أمكن) ومواعيد تواجدك؟\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client} 👋\n\nشكرًا على رسالتك! يمكنني التكفل بطلبك{service}. أرسل لي بعض الصور وأخبرني متى يمكنني المرور، وسأحضّر لك عرض السعر بسرعة.\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nThank you for your request{service}. To give you an accurate quote, could you share a few details (dimensions, current condition, photos if possible) and when you are available?\n\nBest regards,\n{pro}",
            "friendly": "Hi {client} 👋\n\nThanks for your message! I can take care of your request{service}. Send me a few photos and tell me when I can come by, and I'll prepare a quote quickly.\n\n{pro}",
        },
    },
    "quote_intro": {
        "fr": {
            "formal": "Bonjour {client},\n\nVous trouverez ci-dessous mon devis {ref} pour votre demande{service}, d'un montant de {total}. Il est valable jusqu'au {valid}. Je reste à votre disposition pour toute question.\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client},\n\nVoici mon devis {ref} pour votre demande{service} : {total}, valable jusqu'au {valid}. N'hésitez pas si vous avez une question !\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nتجد أدناه عرض السعر {ref} الخاص بطلبك{service}، بمبلغ {total}، وهو صالح إلى غاية {valid}. أبقى في خدمتك لأي استفسار.\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client}،\n\nإليك عرض السعر {ref} لطلبك{service}: {total}، صالح إلى غاية {valid}. لا تتردد إن كان لديك أي سؤال!\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nPlease find below my quote {ref} for your request{service}, amounting to {total}. It is valid until {valid}. Do not hesitate to contact me with any question.\n\nBest regards,\n{pro}",
            "friendly": "Hi {client},\n\nHere is my quote {ref} for your request{service}: {total}, valid until {valid}. Let me know if you have any question!\n\n{pro}",
        },
    },
    "followup": {
        "fr": {
            "formal": "Bonjour {client},\n\nJe reviens vers vous au sujet de votre demande{service}. Avez-vous toujours besoin d'un professionnel ? Je peux vous proposer un créneau rapidement.\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client},\n\nJe me permets de revenir vers vous pour votre demande{service}. C'est toujours d'actualité ? Je suis disponible cette semaine si besoin.\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nأعود إليك بخصوص طلبك{service}. هل ما زلت بحاجة إلى مختص؟ يمكنني اقتراح موعد قريب.\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client}،\n\nأتواصل معك من جديد بخصوص طلبك{service}. هل ما زال الأمر قائمًا؟ أنا متاح هذا الأسبوع إن احتجت.\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nI am following up on your request{service}. Do you still need a professional? I can offer you a slot soon.\n\nBest regards,\n{pro}",
            "friendly": "Hi {client},\n\nJust checking in about your request{service}. Is it still on? I'm available this week if needed.\n\n{pro}",
        },
    },
    "followup_quote": {
        "fr": {
            "formal": "Bonjour {client},\n\nJe me permets de revenir vers vous concernant mon devis {ref} ({total}) pour votre demande{service}, valable jusqu'au {valid}. Avez-vous pu en prendre connaissance ? Je peux l'ajuster si besoin.\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client},\n\nAvez-vous pu regarder mon devis {ref} ({total}) pour votre demande{service} ? Il reste valable jusqu'au {valid}. Dites-moi si vous voulez qu'on en parle.\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nأعود إليك بخصوص عرض السعر {ref} ({total}) الخاص بطلبك{service}، والصالح إلى غاية {valid}. هل اطّلعت عليه؟ يمكنني تعديله إن لزم الأمر.\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client}،\n\nهل اطّلعت على عرض السعر {ref} ({total}) لطلبك{service}؟ ما زال صالحًا إلى غاية {valid}. أخبرني إن أردت أن نتحدث عنه.\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nI am following up on my quote {ref} ({total}) for your request{service}, valid until {valid}. Have you had a chance to review it? I can adjust it if needed.\n\nBest regards,\n{pro}",
            "friendly": "Hi {client},\n\nDid you get a chance to look at my quote {ref} ({total}) for your request{service}? It's valid until {valid}. Let me know if you'd like to talk about it.\n\n{pro}",
        },
    },
    "reschedule": {
        "fr": {
            "formal": "Bonjour {client},\n\nJe suis malheureusement contraint de déplacer notre rendez-vous{date}. Pourriez-vous m'indiquer un autre créneau qui vous convient ? Toutes mes excuses pour ce contretemps.\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client},\n\nPetit imprévu de mon côté : est-ce qu'on peut décaler notre rendez-vous{date} ? Dites-moi le créneau qui vous arrange. Désolé pour le changement !\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nللأسف أنا مضطر لتأجيل موعدنا{date}. هل يمكنك اقتراح موعد آخر يناسبك؟ أعتذر عن هذا الإزعاج.\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client}،\n\nطرأ لي ظرف بسيط: هل يمكن أن نؤجل موعدنا{date}؟ أخبرني بالوقت الذي يناسبك. آسف على التغيير!\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nUnfortunately I need to move our appointment{date}. Could you suggest another time that suits you? My apologies for the inconvenience.\n\nBest regards,\n{pro}",
            "friendly": "Hi {client},\n\nSomething came up on my side: could we move our appointment{date}? Tell me what time works for you. Sorry for the change!\n\n{pro}",
        },
    },
    "thanks": {
        "fr": {
            "formal": "Bonjour {client},\n\nMerci de m'avoir confié votre demande{service}. Si vous êtes satisfait, un avis sur GoFix m'aiderait beaucoup. Je reste disponible pour toute intervention future.\n\nCordialement,\n{pro}",
            "friendly": "Merci {client} ! C'était un plaisir de m'occuper de votre demande{service}. Si vous êtes content du travail, un petit avis sur GoFix m'aiderait beaucoup 🙏\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nشكرًا لأنك أوكلت إليّ طلبك{service}. إن كنت راضيًا، فإن تقييمك على GoFix سيساعدني كثيرًا. أبقى متاحًا لأي تدخل مستقبلي.\n\nمع التحية،\n{pro}",
            "friendly": "شكرًا {client}! سعدت بالتكفل بطلبك{service}. إن أعجبك العمل، فتقييم صغير على GoFix سيساعدني كثيرًا 🙏\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nThank you for trusting me with your request{service}. If you are satisfied, a review on GoFix would help me a lot. I remain available for any future work.\n\nBest regards,\n{pro}",
            "friendly": "Thanks {client}! It was a pleasure to take care of your request{service}. If you're happy with the work, a quick review on GoFix would help me a lot 🙏\n\n{pro}",
        },
    },
    "decline": {
        "fr": {
            "formal": "Bonjour {client},\n\nMerci pour votre demande{service}. Je ne suis malheureusement pas disponible pour cette intervention. Je vous invite à consulter les autres professionnels sur GoFix.\n\nCordialement,\n{pro}",
            "friendly": "Bonjour {client},\n\nMerci d'avoir pensé à moi pour votre demande{service} ! Je ne suis pas disponible cette fois-ci, mais vous trouverez d'autres pros sur GoFix. Bon courage !\n\n{pro}",
        },
        "ar": {
            "formal": "مرحبًا {client}،\n\nشكرًا على طلبك{service}. للأسف لست متاحًا لهذا التدخل. أدعوك إلى الاطلاع على المختصين الآخرين في GoFix.\n\nمع التحية،\n{pro}",
            "friendly": "مرحبًا {client}،\n\nشكرًا لأنك فكرت فيّ لطلبك{service}! لست متاحًا هذه المرة، لكنك ستجد مختصين آخرين على GoFix. بالتوفيق!\n\n{pro}",
        },
        "en": {
            "formal": "Hello {client},\n\nThank you for your request{service}. Unfortunately I am not available for this job. I invite you to check the other professionals on GoFix.\n\nBest regards,\n{pro}",
            "friendly": "Hi {client},\n\nThanks for thinking of me for your request{service}! I'm not available this time, but you'll find other pros on GoFix. Good luck!\n\n{pro}",
        },
    },
}

# How the trade or subject is quoted after "your request" (empty when unknown).
SERVICE_QUOTE = {"fr": " « {} »", "ar": " «{}»", "en": " “{}”"}
DATE_PREFIX = {"fr": " du {date}", "ar": " المقرر يوم {date}", "en": " on {date}"}

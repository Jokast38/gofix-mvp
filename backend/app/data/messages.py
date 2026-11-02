"""Texts written by the server (notifications, e-mails, SMS) in the recipient's language.
Each entry is (title or subject, body). Arabic has no entry yet: it falls back to French."""
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import Request

TZ = ZoneInfo("Africa/Algiers")
DEFAULT_LANG = "fr"
DATETIME_FMT = {"fr": "%d/%m/%Y à %H:%M", "en": "%d/%m/%Y at %H:%M"}

MESSAGES = {
    "profile_verified": {
        "fr": ("Votre fiche est validée", "Félicitations {name} ! Votre fiche GoFix est vérifiée et publiée dans le catalogue."),
        "en": ("Your profile is approved", "Congratulations {name}! Your GoFix profile is verified and published in the catalog."),
    },
    "profile_rejected": {
        "fr": ("Votre fiche n'a pas été validée", "Votre fiche GoFix a été refusée. Motif : {reason}. Contactez le support."),
        "en": ("Your profile was not approved", "Your GoFix profile was declined. Reason: {reason}. Contact support."),
    },
    "profile_rejected_noreason": {
        "fr": ("Votre fiche n'a pas été validée", "Votre fiche GoFix a été refusée. Motif : non précisé. Contactez le support."),
        "en": ("Your profile was not approved", "Your GoFix profile was declined. Reason: not specified. Contact support."),
    },
    "profile_pending": {
        "fr": ("Fiche remise en attente", "Votre fiche est de nouveau en cours d'examen."),
        "en": ("Profile back under review", "Your profile is under review again."),
    },
    "profile_submitted": {
        "fr": ("Candidature reçue", "Votre fiche est en cours de validation (sous 48 h)."),
        "en": ("Application received", "Your profile is being reviewed (within 48 hours)."),
    },
    "contest_received": {
        "fr": ("Contestation reçue", "Notre équipe examine votre demande sous 72 h."),
        "en": ("Appeal received", "Our team will review your request within 72 hours."),
    },
    "contest_accepted": {
        "fr": ("Réponse à votre contestation", "Décision : acceptée. {note}"),
        "en": ("Reply to your appeal", "Decision: accepted. {note}"),
    },
    "contest_rejected": {
        "fr": ("Réponse à votre contestation", "Décision : refusée. {note}"),
        "en": ("Reply to your appeal", "Decision: declined. {note}"),
    },
    "category_approved": {
        "fr": ("Votre demande de catégorie", "« {name} » a été ajoutée au catalogue. {note}"),
        "en": ("Your category request", "\"{name}\" has been added to the catalog. {note}"),
    },
    "category_rejected": {
        "fr": ("Votre demande de catégorie", "« {name} » a été refusée. {note}"),
        "en": ("Your category request", "\"{name}\" was declined. {note}"),
    },
    "job_proposed": {
        "fr": ("Rendez-vous proposé", "Le {at}. Confirmez-le dans GoFix."),
        "en": ("Appointment proposed", "On {at}. Confirm it in GoFix."),
    },
    "job_confirmed": {
        "fr": ("Rendez-vous confirmé", "Le {at}."),
        "en": ("Appointment confirmed", "On {at}."),
    },
    "job_cancelled": {
        "fr": ("Rendez-vous annulé", "{reason}"),
        "en": ("Appointment cancelled", "{reason}"),
    },
    "job_done_check": {
        "fr": ("Prestation terminée ?", "Confirmez que la prestation a bien eu lieu, puis laissez un avis."),
        "en": ("Job finished?", "Confirm that the job took place, then leave a review."),
    },
    "job_completed": {
        "fr": ("Prestation terminée", "Donnez votre avis : il aide toute la communauté."),
        "en": ("Job completed", "Give your review: it helps the whole community."),
    },
    "job_reminder": {
        "fr": ("Rendez-vous demain", "Le {at}."),
        "en": ("Appointment tomorrow", "On {at}."),
    },
    "dispute_opened": {
        "fr": ("Litige ouvert", "L'équipe GoFix examine la situation et revient vers vous."),
        "en": ("Dispute opened", "The GoFix team is reviewing the situation and will get back to you."),
    },
    "dispute_decided": {
        "fr": ("Décision sur le litige", "{note}"),
        "en": ("Decision on the dispute", "{note}"),
    },
    "review_new": {
        "fr": ("Nouvel avis vérifié", "Note : {rating}/5"),
        "en": ("New verified review", "Rating: {rating}/5"),
    },
    "request_locked": {
        "fr": ("Nouvelle demande en attente", "Vous avez reçu une demande. Votre accès gratuit est épuisé : abonnez-vous pour la consulter."),
        "en": ("New request waiting", "You have received a request. Your free access has run out: subscribe to read it."),
    },
    "request_new": {
        "fr": ("Nouvelle demande", "{name} : {message}"),
        "en": ("New request", "{name}: {message}"),
    },
    "request_accepted": {
        "fr": ("{name} a accepté votre demande", "Vous pouvez maintenant échanger dans la messagerie."),
        "en": ("{name} accepted your request", "You can now talk in messaging."),
    },
    "request_refused": {
        "fr": ("{name} n'est pas disponible", "Votre demande a été déclinée. Les autres destinataires peuvent encore répondre."),
        "en": ("{name} is not available", "Your request was declined. The other recipients can still reply."),
    },
    "request_default_reply": {
        "fr": ("", "Demande acceptée. Discutons des détails ici."),
        "en": ("", "Request accepted. Let's discuss the details here."),
    },
    "message_new": {
        "fr": ("Nouveau message de {name}", "{text}"),
        "en": ("New message from {name}", "{text}"),
    },
    "payment_confirmed": {
        "fr": ("Paiement confirmé – {plan}", "Votre abonnement {plan} est actif jusqu'au {date}. Facture {invoice}."),
        "en": ("Payment confirmed – {plan}", "Your {plan} subscription is active until {date}. Invoice {invoice}."),
    },
    "subscription_expired": {
        "fr": ("Abonnement expiré", "Votre abonnement GoFix a expiré. Renouvelez-le depuis la page Offres pour garder vos avantages."),
        "en": ("Subscription expired", "Your GoFix subscription has expired. Renew it from the Plans page to keep your benefits."),
    },
    "subscription_reminder": {
        "fr": ("Votre abonnement expire dans {left} jour(s)", "Pensez à renouveler votre abonnement avant le {date}."),
        "en": ("Your subscription expires in {left} day(s)", "Remember to renew your subscription before {date}."),
    },
    "password_reset": {
        "fr": ("GOFIX – Réinitialisation du mot de passe", "Choisissez un nouveau mot de passe avec ce lien (valable 1 heure) :\n{link}"),
        "en": ("GOFIX – Password reset", "Choose a new password with this link (valid for 1 hour):\n{link}"),
    },
    "otp_code": {
        "fr": ("", "GOFIX : votre code est {code}. Valable {minutes} min."),
        "en": ("", "GOFIX: your code is {code}. Valid for {minutes} min."),
    },
    "mail_test": {
        "fr": ("GoFix – E-mail de test", "Ceci est un e-mail de test envoyé depuis le back-office GoFix.\n"
                                         "Si vous le recevez, l'envoi des e-mails de la plateforme fonctionne."),
        "en": ("GoFix – Test e-mail", "This is a test e-mail sent from the GoFix back office.\n"
                                      "If you receive it, the platform's e-mail sending works."),
    },
}


def message(key: str, lang: str | None = None, **values) -> tuple[str, str]:
    """(title, body) of a server text; a datetime value is written in the recipient's format, in Algiers time."""
    texts = MESSAGES[key]
    lang = lang if lang in texts else DEFAULT_LANG
    fmt = DATETIME_FMT.get(lang, DATETIME_FMT[DEFAULT_LANG])
    values = {k: v.astimezone(TZ).strftime(fmt) if isinstance(v, datetime) else v for k, v in values.items()}
    title, body = texts[lang]
    return title.format(**values), body.format(**values)


def lang_of(request: Request) -> str:
    """Language of the current client, from the Accept-Language header set by the web and mobile apps."""
    header = (request.headers.get("Accept-Language") or "").lower()
    return next((code for code in ("ar", "en") if header.startswith(code)), DEFAULT_LANG)

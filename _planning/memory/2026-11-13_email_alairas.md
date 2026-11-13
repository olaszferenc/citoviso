# 2026-11-13 — Egységes e-mail aláírás („A”: jel + cián vonal)

**Brief:** `~/rc-briefs/email-al-r-s-20261113-082201.md` · **Fa:** `~/wt/cit383fe8b6` · **ADR:** ADR-XXXX

## Elvégezve
- §2b terv-kör: 3 változat (A jel + cián vonal, B sötétkék névjegykártya, C logó felül), csapat/névvel, mobil/asztali → tulaj: **A**.
- `src/email/signature.ts`: `signatureBlock` (Outlook-biztos tábla, CID-jel), `senderSignature` (márka → csapat, személy → név + `OUTREACH_SENDER_TITLE`), `helperSignature` (ADR-0425 perszóna), `teamSignature`.
- Bekötve: `outreachEmail.ts`, `trialCampaignEmail.ts`, `loginEmail.ts` (ügyfélsegítő), `behaviorMessageCopy.ts`, `mockRequestEmail.ts`. Új env: `OUTREACH_SENDER_TITLE` (`src/config.ts`).
- Jel: `public/assets/brand/citoviso-jel-email.png` (168×168, átlátszó).
- Postafiók-aláírás: `assets/design-refs/console/email-alairas/mailbox-signature-{csapat,nevvel}.html`.
- Új felirat: „Honlap és online láthatóság” (Bábelre vár, addig magyar).
- Kapuk: tsc, i18n-lint, outlook-lint, outreach-gate-selftest, outreach-letter-truth-check, trial-campaign-check, owner-login-mail-check, behavior-message-check, trial-escalation-check, trial-login-reminder-check — mind zöld.

## Nyitott
- A titulus („alapító” csak a mockban) és telefonszám: a tulaj adja meg, ha névvel aláírt levél kell (`OUTREACH_SENDER_NAME`/`_TITLE`/`_PHONE`).
- A csapat-aláírás e-mail sora a megkeresésben ma olasz.ferenc@ (`OUTREACH_SENDER_EMAIL`); info@-ra váltás = env, de a feladó-azonosítás is ezt használja.
- Élesítés külön engedéllyel; utána a postafiók-aláírás beállítása a Zohóban.

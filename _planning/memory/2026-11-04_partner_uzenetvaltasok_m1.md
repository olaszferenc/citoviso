# Partner-adatlap Üzenetváltások (M1) + elutasító-jel (SUB-C 2. rész, 2026-11-04)

**Session:** SUB-C (`cit393c725f`), koordinátor: a Fizetés-szál (`cit7e001214`). **Élesen: nincs.**

## Kiváltó
A tulaj: „A fülek + üzenetváltások tab is kell, ahol lehet írni is (sms + email)”. 2. mock-kör:
M1 csevegő-szál / M2 postafiók → a tulaj 2026-11-04-én az **M1**-et választotta.

## Elkészült
- `src/console/partnerMessages.ts` — a szál (tenant_message, mms/sms_outbox, prospect-bélyeg,
  outreach_reply(+_send), partner_message), címzettek, őr, küldés (getEmailSender / sendSms,
  csendes óra 22–07 → 07:00), `settlePartnerMessages`, bejövő besorolás, elutasító-jel.
- `src/console/partnerMessageViews.ts` — a fül (M1), JS nélkül is; JS-sel fetch + állapot-követés.
- Végpontok: `POST /partner/:id/message`, `GET /partner/:id/message/:mid`, `POST …/:mid/retry`,
  `POST /replies/:id/block|unblock`.
- `src/replies/store.ts` (a nem-megkeresési bejövő a partner szálába), `src/replies/answer.ts`
  (elutasítónak nincs válasz), a nyilvános szerver percenkénti ingestje a kézi sort is lépteti.
- Migráció `0123_partner_message_and_lead_contact_block.sql`.
- Őr: `scripts/partner-messages-check.mts` (bekötve). Súgó: console-partner-page, console-dashboard.
- Terv befagyasztva: `assets/design-refs/console/partner-adatlap/JOVAHAGYOTT-M1-uzenetvaltasok.html`.

## Mért tények
- Lokálban `EMAIL_PROVIDER=smtp`, `SMS_PROVIDER=gammu` — egy dev-teszt VALÓDI üzenetet küldene; az
  őr ezért mock levélküldőt és SMS-sort használ (a dev sms_outbox-ot senki nem üríti: a relay az
  élesről húz).
- A hideg megkereső levél szövegét a rendszer nem tárolja (csak a prospect-bélyeg).

## Nyitva
- Élesítéskor: migráció (additív), backfill nincs.

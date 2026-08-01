# 2026-08-01 (2. session) — B szelet: outreach küldő-pipeline (§C-kapu a csőben)

## Mit építettünk (lokál, E2E-verifikálva)

### SMTP-adapter (`src/email/sender.ts`)
- A `SmtpEmailSender` stub → valós nodemailer-kliens (`SMTP_URL` + `OUTREACH_FROM` kötelező,
  konstruktorban hangosan bukik, ha hiányzik — félrekonfigurált `EMAIL_PROVIDER=smtp` nem nyelhet le levelet).
- `EmailMessage` += `headers` (List-Unsubscribe). Mock-adapter marad a default (outbox/ — kulcs nélkül tesztelhető).
- ÚJ dep: `nodemailer` (+`@types/nodemailer`).

### HTML e-mail-sablon (`src/email/outreachEmail.ts`)
- **Egyetlen forrás-elv (§I):** a HTML a §C-kapuzott SZÖVEGES piszkozat bekezdéseiből renderelődik —
  konstrukció szerint nem állíthat mást, mint a kapuzott szöveg. Text-part = a piszkozat szó szerint.
- Brand (navy/cián), inline CSS, CTA-gomb + látható URL alatta, NINCS kép/tracking-pixel
  (engagement a /p/ oldalon mérődik, nem a postafiókban).
- RFC 2369 + **RFC 8058 one-click unsubscribe** fejlécek (`List-Unsubscribe`, `List-Unsubscribe-Post`).

### Küldő-pipeline (`src/outreach/sendBatch.ts` + `scripts/outreach-send.ts` + `npm run outreach:send`)
- **EGYETLEN őrzött út** (`sendOutreachMail`): konzol-gomb + batch + CLI mind ezen konvergál; minden
  előfeltétel a küldés pillanatában újra fut (státusz, leiratkozás, §C-kapu) — nem csak a listázó query-ben.
- Batch: default cap 20/futás + 5 mp pacing (deliverability friss küldő-domainen; emelés tudatos operátori döntés).
- CLI: `--dry-run` / `--limit=` / `--prospect=` / `--delay-ms=`.

### Konzol (`src/console/{server,views}.ts`)
- Draft-oldal: **„Küldés e-mailben" gomb** (PASS + contact_email esetén; confirm + Post/Redirect/Get eredmény-pill);
  kézi A2-másolás marad fallbacknek. `POST /prospect/:id/send`.
- `/p/:token/leiratkozas` **POST-tal bővítve** (RFC 8058 one-click; feltétel nélküli, azonnali, idempotens).

## ⭐ Jog-provenance-őr éles ítélete → 3 javítás (a §C DEFERRED küldő-kapu MOST aktiválódott)
Az őr FLAG-elt; mindhárom pont javítva + újra-verifikálva:
1. **⛔ Cím-szintű suppression:** a leiratkozás eddig prospect-SOR-szintű volt → ugyanaz a címzett új
   mock/prospect-soron ÚJRA levelet kapott volna (Grt. opt-out-sértés: a tiltakozás a SZEMÉLYÉ, nem a tokené).
   Fix: `isEmailSuppressed()` — bármely valaha leiratkozott sor azonos `contact_email`-lel = küldés tilos
   (a batch-query NOT EXISTS-szel is szűr). E2E: leiratkozott cím friss 'created' sora SKIP mindkét úton.
2. **Atomi created→sent claim** a küldés ELŐTT (`UPDATE … WHERE status='created'`, numUpdatedRows-őr) →
   párhuzamos batch+konzol-gomb nem duplázhat levelet; küldés-hiba után best-effort revert 'created'-re.
3. **List-Unsubscribe assert** a hideg-úton: fejléc nélkül a pipeline nem ad át levelet a nyers adapternek.

## E2E-bizonyíték (mock-adapter, szintetikus teszt-prospect, futás után törölve)
rossz env (privát IP + üres feladó) → FLAG, nincs küldés · jó env dry-run → DRY · éles mock → SENT +
outbox .eml (fejlécek+HTML rendben) + created→sent · újraküldés → SKIP · POST one-click leiratkozás → 200 +
`unsubscribed_at` · leiratkozás után konzol-gomb → SKIP („leiratkozott") · tölcsér nem regresszált. `tsc` tiszta.

## Ami az ÉLES küldéshez még kell (tulaj-külső, változatlan)
küldő-domain + postafiók (SPF/DKIM) → `SMTP_URL`+`OUTREACH_FROM`+`EMAIL_PROVIDER=smtp` ·
publikus HTTPS hoszting → `PUBLIC_BASE_URL` (addig a §C-kapu helyesen FLAG-el minden élest) ·
`OUTREACH_SENDER_*` env kitöltése (valós identitás).

## Ismert kozmetika / későbbi
- A levél hook-mondatában a régió nyers slug („godollo") — a `scraper_definition.region`-ből jön; szépítés külön mini-szelet.
- Suppression később külön táblába emelhető (most: prospect-sorok cím-egyezése — kis volumenen elég).

## Módosított/új fájlok
MÓD: `src/email/sender.ts` · `src/console/server.ts` · `src/console/views.ts` · `package.json`
ÚJ: `src/email/outreachEmail.ts` · `src/outreach/sendBatch.ts` · `scripts/outreach-send.ts`

---

## Kiegészítés (ugyanaznap): e-mail-előnézet + nagyobb csali (tulaj-kérés)

### Konzol e-mail-előnézet (`cc0eaa4`)
A tulaj jogos reklamációja: „semmit nem látok a pipeline-ból". Fix: a draft-oldalon élő HTML-iframe
(`/prospect/:id/email-preview` — PONTOSAN a kimenő levél; FLAG-állapotban is nézhető, a nézés nem küldés).

### Nagyobb csali a levélben (`fe2c64e`) — tulaj: „beágyaznám a nyitóképet + beleírnám az árat + kipróbálhatja"
- **Beágyazott nyitókép:** `heroShot.ts` (mock első képernyője, Playwright, cache `sites/_outreach-shots/`,
  artifact-id+mtime kulcs). **CID-inline** csatolmány (nem remote fetch → nem lehet open-tracking). A §A
  keretezés a PIXELEKBE égetve („ELŐZETES LÁTVÁNYTERV — CITOVISO" szalag) — továbbküldve/lementve is terv marad.
- **Ár a levélben:** „már havi X forinttól" — X = `modules.ts BASE_PRICE_MONTHLY` (EGY ár-forrás, a konfigurátor
  ugyanazt kínálja; Fttv.: a -tól ár ténylegesen elérhető).
- **CTA:** „Megnézem és kipróbálom a honlap-tervet" + „Egy kattintással ki is próbálhatja" (fedezett: /p/ = konfigurátor).

### Őr-agent 2. kör (FLAG) → javítva
1. **Artifact-verdikt assert küldés előtt:** generáláskor FLAG-elt mock (designVerdict/demoFraming/factVerdict
   = "flag" az inputs-ban) levele/képe NEM mehet ki — eddig a §C-kapu csak a levél SZÖVEGÉT nézte.
2. **PRICING_CONFIRMED kapcsoló (modules.ts):** amíg az árak PLACEHOLDER-ek, a §C-kapu FLAG-el minden
   ár-hirdető levelet. **A tulaj dolga: valós árak beírása + PRICING_CONFIRMED=true.** (E2E: FLAG megy.)
3. Framing-szalag a képen (fent).

### Az őr által jelzett MEGLÉVŐ rés (nem e szelet hibája, BACKLOG-ra):
**`order_intent.price` kliens-küldött** (console/server.ts) — a payment ezt terheli; szerver-oldali
`computeMonthly` újraszámítás kell a terhelés előtt. Az ár-ígéret a levélben felértékeli ezt a rést.

### Tulaj-teendők az éles ár-csalihoz
① valós árak a `modules.ts`-be + `PRICING_CONFIRMED=true` ② a többi éles-küldés előfeltétel változatlan
(SMTP/SPF/DKIM, publikus HTTPS, OUTREACH_SENDER_*).

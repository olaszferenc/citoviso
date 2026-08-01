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

---

## 3. blokk (ugyanaznap): belső UI ① — scrape a felületről + pilot-riport (`14f02fb`)

- **`/scrape`:** régió-választó + cap → a MEGLÉVŐ CLI (`src/scraper/run.ts`) child-processként
  (`src/console/scrapeJob.ts`, zéró refactor a működő pipeline-on; a CLI amúgy is DB-be perzisztál).
  Élő napló (ring buffer, 3 mp auto-refresh), egyszerre EGY futás, futás-történet a `scrape_run`-ból.
  E2E: badacsony cap=5 a felületről indítva → exit 0, 5 lead perzisztálva, történet-tábla mutatja.
- **`/riport`:** H1–H5 hipotézis-tábla (PILOT.md §4 küszöbökkel) + szegmens-bontás (H4).
  Tanulság: a dev-era prospectek kiküldés NÉLKÜL is nyitottak → H1/H5 400%/300%-ot mutatott;
  fix: a H1/H5 számláló CSAK a ténylegesen kiküldött (sent_at) prospecteket számolja.
- **Tulaj-döntések rögzítve:** (1) Barion/Számlázz élesítés PARKOLVA — előtte teljes A–Z sandbox-teszt
  kötelező, éles kulcs-beszerzést se most; (2) belső ár-UI kérdésre: a geo-árazás (országfüggő) a BACKLOG
  1. belső modulja, pilot után — a pilot-árak kézzel a modules.ts-be; (3) konzol-belépés nincs (Tailscale véd,
  ADR-0021 halasztás) — a tulajnak elmagyarázva.

---

## 4. blokk (ugyanaznap): felnőtt belső konzol (`fbced93`) — tulaj-kritika nyomán

Tulaj (jogos, kemény): a konzol tartalmatlan aloldal-halmaz volt menü nélkül; nincs belépés; nem
deployolható; és NEM a megbeszélt központi dizájn-fájlból öltözött (ADR-0021 ① mulasztás — a konzol
kézzel írt inline CSS-sel ment, míg a tenant-admin már a magból).

Fix egy szeletben:
- **Operátor-login (0014 `operator_user` + `src/auth/operatorAuth.ts`):** scrypt + HMAC-cookie
  (`cit_op_session`, realm-elkülönített aláírás — tenant-cookie sosem validál operátorként).
  A konzol így PUBLIKUS hostingon is védett; a Tailscale csak dev-kényelem. AUTH-KAPU minden belső
  route-on; publikus kivételek: `/p/`, `/pay/`, `/configure/`, `/site/`, `/admin/`, `/adatvedelem`.
  Fiók-kezelő: `scripts/operator-user.ts <username> "<név>"` (megjegyezhető jelszót generál).
- **Menürendszer + vezérlőpult:** állandó felső menü (Vezérlőpult · Leadek · Scrape · Riport · Kilépés);
  `/` = vezérlőpult (szám-kártyák + irány-tábla); lead-lista → `/leadek`. Publikus oldalak (fizetés,
  leiratkozás, adatvédelem, tenant-token) CHROME NÉLKÜL — belső menü nem szivárog kifelé.
- **Dizájn-mag:** a konzol inline CSS-e TÖRÖLVE; kinézet = `citui.css` + ÚJ `citui-console.css`
  (token-vezérelt belső app-réteg a mag mellett). Világos brand-arculat (navy/cián), egy identitás.
- E2E: kapu nélkül `/`→`/belepes` · jó jelszó → cookie+vezérlőpult · rossz jelszó → hiba ·
  `/p/<token>` és `/adatvedelem` kapu nélkül is nyitva · css a magból szervírozva.
- ⚠️ Az operátor-jelszó CSAK a tulajnak lett átadva chatben (repo/log nem tartalmazza).

---

## 5. blokk (ugyanaznap): angol útvonal-struktúra + multilanguage-igény (`650d8db`)
Tulaj: „alapnyelv angol a könyvtár-szerkezetben, a /belepes faszság" + multilanguage-igény megerősítve
(tenant + belső felhasználó egyaránt). Átnevezve mindkét szerveren: `/login /logout /leads /report /privacy
/p/:token/unsubscribe /admin/{text,contact,photos,photos/delete}`; a piszkozat/credentials-email linkek követik
(éles küldés még nem volt → nincs törött külső link). Bónusz-fix: a honlap `/adatvedelem` linkje HALOTT volt a
:4800-on → `/privacy` route a publikus szerveren is (a konzol privacyPage-ét szolgálja). i18n-terv: BACKLOG
„Multilanguage / i18n" (pilot HU-megjelenítés angol struktúrán; string-katalógus post-pilot, trigger: 2. nyelv).
Auto-memória: `feedback_english_structure_multilanguage`.

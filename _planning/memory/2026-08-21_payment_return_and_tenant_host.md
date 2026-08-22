# 2026-08-21 — A fizetés utáni út: 404-től a megnyitható oldalig

**Kiváltó (tulaj, éles Barion sandbox teszt-vásárlás lokálban):** „A Barion fizetésig sikeres
volt minden. Sikeres fizetés után oldal nem található felületre küldött. A vásárlásról a sikeres
emailt megkaptam. Viszont nincs értesítés a további teendőről. Ettől a vevő tuti idegösszeomlást
kapna…" Majd: „NEM AKTIVÁLÓDOTT AZ OLDAL. Citoviso landing jön be."

Egyetlen teszt-vásárlás **négy külön hibát** tárt fel, ebből kettő éles-kritikus.

---

## ① ⛔ A `GET /pay/done` route NEM LÉTEZETT (a fő hiba)

A `requestPayment` a Barionnak `RedirectUrl`-ként `${base}/pay/done`-t ad
(`src/payment/service.ts`), a `src/console/server.ts`-ben viszont **nem volt ilyen útvonal** →
a fizető vevő böngészője a **„Nincs ilyen oldal."** 404-re esett.

A vevő-tájékoztató oldal (`payResultPage` — site-cím, felhasználónév, következő lépések)
**készen volt és jó**, csak a MOCK gateway útja hívta; a Barion-visszatérésé nem. Klasszikus
féloldalas bekötés: a mock-flow végig volt gondolva, az éles gateway-é nem.

**Súlyosabb, ami alatta volt:** lokálban a Barion szerver-oldali `CallbackUrl`-je **el sem éri
a gépet** (Tailscale-IP a neten kívül) → a `payment` sor `pending`-ben ragadt, tehát az
**aktiválás, a belépési e-mail és a számla SOSEM futott volna le**, hiába kapta meg a vevő a
Barion visszaigazolóját. A 404 csak a tünet volt.

**Fix:** a `/pay/done` a `paymentId`-ból **ugyanazon az idempotens `handleWebhook` úton**
(Barion adapter → `GetPaymentState`) oldja fel az állapotot, majd a meglévő `payResultPage`-et
rendereli. Így akkor is helyes, ha a callback nem ér el minket, és akkor is, ha már lefutott
(idempotens). Nem-végleges állapotra `payPendingPage()` (3 mp-es auto-frissítés).

**Élesen verifikálva (sandbox, valódi teszt-fizetés):** `pending` → `paid`, site `live`,
belépési e-mail kiment, számla kiállítva (`MOCK-2026-93E891`, 10 380 Ft). Elhagyott fizetés →
„A fizetés nem sikerült" ág. Hiányzó/ismeretlen ref → 404.

---

## ② ⛔⛔ Ismeretlen `<slug>.citoviso.com` a MARKETING LANDINGET szolgálta ki (éles bug)

A tulaj azt látta, hogy „nem aktiválódott az oldal, Citoviso landing jön be". Két dolog
keveredett, és a második egy valódi éles hiba:

**(a) Az oldal RENDBEN aktiválódott** — lokálban `Host: aszfalt-panzio.citoviso.com` → `:4800`
→ 200, cím: „Aszfalt panzió — Balatonföldvár". Amit a böngésző mutatott, az a **prod** volt: a
név a Cloudflare-en át a Hetznerre megy, ahol ez a tenant nem létezik (prod DB: egyetlen `live`
site, `ferenc-haz`).

**(b) És ekkor derült ki:** ha egy platform-aldomain nem oldódik fel élő site-ra, a kérés
**átesett a platform-útvonalakra és 200-zal a landinget adta**. Bizonyíték élesen:
`nemletezooooo.citoviso.com` → **HTTP 200** + „Citoviso – Weboldal, ami vevőket hoz".

Ez kétszeresen rossz:
- a frissen fizetett tulaj a **saját linkjén a mi honlapunkat** látja → „eltűnt az oldalam"
- **bármennyi** kitalált aldomain 200-at ad **azonos tartalommal** → duplikált tartalom a teljes
  `*.citoviso.com` hálózaton — pont az a reputációs kockázat, ami ellen az ADR-0041 véd

**Fix:** `isUnclaimedTenantHost()` → 404. Fenntartott labelek (`www/admin/api/mail/app/static/
assets`), mélyebb hosztok, apex és IP-hoszt viselkedése **változatlan** — mind verifikálva.

---

## ③ A vevő sehol nem látta, hogy a FIZETÉS sikeres volt

Tulaj: „Jó lenne, hogyha az is ki lenne írva, hogy sikeres fizetés, hogy lássa a szerencsétlen
paraszt." A lap „Köszönjük, kész!"-t mondott — ami a KÉSZ oldalra utal, nem a **terhelésre**.
Fizetésnél a vevő először azt akarja tudni, hogy levonták-e a pénzt.

**Fix:** explicit sor a terhelt összeggel („✓ Sikeres fizetés — a 10 380 Ft összegű terhelés
megtörtént."), **mindkét ágon** (aktivált + még-véglegesítés alatt) és a lap címében is.

---

## ④ A lokál teszt PROD URL-t hirdetett (dev-only `/t/<slug>`)

A `PLATFORM_DOMAIN` fordítási idejű konstans → **minden** lokál végponttól-végpontig teszt
`<slug>.citoviso.com`-ot írt ki, ami a prodra megy, ahol a lokálisan létrehozott tenant nincs
meg. Lokálban a wildcard hoszt nem oldódik fel, és böngészőből nem lehet `Host` fejlécet
állítani → a link **elvileg sem** volt megnyitható.

**Fix:** `isPlatformHosting()` + `tenantSiteUrl()` a `src/domains.ts`-ben — a `PUBLIC_SITE_URL`
dönti el, prod hosztot vagy dev slug-útvonalat adunk. A `/t/<slug>` a meglévő `serveTenantHost`-ra
vezet, így aloldal/robots is működik rajta.

**⚠️ A veszélyes rész, lezárva:** a `/t/` **prodon soha nem él**
(`DEV_SLUG_PATH = !isPlatformHosting(...)`) — ott minden tenant-oldalnak lenne egy MÁSODIK, a
saját canonicaljával versengő címe, azaz pontosan a ②-ben javított duplikált-tartalom probléma.
**Prod-konfiggal ténylegesen lefuttatva verifikálva:** `/t/<slug>` → 404, a Host-alapú kiszolgálás
és az ismeretlen-aldomain 404 változatlan. A renderelt oldal **SEO-canonicalja szándékosan
változatlan** (prod URL) — az a keresőnek szól.

---

## Mellék-lelet: a lokál `.env`-ből hiányzott az SMTP

A tulaj jogosan háborodott fel, hogy „rég működik a Zoho kiküldés" — **prodon** igen. A lokál
`.env`-ből hiányzott az `EMAIL_PROVIDER`/`SMTP_URL`/`OUTREACH_FROM`, ezért a lokál teszt a `mock`
adapterre esett, ami a levelet **fájlba írta** (`outbox/*.eml`) küldés helyett. A tulaj ezért nem
kapott semmit. Átmásolva a prod-konfig; a kész belépési levél valódi SMTP-n újraküldve.

**⚠️ NYITOTT, DÖNTENDŐ:** ezzel a lokál gép mostantól **valódi levelet küld**. Outreach-teszt
előtt gondolni kell rá, hogy az tényleg kimegy leadekhez. Alternatíva: `mock` az alap, és csak
eseti kiküldéskor `smtp`.

---

## ⭐ MÓDSZERTANI TANULSÁG

**A mock-út teljessége elfedte az éles út hiányát.** Mindhárom kritikus hiba (①②④) ott volt,
ahol a rendszer a MOCK-kal működött, az ÉLES megfelelőjével pedig nem: mock pay-page ✓ /
Barion-visszatérés ✗ · mock e-mail ✓ / valódi SMTP ✗ · lokál tenant ✓ / a hirdetett URL ✗.
`tsc` zöld volt, minden pre-commit kapu zöld volt, és a hibát **a tulaj első valódi
teszt-vásárlása** fogta meg — nem a 12 őr.

Ez ugyanaz a minta, ami a `feedback_guard_must_measure_what_matters` memóriában áll: az őrök a
kényelmes proxyt mérik. Egyik sem kérdezte meg, hogy „a fizetés után a vevő tényleg **lát-e**
valamit, és az a link **megnyílik-e**".

**Ami ebből következik (BACKLOG):** végponttól-végpontig konverziós füst-teszt, ami a
gateway-visszatérést is végigjátssza (nem csak a webhookot), és állítja, hogy a visszaigazolón
szereplő URL HTTP 200-at ad.

---

## Fájlok

- `src/console/server.ts` — `GET /pay/done` route (idempotens állapot-feloldás + összeg)
- `src/console/views.ts` — `payPendingPage()`, „Sikeres fizetés" explicit sor mindkét ágon
- `src/server/public.ts` — `isUnclaimedTenantHost()` 404-ág, dev-only `/t/<slug>`, admin site-link
- `src/domains.ts` — `isPlatformHosting()`, `tenantSiteUrl()`
- `src/payment/service.ts` — a visszaigazoló linkje a környezetből

Commitok: `ca0f110`, `b103af3`, `a5a21b7` (+ merge `f5d82f3`).

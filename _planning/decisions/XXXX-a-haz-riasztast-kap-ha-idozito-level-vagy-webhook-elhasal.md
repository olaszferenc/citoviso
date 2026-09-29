## ADR-XXXX — A ház riasztást kap, ha időzítő, levél vagy webhook elhasal (2026-09-29)

**Dátum:** 2026-09-29 · **Státusz:** elfogadva (deploy-készenléti SUB, koordinátor: „Deploy-készenlét
felderítés”; brief: `~/rc-briefs/dk-riasztas.md`) · **Kapcsolódó:** ADR-0129 (a fulfilment-kapu nem
tagadhatja meg a fizetni akarót — a bukás-ág riasszon), ADR-0098 (riasztási címzettek, `app_setting`),
a deploy GATE 6 (systemd-egységek a `deploy/systemd/targets.json`-ból).

**Kontextus — mérve élesen 2026-09-29.** Három hibaosztály NÉMA volt:
1. a `citoviso-*` systemd-egységeken nincs `OnFailure=` — egy elhasalt számlázási tick nyoma egy journal-sor;
2. a foglalási levél (tulajnak vagy vendégnek) bukása a `mailSafe`-ben csak `console.error`;
3. a Barion webhook 400/500-as ága riasztás nélkül — a státuszkódot csak a Barion látta;
   (+ a `billing-cycle.ts` mellék-lépéseinek hibáját try/catch nyelte el, 0-s kilépéssel).
`OWNER_ALERT_PHONE` élesen üres. Ami VAN: e-mail az `app_setting.alert_email`-re
(megrekedt rendelés, AAM-keret, visszatartott lemondás).

Ugyanaz a tanulság, mint az ADR-0129-nél (`feedback_gate_must_not_refuse_the_paying_customer`): ott a
bukás-ág e-mailt ígért, amit egyetlen kódsor sem küldött, a ház pedig csak egy `console.warn`-t kapott —
három rendelés állt fizetés nélkül, és senki nem tudott róla. **A bukás, amiről a ház nem hall, nem
javítható.**

**Döntés.**
1. **Egy csatorna, a meglévő:** `app_setting.alert_email` a meglévő levélküldőn át (`src/console/houseAlert.ts`,
   `alertHouse`). Nincs új csatorna, nincs SMS. Címzett nélkül HANGOS napló („a ház NEM lett értesítve”).
2. **Időzítő:** minden prod service `[Unit]`-jában `OnFailure=citoviso-alert@%n.service`; a
   `deploy/systemd/citoviso-alert@.service` sablon a `scripts/unit-failure-alert.mts`-t futtatja
   (egység-név + az utolsó 40 journal-sor, `SupplementaryGroups=systemd-journal`). A sablon a
   `targets.json` új `services` listáján `prod` — a GATE 6 telepíti és visszaméri, mint bármely prod
   egységet (nem engedélyezi: az `OnFailure=` indítja). A `systemd-units check` PIROS, ha egy prod
   service-ből hiányzik az `OnFailure=`, ha a sablon nincs prod-ként deklarálva, ha a sablonnak saját
   `OnFailure=`-je van (hurok), vagy ha egy időzítő nélküli service nincs a nyilvántartásban.
   A `billing-cycle.ts` elhasalt mellék-lépése után 1-es kóddal lép ki (a számlázás lefut, de az
   `OnFailure=` csak nem-nulla kilépésre sül el).
3. **Foglalási levél:** a `mailSafe(label, bookingRequestId, send)` bukáskor riaszt a levél nevével, a
   `booking_request.id`-val és a hibával. Az állapotgép változatlanul megy tovább.
4. **Webhook:** a `/pay/webhook/:gateway` 400-as ága (a `handleWebhook` mostantól okot ad: értelmezhetetlen
   visszahívás / ismeretlen fizetés) és 500-as ága (kivétel) riaszt a fizetés-azonosítóval és az okkal.
   Az ok NEM megy vissza a szolgáltatónak (a válasz-törzs változatlan). Fizetés+státusz szerint óránként
   egy levél (a Barion sokszor újrapróbál), és a nyilvános végpont miatt óránként legfeljebb 10.
   Az ártalmatlan árva callback (ismeretlen, pénz nélkül zárult fizetés → 200) csendes marad.
5. **Nincs hurok:** a riasztó levél bukása CSAK napló — az `alertHouse` nem dob és nem riaszt önmagáról,
   a sablon-egységnek nincs `OnFailure=`-je.

**Őr:** `scripts/house-alert-check.mts` (pre-commit, az érintett fájlok változására; ~16 s): mock
levélküldővel mindhárom ág, negatív kontrollal — a valódi konzol-route HTTP-n (efemer port, mock gateway,
a DB-t csak olvassa). Mutációs próba: a `mailSafe` és a webhook-route bekötését kivéve 6 FAIL.
A systemd-mechanika (`%n` → `%i`, bukó egység riaszt, sikeres nem) felhasználói systemd-n kézzel igazolva.

**Nem ebben döntve.** A `citoviso-public` / `citoviso-console` service-ek nincsenek a repóban (élesen kézzel
telepítettek), ezért `OnFailure=` sem kerülhet rájuk a GATE 6-on át. A dev gépen a sablon nincs telepítve
(a dev-egységek `OnFailure=`-je ott a semmibe mutat — ártalmatlan systemd-figyelmeztetés).

**Visszafordíthatóság:** 🔄 olcsó — a sor kivétele a service-ekből + a `services` bejegyzés.
**Elvetett alternatíva:** új csatorna (SMS/Slack) — a brief szerint a meglévő `alert_email`; külön
riasztó-folyamat helyett a systemd saját `OnFailure=`-je (nincs mit életben tartani).

## ADR-0379 — Minden operátori riasztó SMS egy úton: csendes óra 22–07 + reggeli összesítő; a desztilláló hétfő 08:00-ra (2026-10-13)

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (tulaj-döntések a „deploy” koordinátoron át, 2026-10-13) ·
**Kapcsolódó:** ADR-0376 (a ház-riasztás csendes órája), ADR-0374 (élesi őrködés), ADR-0098 (riasztási címzettek).

**Kontextus.** Az ADR-0376 csak a ház-riasztást (`houseAlert`) hallgattatta el éjjel. A többi operátori riasztó SMS
— AAM-küszöb, megrekedt rendelés, kézbesítetlen bővítés, törött mobil-pár, próba-őrszem, .hu megerősítő link,
modul-függőség ütközés, elakadt többnyelvű generálás — mind saját `sendSms()`-szel ment a riasztási számra, csendes óra
nélkül. A 10-06…10-13 felmérés szerint az egyetlen éjjeli SMS a vasárnap 04:05-ös „desztillalo” heti jelentés volt.
Tulaj: (1) a desztilláló hétfő 08:00-kor, SMS-ben marad; (2) az éles `MOBILE_SEND_WINDOW_OFF` ki (a koordinátor viszi);
(3) a többi operátori riasztás is kapja meg a 22–07 csendes órát + reggeli összesítőt, egy közös úton.

**Döntés.**
1. **Egy definíció:** `src/console/smsQuietHours.ts` (`SMS_QUIET_FROM_HOUR`/`TO_HOUR`, `smsQuietHours`, `holdForNight`);
   a `houseAlert` innen olvas (re-exportálja), az SMS-adaptert továbbra is lustán tölti.
2. **Egy út:** `src/console/operatorSms.ts` → `sendOperatorSms({ tag, to, text })`. Valódi csatornán (gammu/queue)
   22–07 között NEM küld: `night` sort ír (`house_alert_sms`, a tárgy az SMS első mondata, link nélkül), és a hívónak
   kézbesítettnek számít (`provider: "night"`) — különben a claim-et elengedő hívó (próba-őrszem) egész éjjel óránként
   újra riasztana, minden körben új levéllel. A levél mindig megy. Mock csatornán (kapuk) nincs csendes óra: a 23:00-kor
   futó kapu ugyanazt lássa, mint délben.
3. **Egy összesítő:** a meglévő `flushNightSmsDigest` (óránkénti tick, csak éles host) a ház- és az operátori
   riasztásokat EGY SMS-ben viszi 07:00 után. A dev gépen nincs tick (`targets.json`: prod) — ott az éjjel visszatartott
   operátori SMS-ről csak a levél szól.
4. **Desztilláló:** user-crontab `0 4 * * 0` → `0 8 * * 1` (hétfő 08:00; a futás ~6 perc, az SMS ~08:06). A
   `distill.sh` a fő fát nem érinti, munkaidőben is futhat.
5. **`MOBILE_SEND_WINDOW_OFF`:** kód-teendő nincs; a koordinátor 2026-10-13-án kivette az éles `.env`-ből (DEPLOY-READY §6).

**Kívül marad:** a vevőnek/tenantnak/leadnek menő SMS (próba-lejárat, számlázás, kiküldés, lead-válasz) — azokat a saját
küldési ablakuk (8–20, 9–16) kezeli; az `alert-drill.mts` kézi gyakorlat.

**Őr.** `scripts/stall-alert-check.mts` ⑧: éjjel valódi csatornán 0 SMS + `night` sor + kézbesítettnek számít; a sor
az első mondat link nélkül; mock csatornán és nappal megy; a reggeli összesítő egy SMS-ben viszi a ház- és az operátori
riasztást; mind a 8 riasztás a közös úton, közvetlen `sendSms()` nélkül. A régi kódon 9 FAIL.

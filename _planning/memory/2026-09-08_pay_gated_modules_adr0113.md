# 2026-09-08 — ADR-0113: fizetés-kapus modul-aktiválás + élő érdeklődés-kártya + minta-foglaltság

## Kiváltó (tulaj-teszt a Dencs-tenanton, pilot előtt)

1. **„A Foglalási igény nem csinál semmit."** Mérve: a kártya beküldője SOHA nem beszélt a
   szerverrel — a runtime egy senki-által-nem-hallgatott eventet dobott, majd mailto-t nyitott
   (levelezőkliens nélkül = semmi), és **kapcsolat-adatot sem gyűjtött**.
2. **Az előnézet-naptár csupa szabad.** Mérve: a minta-foglaltság (`demoBlocked`) csak
   adat-HIÁNYNÁL kapcsolt be; a Dencsnek volt alap-egysége → a valós, üres naptár renderelt.
3. **A NAGY ügy:** éves fizetés → mandátum-visszavonás → modul-aktiválás → „első díja a
   2027-09-08-i számlán" = **12 hónap ingyen**; a sosem-számlázott modul lemondása azonnali és
   ingyenes → a „forduló előtt lemond, utána visszakapcsol" hurok **örökre ingyen** (havi
   ütemnél is él, 1 hónapos szeletekben); a mandátum-visszavonás semmit nem kapuzott.
   DB-ben is igazolva (booking+pricing: active, awaiting_first_charge).

## Döntések

- **ADR-0113** (tulaj a három felkínált modell közül): fizetett modul CSAK az első díj
  beérkezése után élesedik; első díj = **időarányos** (megkezdett hónapok a fordulónapig,
  éves plafon 12−ajándék=10); kupon itt érvényesül; a kapu az ÍRÁSON
  (`applyModuleChange` → `requiresPayment`, nem ír). Az ADR-0080 ② B-opció kivezetve,
  a ③ (lemondás fordulón) változatlan.
- **§2b kör:** 2+2 működő mock (méret-váltó, valós árak/szabályok) → tulaj: **„B és B"** —
  Modulok fül: megerősítő kártya; érdeklődés-kártya: dátum után nyíló kapcsolat-blokk.
  Kontraktusok: `assets/design-refs/console/modules-pay-gate/` +
  `assets/design-refs/tenant-site/enquiry-card/`.

## Szállítva

- **Pénz-út:** `moduleChange.ts` (osztályozás→floor-guard az AZONNALI állapotra→írások;
  paid új add nem íródik), `moduleUpsell.ts` (`proratedFirstChargeMonths` +
  `createFirstChargeOrder` vevő-öröklésssel — a multilang-minta; fail-closed),
  `service.ts` (`settleUpsellPaid` közös rendező webhook+MIT-re, `chargeUpsellWithToken`,
  upsell pay-link felirat), route: token→azonnali terhelés / díjbekérő→pay-link redirect;
  `/pay/done` upsell-ág → vissza a Modulok fülre.
- **Modulok fül UI:** terv-sáv soronkénti „fizetés most" + „Fizetendő most" + gomb-feliratok;
  megerősítő kártya (tételsor, Mégsem/Tovább a fizetéshez/Terhelés és élesítés);
  siker-sávok (mcharged/mpending/payerror). A sáv és az order UGYANABBÓL a szabályból számol
  (szerver-injektált FCM/CPCT).
- **Érdeklődés:** `src/booking/enquiry.ts` (validáció site-nyelven; Üzenetek-sor ELŐBB — az
  az egyetlen rekord —, levél fire-and-forget, Reply-To a vendég), `POST /api/erdeklodes`
  (throttle), runtime bar-ág újraírva (B kontraktus; demo-mód nem küld és kimondja; a jogi
  mondat KÜLÖN sorban, hogy a státusz-üzenet ne írja felül).
- **Minta-foglaltság:** `render.ts` (preview-úton adat mellett is sample) +
  `moduleSections.ts` (sample-render mindig demo-flaggel, valós unit-okkal).
- **KB:** admin-modules (fizetés-kapu szakasz) + admin-messages (vendég-érdeklődés fogadása,
  feltételes Reply-To-val). tudasbazis-or: FLAG→javítva→FLAG→javítva→**PASS**.
- **Őrök:** module-upsell-check ÚJRAÍRVA az ADR-0113-ra (24 állítás + RED-önteszt; scratch-seed
  vevő-nyilatkozattal), entitlement-paid-check a settleUpsellPaid-alakra igazítva.

## Mérések (mind zöld)

- module-upsell-check 24/24 + self-test RED · entitlement-paid-check PASS + önteszt ·
  domain-provision-check · module-preview-check · design-token · i18n-lint + katalógus ·
  kb-check --coverage 35/35 · tsc
- **Élő felület-kör** (efemer szerver, Dencs-session): Modulok fül 21/21 — sáv → kártya →
  302 fizetőoldal → order ár = 290×10 hó −25% kupon → fizetés ELŐTT nem aktív → webhook →
  aktív, adósság-flag nélkül → siker-sáv. Érdeklődés-kártya 28/28 (mindkét méret) +
  szerver-út 6/6, ÉLES levél a tulaj címére. Screenshotok elküldve (desktop+mobil).

## Csapdák / tanulságok

- **A teszt-webhook ELHASZNÁLTA a Dencs kuponját** (redeemOffer, max_uses=1) — vissza kellett
  állítani (`offer.used_count` 0). Fizetés-utat próbáló teszt után az offer-állapotot is nézd.
- A vevő-öröklés nélkül az upsell-order a **piac-kapun** (ADR-0111, buyer_country=null) bukott
  el — a fail-closed lánc jól szólt, a multilang-minta (0029) volt a kész válasz.
- `[hidden]` vs author-CSS ismét: a `.cit-book__fields{display:grid}` felülírta volna —
  explicit `[hidden]{display:none}` szabály került a CSS-be.
- A lokál gateway Barion-SANDBOX (nem mock): a 302 a secure.test.barion.com-ra megy — a teszt
  mindkét alakot fogadja.

## Nyitott

- **Dencs legacy booking+pricing** (régi B-opciós, fizetésre váró sorok): tulaj nem döntött —
  javasolt a nullázás, hogy az új utat végig tudja tesztelni. Az entitlement-paid-check
  jelentés-szinten mutatja.
- A többi (nem-live) tenant-snapshot a régi runtime-ot hordozza (halott mailto-gomb) — a
  következő rerender hozza magával; a Dencs már az újjal él.
- A `pl` nyelvi csomag KB-fordítása 18/19 (integritás-sértés egy entrynél) — e szál előttről.
- Élesítés NINCS (§0.3).

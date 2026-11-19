## ADR-0460 — Ország-réteg 3/8: az „Országok” konzol-lap és a NYITÁS ELŐTTI TELJESSÉG — egy függvény, minden kapu ezt olvassa

**Státusz:** ELFOGADVA (tulaj 2026-11-18 „ok mehet” a briefre, 2026-11-19 a B terv — „nyitás-mátrix” — jóváhagyva;
brief `orszag-reteg-3h-orszagok-lap-20261118.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 (ország-réteg), ADR-0111 (piac-kapu), ADR-0443 (pénz-út: `marketOpenGaps`), ADR-0455 ⑩
(budapesti óra ünnepnap nélkül), ADR-0456 (megkeresés „Bábelre vár”), ADR-0458 (jogi csomag teljessége),
ADR-0412 (csak Bábel fordít) · **Terv:** `assets/design-refs/console/orszagok/` (README = kontraktus).

### Kiváltó

Az ország-sor csak SQL-lel volt tölthető, és a „nyitható-e egy ország” kérdésre hat helyen volt részválasz
(`marketOpenGaps` a régi /settings panelen, `legalPackStatus` a piac-kapuban, a nyelvi hiány a küldés-kapukban —
a TELJES katalógusra mérve, a konzol 3045 feliratával együtt, amit lead sosem lát —, a csatorna a modem-kapuban,
az ünnepnap sehol). Egy ország tehát úgy is „nyitva” lehetett, hogy az ársora hiányos volt (a vendég foglalása
némán elhasal — MEMORY „PIACNYITÁS-ELŐFELTÉTEL”), és a konzol nem mutatta egy helyen, mi hiányzik.

### Döntés

① **EGY teljesség-függvény:** `src/countryReadiness.ts` `countryReadiness(iso, {draft?, lang?, now?})`. Tételei:
Ország-adatok (a sor a `countryRules.ts` szabályai szerint hibátlan) · Ársor és fizetés (`marketOpenGaps`: EU,
szolgáltató ↔ pénznem, a régió ársora) · Nyelvi csomag (vevő-oldali mérés, ③) · Jogi csomag (`legalPackStatus`
a sor nyelvén) · Ünnepnapok (az ország zónája szerinti aktuális ÉS következő év lefedve; mozgó ünnep évenként) ·
Kiküldési csatorna (e-mail kötelező). Nem zár, csak jelez: a FR/PT fogyasztói vitarendező (`LEGAL_ADR_FR/PT` —
csak a magánszemély-utat zárja), a külföldi mobil helyi szolgáltató nélkül („a csak mobilszámos lead TARTVA” —
jelez, nem kérdez), és a HU üres ünnepnap-listája (a budapesti óra sosem ismert ünnepnapot).
Minden tétel UGYANAZT a függvényt hívja, amit a tőle függő futásidejű út — nincs újraírt logika.

② **A piac-kapu = jóváhagyás ÉS teljesség.** `markets.ts marketGate()` a `countryReadiness`-ből dönt
(`open = approved && complete`), így minden belépő (hideg megkeresés, próba, fizetési link, élesítés,
konfigurátor) ugyanazt látja. A jóváhagyott, de később hiányossá vált ország ZÁR (a lapon „jóváhagyva, hiányos”),
amíg a hiányt pótolják; a megújulások kivétele (ADR-0111) változatlan. A jóváhagyás (`POST /settings/markets`)
a szerveren is a teljességet nézi — a régi `marketOpenGaps`-ellenőrzés ennek része lett.

③ **A nyelvi teljesség VEVŐ-oldali:** `i18n/packs.ts missingBuyerPackStrings(lang)` — a katalógus minden
felirata, ami nem CSAK konzol (`catalog-context.json`; ismeretlen jelölés = beleszámít). Ezt olvassa a teljesség
és mind az öt megkeresés-küldő (cold mail, MMS+SMS pár, nem-nyitó utánkövetés, próba-kampány, viselkedés-üzenet);
a lap a Bábel-mag ráterítésével mér (`withSeed` — amit a következő provisioning amúgy is beír), a küldők a DB-t.
Felület-jelölés javítva (extract-i18n): a lead-lap kerete és a tervváltó (`prospectNotice.ts`, `planSwitcher.ts`)
vevő-oldali, a mock-fotó-ellenőrzés (`mockPhotoHealth.ts`) és az ország-szabályok/teljesség szövegei operátoriak,
a `views.ts` 7 fizetés-visszajelző/lead-felirata egyenként vevő-oldali.

④ **Az „Országok” lap** (`/countries`, Rendszer › Országok; `src/console/countryViews.ts`, `countryData.ts`):
mátrix (asztal) / kártyák (mobil, `@container`), lépésenkénti szerkesztő minden ország-sor mezővel, élő
ellenőrzés (`POST /countries/check`: a szerver adja a hibákat és a teljesség újrarajzolt darabjait — a böngésző
nem számol), mentés (`POST /countries/save`, `countryStore.ts`, ugyanazokkal a szabályokkal), ünnepnap-
szerkesztő, IFA-modell, csatornák, kvóta, ablak, és a piac-kapu blokkja (a régi /settings „Piacok” panel helyén
ott csak mutató maradt). Az euróövezet sora EUR (Bulgária 2026-01-01 óta — BGN-t a szabály elutasít), az EU-tagok
új sora nyilvános tényekkel indul (nyelv, zóna, hívószám, előtag, pénznem).

⑤ **HU bitre azonos:** a HU sor a szabályok szerint hibátlan, teljes, a kapu nyitva; a lapon érintetlen
mentése után a sor bájtra azonos (`country-page-e2e` ⑤).

### Mérés

`country-layer-check` ⑫ (egy függvény, egy olvasó, HU teljes, szabályok) · `npx tsx scripts/country-page-e2e.mts`
(scratch DB, böngészőben: új BG → hiányok → tiltott jóváhagyás, kézi POST is → fixtúrával teljes → megnyitható →
nyitva → hiányosan újra zár; HU bájtra azonos; 0 JS-hiba) · `market-gate-check`, `legal-pack-e2e`,
`money-path-e2e` (a nem-HU piacot nyitó tesztek a `scripts/lib/country-ready-fixture.mts` jelölő-fixtúrájával —
soha nem fordítás) · `dialog-fires-check` (a két indoklás-placeholder az új lapon).

### Nyitott

- A `send_window_from/to` oszlopot a küldés ma nem olvassa (a hideg megkeresés a közös hétköznapi ablakot
  követi, `MOCK_OUTREACH_WINDOW`); a lap szerkeszti és megmutatja, a bekötés külön döntés.
- Bábel: a tervváltó 12 vevő-oldali felirata (`planSwitcher.ts`) bg/fr/es/pt nyelven még nincs lefordítva, és a
  10 „egyeb” jelölésű felirat (pénznem-nevek, felderítési állapotsorok) sem.

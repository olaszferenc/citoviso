# Pénznem-kettősség: egy összeg, egy írásmód (ADR-0162)

**Dátum:** 2026-09-14 · **Szál:** A7 (Elek FK-006a ERGONÓMIA-4) · **Élesítés:** NINCS (§0.3)

## A bejelentés, és ami mögötte volt

A brief egy mondatot nevezett meg: a hat dunning-levél `{amount} {currency}`-t interpolál
(„99 900 **HUF**"), a számla-levél ugyanarról a terhelésről „99 900 **Ft**"-ot ír.
Reprodukálva a mai `origin/main`-en (`4535965`) — igaz volt.

**A mérés viszont 23 formázó-helyet talált, és ugyanaz a 99 900 HUF ÖT alakban jött ki:**

| alak | hány hely | hol |
|---|---|---|
| `99 900 Ft` (U+0020) | 8 | a legtöbb szerver-oldali nézet |
| `99 900 Ft` (NBSP) | 6 | `pricing.ts`, számla-levél, 3 beágyazott admin-script, `cit-runtime.js` |
| `99 900` (pénznem nélkül) | 2 | outreach-levél, billing-log (a mondat hordozza az egységet) |
| `99 900 Ft` (Intl, dupla NBSP) | 1 | `adminViews.ts` multilang |
| **`99 900 HUF`** | 1 | **a bejelentett lelet** |

## ⛔ A súlyosabb hiba nem a jel volt, hanem a PÉNZNEM

Öt hely bármit kapott, „Ft"-ot írt. Nem elméleti: a dev DB-ben a `pricing_config` **két sora
él** — `hu/HUF` és `global/EUR` (10 EUR/hó).

- A **fizetőoldal** a `generator/configurator.ts`-ből a **literális `"Ft"`-ot kapta
  pénznemként** (`currency: "Ft"`), és a kliens azt ragasztotta minden összegre. Egy EUR-régiós
  vevő €-ban fizetne, és „Ft"-ot olvasna azon a lapon, ahol fizet.
- A **vendég foglalás-előnézete** (`cit-runtime.js`) minden nem-EUR összeget forintnak mondott
  — és **NBSP-vel** csoportosított, míg a SZERVER (`tenant/prices.ts`) ugyanazt az árajánlatot
  sima szóközzel rendereli. Ugyanaz a vendég, ugyanaz az ár, két írásmód. (Ez ugyanaz a
  szerkezet, mint az ADR-0144 dátum-ügye: két képernyő, két forrás, egy vevő.)
- ⛔ Csapda: `Intl.NumberFormat(style:"currency")` **kivételt dob** `"Ft"`, `"€"`, `""`
  bemenetre — és a `scraper/types.ts` épp ilyet termel („a pénznem úgy, ahogy publikálták:
  `HUF`, `EUR`, `Ft`, `€`"). Ezért fail-safe minden ág.

## Amit a tulaj döntött el (AskUserQuestion, két kérdés)

1. **Hatókör: teljes osztály** — mind a 23 hely egy szabályra.
2. **Elválasztó: SIMA SZÓKÖZ** — mérésből: mind a **28** pénz-literál az őrökben és az
   Elek-forgatókönyvekben U+0020-t vár; a `billing.ts` már kézzel mosta ki az NBSP-t; SMS-ben
   az NBSP kiesik a GSM-7-ből (160 → 70 karakter). A sortörés-védelem **CSS-ügy**.
3. **§2b felület-kapu: kivétel** (naplózva) — magyar régióban a jelzett 5 felületen az egyetlen
   változás NBSP→szóköz; a valódi viselkedés-változás a nem-HUF eseteké. Előtte elküldve az
   előtte/utána bizonyíték, asztali ÉS mobil képpel + kattintható HTML-lel.

## Amit ELRONTOTTAM menet közben (és mi buktatta le)

⛔⛔ **A tükröt előbb a LAP-VÁZBA tettem (`shell()`), nem a scriptbe.** Rendezettebbnek
látszott. A tenant-admin szekciói viszont **önállóan** is renderelődnek — a saját őreik
pontosan így csinálják —, és azok a lapok sosem futtatják a vázat.

- `multilang-tier-check`: **hétszer** `ReferenceError: CitMoney is not defined`
- `modules-annual-check`: **rossz összeg: 61 500 Ft, várt 68 400 Ft**

⭐ **A második a tanulság: hiányzó formázóból ROSSZ SZÁM lett, nem csúnya szám.** Az élő
újraszámoló script elszállt, így a végösszeg némán elavult maradt. Egy formázási hiba
mennyiségi hazugsággá változott.

**A javítás iránya:** a függőség a **scripttel** utazik, nem a lappal (ugyanaz az elv, amit a
`generator/runtime.ts` már követ a vendég-widgetnél). Az újrafuttatás ártalmatlan (tiszta IIFE
egy `var`-ban); a hiányzó függőség nem az. Ez a ④ pár-ág az őrben, saját piros önteszttel.

## ⛔ Két saját szondám ELLENTMONDOTT egymásnak — és a bájtok döntöttek

Az egyik mérésem „NBSP=0"-t, a másik „NBSP=10"-et mondott UGYANARRA a lapra. A második
hazudott: a saját, kézzel begépelt karakter-osztályomba **sima szóköz** került, így mindenre
illeszkedett. **Code-pointokat dumpoltam** — mind U+0020. Ezért használ az elkötelezett őr
`\u00a0` / `\u202f` / `\u2009` **escape-eket** literálok helyett: literálként láthatatlanok a
diffben, és egy gondatlan szerkesztés némán no-oppá teszi a szabályt.

## Amit a drift-őr talált, amit én nem

- **Öt további formázó** a kézi leltár után (16 → 23): `console/partnerViews.ts` (dokumentum-
  tábla), `console/server.ts` (log), `moduleConfigViews.ts` ×2, `tenant/prices.ts` (`formatSpan`).
- **A landolási rebase-nél egy hatodik:** egy párhuzamos szál aznap emelte ki a `huf`-ot
  `hufAmount`-tá — ugyanaz az ösztön, **egy szinttel rövidebb** (a csoportosítás kézi maradt,
  a „Ft" beégetve). Iker-javítás: az ő szerkezetét tartottam meg, a szabályt tettem alá.
- **Egy új widget-fogyasztó**, ami közben landolt: `booking-outcome-truth-check.mts`.

⭐ Ez a ⑤ ág értelme: ①–④ a MAI kimenetet méri, ⑤ azt, hogy a következő kézzel írt
`.replace(/\B(?=(\d{3})+(?!\d))/g, …)` be tud-e csúszni. Egy nap alatt kétszer bizonyított.

## Mérve (a szállítás bizonyítéka)

- **7/7 levél** „99 900 Ft" (EUR-régióban „99 900 €") — egyetlen alak.
- **Paritás 727/727** a TS szabály és a böngésző-tükör közt (10 nyelv × 9 összeg × 7 pénznem).
- **Fizetőoldal valódi böngészőben:** 10 látható pénz-alak, mind U+0020, **0 JS-hiba**
  390 px-en ÉS 1280 px-en; a manifest ISO-kódot küld (`"HUF"`, nem `"Ft"`).
- **Őr:** `scripts/money-format-check.mts` — 31 állítás, **14/14 piros önteszt**, két
  álpozitív-kontrollal.
- **Meglévő őrök zöldek:** configurator-float (19 sablon) · modules-annual · multilang-tier ·
  booking-price-coherence · module-upsell · renewal-date-coherence · partner-ui ·
  checkout-viewport · unit-subpage · configurator-price · booking-outcome-truth.

## Mellék-leletek

- ⚠️ **NEM ez a szál okozta:** a `scripts/shot-booking-form.mts` az **érintetlen**
  `origin/main` `4535965`-ön is elszáll (strict-mode locator ütközés két `.cit-book__note`
  elemen — az error-jegyzet és a jogi jegyzet). Megmérve: a HEAD forrásait visszaállítva
  ugyanaz a bukás. A vendég foglalás-widgetjének viselkedése tehát ma MÉRETLEN.
- A `restoreNotice.ts` NBSP-strip-je **no-op volt** (`replace(/ /g, " ")` — két sima szóköz),
  vagyis az a levél tényleg NBSP-vel ment ki. Hatodik alak, amit a leltár se fogott meg.
- A `generator/configurator.ts` `currency: "Ft"` mezője **hat hónapja** ISO-kódnak látszó
  helyen ült pénznem-jellel.

## Nyitott

- ① A `shot-booking-form.mts` strict-mode ütközése (fenti) — külön kör, nem az enyém.
- ② A 6 megváltozott i18n-kulcsot a nem-magyar csomagok újrafordítják az `ensureLanguagePack`
  első futásán. Magyarra nincs hatása.
- ③ `payLinkAlert.ts` / `aamAlert.ts` **operátor**-SMS-ei `amountHuf` mezőből írnak „Ft"-ot —
  a mező neve szerint tényleg HUF, tehát a jel helyes; a csoportosítás viszont hiányzik.
  Szándékosan nem nyúltam hozzá (operátor-riasztás, nem vevő-felület).

## Módosított / létrehozott fájlok

**Új:** `src/text/money.ts` · `assets/runtime/cit-money.js` · `scripts/money-format-check.mts`

**Módosított (23 hívó + kiszolgálás):** `src/email/billingEmail.ts` · `src/email/invoiceEmail.ts` ·
`src/payment/billing.ts` · `src/payment/restoreNotice.ts` · `src/domains/settlementNotify.ts` ·
`src/pricing.ts` · `src/tenant/prices.ts` · `src/engine/moduleSections.ts` ·
`src/generator/configurator.ts` · `src/generator/runtime.ts` · `src/server/adminViews.ts` ·
`src/server/moduleConfigViews.ts` · `src/server/public.ts` · `src/console/views.ts` ·
`src/console/partnerViews.ts` · `src/console/partnerData.ts` · `src/console/server.ts` ·
`src/outreach/draft.ts` · `assets/runtime/cit-runtime.js` · `assets/runtime/cit-configurator.js` ·
`src/i18n/catalog.json` · `scripts/renewal-date-coherence-check.mts` ·
`scripts/shot-booking-form.mts` · `scripts/booking-outcome-truth-check.mts` ·
`_planning/DECISIONS.md` (ADR-0162)

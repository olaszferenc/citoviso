# 2026-09-23 — Árajánlat ár nélküli kérésre + évhez kötött ár (ADR-XXXX)

**Szál:** „CIT ➕ Árazás kikényszerítése” (munkafa `~/wt/arazaskenyszer`). Mandátum: a fa
`BRIEF.md`-je (az ADR-0208 ⑥ öt nyitott tétele); ebből az ① (tulaj-értesítés) készült el, és
magával hozta az ⑤ (évhez kötött ár) ALAPJÁT. **Élesítés nem volt feladat.**

## Mi történt

1. **Felderítés → a premissza módosult.** A brief „egy levél, `notified_at`, a multilang mintája”
   tervet javasolt. Mérve: a tulaj MÁR kap levelet minden kérésről — a hiba az volt, hogy ár nélkül
   a levél némán kihagyta az árat, és egy koppintásos „Elfogadom” ÁR NÉLKÜL véglegesített.
   A tulaj ezt a képet kapta, és a mélyebb utat választotta (B: ajánlat → a vendég elfogadja).
2. **§2b két kör.** 1. kör: A (egy lépés) / B (két lépés) + „nincs árlista” eset. A tulaj: B, de
   ① a „nincs árlista” foglalásnál nem létezhet (mérve igaz: `booking` kemény függősége a
   `pricing`), ② „a rendszerből árazzon, nem fogja nyomon követni”, ③ „nem kikényszerítő —
   dátum, és figyelmeztetés, ha nincs”. 2. kör után a tulaj **nem látta a válaszomban**, hogyan
   fogad el a vendég — lépésenként újra kellett mondanom (tanulság lent). + „A vendég elfogadta
   (telefonon / levélben)” gomb a tulaj ötletére.
3. **Megvalósítás** — kontraktus `assets/design-refs/tenant-admin/booking-offer/`, migráció 0072
   (a mezőneveket a tulaj jóváhagyta), `cit-season.cjs` rétegzett sorrend, ajánlat-lap, vendég-lap,
   Foglalások fül, Árazás lap „Alapár, dátummal” sor, lejárat előtti emlékeztető + lejáratkori
   törlés/újrarenderelés, KB-szakasz.

## Tanulságok (a következő szálnak)

- ⛔ **A KÉP fogta meg a súlyos hibát, nem a 100 zöld állítás:** a tulaj ajánlat-üzenete „Vendég”
  címkét kapott, mert a szerzőt a `decided_by` adja, és az ajánlat elfogadásakor a VENDÉG írja.
  Egy meglévő, jóváhagyott kontraktus (quote-author) sérült volna. Az őr most a renderelt sort méri,
  piros kontrollal.
- ⛔ **Idegen őr fogta a duplikált pénz-formázót** (`money-format-check` ⑤) — a saját őröm zöld volt.
- ⛔ **Kétszer a saját állításom volt hibás**: `text-transform: uppercase` → az innerText
  „VENDÉG”/„AJÁNLATRA VÁR”. Címkére kis-nagybetű-függetlenül mérj.
- ⛔ **A commit-kapuk még hármat fogtak:** a modul-lap `requestsCard`-ja HALOTT kód (a rá írt
  módosítás semmit nem csinált — mérés közben derült ki, visszavonva); a hatókörbe felvett
  ajánlat-lap minden nyelven magyar hónapnevet írt (→ `formatDay`); a kontraktus-README egy
  idézett felirata kisbetűs volt. + a KB-fordítás a commit kapuja (a kb-translate ~15 perc).
- ⭐ **A piros kontroll kézzel is érték:** a koppintásos zár kivétele pontosan a régi hibát hozta
  vissza (ár nélkül „accepted”, 5 nap foglalt) — az őr pirosra ment. Formális `--selftest` nincs.
- ⚠️ **„Hogyan megy vissza a rendszerbe?”** — a folyamat-kérdésre a válasz legyen LÉPÉSLISTA
  (kattintás → mit ír a rendszer → ki kap levelet), nem jellemzés. Az első válaszom a mechanizmust
  írta le, a tulaj nem találta benne a választ.

## Módosított / új fájlok

- `migrations/0072_booking_offer_dated_price.sql` (új) · `src/db/schema.ts`
- `assets/runtime/cit-season.cjs` · `src/tenant/seasonRule.ts` · `assets/runtime/cit-runtime.js`
- `src/tenant/prices.ts` · `src/tenant/editor.ts` · `src/tenant/availability.ts`
- `src/tenant/priceExpiry.ts` (új) · `scripts/booking-maintenance.mts`
- `src/booking/requests.ts` (ajánlat-modul, közös `acceptCore`, levelek)
- `src/server/offerViews.ts` (új) · `src/server/public.ts` · `src/server/bookingViews.ts` ·
  `src/server/moduleConfigViews.ts` · `src/engine/moduleSections.ts` · `src/engine/recipe.ts`
- `scripts/booking-offer-check.mts` (új, 110 állítás) · `scripts/season-rule-check.mts` ·
  `scripts/booking-price-coherence-check.mts` · `scripts/kb-check.mts`
- `kb/entries/admin-bookings/entry.hu.md` (+ `assets/hu/offer.png`) · `src/i18n/catalog.json` ·
  `scripts/i18n-sources.mjs` · `scripts/kb-shot.mts`
- `assets/design-refs/tenant-admin/booking-offer/` (kontraktus + 9 kép)
- `_planning/DECISIONS.md` (ADR-XXXX) · `_planning/DOMAIN/05-MODULES.md` (az ár ideje)

## Nyitva

ADR-0208 ⑥.2 (a „nincs ár” kimondott döntés) · ⑥.3 (új egységnél kérje az árat) · ⑥.4 („X napja
hiányos” emlékeztető — a dátumos ár emlékeztetője kész) · ⑥.5 felülete („Főszezon 2027” az Árazás
lapon + nudge a szezon záró napja után). + a `guestPageShell` „Vissza” gombjának elcsúszott szövege,
+ Barion süti-sáv a tulaj tokenes lapjain (meglévő viselkedés).
+ ⛔ `configurator-placement-check` piros a main-en (nem determinisztikus, a bisect doksi-commitra
mutatott) — a feature-commit a tulaj engedélyével `--no-verify`-jal ment. Külön szálnak.
+ ⚠️ A munka közben a main-en landolt: ADR-enkénti fájl (ADR-0210 — az én számom 0212 lett),
a fordítás-commit-kapu kivétele (ugyanaz a döntés, mint az enyém — az övé él), és az Árazás lap
„szezon-zárás csak foglalással” javítása. Hosszú munka KÖZBEN is fetchelj.

# 2026-09-22 — Ár nélkül árajánlat, és a szezon-szabály egy példányban

**Szál:** `wt/uresmodul` · **ADR-0208** · a `bought-but-empty-brief` folytatása (ADR-0197 ①)
**Landolt:** `dcb130b` (szezon-szabály) · `7f7045b` (idegen őr hónapforduló-hibája) · `eeb01e7` (árajánlat-mód)

---

## Amit szállítottunk

**① A szezon-illesztés EGY példányban** (`assets/runtime/cit-season.cjs` + loader). A „melyik
ár-sor vonatkozik erre az éjszakára?" kérdés két példányban élt — az egyik azt döntötte el, mit
OLVAS a vendég, a másik azt, mi FAGY RÁ a kérésre és megy ki a levelében —, és a kettőt semmi
nem vetette össze. A hónap-nap feltevés öt helyen élt külön. ⭐ Ez az év-specifikus szezonár
előfeltétele: mérve, a 12 hónapos horizonton belül **ugyanaz a 96 000 Ft** fagy be 2027
júliusára, mint 2026-ra.

**② Árajánlat-mód** (§2b, 3 változat, a tulaj a **C**-t választotta). Ha a tartózkodás bármelyik
éjszakájára nincs ár: a néma üresség helyén magyarázat, a gomb **„Árajánlatot kérek"**, és a
gomb alatti ígéret is átíródik. A választó már a választáskor jelzi („· egyedi ár") — ez
SZERVER-oldali, mert a végpont egyszerre egy egységre válaszol.

## ⛔⛔ Öt saját hiba — egyiket sem a gondolkodás fogta meg

1. **A végponttól-végpontig mérésem HAMIS ZÖLDET adott.** Valódi DB + szerver + böngésző,
   mindkét méret, változatlan összegek → „viselkedés-semleges". Nem az volt: három script
   **kézzel** fűzi össze a runtime-fájlokat, és az új fájl nélkül a `cit-runtime.js` egy
   **undefined `CitSeason`**-ön hal meg. 7 állítás ment pirosra egy idegen kapun, és **egyik sem
   mondta, hogy a runtime szállt el**. ⭐ A mérésem azért volt vak, mert **csak azt az utat
   járta, amit én írtam**.
2. **Kettős keret** — a konténer már viselt keretet, a dobozom egy másodikat tett bele. A
   **KÉP** mutatta meg; közben 14 gépi állításom zölden állt.
3. **A `note` elem KÖZÖS** (ígéret + validációs hiba): az első változatom letörölte az élő
   hibaüzenetet, a hiba elmúltával pedig a FOGLALÁSI ígéretet hozta vissza. Idegen őr mérte ki.
4. **A 3-ra írt első állításom is hibás volt** — szintetikusan levettem a hiba-osztályt, de a
   visszaállítót sosem hívtam meg: a saját mérésem bukott, nem a kód.
5. **Idegen őr hónapforduló-hibája** (2026-09-08 óta lappang) blokkolta a landolást; és a
   **javításom szülte a következő hibát** (a sorrend számított: az első csíkos cella a kézi
   blokk lett, aminek nincs vendége).

## Módszertani tanulság, ami átvihető

⭐ **Egy új runtime-fájl bevezetése nem lokális változás:** „miből áll a lap runtime-ja" KÉT
helyen van felsorolva (az injektorban és minden kézi lapépítőben). Ugyanez a csapda már elsült
a `cit-money.js`-szel — most párosítás-őr védi, éles negatív kontrollal.

⭐ **A saját mérésem hatóköre a saját vakfoltom.** Ha a mérés csak azt az utat járja, amit én
írtam, akkor a „viselkedés-semleges" állítás annyit ér, amennyit az út lefedettsége.

## Módosított fájlok (a három commit összesen)

- `assets/runtime/cit-season.cjs` · `src/tenant/seasonRule.ts` · `scripts/season-rule-check.mts` (új)
- `assets/design-refs/tenant-site/quote-request/` (kontraktus) · `scripts/quote-request-check.mts` (új)
- `assets/runtime/cit-runtime.js` · `cit-modules.css` · `src/tenant/{prices,availability,editor}.ts`
- `src/booking/requests.ts` · `src/engine/{recipe,generator/runtime}.ts` · `src/i18n/catalog.json`
- `scripts/{booking-price-clarity,booking-outcome-truth,shot-booking-form,booking-screen}-check*.mts`
- `hooks/pre-commit` · `_planning/DECISIONS.md` (ADR-0208)

## Nyitott (mind külön mandátum)

1. **A tulaj értesítése**, ha árajánlat-kérés jön árazatlan egységre — a szelet tulaj-oldali fele.
2. **Három állapot**: a „nincs ár" legyen döntés. ⚠️ A `setBasePrice()` a 0-t nem tárolja.
3. **Új egység felvételekor** kérje az árat.
4. **Emlékeztető**, ha X napja hiányos az árazás.
5. **Év-specifikus szezonár + nudge** — az alap megvan.
6. **ADR-0197 ②**: a polcról levett modult tovább számlázzuk (`newsletter` 490, `email` 390).

⚠️ **Élesítés nem volt feladat** — minden a `main`-en van, az éles gép változatlan.

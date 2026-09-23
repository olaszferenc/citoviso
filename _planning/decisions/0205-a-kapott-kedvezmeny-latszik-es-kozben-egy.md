## ADR-0205 — A kapott kedvezmény LÁTSZIK, és közben egy fillér sem mozdul (2026-09-22)

**Dátum:** 2026-09-22 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:**
ADR-0088 ④⑥ (a kupon a VÁSÁRLÁSNÁL számít, „visibly, not buried" — ez az ADR teljesíti be),
ADR-0113 (az azonnali terhelés), ADR-0194 (ugyanaz a kár-osztály: a vevő fizet, és nem tudja
meg, mit kapott), ADR-0029 (számla-kapu). Kontraktus:
`assets/design-refs/tenant-admin/coupon-visible/README.md`.

### A mért tényállás

A tulaj 14 775 Ft-ot fizetett három modulért, és **nem tudta eldönteni, jó-e a szám**
(„nekem kevésnek tűnik"). Jó volt: 1 970 Ft/hó × 10 hónap = 19 700 Ft listaár, mínusz egy
25 %-os üdvözlő kupon (ADR-0088 §6) = 14 775 Ft. A terhelés és a számla is pontosan ennyi.

De ezt **egyetlen felület sem mondta ki**: a visszaigazoló sáv csak a végösszeget írta (a
redirect kizárólag `mamount`-ot vitt), a számlán egy tétel állt levezetés nélkül. Az adat
végig megvolt — `order_intent.list_price`, `offer.percent` —, csak sosem olvastuk vissza.

Ha a TULAJ nem tudja ellenőrizni a saját terhelését, a vevő végképp nem. És mivel a kupon
**egyszeri**, a megújításkor ugyanez a három modul a teljes 19 700 Ft — magyarázat nélkül ez
drágulásnak látszott volna.

### A döntés

1. **Kuponos vásárlásnál a sáv LEVEZETÉST mutat** (jóváhagyott C változat): díj →
   kedvezmény (összegben ÉS százalékban) → a terhelt összeg, alatta a **megújítás-
   figyelmeztetés** a teljes díjjal.
2. ⛔ **Kupon nélkül marad a régi egymondatos sáv.** Egy nyugta, aminek minden sora „−0 Ft",
   zaj — a tulajdonosi döntés ezt kifejezetten kizárta.
3. **A számlán a kedvezmény a TÉTEL NEVÉBEN és a MEGJEGYZÉSBEN jelenik meg.**
   ⛔⛔ **Külön kedvezmény-SOR TILOS.** A Számlázz.hu összeadja a tételeket, tehát egy
   −4 925 Ft-os sor a 14 775 Ft-os végösszeget 9 850-re vinné: a láthatóvá tételből **rosszul
   számlázás** lenne. **A tételek összege mindig pontosan a terhelt összeg.**
   ⚠️ Azt, hogy a szolgáltató API-ja támogat-e külön kedvezmény-mezőt, a kódból nem lehetett
   eldönteni — ezért a választott két hely az, amelyik **bizonyíthatóan** nem nyúl az
   összegekhez. Ha valaha kedvezmény-sort akarunk, azt teszt-számlával kell MEGMÉRNI.
4. **A modulokat „ · " választja el, és minden név egyben törik.**
   ⛔ A 14 modulnévből **hat maga is vesszős** („Árak, szezonok"), ezért a `", "`-vel fűzött
   felsorolás három modulból ötöt csinált — pont ez állt a tulaj képernyőjén, miközben a
   számla mellette „3 modul"-t írt. A `nowrap` sem elhagyható: 390 px-en a sor a NÉVEN BELÜLI
   vesszőnél tört, lógó vesszővel zárva a sort.
5. **A kedvezmény-szám kontrasztja mérve AA-konform.** A nyers `--citui-ok` fehér dobozon
   3,00:1 — épp az a szám bukott, amelyik a kedvezményt igazolja. 70 %-os keverés: **4,87:1**
   (a 75 % 4,51 lett volna, azaz épp-hogy — az nem tartalék).

### Őr

`scripts/coupon-visible-check.mts` (bekötve a `hooks/pre-commit`-be): a sáv kuponnal ÉS kupon
nélkül, a számla tételei, a megjegyzés — és **minden esetben a végösszeg-egyezés**.
`--self-test` visszarontva 8 bukás, köztük a tiltott kedvezmény-sor, ami elviszi a végösszeget.

⚠️ **A mérőeszköz háromszor hazudott, mielőtt a termék egyszer is:** az őr non-greedy regexe
az első belső `</div>`-nél levágta a sávot (hibátlan kódra 4 bukás); a pixel-alapú „zöld sáv
keresése" vak volt a `#e7f8ef` háttérre („a sáv nincs a lapon", miközben ott volt); a
`toLocaleString` nem-törő szóköze pirosra vitt egy hibátlan megjegyzést. Mindhárom ugyanaz a
tanulság: **a mérőeszköz hibája megkülönböztethetetlen a termék hibájától**, amíg egy másik
módszerrel vissza nem mérjük.

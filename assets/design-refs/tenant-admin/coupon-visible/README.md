# KONTRAKTUS — a kapott kedvezmény LÁTSZIK (vásárlás-visszaigazolás + számla)

**Jóváhagyva:** 2026-09-22. Három megfogalmazást kapott a tulaj (A: a levezetés a mondatban ·
B: külön kedvezmény-sor · C: nyugta-levezetés), a választása a **C** volt.

- Terv: `plan.html` (önhordó, kattintható; méret-váltó ÉS kupon-kapcsoló)
- A jóváhagyott kép: `plan-mobile.png`, `plan-desktop.png`, `plan-nocoupon-mobile.png`
- A LESZÁLLÍTOTT sáv: `shipped-mobile.png`, `shipped-desktop.png` (valós tenant, élő adat)

**Hatókör:** `src/server/adminViews.ts` · `src/payment/service.ts` · `public/assets/ui/citui-admin.css`

---

## A kiváltó tényállás

A tulaj 14 775 Ft-ot fizetett három modulért, és **nem tudta eldönteni, jó-e a szám**
(„nekem kevésnek tűnik"). Jó volt: 19 700 Ft-os díj, 25 %-os üdvözlő kupon. De ezt egyik
képernyő sem mondta ki — sem a visszaigazoló sáv, sem a számla —, pedig a `list_price` és az
`offer.percent` ott van a rendelésben. Ha a TULAJ nem tudja ellenőrizni a saját terhelését,
a vevő végképp nem. A kupon ráadásul **egyszeri**: a megújításkor ugyanez a három modul a
teljes 19 700 Ft-ba kerül, és enélkül a vevő jövőre magyarázat nélküli drágulást látna.

## Mit KÖT ez a terv

1. **Ha kupon csökkentette az árat, a sáv LEVEZETÉST mutat**, nem puszta végösszeget:
   díj → kedvezmény (összegben ÉS százalékban) → a terhelt összeg. A végösszeg a
   leghangsúlyosabb szám.
2. **Alatta a megújítás-figyelmeztetés**, a teljes díjjal — ez védi a vevőt a jövő évi
   meglepetéstől.
3. ⛔ **Kupon nélkül a sáv a régi egymondatos marad.** Egy nyugta, aminek minden sora
   „−0 Ft", zaj: a tulajdonosi döntés kifejezetten kizárta.
4. **A modulokat „ · " választja el, és minden név egyben törik** (`.adm-nowrap`).
   ⛔ A nevek MAGUK is vesszősek (14-ből 6: „Árak, szezonok", „Környék, látnivalók"…), ezért
   a vesszős felsorolás három modulból ötöt csinál — pont ez állt a tulaj képernyőjén,
   miközben a számla mellette „3 modul"-t írt. A `nowrap` sem elhagyható: 390 px-en a sor a
   NÉVEN BELÜLI vesszőnél tört, lógó vesszővel zárva a sort.
5. **A számlán a kedvezmény a TÉTEL NEVÉBEN és a MEGJEGYZÉSBEN jelenik meg.**
   ⛔⛔ **Külön kedvezmény-SOR TILOS.** A Számlázz.hu a tételeket összeadja, tehát egy
   −4 925 Ft-os sor a 14 775 Ft-os végösszeget 9 850-re vinné — a láthatóvá tételből rosszul
   számlázás lenne. **A tételek összegének mindig pontosan a terhelt összegnek kell lennie.**
6. **A kedvezmény-szám kontrasztja mérve AA-konform**: a nyers `--citui-ok` fehér dobozon
   3,00:1 (bukás), ezért 70 %-os keverés a navy-950-nel → **4,87:1**. A 75 % 4,51 lett volna,
   vagyis épp-hogy — az nem elég tartalék.

## Kötő feliratok

- **„Üdvözlő kedvezmény ({pct}%)"** — a kedvezmény sora a levezetésben.
- **„A kártyáját megterheltük"** — a végösszeg sora; ez a nyugta alja.
- **„{n} modul a fordulónapig"** — a díj sora, ami megmondja, mennyi időre szól.
- **„A kedvezmény egyszeri — a következő megújításkor {sum}/év díjjal szerepelnek a számlán."**

## Kötő horgony

- `adm-rcpt`
- `adm-rcpt__row--neg`
- `adm-rcpt__row--tot`
- `adm-nowrap`

## Őr

`scripts/coupon-visible-check.mts` (bekötve a `hooks/pre-commit`-be): méri a sávot kuponnal
és kupon NÉLKÜL, a számla tételeit és a megjegyzést — és minden esetben visszaméri, hogy a
**tételek összege pontosan a terhelt összeg** maradt. `--self-test` visszarontva 8 bukás
(köztük a tiltott kedvezmény-sor, ami elviszi a végösszeget).

⚠️ Az őr a sávot **mélység-helyesen** vágja ki (`sliceElement`), nem non-greedy regexszel: a
sáv beágyazott `<div>`-eket tartalmaz, és a lusta illesztés az első belső `</div>`-nél megáll
— emiatt az őr első változata HIBÁTLAN kódra jelentett négy bukást.

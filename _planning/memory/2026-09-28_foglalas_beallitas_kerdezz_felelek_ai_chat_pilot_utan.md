# 2026-09-28 — A foglalás beállítása egyszerűbb lesz: kérdezz-felelek + fókuszált AI chat (PILOT UTÁN)

⏰ **Jövőbeli feature — MOST NEM épül, nem az első deployjal, nem megy mainbe kódként.**
Ez a jegyzet csak a tulajdonosi irányt rögzíti, hogy a pilot után innen induljunk.

## A probléma (mérve, 2026-09-28)
A tenant-oldali foglalás a limitált IT-képességű célcsoportnak túl bonyolult:
- ~30 beállítás **3 modulban** (Szobák, apartmanok · Árak, szezonok · Online foglalás),
  kemény függőségekkel (`modules.ts` · `DOMAIN/05-MODULES.md`);
- ~10 megértendő fogalom (egység vs. „egész szállás egyben”, egységenkénti naptár, alapár vs.
  időszaki ár, ár-egység, min. éj globálisan és szezononként, „csak a felsorolt időszakokban”,
  kérés-lejárat, átfedés-választó, IFA háromállapotú, árajánlat vs. foglalás);
- néma blokkolók: hiányzó ár → a vendég gombja csendben „Árajánlatot kérek” lesz; a képernyőn
  kívüli kötelező rádió → néma „Hozzáadás” (lásd `2026-09-28_ejszakai_kor_tulaj_vendeg_telefonon.md`).

## A tulajdonosi irány
1. **Kérdezz-felelek** — EGY közös út a 3 modulra (a szétválasztás csak a számlázásban él
   tovább); **első beállítás ÉS későbbi módosítás** is ezen megy; a mai részletes űrlap
   „Haladó” mögé kerül. Hétköznapi kérdések, ahol lehet, a begyűjtött adatból előtöltve;
   a végén magyar nyelvű összefoglaló + „Nézze meg vendégként”.
2. **Fókuszált AI chat — EVOLÚCIÓBAN:**
   - 1. kör: csak a foglalásról beszél, a tulaj VALÓS beállításait és a súgót látja, **magyaráz
     és elvezet** — az adatot a tulaj maga adja meg.
   - Ha a pilot **fizetőképes keresletet** mutat → szofisztikáltabb megoldás (pl. módosítási
     javaslat-kártya „Alkalmaz” gombbal, később írás). Árat/tényt soha nem talál ki (§B.17).

## Miért a pilot után
- A pilotig a szűk keresztmetszet a HIBÁK: a vendég telefonon nem tudott foglalni
  (FK-014, oka nyitott), néma „Hozzáadás”, a tulaj nem látja, miért nem foglalható.
- A pilot adja a bizonyítékot: ha az első tulajokat kézzel vezetjük végig, látjuk, hol akadnak
  el és mit kérdeznek → ebből lesz a kérdéssor és a chat tudása; és méri a keresletet.

## Nyitott
- A §2b terv-kapu (mobil + asztali mock) a pilot utáni indításkor.
- AI-költség tenantonként, modellválasztás, rate-limit.
- Módosított fájlok: ez a jegyzet + `/MEMORY.md` fejléc-bejegyzés. Kód nem változott.

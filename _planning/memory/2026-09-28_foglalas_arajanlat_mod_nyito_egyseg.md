# 2026-09-28 — A vendég nem tudott foglalni: a widget az ár nélküli „egész szállásra” nyitott (+ a nem kiadó egész rejtve)

Brief: `~/rc-briefs/foglalas-arajanlat-mod.md` (az éjszakai kör FK-014 lelete). Koordinátor: `citded06a5f`.
Döntés: ADR-0256 (a land osztja ki). Nem élesítve — a nagy deployjal megy.

## A mechanizmus (mérve, 390 px valódi touch + 1440, dev bérlő `harom-huszar-apartments`)

- A widget a lista ELSŐ egységére nyitott: „A szállás egésze · egyedi ár” — kiadó egyben (Elek „Igen”-t
  mondott az FK-013-ban), de ár nélkül → `quoteFor` null → árajánlat-mód.
- Telefonon az egység-választó az 1. lépésben **0×0** (a `formcol` rejtett) — a vendég az egész szállás
  naptárában választott napot. A 2. lépésben a választó látszott, Nádasra váltva azonnal 48 000 Ft és
  „Foglalási kérés elküldése” — tehát szó szerint nem zsákutca, hanem egy néma kerülőút.
- A tulaj oldalán a vezérlőpult már szólt („1 szobájának nincs ára — A szállás egésze”).
- A briefben szereplő „tűnjön el, ha nem kiadó egyben” szabály itt NEM segített volna: az egész be volt kapcsolva.

## Tulajdonosi döntések (szó szerint, a koordinátoron át)

- „1 az irány” — áras egységre nyit + választó az 1. lépésben (a 4-es ág, az ár bekérése az „Igen”-nél, az admin-szálé).
- „Tűnjön el ha nem kiadó az egész egyben.” → a felismerés: „B” (második kérdés a 2. szoba felvételekor).
- Futó foglalásnál: „ok B” — a rejtés engedett, a VALÓDI számmal kimondva.
- Mindkét §2b terv: „ok”.

## Amit csináltam

- **Vendég-widget** (`cit-runtime.js`, `cit-modules.css`): első ÁRAS egység nyit; telefonon (≤559 px, `matchMedia`)
  ugyanaz a `<select>` a naptár fölé költözik; a 2. lépés összegzője megnevezi az egységet.
- **Adat** (`0078_unit_represents_whole.sql`): `represents_whole` = „ez maga a hely”; visszatöltve = `is_whole_property`
  (12 egység a dev DB-n). Predikátum: `isGuestVisibleUnit` / `guestUnits` (`units.ts`), az `editor.ts` EGY szűrője
  minden vendég-listára; `/api/foglalas` rejtett egységre 400.
- **Admin** (`moduleConfigViews.ts` `wholeQuestion`, `public.ts` `/admin/units/save`, `citui-admin.css`): a „Nem” után
  második kérdés (CSS-sel nyílik), kliens- és szerver-oldali kimondott hibák, a szerver hiányos válasznál semmit nem ír;
  futó foglalások valódi száma (`futureAcceptedBookings`); `settleFormerWhole` (egesz / szoba + új slug / rejt).
- **Őrök:** új `booking-unit-default-check` (+ `--selftest`: 9 piros); `whole-property-choice-check` ①b (böngésző,
  390 touch) + ⑧ (18 állítás, negatív kontrollal); igazítva: `quote-request-check`, `shot-booking-form` (a választó
  helye szándékosan változott — az állítás követi a kontraktust, a mért viselkedés ugyanaz).
- **Kontraktusok:** `design-refs/tenant-site/booking-unit-default/`, `design-refs/tenant-admin/whole-property-second-question/`;
  a `booking-mobile-two-step` README egy sorral kiegészítve.

## Csapdák, amiket menet közben mértem

- A mock első változatában a név-mező 16×16 px volt: a `.rs-wq__o input` (rádió) szabály a szövegmezőre is ráhúzott.
- Enterrel küldve a hibaüzenet azonnal eltűnt: a név-mező blur-`change`-e a fókuszváltáskor törölte → csak a kérdés
  saját mezői törölhetik.
- Egy runtime-KOMMENTBEN szó szerint idéztem „A szállás egésze”-t — a runtime minden vendég-lapba beégetve megy,
  így a markup-próba (és minden vendég-lap forrása) tartalmazta. A runtime maga is hordja `tr("A szállás egésze")`-t,
  ezért az őr a SZKRIPTEK NÉLKÜLI markupot méri, negatív kontrollal.
- Munkafából szerver nem indítható (hook): a vendég-lapot a valódi snapshotba fűzött ÚJ runtime-mal mértem (fetch-shimmel),
  a közös `sites/`-t nem írtam felül.

## Igazolás a land után (2026-09-28)

- Dev DB: a `represents_whole` visszatöltése még egyszer lefutott, mert a fő fa régi kódja közben
  `false`-szal hozta létre a `kemences-vendeghaz` egészét (1 egység).
- A Három Huszár snapshotja újrarenderelve.
- **FK-014:** a vendég FOGLALT: „Elküldtük a kérését” · „Hivatkozás” · „48 000” zöld; a levél „Foglalási kérését rögzítettük”.
  Egyetlen piros: a vélemény 400 „Már küldött véleményt” — tesztadat-ismétlés (az első éjszakai kör ugyanazzal a címmel írt).
- **FK-015:** 0/4/9. A forgatókönyv „56 000 Ft”-ot és egy „Elek Vendég Ajánlat” árajánlat-kérést vár, amit a lánc nem hoz létre
  (48 000 Ft; az FK-014 ⑦ csak `tedd?`-del tölt). A `.adm-msg__qa` koppintására nincs megerősítő, a `.bk-ovnote` nem
  található → a kérés `pending` marad, **FK-016 KIHAGYVA**. Átadva a koordinátornak (az éjszakai kör szála).
- Közben: a `price-where-check` a tiszta mainen piros volt — a `wordmark-grow`/`arch-frames` sablon `rooms.slice(0, 3)`-mal
  eldobta a 4. szobát (a kapu gazdája javította: e4d05534).

## Nyitott

- FK-015/FK-016 a tulaj-oldali utóélet forgatókönyv-igazítására vár (koordinátor).
- Egy korábban megírt `apartman/<slug>.html` a rejtés után is kiszolgálható (a sitemap már nem listázza) — csak a kártyán
  utólag kikapcsolt egésznél fordulhat elő.
- `quote-request-check --selftest` a visszarontott lapon kivétellel áll meg (`.cit-book__ask` boundingBox) — régi, piros marad.
- Admin-szál (`citb1fc5246`): a „nincs ára” figyelmeztetés az `isGuestVisibleUnit`-re épül — a land után szólok.

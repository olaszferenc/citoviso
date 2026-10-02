# KONTRAKTUS — Elek élesi leletei: szoba-törlés, megmaradt szoba, ár-alap, IFA a beküldés után

**Jóváhagyta:** a tulaj, 2026-10-02, a koordinátoron át („egyetértek” a javaslatokkal; §2b terv-kapu) ·
**Változat:** A-1 = **B** (nyitott kérésnél a törlés tiltva), A-2 · V-2 · V-3 · A-3 · A-4 a javaslat szerint ·
**Terv:** `plan.html` (önhordó, kattintható, MŰKÖDIK, mobil/asztali váltó) · **Képek:** `*-mobil.png`, `*-asztali.png`
**Hatókör:** `src/server/moduleConfigViews.ts` · `src/tenant/units.ts` · `src/server/bookingViews.ts` · `src/booking/requests.ts` · `assets/runtime/cit-runtime.js`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A forrás Elek élesi jelentése
(2026-10-01, Muschel teszt-tenant): A-1, A-2, A-3, A-4, V-2, V-3. Őrök:
`scripts/unit-delete-confirm-check.mts` (A-1 · A-2 · A-3 · A-4) és
`scripts/booking-tax-receipt-check.mts` (V-2 · V-3), mindkettő a javítás előtt pirosan mérve.

A `plan.html` az A-1-nél a döntés előtti két változatot (A és B) is mutatja — **a B a kötő**.

---

## ① A-1 · Szoba törlése — megerősítéssel (KÖT)

Mért kiindulópont: a **„Szoba törlése”** (szoba-felugró) és a Foglalás lap **„Törlés”** gombja egy
kattintásra törölt. A `site_unit` kaszkáddal viszi a szoba naptár-napjait, árait, naptár-szinkronját
és MINDEN foglalási kérését — a függőben lévőt is, aminek a vendége így soha nem kap választ.

**KÖT:**
1. A gomb nem töröl: a helyén **kártyán belül** nyíló megerősítő (details/summary — JS nélkül is
   nyílik), a foglalás-visszaigazolás mintájára. Mindkét törlő gombon.
2. A kérdés megnevezi a szobát, és **SZÁMOKKAL** mondja, mi vész el: **„A szobával együtt végleg törlődik:”**
   lezárt napok (mától), alapár és időszaki árak, naptár-szinkron a portál nevével, korábbi
   (lezárt) foglalások. Ha semmi: kimondja, hogy nincs mit elveszíteni.
3. Záró mondat: **„A képei a galériában maradnak. A honlapról a szoba azonnal eltűnik. Ezt nem lehet visszacsinálni.”**
4. Két gomb, egyforma szélesen: **„Mégsem”** · **„Igen, törlöm”**.
5. **B változat:** nyitott kérésnél (pending: a tulaj dönt; offered: a vendég dönt az ajánlatról)
   és el nem telt elfogadott foglalásnál a panel MEGÁLLÍT: nincs törlő gomb, ott áll a kérés
   hivatkozása, időszaka és a vendég neve, és egy út a **„Foglalások”** lapra.
6. A szerver ugyanezt elutasítja (`deleteUnit`) — régi lapról sem kerülhető meg.

## ② A-2 · A megmaradt ISMERT szoba nem lesz „az egész szállás” (KÖT)

Mért: élesen a megmaradt „Családi szoba” `represents_whole=false`, mégis „Családi szoba marad az
egész szállás” ajánlatot kapott a második szoba felvételekor.

**KÖT:** a „mi a viszonyuk” kérdés CSAK akkor jelenik meg, ha az egyetlen egység az egész
szállást jelöli (`representsWhole`). Ismert szobánál nincs kérdés, a két szoba külön telik; egy
mondat mondja, hogy az „egyben is kiadom” az „Az egész szállás egyben” kártyán állítható. A friss
fiók („A szállás egésze”) kérdőíve változatlan.

## ③ V-2 · Az ár-alap a foglalt egységet mondja (KÖT)

Éjszakai árnál a mondat **szobánál** a szobát nevezi meg („Az ár a szoba egészére szól
éjszakánként („<név>”) — a létszám nem befolyásolja …”), és CSAK az egész-szállás egységnél
(`whole`) mondja, hogy „a TELJES SZÁLLÁSRA”. Személyenkénti és teljes tartózkodásra szóló árnál
változatlan.

## ④ V-3 · Az idegenforgalmi adó a beküldés után sem tűnik el (KÖT)

1. Ugyanaz a helyszíni sor, ami a foglaló panelen áll (**„A helyszínen fizetendő ezen felül:”** + tételes
   összeg), megjelenik: a nyugtán („Elküldtük a kérését”), a mobil 2. lépés összesítője alatt
   (a létszám-léptetővel együtt frissül), a „rögzítettük” levélben és a visszaigazoló levélben.
2. **Három állapot:** megadott összeg → tételes sor; 0 („nincs IFA”) → sehol nem említi;
   kitöltetlen → kimondja, hogy a helyszínen fizetendő, de összeget NEM ír (§B.17).
3. A levél a kérésen **befagyasztott** összeget írja (`booking_request.quoted_tax_per_person_night`,
   a tulaj által jóváhagyott név, migráció `0084`); egy később átírt beállítás nem írja át.

## ⑤ A-3 · A-4 · apróságok (KÖT)

- Az időszak sora a választóval azonos alakban: „jún. 15. – aug. 31. · **„minden évben”**” — a
  Foglalások lap formázójával, soha nem „06-15 – 08-31”.
- A Foglalások üres sorában a „✔” szövegjel helyett a közös ikonkészlet pipája (ikon-doktrína).

## Reprodukció

A `plan.html` önhordó (a `--citui-*` tokenek beágyazva). A képek Playwrighttal készültek, mindkét
méretben végigkattintva (törlés-megerősítés, Mégsem, B-megállítás, egység-váltás, IFA-állapotok,
léptető): 22 interakció-ellenőrzés zöld, JS-hiba 0.

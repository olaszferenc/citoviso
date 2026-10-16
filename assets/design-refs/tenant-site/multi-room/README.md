# KONTRAKTUS — több szoba egy foglalási kérésben („B”: előbb a dátum, aztán a szabad szobák)

**Jóváhagyta:** a tulaj, 2026-10-16 (§2b; két változat + a tulaj-nézet egy lapon, a válasz: „B”). Előzmény: egy kérés EGY
egységre szólt, és az „egész ház” külön, saját árú tétel volt — a tulaj: „ez így szerintem fos”.
**ADR:** ADR-0393 · **Felülírja:** `booking-unit-default` ①–③, `tenant-admin/whole-house-simple` ②–③ (a ház ára csak „Csak
egyben” módban) · **Terv:** `plan.html` (önhordó, kattintható; „A / B / Tulaj” és „Mobil 390 / Asztali” váltó — a **B** a
jóváhagyott) · **Képek:** `shots/terv-*.png` (a terv), `shots/kesz-*.png` (a kész felület, az őr fixtúráján) ·
**Hatókör:** `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css` · `src/booking/requests.ts` · `src/server/bookingViews.ts` · `src/server/offerViews.ts` · `src/server/public.ts` · `src/tenant/unitVisibility.ts` ·
**Őr:** `scripts/multi-room-request-check.mts`.

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.**

## KÖT

1. **Szobánként kiadó szálláson az egész ház nem külön ajánlat.** A widget listájában nincs, a `/api/foglalas` elutasítja; aki az
   egészet akarja, minden szobát kipipál. „Csak egyben adom ki” módban változatlanul csak a ház foglalható.
2. **Előbb a dátum.** A naptár csak azt az éjt zárja, amikor EGYIK szoba sem szabad. Dátum előtt a lista ezt mondja:
   **„Előbb válassza ki a napokat — utána megmutatjuk, melyik szoba szabad.”**
3. **Aztán a szobák** — címe **„Melyik szobákat foglalná?”**: minden szoba egy sor (név, férőhely, az időszak ára vagy „egyedi ár”);
   a szabad pipálható, a foglalt szürke és kimondja: **„Erre az időszakra foglalt”**. Több szabad szobánál egy gomb mindet
   kijelöli (mind szabad → „…(az egész ház)”), mind kijelölve → **„Jelölések törlése”**. Egy már pipált szoba, amit az új dátum
   foglalttá tesz, magától lekerül.
4. **Ár és létszám:** az ár szobánként tételes („<szoba> — <ársor>”), az összeg a szobák összege; a létszám-plafon a pipált szobák
   férőhelyének összege. Szoba nélkül nincs ár és nincs küldés (a mondat: **„Jelöljön ki legalább egy szobát.”**).
5. **Egy kérés:** egy POST, minden pipált szobával; a nyugta „Szobák” sorral. Telefonon a lista az 1. lépésben, a dátumok és az ár
   között; a 2. lépés összegzője a szobákat nevezi meg.
6. **A tulaj egyben dönt:** a kártya jelvénye „… · N szoba”, a gomb „Visszaigazolom (N szoba)”; visszaigazoláskor minden szoba
   lezár (egy tranzakció), az ütköző függő kérés automatikusan elutasítást kap.
7. **Lemondás:** minden szoba felszabadul.
8. **Több szobás árajánlat:** egy éjszakai ár a szobákra együtt, csak erre a kérésre — árlistába nem kerül.

## Mérve a kész felületen (2026-10-16, az őr fixtúráján: ház 90 000 + Nádas 4 fő 24 000 + Kisházi 2 fő 16 000 + Kerti 3 fő 19 000)

- a listában 3 szoba, a ház nincs; a Nádas egy foglalt éjjel szürke, „Erre az időszakra foglalt”, a naptárban az az éj NYITVA;
- Nádas + Kerti, 3 éj → 72 000 + 57 000 = 129 000 Ft, a létszám 7-nél megáll; egy POST két `unit` mezővel, nyugta „Szobák”;
- szerver: visszaigazolás → 2 × 3 éj lezárva, az ütköző kérés automatikusan elutasítva; lemondás → mind felszabadul;
- ár nélküli szobával árajánlat; 2 éj × 40 000 = 80 000, árlista változatlan; 0 JS-hiba, 390 és 1280 px.

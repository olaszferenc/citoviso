# KONTRAKTUS — „kifizette, de üres" teendő-sor (Áttekintés fül)

**Jóváhagyva:** 2026-09-21, tulajdonosi döntés. Három változatot kapott (A: teendő-sor
modulonként · B: összevont figyelmeztető sáv · C: „Mit lát ma a vendég" szakasz-lista),
a válasza az A változat volt.
(⚠️ A tulaj szavát itt szándékosan NEM félkövér idézőjelben írjuk: a `**„…"**` forma a kötő
feliratok jelölése, és a drift-őr kötelezően a KÓDBAN keresné — egy jóváhagyási idézet pedig
soha nem lesz felületi szöveg.)

- Terv: `paid-empty-a.html` (önhordó, kattintható, méret-váltóval)
- A jóváhagyott kép: `plan-mobile.png`, `plan-desktop.png`
- A LESZÁLLÍTOTT felület: `shipped-mobile.png`, `shipped-desktop.png` (valós tenant, élő adat)

**Hatókör:** `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css`

## Kötő feliratok

Ezeknek a SZÖVEGEKNEK élniük kell a hatókörben — ha egy átnevezés elviszi őket, ez a kapu piros:

- **„— kifizette, de üres, ezért a vendég ma nem látja"** — a sor tétele: pénzt fizet érte,
  és mégsem látszik. Ez a mondat maga a lelet.
- **„Kitöltöm"** — az elsődleges kiút. A sor akkor teendő, ha egy kattintással orvosolható.
- **„Megnézem"** — a második gomb: lássa, mi lenne ott.
- **„Amíg nincs benne ár, a szakasz nem jelenik meg az oldalán."** — a modulra szabott
  magyarázat mintája (a másik négy ugyanebben a formában: hely / időpont / szolgáltatás / szoba).

## Kötő horgony

- `adm-todo__paid`
- `adm-todo__price`
- `adm-todo__note`
- `adm-todo__acts`

---

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Modulonként EGY sor, a meglévő Teendők listában.** Nem külön sáv, nem külön kártya —
   a sor szerkezete azonos a többi teendővel (ikon + törzs), csak a kerete jelzi, hogy pénz
   áll mögötte. Ez volt a választás lényege a B/C változattal szemben.
2. **A sor négy dolgot mond meg**, ebben a sorrendben:
   - **mit** kell kitölteni — a modul nevével (`Töltse ki: {module}`);
   - **mennyibe kerül** — a fiók SAJÁT számlázási ütemében (lásd 4. pont);
   - **miért baj** — „— kifizette, de üres, ezért a vendég ma nem látja";
   - **mi hiányzik belőle** — modulra szabottan („Amíg nincs benne ár/hely/időpont/
     szolgáltatás/szoba, a szakasz nem jelenik meg az oldalán.").
3. **Két gomb: „Kitöltöm" és „Megnézem".** A „Kitöltöm" a modul beállító lapjára visz
   (`/admin?tab=modulok&m=<id>`), a „Megnézem" a modul-előnézetre. ⛔ A „Kitöltöm" SOHA nem
   mutathat halott útvonalra: ha a modulnak nincs beállító képernyője
   (`hasSettingsScreen()` hamis), a Modulok fülre visz.
4. **Az ár a fiók ütemében vezet.** Éves fiókon az ÉVES összeg a vezető szám, a havi
   egységár a halkabb kísérő — ugyanaz a szabály, mint a Modulok fülön
   (`modules-quiet-list` §6–7: „a legnagyobb szám az, amit fizet"). ⛔ A jóváhagyott mockon
   „490 Ft/hó" áll, mert a mock nem ismerte a fiók ütemét; a leszállított felület éves
   fiókon „4 900 Ft/év + 490 Ft/hó"-t ír. Ez NEM eltérés a tervtől, hanem a korábbi,
   erősebb tulajdonosi rendelet érvényesítése — különben két különböző osztó került volna
   a tulaj két képernyőjére.
5. **Öt modul kaphat ilyen sort:** `pricing`, `poi`, `hours`, `amenities`, `rooms`.
   ⛔ `booking`, `location`, `reviews`, `enquiry` SOHA — azok üresen is renderelnek valamit
   (minta-naptár, cím/geo, „még nincs értékelés" blokk, gerinc), így náluk az „üres"
   állítás hamis riasztás lenne. A `gallery` sem: annak tartalma a fotó-lista, amiről a
   fotó-teendő már beszél. Az `usp` sem: tartalma a template kiemeléseibe szövődik, tehát
   üres mező mellett is láthat belőle a vendég.
6. **Ha nincs ilyen modul, a lap nem gyárt fantom-figyelmeztetést** — egyetlen sor sem.

## Az ürességet a RENDERELŐ SAJÁT kimenete dönti el

A predikátum a `moduleContentFor()` eredményének `.data` mezőit olvassa — pontosan azt,
amiből a publikus lap épül —, nem egy második heurisztikát. Egy `site_module_config` sor
létezhet üres tömbbel is; az a kérdés („van-e config sora") zöldre futott volna, miközben
a vevő üres szakaszt lát.

⚠️ A `.data` nem elhagyható: a `ModuleContent` felső szintje burkoló
(`{ data, photoCap, units }`). A burkolót átadva a predikátum MINDEN modult üresnek mond —
az üres tenanton véletlenül helyes eredménnyel, minden kitöltöttön hamis riasztással.
(Mérve a megvalósítás első változatán, 2026-09-21.)

## Őr

`scripts/paid-empty-check.mts` — hermetikus (se DB, se szerver). Méri a predikátumot
(pozitív + negatív kontrollal, a „soha" listával együtt) ÉS a renderelt sort (név, ár a
helyes ütemben, a „kifizette, de üres" mondat, a teendő-mondat, élő href). `--self-test`
visszarontva pirosra megy (20 bukás) — egy őr, amit sosem láttunk pirosnak, nem bizonyíték.

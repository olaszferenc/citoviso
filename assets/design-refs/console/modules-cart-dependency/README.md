# Kontraktus — Modulok fül: a kosár kimondja, miért nőtt (függőség a kirakat-kártyán és a kosárban)

**Jóváhagyva:** 2026-10-02, tulajdonosi döntés a koordinátoron át, szó szerint: „3. B”.
**Kiváltó:** Elek 2. élesi köre, ADM-1 — az „Online foglalás” → „Kosárba teszem” után a kosárban három
lapos sor állt („+ bekapcsol · Szobák, apartmanok”, „+ bekapcsol · Árak, szezonok”, „+ bekapcsol · Online
foglalás”), indoklás nélkül. A tulaj 742 Ft-ot várt, 1 627 Ft-ot látott; a havidíj 2 170 Ft-tal nőtt, nem 990-nel.
**Hatókör:** `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css`
(a kirakat-kártya és a kosár kliens-JS-e)
**Kiegészíti:** `module-dependency/` (2026-09-21, C változat) és `modules-cart/` (2026-09-28, ADR-0255).
**Őr:** `scripts/admin-cart-dependency-check.mts` (valódi `modulesSection()`, böngészőben, 390 és 1280 px).

## Miért kellett (mérve)

A module-dependency kontraktus a magyarázatot a modul SORÁHOZ kötötte (pirula + indoklás-sáv), a kosárba
pedig „terv-sávot” írt elő (vezérlő sor, alatta behúzott „ehhez jár” al-sorok, összegző mondat). A 09-28-i
kosár-átépítés óta a vásárlás a KIRAKAT-KÁRTYÁKON történik, amelyek sosem kapták meg a pirulát és a sávot,
a kosár pedig lapos sorokat írt. A lead-oldali konfigurátorban mindez megvan és működik
(`module-dependency-cart-check`) — a tulaj Modulok fülén nem volt.

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A kattintás pillanatában a kártyán (B változat).** Ha a „Kosárba teszem” más fizetős modult is behoz,
   a kattintott kártyán azonnal megjelenik egy cián bal-sávos tájékoztatás:
   `<modul>: ehhez <névelő> <X> és <névelő> <Y> modul is kell — ezek is a kosárba kerültek. Együtt most <N Ft>, a havidíj +<M Ft>.`
   és alatta egy link: **„Mit miért? — a kosárban”** (telefonon kinyitja a kosarat).
   ⭐ Miért a kártyán is: telefonon a kosár CSUKVA van (csak a kosár-gomb látszik), a tulaj a kattintás
   pillanatában a kártyát nézi. A „most” ugyanaz a szám, mint a kosár „Fizetendő most”-ja (a közös kupon-szabály
   allokációjából), a havidíj a behozott modulok listaárainak összege.
   ⛔ A modulnevet nem ragozzuk („Online foglaláshoz”): név, kettőspont, mondat. A névelőt `huArticle` adja.
   A tájékoztatás eltűnik, ha a vezérlőt kiveszik a kosárból vagy a kosár kiürül.
2. **A kosár csoportosít** (module-dependency §2 terv-sáv, most megvalósítva): a saját választás sora
   („+ bekapcsol · <modul>”, a most fizetendő és alatta a havi listaár), alatta behúzott, cián bal-sávos
   al-sorok: „ehhez jár: <modul>” a saját összegével és havi árával, és alatta az ÉL saját indoklása
   (`<vezérlő> → <modul>: <why>`): a `booking → pricing` és a `pricing → rooms` KÉT külön mondat, a katalógusból
   (`ModuleRequirement.why`). Utána összegző mondat: `<A> + <B> + <C> — együtt +<M> Ft/hó, most <N>.`
   A sorok összege PONTOSAN a „Fizetendő most”.
3. **A behozott kirakat-kártyák** az „együtt jár” pirulát és a meglévő indoklás-sávot viselik
   (`<vezérlő> — ehhez jár. <why>`), ugyanaz a `markDeps()` tölti, mint a saját modul-sorokat.
4. **⚠️ A module-dependency §2 „az indoklás CSAK EGYSZER hangzik el” pontja itt FELÜLÍRVA** (tulaj, 2026-10-02,
   „3. B”): az indoklás a behozott kártyán ÉS a kosárban is áll. Ok: a 09-28 óta a tulaj a kosarat nézi, nem a sort;
   egy csak-a-soron magyarázat telefonon képernyőn kívül esik.
5. **Változatlan:** a kosár elrendezése (modules-cart: telefonon kosár-gomb + felcsúszó lap, asztalon hasáb),
   a gombok, a megerősítő kártya, a kupon-kerekítés (`cit-coupon.cjs`, egy példány), a lemondás-blokkoló felugró,
   a vezérlő kivétele visszaveszi a behozottakat (KEEP = kifizetett + kézzel választott zárványa), és minden ID,
   amire őr épül.
6. Nyers katalógus-id (`booking`, `pricing`, `rooms`) soha nem kerül a képernyőre.

## Képek és a kattintható terv

`kosar-fuggoseg.html` — méret-váltó (Mobil 390px / Asztali), változat-váltó (A/B; a jóváhagyott a **B**),
kedvezmény-váltó (az ADM-2 sáv: üdvözlő kupon / kampány + megmaradó kupon). Valós katalógus-adat és Elek számai.
`B-asztali.png` · `B-asztali-kampany.png` · `B-mobil-kattintas.png` · `AB-mobil-kosar-nyitva.png` ·
`A-asztali.png` · `A-mobil-kattintas.png` (az elvetett A, összevetésnek).

A szállított felület (a valódi `modulesSection()` kimenete, Elek számaival — ehhez mérd a jövőbeli változást):
`szallitott-kattintas-mobil.png` · `szallitott-kosar-mobil.png` · `szallitott-kosar-asztali.png` ·
`szallitott-behozott-kartya-mobil.png`. A kosár al-sora a szállításkor a mockhoz igazodott: csak az összeg és
alatta a havi listaár (a „fizetés most: … (1 hónap a fordulónapig)” a vezérlő soron áll; az al-soron
megismételve a keskeny asztali hasábot összenyomta — mérve).

## Amit a terv NEM köt

- A tervben a kirakat-kártya kupon-ára darabonként lefelé kerekít (Szobák +517 Ft/hó), a kosár a kosárra
  allokál (518 Ft) — ez a mai termék viselkedése, nem ennek a tervnek a döntése (külön lelet).
- A lead-oldali konfigurátor kerete — ott a module-dependency kontraktus érvényes, és működik.

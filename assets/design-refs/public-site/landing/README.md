# Publikus landing (`/`) — jóváhagyott terv: „C · Szem”

Jóváhagyva: 2026-11-07, tulaj („C mehet is élesre”), 3 tervkör után.
Megvalósítás: `public/index.html`, `public/assets/home/home.css`, `public/assets/home/home.js`,
ár-blokk: `renderHomepage()` a `src/server/homepage.ts`-ben.

A `landing-c.html` a kattintható terv (méret-váltóval). A képek: `c-mobil-kockak.png`,
`c-asztali-kockak.png` (a bevezető görgetési kockái), `szem-sor.png` (C → szem → kacsintás).

## Mit KÖT a terv (elvárt viselkedés, nem stílusjavaslat)

1. **Hiperűr-csillagmező görgetésre.** A csillagok görgetéskor fénycsíkká nyúlnak, de
   NYUGODTAN: lassan gyorsulnak és lassulnak, a sebességük felülről korlátos (2. kör, tulaj:
   „túl gyorsak lesznek a csillagok és zavaró”). Gyors görgetésnél sem lehet csíkvihar.
2. **A C felismerhetően szemmé alakul** (3. kör, tulaj: „felismerhetetlen”): a C két íve
   mandula alakú felső és alsó szemhéjjá nyílik, a pötty középre csúszik, és íriszé nő.
   A háromszög közben eltűnik.
3. **A kacsintás a felső szemhéj valódi lecsukódása** a pupillán: csukott szem és szempillák,
   kis fejbiccentéssel, ~1,4 mp, IDŐALAPÚ (nem függ a görgetés sebességétől). A
   „lapítás” (scaleY) és a „csak a pupilla kacsint” megoldás kifejezetten elutasítva.
4. **A hero logója magától is életre kel:** ~1,5 mp után, majd 7 mp-enként szemmé nyílik,
   kacsint, és visszaalakul C-vé.
5. **Az átmenet a következő szekcióba:** az írisz kitölti a képernyőt, és világos háttérré
   halványul, amelyen a „Nem ígéret — kész oldal” cím áll. A menüsor ekkor vált világosra.
6. **Mozgás-csökkentés / JS nélkül:** statikus elrendezés, nincs rögzített (pinned) bevezető,
   minden tartalom látszik.
7. **Hero: „B · Háttér-szem”** (2026-11-08, tulaj: „B”; az előző jobb oldali logó „szétszórta a
   lapot”): a hero szövege középre zárt, a C nagyban (asztalon ~64vh, mobilon ~88vw) és
   HALVÁNYAN (20%) a szöveg mögött ül; görgetésre a szöveg elhalványul, a C teljes fényre
   erősödik, majd ugyanúgy szemmé nyílik és kacsint. Terv: `hero-b.html`, képek:
   `hero-b-asztali.png`, `hero-b-mobil.png` (balra nyugalomban, jobbra görgetés közben).
   Ez a pont felülírja a `landing-c.html` hero-elrendezését (két oszlop, logó jobbra).
8. **Mobil és asztali** külön elrendezés (a tartalmi szekciók mobilon egy oszlopban).

## Tartalom-szabályok (a terv része)

- Csak igaz állítás: ma CSAK szálláshely; nincs emberi lépés („közösen finomítjuk” tilos);
  Google = beküldés + keresőbarát szerkezet, helyezés-ígéret nincs; foglalási naptár +
  portál-szinkron = Teljes csomag.
- **Az árak és a csomag-tételek NEM a tervből jönnek.** A mockban látható számok (pl. 7 000 Ft)
  a tervezéskori minták voltak — élesen a szerver az ÉLŐ árazásból (`offeredPackagesFrom`,
  `getAnnualFreeMonths`, `getMultilangTierPrice`) és a csomag-modulokból tölti ki. Ha egy régió
  ára nincs megerősítve, konkrét szám nem jelenhet meg (§C).
- A mintakérő űrlap az élő `/api/mock-request`-re küld: szállásnév, térkép-tű (+ település a
  tűből), e-mail-cím. Telefonszámot nem kér, mert a beküldő csak e-mailre válaszol.
- A Duna Vibe House (élő ügyfél) képei a példa-szekcióban.

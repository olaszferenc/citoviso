# Saját cím a vevő oldalán: jelvény + a cím elöl (kontraktus, ADR-0369)

> ⚠️ **Részben felülírva: ADR-0395** (2026-10-19, `console/rendeles-egyszerusitett`). A cím-lépés egyetlen felajánlott nevet ad, fix citoviso-sorral; az itt kötött, alább sima idézőjelbe tett feliratok már nem élnek.


Tulajdonosi jóváhagyás: 2026-10-12, „B — jelvény + a cím elöl”, kifejezetten DINAMIKUSAN. A
`plan.html` a jóváhagyott, működő vázlat. Megnyitáskor a B változatot mutatja. A tetején álló
/pricing-szimulációval minden piac-állapot kipróbálható. A képek a döntéskori állapotot rögzítik.
**Ez a terv KÖT: elvárt viselkedés, nem stílus-javaslat.** Az ADR-0360 „Nyitva” pontját zárja le
(„a vevő oldala: saját .hu címmel”).

**Hatókör:** `assets/runtime/cit-configurator.js` · `src/console/pricingPage.ts`

## A FORRÁS: kizárólag a /pricing beállítása
Jelvény, címke, vezető sor és minden „benne” / „0 Ft” felirat CSAK akkor jelenik meg, ha
egyszerre igaz:
- az „Ingyen domain csomagban” kapcsoló BE van,
- a „Saját domain” pirula valamelyik csomagban van, és
- legalább egy kínált végződésen be van jelölve a „Csomagban ingyen”.

Ha a kapcsoló KI, vagy nincs ingyenes végződés, akkor **sehol nincs jelvény**, és minden úgy
marad, mint ma. Ez a tulaj 2026-10-12-i állapota: a pirula mind a 3 csomagban, ingyenes végződés
nélkül. A végződés neve (.hu, .eu …) a beállításból jön, nem fix szöveg.

## Amit a terv KÖT
1. **Jelvény a csomag-kártyán**: **„+ saját {tld} cím”** (pl. „+ saját .hu cím”). Csak az a
   csomag kapja, amelynek modul-listája lefedi a domaint tartalmazó csomagot. A többi kártya tiszta.
2. **Címke az „Itt rendelheti meg” pirulán**: ugyanez a szöveg, ha bármelyik csomag hordozza.
3. **A cím-lépés a saját címmel kezd**, ha a VÁLASZTOTT összeállítás hordozza az ingyen címet:
   - vezető sor: „A választott csomagjához saját {tld} cím jár” + „Válasszon nevet lent — a
     citoviso.com-os cím mellette is megmarad.”;
   - elöl a saját cím: „Saját domainnév — benne a csomagban”, alatta a névjavaslatok és a
     saját név mezője;
   - utána a platform-cím: „Most csak a citoviso.com-os cím”.

   Ha a választott összeállítás nem hordozza, a mai sorrend és a mai feliratok maradnak.
   (A vázlat mondata „A Teljes csomag saját .hu címet ad” volt. A megvalósítás a csomag nevét
   elhagyja: egyedi összeállításnál nincs neve, a névelő pedig csomagnévtől függ.)
4. **Minden névjavaslat sora kiírja a díját** az aktuális összeállítással: **„benne a csomagban”**,
   vagy a végződés havidíja („+1 200 Ft/hó”). Ez minden piac-állapotban látszik.
5. **Összegzés-sor**: ha a platform-cím van kiválasztva, de az összeállítás hordozza az ingyen
   címet: **„saját {tld} cím választható — 0 Ft”**. Saját cím választásakor a meglévő bontás-sor
   marad („saját cím: a csomag része · 12 hó hűségidő”). Helye a meglévő bontás-soré: a
   fizetés-lépés összegzése. (A vázlat az 1. lépés lábléc-sorába tette; az élő 1. lépés lábléce
   egyetlen sor — csomag-váltó, végösszeg, „Tovább” —, a 2026-09-26-i mérés óta szándékosan szűk.)
6. A saját cím kiválasztása mindig a vevő döntése. 0 Ft-nál is 12 hónap hűségidővel jár, ezért
   semmi nincs előre kijelölve.
7. **Admin /pricing**: ha a pirula egy csomagban van, de nincs ingyenes végződés, a csomag-kártya
   cím-sora figyelmeztető stílusú (nem zöld), és megmondja, hol kell javítani: „Saját cím: nincs
   ingyenesnek jelölt végződés — jelöld lent, a Saját domain résznél, a „Csomagban ingyen”
   oszlopban”. A „Figyelmet kér” lista sora ugyanezt mondja. A zöld „Saját cím benne (.hu)” csak
   ingyenes végződés mellett jelenik meg. (A koordinátor szövegjavaslata a „Domain-végződéseknél”
   feliratot idézte; ilyen felirat a lapon nincs, a szakasz neve „Saját domain”.)

## Megvalósítás
`assets/runtime/cit-configurator.{js,css}` (`freePkgTlds`, `presetCarriesDomain`,
`syncDomainLead`), `assets/runtime/cit-pricing-admin.js` (`domInFree`), `src/console/pricingPage.ts`,
`public/assets/ui/citui-console.css` (`.pr2-pkdom.is-warn`). Őr: `scripts/package-domain-badge-check.mts`
(három piac-állapot × 390 px és asztali + az admin lap; önteszt: az ingyenes végződést figyelmen
kívül hagyó jelvény → PIROS).

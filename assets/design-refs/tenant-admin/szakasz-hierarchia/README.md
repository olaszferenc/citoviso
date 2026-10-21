# Tenant-admin szakasz-hierarchia — az „E” nyelv — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-10-21, két §2b körben. A tulaj panasza (képpel, az „Amit kínál” lapról):
az admin „annyira plain egyszerű, hogy semennyire nem vezeti a szemét”; minden szekció
ugyanúgy néz ki, egy összetett allap „pár görgetés után a szemnek teljes káoszba fullad,
nem tudom, mit hogy kell nézni, mi mihez tartozik”. Kikötése: „nem az kell, hogy csicsa
legyen, mert alapjaiban jó az egyszerű dizájn, csak ez így most túl egysíkú.”
1. kör: négy szerkezet (A Fejezetek · B Oldal-térkép · C Harmonika · D Tónus-lépcső) → a tulaj:
„a B és D hibrid lenne a jó”. 2. kör: három hibrid (E · F · G) → a tulaj választása: **E**.
**Kapcsolódó:** ADR-0397 (ez a döntés), ADR-0224 (Linear-nyelv: szín csak jelentésre — ez a terv
nem ír felül színt, szerkezetet ad), ADR-0021 ① (tokenek), ADR-0045 §J + ADR-0220 (a súgó-képek
a kódból újralőve), season-datepicker és ellatas kontraktusok (a bennük kötött viselkedés marad).

**Hatókör:** `public/assets/ui/citui-admin.css` · `src/server/moduleConfigViews.ts` · `src/server/adminViews.ts` · `scripts/price-where-check.mts` · `scripts/price-on-request-check.mts` · `scripts/season-year-price-check.mts` · `kb/entries/admin-modules-pricing/assets/hu/screen.png`
(citui-admin.css §12; moduleConfigViews: a `moduleSettingsSection` feje, `pricingEditor`, `mealsCard`, `tocNav`/`tocScript`; adminViews: a nyitott modul-képernyőn nincs külön „Modulok” h1; a három őr: a szerkezet-függő horgonyaik; a modul-képernyők súgó-képei újralőve).

`plan.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** A kész felületet ehhez mérjük
(mobil 390 + asztali 1280, világos és sötét). A fájl váltóján az **E** a jóváhagyott; a B és a D a
két kiindulás, az F és a G az elvetett testvérek (`F-elvetve-asztali.png`, `G-elvetve-asztali.png`
csak a döntés nyoma). A `gen.mjs` a mock generátora (a `_drafts/` alá írt fájlokat állította elő).

## Amit a terv KÖT

1. **A lap feje a modul neve.** A modul-képernyő h1-e a modul neve (pl. „Árak, szezonok”), fölötte
   a visszaút („‹ Vissza a modulokhoz”) kis sorban, alatta egy meta-sor: a modul díja (az
   előfizetés ütemében, modules-annual-pricing) és jobbra az „Útmutató ehhez a képernyőhöz”
   gomb. A fül „Modulok” h1-e nyitott modulnál NEM jelenik meg (két cím lenne).
   ⚠️ Eltérés a mocktól: a mock kicker-e „Modulok › Árak, szezonok” volt; a kész felület ugyanitt
   a meglévő „‹ Vissza a modulokhoz” linket mutatja, mert a súgó ezt a feliratot írja le, és a
   tulaj ezt ismeri. A szándék (hol vagyok, hogyan vissza) ugyanaz.
2. **Zónák.** A lap tartalma zónákba rendeződik; a zóna címe kisbetűs, ritkított, és egy
   hajszálvonal fut utána a lap széléig. Az Árak lapon: a bevezető doboz („Hol látják a vendégek
   az árait?”, tónusos, keret nélkül) · **„Szobánkénti árak”** a szobák számával (csak egyben
   kiadott háznál **„Az egész ház ára”**) · **„Az egész szállásra”** (Ellátás + Szabályok).
3. **A szobák egymás mellett.** Széles képernyőn (≥ 900 px) a szoba-kártyák rácsban állnak,
   legalább 340 px-es oszlopokban (két szobánál két oszlop); telefonon egymás alatt.
   Következmény: a kártya ŰRLAPJA széles képernyőn is keskeny, ezért a szezon-naptár ott a
   folyamban nyílik és egy hónapot mutat — ahogy a season-datepicker kontraktus mondja: a
   naptár az űrlap saját szélességét követi, nem az ablakét.
4. **Szakasz-fejléc.** A szakasz (szoba, Ellátás, Szabályok) kártyáján nagy cím (19 px, félkövér),
   ikon, és a cím alatt EGY sor a pillanatnyi értékekkel — szobánál „Alapár {összeg} Ft · {n} időszak” (a kódban két
   felirat: **„Alapár {amount} {cur}”** és **„{n} időszak”**), alapár nélkül **„Még nincs alapár”**. A fejléc alatt nincs elválasztó vonal.
5. **Tónus-tömb alszakaszok.** A szakaszon belül minden kérdés egy tónusos tömb
   (`--citui-surface-2`), kisbetűs, ritkított tömb-címmel; a mezők a tömbön a panel színét
   viselik. Így a szint négy lépcsőben látszik: lap → kártya → tömb → mező. Az Árak lapon a
   szobánál két tömb (**„Alapár”** · **„Időszaki árak”**, az utóbbi utolsó sora a „Csak a felsorolt
   időszakokban adom ki” kapcsoló), az Ellátásnál kérdésenként egy, a Szabályoknál egy.
6. **Ragadós tartalomjegyzék** („Ezen a lapon”): a szakaszok a zónák szerint csoportosítva.
   Széles képernyőn (≥ 1100 px) jobb oldali sáv, bal vonallal; alatta telefonon egy ragadós
   csipkesor a felső sáv alatt, vízszintesen görgethető, a layoutot NEM szélesíti. Kattintásra
   a szakaszhoz görget. A képernyőn lévő szakasz jelölve: a listában félkövér + cián vonal/pötty,
   a kártya bal élén cián csík (ez az egyetlen szín a lapon, ADR-0224 szerint).
7. **Szín nem változik.** Semmi új hue: a tónus a `--citui-surface-2`, a vonal a `--citui-line-strong`,
   a jel a `--citui-cyan-500`. Sötét módban ugyanezek a tokenek.
8. **Minden modul-képernyő ugyanezt a nyelvet beszéli** (tulaj, 2026-10-21 12:00: „maradt minden
   dizájn úgy, ahogy volt, csak az árak változott?”). A modul-képernyő teste egy `.adm-mod` burok: benne
   minden kártya szakasz (nagy cím, fejléc-vonal nélkül), a mezők egy halvány tömbben. Amit kínál: csoportonként
   egy tömb, a csoportok a tartalomjegyzék. Szobák: tartalomjegyzék („Az egész ház” · „A szobái” · „Új szoba
   felvétele”). Online foglalás: a saját fejléc-blokkja marad (booking-screen kontraktus), alatta zónák
   (naptár · **„Portálok”** · **„Szobák és beállítások”**) és tartalomjegyzék. A képek-, térkép-, nyitvatartás-
   és a többi egy-kártyás lap: szakasz-cím + tömb, tartalomjegyzék nélkül (egy szakasznak nincs térképe).

## Képek

- `E-asztali.png` · `E-mobil.png` — a jóváhagyott mock mindkét méretben.
- A kész felület mérése: `npx tsx scripts/ui-shot.mts "/admin?tab=modulok&m=pricing" --tenant` (+ `--dark`).

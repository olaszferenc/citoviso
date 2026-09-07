# Forgalom-kimutatás a tenant-adminban — kontraktus (ADR-0108, „A: mondat először")

Tulajdonosi jóváhagyás: 2026-09-07 („ok elfogadom" — az **A változat**, a C-ből átemelt
arány-mondattal). A döntés három bemutatott változat közül született; a döntéskori
összevetés képei: `decision-mobile.png`, `decision-desktop.png`.
Az `approved.html` a jóváhagyott, működő vázlat (méret-váltó + üres állapot).
**Ez a terv KÖT — elvárt viselkedés, nem stílus-javaslat.**

## 1. Amit a KERET köt

A kimutatás **nem elemző műszerfal**, hanem válasz egyetlen kérdésre: *megérte-e?*
Ezért a képernyő **mondattal kezd, nem számmal**:

> **„143 vendég** nézte meg az oldalát, és **7** kereste meg Önt."

- A két kiemelt szám a mondat része (ciános), nem külön csempe.
- A mondat ALATT jön a bontás sorokban — nem fölötte, és nem helyette.
- ⛔ **Nincs trend-százalék az első időszakban.** A „+18% az előző hónaphoz" típusú
  állítás csak akkor jelenhet meg, ha van teljes előző időszak; enélkül kihagyjuk.
  (Ez volt a B változat gyenge pontja: összehasonlítás nélkül a százalék hazugság.)

## 2. Amit a TARTALOM köt

Sorok, ebben a sorrendben: **Megnyitások · Foglalási kérés · Üzenet / érdeklődés ·
Google-ből érkezett · Telefonon nézte**.

Két kötelező mondat a bontás alatt:

1. **Hoszt-bontás** — „A saját címén (`<domain>`) N, a citoviso-címen M megnyitás."
   Ez önmagában érték: a tenant látja, megérte-e a saját domain. ⚠️ Ha nincs saját
   domainje, ez a mondat KIMARAD (nem „0"-t írunk ki).
2. **Arány-mondat** (a C változatból emelve, tulaj kérése) — „Minden N. látogatóból lesz
   megkeresés." Ez az, ami a megújításkor tényleg érvel. ⚠️ Csak elég mintánál
   (≥1 megkeresés) jelenik meg; nulla megkeresésnél kimarad, nem „minden ∞."-t írunk.

⛔ **Bot-kizárás kimondva:** „A keresőrobotokat nem számoljuk bele." A vevőnek tudnia
kell, hogy a szám vendégeket jelent, nem találatokat (ADR-0108 ④).

## 3. Amit az ÜRES ÁLLAPOT köt

Ez a leggyakoribb állapot az első hetekben — a terv ezért külön tervezi, nem „0"-kkal
tölti ki a felületet:

> **Még nincs mit mutatni**
> Az oldala nemrég indult. Amint az első vendég megnyitja, itt megjelenik — és havonta
> levélben is elküldjük.

⛔ Üres állapotban a bontás-sorok, a görbe és minden szám **eltűnik** (nem 0-val
jelenik meg). A `hidden` attribútum önmagában NEM elég — a CSS-nek `display:none
!important`-tal kell zárnia, mert egy `display:flex` szabály nulla specificitással is
felülírja (mérve 2026-09-04, `feedback_screenshot_does_not_show_behavior`).

## 4. Amit a MÉRET köt

- **Mobil (390px):** egy oszlop, a mondat 30px-es kijelző-betűvel, a sorok teljes szélesen.
- **Asztali:** ugyanez a szerkezet, szélesebb kártyában — a mondat NEM nő tovább, és
  ⛔ a bontás NEM rendeződik több oszlopba (a méret-növelés nem terv,
  `feedback_size_inflation_is_not_design`).
- A vázlat méret-váltója `@container`-rel dolgozik, nem `@media`-val, és a
  VIEWPORTBÓL indul — különben az asztali képernyőkép is a mobil elrendezést fotózná.

## 5. Amit az IDŐSZAK köt

Két gomb: **„Elmúlt 30 nap”** (alap) és **„Elmúlt 7 nap”**. A váltás a mondatot ÉS a
bontást is átírja — nem csak a fejlécet.

## 6. Ami NINCS a tervben (tudatosan)

- **Napi görbe** (B változat) — a célközönség nem olvas görbét, és üresen kong.
- **A „végignézte a szobákat" köztes lépés** (C változat) — kliens-oldali görgetés-mérést
  igényelne, ami a süti nélküli, szerver-oldali méréssel ma nincs meg. Ha később bejön,
  a keret bővíthető; addig nem ígérjük.
- **Élő/valós idejű nézet** — a kimutatás időszakos, nem monitor.

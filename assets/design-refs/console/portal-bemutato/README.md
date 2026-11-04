# Portál-naptár bemutató: videó és leírás képekkel

**Jóváhagyva:** tulaj, 2026-11-04 („ok jó így, haladjunk”).
**Brief:** a telefonos kérdések közül ez volt a leggyakoribb: hogyan kell összekötni a portál (Booking.com / Szállás.hu / Airbnb) naptárát a Citovisóval (2026-11-03).
**Megvalósítás:** `src/server/portalGuide.ts`, a `src/server/moduleConfigViews.ts` „Hirdeti máshol is?” kártyáján (`portalSyncCard`) beépítve.
**Fájlok:** `public/assets/help/portal-naptar/`. Újrafelvétel: `scripts/portal-guide/README.md`.
**Kattintható terv:** `portal-bemutato.html` (a beépített videókat és képeket használja).
**Hatókör:** `src/server/portalGuide.ts`

Kötő feliratok: **„Így köti össze — videó és leírás”** · **„Videó”** · **„Leírás képekkel”** · **„Citoviso-admin”**

## Mit köt ez a terv (elvárt viselkedés, nem stílusjavaslat)

1. **A bemutató helye.** A „Hirdeti máshol is?” kártya leírása alatt jelenik meg, a három portál-doboz FÖLÖTT. A portál-dobozok (1. lépés: mező + „Összekötés”, 2. lépés: „Másolás”, állapot, „Segítség” lenyíló) változatlanok maradnak.
2. **Portálválasztó.** Gombok sorban: Booking.com · Szállás.hu · Airbnb. Egyszerre egy portál látszik, és portálváltáskor a futó videó megáll.
3. **Két nézet:** „Videó” (ez az alapértelmezett) és „Leírás képekkel”. A két nézet lépései ugyanabban a sorrendben jönnek.
4. **A videó tartalma:**
   - **Narráció:** magyar hang végigmondja a lépéseket, a kép addig áll, amíg a mondat tart, és felirat is van.
   - **Szakaszkártyák:** a szakaszok között teljes képernyős kártya áll a menüúttal (például „Admin › Árak és kapacitás › Naptár szinkron (iCal)”).
   - **Kiemelés a portálképeken:** minden menüpontra és gombra ráközelít, keretet tesz köré, és megáll rajta.
   - **Citoviso-rész:** a valódi admin felvétele.
   - **Zárókártya:** „Ismételje meg a lépéseket a többi szobájára is”.
   - **Hossz:** 2,5–3 perc. A tulaj kifogása ez volt: „nagyon gyorsan ugranak a legfontosabb részeknél”.
5. **Méretfüggő változat.** Mobilon (<700px) a mobilos felvétel megy (álló, a Citoviso-admin mobil nézetével), asztali gépen az asztali. A videó csak a választáskor töltődik be (`preload="none"`, a `src` JS-ből jön), és tekerhető (a szerver HTTP Range-dzsel, 206-tal szolgálja ki).
6. **Leírás képekkel:**
   - **Lépések:** számozva, mindegyiknél jelölve, hol történik: „Citoviso-admin” vagy „<portál> oldalán”.
   - **Portálképek:** számozott keretek jelölik, hová kell kattintani, mellettük ugyanilyen számozású lista. A kép forrása a kép alatt áll.
   - **Citoviso-képek:** mobilon a mobilos, asztali gépen az asztali képernyőkép jelenik meg.
   - **Nagyítás:** képre koppintva nagyobban látszik, bezárás koppintással vagy Esc-kel.
7. **Nyelv.** A videó magyar (hang és felirat is), ezért csak magyar tenantnak jelenik meg. Más nyelven csak a „Leírás képekkel” látszik, a szöveg `T()`-ből jön.

## Képek

- `terv-leiras-booking-mobil.webp`, `terv-leiras-booking-asztali.webp`: a jóváhagyott terv leírás-nézete.
- `video-kockak-booking-mobil.webp`: a jóváhagyott videó kockái (közelítés, keret, felirat).
- `megvalositas-video-mobil.webp`, `megvalositas-leiras-szallas-asztali.webp`: a beépített változat a valódi adminban (2026-11-04).

## ⚠️ Élesítés előtt (jogi őrszem)

A portál-oldali képek (Booking-extranet, Szállás.hu admin, Airbnb) harmadik fél nyilvános súgóiból valók, szabad licenc nélkül: Appartman, Plum Guide, Rental Ninja, szallaskeres.hu. Élesre ezeket SAJÁT felvételre kell cserélni, egy portálfiókba belépve, ugyanazokkal a képkivágásokkal (`scripts/portal-guide/plan.mjs`). A felvevő ugyanígy végigmegy, csak a képek és a keretek koordinátái cserélődnek.

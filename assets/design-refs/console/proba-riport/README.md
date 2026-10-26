# Riport · Próba fül — mit csinálnak a próba alatt (ADR-XXXX)

Tulajdonosi jóváhagyás: 2026-10-26 — „A+B hibrid”, majd „mehet”. A vázlat `plan.html` (A · B · C és
a hibrid egy fájlban; az A+B hibrid változat KÖT, az A, B és C csak összevetésre maradt).
Képek: `terv-proba-H-{desktop,mobile}.png` (alapnézet), `terv-proba-H-szurt-{desktop,mobile}.png`
(a „Szerkesztett” lépcsőre koppintva), `utana-minta-{asztali,mobil}.png` (a megvalósított lap
mintaadattal). **Ez a terv KÖT** — elvárt viselkedés, nem stílus-javaslat. A vázlat számai
kitalált MINTA (9 szállás).

**Hatókör:** `src/console/trialReport.ts` · `src/console/trialReportViews.ts` ·
`src/analytics/tenantActivity.ts` · `migrations/0117_tenant_activity.sql` ·
`assets/runtime/cit-configurator.js` (a folytatás beacon-je) · őr: `scripts/trial-report-check.mts`

## Miért létezik

A tulaj kérdése (2026-10-26): „hol bukik el vagy nem egy rendelés a próba alatt, hányszor lépnek be”.
A próbáról addig csak az indulás és a vég látszott; a belépésből csak a felülíródó utolsó időpont.

## Amit a terv KÖT

1. **Fül a Riportban:** Tölcsér · Viselkedés · Mock · **Próba**; a bal menüben is „Próba”.
2. **Szűrősor:** időszak (7 · 30 · 90 nap · Összes, a próba indulása szerint) + állapot (Mind · Fut ·
   Megrendelte · Lejárt). Csak kiküldött megkeresésből indult próba, teszt nem számít.
3. **Öt szám:** Próba indult · Belépett (x / mért) · Átlag belépés · Megrendelemig jutott ·
   Megrendelte (alatta az 1. belépés mediánja).
4. **Lépcső (B), felül:** Próba indult → Belépett → Szerkesztett → Megnézte az oldalát → Megrendelem →
   Rendelés elküldve → Fizetett. A szám = LEGALÁBB eddig jutott; „N itt állt meg”, a legnagyobb
   pirossal. **Egy lépcsőre koppintva az alatta lévő lista csak az ott megállókat mutatja**; újra
   koppintva vagy a lista címe melletti „Itt álltak meg: … ×” címkével megszűnik.
   Mellette a „Mennyi idő alatt” tábla (medián + leglassabb).
5. **Próbák napról napra (A), alatta:** soronként név · település · indulás · nap; a 14 nap sávja a
   jelekkel (kör belépés · négyzet mentés · üres kör saját oldal · zöld rombusz Megrendelem/rendelés ·
   piros rombusz elakadt · vonal levél; a mai nap keretes, a hátralévő csíkos); jobbra egy mondat
   (Dolgozik rajta · Nem lépett be · Belépett, nem szerkesztett · Dolgozott rajta, aztán csend ·
   Megrendelem után megállt · Rendelésben elakadt · Megrendelte · Lejárt, nem rendelt). Koppintásra
   kinyílik az idővonal (perc pontos, a ≥2 napos csend kiírva) és a „Lead-lap” gomb.
6. **A próba melyik napján dolgoznak?** — naponként hány próbázó lépett be vagy mentett.
7. **Mock: ugyanaz tér vissza, vagy továbbküldték?** — egyszer · ugyanarról · más eszközről is, és
   mindegyiknél a próba-arány.
8. **Mit mér a próba alatt** — a jelek táblája, és hogy mióta mérünk.
9. Csak `--citui-*` tokenek; a jel alakja is hordoz jelentést, nem csak a színe. Mobil: egy hasáb;
   asztal: lépcső + időtábla egymás mellett, a sorokban név · sáv · mondat.

## Eltérés a vázlattól (megvalósításkor, indoklással)

- **A mock-oldali panel NEM tesz azonosítót a böngészőbe.** A vázlat „véletlen azonosító a
  böngészőben” szövege ütközik az ADR-0108-cal (süti és kliens-oldali azonosító nélküli mérés), és
  a böngészőbe írt elemzési azonosító hozzájárulás-köteles. A megvalósítás a `mock_view` már mért
  eszköz-típus + rendszer + böngésző hármasából dönt: „Visszatért, ugyanarról az eszközről” / „Más
  eszközről is”. Két egyforma telefon egynek látszik — a lap ezt kimondja (inkább alulbecsül).
- A mérés bekapcsolása előtt indult próba sora „A belseje nem mért” jelet visel, és a lépcső
  nélküle számol (a vázlat mintájában ilyen nem volt).

## Amit NEM köt

- A küszöbök (3 nap csend, 1 óra elakadás, fél óra/belépés) kezdőértékek a kódban.
- A sötét mód színei a konzol sötét hatóköréből jönnek.

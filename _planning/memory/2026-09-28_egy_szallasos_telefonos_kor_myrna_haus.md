# Egy-szállásos telefonos kör friss alanyon (Myrna Haus) — a tulaj feltöltése = a vendég látványa, végig

Dátum: 2026-09-28 este · SUB-szál (koordinátor: `citded06a5f`) · brief: `~/rc-briefs/egy-szallasos-kor-friss-alanyon.md`

## Mit bizonyít

Az FK-011→016 lánc EGY bérlőn (`myrna-haus`): vásárlás → modulok → feltöltés → vendég foglal ÉS
árajánlatot kér → tulaj visszaigazol, árat ad, véleményt kitesz → vendég elfogadja az ajánlatot,
látja a véleményét, lemond. DB-ben igazolva: foglalás 56 000 Ft (a tulaj őszi szezonára: 2 × 28 000)
accepted → cancelled; árajánlat-kérés (egész ház) → 90 000 Ft/éj ajánlat → accepted, 180 000 Ft;
vélemény published. A korábbi kör két bérlőre szakadt (Kemencés / Három Huszár) — ez a hiányzó bizonyíték.

⚠️ Két menet ugyanazon a bérlőn: FK-011→013 egyszer (az újrafuttatás duplázná a szobákat), FK-014→016
kétszer; közöttük csak a saját vendég-tesztsorok (2 booking_request, 1 site_review) törölve +
`rerender-tenant.mts myrna-haus`. Az FK-012 és FK-013 utolsó forgatókönyv-javítása NINCS újrafuttatva
(nincs több tiszta alany a dev DB-ben — Myrna volt az egyetlen `created`, jóváhagyott mockos, tenant nélküli lead).

## A mérés rései — mi volt a baj, mi lett

1. **Nem született árajánlat-kérés** (FK-014 ⑦ csak `tedd?:` dátum, árazott egységen). Most: egész ház
   sávja → „Részletek és árajánlat” → felugró „Árajánlatot kérek” → widget az egész házra áll → adatok →
   nyugta „Elküldtük az árajánlat-kérését”. FK-015 ④ ajánlatot küld (90 000), FK-016 ② elfogadja.
2. **Nem volt „Kiteszem” koppintás** (FK-015 ⑪) → az FK-016 vélemény-lépése hamisan bukott. Most koppint, és a gomb eltűnése a gépi bizonyíték.
3. **Bájtra azonos képek** — mind a hat pár AKCIÓ NÉLKÜLI lépés volt (nincs `út`/`tedd`/`várd`). Kettő valódi rés
   (a kosarat a fizetés UTÁN, csukva ítéltük; a véleményt koppintás nélkül „hagytuk jóvá”), a többi szándékos
   megfigyelő lépés. A runner mostantól nem fényképez újra: `shot_reused_from` + kiírás („akció nélküli lépés
   (a korábbi képet ítéli): 2→1 …”). FK-012 kosár: kinyitás · megerősítő · fizetés saját lépés, saját képpel.
4. **„Execution context was destroyed”** (FK-013 ①): a feltöltés a jelzés után 1,3 mp-cel `location.href=…&saved=1`-re
   navigál, a kép-készítés belefutott. Új ige: `várj-címre "<részlet>" [mp]`. (Runner-hiba volt, nem termékhiba.)

Mellé: a „Köveskál” (Három Huszár) be volt égetve három forgatókönyvbe → `ELEK_NIGHT_CITY`/`ELEK_NIGHT_ZIP`
a lead-ből; kevés saját fotónál két adag a SAJÁT képekből (18+ esetén marad 12 + 6); `válaszd` részleges
opció-felirattal (egyértelmű egyezésnél); a „48 000” elvárás 56 000 lett (a tulaj szezonja él); az FK-015
foglalás-lépései a foglalás KÁRTYÁJÁRA szűkítve (két kérés van a fülön), a levél-lépés a „Foglalási kérés:” tárgyra.

## Leletek a SAJÁT területemen kívül (a koordinátornak átadva, nem javítva)

- **A tulaj Nyitóképe nem látszik a vendég oldalán** (arch-frames sablon): látható `<img>` a 2–5. fotó; az 1. (nyitókép) és a 6. csak a JSON-LD `image`-ben. Repro: `sites/<tenant>/index.html` grep a feltöltés-hash-ekre.
- **„4,4 / 10 — 82 vendégértékelés átlaga”**: a Google ötös skálás 4,4-e tízes skálán a generált blokkban, a kitett vendég-vélemény alatta.
- **Modul-nyugta „4 620 Ft/év”** havi fiókon (időarányos összeg megújítási díjként, rossz egységgel).
- Kisebbek: tulaj-naptár üres hónapon/egységen nyit „nincs foglalt nap”-pal; az ajánlat-ár alapárrá válása átállítja a vendég-widget alapértelmezett egységét; árajánlat-módban „személyesen igazolja vissza · fizetés a helyszínen” pipák; lemondó lapon nincs koppintható elérhetőség; gomb-feliratok balra-fent tapadnak a vendég utóélet-lapjain; süti-sáv a bejelentkezett adminban és az ajánlat-lapon (ismert).

## Döntési anyag (gitignore-olt, a fában marad)

`elek/runs/NIGHT-2026-09-28T19-37-58/itelet/` — `ITELET.md` (gépi eredmény és érthetőség KÜLÖN) + 28 kép.

## Módosított fájlok

`elek/bin/runner.mts` · `elek/bin/run-night.mts` · `elek/scenarios/FK-011…FK-015-*.md`

## Nyitott

- FK-012 / FK-013 javított lépései egy KÖVETKEZŐ tiszta alanyon futtatandók (dev DB-ben most nincs ilyen).
- Az FK-013 fix szövegei („nádfedeles”, „Balaton 12 km”) alany-függetlenné tétele.

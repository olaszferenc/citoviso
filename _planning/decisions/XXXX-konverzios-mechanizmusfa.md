## ADR-XXXX — Konverziós mechanizmusfa: a megkeresés → vevő út egyetlen közös modellje

- **Dátum:** 2026-11-28
- **Státusz:** elfogadva (tulaj, `cit96bd8170`-utód koordinátor; a tulaj szava: „most csak ilyen nagyon intuitíven, nagyon ad hoc dobálunk be ötleteket… valami alapfelállást kéne csinálni, amiben megegyezünk a teljes konverziós folyamatról”; „Ez a fájl legyen … doktrína szintű dolog, amit majd építünk, és ide rögzítünk méréseket”)
- **Érinti:** `_planning/DOMAIN/07-CONVERSION-TREE.md` (új, élő dokumentum), `_planning/DOMAIN/04-INDEX.md`

### Mi volt a baj
A konverzió javítására ötletek egyenként jöttek (levél-szöveg, kép, próba, ár), közös modell nélkül. Nem látszott,
melyik ötlet melyik lépésen hat, mérjük-e azt a lépést, és hol a legnagyobb esés. Mérve 11-27/28: 1797 levélből
339 tervnyitás, ~25 ajánlathoz nyúlás, 1 próba, 0 rendelés; négy lépésről (kiválasztás pontossága, megérkezés,
észrevétel, megmaradás) nincs szám.

### Döntés
1. **Egy fa, négyféle csomóponttal:** állapot (a gerinc, arány az előzőből) · ok (két állapot között; igazolt vagy
   feltevés) · mérés (mérve / részben / vakfolt) · kar (csak ok alá; hatása a szülő-állapot arányán mérve).
2. **Gerinc:** 0 kiválasztott lead → 1 kiküldve → 2 megérkezett → 3 észrevette → 4 megnyitotta → 5 tervet nyitott →
   6 végignézte → 7 ajánlathoz nyúlt → 8 próba/rendelés → 9 fizetett → 10 megmaradt; oldalkijárat: válasz,
   leiratkozás. A 2 és a 3 külön állapot (tulaj: „szerintem is”), a fa a megmaradásig tart (tulaj: „igen!”).
3. **Hatókör:** egyelőre csak az e-mailes megkeresés (tulaj); a többi csatorna később csatlakozik.
4. **Élő dokumentum:** a fa, az aktív feladatok és a mérési napló a `07-CONVERSION-TREE.md`-ben él; minden
   konverziós kísérlet és mérés oda kerül, dátummal és forrással. Ami nem köthető egy csomóponthoz, azt nem csináljuk.

### Visszafordíthatóság
🔄 Olcsó: dokumentum és munkamódszer, kódot nem érint.

### Elvetett alternatíva
- Csak állapotok (tölcsér) okok nélkül: a „miért” megint ötletelésbe csúszna.
- Állapotok és okok vegyesen, egyforma csomópontként (a kiinduló skicc): nem látszik, mi mért és mi feltevés.

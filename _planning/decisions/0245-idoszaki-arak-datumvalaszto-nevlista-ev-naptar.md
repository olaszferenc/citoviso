## ADR-0245 — Időszaki árak: dátumválasztó, névlista, év-naptár (2026-09-27)

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (megvalósítva, őrrel; nem élesítve) ·
**Kapcsolódó:** ADR-0221 (évsáv, évre szóló ár és napok — erre épít), ADR-0049 (időszakonkénti
minimum), ADR-0036 (i18n), §B.17 · **Kontraktus:** `assets/design-refs/tenant-admin/season-datepicker/`
· **Őr:** `scripts/season-year-price-check.mts` (bővítve), `scripts/pricing-booking-only-check.mts`
(④ átírva).

**Kiváltó (tulaj, 2026-09-26, Camping Carina árak-képernyő):** „nagy segítség lenne a
dátumválasztó, ráadásul a javasolt segítőszöveg sem egyértelmű” — az időszak napjait „11-01”
alakban kellett gépelni, egy hosszú hónap-nap útmutatóval. És: „a szezon megnevezések szabad
szavasak… legalább azt ajánlja fel, amit eddig rögzített, mert így simán lehet Főszezon /
főszezon / Föszezon”. Kérdésre: „mi van, ha a következő évre akar módosítani?” — az ADR-0221
évsávja ezt már tudja, csak a tulaj nem látta (a Carinánál még nem volt időszak).

### ① A DÖNTÉS (két §2b kör)

- 1. kör A (naptár) / B (hónap + nap lista) / C (naptár + évsáv) → **„A + évsáv”**.
- 2. kör: lenyíló névlista + az évsáv kártyáján valódi, évszámos naptár → **jóváhagyva**, egy
  kéréssel: a naptár **a dátumgomb FÖLÖTT** nyíljon (nem az űrlap alján) → **„nagyon jó így”**.
- Kérdésre igen: a névből a napokat is átvesszük; az év-naptár a kártya meglévő napjain nyílik.

### ② AMIT A MEGVALÓSÍTÁS KÖT

1. **Ismétlődő naptár év és H–V fejléc nélkül** (a nap-név évről évre változna); az **év-naptár**
   viszont évszámmal, hétfővel kezdve, hétvégével — ott a „szombattól szombatig” a döntés tárgya.
   Az év-naptár kezdő napja abba az évbe esik, a záró legfeljebb egy évvel később (`occurrence()`
   csak ezt tudja `MM-DD` + évként tárolni).
2. **Asztalon `position:fixed`, a dátumgombhoz mérve, FÖLÖTTE**; alatta csak, ha a ragadós
   `.adm-top` alatt nem fér el. ⛔ Nem az űrlaphoz abszolút: az `.adm-card{overflow:hidden}`
   levágná. Mobilon (az ŰRLAP szélessége < 620 px, nem a viewport) a folyamban, a mezők alatt.
3. **Progresszív bővítés:** a szerver a régi szöveges hónap-nap mezőket adja (útmutatóval,
   `data-sdp-nojs`); a szkript rejtett mezővé teszi őket — a POST változatlan, a szerver
   normalizálása (`normMonthDay`) ugyanaz.
4. **Névlista = a szállás összes ISMÉTLŐDŐ időszaka** (`data.prices`-ből, új adatmező nélkül);
   a saját egység nevei nem választhatók. Az összevetés kis/nagybetű-, ékezet- és szóköz-független;
   ≤ 2 betű eltérésre „Hasonló név már van”.
5. **A szerver is tilt:** azonos (összevetett) név ugyanannál az egységnél → elutasítás a
   meglévő nevével (`addSeasonPrice`, `updateSeasonPrice`; önmagával nem ütközik). Más egységnél
   szabad — ott épp ez a cél.
6. **Minden szó `T()`-ből** (az `L` objektum), hónap- és napnevek `Intl`-ből a lap nyelvén;
   az új kliens-fájl (`assets/runtime/cit-season-editor.js`) az i18n-lint hatókörében.
7. **Determinizmus:** üres űrlap a szerver `today`-jének hónapján nyílik (nem a gép óráján) —
   különben a súgó-kép (deploy-kapu, ADR-0220) havonta változna.

### ③ AMIT A SAJÁT MÉRÉSEM FOGOTT MEG

- Az év-naptár telefonon **félszélességű** volt (egy hónap, két rács-oszlop) — a súgó-képen
  láttam meg; az őrben eddig nem volt szélesség-állítás → most van (91 % / 47 %).
- Az első asztali elhelyezés-állításom a „fölötte VAGY alatta” mindkettőt elfogadta, vagyis egy
  mindig lefelé nyíló naptár is zöld lett volna → szigorítva, piros kontrollal igazolva.
- A mező-feliratok `.78rem`-je a beviteli mezőkre is öröklődött (12 px-es szöveg a 14 px-es
  gomb mellett) → a felirat külön elem (`.pn-l`).

# Operátor lead-lista (`/leads`) — jóváhagyott terv (A változat, 2026-09-14)

Tulajdonosi jóváhagyás: **2026-09-14**. A tulaj két változatot látott mobil ÉS asztali képen,
kattintható HTML-lel, és az **A** változatot választotta: *tábla, ragadó NÉV oszloppal*.
Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl — a `contract-drift-check`
> pontosan azokat keresi vissza a kódban. A változat NEVE nem felirat, ezért nem abban az
> alakban áll.

Referencia: `plan.html` (kattintható, valós adattal, „Mobil 390px / Asztali" váltóval),
`A-asztali.png`, `A-mobil.png`. Az elvetett változat is bent marad
(`B-elvetett-*.png`) — hogy a döntés MIRE mondott nemet, az is dokumentálva legyen.

> A tulaj szava: *„Telefonon is tábla marad, a NÉV oszlop görgetéskor a helyén, kiírva hogy
> oldalra görgetve jön a többi oszlop, és a jelmagyarázat a tábla FÖLÉ kerül."*

---

## Miért van — a mért hibák (Elek FK-003, 2026-09-13; újramérve 2026-09-14)

| Hiba | Mérés |
|---|---|
| A jelmagyarázat a lap LEGALJÁN, csukva — ott, ahol a döntés már megszületett | `views.ts:1284`, a lapozó UTÁN, `<details>` nyitás nélkül |
| Lapozni csak a lap aljára görgetve | egyetlen `leadPager` hívás, `views.ts:1283` |
| Nyers angol adatbázis-érték magyar felületen | `approved` / `generated` / `rejected` a MOCK cellában, a szűrő-opció feliratában ÉS a jelmagyarázatban |
| Tizedespont magyar felületen | `confCell` → `toFixed(2)` → `0.85`; a szűrő-mondat is `legalább 0.8` |
| Azonos jelölés két jelentéssel | a KVALIFIKÁCIÓ szűrő-jelvénye DARABSZÁM, az ANYAG-é KÜSZÖB (`1+`) — vizuálisan ugyanaz a cián pötty |
| „✓ kiküldve" önmagában tördelődik | a `.pill`-en nincs `white-space` |
| Egyenetlen sormagasság | a NÉV oszlop `overflow-wrap: anywhere` → 1 és 3 soros sorok keverednek |
| **A FOTÓK 10-es értéke PLAFON, nem darabszám** | **595 leadből 365-nek pontosan 10**, 168-nak 0 → 90 % a két szélsőértéken (a Google Places legfeljebb 10 fotót ad) |
| **A MATCH 0,85 a képlet ALAPÉRTÉKE** | **54 lead** értéke pontosan `0.8500000000000001`, **109-é** NULL; a maradék 432 szinte mind egyedi |
| **390 px-en a 11 oszlopból 3 látszik** | görgető-doboz client **320** / scroll **1070** → **750 px túllógás, 408 levágott cella**; kívül reked az Ország, Város, Kvalifikáció, Fotók, Anyag, Match, Kontakt, Mock — minden, amiből az operátor dönt |

---

## Mit KÖT a terv

### ① A jelmagyarázat a DÖNTÉS ELŐTT áll, nem a lap alján

- A `<details>` a **táblázat FÖLÉ** kerül (a számláló-sor és a lapozó után, a tábla elé).
- **Asztalin NYITVA fogad**, telefonon **csukva** — két külön tervezői döntés: 390 px-en a
  nyitott lista a teljes első képernyőt elvenné a táblázat elől, a HELYE viszont mindkét
  méreten ugyanaz.
- **Minden oszlopfejléc visel egy „?" gombot**, ami kinyitja a jelmagyarázatot, **odagörget
  az ADOTT oszlop sorához és kiemeli**. A jelentés így elérhető onnan, ahol a kérdés
  felmerül — és érintőképernyőn is, ahol nincs tooltip.
- A lista MINDEN oszlopot tartalmaz, plusz a cellán belüli jelöléseket (`SV`, `✓ kiküldve`,
  „nincs besorolás").

### ② Lapozó FELÜL is

Ugyanaz a vezérlő a táblázat előtt és után, **közös állapotból**. A felső lapozás a
számláló-mondatot (`1–10 / 260 sor megjelenítve`) is átírja — a két elem nem csúszhat szét.

### ③ Egy állapot = EGY MAGYAR SZÓ, egy regiszterből

`nincs` · `legenerálva` · `jóváhagyva` · `elutasítva`.

- ⛔ Az `approved` / `generated` / `rejected` nyers adatbázis-érték **soha nem jelenik meg**
  a felületen.
- A szó **EGY regiszterből** jön, amit a MOCK cella, a szűrő-opció felirata és a
  jelmagyarázat (`columnMeaning("mock")`) is olvas — egy sor így szerkezetileg nem tud olyan
  állapotot megnevezni, amit a szűrő nem ismer.
- Ismeretlen értéket **nem találgatunk**: olvashatóvá tesszük (alsó vonás → szóköz), tehát
  egy új enum csúnyán, de IGAZUL jelenik meg (ADR-0141 ①).

### ④ A szám a felület NYELVÉN

- A Match-cella `0,85` (magyar tizedesvessző), és **ugyanabból a formázóból** kapja az
  elválasztót, mint az őt leíró szűrő-mondat („Match: legalább 0,8"). Egy szabály, egy
  példány — a kettő nem tud szétcsúszni.
- Az elválasztó a **locale-ból** jön, nem beégetett vesszőből: angol konzolon `0.85` marad.

### ⑤ A PLAFON nem darabszám

Ahol a Places-fotók száma eléri a felső korlátot (10), a cella **kimondja, hogy ez plafon**
— a szám mellett jelöléssel, és a jelmagyarázat megnevezi a korlátot. „10" és „10 vagy több"
két különböző állítás; a lista eddig az elsőt mondta, miközben a másodikat tudta.

### ⑥ Az ALAPÉRTÉK nem mért egyezés

- A `0,85` **jelölve** van (a cella elemleírása kimondja: a képlet kiinduló súlya, nem mért
  egyezés — 54 lead áll pontosan itt).
- A hiányzó match **szövegesen** áll („nincs találat"), nem néma gondolatjellel, és az
  elemleírás megmondja, miért (nem volt portál-találat; 109 lead).

### ⑦ Két jelentés = két ALAK

A fejléc-szűrő két jelvénye **nem nézhet ki egyformán**:

- **DARABSZÁM** (hány értéket pipáltam ki) — kerek, kitöltött, cián.
- **KÜSZÖB** (alsó határ) — szögletes, körvonalas, **`≥` jellel** (`≥1`, `≥3`).

A fiókban egy sor kimondja, melyik alak mit jelent.

### ⑧ A „✓ kiküldve" nem tördelődik

`white-space: nowrap` a `.pill`-en. A két szó egyben egy jelölés; szétesve két félmondat.

### ⑨ Egyenletes sormagasság

Fix sormagasság; a hosszú NÉV **két sornál elvágódik** (a teljes név az elemleírásban
marad). A szem így végig tud futni egy oszlopon. ⚠️ A NÉV törhetősége egy KORÁBBI,
dokumentált javítás (390 px-en a név „Vend / éghá / z"-ként tördelődött) — a vágás azt NEM
vonja vissza, csak határt szab neki.

### ⑩ TELEFONON IS TÁBLA — ragadó NÉV oszloppal *(a döntés lényege)*

- A táblázat 390 px-en **marad táblázat**, vízszintesen görgethető.
- **A NÉV oszlop (fejléc és cella) TAPAD a görgető-doboz bal széléhez** — vízszintes
  görgetés közben a helyén marad, hogy minden érték mellett látszódjon, MELYIK leadről szól.
- A lap **kiírja**, hogy oldalra görgetve jön a többi oszlop, és hogy a Név a helyén marad.
  Egy néma görgethetőség 390 px-en nem felfedezhető.

⚠️ **A RAGADÁST VALÓDI GÖRGETÉSSEL KELL MÉRNI.** A `position: sticky` a DOM-ból és a
`getComputedStyle`-ból is „beállítottnak" látszik akkor is, ha soha nem tapad (elég egy
`overflow` a szülőn vagy egy ütköző `position`). A teljes-lapos screenshot pedig a sticky
elemet a VÉGLEGES helyére festi — egy sosem tapadó oszlop is zöldnek látszana rajta
(tulajdonosi kikötés, 2026-09-14; rokon: `reference_fullpage_shot_hides_dead_sticky`).
Az őr ezért **ténylegesen elgörgeti a konténert**, és a NÉV cella **képernyő-koordinátáját**
hasonlítja össze görgetés előtt és után.

---

## Amit a terv SZÁNDÉKOSAN nem old meg

- **A diszkvalifikált lista-nézet** nem mondja meg, MIKOR és KI zárta ki a leadet, és a
  listáról nincs visszaminősítés (az indok és a gomb a lead-lap Audit fülén van). Külön
  döntés.
- **A lead-LAP** (`/lead/:id`) változat-döntése külön érkezik — ez a kontraktus arra NEM
  vonatkozik.
- **Az irányítópult „13/14 eladó" piros jelvénye** ugyanannak a hibaosztálynak a példánya
  (állapot-szín olyat állít, ami nem igaz), de nem ezen a felületen van.

---

## Kapuk

`scripts/lead-list-plan-check.mts` — a KIRENDERELT lapon mér, valódi böngészőben:
a jelmagyarázat helye és érkezési állapota, a felső lapozó, a magyar állapot-szavak, a
tizedesvessző, a plafon- és alapérték-jelölés, a két jelvény-alak, a `nowrap`, az
egyenletes sormagasság, és **a ragadás valódi görgetéssel**. Piros önteszttel (a
visszarontott nézeten pirosra megy), a pre-commitben `views.ts` / `leadFilters.ts` /
`citui-console.css` triggerrel.

A meglévő `lead-filter-label-check` (a szűrő felirata = a szűrt oszlop; nincs levágott
oszlop-tartalom) változatlanul érvényes, és ezzel a tervvel nem ütközik.

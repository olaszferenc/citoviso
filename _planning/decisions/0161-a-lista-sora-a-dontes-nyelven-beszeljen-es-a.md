## ADR-0161 — A lista SORA a döntés nyelvén beszéljen, és a magyarázat a döntés ELŐTT álljon (2026-09-14)

**Dátum:** 2026-09-14 · **Státusz:** elfogadva · **Kapcsolódó:** ADR-0141 (nincs nyers
adatbázis-érték a felületen — ez annak a KITERJESZTÉSE a lead-listára), ADR-0125 (a lista
sora mondja meg, miről szól), ADR-0143 (a levágott vezérlő csak pixelen látszik),
ADR-0149 (minden Elek-lépésről két kép), 03-INVARIANTS §B.17.
**Kontraktus:** `assets/design-refs/console/lead-list/` (tulaj jóváhagyta 2026-09-14,
„A — Tábla, ragadó NÉV oszloppal”).

**Kiváltó (Elek FK-003, 2026-09-13; minden premissza újramérve 2026-09-14-én).** Az operátor
lead-listája tíz különböző módon mondott mást, mint ami van. A leletek nem egyenként érdekesek
— **három hibaosztályba** esnek, és a döntés is így szól.

### ① AMI A DÖNTÉSHEZ KELL, AZ A DÖNTÉS ELŐTT LEGYEN

A jelmagyarázat a lap **legalján, csukva** állt — ott, ahol a kurátor már rákattintott egy
leadre. A lapozó szintén csak alul volt. **Döntés:** mindkettő a táblázat **fölé** kerül (a
lapozó alul is marad), a jelmagyarázat asztalin **nyitva** fogad, telefonon **csukva** — ez
KÉT külön tervezői döntés, mert 390 px-en a nyitott lista a teljes első képernyőt elvenné, a
HELYE viszont mindkét méreten ugyanaz. Minden oszlopfejléc `?` gombja a jelmagyarázat **saját
sorára** ugrik és kiemeli: a `title` tooltip érintőképernyőn elérhetetlen, a tulaj pedig
telefonról dolgozik.

### ② A SZÁM ÉS AZ ÁLLAPOT A FELÜLET NYELVÉN, EGY FORRÁSBÓL

- **Egy állapot = egy szó, egy regiszterből** (`mockStatusLabel`). Eddig **három** szó volt
  forgalomban ugyanarra a három állapotra: a nyers `approved` a listán, a `mock: approved` a
  lead-lap fejlécén, és a „legenerálva” a mentés-visszaigazolásban. Mind a hat fogyasztó
  (cella, szűrő-opció, jelmagyarázat, artefaktum-kártya, fejléc-pirula, szerver-flash)
  ugyanabból olvas. Ismeretlen enum-érték **nem tűnik el és nem kap kitalált nevet**: alsó
  vonás → szóköz (ADR-0141 ① mintája).
- **Tizedesvessző** — de nem beégetve: a Match-cella és az őt leíró szűrő-mondat UGYANABBÓL a
  `decimalText` formázóból kapja az elválasztót, a **locale-ból**. Angol konzolon marad a pont.
- **Két jelentés = két alak.** A fejléc-szűrő DARABSZÁM-jelvénye (hány értéket pipáltál ki) és
  KÜSZÖB-jelvénye (alsó határ) eddig pixelre ugyanaz a cián pötty volt, és az alapértelmezett
  nézetben **egymás mellett** álltak. Most a darabszám kerek és kitöltött, a küszöb szögletes,
  körvonalas, `≥` jellel.

### ③ A PROXY NE ADJA KI MAGÁT MÉRÉSNEK

Két oszlop olyan számot mutatott, ami nem az, aminek látszott:

- **FOTÓK = PLAFON.** Mérve: 595 leadből **365-nek pontosan 10** a `placesPhotos`-a, 168-nak 0
  → a készlet **90 %-a a két szélsőértéken** ül. A Google Places legfeljebb 10 fotót ad vissza.
  „10” és „10 vagy több” két KÜLÖNBÖZŐ állítás, és a lista az elsőt mondta, miközben a
  másodikat tudta. A cella most `10+` alakot vesz fel és **kimondja, hogy ez felső korlát**.
- **MATCH 0,85 = ALAPÉRTÉK.** **54 lead** értéke pontosan `0.8500000000000001` (a képlet
  kiinduló súlya, mérés nélkül), **109-é** hiányzik. Az alapérték jelölve; a hiányzó érték
  **szövegesen** áll („nincs találat”), nem néma gondolatjelként — a `–` eddig egyszerre
  jelentett „nem mértük”-et és semmit.

### ④ TELEFONON IS TÁBLA — RAGADÓ NÉV OSZLOPPAL (a tulaj döntése)

Mérve 390 px-en: a **11 oszlopból 3** látszott, a görgető-doboz **750 px-t** lógott túl, és
minden döntéshez kellő oszlop (Kvalifikáció, Fotók, Anyag, Match, Kontakt, Mock) kívül rekedt.
A tulaj a táblázatot választotta (nem kártyákat): a **NÉV oszlop tapad** a görgető-doboz bal
széléhez, hogy minden érték mellett látszódjon, MELYIK leadről szól — és a lap **kimondja**,
hogy oldalra görgetve jön a többi oszlop. Plusz egyenletes sormagasság (a NÉV hossza nem
mozdíthatja a sort) és `white-space: nowrap` a jelöléseken (a „✓ kiküldve” eddig szétesett).

**Az elvetett változat** (kevesebb oszlop + kártya-lista telefonon) a kontraktus mellett marad
képen — hogy a döntés MIRE mondott nemet, az is dokumentálva legyen.

### AZ ŐR — ÉS AMIÉRT KÜLÖN KIKÖTÉS SZÜLETETT RÁ

`scripts/lead-list-plan-check.mts` a KIRENDERELT lapon mér, valódi stíluslappal.

⚠️⚠️ **A ragadást VALÓDI GÖRGETÉSSEL méri** (tulajdonosi kikötés): a `position: sticky` a
forrásból és a `getComputedStyle`-ból is „beállítottnak” látszik akkor is, ha SOHA nem tapad
(elég egy `overflow` a rossz szülőn vagy egy ütköző `position`), a teljes-lapos screenshot
pedig a sticky elemet a VÉGLEGES helyére festi — **egy sosem tapadó oszlop is zöldnek
látszana** (`reference_fullpage_shot_hides_dead_sticky`). Az őr ezért **elgörgeti a
konténert**, és a NÉV cella **képernyő-koordinátáját** hasonlítja össze előtte/utána —
**egy NEM-ragadó oszlopon igazolva, hogy a görgetés tényleg megtörtént** (különben egy halott
görgető-doboz is „ragadásnak” látszana), és előfeltételként megkövetelve, hogy a táblázat
tényleg túllógjon (üres halmazon nem mér). Piros önteszt: a visszarontott lapon 5 állítás
bukik — a ragadás-állítás így: *„elmozdult 400px (35 → -365), miközben a Város is 400px-t”*.

**A saját mérésem két rése, menet közben javítva** (mindkettő `feedback_guard_greenly_defended_the_bug` osztálya):
- a `nowrap`-állítás **nem ment pirosra** az öntesztben: 1280 px-en a MOCK oszlop elég széles
  ahhoz, hogy a jelölés tördelés-engedéllyel se törjön meg — a geometria egyedül semmit nem
  mért. Most a HATÁLYOS `white-space` értéket is kimondja.
- a sormagasság-állítás MINDEN sor azonosságát követelte, holott a két jelölést viselő sor
  legitimen magasabb. A mérce a NÉV okozta egyenetlenség, nem az, hogy több tartalom ne férjen el.

**Amit a felirat-változás eltört (mind javítva).** Egy felirat átírása eltöri MINDENT, ami
idézi (`feedback_label_change_breaks_its_quoters`): két súgó-cikk, két Elek-forgatókönyv és
**két szomszéd őr** — köztük egy, amelynek az állítása a szótár-váltás után **ÜRESEN IGAZ**
lett volna (a nyers `mock: approved` alakot kereste). Annak a tűje most a regiszterből jön, és
új kontroll bizonyítja, hogy a kifejezés az egybeeső állapotban tényleg megjelenik.

**Hatókör.** A lead-LAP elrendezése NEM tartozik ide (külön terv-kör). A tulaj rábólintására
csak az állapot-SZÓ ment át oda is — hogy két szomszédos képernyő ne mondjon mást ugyanarról.

**Nyitva marad.** A diszkvalifikált lista-nézet nem mondja meg, MIKOR és KI zárta ki a leadet,
és a listáról nincs visszaminősítés (az indok és a gomb a lead-lap Audit fülén van). Külön döntés.

**Visszafordíthatóság:** 🔄 felület- és szöveg-szintű, nulla migráció, nulla adat-mozdulat.

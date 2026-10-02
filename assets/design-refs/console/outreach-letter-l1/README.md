# Megkereső levél és SMS — valódiság (L1) — kontraktus (ADR-XXXX)

**Tulajdonosi jóváhagyás:** 2026-10-02, a koordinátoron át: **B változat** (a hibás mondatok javítása + csiszolás),
**4,0 csillag alatt nincs értékelés-idézet**, a szállásadó-szemű **LLM-kritikus a sablon változásakor** fut.
A `plan.html` a jóváhagyott, működő terv (5 valódi lead előtte/jóváhagyott összevetése, mobil/asztali váltó,
„próbáld ki” panel ugyanazzal a szabállyal). A képek: `shot-{desktop,mobile}-lead{2,4,5}.png` — Camping Carina
(elavult, nincs mobil-nézet), Eldorádó Kemping (modern saját oldal), Mandula vendégház (1,0 ★).
**Ez a terv KÖT — elvárt viselkedés, nem stílus-javaslat.** A kód kimenete a terv szövegével betűre egyezett (5 lead,
levél + SMS) a befagyasztáskor.

**Hatókör:** `src/outreach/draft.ts` · `src/outreach/escalationFollowup.ts`

A megszólítás (**„Tisztelt {name}!”**) változatlan — tulaj-döntés, nem nyúlunk hozzá.

## 1. A horog első mondata (a bizonyíték)

- Értékelés **csak 4,0 ★-tól**, alanyos, egész mondatban, „értékelés” (a Google ezt számolja), nem „vélemény”:
  **„Láttuk, hogy a Google-on {count} értékelés alapján {stars} csillagos. {obs}”**
- 4,0 alatt vagy értékelés nélkül: **„Átnéztük a nyilvánosan elérhető adatait. {obs}”** — egy gyenge értékelés a dicséret
  helyén gúnynak hat (Mandula: „1 csillagos, 26 vélemény alapján” ment volna ki).

## 2. A horog második mondata — CSAK a mért tény (§B.17, Elek H-3)

| Lead | Mondat | Hiány? |
|---|---|---|
| nincs honlap / ismeretlen | **„Saját honlapot viszont nem találtunk.”** | igen |
| elavult · nem töltött be | **„A honlapját viszont nem tudtuk megnyitni, amikor megnéztük.”** | igen |
| elavult · betölt, nincs mobil-nézet | **„A mostani honlapja viszont nincs telefonra igazítva.”** | igen |
| elavult · mobilos, csak régi jelek · modern saját oldal · nincs mérés | **„A mostani honlapját is megnéztük.”** | nem |

⛔ Mérés élesen, 2026-10-02: a régi „telefonon nehezen boldogul” 388 elavult leadből 256-nál nem volt forrásolt
(211 nem töltött be, 45-nek VAN mobil-nézete); a régi „Saját, modern oldal viszont még nincs a képben.” épp annak a
besorolásnak mond ellent, ami kiválasztotta.

## 3. Az ajánlat-mondat

- **„Ezért …” CSAK kimondott hiány után.** Hiány nélkül nincs „Ezért”, és nincs „új” terv (cserét sugallna — a
  szállásadó-szemű kritikus BLOKKOLÓ kifogása volt modern oldal mellett):
  **„Készítettünk Önnek egy másik honlap-tervet, hogy össze tudja vetni a mostanival.”**
- A forrás-fordulat („a nyilvánosan elérhető adataiból”) csak akkor, ha a horog nem mondta már ki.
- A demó-keretezés minden ágban: **„Ez még csak látványterv, nem kész oldal, és semmire nem kötelezi.”**

## 4. Csiszolás (B)

- Ár-mondat: **„Bemutatkozó ajánlatként minden csomagra {percent}% kedvezményt adunk: a saját honlap havi {price} forint helyett {offerPrice} forinttól indul.”**
  (nem „forinttól az Öné”). Az emlékeztető-levélben ugyanígy („Döntés-segítő ajánlatként …”).
- **„Ha tetszik, elindítjuk az oldalt. A vendégei ezután közvetlenül Önnél foglalnak, jutalék nélkül.”** — „élesít” informatikus szó.
- Lábjegyzet: **„A kedvezmény az első díjra szól, a hosszabbítás már listaáras.”** (nem „listaáron megy”).
- SMS-aláírás: „A Citoviso csapata” (nem angolos „Csapata”). Az SMS többi szövege a tulaj saját mondata (ADR-0112) — változatlan.

## 5. Őr és kritikus

- `scripts/outreach-letter-truth-check.mts` (pre-commit): MINDEN ágat kirenderel (szegmens × honlap-mérés × csillag-sáv,
  300 ág), és a fentieket állítja; mutációval igazolva (küszöb, elavult-ág, „élesítjük”, modern-ág → mind piros).
- Szállásadó-szemű LLM-kritikus (`src/outreach/letterCritic.ts`): a sablon ujjlenyomatára rögzített PASS kell
  (`src/outreach/letterCritic.verdict.json`). Szöveg-változás után: `npx tsx scripts/outreach-letter-critic.mts --run`.
  Küldésenként NEM fut — a levélben nincs leadenként egyedi AI-mondat; ha lesz, akkor kell küldés előtti futás.

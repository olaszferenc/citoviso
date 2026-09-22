# 2026-09-22 — Automata heti programajánló: a gyűjtés MÉRÉSE, az átnevezés, és egy doktrína-javítás

## Mandátum
A `poi` modul átnevezése + heti automata programgyűjtés + árazás (a tulaj az árat
MAGA állítja be az Árazás lapon — kódot nem igényel, ebben a körben nem téma).
Brief: egy testvér-session írta, `assets/design-refs/_drafts/BRIEF.md`.

## ⛔ Amit a mérés cáfolt — sorban, mert mindegyik az előzőt írta felül

**① A web_search NEM a jó eszköz.** Mérve (valós API, Balatonfüred 30 km):
Haiku 4.5 + séma = 45 Ft/régió/futás, **68 691 input token** 5 keresésből — a költség
93%-a abból, hogy a találatok beömlenek a kontextusba. A hipotézisem, hogy a Sonnet
dinamikus szűréssel olcsóbb lesz, **megbukott**: a szűrés csak 27%-ot vágott, a Sonnet
1,86× DRÁGÁBB és 17× lassabb (369 s/régió).

**② A tulaj szúrta ki: a „strukturált források" mind JEGYESEK.** A Ticketmaster/tixa/jegy
torzított minta — a szüreti bál, lecsófőző verseny, jótékonysági futás nincs rajtuk.
⭐ Mérve, hogy a torzítás MÉLYEBB: a `tixa.hu` 94 `Event` JSON-LD-t ad, a helyi programot
hirdető oldalak (gotravel, csodalatosbalaton, welovebalaton, programturizmus) **nullát**.
**A strukturált markup a jegyértékesítéssel korrelál** — aki helyi programot hirdet, nem
tesz ki JSON-LD-t. 20 Balaton-környéki önkormányzatból **2** futtat gépi naptárt, az egyik
üres: 8 esemény/hónap. A nulla-tokenes út tehát **marginális**, nem tudja vinni a modult.

**③ A tulaj szúrta ki: a Brave már bent van (ADR-0026).** „Ezek nem valódi keresések,
hanem adatbegyűjtések." Igaza lett: $5/1000 (fele az Anthropic $10/1000-ének), és MI
döntjük el, mi megy a modellbe. Mérve fej-fej:
| | web_search | Brave-lánc v2 |
|---|---|---|
| Ft/régió/futás | 33,92 | **43,36** |
| program | 6 | **17** |
| **Ft/program** | 5,65 | **2,55** |
| rossz dátum kiment | **2 (33%)** | **0** |

**④ A SAJÁT mérésem kétszer vezetett félre.**
- A bő futás (45 lap egy hívásban) **rosszabb** lett: 3 program 54 Ft-ért. A szűk
  keresztmetszet a **kötegméret**, nem a keresés — 5-ös kötegekben ugyanaz 24 programot adott.
- „50 ingyen eseményt találtam JSON-LD-ben" → a v2-ben `name`+`startDate` szűréssel
  **1 db** maradt 40 lapon. Darabszámot néztem tartalomnak. **Harmadszor** ebben a szálban.

## A gyűjtés terve (mért számokból)
Brave (URL-felderítés) → `politeness.ts` letöltés (robots-tisztelettel) → `jsonLdNodes()`
ahol van → Haiku **kis kötegekben** a lap SZÖVEGÉBŐL → **kódszintű dátum-ablak kapu** → dedup.
⛔ A séma a dátum MEGLÉTÉT kényszeríti ki, a HELYESSÉGÉT nem — a kapu teherviselő.

**Lokalitás (tulaj kérdése).** Nem modell-címkével, hanem két ponton:
- keresés ELŐTT: településenkénti lekérdezés. Mérve egy valós tenantra (Révfülöp):
  **120 település** 30 km-en belül. Mind lekérdezni 210 Ft/futás → küszöb kell:
  **≥1000 fő = 41 település, 78,5% lakosság-lefedettség, ~72 Ft** + a tenant SAJÁT
  települése mindig, mérettől függetlenül.
  ⚠️ NEM mért feltevés: hogy a lakosság-lefedettség jó előrejelzője az ESEMÉNY-lefedettségnek.
- keresés UTÁN: **távolság-címke** koordinátából („HELYBEN" / „7 km") — számítás, nem ítélet.

## Ami ELKÉSZÜLT és FENT VAN (`origin/main`)
Átnevezés → **„Automata heti programajánló"** (publikus: „Heti programajánló"), az `id`
szándékosan marad `poi`. **Három rejtett fogyasztó**, amit a brief nem látott:
① a **konfigurátor** beégetve tartotta a régi nevet (a vevő a VÁSÁRLÁSI felületen a régit
látta volna) és fedezetlen ígéretet hordozott; ② a **saját kommentem** fantom fordítási
kulcsot gyártott (az `extract-i18n` a kommentből is szedi az idézőjeles magyart); ③ a
**KB** idézte a régi feliratot. + fordítás-kör 6 nyelvre (~2,4 USD) + a §2b-ben jóváhagyott
**B terv kontraktusként** befagyasztva (`assets/design-refs/console/programajanlo/`).

## Ami NEM készült el
- a gyűjtés MEGÉPÍTÉSE (a terv és a számok megvannak, kód nincs)
- a tenant heti értesítője (mérve: ma NINCS ilyen levél és nincs ütemező az appban)
- ⛔ a **vendég-értesítés KIESETT** ebből a körből (tulajdonosi döntés) — a foglalt
  vendégeknek szóló heti levél nem épül, és a vásárláskori tájékoztatóba sem kerül bele.

## ⛔ A kör legdrágább tanulsága: két session EGY worktree-ben
A pool ugyanazt a fát adta két szálnak. Kár: a testvér `land.sh`-ja **törölte a
`_drafts/`-ot** a jóváhagyásra váró mockjaimmal; idegen fájlok (`pc.html`, `wd.json`) a
fában; és a commitom **idegen szál félkész szócikkein** bukott. Költözés saját fába
(`~/wt/programajanlomodul`) — ez a fájlokat megoldotta, a fordítás-kaput NEM (lásd ADR-0207).

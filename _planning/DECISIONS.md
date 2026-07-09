# DÖNTÉSI NAPLÓ (ADR) — Citoviso

> Minden jelentős stratégiai/architektúra-döntés ide kerül, röviden, **nem-technikai nyelven is olvashatóan**.
> Cél: a tulaj szakértői review nélkül is **lássa és elkaphassa** a rossz kanyart.
> Formátum soronként: *mi · miért · visszafordíthatóság · elvetett alternatíva · státusz.*
> **Visszafordíthatóság:** 🔄 olcsón visszavonható  ·  🚪 egyirányú ajtó (lassan, explicit rákérdezéssel).

---

## ADR-0001 — Architektúra: evolúciós moduláris monolit, saját/vékony a TS-stacken (keret NÉLKÜL, egyelőre)

- **Dátum:** 2026-07-08
- **Döntés:** A rendszert **moduláris monolitként** építjük, **saját/vékony kóddal** a már választott
  stacken (Node 20 + TypeScript strict/ESM + Postgres + Kysely + célzott kis libek). **Nehéz keretet
  (NestJS/Next.js) most NEM adoptálunk.** A hangsúly a **tiszta modul-határokon** van, hogy a keretet /
  külön szolgáltatásokat **később, fájdalom esetén** olcsón be lehessen húzni — átírás nélkül.
- **Miért:** (1) A best practice célméretben is a *struktúra*, nem a keret — és stádium-függő: most az
  evolúciós, halasztó út a helyes. (2) Solo/kis csapat: a #1 megkötés a **karbantartó megértése** —
  átvizsgálhatatlan keret időnyomás alatt rosszabb, mint a **MineREAL-lal bevált**, testre szabott,
  átlátható mód. (3) A keret **egyirányú ajtó** → nem rohanunk bele, amíg nem tudjuk vetni.
- **Visszafordíthatóság:** 🔄 (tiszta határokkal a keret/szolgáltatás-kibontás bármikor, olcsón)
- **Elvetett alternatívák:** Next.js (frontend-forward) · NestJS (backend-forward) — mindkettő
  *egyirányú ajtó*, a jelen stádiumban túl-elköteleződés. Nyelvváltás (PHP, MineREAL-minta) — tovább
  fragmentálna, a TS-mag már áll.
- **Státusz:** ELFOGADVA. A stack-vita ezzel **lezárva** (ez a stabil horgony, nem újabb lengés).

## ADR-0002 — Munkamód: döntési napló + visszafordíthatóság-címke + fókusz

- **Dátum:** 2026-07-08
- **Döntés:** (1) Minden stratégiai döntés ide, ebbe a naplóba kerül. (2) Minden jelentős választásnál
  jelzem a **visszafordíthatóságot** (🔄 / 🚪); egyirányú ajtón lassan + explicit rákérdezéssel megyünk.
  (3) **Egy szál egyszerre**, a pilot-célhoz kötve — nincs architektúra-asztronautika. (4) Horgony a
  **MineREAL-workflow**-hoz mint mérce.
- **Miért:** A tulaj nem tudja tételesen vetni a technikát és nincs idő rá; e mechanizmus nélkül egy
  **jelentős stratégiai rossz irány észrevétlenül átcsúszhat** (mint majdnem a hand-roll→Next.js→NestJS
  lengés). Ez a napló + a címkék adják a kontrollt szakértelem nélkül.
- **Visszafordíthatóság:** 🔄
- **Státusz:** ELFOGADVA.

## ADR-0003 — Az első kurátori nézet web-alapja: tiszta Node `http` + saját `render.ts`

- **Dátum:** 2026-07-08
- **Döntés:** A belső operátor-konzol első szelete a beépített `node:http` szerverre + a meglévő
  szerver-oldali HTML-render mintára épül (`src/console/`), **0 új függőséggel**. Nincs router-lib.
- **Miért:** ADR-0001-konzisztens (saját/vékony, teljes átláthatóság, MineREAL-etosz); a kurátori
  nézet kicsi (lista + részlet + 2 gomb) → nem indokol router-keretet. A választás cserélhető.
- **Visszafordíthatóság:** 🔄 (később Hono/keret behúzható, ha a routing elnehezül)
- **Elvetett alternatíva:** Hono (pici router-helper) — ergonomikusabb, de +1 dep, most nem indokolt.
- **Státusz:** ELFOGADVA.

## ADR-0005 — Mock-generálás: paraméteres dizájn-rendszer + AI-ízlés + seed-variáció (nem kaptafa)

- **Dátum:** 2026-07-09
- **Döntés:** A mock NEM fix sablon (klón) és NEM tiszta AI-HTML (megbízhatatlan), hanem **három réteg:**
  (1) **fix tartalom-modell** (mit tartalmaz), (2) **AI arculat-brief** — vízió a fotókból + fellelt adatból:
  paletta + hangulat + layout-archetípus, (3) **renderer szállásra SEED-elve** variálja a betűpárt/szekció-
  sorrendet/akcentet/hero-stílust → egyedi, de reprodukálható. + **régión belüli ütközés-kerülő** (szomszédok
  ne hasonlítsanak).
- **Miért:** a pilot horga a varázslatos, személyre szabott mock; **szűk régióban** a szomszéd-leadek NEM
  kaphatnak hasonló arculatot. Bizalom-kritikus → strukturális biztonság + AI-ízlés korlátok közt.
- **Visszafordíthatóság:** 🔄 (PoC-ként indul; 3-4 valós leaden bizonyítjuk, utána terjesztjük)
- **Elvetett:** tiszta template (kaptafa) · tiszta AI-generált HTML (törik, QA-zhatatlan tömegben, drága).
- **Státusz:** ELFOGADVA (PoC-first).

## ADR-0006 — Mock-motor: BŐVÍTHETŐ blokk-könyvtár + komponáló (nem reskin, hanem szerkezet)

- **Dátum:** 2026-07-09
- **Kontextus:** az ADR-0005 első PoC-ja a *bőrt* variálta (szín/font/hero-variáns), de a *csontok*
  (szekció-készlet, sorrend, komponensek) azonosak maradtak → a tulaj még mindig „egy kaptafának" érzékelte.
- **Döntés:** A variáció a **SZERKEZETBŐL** jöjjön. A motor egy **nyitott, folyamatosan bővíthető
  blokk-könyvtár + komponáló:** (1) sok, tényleg más **blokk-variáns** + **opcionális szekció-típusok**
  (nem minden mockban ugyanazok) · (2) globális **„dizájn-személyiség" tengelyek** (rács, tipó-skála,
  sűrűség, kép- vs. szöveg-vezérelt) · (3) **komponáló** (seed és/vagy AI art-director), ami eldönti MELYIK
  blokkok, MILYEN sorrendben, MELYIK variánsban, MILYEN személyiséggel. Új blokk = regisztráció, **nincs
  átírás** → az expresszivitás monoton nő; régió-szintű ütközés-kerülő.
- **Miért:** a szerkezeti + kompozíciós variáció változtat az ÉRZETEN (nem a paletta); halmozódó dizájn-vagyon,
  a „kaptafa"-kockázat idővel csökken; A4-konform (csak valós/nem-fabrikált tartalmú blokkok).
- **Visszafordíthatóság:** 🔄 · **Elvetett:** egy paraméteres sablon skinelése (a PoC — kevés) · nyers AI-HTML (törik).
- **Státusz:** ELFOGADVA. Építés: bővíthető regiszter + komponáló, induló blokk-készlettel.

## ADR-0007 — Mock-generálás: GROUNDED AI-generátor + minta-katalógus (nem fix könyvtár, nem paraméteres skin)

- **Dátum:** 2026-07-09
- **Kontextus:** a tulaj bemutatta, hogy a Claude API **valóban szerkezetileg különböző** mockokat generál
  (editorial / immersive-dark / quiet-minimal / carousel / cinematic-horizontal) — szemben a paraméteres
  motorral (ADR-0005/0006, reskin) és a 180-as zip-pel (1 váz × típus-skin). → az AI-generálás a helyes út.
- **Döntés:** a mock-motor magja **AI-generálás (Claude API):** szabadon a SZERKEZETEN (itt a sokszínűség),
  de **kötötten a TÉNYEKEN.** Harness:
  - **Szerkezet:** a promptot a **szerkezeti minta-katalógus** (`_planning/DESIGN-CATALOG.md` §1) tereli —
    „diverz = ezek/ezekhez fogható; a régióban már használtakat kerüld" (anti-collision a `mock_artifact`-naplóból).
  - **Stílus:** a 180 type-referencia (`assets/design-refs/types/`) mint few-shot (paletta/hangulat/tipó).
  - **Tartalom SZIGORÚan valós** (DESIGN-CATALOG §3): nincs fabrikált tény, nincs emoji (SVG), valós fotó,
    provenance/demo-jelölés. Ismeretlen adat → szekció kihagyva.
  - **Kuráció-gate** (kész) + retry + HTML-validálás; lead-enként egyszeri generálás.
- **Miért:** valódi szerkezeti sokféleség (a szűk-régiós szomszéd-teszt), bizalom/jog megőrzésével.
- **Visszafordíthatóság:** 🔄 (PoC 3-4 valós leaden; a paraméteres motor fallback marad).
- **Elvetett:** fix statikus könyvtár (kaptafa v. fabrikált tartalom) · szabad AI-HTML grounding nélkül (jogi kockázat).
- **Státusz:** ELFOGADVA (PoC-first). ADR-0005/0006 paraméteres motorja fallback-re degradálva.

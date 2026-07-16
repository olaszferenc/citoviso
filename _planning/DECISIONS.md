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

## ADR-0008 — Mock-motor VÉGLEGES modell: két-agent pipeline + típus-osztályozás + rotáció

- **Dátum:** 2026-07-10
- **Kontextus:** a tulaj cset-mintái vadul sokszínűek; a live aiMock ezekhez képest samey (DESIGN-CATALOG §6).
  A tulaj lefektette az irányt (korpusz-építő agent + osztályozás + régió-anti-collision + használat-rotáció).
  ⚠️ **NEM bagatell:** az első benyomás dönti el a lead további sorsát.
- **Döntés — KÉT agent, tiszta szétválasztás:**
  1. **KORPUSZ-ÉPÍTŐ agent (offline, batch):** típusonként (Környezet×Minőség[×Stílus]) **≥5 tényleg-más**,
     magas minőségű referencia-dizájn. Growing, curated. „Ne szarjon be" = bátorság-kényszer a promptban +
     a `structures/` few-shot mint minőség-léc. (Ez tölti fel a 36 metszetet 5-5 variánssal.)
  2. **MOCK-GENERÁLÓ agent (per-lead, live = a mostani aiMock, kiegészítve):**
     a. **Osztályozás:** lead → típus (vízió + adat).
     b. **Kiválasztás:** a típushoz illő korpusz-dizájn, figyelembe véve (i) **régió-anti-collision**
        (a szomszédok kapott stílusai), (ii) **használat-rotáció** (a típus legkevésbé használt variánsa — rangsor).
     c. **GROUNDED ADAPTÁCIÓ (nem naiv fill):** a kiválasztott dizájn mint blueprint/few-shot → a VALÓS
        tényekkel generál; valós fotó, ismeretlen szekció **KIHAGYVA**. → nincs kamu, nincs üres/tört slot.
- **Adatszerkezet:** corpus = típus-tagelt dizájn-könyvtár (`assets/design-refs/` → később struktúrált/DB);
  usage ledger = `mock_artifact.inputs` (archetípus + corpus-design-id + típus) → rotáció + anti-collision lekérdezhető.
- **⚠️ Caveat (tényhűség):** a korpusz-dizájn a CÉL-gazdagság; a per-lead adaptáció a VALÓS adathoz szabja.
  A tartalmi gazdagságot valós enrichment (POI/vélemény/felszereltség) növeli — párhuzamos szál, nem blokkol.
- **Visszafordíthatóság:** 🔄 · Építi tovább ADR-0007-et (aiMock = az agent-2 motorja).
- **Státusz:** ELFOGADVA — **ez a lefektetett modell.**

## ADR-0009 — Korpusz-tengely: ARCHETÍPUS-elsődleges (a környezet lefokozva grounding-hintté)

- **Dátum:** 2026-07-10
- **Kontextus:** az ADR-0008 a korpuszt 9 környezet × 4 minőség = 36 metszetre partícionálta. Az első
  éles pilot-demó (27 korpusz-dizájn + 4 grounded per-lead mock valós badacsonyi leadeken) empirikus
  bizonyítékot adott, hogy a **környezet mint hard-partíció gyenge tengely**:
  1. **Fuzzy határok:** a klasszifikátor a badacsonyi leadeket szórta (legtöbb borvidek, de tengerparti
     [a Balaton nem tenger] és videki is) — a 9-cellás rács egy folytonos stílus-teret vág szét mesterségesen.
  2. **A paletta a groundingnál születik:** mind a 4 grounded mock a VALÓS fotókból hangolta a palettát
     (meleg, bordó/terrakotta), függetlenül a blueprint „besütött" környezet-színétől → a környezet fő
     haszna a groundingban úgyis megvan.
  3. **A szerkezet ortogonális a környezetre:** a diverzitás az ARCHETÍPUSBÓL jött (editorial-magazine vs
     vertical-ribbon-nav vs diagonal-split-grid), nem a környezetből. Egy archetípus minden környezetben áll.
     A 27 dizájnban 21 EGYEDI archetípus — minimális redundancia.
- **Döntés — a korpusz tengelyei újrarendezve:**
  1. **ELSŐDLEGES = ARCHETÍPUS (szerkezet).** A korpusz egy növekvő, kurált archetípus-könyvtár. Nyílt
     halmaz (a generátor talál ki újat, mi rögzítjük) — NEM fix enum. Környezet-független → egy jó
     szerkezet minden környezetben újrahasznosul.
  2. **MÁSODLAGOS = MINŐSÉG (tier, tónus).** Marad 4 (egyszeru/kozep/premium/luxus): a tier valósan
     SZERKEZETET befolyásol (luxus = sok levegő, cinematic; budget = sűrű, info-first), amit a grounding
     nehezen szab át utólag; plusz tonális/jogi kockázat (budget-re luxus = félrevezető). A korpusz
     tier-particionált: `corpus/{tier}/{n}.html`.
  3. **KÖRNYEZET → NEM korpusz-tengely, hanem GROUNDING-HINT.** A klasszifikátor továbbra is ad env-et,
     de az a per-lead grounding paletta/hangulat/feature-szótár súgása (copy), NEM mappa-választás.
- **Következmény:** a korpusz nem 36×5=180, hanem ~N archetípus × 4 tier töredéke → jóval olcsóbb
  (releváns: kreditfalba futottunk), kevesebb redundancia, NAGYOBB effektív pool leadenként → *jobb*
  anti-collision. Kiválasztás: tier-szűrés → archetípus anti-collision (szomszéd-kerülés) + rotáció.
- **Migráció:** a 27 meglévő dizájn megmarad — újra-kulcsolva {archetípus, tier}-re (env elhagyva),
  `corpus/{tier}/`-be sorolva. A HTML env-ízű tartalma egy instancia; groundingnál úgyis lecserélődik.
- **Visszafordíthatóság:** 🔄 · Felülírja az ADR-0008 env×tier partícióját; a két-agent pipeline,
  grounded adaptáció, anti-collision, rotáció, usage-ledger VÁLTOZATLAN.
- **Státusz:** ELFOGADVA (a pilot-demó empíriája alapján).

## ADR-0010 — Modul-tudatos archetípusok: a FUNKCIÓ-tengely (vékony definíció, szállás)

- **Dátum:** 2026-07-10
- **Kontextus:** a modulok (szállásfoglalás, asztalfoglalás, érdeklődés, vélemények…) iparág-specifikus
  FUNKCIÓK. Kérdés: mennyire kell most definiálni, és hogyan viszonyul a korpuszhoz (ADR-0009 4. tengely).
- **Döntés:**
  1. **A modul a FUNKCIÓ-tengely, és ADAT — NEM korpusz-tengely.** Az archetípus egy modul-BEFOGADÓ
     elrendezés-nyelvtan; a modulok jelenlét/hiány-tűrő blokkok (CLAUDE.md §7 „mag + adat-objektum").
     → nincs archetípus × modul kombinatorikus robbanás.
  2. **Vékony definíció most (Szint 0–1):** modul-katalógus (név + cél + 3-interfész besorolás) + megjelenési
     jel (milyen valós adat hozza; gerinc/adat-kapuzott/upsell). Ennyit fogyaszt a korpusz- + grounding-prompt.
     **Elhalasztva:** Szint 2 adat-séma · Szint 3 entitlement-kapuzás · Szint 4 működő widget (data-plane/konverzió).
  3. **Egyelőre CSAK szállás.** Az iparág-interfész absztrakciót akkor húzzuk rá, ha tényleg jön a 2. iparág
     (ugyanaz a bizonyíték-vezérelt elv, mint a környezetnél — ne absztraháljunk empíria előtt).
- **Hely:** `_planning/DOMAIN/05-MODULES.md` (katalógus) + a két prompt (`corpus.ts`, `mockFromCorpus.ts`)
  modul-tudatos: agent-1 modul-blokkokat rendez el (bármely részhalmaz renderel), agent-2 csak a valós
  adatú modulokat tölti (a „ismeretlen → kihagy" explicitté téve).
- **Visszafordíthatóság:** 🔄 · ADR-0007/0009 tényhűségére + moduláris-platform architektúrára épül.
- **Státusz:** ELFOGADVA.

## ADR-0011 — Modul-UI stratégia: token-kontraktus + hidratáló runtime (nem 100×N kézi meló)

- **Dátum:** 2026-07-10
- **Kontextus:** ha ~100 archetípus × N modul, a modul-UI-t NEM lehet archetípusonként kézzel lefejleszteni
  (O(archetípus × modul) = halál). A tulaj kérdése: hogyan kerül pl. a foglaló-modul mind a 100 archetípusba?
- **Döntés — a modul két rétege, és két kontraktus köti össze:**
  1. **Viselkedés = standard, egyszer megírva** (nem UI) — egy hidratáló runtime csatolja.
  2. **Megjelenés kétféle** (modul-jelleg szerint): statikus/egyszerű → az LLM írja in-skin archetípusonként
     (ingyen, natív illeszkedés); komplex/interaktív → EGY token-témázott widget egy slotba mountolva.
  - **A) Téma-kontraktus:** minden archetípus kiadja a szabvány `--cit-*` CSS-tokeneket → a widget/megosztott CSS
     ezekből öltözik → egy widget minden archetípusban natív.
  - **B) Modul-kontraktus:** `data-cit-module="<típus>"` + `data-cit-variant` horgok → egy runtime hidratál,
     bármilyen a markup.
  - **A számla: O(archetípus) + O(modul), NEM O(archetípus × modul).** Új archetípus ≈ O(1) (tokenek+horgok);
     új modul ≈ O(1) (egy handler + ha komplex, egy widget).
- **Most MEGÉPÍTVE (a tulaj: „ne maradjon későbbre"), kredit nélkül validálva:**
  `assets/runtime/cit-modules.css` (token-alapú widget-stílus) + `cit-runtime.js` (registry + hidratálás +
  az első interaktív widget: **booking/érdeklődés**, bar/card variáns) + `src/generator/runtime.ts` (a runtime
  INLINE injektálása a generált mockba, mert az standalone HTML) + a promptok kiadják a kontraktust +
  3 különböző témájú fixture bizonyítja: egy widget, három natív megjelenés (`assets/runtime/fixtures/`).
- **Tényhűség:** a mock-booking érdeklődés/foglalási IGÉNYT állít össze (dátum+létszám), nem hazudik
  élő elérhetőséget/árat/fizetést — az Szint 4 (konverzió után).
- **Következő modulok:** ugyanez a registry-minta (gallery-lightbox, reviews, map…). Spec: DOMAIN/06-UI-CONTRACT.md.
- **Visszafordíthatóság:** 🔄 · Építi ADR-0009/0010-et (moduláris platform, hibrid render szigetek).
- **Státusz:** ELFOGADVA — élő kóddal bizonyítva.

## ADR-0012 — Levegősség-kontroll: prompt-budget (számszerű függőleges ritmus) + render-mért QA-gate

- **Dátum:** 2026-07-12
- **Kontextus:** a reveal-fix (2026-07-11) után is maradt „lágy airiness" — a generált mockokban ~13–29%
  (mobil átlag ~20%) HOLT függőleges sáv (szekció-magasság − a tartalom valós kiterjedése). A prompt már
  tiltotta („üres-sáv-tilalom"), de PROSE-ként, nem mérve → törékeny (ld. reveal-tanulság).
- **Diagnózis (objektív, headless render):** három ok — (1) mobil-padding nem skálázódik (asztali ~6–7rem
  függőleges padding mobilra ömlik), (2) lefoglalt, de kitöltetlen magasság (nem-hero `min-height`/`vh` rövid
  tartalommal → alsó üres sáv), (3) túl nagy belső al-blokk-rés (120px+).
- **Döntés (a tulaj választása a 3 opcióból): PROMPT-BUDGET + QA-GATE** — NEM vak runtime CSS-felülírás
  (eltalálná a szándékos luxus-levegőt), NEM (még) auto-regeneráló kör (költség).
  1. **Prompt-budget** (`ADAPT_SYSTEM` 8. szabály): számszerű függőleges-ritmus keret — reszponzív
     `padding-block: clamp(...)` (nincs fix 6rem+), NON-hero magasság a tartalmat kövesse (csak hero lehet
     teljes magasságú), al-blokk-rés ≤ ~2.5rem, cél ~85%+ tartalom-kitöltés, tier-érzék (luxus a felső végén).
  2. **QA-gate** (`src/generator/qaAiriness.ts`): render-alapú levegősség-mérő (tag-agnosztikus sáv-detektálás
     → per-szekció holt sáv). Bekötve `generateMock`-ba best-effort, NEM-blokkoló → mér + `airinessDeadPct`
     az artifactba; egyelőre NEM regenerál. CLI: `scripts/qa-airiness.ts <mock> [width]`.
- **Validálva (élő A/B, Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%.
  A budget STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, a szekció fent/lent-rés 114px→68px,
  nincs nem-hero min-height). A maradék ~17–19% már döntően belső al-blokk-rés + hero-kompozíció (részben
  legitim lélegzés) — a két strukturális ok elhárult.
- **Következő, ha kell:** ha a mért holt% küszöb fölött marad, a QA-gate → célzott regeneráló kör (A2,
  kivétel-alapú); vagy a belső-rés budget élesítése. Az adat (`airinessDeadPct`) most már gyűlik.
- **Visszafordíthatóság:** 🔄 · nincs vak felülírás, a prompt-szabály és a mérő önállóan visszavonható.
- **Státusz:** ELFOGADVA — élő A/B-vel bizonyítva.

---

## ADR-0013 — Fogalmi váltás: a `tier` NEM minőség-létra, hanem KARAKTER/REGISZTER (illeszkedés, nem „jobb/rosszabb")

- **Dátum:** 2026-07-13
- **Kontextus:** felmerült, hogy a korpuszt tierenként töltsük fel egyedi archetípusokkal (`luxus` ma
  mindössze 1 db → minden luxus lead ugyanazt a szerkezetet kapja, nincs anti-collision). A vizsgálat közben
  a tulaj elkapta a beépített hibás előfeltevést: **miért adnánk „rosszabb" minőséget egy budget helynek?**
- **Diagnózis (a fogalom túlterhelése):** a `tier` szó két, valójában ORTOGONÁLIS dolgot kevert össze —
  (1) **gyártási minőség** (kézművesség, reszponzivitás, levegősség/ADR-0012, kódtisztaság, konverzió-fókusz)
  és (2) **stiláris regiszter/illeszkedés** (paletta melege, formalitás, hangnem, képi világ). A korpusz
  tier-mappa + a szerkezet tier-hez kötése implicit azt sugallta, hogy budget = gyengébb kimenet.
- **Döntés — a `tier` átdefiniálása:**
  1. **A gyártási minőség KONSTANS, mindig maximum.** Soha nem tierezhető lefelé. A MOAT pont az, hogy
     „minimál adatból varázslatos oldal" → a budget panzió is *kiváló* oldalt kap. A „nincs semmije" lead a
     LEGÉRTÉKESEBB szegmens (max hozzáadott érték + fő MOAT) → gyenge kimenet neki stratégiai öngyilkosság.
  2. **A `tier` a REGISZTER/ILLESZKEDÉS dial-je**, nem a minőségé: „mennyire HŰ a hely valós karakteréhez",
     nem „ő megérdemel-e szép oldalt" (mindenki megérdemel). A budget helyet luxus-jelmezbe öltöztetni
     ROSSZABB: (a) hiteltelen → bizalomvesztés → alacsonyabb konverzió; (b) kevesebb inputja van (fotó/amenity)
     → a maximalista layout üres függőleges sávot termel (ADR-0012 holt sáv). A becsületes, kompaktabb,
     hozzá-hű szerkezet nem gyengébb minőség — ez a *helyes* minőség ennek a helynek.
- **Következmény a korpuszra (előkészítő, a kód még nem változik):** ha a `tier` regiszter és nem minőség,
  akkor a **szerkezet (archetípus) minőség-semleges** → az archetípus-pool legyen **közös, tier-AGNOSZTIKUS**;
  a `tier` **lágy súly + bőr-hajtó** legyen (a mai KEMÉNY `filter(e.tier===t)` helyett fokozatos szélesítés),
  nem korpusz-partíció-kulcs. A `luxus:1` gond így NEM „kevés luxus-szerkezet", hanem „rosszul kötöttük a
  szerkezetet egy minőség-címkéhez". Ez az ADR-0009 (env×tier 36-metszet eldobása) elvének kiterjesztése a
  tier-tengelyre. ⚠️ Ellenőrzendő implementáció előtt: a korpusz-fájlokba beégetett paletta átszivárog-e az
  ADAPT-lépésen (budget-blueprint → luxus lead) → külön ADR + éles A/B, ha erre lépünk.
- **Elvetett alternatíva:** tierenként egyedi archetípus-korpusz feltöltése (minden cellának saját szerkezet).
  Elvetve: (1) újratermeli az ADR-0009-ben eldobott ritka-cella töredezést a tier-tengelyen; (2) a hibás
  „budget = gyengébb" előfeltevésre épül; (3) sok fölösleges blueprint-meló egy selection+prompt-kérdésre.
- **Visszafordíthatóság:** 🔄 · tisztán fogalmi/doktrína-rögzítés, kód még nem változott; a glosszárium-definíció
  és ez az ADR önállóan visszavonható.
- **Státusz:** ELFOGADVA — fogalmi váltás; az implementációs következmény (közös pool + lágy súly) külön,
  későbbi döntés/ADR + éles A/B mögött.

---

## ADR-0014 — Konverzió I.: Provisioning ≠ Élesítés + Site-állapotgép + pilot-minimál plane-váltás (privát előnézet)

- **Dátum:** 2026-07-13
- **Kontextus:** a tölcsér konverziós fele (Mock → élő tenant-Site) ma nem létezik. A tervezés közben kiderült,
  hogy a `PROCESS.md` „fizetési sorrend"-ellentmondása (tábla 5–6 „fizet→aktivál" vs. §C flowchart
  „Provision→Oldal ÉL→számla") NEM valós ütközés, hanem **terminológiai túlterhelés**: három szót két
  jelentésben használtunk.
- **Diagnózis — a három túlterhelt szó:** (1) **„aktiválás"** = modul-entitlement aktiválás (technikai) VAGY
  oldal-élesítés (nyilvános go-live); (2) **„előfizetés"** = az előfizetés beállítása (kapu-esemény) VAGY
  steady-state; (3) a döntő: **„provisioning"-ot és „élesítés"-t egyetlen atomi eseménynek vettük** — ezért
  tűnt ütközőnek a tulaj „fizet→nyilvános aktiválás" szabálya.
- **Döntés — a két esemény szétválasztása + állapotgép:**
  1. **Provisioning** = control→data plane technikai kiépítés egy **PRIVÁT** előnézetbe (izolált, per-tenant,
     kitalálhatatlan token-URL, `noindex`). **Fizetés ELŐTT is futtatható** — ez a `PROCESS.md` engedte
     „nem-pénzes preview", cég/fizetés nélkül is valós.
  2. **Élesítés (go-live)** = a **NYILVÁNOS** átbillentés (domain/DNS, indexelhető, felfedezhető). **Ez a
     fizetős kapu** — a tulaj sorrendje („fizet → nyilvános aktiválás") maradéktalanul áll. Nincs disagreement.
  3. **Site-állapotgép:** `draft` → `provisioned` (privát) → `live` (nyilvános, fizetés-kapus) →
     `suspended`/`deactivated`. A `provisioned`↔`live` külön állapot, NEM boolean.
- **Konverziós mellékhaszon:** a privát, VALÓS URL-en élő előnézet („itt a tényleges oldalad — fizess, hogy
  nyilvános legyen") erősebb horog egy statikus mock-képnél; egyben ez a most-építhető szelet (cégre/fizetésre
  NEM gatelt).
- **Pilot-minimál irány (a gépből PONT egy dolog épül):** a **provisioning → privát előnézet** szelet.
  Kiszolgálás **Opció 1** (a ház futtat egy `convertLead`-scriptet → `sites/<tenant_id>/index.html` izolált
  namespace, token-URL, noindex; 🔄🔄🔄 triviálisan visszavonható), **de a DB-alakot Opció 2 szerint** tervezve
  (`tenant` + `module_entitlement` + `site` sorok már az első scriptből) → a plane-határ tudatos, `tenant_id`
  az első pillanattól. **RLS** csak az első vendég-PII táblánál (booking) lép be — addig nincs mit szivárogtatni
  (§G.18). Fizetés + nyilvános élesítés + fotó-kezelés a pilotban kézi ház-lépés (A2).
- **✅ LEZÁRT függőség — demó-kép jogállása élesben (§A átírva, 2026-07-13):** a korábbi „portál/vendég-kép SOHA
  nem élesre" túl merev volt. Új szabály (`INVARIANTS §A.1/b`): `guest`/`portal` demó-kép **élesre kerülhet, HA** a
  tenant a fizetési kapuban **jogi önnyilatkozatot** tesz (rendelkezés a szerzői joggal + **szavatosság +
  kártalanítás**) ÉS volt lehetősége lecserélni (fizetés-előtti testre szabás/előnézet). Indok: a portálra a
  tenant/megbízottja töltötte fel → hihető a szerzősége. ⚠️ `places`/`streetview` (Google jogállás) és vízjeles
  fotó **NEM** önnyilatkozható → csere. A privát `provisioned` előnézet még demó-fázisú (nem nyilvános) → ott a
  demó-kép rendben. A `jog-provenance-or` őr-agent §A-mátrixát ehhez igazítani kell (követő teendő).
- **Elvetett alternatíva:** provisioning = azonnali nyilvános go-live (a flowchart eredeti olvasata) — elvetve,
  mert ütközik a fizetés-kapus élesítéssel és elveszti a privát-preview konverziós horgot.
- **Visszafordíthatóság:** 🔄 · fogalmi rögzítés + vékony, namespace-alapú provisioning (könyvtár-törléssel
  visszavonható); nincs séma-lock (a `tenant`/`site` táblák additívak).
- **Státusz:** ELFOGADVA (fogalmi rész) — az implementáció (`0004_conversion.sql` + `src/conversion/provision.ts`
  + konzol-route-ok) a következő lépés; az asset-jogi rész a §A-revízióra vár.

---

## ADR-0015 — Modult CSAK láthatóan adunk el: a modul-konfigurátor + élő előnézet a konverzió szíve

- **Dátum:** 2026-07-13
- **Kontextus:** az ADR-0014 provisioning-szelete a jóváhagyott mock statikus pillanatképét adja; a modul-választás
  csak `entitlement`-sorként rögzül, a Site nem renderelődik újra a választásból. Felmerült egy hibás
  megnyugvás („hagyjuk így: az entitlement a kereskedelmi rekord, az oldal a mock"). A tulaj elkapta:
  **így egy sosem-látott modulért kérnénk pénzt.**
- **Diagnózis:** ez ellentmond a termék MAGjának. A horog = „előre kész, személyre szabott mock, amit **LÁTNAK**".
  Egy fizetős kapu, ahol láthatatlan modult kell venni (aki 2026-ban nincs is a neten, azt a **látvány** győzi
  meg, nem egy checkbox), önellentmondás. **Azt adjuk el, amit mutatunk.** Az „entitlement ≠ render" igaz, de
  ebből NEM következik, hogy a sales-felület lehet vak — épp fordítva: a sales-felületnek vizuálisnak kell lennie.
- **Döntés:**
  1. **Modult csak láthatóan értékesítünk.** A prospect a mockon **be/kikapcsolja** a modulokat és **azonnal
     látja**, mit kap → *utána* fizet. Ez az **interaktív modul-konfigurátor + élő előnézet** (BACKLOG-ból
     előléptetve: NEM nice-to-have, hanem a **konverzió szíve**). Olcsó, mert a modul-UI már prezentáció-kész
     (ADR-0011: token-kontraktus + hidratáló runtime).
  2. **A tényhűség fázis-határának élesítése (§B.17):** a **keretezett, fizetés-ELŐTTI előnézetben** egy adat
     nélküli modul **reprezentatív/minta-állapottal MEGmutatható**, **félreérthetetlenül mintaként jelölve**
     („így fog kinézni a vélemény-szekciód, ha lesz véleményed") — ugyanaz a logika, mint a demó-fotóknál
     (demo-framing). A **NYILVÁNOS ÉLŐ oldalra** a minta-tartalom **SOHA** nem másolódik át adat-fedezet nélkül
     (§B.17 kőbe vésve marad): vétel *enged*, valós adat (vagy a tulaj admin-feltöltése) *tölt*.
- **Ami marad az ADR-0014-ből:** a `tenant`/`site`/`module_entitlement` + `convertLead` a kereskedelmi +
  provisioning **gerinc** — helyes, marad. Az élő oldal továbbra is adat-kapuzott. Csak a **vizuális
  sales-felület** hiányzott, azt scope-oljuk következőnek.
- **Elvetett alternatíva:** (A) statikus snapshot + entitlement-rekord, vizuális konfigurátor nélkül — elvetve,
  mert láthatatlan modult nem lehet eladni (a termék horgával ütközik).
- **Visszafordíthatóság:** 🔄 · fogalmi rögzítés; a konfigurátor önálló, additív szelet.
- **Státusz:** ELFOGADVA (fogalmi rész) — a konfigurátor-szelet külön scope + implementáció.

### ADR-0015 — Implementáció (2026-07-15): prospect-konfigurátor 1. szelet

- **Scope (a tulaj választása):** **toggle + minta-állapot**. A modul-UI prezentáció-kész, így kliens-oldali,
  regenerálás nélküli togglelés; a védett generálási promptot NEM érintettük.
- **Réteg:** serve-time overlay a `GET /configure/:artifactId` úton (`injectConfigurator`), a tárolt artifact tiszta
  marad. Present-modul (`data-cit-module` horog) → élő ki/be; gerinc (enquiry) jelen → lockolt ON; minden más
  katalógus-modul → jelölt „MINTA" blokk a sample-zone-ban (§B.17: reprezentatív, sosem valós adat, sosem élő oldalra).
- **Fájlok:** ÚJ `src/modules.ts` (egy-forrás katalógus + present-detektálás), `assets/runtime/cit-configurator.{css,js}`,
  `src/generator/configurator.ts`; MÓD `src/console/server.ts` (2 route + configurator-serve), `src/console/views.ts`
  (katalógus-import + prospect-konfigurátor link), `_planning/DOMAIN/06-UI-CONTRACT.md`. Teszt: `scripts/smoke-configurator*.ts`.
- **Verifikáció:** tsc tiszta; injektor-füst (grandis: present=[gallery,enquiry,location]; harsona: csupa minta) PASS;
  headless böngésző-teszt: panel nyílik, minta-toggle injektál/eltávolít, present-szekció rejtődik (block→none),
  gerinc lockolt, submit köszönet, 0 page-error. Screenshot: a minta-blokkok felveszik a skint, MINTA-szalag = akcent.
- **Submit:** `POST /configure/:id/request` → operátor-log (A2), nulla séma. A `convertLead` gerinc marad a kereskedelmi réteg.
- **Visszafordíthatóság:** 🔄 · additív (új fájlok + 2 route); a generátor érintetlen.
- **Nyitott (következő szelet):** `data-cit-section="<id>"` szekció-horog a generátor-promptban → az in-skin modulok
  (szobák/felszereltség/USP…) is togglelhetők legyenek (ma horog nélkül MINTA-ként jönnek akkor is, ha jelen vannak).

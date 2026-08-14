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

## ADR-0016 — A generáló motor architektúrája: KOMPOZÍCIÓS MOTOR (recept-absztrakció) + control/data plane; WP kizárva; mock=live egy motorból

- **Kiváltó:** a tenant-admin szerkeszthetőség igénye (a tulaj a vétel után „bármit módosítson") feltárta, hogy
  a jelenlegi motor **egyedi AI-HTML-t** ad (`mockFromCorpus` szabadon interpretál), a `convertLead` pedig ezt a
  **monolitikus HTML-t MÁSOLJA** live-ba. Ez (a) mezőnként nem szerkeszthető, (b) NEM garantál `mock=live` egyezést.
- **A tulaj követelményei (kritériumok):** ① az élesnek EGYEZNIE kell a mock-kal · ② teljes modularitás ·
  ③ több-SZÁZ-dimenziós sokszínűség (nem 5–20 fix darab) · ④ iparág-független. „Szarok a dupla munkára" =
  nem a meló-spórolás a cél, hanem a `mock=live` egyezés.
- **Döntés:**
  1. **EGY központi kompozíciós motor** (control plane), multi-tenant. **NEM** per-tenant telepítés.
  2. **Az LLM szerepe: HTML-íróból → KOMPOZÍCIÓ-TERVEZŐVÉ.** A layoutot **determinisztikus PRIMITÍVEK**
     (szekció-építőelemek) adják; az LLM **kiválaszt, sorba rak, tokenekkel skinez + szöveget/palettát ad** — nem ír nyers HTML-t.
  3. **RECEPT-absztrakció** — strukturált, tárolt, szerkeszthető kompozíció-leírás: *mely primitívek, milyen
     sorrendben, mely modulok, milyen skin/paletta, milyen szövegek.* Ez a rendszer központi objektuma.
  4. **Adatfolyam:** `adat → [AI-tervező] → RECEPT → determinisztikus render(RECEPT + adat + skin) → HTML`.
  5. **`mock=live` GARANTÁLT (nem „igyekszünk"):** ugyanaz a motor+recept; **mock = recept + DEMÓ-adat**,
     **live = ugyanaz a recept + VALÓS adat**. A forma bitre azonos, mert a render determinisztikus.
  6. **Négy készlet a motorban:** primitív-készlet (layout, **iparág-agnosztikus**) · skin-készlet (`--cit-*`
     tokenek) · modul-készlet (**funkció = az IPARÁG-INTERFÉSZ**, a 3 becsatlakozás: KÍNÁLAT·ELÉRHETŐSÉG·KONVERZIÓ) · render.
  7. **Sokszínűség = KOMBINATORIKA**, nem darabszám: primitívek × generatív paletta × modul-kompozíció ×
     tipó-skála → ezrek, pár tucat karbantartott elemből.
  8. **Iparág-agnoszticitás:** a primitívek tartalom-agnosztikusak; az **iparág = a modul-készlet**. Új iparág =
     új modul-készlet, **nem új motor**.
  9. **Control/data plane felosztás:** *házon belül* a motor + a teljes pipeline (scraper/kuráció/konverzió/
     számlázás/ERP); *kirakva a tenantnak* KIZÁRÓLAG kettő: a **publikus SITE** (a motor kimenete, tenant-domain)
     és a **tenant ADMIN** (recept+adat szerkesztő). A **motor SOHA nem települ a tenanthoz.** Izoláció **adat-szinten**
     (recept+adat per tenant), nem infrastruktúra-szinten → ez adja a közel-nulla marginális költséget + a volumen-skálát.
  10. **A recept a tenant-admin szerkeszthetőség alapja:** a tulaj a **receptet + adatot** szerkeszti (szöveg,
      modul be/ki, skin-váltás) → a központi motor **újrarendel**. Megszünteti a monolitikus HTML-t és a mock-másolást.
- **Következmények (építési):**
  - A `convertLead` mock-HTML-másolása **LECSERÉLENDŐ** → a live-ot a motor rendeli (recept + valós adat + skin).
  - A `mockFromCorpus` (AI egyedi HTML) **átalakítandó**: AI → recept, majd determinisztikus render.
  - A **06-UI-CONTRACT** (téma-kontraktus `--cit-*` + modul-kontraktus `data-cit-module` + hidratáló runtime)
    **MEGMARAD és ráépül** — ez a motor MÁR KÉSZ fele (O(archetípus)+O(modul), élő-validált).
  - A 27 archetípus/korpusz → a **primitív- + skin-készlet FORRÁSA** (desztilláció), nem eldobás.
- **Elvetett alternatívák:**
  - **(A) WordPress / per-tenant CMS** — kizárva: a `mock=live` nem garantálható (más motor mockhoz/live-hoz),
    a volumen-modell összeomlik (több ezer telepítés üzemeltetése ≠ közel-nulla költség), a mock-fázisban
    (fizetés ELŐTT) nem húzható fel nem-fizető leadnek, a központi kontroll (entitlement/guardian/számlázás)
    elvész, és a „sokszínűség" fix témákból **nem** skálázódik (darabszám ≠ kombinatorika).
  - **(B) Fix skin/archetípus-készlet (5–20 darab)** — kizárva: darabszám-alapú, nem éri el a több-száz-dimenziót.
  - **(C) Mock-HTML másolása live-ra (a mostani `convertLead`)** — kizárva: monolitikus, nem szerkeszthető,
    és valójában NEM `mock=live` (statikus másolat, ami adat-frissítésnél elavul).
  - **(D) Inline WYSIWYG a generált HTML-en** — elvetve MINT ELSŐDLEGES (nem strukturált, modul-kezelés nehéz,
    patch-réteg törékeny); lehet későbbi kényelmi réteg a recept FÖLÖTT.
- **Visszafordíthatóság:** 🚪 — a motor-mag iránya nehezen visszafordítható; DE a meglévő kontraktusokra épül,
  és **fokozatosan, vékony szeleteken** vezethető be (nincs big-bang újraírás).
- **Státusz:** ELFOGADVA (architektúra-irány, a tulajjal közösen). Implementáció vékony szeletekben; az ELSŐ a
  **bizonyító szelet**: egy primitív-készlet + egy skin + determinisztikus render, ami egy VALÓS leadből live-ot ÉS
  DEMÓ-adatból mockot ad → élőben bizonyítja a `mock=live` garanciát, mielőtt a készleteket skálázzuk.

## ADR-0017 — Motor = alapértelmezett generátor + a korpusz→motor DESZTILLÁCIÓ metodikája (tengely-passzok)

- **Kiváltó:** az ADR-0016 motor-szeletek készen állnak (archetípus-réteg + lead→SiteData mapping + generálás
  motorra kötve + `convertLead` motorra kötve, mind éles-validált, `mock=live` bizonyítva). Nyitott kérdés: a
  konzol/CLI operátor-folyamat MELYIK utat használja, és HOGYAN bővítjük a motor (ma vékony) dizájn-készletét.
- **Döntés A — a MOTOR az alapértelmezett generátor** (konzol + CLI). Indok: a régi AI-HTML úton készült mock
  **konverzióra másodrendű** (nem `mock=live`, nem szerkeszthető); minden új mock legyen elsőrendű. A régi
  `generateMock` a kódban MARAD (fallback + a meglévő artifactek), de nem az operátori alap. A vékony-kit az
  EGYETLEN hátrány, és záródó rés (lásd metodika). Éles infra nincs → van idő a készletet felhúzni.
  Elvetve: „régi az alap, motor opt-in" (a hedge) — másodrendű mockokat termelne tovább, nincs rá ok.
- **Döntés B — a korpusz→motor desztilláció metodikája: DEKOMPONÁLÁS, nem portolás.** A csapda „1 korpusz-dizájn
  → 1 archetípus" = újra 100×N robbanás + elveszett kombinatorika. Helyette minden korpusz-dizájnt HÁROM
  szétválasztható rétegre bontunk:
  - paletta/tipó/árnyék/radius → **SKIN** (11 `--cit-*` token, tiszta adat, ~0 kockázat);
  - szekció-render (kártya/táblázat/idővonal/tab) → **PRIMITÍV-VARIÁNS** (recept-bővítés: `RecipeSection={kind,variant?}`);
  - oldal-elrendezés (stacked/split/sidebar/scroll/bento) → **ARCHETÍPUS** (`arrange()`).
  Sokféleség = skin × archetípus × primitív-variáns × modul (SZORZÁS, nem darabszám).
- **⚠️ Grounding-korrekció:** a 24 élő korpusz-dizájn 18 „archetípus"-nevének nagy része **NEM oldal-elrendezés,
  hanem szekció-render** (`tabular-ledger`, `story-scroll`, `tabbed-*`) → a gazdagság JAVA a **primitív-variáns +
  skin** tengelyen van, nem az archetípuson. A beruházás mindhárom tengelyre oszlik; a recept `variant`-mezője kell.
- **Eljárás — vízszintes PASSZOK (egy tengely egyszerre), nem dizájnonként** (a passz dedup-ol, nem csatol újra):
  1. SKIN-passz (24 paletta → ~6–10 skin) — legolcsóbb, legnagyobb vizuális nyereség, ELSŐ;
  2. PRIMITÍV-variáns passz (recept `variant` + gyakori szekció-renderek) — itt a valódi gazdagság;
  3. ARCHETÍPUS-passz (18 elrendezés → ~5–7 család: stacked/split/sidebar/scroll/bento).
- **A kapu = a meglévő őr, gépiesen:** minden kinyert darab KÖTELEZŐEN token-only + scoped (`.cit-arch-<id>`) +
  `data-cit-module` horgok + nincs emoji + átmegy a `designCheck`-en. Ami nem tudja betartani → refaktor/elvetés.
  Ez tartja O(tengely)-en a költséget (nem O(N)) és garantálja a `mock=live`-ot. A korpusz-QA szűrő öröklődik
  (retired/gyenge kihagyva — „vertical-ribbon-nav fos" lecke).
- **Ember/AI a hurokban:** kinyerő-agent JAVASOL {skin/archetípus/variáns}; minden javaslat **fordul + átmegy az
  őrökön + vizuális triage** (`corpus-contact-sheet.ts`) MIELŐTT registrybe kerül. Nincs vak tömeg-import.
- **Éles-készenléti léc:** a motor-alap NEM jelenthet vékony-kit kockázatot élesben → explicit küszöb, ami alatt
  nem megyünk élesbe: pl. **≥8 skin × ≥5 archetípus + `designCheck` zöld + contact-sheet vizuális átmegy**.
- **Visszafordíthatóság:** 🔄 — a bekötés (melyik függvényt hívja a konzol) és a kit-bővítés (registry-bejegyzések)
  egyaránt additív és triviálisan visszavonható; az ADR-0016 mag `🚪`-döntése már megvan, ezen belül alacsony kockázat.
- **Státusz:** ELFOGADVA (a tulajjal közösen). Első szeletek: ① motor-bekötés alapként (konzol/CLI) · ② SKIN-passz.

## ADR-0018 — Referencia-minőség = a „wow" mérce; a motor gazdag, kézműves szekció-készletet igényel

- **Kiváltó (2026-07-23):** a motor-kimenet desktop-screenshotja „template" szintű volt — messze a tulaj
  által elvárt minőségtől. A tulaj leadott 5 referencia-mockot (`assets/design-refs/reference-quality/`),
  amelyek a valódi „wow"-mércét mutatják: full-bleed 100svh hero, üveg/dark foglaló-sáv, gazdag szekciók
  (room-kártyák árral, amenity-rács, vélemények, GYIK, sticky nav, lábléc), erős szerif-display + sans body.
- **Diagnózis:** a motor egy **vékony 4-primitíves vázat** (hero/features/gallery/enquiry) kapott, és a
  kit-passzok ennek a **kombinatorikáját** (skin×archetípus×variáns) húzták fel — nem a **gazdag kézműves
  szekció-készletet**, ami a wow-t adja. Rossz tengelyt optimalizáltunk.
- **Döntés:**
  1. A referencia-minták a repóban maradnak MÉRCEként (`assets/design-refs/reference-quality/` + README =
     kraft-standard ellenőrzőlista). Minden generált mockot EHHEZ hasonlítunk (screenshot: `engine-shot.ts`).
  2. Első javítás (KÉSZ): immerzív hero (full-bleed + scrim + eyebrow + nagy display + CTA) + prominens
     érdeklődés-sáv + nagyvonalúbb ritmus/tipó (`src/engine/primitives.ts`).
  3. Következő: a gazdag szekció-készlet felépítése a mérce szintjére — sticky nav + lábléc + polírozott
     foglaló-sáv, majd amenity-rács · szoba-kártyák · vélemény-sáv · GYIK · térkép (05-MODULES).
- **Tényhűség (§B.17) tisztázva:** a gazdag szekciók a hideg-outreach MOCK-ban **jelölt, reprezentatív
  minta-állapottal** tölthetők (ADR-0015 fázis-határ); ÉLESRE csak valós adat-fedezettel. A kraft
  (hero/tipó/ritmus/nav/lábléc) adat-független → azonnal alkalmazható.
- **Visszafordíthatóság:** 🔄 — a primitív-kraft és a szekció-modulok additívak (registry-bővítés).
- **Státusz:** ELFOGADVA. A minőség-mérce mostantól kötelező visszamérési pont minden motor-változtatásnál.

## ADR-0019 — A „wow" a MOTORON belül érhető el (editorial réteg + mozgás); NINCS HIBRID, nincs bait-and-switch

- **Kiváltó (2026-07-24/26):** az ADR-0018 nyitva hagyta a plafon-döntést (A=motor vs B=bespoke vs HIBRID).
  Elvégeztük a teherhordó kísérletet UGYANARRA az adatra: a bespoke (B) előnye **nem sablonozhatatlan
  varázslat**, hanem (1) **szerkesztőségi szöveg** (per-szekció márkahang) + (2) néhány **strukturális
  ízlés-mozdulat** (editorial hero, aszimmetrikus showcase) + (3) **mozgás** (reveal, ken-burns, hover).
  Mindhárom BEÉPÜL a motorba, additívan, a `mock=live` feláldozása NÉLKÜL.
- **Döntés:**
  1. **Motor-út marad, felokosítva.** A bespoke/HIBRID út ELVETVE. A wow-t a motor adja → `mock=live`
     megőrizve, nincs downgrade a fizetés után (**§I** bait-and-switch tilalom konstrukció szerint teljesül).
  2. **Szerkesztőségi réteg:** `SectionCopy` a receptben (eyebrow/cím/akcent + hero-lead) + `heroEditorial`
     és `roomsShowcase` variánsok (`src/engine/primitives.ts`). A copy forrása egy **grounded copywriter**
     (`src/engine/copywriter.ts`) — a motor MÁSODIK AI-lépése a planner után; §B.17-hű (számot sosem talál ki).
  3. **Mozgás-réteg:** keresztmetsző, token-only `MOTION_CSS` (`primitives.ts`) + `autoReveal()` a runtime-ban
     (`assets/runtime/cit-runtime.js`) — lépcsőzött scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés.
     `prefers-reduced-motion` + no-JS → teljesen statikus (semmi nem tűnik el). `mock=live` biztos.
- **Bizonyíték (éles-validált):** valós scraper-leadek (Villa Oliver/Gödöllő, Villa Pátzay + Rózsakő ház/Badacsony),
  mind HIGH-konfidenciájú tiszta match, valós Google-fotó+rating, három külön skin, mozgással. A tulaj: „wow" → „sokkal jobb".
  Proof-scriptek: `scripts/engine-{max-plus,from-lead-plus}.ts` (az éles `generateEngineMock` egyelőre ÉRINTETLEN).
- **Tényhűség:** a copywriter csak a megadott valós tényekre támaszkodhat (szám csak valós adatból); a szoba/vélemény
  §B.17 szerint jelölt minta valós adat híján. A Fortuna-eset megmutatta: a match-gyanú (név-egyezés 0,17) helyesen
  KÖZEPES sávot + kurátor-flaget kap → a rendszer nem attribuál vakon.
- **Visszafordíthatóság:** 🔄 — minden additív (új modul + variánsok + runtime-bővítés); az éles bekötés még hátra.
- **Státusz:** ELFOGADVA (a tulaj minőségi visszaigazolásával). Hátralévő: a copywriter+mozgás **éles bekötése**
  a `generateEngineMock`-ba (konzol/CLI), majd opcionális finomítás (világos-skin hero-scrim, GYIK-modul, hero-parallax).

## ADR-0020 — Domain-stratégia: citoviso.com aldomain = alap; egyedi domain = upsell, min. 2 éves elköteleződéssel

- **Kiváltó (2026-07-27, tulaj-döntés):** a SEO canonical/provisioning terv átnézésekor a tulaj a domain-kérdést
  hozta előre: a canonical-implementáció a pilot UTÁNRA parkol, de a **saját (egyedi) domain esetét a rendelési
  folyamatnak már most kezelnie kell** — ez lesz a kereskedelmi ajánlat kialakításának erőltetett iránya.
- **Döntés (a BACKLOG 2026-07-20-as parkolt tételének élesítése):**
  1. **Alapértelmezés (olcsóbb út):** a tenant oldala a platform-domain aldomainjén él — `<slug>.citoviso.com`.
     Nulla súrlódás (DNS/TLS nálunk), a célszegmens (nincs domainje) természetes útja.
  2. **Egyedi domain rajtunk keresztül = upsell + retenció-horog:** ha a tenant egyedi domaint akar velünk
     regisztráltatni, **minimum 2 éves (24 hónap) előfizetést vállal**. A domain nálunk = kötődés.
  3. **Rendeléskor proaktív kínálat:** a konfigurátor 3–5 **szabad, jól hangzó** domain-javaslatot ad az
     üzletnévből (HU-first: `.hu` elsődleges, `.com`/`.eu` fallback), **valós idejű előzetes
     elérhetőség-ellenőrzéssel** (olcsó réteg: DNS + RDAP; a hiteles csekk + regisztráció a registrar-API
     rétegé — pilot alatt a regisztráció kézi ház-lépés, A2).
  4. **Meglévő saját domain** (pl. `panziosissi.hu` már a tulajé): támogatott harmadik eset (`own`) —
     DNS-rákötés kézi/asszisztált (A2), automatizálás később.
- **Adatmodell:** `order_intent` += `domain_type` (`citoviso_sub`|`citoviso_registered`|`own`) + `domain_name`
  + `commitment_months` (migráció 0008). A `site` `domain`/verifikáció mezői az élesítés-szelettel jönnek
  (BACKLOG szerint), a canonical/og:url injektálással együtt (pilot után, §H).
- **Elhatárolás:** a SEO canonical + og:url implementáció (renderer-opció + `site.public_url`) POST-PILOT;
  a mock/preview továbbra sem állít canonicalt (hamis URL-t sosem állítunk).
- **Nyitott:** a `citoviso.com` domain tényleges birtoklása/regisztrációja (tulaj); registrar-választás
  (ISZT-akkreditáció .hu-hoz — BACKLOG kutatási tétel); domain éves díja (placeholder-ár a katalógusban).
- **Visszafordíthatóság:** 🔄 — additív oszlopok + UI-szekció; a registrar-integráció későbbi 🚪-döntés.
- **Státusz:** ELFOGADVA (tulaj, 2026-07-27). Impl: konfigurátor domain-lépés + order_intent rögzítés + előzetes csekk.

## ADR-0021 — Citoviso saját felület-világ: központi dizájn-mag + kettős identitás-realm (control/data plane) + granuláris belső RBAC

- **Kiváltó (2026-07-31, tulaj):** a pilot-felkészülés következő témája a **Citoviso publikus honlap** — „a lap
  honlap, amit a világ lát" (kik/mik vagyunk) **ÉS** ahol a tenantok belépnek a saját admin-felületükre, illetve
  mi belső userek a saját felületeinkre (scraper, mock-generálás, lead-kezelés). A folyamat-átbeszélésen kiderült:
  ez **három külön réteg, három kockázati profillal**, és a tulaj a tervezéskor a **belső jogosultságokat** és egy
  **központi dizájn-magot** emelte ki fő igényként.
- **A kérés szétbontása (a fő tisztázás):**
  1. **Publikus honlap** (anonim; alacsony kockázat 🔄) — marketing / bizalom-horgony. Auth NEM kell hozzá → önállóan,
     elsőként szállítható.
  2. **Bejelentkezés-kapu** (magas kockázat 🚪) — valódi identitás/auth (jelszó, session), új PII → RLS-kiváltó lehet.
  3. **Mögöttes felületek** — tenant-admin (data plane) + operátor-konzol (control plane); részben megvannak.
- **Döntés 1 — Központi dizájn-mag (tulaj kulcs-igénye):** EGY forrás a **saját termék-felületeink** arculatához
  (tokenek + alap-CSS + komponens-készlet), amiből MINDEN saját felület merít (honlap, login, belső konzol,
  tenant-admin chrome). **Elhatárolás a motor `--cit-*`-jától:** az a GENERÁLT tenant-oldalakat témázza (data plane,
  skinenként változó); ez a mi termék-brandünk (control plane), **stabil, egy arculat**. Névtér: `--citui-*`
  (pl. `public/assets/ui/`), a motor-tokenektől elkülönítve. A honlap **bespoke** (nem a motorból generált), de e mag fölött.
- **Döntés 2 — Kettős identitás-realm (KŐBE VÉSVE, §G-horgony):** a **control plane** (belső userek, mi) és a
  **data plane** (tenantok) **külön identitás-realm**: nincs közös user-tábla, nincs közös jogosultság; a tenant SOHA
  nem érhet control-plane adatot. Vizuálisan lehet egy közös „Bejelentkezés" a honlapon, a realm-ek mögötte elkülönülnek.
- **Döntés 3 — Granuláris belső RBAC (6 szerepkör, tulaj-választás):** szerepkör = engedély-halmaz (capability-string),
  route/művelet engedélyre kapuzva. Szerepkörök az ERP-modulokra képezve:
  **Superadmin** (minden + user/szerepkör-kezelés) · **Operátor** (scrape/mock-generálás/kuráció) ·
  **Sales/outreach** (lead-pipeline/prospect/megkeresés/konverzió) · **Pénzügy** (fizetés/számla/előfizetés/deaktiválás) ·
  **Dizájner** (dizájn-mag/skinek/korpusz-archetípusok + dizájn-kapu felülvizsgálat). (A Support szerepkör most kimaradt.)
  **Pilotra 1 Superadmin seed** (a tulaj az egyetlen belső user), de a séma (users + roles + permissions) eleve
  granuláris → szerepkört adni később ≠ újraírás.
- **Döntés 4 — Tenant-userek:** egyelőre **1 login / tenant** (a tulaj), de a séma eleve **tenant → N-user**
  (későbbi al-user, pl. recepciós, migráció nélkül).
- **Sorrend (visszafordíthatóság-címkével, egy szál egyszerre):**
  ① 🔄 **Központi dizájn-mag** (`--citui-*` + alap-CSS + komponensek) — mindent felold, tiszta CSS.
  ② 🔄 **Publikus honlap** — bespoke, a magra építve; login-gomb = placeholder.
  ③ 🚪 **Identitás + RBAC** — két-realm auth (users/roles/permissions/session séma + login-flow); itt lép be PII/RLS.
  ④ 🔄 **Belső konzol** ráhúzva a dizájn-magra + control-plane auth mögé.
  ⑤ 🚪 **Tenant-admin** önkiszolgáló szerkesztő (§E.12) + data-plane auth.
- **Elhatárolás / éles:** minden LOKÁLBAN épül; élesítés a tulaj-külső előfeltételekre vár (citoviso.com regisztráció
  + hoszting). A ③/⑤ auth-séma az első valódi tenant-PII → az RLS-kérdést a ③ szeletnél külön nyitjuk (§G.18).
- **Visszafordíthatóság:** ①②④ 🔄 (additív CSS/HTML/re-skin); ③⑤ 🚪 (auth-séma + PII) → lassan, rákérdezve.
- **Státusz:** ELFOGADVA (tulaj, 2026-07-31). Következő lépés: az ① dizájn-mag megépítése.

## ADR-0022 — Self-serve inbound auto-mock: honlap-igény → automatikus mock → e-mail (őr-kapuzott)

- **Kiváltó (2026-08-01, tulaj):** a honlap gerince a minta-igénylés; a leadott igényből **automatikusan generált
  mock kell, e-mailben kiküldve.** (A landing tartalmi finomhangolása külön, későbbi kör.)
- **Folyamat:** `honlap-űrlap → POST /api/mock-request → azonnali „megkaptuk" → (háttér) egy-vállalkozás feloldás
  (Places Text Search név+település, VAGY Maps-link→place_id) → generateEngineMock (meglévő motor, A4 kép/rating-kapu)
  → előnézet hosztolás token-URL-en (/m/:token) → ŐR-KAPUK → e-mail a kérőnek (link + „kérem élesben" CTA).`
- **Kiküldés-politika (tulaj-döntés): ŐR-KAPUZOTT AUTO** (A2/A4). Magabiztos találat (match-konfidencia ≥ küszöb)
  + dizájn-doktrína PASS + demo-framing PASS → **automatikus küldés**. Bizonytalan találat vagy bármely FLAG →
  `needs_review` (kurátor-sor), NEM megy ki vakon. Így a többség automata, de nem küldünk félre-azonosított/rossz mockot.
- **Épített darabok (mind interfész mögött, a Barion/Számlázz build-behind-an-interface mintára):**
  - `mock_request` tábla (0010) — állapotgép: `received→resolving→generating→sent | needs_review | failed`; token az előnézethez.
  - `src/scraper/resolveOne.ts` — egy hely feloldása (Places Text Search / place_id) → `QualifiedLead` + match-konfidencia.
  - `src/email/` — **EmailSender interfész + Mock-adapter** (lokálban `outbox/*.eml`-be írja a levelet) → valódi SMTP
    env-kapcsolóval (`EMAIL_PROVIDER=mock|smtp`). Ma NINCS SMTP-fiók/küldő-domain → a Mock-adapter fut (end-to-end tesztelhető).
  - `src/intake/mockRequest.ts` — az orchestrátor (fire-and-forget háttér-feldolgozás, a konzol generate-mintájára).
  - `src/server/public.ts` — Node http szerver: `public/` statikus + `POST /api/mock-request` + `GET /m/:token`
    (leváltja a fejlesztői python statikus szervert; ugyanúgy folyamatosan fut :4800-on).
- **Külső blokkolók (tulaj, a build ettől függetlenül kész):** valódi e-mail-küldés (SMTP-fiók + küldő-domain);
  publikus hoszting (az e-mailes előnézet-link egyelőre a Tailscale/preview URL — a tulajnak működik, kívülről a hoszting után).
- **Jog/GDPR:** ez **inbound, kért** megkeresés (a tulaj maga kéri a mintát) → a hideg-outreach §C-kapunál lényegesen
  enyhébb; az adatkezelési tájékoztató (/adatvedelem) linkelendő az űrlapnál. A mock provenance §A: demo-framing megmarad.
- **Visszafordíthatóság:** 🔄 additív (új tábla + új modulok + új szerver); a python→node szerver-csere könnyen visszavonható.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-01). Impl. folyamatban.

## ADR-0023 — Pilot-kritikus út: tenant-belépés + minimál admin ELŐBB; a belső 6-szerepkörös RBAC halasztva

- **Kiváltó (2026-08-01, tulaj):** a pilot cél = ~100 hideg megkeresés (scraper) → mérni, miből lesz vásárlás →
  a vevő a **fizetés után be tud lépni a saját admin felületére**. A teljes loop átgondolásakor a hiányzó lánc-elem
  (§7d/#9) a **vásárlás utáni tenant-belépés + önkiszolgáló admin** — ezt építjük előbb.
- **Scope-döntés (ADR-0021 sorrend felülírása a pilotra):** a pilothoz a **TENANT (data-plane) belépés** kell,
  NEM a teljes belső 6-szerepkörös RBAC (③). Indok: a belső oldalon egyetlen operátor (a tulaj), Tailscale mögött →
  a granuláris belső RBAC a pilotra **túllövés, elhalasztva** (a séma-terv marad ADR-0021-ben). Amit építünk:
  minimál tenant-auth + önkiszolgáló szerkesztő.
- **Auth-mechanizmus (🚪 döntés): MAGIC-LINK** (jelszó nélküli, e-mailes belépő-link) — a nem-technikai tulajnak a
  legjobb UX (nincs jelszó/reset), és már van e-mail-küldőnk (ADR-0022 EmailSender; lokálban outbox, élesben SMTP).
  Session = aláírt cookie (HMAC, tenant_user_id + lejárat). Egy-használatos, lejáró login-token DB-ben (visszavonható).
- **Tenant-user modell:** egyelőre **1 login / tenant** (a tulaj e-mailje), de a séma `tenant_user` → N-user
  (ADR-0021 4. döntés; recepciós al-user később, migráció nélkül).
- **Minimál admin (§E.12 első szelet):** A1 = belépés + dashboard (oldal-állapot + előnézet-link) + **alap
  szöveg-szerkesztés** (tagline/intro) → újrarender (renderSite a perzisztált recipe + szerkesztett siteData-ból,
  mock=live megőrizve). A2 = **saját fotó feltöltés/csere** (§A élesítési jog-követelmény: a demó Places/StreetView
  kép élesre nem mehet — a tulaj saját képe váltja) + modul-kezelés. A recept-szerkesztő (ADR-0016 ⑤) későbbi.
- **Hol fut:** a tenant-admin a **publikus szerveren** (:4800, data-plane): `/belepes` (e-mail → magic-link),
  `/belepes/verifikacio` (token → session), `/admin` (session-védett). A belső konzol (:4600, control-plane) külön marad.
- **Külső blokkoló:** a magic-link éles kézbesítése SMTP-t igényel (tulaj); lokálban a mock-adapter az outbox-ba írja a linket.
- **Visszafordíthatóság:** 🚪 (auth + tenant-PII: e-mail, session) → körültekintően; a séma additív, a magic-link cserélhető jelszóra.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-01). Impl: A1 (belépés+dashboard+szöveg-szerkesztés) → A2 (fotó+modul).
- **MÓDOSÍTÁS (tulaj, 2026-08-01) — auth-mechanizmus: magic-link → KIADOTT, MEGJEGYEZHETŐ JELSZÓ.**
  Indok: a célszegmens (nem-technikai helyi vállalkozó) számára a magic-link kényelmetlen (minden belépésnél
  e-mail + link-keresés). Helyette: **MI generálunk egy fix, megjegyezhető jelszó-kifejezést** (pl.
  `kilato-levendula-47`), a tulaj a köszönő/vásárlási e-mailben megkapja, és **e-mail + jelszó** párral lép be
  (gyors, ismerős, ismételhető). A jelszót **hash-elve** tároljuk (`scrypt`, node beépített — nincs függőség).
  Elfelejtett jelszó → pilotra operátor-újragenerálás + újraküldés (A2); önkiszolgáló reset később. A `login_token`
  tábla marad a jövőbeli resethez. Session-cookie (HMAC) változatlan. `tenant_user.password_hash` (0012).
- **MÓDOSÍTÁS 2 (tulaj, 2026-08-01) — login-azonosító: e-mail → FELHASZNÁLÓNÉV + külön KOMMUNIKÁCIÓS e-mail.**
  Indok: mivel MI állítunk elő a tulajnak domaint + vállalkozói e-mailt, az ő e-mailje instabil/körkörös login-kulcs.
  Helyette: **felhasználónév** = stabil login-azonosító (MI generáljuk a vállalkozás nevéből, pl. `napfeny-panzio`,
  ütközésnél `-2`), a belépés **felhasználónév + jelszó**. A **kommunikációs e-mail** külön, változtatható mező
  (ide megy a jelszó/értesítés), a tulaj az adminban módosíthatja. Séma (0013): `tenant_user.username` (unique) +
  `email` → `contact_email` átnevezés. A felhasználónév stabil (operátor módosíthatja), a jelszó reset-elhető.

## ADR-0024 — Pilot-infra: Hetzner Cloud (CX23) + Cloudflare (registrar/DNS/for SaaS) + INWX (tenant-domain-API, később)

- **Kiváltó (2026-08-02, tulaj):** a pilot-indulás külső blokkolóinak feloldása — hoszting-döntés + citoviso.com.
  Fő kritérium (tulaj, A1-elv): **skálázható ÉS teljeskörűen API-vezérelhető** infra (minél kevesebb emberi
  interakció); tárat NEM előre veszünk, hanem igény szerint.
- **Tárigény-becslés (valós mérésből):** tenant-oldal HTML ~40 KB; domináns tétel a tulaj-fotó (nyersen 2–6 MB/kép,
  cap 24) → worst ~150 MB/tenant, kép-átméretezéssel ~10 MB/tenant. **100 tenant ≈ 2–15 GB** — a belépő VPS
  beépített tárja (40 GB) bőven fedezi; külön tárvásárlás nem kell. (Backlog: kép-átméretezés a feltöltésnél.)
- **Hoszting: Hetzner Cloud CX23** (2 vCPU / 4 GB / 40 GB NVMe / 20 TB forgalom, NBG1) — **€5,49/hó nettó**
  (~€7 bruttó; a 2026-06-15-i Hetzner-áremelés utáni ár; a CPX-vonal 2,4–2,5×-ösére drágult → kerüljük).
  Indok: teljes REST API + Terraform (provisioning/resize/volume/snapshot/backup/firewall mind programból);
  óraalapú számlázás; CX33-ra (8 GB/80 GB, €8,49) API-ból percek alatt átméretezhető; Volume €0,044/GB/hó
  utólag. EU (német) adatközpont, GDPR OK. **Primary IPv4 kell** (IPv6-only szerverről a GitHub elérhetetlen).
  Elvetve: magyar szolgáltatók (nincs teljeskörű API), DO/Vultr (~2× ár), PaaS (drágább, kevesebb kontroll).
- **Domain + DNS: Cloudflare.** citoviso.com a Cloudflare Registrarnál **MEGVÉVE (2026-08-02)** (önköltségi ár,
  ~11–12 $/év). DNS + wildcard `*.citoviso.com` (korlátlan aldomain-tenant ingyen) + **Cloudflare for SaaS** a
  későbbi egyedi ügyfél-domainekhez (automata TLS; első 100 custom hostname ingyen, utána $0,10/hó/db —
  beépíthető az egyedi-domain upsell árba). Minden API-ból (DNS-rekordok, custom hostnames).
- **Tenant-domain-vásárlás (ADR-0020 nyitott tétele LEZÁRVA): INWX** (német ICANN-regisztrátor) — teljes
  purchase-API (JSON-RPC), 2200+ TLD **köztük .hu valós idejű regisztrációval** (a legtöbb API-s regisztrátor
  .hu-t nem tud), reseller-ár belépő nélkül. Flow: konfigurátor-csekk (domains.ts) → INWX-API vétel → NS a
  Cloudflare-re → for SaaS TLS. **NEM pilot-blokkoló**: integráció-trigger = az első egyedi-domain rendelés
  (addig A2 kézi). citoviso.hu (védelem) szintén INWX v. magyar regisztrátor.
- **Postafiók-irány (tulaj-megkötés: Google KIZÁRVA):** Zoho Mail Lite (~1 $/fő/hó, saját domain + SMTP/IMAP +
  DKIM; a free csomag SMTP nélkül NEM elég). Alternatíva: Migadu/Fastmail. Beszerzés a domain-DNS beállítása után.
- **Pilot-infra összköltség: ~€7-8/hó bruttó** (CX23 + 20% backup + Cloudflare free + Zoho ~1$).
- **Visszafordíthatóság:** 🔄 könnyű — statikus kimenet + Node + Postgres hordozható; a Cloudflare-réteg és a
  regisztrátor külön-külön cserélhető. Egyirányú elem nincs.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-02). citoviso.com megvéve; Hetzner-fiók regisztráció alatt.
  Következő: Hetzner projekt + API-token → szerver-provisioning API-ból → DNS → Zoho + SPF/DKIM → email-füst-teszt.

## ADR-0025 — Minőség-ív II.: a „bedobált" érzés = KOMPOZÍCIÓS hiány; a `Recipe` szótárának + az AI-brief bővítése (nem új motor)

- **Kiváltó (2026-08-06, tulaj):** az 5 art direction beportolása (ADR-0018/0019 folytatása) után jelentős a javulás,
  DE „még mindig bedobált szar-nak tűnik". Pilotnak elég, de a **globális méretű megkeresésekhez** kellő minőségtől
  még messze. A tulaj rendelete: a minőség-emelést visszük előre első körben (a styling külön sessionben).
- **Diagnózis (a KULCS):** eddig a modulok MINŐSÉGÉT és VÁLTOZATOSSÁGÁT (a részeket) optimalizáltuk. A „bedobált"
  érzés viszont a WHOLE tulajdonsága: a részek közti VISZONY, az oldal-szintű HIERARCHIA, és hogy az oldal REAGÁL-e
  a konkrét szállásra. Ezek kompozíciós, nem moduláris problémák → ezért nem oldotta meg az art direction sem
  (mindegyik önmagában is állandó ritmusú sáv-sorozat). Egy mondat: **amatőr hozzáad, profi elhagy és kiemel.**
- **Kód-gyökér:** a `Recipe` (recipe.ts) ma csak azt fejezi ki: MILYEN szekciók, MILYEN sorrendben, milyen `variant`/
  `copy`/`skin`/`archetype`. **NINCS szókincse** a szekciók SÚLYÁRA, FÓKUSZÁRA, EGYMÁSHOZ VALÓ VISZONYÁRA. Az
  AI-tervező (`planRecipe` → `RECIPE_SCHEMA`) is csak ezt a szűk szótárt tölti.
- **A döntés — egyetlen központi mozdulat:** bővítsük a `Recipe` szótárát + a hozzá tartozó AI-briefet (`RECIPE_SCHEMA`
  + `planRecipe` prompt, immár **vízióval** = a fotókat is látja). A `render` MARAD determinisztikus és a **mock=live
  garancia sértetlen** (a recept perzisztál, azonosan újra-renderelhető), a **§B.17/§I** sem sérül. Ez az ADR-0019-ben
  elvetett bespoke-AI-layout (B) helyett a „(C)" út: **ugyanaz a motor, sokkal okosabb brief** — NEM új motor, NEM
  stratégiaváltás (ADR-0016/0019 érintetlen).
- **A 7 levél → mechanizmus (impact × olcsóság priorizálva):**
  1. **Restraint-politika** — hideg mockban a minta-jelölt töltelék-szekciók (üres rooms/reviews/faq) KIESNEK;
     kevesebb, de valós-fedezetű, sűrű szekció. Nincs új render-kód (szelekció). Erősíti a §B.17-et ÉS a §I-t.
  2. **Fókusz-szekció** — `RecipeSection.emphasis?: "focal"|"normal"|"quiet"`; a brief a szállás #1 megkülönböztetőjét
     EGY szekcióra `focal`-ra teszi (renderer túlméretez, minden más lehalkul) → megöli a demokratikus egyformaságot.
  3. **Ritmus-súly** — az `emphasis`(+kind) hajtja a `padding-block`-ot/sűrűséget/háttér-váltakozást (ritmus-skála a
     konstans ~100px sáv helyett). Tiszta render-logika.
  4. **Határ-átfedés / interlock** — szomszédos szekciók közti „bleed" (átlógó kártya, negatív-margós fotó, közös
     háttér-mező, varratot átlépő stat). A LEGERŐSEBB kézműves tell. Bizonyíték: a `fullbleed-glass` üveg-sávja az
     EGYETLEN mai interlock, ezért érződik a legjobbnak. Legdrágább, de a legnagyobb „nem-sablon" hozadék.
  5. **Fotó-derivált paletta (§B.6)** — a `SiteData.palette.accent` mező MÁR LÉTEZIK, de a harmonizáló `engine/palette.ts`
     MÉG NINCS megírva. Kell: vízió-extrakció a briefben + akcent-hue a skin biztonságos sínjeire húzva (világos/sötét
     karaktert sosem borítva).
  6. **Szerkesztői fotó-szerepek** — `Photo.role?: "dominant"|"detail"|"mosaic"` → eltérő crop/méret. Determinisztikus.
  7. **Narratív copy-ív** — a `copywriter.ts` az oldalt EGY ívként írja (átvezető sorok), nem per-modul generikusan.
  (A 4. „aszimmetria"-tell részben már az `editorial-press`-ben él → több archetípusra általánosítjuk, nem külön munka.)
- **Központi fojtópont:** mind a 7 egyetlen helyen fut össze — `RECIPE_SCHEMA` + `planRecipe` prompt bővítése + a render,
  ami tiszteletben tartja. A briefnek LÁTNIA kell a fotókat (vízió) a fókusz/paletta/crop döntéshez.
- **ELFOGADOTT SORREND (tulaj, 2026-08-06) — a styling-session ebből indul:**
  1. **① restraint + ② fókusz** együtt (a „bedobált→megtervezett" érzés ~60-70%-a, olcsó).
  2. **④ interlock** (a maradék rés legnagyobb egyedi darabja).
  3. **③ ritmus + ⑤ paletta + ⑥ crop** (kohézió-réteg). + ⑦ copy-ív folyamatosan.
- **Visszafordíthatóság:** 🔄 könnyű — additív recept-mezők (mind opcionális → régi receptek változatlanul renderelnek,
  mock=live megőrizve); a render determinisztikus marad. Egyirányú elem nincs.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-06, deliberációs session). Implementáció a KÖVETKEZŐ (styling) sessionben.
  Mérce változatlan: `assets/design-refs/reference-quality/` (ADR-0018). Kiküldés-kapu: `tenyhuseg-or` + `dizajn-doktrina-or`.

## ADR-0026 — Webes keresés backend: BRAVE SEARCH (a Google CSE zsákutca; a Bing API halott)

- **Kiváltó (2026-08-07):** a honlap-felderítés bekötésekor tévedésből a Google CSE-re építettem,
  holott a döntés 2026-07-07/11 óta megvolt — de CSAK session-jegyzetben
  (`_planning/memory/2026-07-07_presence_detection.md`), **nem ADR-ként**. A tulaj jogosan reklamált:
  ekkora projektnél a döntés ADR-be való, különben elsikkad és újra eldöntjük (rosszul).
  **Ez az ADR a jegyzetben rögzített döntés formalizálása, nem új döntés.**
- **Külső táj (kikutatva 2026-07-07):**
  - **Bing Web Search API: HALOTT** — a Microsoft 2025-08-11-én lekapcsolta.
  - **Google Programmable Search „entire web": KIVEZETÉS ALATT** — új PSE már nem kaphatja meg,
    a meglévők **2027-01-01-ig** élnek → nem szabad rá építeni. (Ráadásul a mi projektünkben a
    Custom Search API be sincs kapcsolva: 403.)
  - **Brave Search API**: független index, olcsó, nincs „site restriction" csapda. → **EZ A VÁLASZTÁS.**
- **Architektúra:** `sources/webSearch.ts` = **diszpécser egy interfész mögött** — Brave elsődleges
  (`BRAVE_API_KEY`), Google CSE csak LEGACY fallback (azoknak, akiknek még van entire-web joguk),
  backend nélkül üres eredmény, de **HANGOS** naplóval. A hívók (`enrichSiteSearch`, `enrichWebSearch`)
  a backendet nem ismerik. Backend-csere = egy adapter, nem pipeline-átírás.
- **⛔ A csendes degradáció TILOS (vérrel tanult):** a CSE 403-at eddig üres találatlistaként nyeltük el
  → valós honlappal bíró leadek „nincs honlapja"-ként mentek tovább. Egy ilyen leadnek azt írni, hogy
  „nincs honlapja", **hitelesség-romboló** (§F). Ezért minden backend-hiba hangosan naplóz (egyszer/ok).
- **⏱️ IDŐZÍTÉS (tulaj-döntés, 2026-07-11 — VÁLTOZATLAN):** a fizetős search-tail **akkor élesedik,
  amikor a KURÁTOR is automata.** Amíg ember kurál, ő elkapja a fals negatívot; a per-query költség
  csak automata kuráció + volumen mellett térül meg. Addig a 0-API domain-guess (fordított
  token-sorrenddel is) viszi a farkat. A kód KÉSZ és bekötve, kulcs nélkül no-op.
- **A presence-réteg rendje (változatlan, §F.13–16):** Maps `websiteUri` → domain-guess + geo-szigorú
  HTTP-proba (0 API) → **web-search tail (Brave)** → mindegyik találat UGYANAZON a `verify()`-on
  (márka-mag ÉS régió kötelező; parkolt/portál kizárva) — **brand-only = kollízió, elvetendő.**
- **Visszafordíthatóság:** 🔄 könnyű — a diszpécser mögött a backend cserélhető (SerpAPI/Tavily/Exa
  ugyanígy beköthető), a hívók érintetlenek.
- **Státusz:** ELFOGADVA (a 2026-07-07/11-i tulaj-döntés formalizálva 2026-08-07-én).
  Kulcs-beszerzés (`BRAVE_API_KEY`) = tulaj-feladat, az élesítés az automata kurációhoz kötve.

## ADR-0027 — SABLON-ELŐSZÖR (template-first): a referencia-oldalak = teljes, adat-slotos oldal-sablonok; a vékony primitív-kombinatorika kikerül a mock-útból

- **Kiváltó (2026-08-08):** a tulaj élesben tesztelve három egymás utáni mockot kapott, amelyek
  (1) egyformák (az AI-tervező mindig meleg-krém skin + „masthead" — kép nélküli — hero-t választott)
  és (2) referencia-szint alattiak („téglalap-szövegek egymás után"). Gyökérok: az architektúra a
  kraftot a KÖZÖS, vékony primitív-készletre bízta, az archetípus pedig szerződés szerint CSAK
  elrendez (nem gazdagíthat) → akármit választ a tervező, ugyanazok a sovány dobozok jönnek ki.
  A referencia-oldalak ereje SZEKCIÓ-SZINTŰ kézműves munka, ami sosem került be a generáló útba.
  Bizonyíték, hogy a rés a modellben van, nem a képességben: ugyanabból a valós Fortuna-adatból
  kézzel megírt oldal (sites/_engine-proof/) referencia-szintű.
- **Döntés (tulaj, 2026-08-08: „csináld meg"):** a modell MEGFORDUL — nem a generikus kompozíciót
  próbáljuk kraftra tornázni, hanem a REFERENCIA-OLDALAK válnak teljes, adat-behelyettesíthető
  OLDAL-SABLONOKKÁ (`src/engine/templates.ts`). Egy sablon a SAJÁT teljes HTML+CSS-ét birtokolja
  referencia-hűségen (hero, üveg foglaló-sáv, mozaik, vélemény-sáv, lábléc — mind a sablonban él),
  és a `--cit-*` token-kontraktusból öltözik (skin-réteg + őr-kapuk változatlanul működnek).
- **Ami marad az AI-nak:** copy (brief + editorial copywriter — hang, nem tény) + fotó-akcentszín.
  A sablon- és skin-VÁLASZTÁS determinisztikus: sablononként kurált skin-lista, lead-név-hash
  szerinti szórással → a monokultúra (mindig ugyanaz a krém) determinisztikusan kizárva.
- **mock=live:** a recept `template` mezőt kap; `renderSite()` a template-ágon rendereli MINDKÉT
  fázisban (mock: jelölt minta-vélemények; live: §B.17 fázis-kapu — minta-tartalom kiesik,
  places-fotó a fotó-policy szerint kiesik → a hero fotó nélkül is áll). A perzisztált
  recept+adat páros determinisztikusan újra-renderelhető — a garancia változatlan.
- **Szeletelés:** 1. szelet = a 01-fullbleed-glass irány sablonja (`fullbleed`) mint alapértelmezett
  mock-út (fotós leadre); a kompozíciós út marad fallback (fotó nélkül / kurátori archetípus-override).
  Következő szeletek: a további 4 referencia (dark-luxury, card-sidebar, editorial, parallax) sablonná,
  majd az AI art-direction-választó a sablonok KÖZÖTT (nem a sablonon belül).
- **Visszafordíthatóság:** 🔄 könnyű — additív (`template` opcionális recept-mező; nélküle a régi
  kompozíciós út fut változatlanul; régi artifactok érintetlenek).
- **Státusz:** ELFOGADVA (tulaj, 2026-08-08). 1. szelet implementálva ebben a sessionben.

## ADR-0028 — A sablon-választás a KURÁTORÉ (nem AI-é) + kurátor-prompt a generálás előtt; tanuló-adat gyűlik

- **Tulaj-döntés (2026-08-08):** „Első körben a kurátor válasszon típust/sablont. Tudjon beadni
  promptot mock-generálás előtt. Egyelőre ezt nem bízhatjuk AI-ra. Majd tanuljuk."
- **Mit jelent:** (1) a mock-generálás art-sablonját (ADR-0027 flotta) a KURÁTOR választja a
  konzol lead-oldalán (select; alapértelmezés: fullbleed) — AI art-direction-választó NEM épül
  most; (2) a kurátor opcionális SZABAD-SZÖVEGES promptot adhat (hangvétel/hangsúly/célközönség),
  ami a brief-generátor és az editorial copywriter bemenetébe kerül — KIZÁRÓLAG hang-vezérlés:
  a §B.17 tényhűség-kontraktus a prompt tartalmára is áll (tényt a prompt sem adhat hozzá,
  a rendszer-promptok ezt explicit kimondják); (3) a beadott prompt az artifact
  `inputs.curatorPrompt` mezőjébe perzisztálódik → később tanuló-adat (melyik lead-típushoz
  milyen sablon/prompt vezetett konverzióhoz) az esetleges automatizáláshoz.
- **Flotta-bővítés ugyanekkor:** a tulaj 2 új referencia-irányt adott le (08-brutalism,
  10-dopamine-maximal → assets/design-refs/reference-quality/), ezek is sablonná válnak
  (brutalism, dopamine) — a kurátor 7 irányból választ.
- **Visszafordíthatóság:** 🔄 könnyű — a select/prompt additív form-mező; AI-választó később
  a gyűlt adat alapján bekapcsolható a kurátor felülbírálási jogával.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-08). Implementálva ebben a sessionben.

## ADR-0029 — Kurátor-eszközök a generálás előtt: sablon-előnézet (kattintásra nagyítható) + szerkeszthető lead-adat (hiányzó ÉS meglévő)

- **Tulaj-döntés (2026-08-08/09):** (1) amikor a kurátor sablont választ, jelenjen meg a típus
  minta-kinézete, kattintásra nagyítva; (2) a kurátor pótolhassa a hiányzó ÉS javíthassa a
  meglévő lead-adatot (elérhetőség, honlap, cím, név) a mock-generálás előtt.
- **Előnézet:** minden art-sablonhoz statikus minta-kép (`public/assets/ui/tpl-<id>.jpg` kártya +
  `tpl-<id>-full.jpg` lightbox), a VALÓS motor-kimenetből renderelve (Fortuna-adattal,
  `scripts/shot-previews.mts`) — a kurátor azt látja, amit a motor tényleg ad, nem absztrakt ikont.
  A lead-oldali select `onchange` cseréli a kártyát; kattintásra teljes-oldalas lightbox.
- **Adat-szerkesztés:** a lead kontakt/elérhetőség mezői a `raw` JSON-ban élnek (`loadLead` →
  `QualifiedLead`), így a `saveLeadEdits` (data.ts) oda ír — a scrapelt eredetit EGYSZER
  `raw.scrapedContact`-ba menti (audit), `raw.curatorEditedAt`-et bélyegez, a `name`/`address`
  oszlopot szinkronban tartja. A javított érték a KÖVETKEZŐ mock-generáláskor érvényesül
  (a motor a raw-ból dolgozik). Üres mező = törlés; részleges szerkesztés OK.
- **Jog/§A megjegyzés:** a kurátor általi kontakt-javítás legitim operátori művelet; az eredeti
  scrape-érték auditban megmarad. (Provenance-tábla source="curator" bejegyzés későbbi szelet.)
- **Visszafordíthatóság:** 🔄 könnyű — additív (raw-alkulcsok + statikus képek + form-mezők);
  a scrapelt payload többi része érintetlen, a régi leadek változatlanul renderelnek.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-09). Implementálva ebben a sessionben.

## ADR-0030 — Outreach csatorna-választás: e-mail (valódi) + SMS (placeholder, GSM-modul később)

- **Tulaj-döntés (2026-08-09):** a megkeresés kiküldésénél lehessen csatornát választani — e-mail
  VAGY SMS. Az SMS mögé később GSM-modul kerül; MOST placeholder.
- **Implementáció:** az outreach-piszkozat oldal (`/prospect/:id/draft`) „Küldési csatorna" blokkot
  kapott két kártyával: **E-mail** (a meglévő, valódi pipeline-küldés SMTP-n, §C-kapuval) és **SMS**
  (rövid, §C-hű szöveg: `renderSmsDraft` — személyre szabott + feladó + leiratkozó-link). Az SMS
  „Küldés" gomb (`POST /prospect/:id/send-sms`) EGYELŐRE PLACEHOLDER: csak `sent`-re jelöli a
  prospectet (H1-mérés indul), **valódi SMS nem megy ki**, a felület ezt explicit kiírja. Telefonszám
  nélkül a gomb tiltva (a szám a lead „Begyűjtött adatok" panelen szerkeszthető). §C-FLAG esetén
  egyik csatorna sem küldhető (a link/opt-out mindkettőn elérhető kell legyen).
- **A „Kiküldve — mérés indul" gomb** (meglévő) = KÉZI küldés jelölése: ha a kezelő saját
  postafiókból/telefonról küld, ezzel jelzi „elküldtem" → a H1-tölcsér (sent→opened→engaged→order)
  onnan méri; maga nem küld semmit.
- **Visszafordíthatóság:** 🔄 könnyű — additív (új route + nézet-blokk + SMS-drafter); az e-mail út
  változatlan. A GSM-transport bekötése egy későbbi szelet, a `send-sms` route mögé kerül.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-09). E-mail: éles. SMS: placeholder, GSM-modulra vár.

## ADR-0031 — Címzett e-mail megadható/módosítható a meglévő követett linken (az outreach-küldés csapdájának feloldása)

- **Kiváltó (2026-08-09):** a követett link „kapcsolati e-mail" mezője opcionális volt, üresen
  maradt; a pipeline-küldés viszont címzettet igényel → a piszkozat-oldalon nem jelent meg a
  „Küldés e-mailben" gomb, a kezelő nem tudta kiküldeni a levelet, és nem volt egyértelmű az ok.
- **Javítás:** a piszkozat-oldal (`/prospect/:id/draft`) E-mail-kártyájába bekerült egy cím-mező +
  „Cím mentése" (`POST /prospect/:id/contact-email` → `setProspectContactEmail`), így a MEGLÉVŐ
  linkhez is megadható/cserélhető a címzett — nem kell új prospectet létrehozni. Cím megadása után
  a §C-PASS mellett azonnal megjelenik a „Küldés e-mailben" gomb.
- **Visszafordíthatóság:** 🔄 könnyű — additív route + űrlapmező.
- **Státusz:** ELFOGADVA / implementálva (2026-08-09).

## ADR-0032 — Szabadon választható platform-aldomain + e-mail-modul + Citoviso-kredit a láblécben

- **Tulaj-kérés (2026-08-09):** (1) ha a tenant nem kér egyedi domaint, ajánljunk aldomaint a
  citoviso.com-on belül, de SZABADON megválaszthassa; (2) egyedi domainnél 2-3 SZABAD javaslat
  (ez már kész, ADR-0020); (3) legyen e-mail-modul (egyedi e-mail cím); (4) a citoviso.com jelenjen
  meg kattinthatóan a generált oldalon.
- **(1) Szabad aldomain:** a konfigurátorban a platform-aldomain LABEL-je szerkeszthető input, élő
  elérhetőség-ellenőrzéssel (`GET /configure/:id/subdomain?label=` → `checkSubdomainAvailable`:
  normalizál, ≥3 kar., fenntartott-lista, DB-ütközés). A választott host az `order_intent.domain_name`-be
  kerül (domain_type=citoviso_sub); a provisioning honorálja: `uniqueSiteSlug(name, preferred)` +
  `convertLead(..., preferredSlug)` + `activate()` átadja a rendelésből. Foglalt/rövid/fenntartott
  név → a submit tiltva (nincs bait-and-switch: amit választ, azt kapja, ha szabad).
- **(3) E-mail-modul:** `MODULE_CATALOG` új `email` tétel (Egyedi e-mail cím, extra/upsell, 390 Ft/hó).
  A tényleges postafiók-/forwarding-provision későbbi szelet (mint az SMS-transport) — ez az eladható
  entitlement.
- **(4) Citoviso-kredit:** `injectRuntime` egy finom, kattintható „Ezt az oldalt a Citoviso készítette —
  citoviso.com" csíkot fűz a lábléc alá, a mockon ÉS az élő tenant-oldalon (egy hely, minden sablon).
  Skin-független semleges színek. (Régi, már legenerált mockokon csak újragenerálás után jelenik meg.)
- **Visszafordíthatóság:** 🔄 könnyű — additív (új endpoint + opcionális recept/DB-mezők + modul-tétel +
  lábléc-csík); a régi út változatlan.
- **Státusz:** ELFOGADVA / implementálva (2026-08-09).

## ADR-0033 — A publikus honlap ára a valós árazásból renderel (régió-tudatos, §C-kapuzott)

- **Kiváltó (tulaj, 2026-08-09):** a citoviso.com árazása beégetve („100 € / évtől") élt a
  `public/index.html`-ben, a `/` útvonal nyers statikus fájlként küldte — semmi köze a valós
  ár-igazságforráshoz (`src/pricing.ts`). Kérés: kösse be a valós adathoz; a pénznem/ár legyen
  RÉGIÓ-érzékeny (adott régióra ha van ár → az, különben globális árlista).
- **Régió-modell:** a `pricing_config` singletonból RÉGIÓ-kulcsúvá vált (migráció 0020): egy sor
  piaconként, explicit `currency` mezővel. `hu` = HUF (3900 Ft/hó → 39 000 Ft/év), `global` = EUR
  fallback (~100 €/év). A meglévő HUF singleton a `hu` sorrá migrál; a `global` EUR sor seed-elt
  (nincs kód-EUR-default). Ismeretlen/hiányzó régió → `global`. NB: a `scraper` RegionTable
  (földrajzi bbox/kör scrape-területek) EZTŐL FÜGGETLEN — az ár-régió külön dimenzió.
- **Bekötés:** `pricing.ts` régió-tudatos snapshot-mappá bővült; MINDEN getter opcionális `regionId`-t
  kap, ami `hu`-ra default-ol → a HUF call-site-ok (konfigurátor, outreach, §C-kapu, manifest)
  VÁLTOZATLANOK. `resolvePricingRegion()` = `?region=` override → Cloudflare `CF-IPCountry` (`HU`→hu,
  egyéb→global) → `Accept-Language`. A `/` útvonal render-eli az `index.html`-t (nem nyers statikus):
  a `CIT_PRICE_BLOCK` markerek közé a snapshotból számolt árat teszi.
- **§C-kapu (Fttv.):** tiszteletben — ha a feloldott régió `pricing_confirmed=false`, a honlap
  „Egyedi ajánlat — kérd az ingyenes mintát" szöveget mutat, NEM konkrét árat. Következmény: amíg a
  tulaj nem véglegesíti régiónként, a szám nem jelenik meg (fail-safe, invariáns-hű).
- **Admin:** a konzol `/pricing` régió-választót kapott (HU/Globális, currency-tudatos mezők);
  `savePricing()` régió-paraméteres. A modul-felárak EGYELŐRE globális HUF-ok (csak a HU oldalon
  szerkeszthetők) — régió-scope-juk külön szelet.
- **Hatókörön kívül (flag):** modul-árak régió-scope; valódi HUF↔EUR árfolyam (a `global` EUR fix,
  nem konvertált); SEO/hreflang.
- **Nyitott:** a Cloudflare narancs-felhő ténylegesen továbbítja-e a `CF-IPCountry`-t az originig —
  élesítés előtt ellenőrizni; addig az `Accept-Language` + `?region=` fallback véd.
- **Visszafordíthatóság:** 🔄 könnyű — additív (új migráció + opcionális getter-param + render-út a
  `/`-on); a HUF call-site-ok érintetlenek.
- **Státusz:** ELFOGADVA / implementálva lokálban (2026-08-09); élesítés külön, scope-olt engedéllyel.

## ADR-0033 — nginx: a vevő-oldali konzol-útvonalak is a citoviso.com-ról a konzolra (:4600)

- **Kiváltó (2026-08-09):** a `citoviso.com` nginx-blokkja csak a `/p/`-t proxyzta a konzolra (:4600),
  minden mást a publikus szerverre (:4800). A vevő-folyam viszont a konzol több útvonalát is hívja
  a `citoviso.com`-on át (PUBLIC_BASE_URL=https://citoviso.com): `/configure/*` (domain-javaslat,
  aldomain-check, order-request), `/pay/*` (fizetőoldal + webhook + done), `/privacy` (§C-link).
  Ezek a publikusra estek → 404. Tünetek: „nem találtunk domain javaslatot", néma aldomain-check,
  404-es fizetőoldal, halott privacy-link.
- **Javítás (ÉLES, tulaj-engedéllyel 2026-08-09):** az `/etc/nginx/sites-enabled/citoviso` blokkba a
  `/p/` mellé bekerült `/configure/`, `/pay/`, `/privacy`, `/mock/`, `/site/` → `proxy_pass :4600`.
  `nginx -t` OK + `systemctl reload nginx`. Backup: `/root/citoviso.nginx.bak.<ts>`. Ellenőrizve:
  mind a fenti út 200 a `citoviso.com`-on át, a `/` továbbra is a publikusra megy.
- **Tanulság:** a backend (domain-javaslat, aldomain-check, pay) végig HIBÁTLAN volt — tisztán
  reverse-proxy routing-hiány. A PUBLIC_BASE_URL a konzol-kiszolgálta vevő-utakat feltételezi a
  citoviso.com-on; az nginx-nek ezt le kell képeznie.
- **Visszafordíthatóság:** 🔄 könnyű — location-blokkok eltávolítása + reload (backup megvan).
- **Státusz:** ELFOGADVA / élesítve (2026-08-09).

## ADR-0034 — Tenant-admin: menürendszer + önkiszolgáló modul-kezelés (a „gagyi egy-űrlap" leváltása)

- **Kiváltó (2026-08-14):** a fizető ügyfél admin-felülete egyetlen végtelen, menü nélküli űrlap volt
  (szövegek + fiók + fotók egymás alatt), a modulok pedig CSAK felsorolva, „bővítenél? írj e-mailt"
  szöveggel. A tulaj jogos ítélete: ezért a vevő visszakérné a pénzt.
- **Döntés:** a tenant-admin kap (1) valódi MENÜT — 5 szekció: Áttekintés · Szövegek · Fotók ·
  Modulok · Fiók (`/admin?tab=<id>`, pill-navigáció, mobilon vízszintesen görgethető); (2) ÖNKISZOLGÁLÓ
  MODUL-KEZELÉST: a tulaj maga kapcsolja be/ki a modulokat, látja a havi árat modulonként és az
  összesített díjat (alapdíj + aktív modulok), a gerinc (érdeklődés-CTA) zárolva „az árban" jelöléssel
  (`src/tenant/modules.ts`: getTenantModules/setTenantModules → module_entitlement); (3) ÁTTEKINTŐ
  szekciót: állapot, az oldal valódi publikus címe (csak `live` státusznál), aktív modulok száma és
  egy őszinte TEENDŐ-lista (saját fotó hiánya, rövid bemutatkozó, publikálás állapota).
- **Őszinteség:** a modul-váltás a KÖVETKEZŐ számlázási ciklustól érvényes, és az új szekció a
  következő közzétételkor jelenik meg — a felület ezt kiírja, nem sugall azonnali layout-változást
  (az élő oldal a recipe-ből renderel, az entitlement a számlázási igazság).
- **Visszafordíthatóság:** 🔄 könnyű — additív modul-réteg + nézet-refaktor; a mentő route-ok
  (/admin/text, /photos, /contact, /password) változatlanok.
- **Státusz:** ELFOGADVA / implementálva (2026-08-14).

## ADR-XXXX — Fordítás API-hívással TILOS: fordításra csak Bábel előfizetéses sessionje költhet

**Dátum:** 2026-10-27 · **Státusz:** elfogadva (lokál, nem élesítve) · Felülírja: ADR-0411 A4 + B3; ADR-0036 „AI-provisioned” része · Kiegészíti: ADR-0045 ③, ADR-0063, ADR-0207

### Kontextus

**A tulaj rendelete (2026-10-27, brief `b-bel-20261027-174040.md`):** „Ha Bábel a nyelvész felállt:
doktrína szinten, sőt kódszinten is ki kell venni, hogy a nyelvi fordításokat API-hívásokkal oldjuk meg!
TILOS! Csak Bábel előfizetői tokenjeivel lehet költeni fordításra! Bábel ráadásul kontextusban tudja
kezelni a fordítást!”

**Előzmény.** 2026-10-27 09:55–11:02Z élesen egy konzol-nyelvváltás (`sl`) 16 teljes API-csomagfordítást
indított: 2149 hívás, $130,03, két kredit-újratöltés (`translation_spend`). Az ADR-0411 erre Bábelt hozta
létre, de meghagyta a gépi „kezét” (`babel.ts` → Opus 4.8, plafon alatt): a deploy-deltát, az új nyelvet,
a súgót és a fizetett többnyelvű honlapot továbbra is az API fordította. A tulaj ezt az utat zárja le.

Mért állapot a döntéskor (élesen, olvasás): két élő nyelv, `en` és `sl`, mindkettő 5656/5656 felirat és
24/24 súgó-cikk; többnyelvű tenant 0.

### Döntés

1. **A kódban nincs fordító modellhívás.** Kivezetve: a `babel.ts` Anthropic-transzportja és `babelCall`-ja,
   a `packs.ts` `translateStrings`/`translateBatch`, a `kbPacks.ts` `translateEntry`, a
   `multilangGenerate.ts` `translateStrings`, a `budget.ts` (fordítási plafon — nincs mit plafonozni) és a
   `spend.ts` főkönyv-írója (a `translation_spend` tábla történeti adatként marad; a fájl csonkja a `public.ts` következő
   érintésével megy, mert annak booking-kapuja 2026-10-27-én a tiszta mainen is piros volt).
2. **Az egyetlen forrás Bábel commitolt magja**, amit a saját előfizetéses sessionjében, a teljes
   ontológia és a string felülete birtokában készít (`scripts/babel-pack.mts`):
   - UI-feliratok: `src/i18n/babel/packs/<nyelv>.json` (eddig is);
   - súgó-cikkek: `src/i18n/babel/kb/<nyelv>/<cikk>.json` — `{source_hash, title, body}`; csak akkor kerül
     a `kb_translation`-be, ha a `source_hash` a MOSTANI magyar forrásé és a szerkezet ép
     (`kbTranslationValid`);
   - fizetett többnyelvű honlap: `src/i18n/babel/sites/<site-id>/<nyelv>.json` — `{magyar: fordítás}`,
     szám-integritással (§B.17).
   Mind verzió: commit + land, élesre a deploy viszi (ADR-0053); kézi éles DB-írás nincs.
3. **`ensureLanguagePack` = a mag alkalmazása**, nem fordítás. A single-flight (folyamaton belül közös
   ígéret + nyelvenkénti advisory lock) marad, a gyors út: ha nincs alkalmazandó mag, nincs zár és nincs
   írás — a Bábel által még le nem fordított hiány NEM munka a kódnak.
4. **A hiány = magyar fallback + Bábel munkalistája.** UI: `tSync` hangosan magyarul pótol (a napló
   megnevezi a `babel-pack export` parancsot). Súgó: a régi fordítás szolgál, amíg Bábel az újat le nem
   adja. **Fizetett honlap:** a generálás `AwaitingBabelError`-ral („Bábelre vár … site-export …”) áll meg,
   félig magyar fizetett oldal nem készül; a figyelő (ADR-0118) újrapróbál, a sorozat végén az operátor
   riasztást kap az üzenettel, és Bábelnek adja.
5. **Deploy GATE 5** a magot teszi az éles DB-re (`i18n-pack-status --ensure`), és BUKIK, ha élő nyelven
   hiány marad — a hiányt Bábel fordítja (land → azzal a committal deploy), nem az API. Kiváltó most a
   `src/i18n/babel/` változása is.
6. **Őr: `scripts/no-api-translation-check.mts`, minden commitnál** (statikus, olcsó, önteszttel):
   ① a fordítás-terület (`src/i18n/**`, `src/tenant/multilang*.ts`, a fordító-szkriptek) nem ér modellhez
   (SDK, `messages.create(`, `api.anthropic.com`, `claude -p`); ② modellt hívó fájl sehol nem ad fordítási
   feladatot („Fordítsd…”, „… nyelvre fordít”, „translate … into”); ③ a kivezetett út
   (`budget`/`spend`/`babelCall`) nem tér vissza. A viselkedést az `i18n-single-flight-check` méri: a mag
   egyszer íródik, a kérés nem vár, mag nélkül semmi nem íródik, a hiány hiány marad.

### Elvetett alternatívák

- **Plafon alatti API-fordítás a résekre (ADR-0411 A4/B3):** a tulaj kifejezetten tiltja; a kontextus-vak
  adagok minőségi hibáit („Availability” a „Contact” helyett) sem a plafon javítja.
- **Bábel-session hívása a kódból (`claude -p` a szerveren):** ugyanaz a gépi út más kulccsal, kontextus
  nélkül, és a bypass-módú `claude -p` biztonsági kockázat (RC-doktrína, 2026-09-24). Tilos (őr ①).
- **Bábel éles DB-be importál:** minden javítás külön éles-írási engedély lenne (§0.3), és a „mi fut
  élesen?” nem lenne verzió.

### Következmények

- **Fordítási API-költség: $0.** A kódban nincs olyan út, ami fizetne érte.
- **Új magyar felirat élesre csak Bábel után megy hiánytalanul:** a deploy kapuja bukik, ha az élő nyelven
  (ma `en`, `sl`) hiány marad. Ez szándékos: a koordinátor a deploy előtt Bábelt kéri a deltára.
- **Új nyelv** (piacnyitás, operátor-nyelv): amíg Bábel nem készíti el, a felület magyarul jelenik meg.
- **Fizetett többnyelvű honlap:** a vevő a fordításra Bábel munkájáig + egy deployig vár (ma 0 ilyen tenant).
  Ha ez a vevő-ígérettel ütközik, a kártya szövegét kell igazítani — tulaj-döntés, ha eljön.
- A dev szerverek bootja (`I18N_BOOT_TOPUP`) csak a magot alkalmazza vagy csak mér; API-t egyik mód sem hív.
- Nem érintett (nem fordítás, más döntés kell hozzá): a mock-szöveg célnyelven írása (ADR-0036 „a per-lead
  AI-szövegek a cél-nyelvet paraméterként kapják”, 2026-10-06 óta a kollégák írják), és a vendég-
  véleményekből kinyert állítás-címkék (`guestCritic`).

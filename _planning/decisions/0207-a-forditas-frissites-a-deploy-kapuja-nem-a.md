## ADR-0207 — A fordítás-frissítés a DEPLOY kapuja, nem a commité — és csak ha van mit frissíteni (2026-09-22)

**Kontextus — mérve, nem feltételezve.** Az ADR-0184 valódi kárra született: a szerző
szerkesztett egy súgó-cikket, lefordíttatta, majd MÉG EGYSZER hozzányúlt és azt már nem —
a `kbPacks.ts` pedig kimondja, hogy „a stale translation still serves", **magyar fallback
nincs**. A lengyel és a szlovák tulaj szó szerint a két frissen javított hibát olvasta.
A védelem ezért pre-commit kapu lett (`kb-translation-coverage-check`).

Két dolog azóta mérhetővé vált, és mindkettő azt mondja, hogy a kapu **rossz helyen áll**:

① **A kapu a DEV adatbázist méri, a kár az ÉLESBEN keletkezik.** A fordítások a
   `language_pack` táblában élnek; a dev és az éles két külön adatbázis. A commit-időben
   igazolt frissesség elvben sem mond semmit arról, mit szolgál ki az éles.

② **A deployban NULLA fordítás-lépés van.** Az egyetlen éles védelem egy boot-időben
   induló `void (async () => …)` önjavítás (`public.ts`, `console/server.ts`): nem várja
   meg senki, a bukását nem ellenőrzi senki, és *a forgalom megindulása után* fut — a
   deploy utáni percekben (mérve ~18 AI-hívás) a vevő a régi szöveget kapja, miközben a
   deploy már „✅"-t írt.

③ **A commit-kapu repó-széles, ezért párhuzamos szálakat bénít.** A `language_pack` tábla
   KÖZÖS a worktree-k között, a KB magyar forrásfájljai viszont fánként KÜLÖN élnek — a
   tábla a magyar forrás lenyomatát tárolja, így két aktív fa fordítás-gyorsítótára
   **kölcsönösen érvényteleníti egymást**. Mérve 2026-09-22: két szál egyike sem tudott
   zöldre menni, amíg a másik dolgozott; a számok futásról futásra romlottak (`de` 17/19 →
   16/19), és az én commitom idegen szálak félkész szócikkein (`admin-modules`,
   `admin-modules-rooms`) bukott, nem a sajátomon. A kivárás ~2,4 USD ismételt
   fordítás-körbe került, ugyanazért az eredményért.

**Döntés — a védelem oda kerül, ahol a kár van, és csak akkor fut, ha van mit védeni.**

1. **Commit-idő: DIFF-SZŰKÍTETT.** Csak azok a súgó-cikkek kell frissek legyenek, amiket
   AZ ADOTT COMMIT módosít. ⭐ Az ADR-0184 forgatókönyve ettől NEM sérül: az a saját
   szerkesztésről szól, tehát a saját diffben van, tehát a szűkített kapu ugyanúgy elkapja.
   Amit elveszítünk, az kizárólag az IDEGEN commit miatt elavult cikkek blokkolása — és azt
   a deploy-kapu fogja el, mielőtt bárkihez eljutna.

2. **Deploy-idő: ÚJ, BLOKKOLÓ kapu az ÉLES adatbázison** — megvárt, visszaellenőrzött.
   Itt egyetlen fa van és nincs versenytárs, tehát a kérdés egyértelműen eldönthető.

3. **⭐ De csak ha van mit frissíteni: TARTOMÁNY-SZŰKÍTETT.** A kapu a `PROD_SHA..SHA`
   diffet nézi, és ha abban nincs fordítás-releváns változás (`kb/entries/**`,
   `src/i18n/catalog.json`), **hangosan kihagyja magát** — pontosan úgy, ahogy a GATE 1c
   már ma is teszi („nincs KB-releváns változás a tartományban ✓"). Egy kód-only deploy
   nem fizet AI-költséget és nem vár fordításra. ⛔ A vakon futó kapu nem „biztonságosabb":
   pénzt és időt éget olyan deployokon, ahol egyetlen szó sem változott.

4. **Boot-idő: háló marad, de HANGOS.** Az önjavítás maradhat, de a bukása nem nyelhető
   el némán — a „nem tudtam megmérni, ezért zöld" ág pontosan az a hamis bizalom, ami
   idáig vezetett.

**Következmény.** A költség N commitról egy deployra esik; a párhuzamos szálak nem
blokkolják egymást; és az éles kiszolgálás **először** kap valódi kaput. Vállalt csere: a
`main` átmenetileg hordozhat olyan súgó-cikket, aminek a fordítása elavult — ez nem árt
senkinek, mert a `main` nem szolgál ki vevőt; a deploy-kapu viszont nem engedi élesre.

**Módosítás 2026-09-23 (tulajdonosi döntés) — a commit-kapu teljesen kikerül.**
A diff-szűkített commit-kapu sem volt versenymentes: a `kb_translation` sor (entry, lang)
kulcsú a KÖZÖS dev-DB-ben, a magyar forrás fánként külön él, tehát ha két fa UGYANAZT a
cikket szerkeszti, egymás fordítását írják felül. Mérve 2026-09-23 (`admin-modules`): a
`kb-translate` per-nyelv „✅ teljes" sorát a futás saját záró visszamérése cáfolta
(`en 18/19 ⛔`), a land hat körön át várt rá, és minden kör AI-költség volt egy vevőt nem
kiszolgáló adatbázisra. A tulaj kérdése: „addig mindenki gyűjti a cuccát, kinyomja a
mainbe, és a main megy a productionbe — és abban a pillanatban fordítunk".
- **Commit:** fordítást NEM kér. Ha maga az őr változik, a hermetikus `--self-test` fut
  (DB nélkül) — a deploy ugyanezt a szkriptet hívja, az épségét itt kell igazolni.
- **Deploy (GATE 5):** változatlan, és ez az EGYETLEN kényszer. Az ADR-0184 esetét
  (szerkeszt → fordíttat → újra szerkeszt) ez is elkapja, mert a kimenő forrásból dönt.
- Elvetve: `source_hash` a sor kulcsában — adatmodell-változás egy olyan problémára, ami a
  kapu áthelyezésével megszűnik.

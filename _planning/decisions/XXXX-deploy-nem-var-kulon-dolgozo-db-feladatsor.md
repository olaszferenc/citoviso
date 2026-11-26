## ADR-XXXX — A deploy nem vár futó munkára: a hosszú munka külön dolgozóban, DB-feladatsorból, folytatható lépésekben

- **Dátum:** 2026-11-26 (este)
- **Státusz:** elfogadva — tulaj: „a deploy prioritást élvez” (11-26), az 1+2 változatot jóváhagyta („elfogadom”). **1. lépés landolt: a felderítés / scrape.** A többi hosszú munka (mock-generálás, szöveg-újraírás) a következő lépés.
- **Forrás:** tulaj (koordinátor `citd231e4fd` briefjei: `~/rc-briefs/deploy-nem-var-scrape-tuleli-20261126.md`, `…-dolgozo-sor-20261126.md`); mérés: `scripts/scrape-restart-probe.mts`
- **Érinti:** `src/worker/{main,queue,resume}.ts` (új), `src/scraper/jobSpec.ts` (új), `src/scraper/{run,batchedRun,persist}.ts`, `src/console/{scrapeJob,scoutRoutes,server}.ts`, `src/scout/store.ts`, `migrations/0159_work_queue.sql`, `deploy/systemd/citoviso-worker.service` + `targets.json`, `scripts/deploy-prod.sh` (GATE 4), őrök: `scripts/work-queue-check.mts`, `scripts/scrape-liveness-check.mts` ⑨, `scripts/i18n-single-flight-check.mts`

### A baj (mérve)
A felderítés / scrape a konzol **gyerekfolyamata** volt (`scrapeJob.ts` → `spawn("npx", …)`), a `citoviso-console` cgroupjában. A deploy `systemctl restart citoviso-console`-ja a teljes cgroupot megölte (mérve 2026-09-11, és újra 2026-11-26 a dev konzolon: a futó darab SIGTERM-et kapott, a csempe 8 sora `proc`-ban ragadt, **senki nem folytatta**). A folytatás (`onExit`, csempe-újranyitás) a konzol memóriájában élt. Ezért a deploy GATE 4-e futó scrape mellett **megállt** („várd meg a végét”), ez volt a „mindig várni kell valamire” forrása (11-26 este a horvát felderítés miatt nem lehetett élesíteni).

### A döntés
1. **Külön dolgozó** (`citoviso-worker.service`, `Restart=always`): a hosszú munkát egy DB-feladatsorból (`work_job`) futtatja. A konzol csak sorba tesz (`/scrape/start`, csempe-lezárás) és állapotot olvas (`work_job.log`). **A konzol-restart a dolgozót nem érinti.**
2. **A deploy csak jelez:** a kódcsere (checkout, npm install, migráció) ELŐTT kiteszi a `/opt/citoviso/DEPLOYING` jelzőt. Ettől kezdve új darab nem indul, a futó darab a **következő adaghatáron** megáll (minden kész adag mentve, exit 75), a jelző levétele után a dolgozó kilép, a systemd az **új kóddal** indítja, és az a DB-ből folytat. **A deploy erre nem vár.** A félig cserélt fán induló run.ts megszakítottnak jelöli magát és kilép.
3. **Folytatható, kis lépések:** a futás a saját során leírja magát (`scrape_run.job`: régió, csempe, cap, próbálkozás, melyik futást folytatja), bárki indította (a dolgozón kívüli ssh-szkript futását is a dolgozó veszi át). Egység = egy csempe (felderítés) / egy adag (scrape: 500 lead, ADR-0331 checkpoint). Idempotens: a store-dedup a mentett adagot átugorja, a csempe-zárás minden sort a bármelyik próbálkozásban kapott leadjéhez köt; a sorba tétel élő kulcsa (`dedupe_key`) kétszeri kattintásra egy munkát ad. kill -9 után az új dolgozó az árva jobot azonnal megszakítottnak jelöli (a futását is), és folytatja. Legfeljebb 5 próbálkozás, 6 órás ablak.
4. **GATE 4 = utólagos igazolás, nem várakozás:** a restart után méri, hogy a dolgozó él (`worker_state`, 30 mp-en belüli életjel), az új kódon fut (vagy a folyó lépését fejezi be, és a végén magától átáll), és minden, a jelzés óta megszakadt futást átvett — különben **PIROS**. Az invariáns („a deploy nem veszít munkát”) marad. `--ignore-scrape` kivezetve (megadva hibát ad).

### Igazolás (dev, 2026-11-26, `scripts/scrape-restart-probe.mts`)
- **Előtte** (régi kód, a fő fa konzolja): konzol-restart → a darab meghalt, 8 sor `proc`-ban, nem folytatódott (`dead`).
- **Utána:** konzol-restart → ugyanaz a run.ts pid él, a futás végigment · kill -9 a dolgozóra → az új dolgozó átvette, végigment · deploy-jelző → az 1/3 adagnál megállt, az új dolgozó folytatta. Mindhárom: minden sor lead, **0 duplikátum, 0 elveszett sor**.
- Őr: `scripts/work-queue-check.mts` (+ `--self-test`: a régi in-process spawn, a dedupe nélküli sorba tétel, a `once`-os jelkezelés és a várakoztató GATE 4 mind pirosra megy).

### Még nincs a dolgozóban (leltár, 2026-11-26)
Mock-generálás (`startGenerateRun`, `server.ts`; ~1–2 perc, csak memóriában, restartnál elvész), szöveg-újraírás (`recopyArtifact`, ~30–60 mp), a modem-utas MMS+SMS-pár (élesen `queue` mód → a relay időzítő viszi, biztonságos). Rövid / idempotens: hero-kép, jóváhagyási kép, nyelvi csomag. A következő lépés a mock-generálás saját job-fajtaként (egység = egy sablon).

### Visszafordíthatóság
🔄 — a konzol a régi `spawn`-t egy fájlban (`scrapeJob.ts`) cserélte sorba tételre; a dolgozó leállítható, a sor megmarad. A migráció csak bővít.

### Elvetett alternatívák
- `KillMode=process` a konzolon: a gyerek túléli, de a félig cserélt kódon fut tovább, és a konzol többi gyereke (Chromium) is szivárogna.
- Folytatás a konzolból (a szűk első változat): a munka a konzol-restartnál akkor is megszakad, csak utána folytatódik; a tulaj a külön dolgozót választotta.

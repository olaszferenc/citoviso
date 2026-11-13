## ADR-XXXX — Land egyszerűsítés: böngészős kapuk óránként az origin/mainen, egyszeri automatikus újrafuttatás

**Dátum:** 2026-11-13 · **Döntött:** a tulaj („nincs ez a landolási folyamat feleslegesen túlbonyolítva?” → „külön session javítsa a javaslatod alapján”) · **Kapcsolódik:** ADR-0052 (land), ADR-0227/0230 (párhuzamos futtató, gépi slot), ADR-0249 (tiszta-main próba), ADR-0268/0269 (csend-korlát), ADR-0276 (ház-riasztás), ADR-0432 (böngészős kapuk a land-re halasztva)

### Mi a helyzet (mérve 2026-11-12/13, CIT)
- A `scripts/land.sh` minden landnál a `hooks/pre-commit` teljes kapusorát futtatta a landolt diffre, a böngészős (Playwright) és időzítés-érzékeny kapukkal együtt.
- A dev-gép terhelése napközben load 15–30 (sok session és sok Chrome). Ilyenkor ezek a kapuk HAMIS PIROSAT adtak: `checkout-item-block-check`, `mock-trial-overlay-check`, `billing-checkout-check` TimeoutError (a TISZTA mainen is pirosak); `gate-runner-check` J forgatókönyv (8 s csend-korlát) rc=124, külön futtatva zöld; `lead-page-surface-check` és `lead-mobile-check` egyszer bukott, újrafuttatva zöld.
- Egy kész funkció (nem-nyitó utánkövető levél) emiatt 4 landon át nem jutott fel; a tulaj kivétellel engedte át.
- A tiszta-main próba „a mainen ZÖLD (0 s) ⇒ A TE VÁLTOZÁSOD BUKIK” ítéletet adott egy böngészős kapura, holott ott a kapu LE SEM FUTOTT (a próba a main futtatóját LAND_RANGE nélkül, commit-módban hívta, ahol az ADR-0432 a böngészős kaput halasztja).
- Szinte minden land rebase-ütközésen állt meg a `MEMORY.md` „Tények és döntések” szakaszában (párhuzamos sessionök egymás mellé írnak sorokat).

### Döntés
1. **Böngészős kapu a landot NEM blokkolja.** A futtató (`scripts/lib/gate-runner.mjs`) LAND-módban a böngészős kaput (forrásában `playwright`/`chromium`, ugyanaz a szabály, mint az ADR-0432-ben) nem futtatja, hanem hangosan kiírja („⏭ … NEM blokkol: óránként fut az origin/main-en”) — ez a landban a figyelmeztetés.
2. **Óránként futnak az origin/mainen:** `scripts/gate-hourly.sh` (systemd: `citoviso-gate-hourly.timer`, :40, dev gép) a legutóbbi zöld óránkénti futás óta landolt commitokon futtatja PONTOSAN ezeket a kapukat (`LAND_RANGE=<utolsó zöld>...origin/main`, `CIT_GATE_HOURLY=1`), egy saját, `~/wt`-n kívüli munkafában. Zöld → az alap előrelép. Piros → az alap marad (a következő óra a javítással együtt újranézi), és a ház riasztást kap a meglévő csatornán (`alertHouse`, az ADR-0276 levele) — piros-halmazonként EGYSZER.
3. **Kivétel — a landon is blokkol** a fejlécében `// gate-runner: land-blocking — <ok, ≥20 karakter>` jelölésű böngészős-szabályú kapu:
   - tartalmi kapuk, amiket a land nem engedhet át: `model-html-sanitize-check`, `booking-guest-xss-check`, `json-for-script-check` (biztonság/XSS) · `tenant-legal-check`, `consent-check` (jog) · `outreach-preview-check`, `prospect-framing-check` (§C megkeresés / demo-keretezés) · `internal-ref-check`, `hu-machine-form-check` (felületi szöveg; a hook `--fast` módja böngésző nélkül fut);
   - álpozitívak, amik csak EMLÍTIK a szót, böngészőt nem indítanak: `gate-runner-check`, `booking-maintenance-timetravel-check`, `elek-label-drift-check`, `registry-confirm-check`.
   - Minden más böngészős kapu (~120, a felület-elrendezés, mobil/asztali nézet, kontraszt, görgetés, checkout-folyamat, pl. `checkout-item-block-check`, `mock-trial-overlay-check`, `billing-checkout-check`, `lead-page-surface-check`, `lead-mobile-check`) óránkénti. Ok: ezek a FELÜLET kinézetét/időzítését mérik, terhelés alatt hamisan bukhatnak, és egy órás késéssel észrevett hiba olcsóbb, mint a megállított párhuzamos fejlesztés.
4. **Egyszeri automatikus újrafuttatás:** minden bukó kapu egyszer újrafut ugyanabban a fázisban, mielőtt piros. Zöld újrafutás = zöld, hangos „↻ ÚJRAFUTTATVA, ZÖLD” sorral, az első futás kódjával és kimenetével; statisztika a `<git-common-dir>/cit-gate-retries.log`-ban. Piros újrafutás = piros, mindkét futás kimenetével. Nem fut újra: időtúllépés (már 900 s csendet várt) és a csak-olvasó fázisban írni próbáló kapu (az amúgy is újrafut a ② fázisban). Kikapcsolás: `CIT_GATE_RETRY=0`.
5. **Tiszta-main próba:** a kaput a mainen KÉNYSZERÍTETTEN futtatja (`CIT_FULL_COMMIT=1`, `CIT_FULL_LAND=1`), és ha a futtató mégsem futtatta (üres `CIT_GATE_TIMES`), kimondja: „NEM FUTOTT LE — NEM DÖNTÖTT”. 0 s-os „zöld” többé nem ítélet.
6. **`MEMORY.md` union-merge** (`.gitattributes`: `/MEMORY.md merge=union`): a két oldal hozzáadott sorai mind megmaradnak, a rebase nem áll meg. Ár: egy mindkét oldalon átírt sor kétszer marad — látható, javítható.
7. **Mérés minden landnál:** a `land.sh` a végén kiírja a fázisidőket (rebase · tsc · kapuk) és a 10 leglassabb kaput.
8. A `gate-runner-check` J forgatókönyvének poolos csend-korlátja 8 s → 15 s (a tsx indulása terhelés alatt 8 s fölött volt; 15 < 20 s, a szívverés nélküli futtató így is piros).

### Amit NEM változtat
- A tartalmi kapuk (i18n, design-token, §C outreach, migráció, planning-index) változatlanul blokkolnak. A nem böngészős kapuk közül 44 fut szűrő nélkül minden landon; mind ≤ 20 s, hermetikus, a teljes repóra igaz invariánst mér (i18n, design-token, §A/§C, őrök) — ezeket szándékosan NEM szűkítettem (mért kapuidő-előzmény, 2026-11-13).
- Az ADR-szám visszavonása/újraosztása sikertelen landnál (ADR-0210) marad: olcsó, és a dupla szám ellen véd.
- Teljes régi kör kérhető: `CIT_FULL_LAND=1 bash scripts/land.sh`, commitnál `CIT_FULL_COMMIT=1`.

### Megvalósítás
`scripts/lib/gate-runner.mjs` (LAND/HOURLY mód, `land-blocking` jelölés, `runRetry`) · `scripts/lib/main-probe.mjs` · `scripts/gate-hourly.sh` · `scripts/gate-hourly-alert.mts` · `deploy/systemd/citoviso-gate-hourly.{service,timer}` + `targets.json` (dev) · `scripts/land.sh` (időmérés) · `.gitattributes` · 13 kapu fejlécében a jelölés. Őrök: `scripts/gate-runner-check.mts` (K bővítve, új L: újrafuttatás; 31 visszarontás), `scripts/main-probe-check.mts` (új ⑩: böngészős kapu a mainen tényleg lefut; 8 visszarontás).

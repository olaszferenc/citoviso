## ADR-XXXX — Gyorsabb commit és deploy: a böngészős kapuk a landen futnak, a súgóképeket csak bemenet-változáskor gyártjuk újra

**Dátum:** 2026-11-08 · **Döntött:** tulaj („kell minden bazdmeg??? … nincs ez kurvára túltolva?” → a cél jóváhagyva: a commitnál csak a gyors kapuk fussanak, a land változatlanul teljes, a deploy csak az érintett súgóképeket gyártsa újra; „ok egy subbal csináld meg”) · **Kapcsolódik:** ADR-0052 (land), ADR-0053 (deploy), ADR-0220 (súgókép-kapu), ADR-0227/0230/0265 (kapu-futtató), ADR-0260 (zöld-gyorsítótár)

**Kontextus.** Egy messenger-felület élesítése ~1,5 óra lett: commit ~10 perc, land ~10 perc, deploy ~10 perc, és minden elakadás után elölről. Két ok, mindkettő mérve (2026-11-08):
1. **Dupla kör.** A `hooks/pre-commit` (~57 érintett kapu) lefut a commitnál, és a `scripts/land.sh` a rebase után ugyanezt újra lefuttatja. A zöld-gyorsítótár (ADR-0260) csak akkor segít, ha a main közben nem mozdult, ~10 párhuzamos szálnál pedig szinte mindig mozdul. A kapuk mért futásidejének (`cit-gate-history.json`, 419 kapu, 8 060 s összesen) **78%-a (6 253 s, 146 kapu) böngészős kapu** (Chromium indul és renderel).
2. **Deploy GATE 1c/kép.** Minden deploy mind a 70 súgóképet újragyártotta és pixelre összevetette, akkor is, ha a tartomány egyetlen képernyőt sem érintett.

**Döntés.**
1. **Commitnál a böngészős kapuk a landre várnak.** Böngészős kapu az, amelynek a forrásában szerepel a `playwright` vagy a `chromium` szó. Ilyenkor a futtató (`scripts/lib/gate-runner.mjs`) commit-módban (nincs `LAND_RANGE`) nem futtatja őket, és hangosan kiírja: „⏭ N böngészős kapu a LAND-en fut, nem most: …”. A többi kapu (i18n, design-token, tsc nélküli gyors őrök, DB-s kapuk) változatlanul lefut a commitnál. A **land változatlan**: `LAND_RANGE`-dzsel MINDEN kaput lefuttat, a böngészőseket is, a teljes landolt tartományra (a branch összes commitjára). Így az `origin/main`-re nem kerül semmi kapu nélkül, és a „IGAZOLTAN FENT” garancia sem változik. Teljes kör a commitnál: `CIT_FULL_COMMIT=1 git commit …`. Ha egy kapu fölöslegesen kerül a landre (a szó csak egy kommentben szerepel), az csak később fut. Ha egy böngészős kapu nem ismerhető fel, az a commitnál marad, vagyis csak lassabb.
   ⛔ Ha egy kaput a hook CSAK commit-módban futtat (`[ -z "${LAND_RANGE:-}" ]` blokk, ma a felület-kapu), az nem lehet böngészős kapu, mert a land sosem futtatná. Ezt a `gate-runner-check` K forgatókönyve méri a valódi hookon, két visszarontással (a halasztás land-módban is → piros; a halasztás ki → piros).
2. **A deploy súgókép-kapuja csak a megváltozott bemenetű képet gyártja újra** (`scripts/lib/kb-shot-pass.mts`). Egy kép a bemenetei tiszta függvénye, ezt a determinizmus-próba (ADR-0220) igazolja. Ezért egy kép CSAK akkor marad ki, ha MINDEN bemenete bájtra azonos egy korábbi, ZÖLD összevetéséével:
   - a képnek átadott HTML (a checkout-útvonal és a `?v=` gyorsítótár-törő nélkül),
   - a kép interakciós paraméterei (kattintás, görgetés, elem),
   - minden fájl, amit a lap betöltött (megfigyelt kérések kikapcsolt böngésző-gyorsítótárral, ÉS a HTML-ben álló minden `file://` hivatkozás; a nem létező fájl „hiányzik” bejegyzésként, aminek hiányoznia is kell maradnia),
   - a gyártó és a beállás/összevetés kódja, a betű-pillanatkép, a playwright-core és a Chromium verziója, a rendszer-betűlista,
   - a commitolt PNG saját hash-e.
   Ha a lap bármit a hálózatról kért, a kép soha nem kerül a gyorsítótárba. Csak zöld összevetés tárolódik, képenként, akkor is, ha egy másik kép piros: a javítás utáni újrafutás így csak a még kérdéses képeket gyártja újra. Helye: `<git-common-dir>/cit-kbshot-pass/`, 30 nap után törlődik. **Teljes kör:** `deploy-prod.sh <commit> --full-kb-shots` (illetve `--kb-shot-gate <commit> --full-kb-shots`, vagy `kb-shot.mts --check-committed --full`). A determinizmus-próba sosem használja a gyorsítótárat.
   Hogy a kihagyott kép ne változtassa a következő kép állapotát, minden felvétel ugyanabból az állapotból indul: az egérmutató a (0,0) ponton áll, a localStorage, a sessionStorage és a sütik üresek, a böngésző-gyorsítótár ki van kapcsolva. Mérve: ezzel is mind a 70 kép pixelre egyezik a commitolttal, vagyis egyik kép sem függött az előző felvételtől.
3. **A brief eredeti ötlete helyett** („a deploy-tartomány view/CSS/seed-diffje alapján válogass”): a tartomány alapú szűrés a mért 14 deployból 13-nál a teljes kört adta volna, mert a kb-shot import-zárványa 289 `src/` fájl, és szinte minden tartomány érint egyet. A bemenet-ujjlenyomat pontosabb, és biztonságosabb is: nem kell megjósolni, mit érint egy fájl, mert a lap által ténylegesen betöltött bájtokat méri.

**Mérés (2026-11-08, Debian, 8 mag, load 5–7, más szálak is futottak; `CIT_GATE_CACHE=0`, hogy a zöld-gyorsítótár ne torzítson).**

| | előtte | utána |
|---|---|---|
| kis, nem-felületi változás commit-kapui (1 kommentsor a `src/console/approvalCopy.ts`-ben; 61 kapu) | **1:53** (`CIT_FULL_COMMIT=1`) | **0:50** (13 böngészős kapu a landre halasztva) |
| ennek az ADR-nek a saját commitja (hook + futtató + kb-shot; 68 kapu) | — | 1:01 (12 halasztva) |
| deploy GATE 1c/kép (`deploy-prod.sh --kb-shot-gate`) | **2:00** (mind a 70 kép újragyártva) | hideg (üres gyorsítótár): 1:22 · **meleg: 0:29** (64 kép kimarad, 6 újragyártva: a 3 partner-kép, amelyet külön gyártó készít, mindig, + 3 kép, amelynek a HTML-je futásonként más vagy nem tárolható) |

Egy felület-fájlt érintő commit (pl. `src/console/views.ts`) sokkal több böngészős kaput indít (2026-09-24: 98 kapu, ~15 perc). Ott a nyereség arányosan nagyobb, de ezt nem mértem, mert a felület-kapu (§2b) jóváhagyási token nélkül megállítja a mérő commitot. A land ideje nem változik (szándékosan, ez a garancia). A teljes lánc így: commit a gyors kapukkal, land egyszer a teljes körrel, deploy csak az érintett képekkel.

**Visszafordíthatóság:** 🔄 olcsó. A commitnál `CIT_FULL_COMMIT=1`, a deploynál `--full-kb-shots` adja vissza a régi viselkedést, a két szabály pedig egy-egy blokk a futtatóban és a kb-shotban.
**Elvetett:** (a) a commit-kapuk teljes kihagyása, mert a gyors őrök (i18n, token) a szerkesztés közelében hasznosak, és olcsók; (b) a lassú kapuk kézi listája, mert elavul, a böngészős szabály viszont önmagát tartja karban; (c) a kapu-előzmény (futásidő) szerinti halasztás, mert nem determinisztikus: ugyanaz a kapu terhelés alatt egyszer halasztva lenne, máskor nem.
**Státusz:** ✅ elfogadva, landolva. A `deploy-prod.sh` többi kapuja változatlan.

## ADR-XXXX — Párhuzamos kapu-futtatás: az olvasó kapuk Postgres-kényszerített csak-olvasó módban együtt, az írók utána sorban, és a land nem méri újra, amit a commit már megmért (2026-09-24)

- **Kiváltó (tulaj, 2026-09-24):** *„Megint nagyon sokáig fut”*, *„Jaaa már 98 kapu van????”* —
  majd: *„Indíts a javasolták szerint az őrökről egy külön szálat.”* (brief:
  `~/rc-briefs/pre-commit-gate-speed.md`). Feltétel: a kapuk SZÁMA és ÁLLÍTÁSAI nem csökkenhetnek.

**A mérés (2026-09-24, a 4 nagy felületi fájlt — `adminViews.ts`, `moduleConfigViews.ts`,
`bookingViews.ts`, `citui-admin.css` — érintő szintetikus diff, `LAND_RANGE`-dzsel, `bash -x`
időbélyeggel):** 77 kapu, **480 s, egymás után**, egy 8 magos gépen egy magot járatva.
- Medián 3,9 s/kapu; a kapuk harmada ~1,7 s, ami szinte csak indulás: a `npx tsx` önmagában
  ~1,8 s, ebből ~0,8 s az npm (mérve: `npx tsx` 1,84 s vs `node_modules/.bin/tsx` 1,05 s).
- A lassúak böngészős őrök (booking-offer 32 s, room-editor 30 s, season-year-price 27 s …).
- 14 kapu ír a közös dev-DB-be (mind saját, bélyegzett fixture-t szúr be — tenant, lead, site
  …); együtt ~186 s. A többi 63 csak olvas.

**Döntés**

1. **A hook szövege nem változik, a futtatás igen.** A `hooks/pre-commit`-ben az `npx`/`node`
   shell-függvény: a kaput nem futtatja, hanem feljegyzi (argv · a teljes környezet, benne a
   `PAYMENT_GATEWAY=mock` előtaggal · cwd · a pipe-olt stdin · a `[pre-commit] …` felirat ·
   elnémított-e a stdout-ja), és a hook végén a `gate_flush` a `scripts/lib/gate-runner.mjs`-sel
   futtatja le mindet. Így a `guard-wiring-check` és a `gate-output-check` sor-horgonyos
   felismerése érintetlen, és egy új kapu bekötése ugyanúgy néz ki, mint eddig.
2. **① fázis — párhuzamos, csak-olvasó.** Minden kapu `PGOPTIONS=-c default_transaction_read_only=on`
   mellett fut (a `pg` driver és a libpq is olvassa), tehát a Postgres maga utasít el minden
   írást — egy kapu sem írhat bele egy másik mérésébe. A `scripts/lib/gate-ro-preload.mjs`
   (`NODE_OPTIONS=--import`, a kapu által indított szerverek is öröklik) MINDEN elutasított
   írást feljegyez (SQLSTATE 25006), azt is, amit a kapu lenyel; a kimenetben a libpq-szöveget
   is keressük. Ugyanaz a szkript önmagával sosem fut együtt (`x --self-test` és `x` közös
   munkafa-kulcsú scratch-útvonalakon osztozik). Alapból 4 szál (`CIT_GATE_JOBS`); 6 szál
   csak 4%-ot hozott, a gépen ~10 session osztozik.
3. **② fázis — az írók sorban, normál módban, a többi UTÁN.** Aki az ①-ben írni PRÓBÁLT, annak
   az ítélete eldobva (egy be nem állított fixture-ön mérhetett zöldet), és itt újrafut —
   senkivel át nem fedve. A látott írók a `<git-common-dir>/cit-gate-writers` listára kerülnek
   és legközelebb egyből ide jönnek; ez csak rövidítés, egy új író a csak-olvasó elutasításon
   akad fenn. ⛔ Az írók egymással SEM futnak párhuzamosan: a közös táblákba szúrt fixture-jeiket
   a globális számlálós őrök látnák (`prospect-owned-check` verseny, mért).
4. **A land nem méri újra, amit a commit már megmért — de CSAK azonos bemenettel.** Egy kapu
   kimarad, ha 2 órán belül zölden futott PONTOSAN ugyanazon a fán + ugyanazon a teljes diffen
   (`git diff --binary` hash) + ugyanazzal az argv-vel, stdin-nel és környezettel (a zaj —
   `GIT_*`, `LAND_RANGE`, `PWD` … — kivéve). Kulcs csak akkor képződik, ha a munkafa = index,
   és követetlen fájl (a `sites/` és `assets/Temp` symlinken kívül) nincs. ⛔ Piros ítélet sosem
   tárolódik; a diffet vagy a módot olvasó kapu (`LAND_RANGE` / `--cached` / `git diff` a
   forrásában) sosem marad ki. A tipikus eset — egy commit, közben nem mozdult a main — így a
   landnál másodszor már nem fut le; ha a rebase BÁRMIT hozott, minden kapu fut.
   ⛔ Az a javasolt irány, hogy a land csak akkor fusson újra, ha az idegen commitok az ÉRINTETT
   fájlokat módosították, ELVETVE: egy kapu ítélete az import-gráftól függ, nem a trigger-
   listától — ez hamis zöldet adhatna.
5. **Soros menekülőút:** `CIT_GATE_JOBS=1` = a régi viselkedés (helyben, sorban), csak a
   `npx tsx` indulási költsége nélkül.
6. **Őr:** `scripts/gate-runner-check.mts` (a hookból KIVÁGOTT mechanika + a valódi futtató,
   fixture-kapukon, git-fixture-rel): öt forgatókönyv (zöld · bukások · soros · flush nélkül ·
   gyorsítótár), piros önteszt kilenc visszarontással. A hook EXIT-trapje bukást ad, ha a hook
   `gate_flush` nélkül érne véget (a feljegyzett kapu le nem futása = néma zöld).

**Eredmény (ugyanaz a 77 kapu, ugyanaz a diff):** 480 s → **266 s** (4 szál; 6 szállal 255 s),
minden kapu zöld, egyik sem maradt ki. A maradék ~70%-a a 14 író soros fázisa. Egy commit
landolása, ha a main közben nem mozdult: a kapusor másodszor gyakorlatilag nem fut.

**Nyitva:** az írók gyorsítása egyenként (közös szerver/böngésző-példány, vagy kimondottan
„saját fixture, globális számlálás nélkül” jelölés után párhuzamos író-sáv) — őrönként kell
auditálni, ezért nem ebben a körben.

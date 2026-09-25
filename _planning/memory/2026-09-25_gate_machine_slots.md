# 2026-09-25 — Gép-szintű várakozósor a kapu-futtatónak (ADR-XXXX)

**Kérés:** a tulaj két párhuzamos szálat nyitott a kapusorra („várakozósor szervező + 14 író kapu
auditja”); ez az első. Brief: `~/rc-briefs/gate-queue.md`. Előzmény: ADR-0227.

## A mechanika
- `scripts/lib/gate-runner.mjs`: a `run()` a kapu indítása ELŐTT gépi slotot kér
  (`flock` a `/run/lock/claude-gate-slots/<n>` fájlon, `n < CIT_GATE_SLOT_COUNT`, alapból 6;
  a könyvtár 1777, a fájlok 0644 — az MR user is használhatja, ha átveszi a futtatót; a `/tmp`
  a tmpfiles-takarítás miatt elvetve), a
  kapu kilépésekor elengedi. Mindkét fázis (① olvasók, ② írók) slot alatt fut; a ② fázis EGY
  slotot tart végig (első mérés: kapunként újra sorba állva 481 s lett a 14 író, szólóban ~170 s). Az ütemező
  (`pump()`) érintetlen — az író-sáv szála erre rebase-el.
- A holder: `flock -n -E 250 -o <slot> -c 'echo 1; exec cat'`; az `echo 1` = megvan a zár, a
  `cat` addig tart, amíg a futtató csöve él. A futtató halálával (kill -9) a cső zárul → `cat`
  kilép → a kernel elengedi a zárat. Nincs pid-fájl.
- Ha minden slot foglalt: körben `flock -w 1` egy-egy sloton (kernel-ébresztés; egész másodperc,
  mert a gép vesszős locale-ja a `-w 0.25`-öt elutasítja — az őr F forgatókönyve fogta meg), majd
  újra végigpróbál mindet. A kapu `CIT_GATE_SLOT_HELD=<n>`-t kap; egy alatta induló futtató nem kér.
- Menekülőutak hangosan: `CIT_GATE_SLOTS=0` / nincs `flock` / nem írható könyvtár → slot nélkül,
  kimondva. `CIT_GATE_JOBS=1` (a hook soros útja) érintetlen. Az összegző sor:
  `… (6 gépi slot, várt rá összesen N s)`.

## Őr
`scripts/gate-runner-check.mts` F forgatókönyv: két futtató EGY sloton — négy 1,2 s-os kapu,
nulla átfedés, mindkettő rc=0 (holtpont-teszt); a futtató `kill -9`-e alatt a slot 2 s-en belül
szabad; `CIT_GATE_SLOT_HELD` alatt nem zárol; `CIT_GATE_SLOTS=0` mellett ugyanúgy kapuz. A
fixture SESSION-PRIVÁT slot-könyvtárban dolgozik (`CIT_GATE_SLOTS=<out>/slots`), sosem a
valódiban. Piros önteszt: 9 → 11 visszarontás (slot-kérés ki · holder `sleep`, ami túléli a
futtatót).

## Mérés
Ugyanaz a szintetikus diff, mint ADR-0227 (4 felületi fájl + záró újsor, `LAND_RANGE`,
`CIT_GATE_CACHE=0`), 4 eldobható worktree-ben (`git worktree add --detach` + a
`rc-wt-prepare.sh` symlinkjei): M a mért, L1–L3 a terhelés (ugyanaz a hook, 3 s eltolással).
⚠️ A `booking-screen-check` MA pirosat ad a fixture hónapvégi ablakán (09-29 … 10-01, kézi
10-04: „a szobánál csíkos mind a három zárt nap — kapott: 2”) — ez a szál nem érinti, de a
land-okat ma elviheti; a mérés emiatt 69 kapuig ér (64 olvasó + 5 író), előtte/utána azonosan.

| futás (78 kapu, `booking-screen` kihagyva) | előtte (ADR-0229 előtti futtató) | utána (gépi slot, N=6) |
|---|---|---|
| egyedül, csendes gép | **274 s**, 301 s (zöld) | **281 s** (① 95 s · ② 186 s; slotra várt 1 s) — a másik, 344 s-os futás az előző kísérlet lecsengő terhelése alatt indult |
| a mért fa + 3 párhuzamos, ①-fázisú terhelő fa | 192 s **PIROS** (`help-collapse-check`: Playwright 30 s timeout — a taposás), 753 s zöld, 711 s zöld | 763 s zöld (① 279 · ② 481 s; a ② kapunként újra sorba állt — ezért lett a ② EGY tartott slot), majd 569 s **PIROS** a `room-editor-check` negatív kontrollján (220 ms-os átmenet közepén olvasott — a main azóta javította, cfc4e5db) |
| a mért fa + 3 terhelő fa, **idegen futtató nélkül** (0/45 minta), a VÉGSŐ futtató (író-sáv + slot) | — (nem mérhető: az idegen terhelés a mérés alatt végig futott) | **425 s zöld** (① 207 s; slotra várt 477 s a szálakon összesítve); a 7 terhelő futás mind zöld, 118–254 s |
| a terhelő fák (csak ① fázis) | 22 futás, **2 piros** (timeout · `programs-editor` fixture-ütközés két fa között: 28 program 14 helyett) | 15 futás, **0 piros** |

⚠️ A mérés zavart: a gépen a mérés 85–100%-ában IDEGEN (régi, slot nélküli futtatójú) CIT-sessionök
kapusora is futott (mintavételezve 10 s-onként), és az MR user kapusora sem vesz még részt — a
szemafor csak azokat fogja, akik már az új futtatót futtatják. Egy „utána” futás (after3) érvénytelen:
a saját takarításom (`rm -rf ~/.claude/cit-gate-slots`) futás közben vitte el a slot-könyvtárat a még
régi alapértékű másolat alól, és a futtató — helyesen, hangosan — slot nélkül folytatta.

## Eredmény
**Az egyedüli futás ideje nem változott** (274/301 → 281 s). **A szórás csökkenése NEM
bizonyított** ebben a mérésben (az egyetlen tiszta, idegen terhelés nélküli slotos futás 425 s a zavart
711–763 s helyett — egy minta, nem bizonyíték): a terhelt futás ideje 711–763 s előtte és utána egyaránt (a szemafor
munkamegőrző — az átbocsátást átosztja, nem növeli), a zavaró idegen terhelés mellett kevés a zöld
minta. Amit a mérés MUTAT: slot alatt a taposásból fakadó timeout-bukás eltűnt (terhelő futások:
2/22 piros → 0/15; a mért fa ① fázisa mindkét slotos futásban zöld), és a futtató kimondja, mennyit
várt. A ② fázis kapunkénti újra-sorbaállása mérten éheztetett (481 s vs ~186 s), ezért a szigorú sáv
egy slotot tart végig. A holtpont-, kill -9- és beágyazott-futtató-viselkedést az őr méri. N=6 mellett
a loadavg ~22 maradt (egy „kapu” = szerver + Chromium, ~3–4 futó szál), tehát az N valódi értékét
akkor érdemes mérni (4 vs 6), amikor már minden session — és az MR — az új futtatót futtatja.

## Tanulságok
- A `flock -w 0.25` ezen a gépen ÉRVÉNYTELEN (vesszős tizedes locale, rc=64) — a G forgatókönyv
  „a flock hibázott → slot nélkül folytatja” ágon fogta meg; egész másodperc (`-w 1`) kell.
- Az önteszt „szkript-kizárás ki” kontrollja loadavg ~24 alatt EGYSZER zöld maradt (a 700 ms-os
  kapu két node-indulása szétcsúszott); csendes gépen 3/3 piros → a kapu 2,5 s-ra emelve, nem
  a kontroll gyengítve.
- ⛔ `pkill -f "<saját szkript-név>"` a saját shellemet ölte meg (self-pkill csapda, megint); és a
  megölt szülő-szkript alól a `while [ -f RUN ]` terhelő ciklusok ÉLVE maradtak — pid/pgid szerint
  ölj, és a ciklus-jelzőfájlt vedd el előbb.
- A mérés zavarására a saját takarításom is képes: egy futás közben eltávolított alapértelmezett
  könyvtár (`rm -rf ~/.claude/cit-gate-slots`) egy egész mérési kört érvénytelenített.

## Fájlok
- `scripts/lib/gate-runner.mjs` (slot-szemafor a `run()` köré, összegző sor)
- `scripts/gate-runner-check.mts` (F forgatókönyv, privát slot-könyvtár, 2 új visszarontás)
- `hooks/pre-commit` (fejléc-komment: a gépi slot)
- `_planning/decisions/XXXX-gep-szintu-varakozosor-a-kapu-futtatonak.md` (új)

## Nyitva
- N=6 induló érték; élesben a `várt rá összesen` szám dönt (`CIT_GATE_SLOT_COUNT`).
- Az író-sáv (párhuzamos szál, `~/rc-briefs/gate-writer-audit.md`) ugyanezt a slotot kéri.
- `booking-screen-check` hónapvégi fixture-ablaka (nem ez a szál).

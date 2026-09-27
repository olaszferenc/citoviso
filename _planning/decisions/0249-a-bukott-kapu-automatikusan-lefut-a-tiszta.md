## ADR-0249 — A bukott kapu automatikusan lefut a tiszta origin/mainen is: „nem a te változásod” vagy „a te változásod” — és a kapu saját fixture-rel mér, nem a közös dev-DB véletlen sorával

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulaj: „Jó ötlet. Indítsd egy külön szálba.”) · **Kapcsolódik:** ADR-0171 (a bukás olvasható), ADR-0227 (párhuzamos kapu-futtató), ADR-0229 (író-sáv, `own-fixture-only`), ADR-0230 (gépi slotok), ADR-0052 (land)

### Kontextus
A `photo-normalize-check` (`ed651fdc`) a közös dev-DB „első tenant_user”-ével mért. Ez a Lidó volt,
egy egységgel, ezért a szoba-feltöltő (csak 2+ egységnél létezik, ADR-0198) meg sem jelent — a kapu a
**tiszta origin/mainen is piros** volt, és minden `src/server/adminViews.ts`-t érintő commitot
blokkolt. A diagnózis kb. fél óra volt: ideiglenes munkafa az origin/mainen, kézi újrafuttatás,
adat-lekérdezés. Közben a commitoló a saját diffjében kereste a hibát, ami nem ott volt.

Ugyanez a hibaosztály már sokszor előfordult — a kapu bukása NEM a commitolt diffről szólt:
- `module-upsell-check`: fix nevű scratch-DB → párhuzamos land-ok egymást buktatták;
- `prospect-owned-check`: GLOBÁLIS `order_intent`-számlálás → párhuzamos land-nál hamis piros;
- `mock-photo-gate-check`: a KÖZÖS `sites/`-be írt fixture → ENOENT más sessionök futásában;
- Elek-park: az FK-006 időutazó évekre előre tolta a közös park előfizetés-óráját;
- `photo-normalize-check`: a közös DB „első” tenantja egységes volt (2026-09-27);
- `console-contrast-check`: a `/lead/<id>` lap networkidle-je ~31 s, a kapu `goto`-ja 30 s-os
  alapértelmezéssel fut — a gép terhelésétől függ, piros vagy zöld (a mainen is; mérte a
  `cit873a226d` szál, 2026-09-27). Ez IDŐZÍTÉS-, nem adat-függés, de ugyanúgy nem a diffről szól.

### Döntés
1. **Tiszta-main próba a bukás után** (`scripts/lib/main-probe.mjs`, a `hooks/pre-commit`
   `gate_flush`-ából). Ha a párhuzamos futtató (ADR-0227) bukott kaput jelent, az ELSŐ bukott kapu
   feljegyzett futását (argv · env · stdin · felirat) a próba egy ideiglenes, **detached worktree-ben
   az origin/mainen** újrajátssza — a `rc-wt-prepare.sh` symlinkjeivel (`.env`, `node_modules`,
   `sites`, `assets/Temp`, a fő fa `mock-*.html`-jei), a **main saját kapu-futtatójával** (ugyanaz a
   csak-olvasó-előbb / író-sáv szemantika, **gépi slotban**, ADR-0230), **időkorláttal** (alap 300 s).
   Ítéletek:
   - a mainen is piros → **„EZ NEM A TE VÁLTOZÁSOD — a kapu vagy a közös adat hibás a mainen”**, a
     kapu fájljának utolsó main-commitjával (sha · dátum · tárgy · `Claude-Session` trailer — a szerző
     mindig a tulaj, a SESSION a gazda), a mainen kapott kimenet végével és a teendővel (szólj a
     gazdának / jelezd a tulajnak);
   - a mainen zöld → **„A TE VÁLTOZÁSOD BUKIK”** (+ ha a fa a main mögött van: rebase-tipp; + a
     figyelmeztetés, hogy egy futás egy időzítés-érzékeny kapunál szerencse is lehet);
   - **NEM DÖNTÖTT**, kimondva: a kapu a mainen még nem létezik · a kapu a diffet/módot olvassa
     (`LAND_RANGE`/`--cached`/`git diff` — tiszta fán triviálisan zöld volna) · időkorlát · a próba
     maga hibázott.
2. **Csak diagnosztizál.** A kilépési kódját a hook eldobja, és a bukott kapu kódjával lép ki. A
   próba SOHA nem enged át commitot; kapu-kivételt továbbra is csak a tulaj ad.
3. **Commit-módban és a `land.sh`-ban egyaránt** (a land a hookot hívja `LAND_RANGE`-dzsel). Commit
   módban előtte `git fetch origin main` (30 s); land-módban nem — ott az origin/main az, amire a land
   épp rebase-elt. `CIT_GATE_MAIN_PROBE=0` kikapcsolja; soros módban (`CIT_GATE_JOBS=1`) nincs.
4. **Kimenet fájlba** (`$TMPDIR/cit-main-probe-<ts>.log`), a stderr-re csak az ítélet — és az is csak
   bukási úton (ADR-0171). A próba-fa minden úton törlődik; egy megölt próba maradékát (fa, jobs-
   könyvtár) a következő próba takarítja (csak a saját előtagját, csak két időkorlátnál régebbit).
5. **GIT_* ürítve** a próbában és a próba-fában futó kapu környezetében (a pre-commit `GIT_DIR`/
   `GIT_INDEX_FILE`-ja a COMMITOLÓ fára mutat), a worktree közös könyvtárát a gittől kérdezi (a
   worktree `.git`-je FÁJL).
6. **Az elv, kimondva: kapu = saját fixture, nem a közös dev-DB véletlen sora.** Egy kapu az
   előfeltételét maga állítja elő (futás-bélyegzett saját sor, ADR-0229 `own-fixture-only`), vagy
   kifejezetten a feltételnek megfelelő sort keres, és ha nincs, HANGOSAN bukik („ELŐFELTÉTEL”) —
   sosem az „első” / „bármelyik” sorral mér. Időzítésnél ugyanígy: a várakozás kimondott, indokolt
   feltétel (explicit elem/állapot), nem a gép pillanatnyi terhelésén billegő alapértelmezett
   időkorlát. A tiszta-main próba ezeket nem javítja — csak megmondja, hogy ilyennel állsz szemben.

### Következmények
- Őr: `scripts/main-probe-check.mts` — eldobható git-repó + **worktree** fixture-ön, a hookból
  kivágott szállított `gate_flush`-sal, privát slotokkal, kilenc forgatókönyv (mainen is piros · csak
  a diffben piros · örökölt GIT_DIR/GIT_INDEX_FILE mellett a main fáján fut, a commitoló index
  érintetlen, `.env` ott van · land-mód · új kapu · diffet olvasó kapu · időkorlát · zöldnél és
  kikapcsolva nem fut · nem marad próba-fa); `--self-test` hét visszarontással (session fájában fut ·
  GIT_* szivárog · nincs időkorlát · a hook átenged · piros-a-mainen zöldnek olvasva · a fa ott marad ·
  a hook nem hívja). Bekötve a pre-commitba (a hook/futtató/próba/őr változásakor).
- Élesben mérve a valódi esetre (a javítás előtti origin/main, `a2df3252`): a `photo-normalize-check`
  bukására 13 s alatt „EZ NEM A TE VÁLTOZÁSOD”, gazda `ed651fdc` + a session linkje.
- ~~Nyitott: a `console-contrast-check` `/lead/<id>` időkorlátja.~~ **Lezárva (2026-09-27):** a
  gyökérok az ADR-0250 (`59b215e7`, a lead-lap networkidle 31 s → 12 s hidegen / 2,7 s melegen); a
  kapu (és az `outreach-link-live-check`) kimondott, indokolt 90 s-os időkorlátot kapott —
  `cit873a226d`, ADR-0251 (`0e81de2b`). A 90 s visszavétele a tulaj döntése.

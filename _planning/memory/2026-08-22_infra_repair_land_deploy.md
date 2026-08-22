# 2026-08-22 — Infrastruktúra-javítás: land-kapu, fő fa = integráció, verzió-deploy, worktree-takarítás

**Kiváltó:** az ADR-0052/0053 mérései (16 worktree / 1 ág a GitHubon; az éles 8 dátum kollázsa;
a teszt véletlen worktree-ből; a fő fa félbehagyott merge-ben). Ez a session a NYITOTT
implementációs pontokat zárta le, mind a négyet.

## A) `scripts/land.sh` — a zárás kapuja (ADR-0052 §2)
- fetch → rebase → `tsc` + a TELJES pre-commit suite a **landolt diffre** → push → **visszaellenőrzés**.
- A siker egyetlen kimondója: `git log origin/main..HEAD` üres a push UTÁN — a push exit-kódja nem számít.
- `hooks/pre-commit` új `changed_files()` helperrel: `LAND_RANGE=origin/main...HEAD` esetén a lassú,
  diff-szkópolt kapuk (picker/review/slot/sticky/ár) a landolt diffre élesednek — üres staged setten
  eddig némán kimaradtak volna.
- **4 piros-teszt, a rontás igazolásával:** ① piszkos tracked fa → bukik ② `--no-verify`-jal
  becsempészett tsc-hiba → bukik ③ becsempészett i18n-sértés → a pre-commit kapun bukik
  ④ **LAND_FAKE_PUSH=1** („sikeres" push, ami semmit nem landolt = a mért hibamód) → a
  visszaellenőrzés fogja meg. + szkópolás-önteszt mindkét irányban (üres staged: kapu nem indul;
  views.ts-es range: indul). CLAUDE.md §3 a scriptre mutat.

## B) Tesztkörnyezet = fő fa, ami követi az origin/main-t (ADR-0052 §3)
- A :4600/:4800 servicek már a fő fából futottak; ami hiányzott: a KÖVETÉS és az őrzés.
- **Repo-n kívüli infra:** `/usr/local/bin/citoviso-main-sync.sh` + `citoviso-main-sync.{service,timer}`
  (60 mp): fetch + **ff-only** merge; `package-lock` változásra `npm install`.
  Log: `~/.claude/citoviso-main-sync.log`.
- SOHA nem dob el semmit: piszkos fa / nem-main branch / **lokál commit a mainen** →
  „MUNKATERÜLET-GYANÚ" a logba és kihagyás. ⚠️ Az ahead-eset külön `merge-base --is-ancestor`
  ellenőrzés, mert az `ff-only` az ahead fán néma „Already up to date"-tel átmenne.
- 3 piros-teszt (piszkos / lokál commit / tiszta ffwd) + élő bizonyíték: a session későbbi landolt
  commitját (c18d6c5) a timer magától behúzta.

## C) ADR-0053 — az élesítés VERZIÓ: `scripts/deploy-prod.sh` + ELSŐ SZINKRON LEFUTOTT
- **Hozzáférés-döntés:** a szerver NEM beszél a GitHubbal — a dev gép pushol egy bare repóba
  (`/opt/citoviso/repo.git`), az `/opt/citoviso/app` ennek checkoutja, DETACHED a kivitt commiton.
  Nem kellett új kulcs, és a kapu kikényszeríti: **csak origin/main-őse deployolható**.
- Kapuk: dry-run alapból (`--go` nélkül semmi mutáció — piros-tesztelve); nem-landolt SHA → tagadás
  (piros-tesztelve); függő migráció → **pg_dump előbb**; checkout után **fa-tisztaság-ellenőrzés**;
  restart-sorrend: **console (belső kanári) → verify → public**, 30 mp-es pollozással (a tsx ~6 mp).
- `.env` + `sites/` + `node_modules` gitignore-olva → a checkout nem érinti őket (nem kellett mozgatni).
- **„Mi fut élesen?":** `git -C /opt/citoviso/app rev-parse HEAD` · `/opt/citoviso/DEPLOYED` ledger ·
  `prod/*` tag a GitHubon. Visszagörgetés = az előző SHA deployja.
- **Első szinkron:** teljes tar backup (`pre-adr0053-20260822-091417.tar.gz`, 49 MB) + pg_dump →
  checkout `1ca2523` (= tag `prod/20260822-0916`) → **7 migráció** (0023–0028) → restartok →
  edge 200, hibanapló üres. A 20 hiányzó fájl (reviews, KB, modul-konfig, portál-réteg…) és a
  konfigurátor-szál függő tételei EGYBEN kimentek. 8 db `.bak-*` kódmásolat törölve (tarban megvan);
  a gyökér-scratch (`leads-*.json` = visszajátszási érték!) MARADT.
- **Menet közbeni leletek:** ① root-tulajdonú fájlok a prod fán (régi root-rsyncok) → `chown -R` +
  `safe.directory` a rootnak; ② ⛔ **a HEAD hazudik félbeszakadt checkoutnál** — az első checkout
  a root-tulajdonú `hooks/pre-commit`-en halt el, a HEAD már a célon állt, a fa piszkos maradt; a
  script „már ez fut" korai kilépése ezt elhitte volna → a „kész" CSAK HEAD-egyezés **ÉS tiszta fa
  ÉS nincs függő migráció** együttesére mondható (javítva, a konvergáló újrafutás bizonyította).

## D) Worktree-takarítás — TARTALOM szerint (ADR-0052 §4)
- **8 halott fa lezárva** (worktree remove + branch törlés), mindegyik szemantikus ellenőrzés után:
  - `cit14d6fdf6`/`6aa6c024`/`9f0dba85`/`ad78b906`: tiszta, ahead=0.
  - `cit1cc27a34`: ahead=0; 8 untracked screenshot = script-regenerálható verifikációs szemét.
  - `cit40486d3a` (DKIM): a 4 fájlból 3 **bitre azonos** a mainen (a 371 soros `dmarc-report.mts` is);
    a MEMORY-szekció tartalmilag fent. A commit-szám (ahead=1) itt is hazudott volna.
  - `cit43c3531d` (supersedes): a mechanizmus MINDHÁROM rétege + a `supersededBy` admin-hunk
    **szó szerint** + a `PORTAL_SYNC_UI` sötét szekció a mainen — későbbi szál landolta újra.
  - `citad39edae`: az élő `cit22d637e6` IKRE (azonos SHA) — tartalma ott él tovább.
- A 9. jelölt (`cit2167c7de`, 8 piszkos fájl) ÉLŐ tmux-sessiont szolgál → NEM zártam le; a saját
  sessionje zárja land-del.

## Módosított/létrehozott fájlok
- Repo: `scripts/land.sh` (új), `scripts/deploy-prod.sh` (új), `hooks/pre-commit` (LAND_RANGE),
  `CLAUDE.md` (§0.2 eszköz-hivatkozás, §3 land), `_planning/DEPLOY-READY.md` (fejléc az új rendre).
- Gépi infra (repo-n kívül): `/usr/local/bin/citoviso-main-sync.sh`,
  `/etc/systemd/system/citoviso-main-sync.{service,timer}` (enabled).
- Éles gép: `/opt/citoviso/repo.git`, app = git-checkout `1ca2523`, `/opt/citoviso/DEPLOYED`,
  backupok: `pre-adr0053-*.tar.gz`, `db-pre-*.sql.gz`.

## Folytatás (ugyanaznap, tulaj-jóváhagyással)
- **Éles = main:** `deploy-prod.sh origin/main --go` → éles = `f50eaa7` = tag `prod/20260822-0929`
  (csak doksi + a deploy script; nincs migráció; kanári-sorrend, edge zöld).
- **Watchdog GC tartalmi ítéletre okosítva** (`~/bin/rc-watchdog.py`, ADR-0052 §4 implementáció;
  backup `~/bin/_backup-20260822-093049/`): a `wt_disposable` a commit-SZÁMLÁLÓ helyett fájlonkénti
  **tartalom-egyezést** néz az origin/main-nel (`diff origin/main...HEAD` fájljai bitre egyeznek-e a
  main mai állapotával), és `used_ok`-kal a RETIRED graduált session fája is felszabadul, ha a
  munkája igazoltan landolt. Kétség (git-hiba, valódi uncommitted fájl, eltérő tartalom) = megtart.
  Élő tmux-ú session fáját SOHA nem bántja. **4 fixture-teszt mindkét irányban**: a rebase-iker
  (rev-list 1 ahead, tartalom bitre fent → ELENGED — a régi számláló örökre megtartotta volna),
  unlanded commit → megtart, uncommitted fájl → megtart, fő fa → soha. + `wt_remove` „pruned" ág:
  a kézzel törölt fa metaadatát prune-olja retry-hurok helyett (élesben a 8 záráson bizonyítva).

## Nyitott
- A `cit2167c7de` élő session zárja a saját 8 piszkos fájlját land-del.

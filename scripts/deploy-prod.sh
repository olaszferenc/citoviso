#!/usr/bin/env bash
# deploy-prod — ADR-0053: production runs a NAMED COMMIT, never a file collage.
#
#   bash scripts/deploy-prod.sh <commit-ish>        # dry-run: gates + diff plan only
#   bash scripts/deploy-prod.sh <commit-ish> --go   # deploy (owner's scoped permission!)
#   … --go --ignore-scrape                          # deploy THOUGH a scrape is running
#                                                     (it will be killed — see GATE 4)
#
# Doctrine (CLAUDE.md §0): a deploy needs the owner's explicit, current-turn permission
# for THIS one operation. The script enforces the rest mechanically:
#   GATE 1  only a commit already ON origin/main may deploy (land first);
#   GATE 2  diff-before-deploy: the exact prod-version → target diff is printed;
#   GATE 3  pending migrations trigger a pg_dump before applying;
#   GATE 4  a RUNNING scrape blocks the deploy — the restart would kill it (measured);
#   GATE 6  systemd-időzítők: a cél-commit deploy/systemd/targets.json-jának MINDEN prod
#           időzítője telepítve (éles alakra renderelve), engedélyezve ÉS futva — visszamérve;
#           élesen futó, nem-deklarált időzítő is bukás. Nincs kapcsoló, ami átugorja.
#   GATE 5  a fordítás-frissesség az ÉLES DB-n (ADR-0207) — blokkoló és visszaellenőrzött,
#           de CSAK ha a tartomány fordítás-releváns fájlt érint (különben hangosan kihagyva).
# Rollback = the same script with the previously deployed SHA.
#
# Access model: the server never talks to GitHub. The dev machine pushes the named
# commit into a bare repo on the server (/opt/citoviso/repo.git); /opt/citoviso/app is
# a checkout of that repo, DETACHED at the deployed commit. `.env`, `sites/` and
# node_modules are gitignored, so checkouts never touch them. "What runs in prod?" =
# `git -C /opt/citoviso/app rev-parse HEAD` (plus the /opt/citoviso/DEPLOYED ledger).
# Restart order: console (:4600, internal canary) first and verified, THEN public (:4800).
set -u
# ⛔ PIPEFAIL — SORONKÉNT, NEM GLOBÁLISAN (mérve 2026-09-23, az éles gépen): egy `cmd | tail`
# csővezeték kilépési kódja a TAIL-é, tehát `$SSH "… | tail" || fail` SOHA nem bukik. Így
# bukhatott némán a pg_dump (üres mentés), a db:migrate (restart bukott migráció után), az
# npm install és a fordítás-kapu (GATE 5/5b). Minden blokkoló távoli csővezeték `set -o
# pipefail;`-lel indul; a helyi (`$SSH … | sort`) egy `( set -o pipefail … )` alhéjban.
# Globálisan azért nem: a `… | grep -q` mintáknál a korán kilépő grep SIGPIPE-ot okoz az
# íróban, és pipefail-lel hamis bukást adna. Őr: scripts/deploy-pipe-check.mts.

HOST=178.104.3.223
KEY="$HOME/.ssh/citoviso_hetzner"
SSH="ssh -i $KEY root@$HOST"
APP=/opt/citoviso/app
BARE=/opt/citoviso/repo.git

fail() { echo; echo "⛔ DEPLOY: ELBUKOTT — $1" >&2; exit 1; }

# ── Residue filter (ONE source: the deploy and its red test run this same pipeline) ──
# The deploy's OWN backup directory is not residue; everything else untracked in the
# tree is. Extending this exclusion is a conscious, greppable act.
RESIDUE_OK='.deploy-backup/'
RESIDUE_PIPE="sed -n 's/^?? //p' | grep -vxF '$RESIDUE_OK'"

# RED TEST — a guard that cannot go red is not a guard. Runs PURELY LOCALLY (never
# contacts prod): feeds synthetic `git status --porcelain` lines through the very
# pipeline the deploy uses, and requires the measured blind spot to be caught.
#   bash scripts/deploy-prod.sh --self-test
residue_self_test() {
  local bad=0 got
  _t() { # $1=címke  $2=bemenet  $3=elvárt kimenet
    got="$(printf '%s\n' "$2" | eval "$RESIDUE_PIPE")"
    if [ "$got" = "$3" ]; then
      echo "  ok   $1"
    else
      echo "  FAIL $1"; echo "       várt:   [$3]"; echo "       kapott: [$got]"; bad=$((bad + 1))
    fi
  }
  echo "maradvány-szűrő önteszt (a prodot NEM érinti):"
  _t "⭐ a FA GYÖKERÉBEN lévő maradvány kiderül (ez volt a mért vakfolt)" \
     '?? duplicates.ts' 'duplicates.ts'
  _t "a src/ alatti maradvány továbbra is kiderül" \
     '?? src/scratch.ts' 'src/scratch.ts'
  _t "a deploy SAJÁT mentés-mappája nem maradvány" \
     '?? .deploy-backup/' ''
  _t "vegyesen: a mentés-mappa kiesik, a két maradvány marad" \
     '?? .deploy-backup/
?? tmp-dup.mts
?? src/x.ts' 'tmp-dup.mts
src/x.ts'
  _t "módosított KÖVETETT fájl nem ide tartozik (azt a checkout-kapu fogja)" \
     ' M src/a.ts' ''
  _t "tiszta fa → semmi" '' ''
  echo
  if [ "$bad" -gt 0 ]; then
    echo "⛔ ÖNTESZT: $bad eset elbukott — a szűrő NEM azt méri, amire való." >&2
    return 1
  fi
  echo "✅ ÖNTESZT: a szűrő a fa EGÉSZÉT nézi (a gyökeret is), és csak a deploy saját mentését engedi át."
}

# ── GATE 6 — systemd-időzítők (tulaj, 2026-09-23: „amit nem tudunk kikerülni") ───────
# Az éles gép időzítőit eddig KÉZZEL telepítettük egy README alapján; egy új időzítő így
# csak egy jegyzet volt, amit a deploy nem olvasott. A programajánló két időzítő nélkül
# élesen SEMMIT nem gyűjt, miközben minden felület azt állítja, hogy igen. Innentől a
# forrás a cél-commit `deploy/systemd/targets.json`-ja: minden `prod` időzítő + a
# szolgáltatása éles alakra renderelve (`scripts/systemd-units.mts`, mérve: a kézzel
# telepített 8 egységgel BÁJTRA egyezik), telepítve, engedélyezve, és VISSZAMÉRVE.
# Nincs --skip kapcsoló: ami kihagyható, azt ki is fogják hagyni.
UNITS_TMP=""
timers_render() {
  UNITS_TMP="$(mktemp -d)"
  mkdir -p "$UNITS_TMP/src"
  ( set -o pipefail
    git archive "$SHA" deploy/systemd | tar -x -C "$UNITS_TMP/src"
  ) || fail "GATE 6: a deploy/systemd nem bontható ki a cél-commitból"
  [ -f "$UNITS_TMP/src/deploy/systemd/targets.json" ] \
    || fail "GATE 6: a cél-commitban nincs deploy/systemd/targets.json — az időzítők sorsa eldöntetlen"
  npx tsx scripts/systemd-units.mts render-prod "$UNITS_TMP/src/deploy/systemd" "$UNITS_TMP/out" > "$UNITS_TMP/names" \
    || fail "GATE 6: az időzítő-nyilvántartás hibás (npx tsx scripts/systemd-units.mts check)"
}
# Kiírja: „új|módosul|egyezik <egység>" — és bukik, ha élesen olyan citoviso-időzítő
# van ENGEDÉLYEZVE, amit a cél-commit nem deklarál prodnak (rejtett, verziózatlan futás).
timers_plan() {
  local u r l
  UNITS_CHANGED=""
  echo "── GATE 6 — systemd-időzítők (terv):"
  while read -r u; do
    l="$(sha256sum "$UNITS_TMP/out/$u" | cut -d' ' -f1)"
    r="$($SSH "sha256sum /etc/systemd/system/$u 2>/dev/null | cut -d' ' -f1" </dev/null || true)"
    if [ -z "$r" ]; then echo "     új        $u"; UNITS_CHANGED="$UNITS_CHANGED $u"
    elif [ "$r" != "$l" ]; then echo "     módosul   $u"; UNITS_CHANGED="$UNITS_CHANGED $u"
    else echo "     egyezik   $u"; fi
  done < "$UNITS_TMP/names"
  local enabled undeclared=""
  enabled="$($SSH "systemctl list-unit-files 'citoviso-*.timer' --state=enabled --no-legend 2>/dev/null | cut -d' ' -f1" </dev/null || true)"
  for u in $enabled; do grep -qxF "$u" "$UNITS_TMP/names" || undeclared="$undeclared $u"; done
  [ -z "$undeclared" ] || fail "GATE 6: élesen engedélyezett, de a repóban NEM prod-ként deklarált időzítő:$undeclared — vedd fel a deploy/systemd/targets.json-ba (prod), vagy tiltsd le élesen, tudatosan"
}
timers_install_and_verify() {
  local u t bad=""
  for u in $UNITS_CHANGED; do
    $SSH "cat > /etc/systemd/system/$u" < "$UNITS_TMP/out/$u" || fail "GATE 6: $u telepítése sikertelen"
  done
  $SSH "systemctl daemon-reload" </dev/null || fail "GATE 6: systemctl daemon-reload sikertelen"
  for t in $(grep '\.timer$' "$UNITS_TMP/names"); do
    $SSH "systemctl enable --now $t" </dev/null >/dev/null 2>&1 || fail "GATE 6: $t engedélyezése sikertelen"
  done
  # ⛔ A telepítő SAJÁT szavát nem fogadjuk el — független visszamérés, egységenként.
  echo "── GATE 6b — visszamérés (fájl-egyezés + engedélyezve + fut):"
  for u in $(cat "$UNITS_TMP/names"); do
    [ "$($SSH "sha256sum /etc/systemd/system/$u | cut -d' ' -f1" </dev/null)" = "$(sha256sum "$UNITS_TMP/out/$u" | cut -d' ' -f1)" ] \
      || bad="$bad $u(fájl-eltérés)"
  done
  for t in $(grep '\.timer$' "$UNITS_TMP/names"); do
    [ "$($SSH "systemctl is-enabled $t" </dev/null 2>/dev/null)" = "enabled" ] || bad="$bad $t(nincs engedélyezve)"
    [ "$($SSH "systemctl is-active $t" </dev/null 2>/dev/null)" = "active" ] || bad="$bad $t(nem fut)"
  done
  [ -z "$bad" ] || fail "GATE 6b: az időzítők NEM állnak úgy, ahogy a cél-commit előírja:$bad — a servicek NEM lettek újraindítva"
  echo "     ✓ $(grep -c '\.timer$' "$UNITS_TMP/names") prod időzítő telepítve, engedélyezve, fut"
}

[ $# -ge 1 ] || fail "használat: deploy-prod.sh <commit-ish> [--go]  ·  önteszt: --self-test"
if [ "$1" = "--self-test" ]; then residue_self_test; exit $?; fi
TARGET_REF="$1"
shift
GO=""
IGNORE_SCRAPE=0
for arg in "$@"; do
  case "$arg" in
    --go) GO="--go" ;;
    --ignore-scrape) IGNORE_SCRAPE=1 ;;
    *) fail "ismeretlen kapcsoló: $arg" ;;
  esac
done

cd "$(git rev-parse --show-toplevel)" || fail "nem git-fa"
git fetch origin -q || fail "git fetch origin sikertelen"
SHA="$(git rev-parse --verify "$TARGET_REF^{commit}" 2>/dev/null)" || fail "ismeretlen commit: $TARGET_REF"

# GATE 1 — only landed work deploys. An un-landed SHA is exactly the "dead session" bug.
git merge-base --is-ancestor "$SHA" origin/main \
  || fail "a $SHA NEM őse az origin/main-nek — előbb landolj (scripts/land.sh)"

echo "── cél: $SHA ($(git log -1 --format=%s "$SHA"))"

# ── GATE 4 — a deploy nem gázolja le a futó scrape-et ─────────────────────────
# Mérve 2026-09-11: a 06:49:59-kor indított Balaton-Kelet scrape-et a 06:52:53-as
# deploy ölte meg. A scrape a konzol GYEREKFOLYAMATA, a unit pedig
# KillMode=control-group — a `systemctl restart citoviso-console` a teljes cgroupot
# viszi. A futás 0 leaddel, örökre 'running' státuszban maradt. Egyetlen predikátum,
# két hívási hely (a deploy elején és közvetlenül a restart előtt): a scrape a
# kettő KÖZÖTT is elindulhat.
SCRAPE_FRESH_SQL=""   # a futás-frissesség szabálya (a séma dönti el, melyik)
scrape_where() {
  if [ -z "$SCRAPE_FRESH_SQL" ]; then
    local hasbeat
    hasbeat="$($SSH "sudo -u citoviso psql -d citoviso -t -A -c \"select count(*) from information_schema.columns where table_name='scrape_run' and column_name='heartbeat_at'\"" </dev/null || echo 0)"
    if [ "$hasbeat" = "1" ]; then
      SCRAPE_FRESH_SQL="coalesce(r.heartbeat_at, r.started_at) > now() - interval '4 minutes'"
    else
      # Életjel-oszlop nélkül (0066 előtti éles séma) a frissességet nem tudjuk mérni,
      # csak becsülni: a 2 óránál régebbi 'running' sor bizonyosan tetszhalott — épp az
      # ilyen sor NE blokkolja azt a deployt, ami a javítást kiviszi.
      SCRAPE_FRESH_SQL="r.started_at > now() - interval '2 hours'"
    fi
  fi
  echo "$SCRAPE_FRESH_SQL"
}
scrape_gate() { # $1 = hol tartunk (a kiírásban)
  local live
  live="$($SSH "sudo -u citoviso psql -d citoviso -t -A -F'|' -c \"SELECT d.label, to_char(r.started_at,'YYYY-MM-DD HH24:MI'), coalesce(r.stats->>'phase','—') FROM scrape_run r JOIN scraper_definition d ON d.id = r.scraper_definition_id WHERE r.status='running' AND $(scrape_where)\"" </dev/null || true)"
  if [ -z "$live" ]; then
    echo "── GATE 4 ($1) — nem fut éles scrape ✓"
    return 0
  fi
  echo "── GATE 4 ($1) — ÉLES SCRAPE FUT:"
  echo "$live" | sed 's/^/     · /'
  if [ "$IGNORE_SCRAPE" = "1" ]; then
    echo "     ⚠️  --ignore-scrape: tudatosan továbbmegyek — a restart MEGÖLI a fenti futást."
    return 0
  fi
  fail "éles scrape fut (fent) — a console restart megölné (KillMode=control-group, mérve 2026-09-11). Várd meg a végét, vagy tudatosan: --ignore-scrape"
}
scrape_gate "deploy eleje"

# Current prod version (first sync: no .git yet).
PROD_SHA="$($SSH "git -C $APP rev-parse HEAD 2>/dev/null" </dev/null || true)"
if [ -z "$PROD_SHA" ]; then
  echo "── az éles fán MÉG NINCS git (első szinkron) — a diff-alap a mért kollázs, nem egy commit"
else
  echo "── élesen most: $PROD_SHA"
  # "Already deployed" may ONLY be claimed if the tree really matches HEAD — a checkout
  # that died halfway leaves HEAD at the target with stale files behind it (measured
  # 2026-08-22 first sync: unlink failed on a root-owned file, HEAD had already moved).
  DIRTY="$($SSH "cd $APP && sudo -u citoviso git status --porcelain | grep -v '^??' | head -5" </dev/null || true)"
  if [ "$PROD_SHA" = "$SHA" ] && [ -z "$DIRTY" ]; then
    echo "── HEAD egyezik és a fa tiszta — checkout nem kell, de a migráció/restart-ellenőrzés még jár."
    SKIP_CHECKOUT=1
  elif [ "$PROD_SHA" = "$SHA" ]; then
    echo "⚠️  a HEAD egyezik, de a fa PISZKOS (félbeszakadt checkout?) — újra-checkout:"
    echo "$DIRTY"
  else
    echo "── GATE 2 — diff-before-deploy ($PROD_SHA → $SHA):"
    git diff --stat "$PROD_SHA" "$SHA" | tail -15
  fi
fi

# GATE 1b — the legal layer (ADR-0056). Two halves, because they live in two
# different places and only one of them is in git:
#   structure (routes, links, mandatory clauses) is environment-independent → local;
#   the Impresszum identity lives ONLY in the prod .env → must be read from prod.
# Checking the local env here would measure the wrong machine and pass while the
# live pages still show [KITÖLTENDŐ: …].
echo "── GATE 1b — jogi dokumentum-réteg…"
npx tsx scripts/legal-check.mts >/dev/null || fail "legal-check bukott (futtasd: npx tsx scripts/legal-check.mts)"
for v in LEGAL_ENTITY_NAME LEGAL_ENTITY_ADDRESS LEGAL_ENTITY_REG_NUMBER LEGAL_ENTITY_TAX_NUMBER LEGAL_ENTITY_EMAIL; do
  val="$($SSH "grep -E '^$v=' $APP/.env 2>/dev/null | cut -d= -f2-" </dev/null || true)"
  [ -n "$val" ] || fail "az éles .env-ből hiányzik a(z) $v — az Impresszum/ÁSZF [KITÖLTENDŐ] jelöléssel menne ki, és a fizetős kapu (termsUrl) csukva maradna"
done
echo "     ✓ szerkezet ép + az éles impresszum-adatok kitöltöttek"

# GATE 1c — tudásbázis-frissesség (ADR-0045/f, §J). The dev-time hooks guarantee the
# DETERMINISTIC layer at every commit; deploy-time re-verifies it on the TARGET commit's
# own tree (the working tree in hand may differ), and enforces the JUDGMENT layer as
# evidence: a fresh, range-bound tudasbazis-or PASS token (kb-gate.mjs). The guard
# detects and blocks — it never writes guide content at deploy time (a guide nobody
# reviewed is the "hamis súgó" §J.24 forbids).
KB_PATHS="src/console/views.ts src/console/partnerViews.ts src/console/partnerData.ts src/server/adminViews.ts src/server/moduleConfigViews.ts src/server/modulePreview.ts src/kb kb/entries scripts/kb-check.mts"
if [ -n "$PROD_SHA" ]; then
  KB_DIFF="$(git diff --name-only "$PROD_SHA" "$SHA" -- $KB_PATHS || true)"
  if [ -z "$KB_DIFF" ]; then
    echo "── GATE 1c — tudásbázis: nincs KB-releváns változás a tartományban ✓"
  else
    echo "── GATE 1c — tudásbázis-frissesség ($PROD_SHA → $SHA):"
    echo "$KB_DIFF" | sed 's/^/     · /' | head -12
    KBWT="$(mktemp -d /tmp/kbgate-XXXX)"
    git worktree add -q --detach "$KBWT" "$SHA" || fail "kb-kapu: cél-worktree létrehozás sikertelen"
    if npx tsx "$KBWT/scripts/kb-check.mts" --coverage >/dev/null 2>&1; then
      echo "     ✓ determinisztikus réteg (kb-check --coverage a cél-commiton)"
    else
      git worktree remove -f "$KBWT" >/dev/null 2>&1 || true
      fail "kb-check --coverage PIROS a cél-commiton — a súgó és a felület szétcsúszott"
    fi
    git worktree remove -f "$KBWT" >/dev/null 2>&1 || true
    # Screenshot staleness (WARN only): views changed in range but no entry asset did —
    # whether the change is VISUAL is the judgment layer's call, so this does not fail.
    VIEWS_TOUCHED="$(git diff --name-only "$PROD_SHA" "$SHA" -- src/console/views.ts src/console/partnerViews.ts src/server/adminViews.ts src/server/moduleConfigViews.ts src/server/modulePreview.ts || true)"
    ASSETS_TOUCHED="$(git diff --name-only "$PROD_SHA" "$SHA" -- ':(glob)kb/entries/*/assets/**' || true)"
    if [ -n "$VIEWS_TOUCHED" ] && [ -z "$ASSETS_TOUCHED" ]; then
      echo "     ⚠️  view-fájl változott, de entry-screenshot NEM — ha a változás látszik, futtasd: npx tsx scripts/kb-shot.mts"
    fi
    node scripts/kb-gate.mjs check "$PROD_SHA..$SHA" \
      || fail "tudasbazis-or verdikt hiányzik/elavult — futtasd az őrt a fenti diffre, majd: node scripts/kb-gate.mjs pass \"$PROD_SHA..$SHA\" \"<kivonat>\""
  fi
else
  echo "── GATE 1c — tudásbázis: első sync (nincs PROD_SHA) — kapu kihagyva"
fi

# Pending migrations (prod's applied ledger vs the target commit's files).
( set -o pipefail
  $SSH "sudo -u citoviso psql -d citoviso -t -A -c 'SELECT name FROM schema_migrations'" </dev/null | sort > /tmp/deploy-applied-migs.txt
) || fail "schema_migrations nem olvasható"
git ls-tree --name-only "$SHA" migrations/ | sed 's|migrations/||' | sort > /tmp/deploy-target-migs.txt
PENDING="$(comm -13 /tmp/deploy-applied-migs.txt /tmp/deploy-target-migs.txt)"
if [ -n "$PENDING" ]; then echo "── futtatandó migrációk:"; echo "$PENDING" | sed 's/^/     /'; else echo "── nincs új migráció"; fi

timers_render
timers_plan

if [ "$GO" != "--go" ]; then
  echo
  echo "DRY-RUN vége. Élesítéshez (a tulaj scope-olt engedélyével): deploy-prod.sh $TARGET_REF --go"
  exit 0
fi

echo "── push a szerver bare repójába…"
$SSH "test -d $BARE || (git init --bare -q $BARE && chown -R citoviso:citoviso $BARE)" </dev/null || fail "bare repo létrehozás sikertelen"
GIT_SSH_COMMAND="ssh -i $KEY" git push -q -f "root@$HOST:$BARE" "$SHA:refs/heads/deploy" || fail "push a szerverre sikertelen"
$SSH "chown -R citoviso:citoviso $BARE" </dev/null

if [ -n "$PENDING" ]; then
  echo "── GATE 3 — pg_dump a migrációk előtt…"
  TS="$(date +%Y%m%d-%H%M%S)"
  $SSH "set -o pipefail; sudo -u citoviso pg_dump -d citoviso | gzip > /opt/citoviso/backups/db-pre-$TS.sql.gz && ls -la /opt/citoviso/backups/db-pre-$TS.sql.gz" </dev/null || fail "pg_dump sikertelen"
fi

if [ -z "${SKIP_CHECKOUT:-}" ]; then
  echo "── checkout a megnevezett commitra…"
  if [ -z "$PROD_SHA" ]; then
    $SSH "cd $APP && sudo -u citoviso git init -q && sudo -u citoviso git remote add origin $BARE" </dev/null || fail "git init az app-fán sikertelen"
  fi
  $SSH "cd $APP && sudo -u citoviso git fetch -q origin deploy && sudo -u citoviso git checkout -q -f --detach $SHA" </dev/null || fail "checkout sikertelen"
  # The claim "prod runs $SHA" is only true if the tree matches it — verify, don't assume.
  LEFT="$($SSH "cd $APP && sudo -u citoviso git status --porcelain | grep -v '^??' | head -5" </dev/null || true)"
  [ -z "$LEFT" ] || { echo "$LEFT" >&2; fail "a checkout után a fa NEM tiszta"; }
fi

echo "── maradvány-ellenőrzés (untracked, nem-ignorált fájlok a kód-fában):"
# Measured 2026-08-22: the previous version only looked inside src|assets|public|
# scripts|migrations|hooks|kb, so two scratch files sitting in the APP ROOT
# (duplicates.ts, tmp-dup.mts, from 08-20) were reported as "nincs" — the guard was
# blind to exactly the drift ADR-0053 exists to eliminate. It now scans the WHOLE
# tree; .gitignore already keeps .env/sites/node_modules out of the picture.
#
# NOT fatal, deliberately: an untracked file cannot change what runs (git does not
# track it, nothing imports it), and blocking an urgent production fix over a stray
# log would be a worse failure than a loud warning. It must be IMPOSSIBLE TO MISS,
# not impossible to proceed past.
RESIDUE="$($SSH "cd $APP && sudo -u citoviso git status --porcelain | $RESIDUE_PIPE \
  | tr '\n' '\0' | xargs -0 -r ls -ldh --time-style=long-iso" </dev/null || true)"
if [ -z "$RESIDUE" ]; then
  echo "     nincs"
else
  echo "     ⚠️  IDEGEN FÁJL(OK) az éles kód-fában — nem a deployolt commitból valók:"
  echo "$RESIDUE" | sed 's/^/       /'
  echo "     Nem futnak (a git nem követi őket), de a fa nem tiszta. Vagy commitold"
  echo "     őket a mainre, vagy töröld a szerverről — a dátum megmondja, melyik kell."
fi

echo "── npm install (zár-egyezésig)…"
$SSH "set -o pipefail; cd $APP && sudo -u citoviso npm install --no-audit --no-fund 2>&1 | tail -2" </dev/null || fail "npm install sikertelen"

echo "── migrációk…"
$SSH "set -o pipefail; cd $APP && sudo -u citoviso npm run db:migrate 2>&1 | tail -8" </dev/null || fail "migráció HIBA — a servicek NEM lettek újraindítva"

# ── GATE 5 — fordítás-frissesség az ÉLES adatbázison (ADR-0207) ───────────────
# A védelem eddig pre-commit kapu volt, ami a DEV adatbázist mérte — a kár viszont
# ITT keletkezik: a `kbPacks.ts` kimondja, hogy „a stale translation still serves",
# MAGYAR FALLBACK NINCS, tehát az érintett tulaj a régi (esetleg hibás) súgót olvassa.
# Az egyetlen éles védelem eddig egy boot-idejű `void (async …)` önjavítás volt:
# nem várta meg senki, a bukását nem ellenőrizte senki, és a forgalom megindulása
# UTÁN futott. Itt viszont egy fa van, nincs versenytárs, és meg tudjuk várni.
#
# ⭐ TARTOMÁNY-SZŰKÍTETT: ha a deployolt tartomány egyetlen fordítás-releváns fájlt
# sem érint, a kapu HANGOSAN kihagyja magát — egy kód-only deploy ne égessen
# AI-költséget és ne várjon fordításra (ugyanaz az elv, mint a GATE 1c-nél).
if [ -n "$PROD_SHA" ] && git diff --name-only "$PROD_SHA" "$SHA" 2>/dev/null \
     | grep -qE '^kb/entries/|^src/i18n/catalog\.json$'; then
  NEEDS_I18N=1
elif [ -z "$PROD_SHA" ]; then
  NEEDS_I18N=1   # első sync: nincs mihez diffelni, ezért frissítünk
else
  NEEDS_I18N=0
fi

if [ "$NEEDS_I18N" = "0" ]; then
  echo "── GATE 5 — fordítás: nincs fordítás-releváns változás a tartományban ✓ (kihagyva)"
else
  echo "── GATE 5 — fordítás-frissítés az éles adatbázison (blokkoló)…"
  $SSH "set -o pipefail; cd $APP && sudo -u citoviso npx tsx scripts/i18n-pack-status.mts --ensure 2>&1 | tail -12" </dev/null \
    || fail "a nyelvi csomagok frissítése HIBÁZOTT — a servicek NEM lettek újraindítva, az éles a régi fordítást szolgálná ki"
  # ⛔ A frissítő SAJÁT szavát nem fogadjuk el: független méréssel igazoljuk. Egy
  # „lefutottam" ág, ami nem bizonyít, pontosan az a hamis zöld, amitől ez a kapu véd.
  echo "── GATE 5b — visszaellenőrzés (független mérés)…"
  $SSH "set -o pipefail; cd $APP && sudo -u citoviso npx tsx scripts/kb-translation-coverage-check.mts 2>&1 | tail -12" </dev/null \
    || fail "a frissítés után is maradt elavult fordítás — a servicek NEM lettek újraindítva"
fi

# GATE 6 — az időzítők a restart ELŐTT állnak fel: ha nem, a servicek nem indulnak újra.
timers_install_and_verify

# A scrape a deploy ELEJE óta is elindulhatott — a kapu ott áll, ahol az ölés történik.
scrape_gate "közvetlenül a restart előtt"

echo "── restart: console (belső kanári) → verify → public…"
# tsx cold-start needs ~6s; poll up to 30s instead of guessing a sleep.
wait_port() { # $1=port $2=path $3=expected-prefix
  $SSH "for i in \$(seq 1 15); do C=\$(curl -s -o /dev/null -w '%{http_code}' http://localhost:$1$2); case \$C in $3*) echo \":$1 → \$C (\$((i*2))s)\"; exit 0;; esac; sleep 2; done; echo \":$1 → \$C 30s után\"; exit 1" </dev/null
}
$SSH "systemctl restart citoviso-console" </dev/null || fail "console restart parancs hibázott"
wait_port 4600 /leads 3 || fail "console nem jött vissza — public NEM lett bántva"
$SSH "systemctl restart citoviso-public" </dev/null || fail "public restart parancs hibázott"
wait_port 4800 / 200 || fail "public nem jött vissza"
$SSH "journalctl -u citoviso-console -u citoviso-public --since '-2 min' -p err --no-pager -q" </dev/null

# Version ledger on the machine + audit tag on GitHub.
TS="$(date +%Y%m%d-%H%M)"
$SSH "echo \"$(date '+%F %T') deployed=$SHA prev=${PROD_SHA:-none} tag=prod/$TS\" >> /opt/citoviso/DEPLOYED" </dev/null
git tag -f "prod/$TS" "$SHA" && GIT_SSH_COMMAND="ssh" git push -q origin "prod/$TS" || echo "⚠️  tag-push nem ment — a DEPLOYED ledger attól még hiteles"

echo
echo "✅ DEPLOY KÉSZ: éles = $SHA (tag prod/$TS). Visszagörgetés: deploy-prod.sh ${PROD_SHA:-<előző sha>} --go"

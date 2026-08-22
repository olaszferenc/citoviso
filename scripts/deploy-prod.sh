#!/usr/bin/env bash
# deploy-prod — ADR-0053: production runs a NAMED COMMIT, never a file collage.
#
#   bash scripts/deploy-prod.sh <commit-ish>        # dry-run: gates + diff plan only
#   bash scripts/deploy-prod.sh <commit-ish> --go   # deploy (owner's scoped permission!)
#
# Doctrine (CLAUDE.md §0): a deploy needs the owner's explicit, current-turn permission
# for THIS one operation. The script enforces the rest mechanically:
#   GATE 1  only a commit already ON origin/main may deploy (land first);
#   GATE 2  diff-before-deploy: the exact prod-version → target diff is printed;
#   GATE 3  pending migrations trigger a pg_dump before applying.
# Rollback = the same script with the previously deployed SHA.
#
# Access model: the server never talks to GitHub. The dev machine pushes the named
# commit into a bare repo on the server (/opt/citoviso/repo.git); /opt/citoviso/app is
# a checkout of that repo, DETACHED at the deployed commit. `.env`, `sites/` and
# node_modules are gitignored, so checkouts never touch them. "What runs in prod?" =
# `git -C /opt/citoviso/app rev-parse HEAD` (plus the /opt/citoviso/DEPLOYED ledger).
# Restart order: console (:4600, internal canary) first and verified, THEN public (:4800).
set -u

HOST=178.104.3.223
KEY="$HOME/.ssh/citoviso_hetzner"
SSH="ssh -i $KEY root@$HOST"
APP=/opt/citoviso/app
BARE=/opt/citoviso/repo.git

fail() { echo; echo "⛔ DEPLOY: ELBUKOTT — $1" >&2; exit 1; }

[ $# -ge 1 ] || fail "használat: deploy-prod.sh <commit-ish> [--go]"
TARGET_REF="$1"
GO="${2:-}"

cd "$(git rev-parse --show-toplevel)" || fail "nem git-fa"
git fetch origin -q || fail "git fetch origin sikertelen"
SHA="$(git rev-parse --verify "$TARGET_REF^{commit}" 2>/dev/null)" || fail "ismeretlen commit: $TARGET_REF"

# GATE 1 — only landed work deploys. An un-landed SHA is exactly the "dead session" bug.
git merge-base --is-ancestor "$SHA" origin/main \
  || fail "a $SHA NEM őse az origin/main-nek — előbb landolj (scripts/land.sh)"

echo "── cél: $SHA ($(git log -1 --format=%s "$SHA"))"

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

# Pending migrations (prod's applied ledger vs the target commit's files).
$SSH "sudo -u citoviso psql -d citoviso -t -A -c 'SELECT name FROM schema_migrations'" </dev/null | sort > /tmp/deploy-applied-migs.txt \
  || fail "schema_migrations nem olvasható"
git ls-tree --name-only "$SHA" migrations/ | sed 's|migrations/||' | sort > /tmp/deploy-target-migs.txt
PENDING="$(comm -13 /tmp/deploy-applied-migs.txt /tmp/deploy-target-migs.txt)"
if [ -n "$PENDING" ]; then echo "── futtatandó migrációk:"; echo "$PENDING" | sed 's/^/     /'; else echo "── nincs új migráció"; fi

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
  $SSH "sudo -u citoviso pg_dump -d citoviso | gzip > /opt/citoviso/backups/db-pre-$TS.sql.gz && ls -la /opt/citoviso/backups/db-pre-$TS.sql.gz" </dev/null || fail "pg_dump sikertelen"
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
$SSH "cd $APP && sudo -u citoviso git status --porcelain | grep '^??' | grep -E '^\?\? (src|assets|public|scripts|migrations|hooks|kb)/' || echo '     nincs'" </dev/null

echo "── npm install (zár-egyezésig)…"
$SSH "cd $APP && sudo -u citoviso npm install --no-audit --no-fund 2>&1 | tail -2" </dev/null || fail "npm install sikertelen"

echo "── migrációk…"
$SSH "cd $APP && sudo -u citoviso npm run db:migrate 2>&1 | tail -8" </dev/null || fail "migráció HIBA — a servicek NEM lettek újraindítva"

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

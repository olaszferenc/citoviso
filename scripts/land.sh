#!/usr/bin/env bash
# land — session-closing integration gate (ADR-0052): fetch → rebase onto origin/main →
# gates → push → VERIFY. Loud by design: every failure path prints "LAND: ELBUKOTT" and
# exits non-zero. Success is declared ONLY by the final verification
# (`git log origin/main..HEAD` empty), never by the push's exit code — measured
# 2026-08-22: 16 worktrees alive, 1 branch on GitHub; pushes were dying silently on
# non-fast-forward while sessions reported "felküldve".
#
# Usage, from any worktree, after committing with an itemised file list:
#   bash scripts/land.sh
#
# Red-test hook: LAND_FAKE_PUSH=1 turns the push into a successful no-op, so the final
# verification can be proven to catch the exact measured failure mode (a "successful"
# push that landed nothing). Never set it outside a red test.
set -u

fail() {
  echo
  echo "⛔ LAND: ELBUKOTT — $1" >&2
  echo "   A session NINCS lezárva; az origin/main NEM tartalmazza a munkát." >&2
  exit 1
}

ROOT="$(git rev-parse --show-toplevel)" || fail "nem git-fa"
cd "$ROOT"

# 0) Tracked changes must be committed first. Untracked files are listed loudly but not
#    fatal: every worktree legitimately carries the sites/ and assets/Temp symlinks.
if ! git diff --quiet || ! git diff --cached --quiet; then
  git status --short | grep -v '^??' >&2
  fail "commitolatlan TRACKED változás van a fában — előbb tételes git add + commit"
fi
UNTRACKED="$(git status --porcelain | grep '^??' | grep -vE '^\?\? (sites/?|assets/Temp/?)$' || true)"
if [ -n "$UNTRACKED" ]; then
  echo "⚠️  Untracked fájlok — ezek NEM landolnak (ha munka van bennük, commitold őket):"
  echo "$UNTRACKED"
fi

git fetch origin || fail "git fetch origin sikertelen"

ATTEMPT=0
while :; do
  ATTEMPT=$((ATTEMPT + 1))
  [ "$ATTEMPT" -gt 3 ] && fail "3 kísérlet alatt is mozgott alólunk a main — futtasd újra"

  if [ -z "$(git log origin/main..HEAD --oneline)" ]; then
    echo "✅ LAND: nincs landolnivaló — az origin/main már tartalmazza a HEAD-et."
    exit 0
  fi

  echo "── land #$ATTEMPT: rebase origin/main-re…"
  if ! git rebase origin/main; then
    git rebase --abort 2>/dev/null || true
    fail "rebase-konfliktus — oldd fel kézzel (git rebase origin/main), majd land újra"
  fi

  echo "── kapuk: typecheck…"
  npx tsc --noEmit -p tsconfig.json || fail "tsc piros"
  echo "── kapuk: pre-commit suite a landolt diffre (LAND_RANGE=origin/main...HEAD)…"
  LAND_RANGE="origin/main...HEAD" bash "$ROOT/hooks/pre-commit" || fail "pre-commit kapu piros"

  echo "── push origin HEAD:main…"
  if [ "${LAND_FAKE_PUSH:-}" = "1" ]; then
    echo "   (LAND_FAKE_PUSH=1 — a push kihagyva; a visszaellenőrzésnek most buknia KELL)"
  elif ! git push origin HEAD:main; then
    echo "   push elutasítva (a main közben mozgott) — fetch + rebase + kapuk újra…"
    git fetch origin || fail "git fetch origin sikertelen"
    continue
  fi

  # VERIFICATION — the only line that may claim success (CLAUDE.md §3.3).
  git fetch origin || fail "git fetch sikertelen a visszaellenőrzésnél"
  REMAIN="$(git log origin/main..HEAD --oneline)"
  if [ -n "$REMAIN" ]; then
    echo "$REMAIN" >&2
    fail "a push UTÁN az origin/main még mindig nem tartalmazza a HEAD-et"
  fi
  git merge-base --is-ancestor HEAD origin/main || fail "a HEAD nem őse az origin/main-nek"
  echo
  echo "✅ LAND: IGAZOLTAN FENT — origin/main=$(git rev-parse --short origin/main) tartalmazza a HEAD-et ($(git rev-parse --short HEAD))."

  # SINGLE TEST SURFACE (feedback_single_test_surface_no_ports): the owner reviews
  # everything on the main tree's :4600/:4800 (systemd + tsx watch). Landing must
  # therefore REFRESH the main tree too, or the chain "landed = visible" has a
  # manual last link that sessions keep skipping. ff-only + clean-tree guard: this
  # may never eat uncommitted integration work in the main tree.
  MAIN_TREE=/home/citoviso/citoviso
  if [ -d "$MAIN_TREE" ] && [ "$ROOT" != "$MAIN_TREE" ]; then
    if [ "$(git -C "$MAIN_TREE" rev-parse --abbrev-ref HEAD)" != "main" ]; then
      echo "⚠️  Fő fa nem a main ágon áll — a :4600 tesztfelület NEM frissült (kézi rendezés kell)."
    elif ! git -C "$MAIN_TREE" diff --quiet || ! git -C "$MAIN_TREE" diff --cached --quiet; then
      echo "⚠️  Fő fában commitolatlan változás van — a :4600 tesztfelület NEM frissült (ADR-0052: ott nem fejlesztünk — rendezd)."
    elif git -C "$MAIN_TREE" merge --ff-only origin/main >/dev/null 2>&1; then
      # A tsx-watch NEM garantáltan tölti újra a mély import-gráfot (2026-08-23:
      # a 14:52-es land után a 15:11-es generálás még a RÉGI motorral futott; a
      # port-őr csak halott portot kezel, állott processzt nem). A "már ezt
      # mutatja" csak restarttal igaz — best-effort, a land enélkül is érvényes.
      sudo systemctl restart citoviso-console citoviso-public 2>/dev/null \
        && echo "   ↻ :4600/:4800 szerverek újraindítva (friss motor betöltve)" \
        || echo "   ⚠️  szerver-restart nem sikerült — a :4600 ÁLLOTT kódot szolgálhat ki (kézzel: sudo systemctl restart citoviso-console citoviso-public)"
      echo "✅ Fő fa frissítve ($(git -C "$MAIN_TREE" rev-parse --short HEAD)) — a tesztfelület a :4600-on már ezt mutatja."
    else
      echo "⚠️  Fő fa ff-frissítése nem ment (elágazott?) — a :4600 tesztfelület NEM frissült."
    fi
  fi

  # §2b terv-vázlatok takarítása (ADR-0077; tulaj kérése 2026-08-27: „ha nincs valami
  # trigger ami törölné a fileokat akkor legyen, mert így kurva sok szemét lesz").
  # A land = a session zárása, tehát ez a takarítás helye. Veszélytelen: a vázlatok
  # gitignore-oltak, EGY paranccsal determinisztikusan újragenerálhatók, a JÓVÁHAGYOTT
  # terv pedig nem itt él, hanem commitolva az assets/design-refs/console/ alatt.
  DRAFTS="$ROOT/assets/design-refs/_drafts"
  if [ -d "$DRAFTS" ]; then
    n=$(find "$DRAFTS" -type f | wc -l)
    rm -rf "$DRAFTS"
    echo "🧹 Terv-vázlatok törölve ($n fájl, assets/design-refs/_drafts/) — a jóváhagyott terv a design-refs/console alatt marad."
  fi
  exit 0
done

#!/usr/bin/env bash
# gate-hourly — the browser gates that no longer block the land, run every hour on origin/main
# (ADR-0446). Measured 2026-11-12/13: at load 15–30 the browser/timing gates went red without any
# fault in the landed diff (red on a clean main too), and a finished feature waited four lands for an
# owner exception. So the land skips them (scripts/lib/gate-runner.mjs, "óránként fut"), and THIS
# script runs exactly them on the commits that landed since the last green hourly run:
#
#   LAND_RANGE=<last green>...<origin/main>  CIT_GATE_HOURLY=1  bash hooks/pre-commit
#
# in a dedicated detached worktree outside ~/wt (the watchdog's worktree GC never sees it), with the
# same shared symlinks rc-wt-prepare.sh makes. The hook's changed_files scoping keeps working: only
# the gates whose files the landed range touched run.
#
#   green → the head becomes the new base; the "alerted" mark is cleared.
#   red   → the base STAYS (the next hour re-checks the same commits plus the fix, once it landed),
#           and the house is alerted through the existing channel (src/console/houseAlert.ts, the
#           same mail ADR-0276 unit alerts use) — ONCE per distinct set of red gates, not every hour.
#
# Usage:  bash scripts/gate-hourly.sh            (the systemd timer: deploy/systemd/citoviso-gate-hourly.*)
#         bash scripts/gate-hourly.sh --base <sha>   (manual: check <sha>...origin/main once; state untouched)
#         bash scripts/gate-hourly.sh --status       (base, last result, last alert)
# Env:    CIT_GATE_HOURLY_DIR (state + tree, default ~/.cache/citoviso-gate-hourly)
#         CIT_GATE_HOURLY_NO_ALERT=1 (log only — the selftest and manual runs)
set -u

MAIN_TREE="${CIT_MAIN_TREE:-/home/citoviso/citoviso}"
HDIR="${CIT_GATE_HOURLY_DIR:-$HOME/.cache/citoviso-gate-hourly}"
WT="$HDIR/tree"
STATE="$HDIR/state"         # key=value lines: base, alerted, last
LOGDIR="$HDIR/logs"
mkdir -p "$HDIR" "$LOGDIR"

get() { [ -f "$STATE" ] && sed -n "s/^$1=//p" "$STATE" | tail -1; }
put() {
  local tmp="$STATE.$$"
  { [ -f "$STATE" ] && grep -v "^$1=" "$STATE"; echo "$1=$2"; } >"$tmp" && mv "$tmp" "$STATE"
}

if [ "${1:-}" = "--status" ]; then
  echo "alap (utolsó zöld): $(get base)"
  echo "utolsó futás:       $(get last)"
  echo "riasztva:           $(get alerted)"
  exit 0
fi
MANUAL_BASE=""
if [ "${1:-}" = "--base" ]; then
  MANUAL_BASE="${2:?--base <sha>}"
fi

# One run at a time (a red run can take long; the next tick must not stack on it).
exec 9>"$HDIR/lock"
if ! flock -n 9; then
  echo "$(date '+%F %T') gate-hourly: az előző futás még tart — kihagyva"
  exit 0
fi

git -C "$MAIN_TREE" fetch -q origin || { echo "gate-hourly: git fetch sikertelen" >&2; exit 1; }
HEAD_SHA="$(git -C "$MAIN_TREE" rev-parse origin/main)"

BASE="${MANUAL_BASE:-$(get base)}"
if [ -z "$BASE" ]; then
  # First run ever: start from here. Everything earlier was gated by the old (blocking) land.
  put base "$HEAD_SHA"
  echo "$(date '+%F %T') gate-hourly: kezdőpont rögzítve ($(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA")) — a következő óra az ezutáni landokat nézi"
  exit 0
fi
if [ "$BASE" = "$HEAD_SHA" ]; then
  echo "$(date '+%F %T') gate-hourly: nincs új landolt commit ($(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA"))"
  exit 0
fi
git -C "$MAIN_TREE" merge-base --is-ancestor "$BASE" "$HEAD_SHA" 2>/dev/null || {
  echo "gate-hourly: az alap ($BASE) nem őse az origin/main-nek — kézzel: --base <sha>" >&2
  exit 1
}

# ── the dedicated tree: detached on origin/main, with the shared symlinks ──────────────
if ! git -C "$WT" rev-parse --git-dir >/dev/null 2>&1; then
  rm -rf "$WT"
  git -C "$MAIN_TREE" worktree prune
  git -C "$MAIN_TREE" worktree add --detach -q "$WT" "$HEAD_SHA" || { echo "gate-hourly: worktree add sikertelen" >&2; exit 1; }
fi
git -C "$WT" checkout -q --detach --force "$HEAD_SHA" || { echo "gate-hourly: checkout sikertelen" >&2; exit 1; }
git -C "$WT" clean -qfd -e .env -e node_modules -e sites -e assets/Temp -e 'mock-*.html' >/dev/null 2>&1 || true
for L in .env node_modules sites assets/Temp; do
  [ -e "$MAIN_TREE/$L" ] || continue
  mkdir -p "$(dirname "$WT/$L")"
  [ -e "$WT/$L" ] || ln -s "$MAIN_TREE/$L" "$WT/$L"
done
for f in "$MAIN_TREE"/mock-*.html; do
  [ -e "$f" ] || continue
  [ -L "$WT/$(basename "$f")" ] || [ -e "$WT/$(basename "$f")" ] || ln -s "$f" "$WT/$(basename "$f")"
done

RANGE="$BASE...$HEAD_SHA"
SHORT="$(git -C "$MAIN_TREE" rev-parse --short "$BASE")...$(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA")"
LOG="$LOGDIR/$(date +%Y%m%d-%H%M).log"
echo "$(date '+%F %T') gate-hourly: böngészős kapuk a(z) $SHORT tartományon ($(git -C "$MAIN_TREE" rev-list --count "$BASE..$HEAD_SHA") commit) → $LOG"
T0=$(date +%s)
( cd "$WT" && LAND_RANGE="$RANGE" CIT_GATE_HOURLY=1 CIT_GATE_MAIN_PROBE=0 bash hooks/pre-commit ) >"$LOG" 2>&1
RC=$?
SECS=$(( $(date +%s) - T0 ))
# Keep a week of logs.
find "$LOGDIR" -name '*.log' -mtime +7 -delete 2>/dev/null || true

if [ "$RC" -eq 0 ]; then
  echo "$(date '+%F %T') gate-hourly: ZÖLD ($SECS s) — $(grep -o '[0-9]* kapu ·' "$LOG" | tail -1)"
  if [ -z "$MANUAL_BASE" ]; then
    put base "$HEAD_SHA"
    put alerted ""
    put last "$(date '+%F %T') ZÖLD $SHORT"
  fi
  exit 0
fi

# Red: which gates? The label line right before each "EZ A KAPU ELBUKOTT" block.
RED="$(awk '/^\[pre-commit\] /{l=$0} /EZ A KAPU ELBUKOTT/{print l}' "$LOG" | sed 's/^\[pre-commit\] //' | sort -u)"
[ -n "$RED" ] || RED="(a kapu neve nem olvasható ki — lásd a naplót)"
SIG="$(printf '%s' "$RED" | sha256sum | cut -c1-16)"
echo "$(date '+%F %T') gate-hourly: PIROS ($SECS s, rc=$RC):"
printf '%s\n' "$RED" | sed 's/^/   · /'
[ -n "$MANUAL_BASE" ] && exit "$RC"
put last "$(date '+%F %T') PIROS $SHORT"
if [ "$(get alerted)" = "$SIG" ]; then
  echo "   (ugyanez a piros halmaz már riasztva — nem küldök újra)"
  exit 0
fi
if [ "${CIT_GATE_HOURLY_NO_ALERT:-}" = "1" ]; then
  echo "   (CIT_GATE_HOURLY_NO_ALERT=1 — riasztás kihagyva)"
  exit 0
fi
if ( cd "$MAIN_TREE" && "$MAIN_TREE/node_modules/.bin/tsx" scripts/gate-hourly-alert.mts "$LOG" "$SHORT" "$RED" ); then
  put alerted "$SIG"
else
  echo "gate-hourly: a riasztás nem ment ki — a következő óra újrapróbálja" >&2
  exit 1
fi
exit 0

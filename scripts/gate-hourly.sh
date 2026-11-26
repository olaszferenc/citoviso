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
#   red   → PER-GATE BASE (2026-11-26, ADR-XXXX): the runner judges EVERY gate (CIT_GATE_RED_OUT —
#           it no longer stops at the first red) and hands over the red ones; the base moves to the
#           head anyway, and the red gates are kept in $HDIR/red-jobs and re-run EVERY hour on the
#           current origin/main (range: red_base...head, red_base = where they first went red) until
#           they are green. So one red gate re-runs itself, not all 92 (measured: base stuck on
#           2026-11-16 for ten days, 477 commits, 950–1220 s of a third of the machine every hour).
#           The house is alerted through the existing channel (src/console/houseAlert.ts, the same
#           mail ADR-0276 unit alerts use) — ONCE per distinct set of red gates, not every hour.
#           A failure the runner did not judge (the hook stopped before gate_flush, the runner
#           itself crashed) keeps the OLD rule: nothing moves, the next hour re-checks everything.
#   load  → at most CIT_GATE_HOURLY_JOBS (default 2) gates at a time, i.e. at most 2 of the six
#           machine-wide gate slots: a session's commit/land gets the rest (the unit runs at Nice=10).
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

RED_DIR="$HDIR/red-jobs"   # the red gates handed over by the last run (job files, see gate-runner.mjs)
HJOBS="${CIT_GATE_HOURLY_JOBS:-2}"
have_red() { [ -z "$MANUAL_BASE" ] && compgen -G "$RED_DIR/*.argv" >/dev/null; }
RED_BASE="$(get red_base)"; [ -n "$RED_BASE" ] || RED_BASE="$BASE"
git -C "$MAIN_TREE" merge-base --is-ancestor "$RED_BASE" "$HEAD_SHA" 2>/dev/null || RED_BASE="$BASE"

RANGE="$BASE...$HEAD_SHA"
SHORT="$(git -C "$MAIN_TREE" rev-parse --short "$BASE")...$(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA")"
LOG="$LOGDIR/$(date +%Y%m%d-%H%M).log"
echo "$(date '+%F %T') gate-hourly: böngészős kapuk a(z) $SHORT tartományon ($(git -C "$MAIN_TREE" rev-list --count "$BASE..$HEAD_SHA") commit) → $LOG"
T0=$(date +%s)
WORK="$(mktemp -d -t cit-gate-hourly-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/redA" "$WORK/redB" "$WORK/carried"

# ① the red gates of the last run, again, on the current head (nothing else) — before the new range.
RCB=0
if have_red; then
  cp -p "$RED_DIR"/* "$WORK/carried/" 2>/dev/null
  rm -f "$WORK/carried/DONE"
  for a in "$WORK/carried"/*.argv; do   # a gate whose script is gone from main cannot be re-run
    sc="$(tr '\0' '\n' <"$a" | grep -m1 '^scripts/' || true)"
    if [ -n "$sc" ] && [ ! -e "$WT/$sc" ]; then
      echo "   (a piros kapu szkriptje már nincs a mainen, kivezetve: $sc)" >>"$LOG"
      rm -f "${a%.argv}".*
    fi
  done
  if compgen -G "$WORK/carried/*.argv" >/dev/null; then
    echo "[gate-hourly] ① az előző óra piros kapui újra, a(z) $(git -C "$MAIN_TREE" rev-parse --short "$RED_BASE")...$(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA") tartományon:" >>"$LOG"
    ( cd "$WT" && LAND_RANGE="$RED_BASE...$HEAD_SHA" CIT_GATE_HOURLY=1 CIT_GATE_JOBS="$HJOBS" CIT_GATE_RED_OUT="$WORK/redB" \
        node scripts/lib/gate-runner.mjs "$WORK/carried" "$WT" ) >>"$LOG" 2>&1
    RCB=$?
    # The same print the hook gives a failed gate (label, then the "EZ A KAPU ELBUKOTT" block).
    if [ -f "$WORK/carried/FAILED" ]; then
      while IFS=$'\t' read -r grc label out err; do
        { cat "$label"; echo; echo "⛔ EZ A KAPU ELBUKOTT (kilépési kód: $grc). A kimenete:"; cat "$out" "$err"; } >>"$LOG" 2>/dev/null
      done <"$WORK/carried/FAILED"
    fi
  fi
fi

# ② the commits that landed since the last run: the hook, as before (every gate judged, reds handed over).
echo "[gate-hourly] ② az új commitok böngészős kapui ($SHORT):" >>"$LOG"
REDOUT_A="$WORK/redA"; [ -z "$MANUAL_BASE" ] || REDOUT_A=""   # manual: the old stop-at-first-red run, state untouched
( cd "$WT" && LAND_RANGE="$RANGE" CIT_GATE_HOURLY=1 CIT_GATE_MAIN_PROBE=0 CIT_GATE_JOBS="$HJOBS" CIT_GATE_RED_OUT="$REDOUT_A" \
    bash hooks/pre-commit ) >>"$LOG" 2>&1
RC=$?
SECS=$(( $(date +%s) - T0 ))
# Keep a week of logs.
find "$LOGDIR" -name '*.log' -mtime +7 -delete 2>/dev/null || true

# Did the runner judge every gate? (DONE = it reached the end; else the old rule: nothing moves.)
judged() { [ -f "$1/DONE" ]; }
if [ -n "$MANUAL_BASE" ]; then
  [ "$RC" -eq 0 ] && echo "$(date '+%F %T') gate-hourly: ZÖLD ($SECS s, kézi)" || echo "$(date '+%F %T') gate-hourly: PIROS ($SECS s, rc=$RC, kézi) — $LOG"
  exit "$RC"
fi
PER_GATE=1
if [ "$RC" -ne 0 ] && ! judged "$WORK/redA"; then PER_GATE=0; fi
if [ "$RCB" -ne 0 ] && ! judged "$WORK/redB"; then PER_GATE=0; fi

if [ "$PER_GATE" -eq 1 ]; then
  # The new red set: ① ∪ ②, one job per distinct argv.
  rm -rf "$RED_DIR.new"; mkdir -p "$RED_DIR.new"
  n=0   # fresh ids (<n>.1): the two passes' ids may collide
  for src in "$WORK/redB" "$WORK/redA"; do
    for a in "$src"/*.argv; do
      [ -e "$a" ] || continue
      dup=0
      for b in "$RED_DIR.new"/*.argv; do [ -e "$b" ] && cmp -s "$a" "$b" && dup=1 && break; done
      [ "$dup" -eq 1 ] && continue
      n=$((n + 1))
      for ext in argv env cwd label quiet stdin; do
        [ -e "${a%.argv}.$ext" ] && cp -p "${a%.argv}.$ext" "$RED_DIR.new/$n.1.$ext"
      done
    done
  done
  rm -rf "$RED_DIR"; mv "$RED_DIR.new" "$RED_DIR"
  put base "$HEAD_SHA"
  if ! compgen -G "$RED_DIR/*.argv" >/dev/null; then
    put red_base ""
    put alerted ""
    put last "$(date '+%F %T') ZÖLD $SHORT"
    echo "$(date '+%F %T') gate-hourly: ZÖLD ($SECS s) — $(grep -o '[0-9]* kapu ·' "$LOG" | tail -1)"
    exit 0
  fi
  have_red_before=$(compgen -G "$WORK/carried/*.argv" >/dev/null && echo 1 || echo 0)
  [ "$have_red_before" -eq 1 ] && put red_base "$RED_BASE" || put red_base "$BASE"
  RED="$(for l in "$RED_DIR"/*.label; do [ -e "$l" ] && { cat "$l"; echo; }; done | sed 's/^\[pre-commit\] //' | grep -v '^$' | sort -u)"
  [ -n "$RED" ] || RED="(a kapu neve nem olvasható ki — lásd a naplót)"
  SHORT="$(git -C "$MAIN_TREE" rev-parse --short "$(get red_base)")...$(git -C "$MAIN_TREE" rev-parse --short "$HEAD_SHA")"
else
  # Not judged gate by gate: the old rule — the base STAYS, the next hour re-checks everything.
  RED="$(awk '/^\[pre-commit\] /{l=$0} /EZ A KAPU ELBUKOTT/{print l}' "$LOG" | sed 's/^\[pre-commit\] //' | sort -u)"
  [ -n "$RED" ] || RED="(a kapu neve nem olvasható ki — lásd a naplót)"
fi
SIG="$(printf '%s' "$RED" | sha256sum | cut -c1-16)"
echo "$(date '+%F %T') gate-hourly: PIROS ($SECS s, rc=$RC/$RCB$([ "$PER_GATE" -eq 1 ] && echo ', kapunként: a zöldek továbbléptek' || echo ', nem kapunként ítélt: minden marad')):"
printf '%s\n' "$RED" | sed 's/^/   · /'
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

# land-lock — the machine-wide land queue (ADR-0275), SOURCED by scripts/land.sh.
#
# Measured 2026-09-29 (cit48c5979c, a24d552e): one land took 45 min wall-clock in THREE rounds —
# the push bounced twice because a parallel land moved main, and every bounce re-ran fetch +
# rebase + the whole gate suite (the rebase gives a new tree, so "0 már zöld volt"). The loss was
# parallel lands re-running each other, not the gates themselves.
#
# So "fetch → rebase → ADR assignment → gates → push → verification" runs under ONE lock per
# repository: the file lives in `git rev-parse --git-common-dir`, which is the same directory from
# the main tree and from every worktree. Split out of land.sh (like land-rebase.sh) so
# scripts/land-lock-check.mts can run the REAL code in a throwaway repo — land.sh itself refreshes
# the main tree and restarts the :4600/:4800 servers.
#
# ⚠️ WHY A HOLDER PROCESS, NOT `exec 9>lock; flock 9`: an fd opened in land.sh is inherited by every
# child (npx, tsx, the gate runner, Chromium). A land killed by PID would then keep everyone locked
# out for as long as an orphaned child lived (a Chromium gate was measured hanging 18 min). Here the
# lock fd exists ONLY in a `flock -o` process, whose command merely watches land.sh's PID: land.sh
# dies (any signal, even -9) → the watcher exits within ~1 s → flock exits → the kernel drops the lock.
#
# ⛔ No bypass switch on purpose: there is no env/flag that skips the lock. A missing `flock` or an
# unwritable lock file is a loud failure, never a silent "runs without the queue".

LAND_LOCK_PID=""

land_lock_release() {
  if [ -n "$LAND_LOCK_PID" ]; then
    : >"$LAND_LOCK_FILE.holder" 2>/dev/null || true
    kill "$LAND_LOCK_PID" 2>/dev/null || true
    wait "$LAND_LOCK_PID" 2>/dev/null || true
    LAND_LOCK_PID=""
    echo "── land-sor: zár elengedve."
  fi
}

# land_lock_acquire <root> — blocks until this land holds the machine-wide lock. Prints who holds it
# while waiting (immediately, then every ~30 s). Returns non-zero only on a broken lock mechanism.
land_lock_acquire() {
  local root="$1" common ready holder ticks=0
  command -v flock >/dev/null 2>&1 || { echo "⛔ land-sor: nincs flock a gépen" >&2; return 1; }
  common="$(git rev-parse --path-format=absolute --git-common-dir)" || return 1
  LAND_LOCK_FILE="$common/cit-land.lock"
  : >>"$LAND_LOCK_FILE" || { echo "⛔ land-sor: a zárfájl nem írható ($LAND_LOCK_FILE)" >&2; return 1; }
  ready="$(mktemp)" || return 1
  : >"$ready"
  # $1 = ready flag, $2 = the land's PID. `-o`: the lock fd stays with flock only, not with sh.
  flock -o "$LAND_LOCK_FILE" sh -c 'echo 1 >"$1"; while kill -0 "$2" 2>/dev/null; do sleep 1; done' \
    land-lock "$ready" "$$" </dev/null >/dev/null 2>&1 &
  LAND_LOCK_PID=$!
  trap land_lock_release EXIT
  while [ ! -s "$ready" ]; do
    if ! kill -0 "$LAND_LOCK_PID" 2>/dev/null; then
      rm -f "$ready"
      LAND_LOCK_PID=""
      echo "⛔ land-sor: a flock váratlanul kilépett ($LAND_LOCK_FILE)" >&2
      return 1
    fi
    # 0.2 s ticks (a free lock costs no full second); a loud line on the first wait tick and every ~30 s.
    if [ $((ticks % 150)) -eq 1 ]; then
      holder="$(cat "$LAND_LOCK_FILE.holder" 2>/dev/null)"
      echo "⏳ land-sor: VÁR — a zárat tartja: ${holder:-? (épp most szerzi meg)} · várakozás eddig $((ticks / 5)) s"
    fi
    sleep 0.2
    ticks=$((ticks + 1))
  done
  rm -f "$ready"
  printf '%s · PID %s · %s óta\n' "$root" "$$" "$(date '+%F %T')" >"$LAND_LOCK_FILE.holder"
  echo "🔒 land-sor: zár megszerezve ($((ticks / 5)) s várakozás után) — $LAND_LOCK_FILE"
}

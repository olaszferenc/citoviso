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
  # B: never leave a land-assigned ADR number behind on a failed land — the branch goes back to
  # its placeholder, and the next land assigns a fresh number after its own fetch.
  if [ -n "${ROOT:-}" ] && [ -f "$ROOT/scripts/planning-index.mts" ]; then
    (cd "$ROOT" && npx tsx scripts/planning-index.mts assign --undo) || true
  fi
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

# MACHINE-WIDE LAND QUEUE (scripts/land-lock.sh): the push, its verification and the main-tree refresh run
# under one lock shared by every worktree, so parallel lands never bounce each other's push. Released after
# the main-tree refresh (see below) or, at the latest, when this shell exits.
. "$ROOT/scripts/land-lock.sh"

# TIMING (ADR: `_planning/decisions/*-land-egyszerusites-*`): every phase is measured and printed at the end, with the slowest gates, so the
# land's cost is a number in every log instead of a feeling ("kurva lassú").
LAND_T0=$(date +%s)
LAND_TIMES=""
lap() { LAND_TIMES="$LAND_TIMES · $1 $(( $(date +%s) - $2 )) s"; }
# ⛔ No trap of its own: land-lock.sh's EXIT trap releases the lock, and a second `trap … EXIT` would
# REPLACE it. The file is tiny and removed on the success path; a failed land leaves it in $TMPDIR.
GATE_TIMES_FILE="$(mktemp -t cit-land-times-XXXXXX)"

# land_gates <label> — rebase onto the fetched origin/main, then tsc + the full pre-commit suite on the
# result. The SAME function runs in the optimistic pre-pass and under the lock: one gate sequence, never two.
land_gates() {
  local T
  echo "── land $1: rebase origin/main-re…"
  T=$(date +%s)
  # The two planning indexes are GENERATED: a conflict confined to them is resolved by
  # regenerating (scripts/land-rebase.sh). Any other conflict still aborts loudly.
  if ! bash "$ROOT/scripts/land-rebase.sh"; then
    # land-rebase.sh aborts a conflicted rebase itself; if none is in progress and HEAD is already on
    # origin/main, the rebase SUCCEEDED and a later step (index rebuild / ADR number) failed — saying
    # "rebase-konfliktus" then sent sessions hunting a conflict that did not exist (measured 2026-11-13).
    if [ ! -d "$(git rev-parse --git-path rebase-merge)" ] && [ ! -d "$(git rev-parse --git-path rebase-apply)" ] && \
       git merge-base --is-ancestor origin/main HEAD; then
      fail "a rebase RENDBEN, de az utána jövő lépés (generált index / ADR-szám kiosztás) bukott — az okot lásd fent"
    fi
    git rebase --abort 2>/dev/null || true
    fail "rebase-konfliktus — oldd fel kézzel (git rebase origin/main), majd land újra"
  fi
  lap "$1 rebase" "$T"
  echo "── kapuk ($1): typecheck…"
  T=$(date +%s)
  # ⏱️ INCREMENTAL (2026-11-25, ADR-0480): tsc's own build-info cache, one per worktree (in its git dir, never
  # in the tree). It re-checks exactly the files whose content — or whose dependencies — changed, the
  # official TypeScript mechanism; a type error is reported the same way (red test: rc 2). Measured on a
  # loaded machine: 145 s plain → 28 s with a warm cache. CIT_TSC_FULL=1 = the old full check.
  if [ "${CIT_TSC_FULL:-}" = "1" ]; then
    npx tsc --noEmit -p tsconfig.json || fail "tsc piros"
  else
    npx tsc --noEmit -p tsconfig.json --incremental --tsBuildInfoFile "$(git rev-parse --git-dir)/cit-tsc.tsbuildinfo" || fail "tsc piros"
  fi
  lap "$1 tsc" "$T"
  echo "── kapuk ($1): pre-commit suite a landolt diffre (LAND_RANGE=origin/main...HEAD)…"
  T=$(date +%s)
  : >"$GATE_TIMES_FILE"
  LAND_RANGE="origin/main...HEAD" CIT_GATE_TIMES="$GATE_TIMES_FILE" bash "$ROOT/hooks/pre-commit" || fail "pre-commit kapu piros"
  lap "$1 kapuk" "$T"
}

# ⏱️ OPTIMISTIC PRE-PASS (ADR: `_planning/decisions/*-land-optimista-elokor-*`, measured 2026-11-26): rebase + tsc + gates ran UNDER the lock, 400–900 s
# per land, and every other land queued behind it. Now they run BEFORE the lock, on the then-current
# origin/main. Under the lock the land fetches again: if origin/main is still the very commit the pre-pass
# rebased onto and HEAD is unchanged (land_pregate_valid), the gates already ran on exactly the tree being
# pushed, and the lock is held only for push + verification. Otherwise rebase + tsc + gates run again UNDER
# the lock, exactly as before — no gate is ever skipped for a tree it did not see.
git fetch origin || fail "git fetch origin sikertelen"
if [ -z "$(git log origin/main..HEAD --oneline)" ]; then
  echo "✅ LAND: nincs landolnivaló — az origin/main már tartalmazza a HEAD-et."
  exit 0
fi
land_gates "előkör (zár nélkül)"
PRE_BASE="$(git rev-parse origin/main)"
PRE_HEAD="$(git rev-parse HEAD)"

land_lock_acquire "$ROOT" || fail "a gépszintű land-zár nem szerezhető meg"
LOCK_T0=$(date +%s)
git fetch origin || fail "git fetch origin sikertelen"

ATTEMPT=0
PREGATE_USED=0
while :; do
  ATTEMPT=$((ATTEMPT + 1))
  [ "$ATTEMPT" -gt 3 ] && fail "3 kísérlet alatt is mozgott alólunk a main — futtasd újra"

  if [ -z "$(git log origin/main..HEAD --oneline)" ]; then
    echo "✅ LAND: nincs landolnivaló — az origin/main már tartalmazza a HEAD-et."
    exit 0
  fi

  if [ "$ATTEMPT" -eq 1 ] && land_pregate_valid "$PRE_BASE" "$PRE_HEAD"; then
    PREGATE_USED=1
    echo "── a main az előkör óta nem mozdult ($(git rev-parse --short origin/main)) — az előkör kapui PONTOSAN erre a fára futottak, a zár alatt csak push + visszaellenőrzés"
  else
    [ "$ATTEMPT" -eq 1 ] && echo "── a main az előkör óta mozdult — rebase + kapuk újra, a zár alatt"
    land_gates "#$ATTEMPT"
  fi

  echo "── push origin HEAD:main…"
  if [ "${LAND_FAKE_PUSH:-}" = "1" ]; then
    echo "   (LAND_FAKE_PUSH=1 — a push kihagyva; a visszaellenőrzésnek most buknia KELL)"
  elif ! git push origin HEAD:main; then
    echo "   push elutasítva (a main közben mozgott) — fetch + rebase + kapuk újra (a kiosztott ADR-szám is újra)…"
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
  LOCK_S=$(( $(date +%s) - LOCK_T0 ))
  echo "⏱  land: összesen $(( $(date +%s) - LAND_T0 )) s · a zár alatt $LOCK_S s · előkör $([ "$PREGATE_USED" = 1 ] && echo ÉRVÉNYES || echo újrafutott)${LAND_TIMES}"
  # Persistent ledger (one line per land, shared by all worktrees) so the queue cost is measurable later.
  printf '%s\t%s\ttotal=%s\tlocked=%s\tpregate=%s\t%s\n' "$(date '+%F %T')" "$(basename "$ROOT")" \
    "$(( $(date +%s) - LAND_T0 ))" "$LOCK_S" "$PREGATE_USED" "${LAND_TIMES# · }" \
    >>"$(git rev-parse --path-format=absolute --git-common-dir)/cit-land-times.log" 2>/dev/null || true
  if [ -s "$GATE_TIMES_FILE" ]; then
    echo "   a 10 leglassabb kapu (s):"
    head -10 "$GATE_TIMES_FILE" | sed 's/^/     /'
  fi
  rm -f "$GATE_TIMES_FILE"

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
  # The queue ends here: the push is verified and the main tree refresh + server restart are done
  # (kept inside so two lands never ff/restart at once). Cleanup and warnings below need no lock.
  land_lock_release

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

  # ONTOLÓGIA-FRISSESSÉG — HANGOS, DE NEM KAPU (mérve 2026-09-17).
  # A `_planning/DOMAIN/` az egyetlen dokumentum, amit a `CLAUDE.md` §1 MINDEN sessionnel
  # kötelezően elolvastat; az átvezetése mégis 2026-07-12 óta elmaradt, és NÉMÁN állt elő:
  # 9 feldolgozatlan review, 64 érdemi javaslat, a `01-CALC-MODELS.md` két hónapig a július
  # 4-i, 22 soros vázban. Semmi nem jelzett — nincs notifier, az inbox gitignore-olt.
  #
  # ⚠️ MIÉRT ITT, ÉS MIÉRT `--warn-only`. A land az EGYETLEN pont, amin minden session
  # átmegy (§3.3), tehát ez a legszélesebb csatorna a némaság ellen. Kapuvá tenni viszont
  # tilos: egy HETI karbantartási adósság nem foghatja meg ~25 szál landolását — pontosan
  # az az osztály, amit a `guard-scratch-scope-check` fejléce mér („véletlenszerűen ölték
  # egymás commitjait"). A BLOKKOLÓ ág a `hooks/pre-commit`-ben él, a DOMAIN-t érintő
  # diffre szűkítve — ott az van megállítva, aki éppen az ontológián dolgozik.
  # ⚠️ A land ITT MÁR SIKERES (a push igazolva, §3.3) — ez a sor csak kiír, sosem dönt.
  if [ -f "$ROOT/scripts/domain-inbox-freshness-check.mts" ]; then
    npx tsx "$ROOT/scripts/domain-inbox-freshness-check.mts" --warn-only \
      || echo "⚠️  domain-inbox-freshness nem futott le (a land ettől érvényes) — kézzel: npx tsx scripts/domain-inbox-freshness-check.mts"
  fi
  exit 0
done

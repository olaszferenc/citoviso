#!/usr/bin/env bash
# land-rebase — the rebase step of scripts/land.sh, split out so a scenario check can run the
# REAL code path in a throwaway repo (land.sh itself refreshes the main tree and restarts the
# :4600/:4800 servers — never run that in a test).
#
# Rebases HEAD onto origin/main. A conflict is resolved automatically ONLY when every conflicted
# path is one of the two GENERATED planning indexes (`_planning/DECISIONS.md`,
# `_planning/memory/INDEX.md`): `planning-index.mts rebase-resolve` regenerates them from the
# per-file sources, and carries a legacy single-file ADR edit into its own file. Any other
# conflict aborts the rebase — exactly as before (exit 1, nothing lost).
#
# ⚠️ Worktree trap (feedback_my_fixup_tool_damaged_another_thread): in a worktree `.git` is a
# FILE, so `[ -d .git/rebase-merge ]` is always false. The rebase state is located with
# `git rev-parse --git-path`, which resolves correctly in both layouts.
set -u
ROOT="$(git rev-parse --show-toplevel)" || exit 1
cd "$ROOT"

in_rebase() {
  [ -d "$(git rev-parse --git-path rebase-merge)" ] || [ -d "$(git rev-parse --git-path rebase-apply)" ]
}

# B: a previous land attempt may have assigned a number and then been rejected (push race, red
# gate). That assignment is undone first, so this round assigns a FRESH number after its fetch.
# (A branch from before the migration has no tool yet — the rebase below brings it in.)
if [ -f scripts/planning-index.mts ]; then
  npx tsx scripts/planning-index.mts assign --undo || exit 1
fi

if ! git rebase origin/main; then
  in_rebase || exit 1 # the rebase refused to even start (e.g. dirty tree) — nothing to resolve
fi

ROUND=0
while in_rebase; do
  ROUND=$((ROUND + 1))
  if [ "$ROUND" -gt 200 ]; then
    git rebase --abort 2>/dev/null
    echo "⛔ land-rebase: 200 feloldási kör után sincs vége — megszakítva" >&2
    exit 1
  fi
  if ! npx tsx scripts/planning-index.mts rebase-resolve; then
    git rebase --abort 2>/dev/null
    exit 1
  fi
  # A commit whose only effect was the (now regenerated) index adds nothing on top of main.
  if git diff --cached --quiet; then
    GIT_EDITOR=true git rebase --skip >/dev/null 2>&1 || true
  else
    GIT_EDITOR=true git rebase --continue >/dev/null 2>&1 || true
  fi
  # `--continue` exits non-zero when the NEXT commit conflicts; the loop handles that round.
  if in_rebase && [ -z "$(git diff --name-only --diff-filter=U)" ]; then
    git rebase --abort 2>/dev/null
    echo "⛔ land-rebase: a rebase ütköző fájl nélkül állt meg — megszakítva, kézi vizsgálat kell" >&2
    exit 1
  fi
done

# A textually clean merge of the two indexes can still differ from what the sources generate
# (e.g. two sessions' lines merged in a different order). The index is derived data: rebuild it
# and record the rebuild as its own commit, so the land gate sees a fresh index.
npx tsx scripts/planning-index.mts build >/dev/null || exit 1
if ! git diff --quiet -- _planning/DECISIONS.md _planning/memory/INDEX.md; then
  git add -- _planning/DECISIONS.md _planning/memory/INDEX.md
  git commit -q --no-verify -m "chore(index): a generált döntés- és memória-index újraépítve a rebase után" || exit 1
  echo "   ↻ a generált indexek újraépítve (külön commit)"
fi
# B: the placeholder ADR (if any) gets its number NOW — after the last fetch+rebase, right before
# the gates and the push. Rewrites only this branch's added lines; post-conditions or a loud stop.
npx tsx scripts/planning-index.mts assign || exit 1
exit 0

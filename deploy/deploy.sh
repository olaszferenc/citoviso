#!/usr/bin/env bash
# Citoviso deploy — SKELETON. Enforces the CLAUDE.md §0 doctrine:
#   local-first, push ONLY changed files, live writes need explicit per-turn
#   approval. There is NO live target configured yet, so this refuses to run
#   until DEPLOY_TARGET is set intentionally.
set -euo pipefail

TARGET="${DEPLOY_TARGET:-}"

if [ -z "$TARGET" ]; then
  echo "!! Nincs éles cél beállítva (DEPLOY_TARGET üres)."
  echo "   A Citoviso éles infrastruktúrája még nincs kialakítva — lásd CLAUDE.md §0.5."
  echo "   Élesre tolni CSAK explicit, current-turn user-engedéllyel szabad."
  exit 1
fi

# When a target exists, deploy must:
#   1) list exactly the changed files (git diff --name-only) and confirm,
#   2) copy ONLY those files (never the whole tree),
#   3) run any build/migrate step behind an explicit confirmation,
#   4) purge CDN cache if applicable.
echo "TODO: implement scoped deploy to '$TARGET' (only changed files)."
exit 1

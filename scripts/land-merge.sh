#!/usr/bin/env bash
# land-merge — record a branch (the hotfix line) as merged into main WITHOUT changing main's content,
# through the machine-wide land queue (ADR-XXXX).
#
#   bash scripts/land-merge.sh <ref> ["<message>"]
#
# The hotfix flow (only the hotfix branch may go live; main's country layer may not) needs main to
# contain each hotfix commit so the deploy's "only commits on origin/main" gate accepts it. Until
# 2026-11-26 this was a hand-made `git merge -s ours` + `git push HEAD:main` — past the land queue,
# so every one bounced the land that was running (hooks/pre-push now refuses that). Here, under the
# lock: fetch → a merge commit whose TREE IS origin/main's own tree (byte-for-byte: no content
# change, so no gate can change its verdict and none is run) with parents origin/main + <ref> →
# push → verification. Seconds, not a land.
set -euo pipefail
fail() { echo "⛔ land-merge: $*" >&2; exit 1; }
REF="${1:?használat: bash scripts/land-merge.sh <ref> [\"<üzenet>\"]}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
. "$(dirname "$(readlink -f "$0")")/land-lock.sh"
land_lock_acquire "$ROOT" || fail "a gépszintű land-zár nem szerezhető meg"

git fetch -q origin || fail "git fetch origin sikertelen"
SHA="$(git rev-parse --verify -q "$REF^{commit}")" || fail "ismeretlen ref: $REF"
if git merge-base --is-ancestor "$SHA" origin/main; then
  echo "✅ land-merge: az origin/main már tartalmazza ($(git rev-parse --short "$SHA")) — nincs teendő."
  land_lock_release
  exit 0
fi
MSG="${2:-merge(hotfix): $(git rev-parse --short "$SHA") a mainbe -s ours (land-merge.sh)}"
M="$(git commit-tree "origin/main^{tree}" -p origin/main -p "$SHA" -m "$MSG")"
git push -q origin "$M:refs/heads/main" || fail "a push nem ment (a hook vagy a távoli elutasította)"
git fetch -q origin || fail "git fetch sikertelen a visszaellenőrzésnél"
git merge-base --is-ancestor "$SHA" origin/main || fail "a push UTÁN az origin/main nem tartalmazza: $SHA"
[ "$(git rev-parse "origin/main^{tree}")" = "$(git rev-parse "$M^{tree}")" ] || fail "az origin/main fája nem a merge fája"
echo "✅ LAND-MERGE: IGAZOLTAN FENT — origin/main=$(git rev-parse --short origin/main) tartalmazza $(git rev-parse --short "$SHA")-t, a main tartalma változatlan."
land_lock_release

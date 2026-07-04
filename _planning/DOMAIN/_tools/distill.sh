#!/usr/bin/env bash
#
# Vitrino ontology distiller — glue layer (_planning/DOMAIN).
# Adapted from the MineREAL distiller. DUMB on purpose: it only
#   1. finds THIS repo's OWN episodic memory dir (scoped by repo path),
#   2. diffs its files against the manifest -> the NEW/CHANGED set,
#   3. bundles that set and hands it to a context-aware `claude -p` agent,
#   4. drops the agent's review document into _inbox/ for human review,
#   5. records the considered files in the manifest (idempotency).
#
# The agent does NOT modify the ontology; a human applies the reviewed diff.
# Read-only against the codebase; the only writes are inside _inbox/.
#
# ISOLATION: the memory dir is derived from THIS repo's path, so the distiller
# only ever sees vitrino memory — never minereal's (and vice versa).

set -euo pipefail

# --- paths (repo root is two levels up from _tools) ------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"
DOMAIN="$REPO/_planning/DOMAIN"
TOOLS="$DOMAIN/_tools"
INBOX="$DOMAIN/_inbox"
WORK="$INBOX/.work"
MANIFEST="$TOOLS/.distill-manifest"
PROMPT="$TOOLS/distill-prompt.md"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$INBOX/${STAMP}.md"

log() { printf '[distill %s] %s\n' "$(date -u +%H:%M:%S)" "$*" >&2; }

# --- 1. discover THIS repo's memory dir (scoped by repo path) ---------------
# The harness stores per-project memory at ~/.claude/projects/<path-with-slashes-as-dashes>.
# Deriving from REPO guarantees we never read another project's memory.
MEM_DIRS=()
LOCAL_MEM="$HOME/.claude/projects/$(printf '%s' "$REPO" | sed 's#/#-#g')/memory"
[ -e "$LOCAL_MEM" ] && LOCAL_MEM="$(readlink -f "$LOCAL_MEM")"
[ -d "${LOCAL_MEM:-}" ] && MEM_DIRS+=("$LOCAL_MEM")
# Also consider the gitted planning memory (curated layer), if distinct.
GIT_MEM="$REPO/_planning/memory"
if [ -d "$GIT_MEM" ] && [ "$(readlink -f "$GIT_MEM")" != "${LOCAL_MEM:-}" ]; then
  MEM_DIRS+=("$GIT_MEM")
fi

if [ "${#MEM_DIRS[@]}" -eq 0 ]; then
  log "no memory directory found for $REPO — nothing to do"
  exit 0
fi
log "memory sources: ${MEM_DIRS[*]}"

# --- 2. compute current hashes, diff against manifest ----------------------
mkdir -p "$WORK"
touch "$MANIFEST"
CUR="$WORK/current-hashes.txt"
: > "$CUR"
for d in "${MEM_DIRS[@]}"; do
  find "$d" -maxdepth 1 -type f -name '*.md' ! -name 'MEMORY.md' ! -name 'INDEX.md' -print0 \
    | xargs -0 -r sha256sum >> "$CUR"
done

NEWLIST="$WORK/new-files.txt"
: > "$NEWLIST"
while IFS= read -r line; do
  [ -z "$line" ] && continue
  h="${line%% *}"
  p="${line#*  }"
  b="$(basename "$p")"
  if ! grep -qF "$h  $b" "$MANIFEST" 2>/dev/null; then
    printf '%s\n' "$p" >> "$NEWLIST"
  fi
done < "$CUR"

NEW_COUNT="$(wc -l < "$NEWLIST" | tr -d ' ')"
if [ "$NEW_COUNT" -eq 0 ]; then
  log "no new or changed memories since last run — nothing to distill"
  rm -rf "$WORK"
  exit 0
fi
log "$NEW_COUNT new/changed memory file(s) to consider"

# --- 3. bundle the new memories -------------------------------------------
BUNDLE="$WORK/new-memories.md"
{
  echo "# NEW / CHANGED episodic memories ($NEW_COUNT) — distiller input"
  echo
  while IFS= read -r f; do
    echo "---"
    echo "## FILE: $(basename "$f")"
    echo
    cat "$f"
    echo
  done < "$NEWLIST"
} > "$BUNDLE"

# --- 4. run the context-aware agent ---------------------------------------
cd "$REPO"
log "invoking claude -p (this can take 1-3 min)…"
set +e
{
  echo "# Distill review — $STAMP"
  echo
  claude -p "$(cat "$PROMPT")" \
    --disallowedTools "Write Edit NotebookEdit" \
    2>"$WORK/claude.err"
} > "$OUT"
RC=$?
set -e

if [ $RC -ne 0 ]; then
  log "claude -p failed (rc=$RC) — see $WORK/claude.err ; manifest NOT updated"
  exit $RC
fi

# --- 5. record considered files in the manifest (idempotency) --------------
{
  echo "# updated $STAMP"
  while IFS= read -r f; do
    h="$(sha256sum "$f" | awk '{print $1}')"
    echo "$h  $(basename "$f")"
  done < "$NEWLIST"
} >> "$MANIFEST"

rm -rf "$WORK"

# --- 6. notify (optional) --------------------------------------------------
# Vitrino has no ticketing yet; if a notifier helper appears later, it fires.
NOTIFY="$TOOLS/notify.sh"
if [ -x "$NOTIFY" ]; then
  "$NOTIFY" "$OUT" >>"$INBOX/notify.log" 2>&1 || log "notify failed (non-fatal)"
fi

log "DONE — review document: $OUT"
log "Next: read it, apply the PROMOTE/REFINE blocks to _planning/DOMAIN, then git commit."
echo "$OUT"

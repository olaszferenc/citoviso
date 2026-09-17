#!/usr/bin/env bash
#
# Citoviso ontology distiller — THE NOTIFIER.
#
# The hook in `distill.sh` has always been here ("if a notifier helper appears later, it
# fires") — the file was not. So `[ -x ]` was false every week and the step was skipped in
# SILENCE, which is how 9 reviews / 62 actionable suggestions piled up unread in a gitignored
# `_inbox/` between 2026-07-12 and 2026-09-13.
#
# This wrapper is deliberately thin: bash is what the hook can call, but the decision needs the
# freshness guard's predicate (`readCorpus` + `judge`), which is TypeScript. Re-implementing the
# conjunction in bash would give us the same rule in two copies — and a rule in two copies is
# two truths. So: the shell finds tsx, the TypeScript decides and sends.
#
#   notify.sh [review-file]                  # DRY by default — nothing leaves the machine
#   notify.sh [review-file] --mode=send      # live send (this is what cron passes)
#
# ⛔ FAIL-CLOSED: no `--mode=send` ⇒ no send; an unknown switch ⇒ exit 2, nothing sent.
# ⛔ EXECUTABLE BIT IS LOAD-BEARING: the hook tests `[ -x ]`. If this file loses +x, the
#    notifier goes silent again exactly as before — `scripts/distill-notify-check.mts` asserts it.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SCRIPT_DIR/../../.." && pwd)"

cd "$REPO"
exec npx tsx "$SCRIPT_DIR/notify.mts" "$@"

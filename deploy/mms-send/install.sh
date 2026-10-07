#!/usr/bin/env bash
# Install the repo's mms-send onto THIS Debian box (the one with the GSM modem).
#
#   bash deploy/mms-send/install.sh            # dry-run: selftest + diff against the installed copy
#   sudo bash deploy/mms-send/install.sh --go  # backup + install + verify (byte-equal + selftest)
#
# ⛔ The modem is live during the mock-outreach window (weekdays 9–16, ADR-0334):
# install only outside it, never while an mms-send runs (the script refuses then).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)/mms-send"
DST=/usr/local/bin/mms-send
LOCK=/var/lock/mms-send.lock

echo "① selftest (mock modem, no hardware)"
python3 "$SRC" --selftest

echo "② diff: $DST ← $SRC"
if [[ -f "$DST" ]] && cmp -s "$SRC" "$DST"; then
  echo "   azonos — nincs teendő"
  exit 0
fi
diff -u "$DST" "$SRC" | head -40 || true

if [[ "${1:-}" != "--go" ]]; then
  echo "dry-run — telepítés: sudo bash $0 --go"
  exit 0
fi
[[ $EUID -eq 0 ]] || { echo "root kell (sudo)"; exit 1; }

# Refuse while a send holds the modem (the tool's own flock).
exec 9>"$LOCK"
flock -n 9 || { echo "⛔ egy mms-send éppen fut — próbáld később"; exit 1; }

BAK="$DST.bak-$(date +%Y%m%d-%H%M%S)"
[[ -f "$DST" ]] && cp -p "$DST" "$BAK" && echo "③ mentés: $BAK"
install -m 0755 -o root -g root "$SRC" "$DST"

echo "④ visszamérés"
cmp -s "$SRC" "$DST" || { echo "⛔ a telepített fájl ELTÉR a forrástól"; exit 1; }
python3 "$DST" --selftest
echo "IGAZOLTAN TELEPÍTVE: $DST ($(sha256sum "$DST" | cut -c1-12))"

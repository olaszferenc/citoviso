#!/usr/bin/env bash
# Local embedded Postgres control (userspace, no sudo, no system service).
# Binaries come from the embedded-postgres npm package; data lives in .pgdata.
# Usage: scripts/db.sh {up|down|status|logs}
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BIN="$ROOT/node_modules/@embedded-postgres/linux-x64/native/bin"
PGDATA="$ROOT/.pgdata"
PORT="${PGPORT:-5433}"
SOCKET_DIR="${PGSOCKET_DIR:-/tmp}"

if [ ! -f "$PGDATA/PG_VERSION" ]; then
  echo "No cluster at $PGDATA — run initdb first (see README/db setup)." >&2
  exit 1
fi

case "${1:-}" in
  up)
    "$BIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCKET_DIR" -l "$PGDATA/server.log" start
    ;;
  down)
    "$BIN/pg_ctl" -D "$PGDATA" stop
    ;;
  status)
    "$BIN/pg_ctl" -D "$PGDATA" status
    ;;
  logs)
    tail -n 40 "$PGDATA/server.log"
    ;;
  *)
    echo "usage: scripts/db.sh {up|down|status|logs}" >&2
    exit 1
    ;;
esac

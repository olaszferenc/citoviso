#!/usr/bin/env bash
# DEV MENTÉS — a fejlesztői adatbázis (citoviso_dev) önellenőrző mentése.
#
# MIÉRT KELL (2026-09-09-i mérés): az ADR-0086 napi mentése az ÉLEST húzza le, a
# dev adatbázisnak NULLA mentése volt. Közben a dev DB nem „eldobható tesztadat":
# benne ül a 595 leades korpusz és 2 119 provenance-sor, ami hetek scrape-munkája
# és AI-költsége — és amit egyetlen gépen tartunk. Ráadásul ~10 párhuzamos session
# OSZTOZIK rajta (CLAUDE.md §5), és a teszt-tenantokat menet közben törlik: a
# 2026-09-08-i purge 2 tenantot, 10 prospectet és 78 artifactot vitt el. Ott a
# mentést kézzel írta meg a session, és két kaszkádban pusztuló tábla ki is maradt
# belőle. Az „aki töröl, az ment" nem működött; ezért ütemezett és önellenőrző.
#
# A MENTÉS ELLENŐRZI MAGÁT — ugyanazzal a kóddal, mint az éles (lib/backup-verify.sh):
# minden futás visszaállítja a dumpot egy eldobható adatbázisba, és soronként
# összeveti a forrással. Egy néma, csonka mentés rosszabb a semminél.
#
#   bash scripts/backup-dev.sh                             # mentés + ellenőrzés
#   bash scripts/backup-dev.sh --verify-only <könyvtár>    # meglévő mentés újraellenőrzése
#
# Kizárólag LOKÁLIS: az élest nem érinti sem olvasásban, sem írásban.
set -euo pipefail

PGH="${PGHOST:-/tmp}"
PGP="${PGPORT:-5433}"
PGU="${PGUSER:-postgres}"
DEV_DB="${PGDATABASE:-citoviso_dev}"
# ⚠️ KÜLÖN nevű eldobható adatbázis: az éles mentés a citoviso_restore_check-et
# használja, és ha a két futás átfedne, az egyik eldobná a másik félig
# visszaállított adatbázisát a másik ellenőrzése közben.
VERIFY_DB=citoviso_dev_restore_check
REQUIRE_SITES=0
SOURCE_LABEL="a dev DB-ben"

ROOT="$HOME/backups/citoviso-dev"
SNAPS="$ROOT/snapshots"
MONTHLY="$ROOT/monthly"
# Négy futás naponta × 7 nap. A dev DB napközben mozog (purge, teszt-tenant
# törlés), ezért nem elég a napi egy: egy délelőtti törlés után a legutolsó jó
# állapot ne legyen 20 órás.
KEEP_SNAPS=28
KEEP_MONTHLY=12

# A fő fa sites/ fája — a mentendő rész a VALÓDI tenant/artifact könyvtárak.
# ⚠️ Az `_`-sal kezdődő könyvtárak (mérés-shotok, engine-proof) KIMARADNAK:
# mérve 249 MB-ból 242 MB az `_engine-proof`, ami determinisztikusan
# újragenerálható próba-kimenet, nem adat. Ha ezt is mentenénk, 28 pillanatkép
# 7 GB-ot enne, és a valódi 164 KB adat elveszne a zajban.
SITES_SRC="$HOME/citoviso/sites"

# shellcheck source=scripts/lib/backup-verify.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib/backup-verify.sh"

if [ "${1:-}" = "--verify-only" ]; then
  [ -n "${2:-}" ] || fail "használat: --verify-only <mentés-könyvtár>"
  verify_dir "$2"
  exit 0
fi

TS="$(date +%Y%m%d-%H%M%S)"
DEST="$SNAPS/$TS"
mkdir -p "$SNAPS" "$MONTHLY"
# A dev DB is tartalmaz személyes adatot (595 valódi szálláshely kontaktjai) —
# a mentés csak a tulajé.
chmod 700 "$ROOT" "$SNAPS" "$MONTHLY"

echo "── dev mentés → $DEST"
TMP="$DEST.reszleges"
rm -rf "$TMP"
mkdir -p "$TMP"
chmod 700 "$TMP"
# Részleges könyvtárba dolgozunk, és CSAK sikeres ellenőrzés után nevezzük át:
# egy megszakadt futás így sosem tűnik kész mentésnek.

assert_client_matches_server

echo "── sor-manifeszt (a tábla-lista a DB-BŐL jön, nem kézi listából)…"
# A hatókör SZÁRMAZTATOTT, nem felsorolt: egy kézi lista némán kihagyná az új,
# sosem mentett táblát — pontosan ez történt a 09-08-i purge mentésével, ahol két
# kaszkád-tábla kimaradt (feedback_guard_scope_is_the_doctrine).
COUNT_SQL="$("$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d "$DEV_DB" -t -A -c "
  SELECT string_agg(format('SELECT %L::text AS t, count(*)::text AS n FROM %I', tablename, tablename), ' UNION ALL ')
  FROM pg_tables WHERE schemaname='public'")"
[ -n "$COUNT_SQL" ] || fail "nem sikerült kiolvasni a dev tábla-listát"
"$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d "$DEV_DB" -t -A -F'|' -c "$COUNT_SQL ORDER BY 1" \
  > "$TMP/counts.tsv" || fail "nem sikerült lekérdezni a dev sorszámokat"
sed -i '/^[[:space:]]*$/d' "$TMP/counts.tsv"
[ -s "$TMP/counts.tsv" ] || fail "üres a sor-manifeszt"
echo "   $(wc -l < "$TMP/counts.tsv") tábla, összesen $(awk -F'|' '{s+=$2} END{print s}' "$TMP/counts.tsv") sor"

echo "── pg_dump (custom formátum, tömörítve)…"
"$PG_DUMP" -h "$PGH" -p "$PGP" -U "$PGU" -Fc -Z6 -d "$DEV_DB" > "$TMP/db.dump" \
  || fail "a pg_dump nem futott le"
[ -s "$TMP/db.dump" ] || fail "a dump ÜRES"
# Az összeg a KIÍRÁSKOR készül — enélkül a későbbi csonkolás észrevétlen marad
# (mérve: a pg_restore egy 95%-ra vágott archívumra is exit 0-t ad).
( cd "$TMP" && sha256sum db.dump > db.dump.sha256 )

# A valódi site-fák (a `_`-os mérés-könyvtárak nélkül — lásd a fenti indoklást).
if [ -d "$SITES_SRC" ]; then
  echo "── sites/ (a valódi tenant/artifact fák, a mérés-könyvtárak nélkül)…"
  mkdir -p "$TMP/sites"
  rsync -a --exclude='_*' "$SITES_SRC/" "$TMP/sites/" || fail "a sites/ nem másolódott"
fi

# Melyik kódra áll vissza — enélkül egy régi dump sémája nem párosítható kódhoz.
git -C "$HOME/citoviso" rev-parse HEAD > "$TMP/main-tree-head.txt" 2>/dev/null || true

echo "── ellenőrzés (visszaállítás eldobható adatbázisba)…"
verify_dir "$TMP"

rm -rf "$DEST"
mv "$TMP" "$DEST"
date -Is > "$DEST/OK"

# Havi archív: a hónap első sikeres mentése hosszú távra megmarad.
MON="$(date +%Y-%m)"
if [ ! -d "$MONTHLY/$MON" ]; then
  cp -a "$DEST" "$MONTHLY/$MON"
  echo "── havi archív létrehozva: $MONTHLY/$MON"
fi

# Félbeszakadt futások maradványai. ⚠️ ELŐBB takarítunk, MINT rotálunk: egy
# `.reszleges` könyvtár is illeszkedik a `*/` glóbra, tehát pillanatképnek
# számítana, és egy bukott futás maradványa kiszoríthatná a legrégebbi JÓ
# mentést (mérve az első futáson: „pillanatkép: 2 db", pedig egy volt).
find "$SNAPS" -maxdepth 1 -name '*.reszleges' -mmin +120 -exec rm -rf {} + 2>/dev/null || true

# Csak a kész (OK-jelölt) pillanatképek rotálnak — a lista sosem tartalmazhat
# félkész könyvtárat.
snapshot_dirs() { find "$SNAPS" -mindepth 2 -maxdepth 2 -name OK -printf '%h\n' 2>/dev/null | sort; }

# Rotáció — CSAK sikeres mentés után fut, hogy egy bukott futás sose egye meg az
# utolsó jó mentést.
snapshot_dirs | head -n -"$KEEP_SNAPS" | xargs -r rm -rf
ls -1d "$MONTHLY"/*/ 2>/dev/null | sort | head -n -"$KEEP_MONTHLY" | xargs -r rm -rf

grn "✅ DEV MENTÉS KÉSZ: $DEST  ($(du -sh "$DEST" | cut -f1))"
echo "   pillanatkép: $(snapshot_dirs | wc -l) db · havi: $(ls -1d "$MONTHLY"/*/ 2>/dev/null | wc -l) db"

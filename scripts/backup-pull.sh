#!/usr/bin/env bash
# ÉLES MENTÉS — a dev gép LEHÚZZA az élest (ADR-0085).
#
# MIÉRT PULL, nem push: ha az éles gépet feltörik vagy a lemez elszáll, a mentés
# ne legyen elérhető ONNAN. Az éles nem tud a mentésekhez nyúlni; a dev gépnek van
# SSH-kulcsa az élesre, fordítva nincs. Egy zsarolóvírus így nem viszi a másolatot.
#
# MIÉRT KELL EGYÁLTALÁN (2026-08-30-i mérés): a gépen NULLA ütemezett mentés volt.
# Az egyetlen dump akkor készült, ha épp futott egy migráció (deploy-prod.sh GATE 3)
# — vagyis egy nyugodt hónapban EGY SEM. Az utolsó 4 napos volt, közben 419 lead,
# az élő tenant és a bizonylatok mind egyetlen lemezen álltak.
#
# A MENTÉS ELLENŐRZI MAGÁT. Egy néma, csonka mentés rosszabb a semminél, mert
# biztonságérzetet ad: ezért minden futás VISSZA IS ÁLLÍTJA a dumpot egy eldobható
# adatbázisba, és soronként összeveti az élessel. Ami nem egyezik, az hangosan bukik.
#
#   bash scripts/backup-pull.sh            # mentés + ellenőrzés
#   bash scripts/backup-pull.sh --verify-only <könyvtár>   # egy meglévő mentés újraellenőrzése
#
# Csak OLVAS az élesről (pg_dump + rsync) — élesi írást soha nem végez (CLAUDE.md §0.4).
set -euo pipefail

HOST=178.104.3.223
KEY="$HOME/.ssh/citoviso_hetzner"
SSH="ssh -i $KEY -o ConnectTimeout=20 -o BatchMode=yes root@$HOST"
REMOTE_DB=citoviso
REMOTE_APP=/opt/citoviso/app
ROOT="$HOME/backups/citoviso"
DAILY="$ROOT/daily"
MONTHLY="$ROOT/monthly"
KEEP_DAILY=14
KEEP_MONTHLY=12
# A dev gépi Postgres, ahova az ellenőrző visszaállítás megy (a fő fa embedded példánya).
PGH=/tmp
PGP=5433
PGU=postgres
VERIFY_DB=citoviso_restore_check
# ⚠️ A tábla-lista SZÁRMAZTATOTT, nem kézzel karbantartott: az élesen ténylegesen
# létező public táblákból jön. Kézi listával az első futás elhasalt, mert a dev
# előrébb járt (a tenant_message még nem volt kint) — és egy kézi lista a fordított
# esetben NÉMÁN kihagyna egy új, sosem mentett táblát. A hatókör legyen származtatott,
# ne felsorolt (feedback_guard_scope_is_the_doctrine).
TABLES=()

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
fail() { red "⛔ MENTÉS BUKOTT: $*"; exit 1; }

# ── Egy meglévő mentés ellenőrzése (a mentés utáni önteszt és a kézi újraellenőrzés
#    ugyanaz a kód — külön „ellenőrző" implementáció idővel elcsúszna a valóditól).
verify_dir() {
  local dir="$1"
  local dump="$dir/db.dump"
  local manifest="$dir/counts.tsv"
  [ -s "$dump" ] || fail "nincs vagy üres a dump: $dump"
  [ -s "$manifest" ] || fail "nincs sor-manifeszt: $manifest"

  # A várt táblák MINDIG a manifesztből jönnek, sosem egy kódba írt listából —
  # így a --verify-only ág önállóan is működik, és nem tud elcsúszni a valóságtól.
  local -a want_tables
  mapfile -t want_tables < <(cut -d"|" -f1 "$manifest")
  [ "${#want_tables[@]}" -gt 0 ] || fail "a manifeszt nem tartalmaz táblát"

  # 1) Formai épség: a pg_restore ki tudja-e olvasni a tartalomjegyzéket.
  pg_restore -l "$dump" > "$dir/toc.txt" 2>/dev/null || fail "a dump nem olvasható (sérült archívum)"
  for t in "${want_tables[@]}"; do
    # Üres tábla adat-blokkot nem ír a pg_dump, ezért csak a NEM üresekre kötelező.
    n=$(awk -F'|' -v k="$t" '$1==k{print $2}' "$manifest")
    if [ "${n:-0}" -gt 0 ]; then
      grep -q "TABLE DATA public $t " "$dir/toc.txt" \
        || fail "a dumpból HIÁNYZIK a(z) '$t' tábla adata ($n sor lenne)"
    fi
  done

  # 2) A lényegi próba: TÉNYLEG visszaáll-e. Eldobható adatbázisba állítjuk vissza —
  #    a „létezik a fájl" nem mentés, a „visszaáll és annyi sor van benne" az.
  psql -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c \
    "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
  psql -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c \
    "CREATE DATABASE $VERIFY_DB" >/dev/null
  # A --no-owner/--no-acl kell: az éles 'citoviso' szerep a dev gépen nem létezik.
  if ! pg_restore --no-owner --no-acl --exit-on-error \
       -h "$PGH" -p "$PGP" -U "$PGU" -d "$VERIFY_DB" "$dump" > "$dir/restore.log" 2>&1; then
    red "── a visszaállítás naplója:"; tail -20 "$dir/restore.log"
    psql -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
    fail "a dump NEM állítható vissza"
  fi

  # 3) Sorszám-egyezés az élessel. Ez méri azt, ami SZÁMÍT (megvan-e az adat),
  #    nem a kényelmes proxyt (létezik-e a fájl).
  local bad=0
  while IFS='|' read -r tbl want; do
    got=$(psql -h "$PGH" -p "$PGP" -U "$PGU" -d "$VERIFY_DB" -t -A \
            -c "SELECT count(*) FROM \"$tbl\"" 2>/dev/null || echo "HIBA")
    if [ "$got" != "$want" ]; then
      red "   ✗ $tbl: élesen $want sor, a mentésben $got"
      bad=1
    else
      printf '   ✓ %-16s %s sor\n' "$tbl" "$got"
    fi
  done < "$manifest"

  psql -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
  [ "$bad" -eq 0 ] || fail "a visszaállított adat NEM egyezik az élessel"

  # 4) A fájlos oldal (bizonylat-képek, tenant-fotók) is legyen ott.
  [ -d "$dir/sites" ] || fail "hiányzik a sites/ fa"
  grn "✅ ellenőrzés zöld: a mentés visszaállítható és soronként egyezik az élessel"
}

if [ "${1:-}" = "--verify-only" ]; then
  [ -n "${2:-}" ] || fail "használat: --verify-only <mentés-könyvtár>"
  verify_dir "$2"
  exit 0
fi

TS="$(date +%Y%m%d-%H%M%S)"
DAY="$(date +%Y-%m-%d)"
DEST="$DAILY/$DAY"
mkdir -p "$DAILY" "$MONTHLY"
# A mentés ÉRZÉKENY (bizonylat, személyes adat, .env-titkok) — csak a tulajnak.
chmod 700 "$ROOT" "$DAILY" "$MONTHLY"

echo "── mentés → $DEST"
TMP="$DEST.reszleges-$TS"
mkdir -p "$TMP"
# Rétegzett védelem: a szülő 700, de maga a mentés-könyvtár is az legyen — bizonylat,
# személyes adat és .env-titkok vannak benne.
chmod 700 "$TMP"
# Részleges könyvtárba dolgozunk, és CSAK sikeres ellenőrzés után nevezzük át:
# egy megszakadt futás így sosem tűnik kész mentésnek.

echo "── éles sor-manifeszt (a tábla-lista az ÉLESBŐL jön)…"
# EGY kör: minden public tábla neve + sorszáma. Egyetlen SSH-hívás, nem táblánként
# egy — és a lista sosem csúszhat el attól, ami valóban odakint van.
# Pontos (nem becsült) sorszám táblánként, dinamikusan összerakott UNION-nal, EGY
# lekérdezésben — így nem nyitunk 50 SSH-kapcsolatot.
COUNT_SQL="$($SSH "sudo -u citoviso psql -d $REMOTE_DB -t -A -c \"
  SELECT string_agg(format('SELECT %L::text AS t, count(*)::text AS n FROM %I', tablename, tablename), ' UNION ALL ')
  FROM pg_tables WHERE schemaname='public'\"" </dev/null 2>/dev/null | tr -d '\r')"
[ -n "$COUNT_SQL" ] || fail "nem sikerült kiolvasni az éles tábla-listát"
# ⚠️ Elválasztó: CSŐ, nem tabulátor. A -F'\t' az SSH kettős idézésén át literális
# „\t" karakterpárként érkezett meg, és az egész sor egyetlen mezővé olvadt (az első
# futáson minden tábla „HIBA"-ként bukott). Táblanév és szám nem tartalmaz csövet.
$SSH "sudo -u citoviso psql -d $REMOTE_DB -t -A -F'|' -c \"$COUNT_SQL ORDER BY 1\"" </dev/null \
  > "$TMP/counts.tsv" 2>/dev/null || fail "nem sikerült lekérdezni az éles sorszámokat"
# Üres sorok ki, majd a listát innen vesszük át a formai ellenőrzéshez is.
sed -i '/^[[:space:]]*$/d' "$TMP/counts.tsv"
[ -s "$TMP/counts.tsv" ] || fail "üres a sor-manifeszt"
mapfile -t TABLES < <(cut -d"|" -f1 "$TMP/counts.tsv")
echo "   ${#TABLES[@]} tábla, összesen $(awk -F'|' '{s+=$2} END{print s}' "$TMP/counts.tsv") sor"

echo "── pg_dump (custom formátum, tömörítve)…"
$SSH "sudo -u citoviso pg_dump -Fc -Z6 -d $REMOTE_DB" </dev/null > "$TMP/db.dump" \
  || fail "a pg_dump nem futott le"
[ -s "$TMP/db.dump" ] || fail "a dump ÜRES"

echo "── sites/ fa (bizonylat-képek, tenant-fotók)…"
rsync -a --delete -e "ssh -i $KEY -o BatchMode=yes" \
  "root@$HOST:$REMOTE_APP/sites/" "$TMP/sites/" || fail "a sites/ nem jött át"

echo "── .env (a visszaállításhoz kell; 600-as jogosultsággal)…"
$SSH "cat $REMOTE_APP/.env" </dev/null > "$TMP/env.txt" 2>/dev/null || true
chmod 600 "$TMP/env.txt" 2>/dev/null || true

# Mi futott élesen — enélkül a visszaállítás nem tudja, melyik kódra állítson vissza.
$SSH "git -C $REMOTE_APP rev-parse HEAD; cat /opt/citoviso/DEPLOYED 2>/dev/null" </dev/null \
  > "$TMP/deployed.txt" 2>/dev/null || true

echo "── ellenőrzés (visszaállítás eldobható adatbázisba)…"
verify_dir "$TMP"

rm -rf "$DEST"
mv "$TMP" "$DEST"
date -Is > "$DEST/OK"

# Havi archív: a hónap első sikeres mentése megmarad hosszú távra (a megőrzési
# kötelezettség évekről szól, a napi rotáció két hétről).
MON="$(date +%Y-%m)"
if [ ! -d "$MONTHLY/$MON" ]; then
  cp -a "$DEST" "$MONTHLY/$MON"
  echo "── havi archív létrehozva: $MONTHLY/$MON"
fi

# Rotáció — CSAK sikeres mentés után fut. Így egy bukott futás sosem törli a
# legutolsó jó mentést („a hiba ne egye meg a bizonyítékot").
ls -1d "$DAILY"/*/ 2>/dev/null | sort | head -n -"$KEEP_DAILY" | xargs -r rm -rf
ls -1d "$MONTHLY"/*/ 2>/dev/null | sort | head -n -"$KEEP_MONTHLY" | xargs -r rm -rf
# Félbeszakadt futások maradványai (a mai kivételével).
find "$DAILY" -maxdepth 1 -name '*.reszleges-*' -mtime +1 -exec rm -rf {} + 2>/dev/null || true

grn "✅ MENTÉS KÉSZ: $DEST  ($(du -sh "$DEST" | cut -f1))"
echo "   napi: $(ls -1d "$DAILY"/*/ 2>/dev/null | wc -l) db · havi: $(ls -1d "$MONTHLY"/*/ 2>/dev/null | wc -l) db"

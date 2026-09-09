#!/usr/bin/env bash
# KÖZÖS mentés-ellenőrző — az éles (backup-pull.sh) és a dev (backup-dev.sh)
# mentés UGYANEZT a kódot futtatja.
#
# MIÉRT KÖZÖS: a backup-pull.sh saját kommentje mondta ki a szabályt — „a mentés
# utáni önteszt és a kézi újraellenőrzés ugyanaz a kód; külön »ellenőrző«
# implementáció idővel elcsúszna a valóditól". Ugyanez áll két MENTÉSRE is: egy
# külön megírt dev-ellenőrző pár hónap múlva már mást mérne, és pont akkor
# hazudna zöldet, amikor számít.
#
# A HÍVÓ ÁLLÍTJA BE (source ELŐTT):
#   PGH, PGP, PGU     – az a Postgres, ahova a próba-visszaállítás megy
#   VERIFY_DB         – az eldobható adatbázis NEVE. ⚠️ Mentésenként KÜLÖN legyen:
#                       ha két mentés egyszerre futna azonos névvel, az egyik
#                       eldobná a másik félig visszaállított adatbázisát.
#   REQUIRE_SITES     – 1: a sites/ fa megléte kötelező (éles), 0: nem (dev)
#   SOURCE_LABEL      – emberi név a forrásnak a hibaüzenetekben ("az élessel")
set -euo pipefail

: "${PGH:?PGH kell}"; : "${PGP:?PGP kell}"; : "${PGU:?PGU kell}"
: "${VERIFY_DB:?VERIFY_DB kell}"
: "${REQUIRE_SITES:=1}"
: "${SOURCE_LABEL:=a forrással}"

red()  { printf '\033[31m%s\033[0m\n' "$*"; }
grn()  { printf '\033[32m%s\033[0m\n' "$*"; }
fail() { red "⛔ MENTÉS BUKOTT: $*"; exit 1; }

# ── A HELYES pg_dump/pg_restore/psql megtalálása és MEGMÉRÉSE. ──────────────
#
# ⚠️ Mérve (2026-09-09): a dev cluster NEM a rendszer Postgresa, hanem az
# `@embedded-postgres` npm-csomagé (18.4) — a Debian 13 viszont csak 17-es
# klienst szállít, és a `pg_dump` verzió-eltérésre ELVBŐL megtagadja a dumpot
# ("aborting because of server version mismatch"). Az éles mentést ez sosem
# érintette, mert ott a TÁVOLI gép pg_dumpja fut. Megoldva a PGDG-tárolóból
# telepített postgresql-client-18-cal.
#
# Miért van itt mégis ellenőrzés: a gép egyszer újra lesz telepítve, vagy a
# cluster verziót lép, és akkor ez NÉMÁN visszatér — egy ütemezett mentésnél a
# néma bukás a legrosszabb fajta. Ezért a script maga mondja meg, mi a teendő.
# A `PG_BIN_DIR` feloldás biztonsági háló arra az esetre, ha a klienst egyszer
# nem a PATH-on, hanem az embedded csomag mellett találjuk meg.
PG_BIN_DIR="${PG_BIN_DIR:-$HOME/citoviso/node_modules/@embedded-postgres/linux-x64/native/bin}"
pgbin() {
  local name="$1"
  if [ -x "$PG_BIN_DIR/$name" ]; then printf '%s\n' "$PG_BIN_DIR/$name"; else printf '%s\n' "$name"; fi
}
PSQL="$(pgbin psql)"
PG_DUMP="$(pgbin pg_dump)"
PG_RESTORE="$(pgbin pg_restore)"

# A kliens FŐVERZIÓJA nem lehet régebbi a szerverénél. Csak a fő számot nézzük:
# a pg_dump is így dönt, és egy javító-verzió eltérés nem hiba.
assert_client_matches_server() {
  local server client
  server="$("$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -t -A \
    -c "SHOW server_version" 2>/dev/null | cut -d. -f1)" || true
  client="$("$PG_DUMP" --version 2>/dev/null | grep -oE '[0-9]+' | head -1)" || true
  [ -n "$server" ] || fail "nem érhető el a Postgres ($PGH:$PGP) — fut a cluster?"
  [ -n "$client" ] || fail "nincs használható pg_dump a gépen"
  if [ "$client" -lt "$server" ]; then
    fail "a pg_dump ($client) RÉGEBBI, mint a szerver ($server) — a dump megtagadva.
     Telepítsd az egyező klienst:  sudo apt-get install -y postgresql-client-$server
     (PGDG-tároló: /etc/apt/sources.list.d/pgdg.list)"
  fi
}

# ── Egy meglévő mentés ellenőrzése (a mentés utáni önteszt és a kézi
#    újraellenőrzés ugyanaz a kód — külön „ellenőrző" implementáció elcsúszna).
verify_dir() {
  local dir="$1"
  local dump="$dir/db.dump"
  local manifest="$dir/counts.tsv"
  [ -s "$dump" ] || fail "nincs vagy üres a dump: $dump"
  [ -s "$manifest" ] || fail "nincs sor-manifeszt: $manifest"

  # 0) Bájt-azonosság a kiírtal. ⚠️ MÉRVE (2026-09-09), és nem elméleti: egy 95%-ra
  # CSONKOLT dumpon a `pg_restore --exit-on-error` **exit 0-t ad**, a visszaállítás
  # lefut, és minden sorszám egyezik — mert a levágott farokba üres táblák
  # adat-blokkjai és FK-definíciók estek. Vagyis a lenti három lépés ezt az osztályt
  # elvileg NEM fogja meg: egy megcsonkult mentés zölden jelentene magáról, ami
  # rosszabb a semminél (biztonságérzetet ad). Az összeget a mentés KIÍRÁSAKOR
  # rögzítjük, így a későbbi romlás (lemez, félbeszakadt másolás más médiára)
  # kiderül. Régi, összeg nélküli mentéseknél kimarad — de kimondja, hogy kimaradt.
  if [ -s "$dump.sha256" ]; then
    ( cd "$(dirname "$dump")" && sha256sum -c --status "$(basename "$dump").sha256" ) \
      || fail "a dump BÁJTRA nem egyezik a kiírtal (csonkolt vagy sérült): $dump"
    echo "   ✓ ellenőrzőösszeg egyezik"
  else
    red "   ⚠️ nincs ellenőrzőösszeg e mellett a mentés mellett — a csonkolás nem kimutatható"
  fi

  # A várt táblák MINDIG a manifesztből jönnek, sosem egy kódba írt listából —
  # így a --verify-only ág önállóan is működik, és nem tud elcsúszni a valóságtól.
  local -a want_tables
  mapfile -t want_tables < <(cut -d"|" -f1 "$manifest")
  [ "${#want_tables[@]}" -gt 0 ] || fail "a manifeszt nem tartalmaz táblát"

  # 1) Formai épség: a pg_restore ki tudja-e olvasni a tartalomjegyzéket.
  "$PG_RESTORE" -l "$dump" > "$dir/toc.txt" 2>/dev/null || fail "a dump nem olvasható (sérült archívum)"
  local t n
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
  "$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c \
    "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
  "$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c \
    "CREATE DATABASE $VERIFY_DB" >/dev/null
  # A --no-owner/--no-acl kell: az éles 'citoviso' szerep a dev gépen nem létezik.
  if ! "$PG_RESTORE" --no-owner --no-acl --exit-on-error \
       -h "$PGH" -p "$PGP" -U "$PGU" -d "$VERIFY_DB" "$dump" > "$dir/restore.log" 2>&1; then
    red "── a visszaállítás naplója:"; tail -20 "$dir/restore.log"
    "$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
    fail "a dump NEM állítható vissza"
  fi

  # 3) Sorszám-egyezés a forrással. Ez méri azt, ami SZÁMÍT (megvan-e az adat),
  #    nem a kényelmes proxyt (létezik-e a fájl).
  local bad=0 tbl want got
  while IFS='|' read -r tbl want; do
    got=$("$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d "$VERIFY_DB" -t -A \
            -c "SELECT count(*) FROM \"$tbl\"" 2>/dev/null || echo "HIBA")
    if [ "$got" != "$want" ]; then
      red "   ✗ $tbl: $SOURCE_LABEL $want sor, a mentésben $got"
      bad=1
    else
      printf '   ✓ %-16s %s sor\n' "$tbl" "$got"
    fi
  done < "$manifest"

  "$PSQL" -h "$PGH" -p "$PGP" -U "$PGU" -d postgres -q -c "DROP DATABASE IF EXISTS $VERIFY_DB" >/dev/null
  [ "$bad" -eq 0 ] || fail "a visszaállított adat NEM egyezik ezzel: $SOURCE_LABEL"

  # 4) A fájlos oldal (bizonylat-képek, tenant-fotók) is legyen ott.
  if [ "$REQUIRE_SITES" = "1" ]; then
    [ -d "$dir/sites" ] || fail "hiányzik a sites/ fa"
  fi
  grn "✅ ellenőrzés zöld: a mentés visszaállítható és soronként egyezik ($SOURCE_LABEL)"
}

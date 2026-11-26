# 2026-11-26 — Piacnyitás után nulla kézi lépés (felderítés magától)

Session `cit9d514f15` (SUB), koordinátor `cit9b4690e3`, brief `~/rc-briefs/piacnyitas-kezi-lepes-nelkul-20261126.md`.

## Mi kellett kézzel a HR élesítésnél → mi a kód-szabály most
1. Régió + csempe az új országra → `ensureDiscoveryArea()`: régió-sor az OSM ISO 3166-2 határ bboxából (Overpass, $0), `ensureTiles`; amikor a terület először kerül sorra.
2. Kettős régió-elnevezés → `discoveryRegionId()` az egyetlen forrás; a lánc a `plan` kimenetéből olvassa; a Python-iker (`orszag.region_id`) önteszttel ellenőrizve (`teruletek.py selftest`: 40 terület, 0 eltérés).
3. `COUNTRY` fájl + `START` env → a bejárt országok = nyitott piacok (`discoveryCountries`), kezdőpont = szótár `chainFelderitoStart`.
4. Elavult ország-cache → `orszag.py`/`orszag.mjs`: ismeretlen ország → egyszeri azonnali újraolvasás.
5. Őr (`orzo.sh`): nincs „minden megye kész” megállás, egy később nyitott piac magától sorra kerül.

## Vak próba (dev DB, HR — a dev-en eddig nem bejárt terület)
- HR piac megnyitva a dev-en (`approveMarket`; a dev konzol a hiányzó EUR-tárca-beállítás miatt elutasítaná, ezért `BARION_WALLET_CURRENCIES=HUF,EUR`).
- `osszes.sh` (CIT_DB=dev, COUNTRY=HR, TILE_LIMIT=3, DETAIL_LIMIT=10): `terulet-hr-17` régió + 340 csempe magától (ugyanannyi, mint a kézi éles), Makarska-csempékkel kezdve; 22 új lead (19 no_site, 3 outdated, 16 telefonnal); utána magától továbblépett: `terulet-hr-19` + 187 csempe (leállítva).
- Kontakt: `kontakt/futtato.sh` (CIT_DB=dev) a dev lead-fájlból felvette a 22 leadet.
- HU: a terület-lista az új úton bájtra azonos a régivel (19 terület); éles HU megyék mind ELESITVE, a 20 megye-sornak megvannak a csempéi → ensure no-op.

## Fájlok
Repó: `src/scout/discoveryAreas.ts`, `scripts/discovery-areas.mts`, `src/countryLexicon/hr.json`, `src/countryReadiness.ts`, `src/console/countryViews.ts`, `scripts/country-layer-check.mts`, `hooks/pre-commit`, `src/i18n/catalog*.json`.
Lánc (uj-lanc-hr git): `felderito/{teruletek.py,osszes.sh,orzo.sh,felderito.py,elesit.py}`, `orszag.py`, `orszag.mjs`, `kontakt/futtato.sh`, `atallas-felderites.sh`.

## Audit a/b/d (koordinátor kérésére, ugyanazon a napon)
- (a) Jelöltek csak NYITOTT piacról: `orszag.py open_markets()` (az app terve: kapu + szótár + keresőszó; 10 perces cache, hibánál a régi lista, lista nélkül semmi) → `OPENCC` a `hc-cand.sql`/`nj-cand.sql`-ben, a kontakt-backlogokban; a `lanc.sh` GATECC = nyitott ∩ sor < MAX_BACKLOG. Dev-mérés: HU+HR nyitva a `cand`/`hc-cand`/`nj-cand` kimenete bájtra a régi; csak HU nyitva pontosan a nem-HU esik ki.
- (b) `fo-cand.sql`: GATECC, a lead országa countryOf szerint (alias, scrape-terület), városkulcs = `townKey()` — `fo-terv/townkey_sql.py` generálja (Unicode-ból, ctype-független), `townkey-twin.sh` méri: prod 2439, dev 1322 város, 0 eltérés. Dev: +2 HU lead („MAGYARORSZÁG” alias), amit a régi kihagyott.
- (d) `kontakt/felre.mjs`: zárt/szótár nélküli ország leadje okkal `out/felre.tsv`-be kerül (egyszer), és a piac nyitásakor magától visszajön (dev: zárt HR → 22 félre, nyitás után 25/25 felvéve).
- (c) auto-approve.mts: nem nyúltam hozzá (a cita363cd23 F4 váltja ki).
- Dev-hiány (megoldás nélkül): `~/.config/citoviso/neo-dev-operator.txt` nincs, ezért a kontakt dev-írása (apply.mjs) nem fut.

## Nyitott (koordinátornak)
- Átállás: deploy (discovery-areas.mts élesen) + fő-fa ff után `bash ~/rc-briefs/uj-lanc-hr/atallas-felderites.sh check|go`.
- Az átállás-szkript (atallas-felderites.sh) most a felderítést ÉS az audit a/b/d-t együtt viszi.

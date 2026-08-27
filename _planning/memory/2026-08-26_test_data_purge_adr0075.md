# 2026-08-26 — Teszt-adat purge (ADR-0075) + a `sites` symlink-rés befoltozása

## Kiváltó (tulaj)
„üritsd ki lokálon a teszt mockokat meg slug honlapokat meg mindent! a scrape lead stb maradjon"

## Amit csináltunk
Feltérképezés → 3 kérdés a tulajnak a határesetekről → mentés → purge egy tranzakcióban → ellenőrzés.

**A vágás vonala:** SZERZÉS marad (lead/provenance/scrape), SZÁLLÍTÁS ürül (mock → prospect →
tenant → site → order → payment → invoice → bizonylat) + lemezes snapshotok.

**Tulaj-döntések a 3 határesetre:**
1. Pénzügy: **tranzakciók mennek, törzsadat marad** (partner, legal_entity, árazás) — hogy a most
   fejlesztett bizonylat-modulnak maradjon kerete.
2. Lemez: a fejlesztői kimenet (`_engine-proof`, `_outreach-shots`, `_console-shots`, `_inbox-ab`)
   **marad** — az nem adat.
3. Operátor-fiókok: **mind marad** (nem tartoznak a mock/honlap körbe).

**Mérés:** törölve 30 mock_artifact, 7 prospect, 20 mock_view, 200 mock_event, 7 tenant → 7 site +
9 site_unit + 92 entitlement + 4 tenant_user, 14 bizonylat, 4 számla, 9 fizetés, 11 rendelés,
25 curator_decision; lemezen 11 snapshot-mappa + 28 mock-fájl + 19 outbox-email.
**Érintetlen:** 592 lead, 2119 lead_provenance, 5 scrape_run. 6 lead visszaállt `qualified`-ra.

## Módosított / létrehozott fájlok
- `scripts/purge-test-data.mts` (ÚJ) — dry-run alapból, `--go` kapu, JSON-mentés, 1 tranzakció, önellenőrzés
- `_planning/DECISIONS.md` — ADR-0075
- `.gitignore` — `sites` perjel nélkül IS
- Mentés (untracked, PII): `/home/citoviso/citoviso/_planning/backups/purge-backup-2026-08-26.json`

## Amit a folyamat tanított
1. **A dry-run kapta el a saját hibámat.** A script a worktree-gyökeret nézte, ahol 0 mock-fájl van —
   a generált állomány a FŐ FÁBAN ül, a worktree csak a `sites/`-ot linkeli oda. Élesben futtatva
   némán kihagyta volna a 28 mock-fájlt és a 19 outbox-emailt. Azóta a `sites/` symlink realpathjából
   vezeti le az adat-gyökeret. **Purge/GC-szkript alapból a rossz gyökeret nézi worktree-ből.**
2. **A `sites` symlink NEM volt ignorálva** (`?? sites` a statusban): a `sites/` minta záró perjeles,
   ami symlinkre nem illeszkedik. Ez UGYANAZ a rés, ami az `assets/Temp`-nél már egyszer valódi
   adatvesztést okozott — ott javítva lett, itt nem. A tanulság nem terjedt át a testvér-esetre.
3. **A FK-gráf megmondta, mi hal együtt.** A `curator_decision` CASCADE-del lóg a `mock_artifact`-on,
   tehát 25 kurátori döntés elment a mockokkal — ezt a törlés ELŐTT kellett kimondani, nem utólag
   felfedezni. Purge előtt a FK-gráfot végig kell nézni, nem elég a törlendő táblák listája.

## Nyitott kérdések
1. `sites/_engine-proof` = 242M, a `sites/` 98%-a. Regenerálható; a tulaj úgy döntött, marad.
2. A `_planning/backups/` lead-PII-t gyűjt **retenciós szabály nélkül** (most 2 purge-mentés).
3. A lemezes HTML-snapshotok nem kerültek a mentés-JSON-be — az `inputs`-ból újrarenderelhetők,
   de ez nem lett kipróbálva ezen a purge-on.

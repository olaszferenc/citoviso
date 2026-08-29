# 2026-08-29 — Session-záró: §2b felület-kapu gépiesítve + 3 felület-funkció

## A session íve
Egy „egyszerű" feladatból (mock törlés + multi-select) a session valódi hozadéka egy **munkarendi
javulás** lett: a tulaj elkapta, hogy KÓD-ELŐBB szállítottam felület-munkát (megszegett §2b), és ebből
gépi kaput építettünk. Utána a kapun át három felület-funkció landolt helyesen.

## Mi landolt (mind a `main`-en, igazolva)
1. **§2b felület-kapu hook — ADR-0081** (`560e04b`). PreToolUse blokk felület-fájlra token nélkül +
   pre-commit strukturális iker + `surface-gate.mjs` (approve = friss desktop+mobil shot; exception =
   tulaj kimondott, naplózott) + közös felület-lista. Jegyzet: `2026-08-28_surface_plan_gate_hook.md`.
2. **Mock törlés + több-típusú (multi-select) generálás** (`650fa60`/`3cabf94`). Approve-úton,
   kontraktus: `assets/design-refs/console/mock-delete-multiselect/`. Jegyzet:
   `2026-08-28_mock_delete_and_multi_template.md`.
3. **Provisioned (privát előnézetes) mock is törölhető** (`b894822`/`63eddf0`). A törlés az előnézetet
   (tenant+site+jogosultságok) is lebontja; a nyilvánosan élő védett. Exception-úton (tulaj bug-report).
4. **Leadek-lista alapértelmezett szűrő** (nincs/elavult honlap + min 1 kép → 590→161) + valódi „Szűrők
   törlése" (`cfdbcb0`/`5cc1a77`). Exception-úton. Jegyzet: `2026-08-29_leads_default_filter.md`.

## Fő tanulságok (túlmutatnak a feladaton)
- **A §2b volt az egyetlen kritikus doktrína gépi kapu nélkül** — a próza statisztikusan tart, a hook
  100%-osan. A kivétel önbíráskodó volt; most kimondott, naplózott aktus.
- **A kapu egy nap alatt 3× végigfutott** (1 approve, 2 exception) — élesben bizonyított.
- **A statikus kép nem elég** (a tulaj: „a mock file nem működik, de a képek alapján jóváhagyom") —
  a működő mock a `_drafts`-ba, a kép `SendUserFile`-lal; elem-szintű close-up olvashatóbb, mint a
  full-page shot.
- ⚠️ **Nyitott infra-csapda:** `documents-paging-check` élő DB-ből mér ↔ purge kiürítette →
  `reference_guard_reads_live_db_vs_purge.md`. Ideiglenes seed feltéve; tartós fix a tulaj döntése.

## Nyitott
- A bizonylat-lapozás-őr saját fixture-re állítása (fent).
- Élesítés NEM történt — minden lokál/main, külön scope-olt engedély kell (§0.3).

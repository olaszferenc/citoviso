# 2026-10-26 — Felderítő csempe lezárása: versenyhelyzet

Koordinátor (citdcb3daea), Magellan mérése (`~/magellan/jelentesek/2026-10-26.md`, megye-so F2, origin/main cf041692). Lokál javítás, élesen NINCS.

## Ok
Két egyidejű `POST /scout/tile/F2/close`. A `closeScoutTile` zár nélkül olvasott, a csempe-update nem volt feltételes, a `procRows` a tranzakció előtt olvasott sorokból számolt → mindkét kérés „sikeres” lezárást látott (procRows=80). A második kérés `startScoutJob`-ja busy lett (az első jobja futott), és a busy-ág `reopenScoutTile`-ja az első kérés lezárását visszacsinálta (proc → new) → az első job 0 sort kapott. A `runSourcePhase` a forrás hibáját elnyelte, a 0 soros futás „completed” lett.

## Javítás
- `closeScoutTile`: tranzakció, `SELECT … FOR UPDATE` a csempére, a kapu a zár alatt olvasott állapoton, feltételes update (`state <> 'done'`), procRows/procIds az `UPDATE … RETURNING`-ból; már lezárt csempe → `{ error: "closed" }`.
- Route: a „closed” ág csak a friss állapotot adja vissza, jobot nem indít; a busy-ág `reopenScoutTile(tile.id, r.procIds)` — csak a saját sorait nyitja.
- `runSourcePhase`: `failedSources` + figyelmeztetés a futáson; `run.ts --scout`: forrás-hibán a futás megbukik (exit ≠ 0 → a konzol újranyitja a csempét), 0 sornál figyelmeztetés.
- Kliens (`scoutViews`): `closing` jelző — kérés közben a lezáró gomb újrarenderelésre sem engedélyeződik.
- Új őr: `scripts/scout-close-race-check.mts` (pre-commit-be kötve). A régi kódon az ① eset pontosan Magellan esetét adja: `[{"procRows":3},{"procRows":3}]`.

## Deploy után
Nincs adat-teendő: a F2-t Magellan már újrafeldolgozta (scrape_run d005c70e).

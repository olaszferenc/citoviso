# 2026-10-22…25 — Dev lemez: mentés hardlinkkel, landolatlan fák lezárása, pair-repair

Brief: `~/rc-briefs/dev-lemez-takaritas-20261022.md` (az OF-sessionből).

## Elvégezve (mind landolva, élesen nincs semmi)
- `scripts/backup-pull.sh`: `--link-dest` az előző OK napi mentésre + havi `cp -al`. Napi új hely ≈ dump
  (~21 MB) + valóban új fájlok (10-11…10-21: 0–2 MB/nap); korábban 2,0 GB/nap. Az éles gépet továbbra is
  csak olvassa (pg_dump + rsync).
- `citoviso-pair-repair.service` hibája: a dev Postgres a 10-22-i boot után nem indult. Új unit:
  `deploy/systemd/citoviso-db.service` (+ `targets.json` dev-bejegyzés), telepítve, engedélyezve.
- Landolatlan fák: cit9d089052, mocklapleadszem, orkapuba, distill 0922/0927/1004/1011 törölve, patchük a
  `~/backups/wt-parked/2026-10-22/`-ben. distill20261019 a tulaj jóváhagyásával landolt; cit4678246e
  (aktiváló levél + /pay/done domain-jegyzet) összefésülve és landolva → ADR-0402.
- Distill: a nem-landolás szándékos (tulaj-jóváhagyásra vár); javítva, hogy a felülírt `wt/distill<dátum>`
  ágakat és fáikat a `distill-apply.mts` maga törli.

## Nyitott
- ADR-0402 „B” rész: belépés a vevő saját címén — még nincs megírva.
- Három beégetett teszt-token (entitlement-paid/module-upsell/partner-registry check) és az orkapuba négy
  bekötetlen őre — ötlet, nem kért munka.

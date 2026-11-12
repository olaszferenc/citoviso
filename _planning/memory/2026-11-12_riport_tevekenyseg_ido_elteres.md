# 2026-11-12 — Riport vs. Tevékenység-oldal: 1 órás időeltérés (élesítve)

**Brief:** `~/rc-briefs/d-tumok-id-pontok-20261112-075149.md` (session `cit275c8270`)

**Tulaj jelzése:** „a riportban nem jók a dátumok” — Kati Villa: riport „utoljára 11-12 07:40”, Tevékenység-oldal „5. látogatás 2026-11-12 06:40”.

**Ok:** a riport volt a helyes (Budapest, `whenLabel` + `APP_TZ`). Az élesen futó `ca2d8a69` Tevékenység-oldala (`prospectActivityPage`) a nyers UTC ISO-szeletet írta (`iso.slice(0,16)`), télen −1 óra. A javítás már a mainen volt (`80f63d64`, 11-11).

**Elvégezve:** élesítés `deploy-prod.sh 7c6af883 --go` (tag `prod/20261112-0835`), nincs migráció, :4600 303 / :4800 200, a szerveren a javított `dmy` igazolva.

**Módosított fájlok:** `MEMORY.md`, `_planning/memory/2026-11-12_riport_tevekenyseg_ido_elteres.md`, `_planning/memory/INDEX.md` (generált). Kód nem változott.

**Nyitott:** nincs.

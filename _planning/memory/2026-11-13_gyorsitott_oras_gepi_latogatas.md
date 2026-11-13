# 2026-11-13 — Mérés: a levélszűrő gyorsított órás „látogatásai” gépinek jelölve

**Brief:** `~/rc-briefs/megkeres-s-m-r-s-20261113-100519.md` (session `citf1ffc450`). Tulaj: „túl gyors a megnyitás, kvázi nincs különbség 2 megnyitás között” (Prefa Rolling Cabin, DoriNita Családi Farm).

**Ok (élesen mérve):** a Prefa 3 látogatása egy levélszűrő műve, amely virtuális idővel futtatta az oldalt: a 15 mp-es ütem ~1,8 mp-enként jött, „225 mp” 26 mp alatt. A DoriNita mobil látogatása valódi (14 mp ≈ 11 mp falióra). A 6 mp-cel későbbi asztali látogatásnak csak „open” eseménye van, ebből nem dönthető el.

**Elvégezve:** ADR-0447. Új: `src/analytics/fastClock.ts`, `scripts/fast-clock-check.mts` (+ pre-commit), `scripts/fast-clock-backfill.mts`. Módosítva: `src/console/data.ts` (recordEvent → markViewAsMachine, bot-szűrés a lead-oldal számlálójában és a funnelben, `ActivitySession.machine`), `src/console/views.ts` (Tevékenység-lap), `src/payment/offers.ts` (eszkaláció bot nélkül), `scripts/prospect-activity-label-check.mts` (fixture), i18n-katalógus.

**Ellenőrzés:** tsc 0 hiba; `fast-clock-check` 14 mért sor + a lap, selftest piros; dev-DB integráció: gyors ütem → bot + 'sent' + ajánlat lejárt, emberi ütem → desktop marad.

**Nyitott:** élesítés + élesen `npx tsx scripts/fast-clock-backfill.mts --go` (~10 látogatás) — tulaj-engedély kell; Bábel fordítsa az új konzol-feliratokat.

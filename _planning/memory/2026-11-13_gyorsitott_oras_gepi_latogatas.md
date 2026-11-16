# 2026-11-13 — Mérés: a levélszűrő gyorsított órás „látogatásai” gépinek jelölve

**Brief:** `~/rc-briefs/megkeres-s-m-r-s-20261113-100519.md` (session `citf1ffc450`). Tulaj: „túl gyors a megnyitás, kvázi nincs különbség 2 megnyitás között” (Prefa Rolling Cabin, DoriNita Családi Farm).

**Ok (élesen mérve):** a Prefa 3 látogatása egy levélszűrő műve, amely virtuális idővel futtatta az oldalt: a 15 mp-es ütem ~1,8 mp-enként jött, „225 mp” 26 mp alatt. A DoriNita mobil látogatása valódi (14 mp ≈ 11 mp falióra). A 6 mp-cel későbbi asztali látogatásnak csak „open” eseménye van, ebből nem dönthető el.

**Elvégezve:** ADR-0447. Új: `src/analytics/fastClock.ts`, `scripts/fast-clock-check.mts` (+ pre-commit), `scripts/fast-clock-backfill.mts`. Módosítva: `src/console/data.ts` (recordEvent → markViewAsMachine, bot-szűrés a lead-oldal számlálójában és a funnelben, `ActivitySession.machine`), `src/console/views.ts` (Tevékenység-lap), `src/payment/offers.ts` (eszkaláció bot nélkül), `scripts/prospect-activity-label-check.mts` (fixture), i18n-katalógus.

**Ellenőrzés:** tsc 0 hiba; `fast-clock-check` 14 mért sor + a lap, selftest piros; dev-DB integráció: gyors ütem → bot + 'sent' + ajánlat lejárt, emberi ütem → desktop marad.

**Élesítés:** 6fe964ef (prod/20261113-1426), majd f3e5b2fc (prod/20261113-1548); backfill élesen: 13 gyorsított órás + 10 néma iker → bot, utóellenőrzés 0. Bábel mind az 5 feliratot lefordította.

**Folytatás 15:30 (tulaj képe, Bojtor Vendégház: „Nem tűnik jónak”):** a 3. látogatás valódi (137 mp, 3 kérdés), a 2. egy „néma iker”: asztali Windows Chrome, 10,4 mp-cel a mobilos után, csak `open`, záró jel nélkül (DoriNitánál 6,0 mp). Élesen 60 nap alatt 10 ilyen eset volt, mind asztali Windows Chrome. Szabály: `isShadowOpen` (asztali, 0 jel, ≤30 mp), a `recordView` 60 mp-es időzítője ítél (`checkShadowView`), a visszamenőleges javítást a backfill végzi. KB: a `console-outreach-draft` Tevékenység szakasza kiegészítve. Az 1. (mobil) látogatás „vége ismeretlen”: az olvasás-ütem 45 mp-nél leállt, de záró jel nem jött — nyitott.

**ZÁRVA 2026-11-16 (tulaj: „Zárunk így ahogy van”). Nyitott maradt:**
- KB: `console-outreach-draft` „pár másodpercen belül” → „kb. egy percen belül” (néma iker 60 mp); örökölt, más szálaktól: `console-pricing` („+ Ország” → „+ Új ár-régió”, régiónkénti felár, „hiányos” jelvény), `console-settings` + `console-dashboard` (AAM 18 → 20 M Ft, OSS-küszöb), `console-markets` („Nem nyitható:” állapot). A deploy kb-gate-jében nyitottként rögzítve.
- Mobil látogatás „vége ismeretlen” (Bojtor 1.: az ütem 45 mp-nél leállt, záró jel nem jött) — vizsgálatra vár.

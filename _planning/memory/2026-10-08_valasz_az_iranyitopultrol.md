# 2026-10-08 — Válaszolás az irányítópultról, Poe javaslatával (ADR-0340)

**Kérés (tulaj):** „kellene: válaszolás az irányítópultról (email és sms), azzal, hogy a kollégák rakjanak össze egy javasolt választ!”
Döntések: A terv (vázlat-buborék), a javaslatot Poe írja, a hétköznap 9–16 ablak a válaszra is vonatkozik.

**Elvégezve (4 session-szakaszon át, ugyanabban a fában):**
- migráció `0096_outreach_reply_answer.sql`; `src/replies/answer.ts` (saveSuggestion, sendAnswer, settleReplySends) + `answerRules.ts` (tiszta szabályok)
- `src/replies/store.ts` (suggestion/sends a ReplyView-ban, repliesNeedingSuggestion), `src/console/server.ts` (`/replies/<id>/send|suggest`, `/suggestion` poll), `src/console/views.ts` (replyAnswer, lista-címke, toast, szerkesztő-JS), CSS, ikonok
- `src/server/public.ts` ingest: settle + `needsSuggestion` (link, ha a gazda ismeri a saját konzol-URL-jét)
- `scripts/replies-collect.mts`: Poe-jegy írása (`~/poe/beerkezo/<nap>-<lead8>-valasz-<válasz8>.md`, egyszer), `poe/charter/RUNBOOK.md` §6b
- `scripts/outreach-reply-check.mts` ⑦⑧ (+önteszt); KB: `kb/entries/console-dashboard/entry.hu.md`
- képernyőkép a valódi felületről (390 + 1280) a terv-képekhez mérve; Playwright-kattintás a fixture-ökön (JS-hiba 0)

**Lezárás (2026-10-09, a tulaj kérésére a nyitott pontok is):**
- „Megválaszoltam” gomb: a `ghost` másodlagos osztály → körvonalas, mindkét terv (B és A) szerint; ui-shot 390 + 1280.
- `/duplicates` 33 s → 0,24 s: a közelség-pár keresés minden-pár helyett 0,001°-os rácson (3×3 szomszéd), a jelöltlista és a
  csoportok BETŰRE azonosak a régivel (mérve a dev DB-n, 300 jelölt). A gomb-súly kapu 30 s-os korlátja ezért változatlan maradt.
- Konzol-URL élesen: nincs teendő — a jegy-link a gyűjtő alapértékéből (az éles admin-host) jön; élesre külön semmi nem megy.

**Élesítve (2026-10-09 13:06):** `4dc8a9d7` = `prod/20261009-1306` (előtte `d8eb3a64` = `prod/20261008-0633`; a `DEPLOYED` „prev” mezője hibásan `4dc8a9d7`-et ír, mert a deploy két futásból állt). A deploy 33 commitot vitt ki, a próba-szálak (ADR-0342/0343/0344) és a Riport „Mock” fül is élesbe került; migrációk 0096–0098. Előkészítés: 2 elavult riport-súgókép (`da853b1a`) + a súgó „Próba-űrlapról” szűrője (`4dc8a9d7`, tudasbazis-or FLAG → PASS). Az első `--go` a checkout + migráció után a restart előtti GATE 4-en megállt (Tolna Felderítés scrape indult 11:03-kor); a migrációk csak bővítenek, a régi kód az új sémán futott; a scrape vége után a második `--go` restartolt (:4600 → 303, :4800 → 200, `journalctl -p err` üres). Füst-próba: az Irányítópulton a „Válaszok a megkeresésekre” blokk + „Javasolt válasz”/„készül” buborékok; az 5 válaszon még nincs Poe-javaslat (Poe-jegyre vár).

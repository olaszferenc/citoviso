## ADR-0340 — Válaszolás az irányítópultról: Poe javasol, az operátor küld, a hétköznap 9–16 ablak a válaszra is áll

**Dátum:** 2026-10-08 · **Döntött:** tulaj („kellene: válaszolás az irányítópultról (email és sms), azzal,
hogy a kollégák rakjanak össze egy javasolt választ!”; az A terv jóváhagyva), megvalósítás: CIT session

**Kontextus.** Az ADR-0339 blokkja csak MUTATTA a válaszokat; Melindának a tulaj szövegét kézzel kellett
a modemről kiküldeni (2026-10-08). Kontraktus: `assets/design-refs/console/valaszok-valasz/` (A változat).

**Döntés.**
1. **Vázlat-buborék a beszélgetésben** (A): a beérkezett válasz alatt „Javasolt válasz” → „Elküldöm” /
   „Szerkesztem”; nincs javaslat → „készül” + „Megírom magam”; a közben megjött javaslatot a felület
   felajánlja, az operátor szövegét nem írja felül.
2. **A javaslatot POE írja** (ADR-0326), a konzolon, sima POST-űrlapon (`/replies/<id>/suggest`), a `poe`
   fiókkal — az űrlap csak annak a fióknak látszik. Nincs hátsó API, nincs „AI-javaslat” gomb. Poe jegyét
   a gyűjtő írja (`~/poe/beerkezo/<nap>-<lead8>-valasz-<válasz8>.md`, egyszer): az ingest-válasz
   `needsSuggestion` listájából (nyitott, javaslat nélküli, 14 napon belüli). Poe RUNBOOK §6b.
3. **Küldeni csak az operátor küld** (ADR-0325), és csak a válasz SAJÁT csatornáján a SAJÁT feladójának
   (a címzett nem űrlap-mező). SMS: `sendSms` (élesen `queue` → `sms_outbox` → modem-sáv, ADR-0332), mindig
   unicode: ≤70 kar. = 1 rész, fölötte 67/rész, legfeljebb 5 rész. E-mail: platform-küldő, „Re: …” tárgy,
   In-Reply-To/References = a beérkezett Message-ID (`source_key`).
4. **A hétköznap 9–16 ablak (ADR-0334) a válaszra IS vonatkozik** (tulaj, 2026-10-08): azon kívül az
   „Elküldöm” `scheduled` sort ír a következő ablak-kezdetre, és kiírja, mikor megy. Új időzítő nincs:
   a `settleReplySends()` a percenkénti gyűjtő-ingesten és minden blokk-olvasáskor fut (single-flight,
   claim-then-send), és a sorban álló SMS-t az `sms_outbox` sora szerint `sent`/`failed`-re zárja.
5. **Siker → automatikusan „Megválaszolva” a küldő operátor nevével**; hiba → a tétel nyitva marad,
   piros sor + „Újraküldés”. Egy válaszhoz egyszerre egy függő küldés lehet.
6. **Adat:** `outreach_reply.suggestion_*` (egy élő javaslat), új `outreach_reply_send` tábla (több
   kísérlet / válasz) — migráció 0096. A tiszta szabályok (`answerRules.ts`) DB nélküliek: ugyanazt
   használja a nézet, a küldő és az őr.

**Őr.** `scripts/outreach-reply-check.mts` ⑦ (rész-határok 70/71/335/336, péntek 16:30 → hétfő 9:00)
és ⑧ (ablakon kívül csak `scheduled`; queued → outbox `sent` → megválaszolva az operátor nevével;
`failed` → nyitva) — mind szombati órával, hogy semmi ne menjen ki; önteszttel.

**Nyitott.** Élesítés a nagy deployjal együtt (tulaj-engedéllyel). Élesen a `CONSOLE_URL` nincs beállítva,
ezért a jegy linkje a gyűjtő `REPLIES_CONSOLE_URL`-jéből (alap: `https://admin.citoviso.com`) épül.

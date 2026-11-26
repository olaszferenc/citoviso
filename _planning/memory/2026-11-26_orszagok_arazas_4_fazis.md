# 2026-11-26 — „Országok / Árazás” 4. fázis: kiküldési szabályok országonként, auto-approve a repóban (SUB cita363cd23)

**Megbízás:** koordinátor `cit9b4690e3` („indulhat az F4”; élesítés + crontab-csere az övé, tulaj-engedéllyel).
**Tulaj-döntés közben:** jóváhagyás = „B” — most minden országban a tulaj hagy jóvá, országonként állítható; visszatöltés `owner`.

**Elkészült**
- Migráció 0155: 14 `country` oszlop (fotó-minimum és -mód, MINTA, honlap-körök, csatornák, jóváhagyás + 5 szabály, hétnapok, ünnepnap, nem-nyitó be/nap/db/keret, eszkalációs levél) + `lead.contact_checked_at`; visszatöltés a mai működéssel (HU ablak 8–20 → 8–17, HU keret 100, HR 20).
- Olvasók a sorra: fotó-kapu SQL (lead országa), sorrend + kör-kizárás, ablak (hétnap-maszk, ünnepnap), napi keret, nem-nyitó, eszkalációs, render-kapu MINTA, generátor/településkép-tár/újragenerálás.
- `src/outreach/autoApprove.ts` (a régi szkript 5 ága, pipák mögött; tickben, 20 percenként, `outreach_auto.autoApprove` mögött, alapból KI); `POST /contact-checked`; `scripts/contact-checked-import.mts` (visszatöltés), `scripts/contact-checked-push.mts` (a crontab 21. sor utódja), `scripts/dispatch-equivalence.mts` (átállás előtti próba), CLI `outreach-dispatch.mts auto-approve dry|on|off`, `cap` a sorra ír.
- Kiküldés fül szerkeszthető (élő szám, ↑↓ sorrend, mentés előtti összesítő, validálás); KB-szakasz + kép.
- Őr: `scripts/dispatch-settings-check.mts` (pre-commit).

**Mérve:** az éles adat másolatán (pg_dump olvasva, helyi scratch DB, utána törölve) az egyenértékűség mind zöld — checked 19 728/19 728, jóváhagyás 800 kombináción, ablak 7 ország × 14 nap, keret, fotó-kapu 5 162 sor, sorrend 631 sor. A várakozó jóváhagyási sor a másolaton üres (mock-fájlok nélkül) — élesen az átállás 3. lépése futtatja.

**Élesen ma (mérve 12:10):** a Debian crontab 21. sora már csak a checked-ids feltöltés; az `auto-approve.mts` `.disabled-20261126`.

**Nyitott / következő:** az átállás a koordinátoré (ADR „Átállás élesen” lépései); utána 5. fázis (ütemezett árváltozás).

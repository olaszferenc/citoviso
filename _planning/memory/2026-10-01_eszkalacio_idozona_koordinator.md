# 2026-10-01 — Eszkalációs ajánlat időzítése → szállás-időzóna: koordinálás és élesítés (koordinátor cit94bb80e7)

**Szál:** a tulaj „Mi a 72 óra? … Csináljuk meg állíthatóra” kérdéséből öt kör lett, mind egy SUB-ban (`cit782078ba`):
1. ADR-0286 — érvényesség (`offerHours`), emlékeztető (`followupHours`), bemutatkozó % (`outreachPercent`) a /pricing-on; a levél %-a köt.
2. ADR-0287 — az emlékeztető óránként, 8–20 Budapest, ajánlatonként egyszer (`citoviso-offer-followup.timer`).
3. ADR-0288 — minden kimenő küldési ablak Budapest-időben (élesen UTC-n eddig 10–22 lett volna).
4. ADR-0289 — a tulaj/vevő/partner felé mutatott idők Budapest-időben, közös `budapestTime.ts`.
5. ADR-0290 — szállás-időzóna: `tenant.time_zone` (migráció 0082), egyetlen „ma” (`todayIn`), Fiók fül + konzol választó.

**Élesítés:** `e263b580` (17:43, a koordinátor), `448a7480` (20:20, másik szál — benne 0287–0289), `87dd8ab1` (10-01 07:58, másik szál — 0290). Ellenőrizve: a migráció lefutott (`DEFAULT 'Europe/Budapest'`), élesen 0 tenant.

**Tanulságok (koordinátor):**
- ⛔ A §2b-mock után a SUB jogosan megállt, én viszont nem figyeltem rá → **91 perc üresjárat**; a tulaj „2 órája semmi”-t mondott. Azóta: háttér-figyelő (tmux „esc to interrupt” + origin/main) minden SUB-feladat után, azonnali jelentés.
- ⛔ A SUB a kb-gate PASS-t rossz tartományra rögzítette (a saját első commitjától, nem az élesen futótól) → a deploy GATE 1c elbukott. A briefbe a teljes tartományt (`<éles HEAD>..<landolt HEAD>`) szó szerint kell beírni.
- A tulaj kétszer jelezte a fölösleges újrakérdezést (szállás-időzóna; „kódot ne írjak?”): ha a döntés megszületett, végrehajtani, nem újra opciókat kínálni.

**Nyitott:** `MOBILE_SEND_WINDOW_OFF` (más szál ideiglenes kapcsolója) kikapcsolása az éles teszt után; a szállás-időzóna felület A/B utólagos tulaj-ítélete.

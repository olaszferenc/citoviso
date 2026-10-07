# 2026-10-07 — Magellan, a digitális felderítő: terv (SUB, „Google api / scrape” szál)

**Elvégezve (terv, nincs kód):** a scrape fizetős pontjainak felmérése a kódból; Magellan charter
(`magellan/charter/CHARTER.md`, `RUNBOOK.md`, `ONTOLOGIA.md`); terv (`magellan/TERV.md`);
ADR-tervezet (`_planning/decisions/XXXX-magellan-digitalis-felderito.md`, JAVASLAT); két működő mock
(`assets/design-refs/_drafts/magellan/A-urlap.html`, `B-munkalap.html` + mobil/asztali képek, nem commitolt;
Playwright: 21/21 ellenőrzés, 0 JS-hiba). Egy kézi Térkép-próba (headless, bejelentkezés nélkül).

**Tények, amiket érdemes tudni:**
- A scrape-ben NINCS kill-switch; csak a kulcs üresen hagyása állítja le (a kulcs a generátornak is kell).
- A bejárás Text Search-e id-only, de a `google-cost-report` Enterprise-áron számolja.
- A Balaton-Kelet és Székesfehérvár régió CSAK az éles `region` táblában él (devben nincs).
- Éles mérték: Balaton-Kelet 1560 hely (09-28); Székesfehérvár 10-05: 5692 jelölt, a futás elbukott, 0 lead.

**Nyitott:** a tulaj Q1–Q10 döntései (`magellan/TERV.md` §7). Jóváhagyásig nincs implementáció.

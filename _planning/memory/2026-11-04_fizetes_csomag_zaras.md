# 2026-11-04 — Fizetés-csomag zárása (számla-tükör, riasztás, riport, partner-adatlap, aktivitás, domain-nyilvántartás)

**Kiváltó ok (11-03):** az első valódi fizető vevő (Duna Vibe House, CITO-2026-7) nem látszott a konzolon — a Bizonylatok csak a kézi `accounting_document`-et olvasta, fizetésről nem jött jelzés; a .hu cfm-megerősítést Neo keret-ÁLLJ miatt kihagyta, a tulajnak kellett kattintania.

**Elvégezve (koordinátor + 5 SUB, mind landolva és ÉLESEN, `d7e7c90d`, prod/20261104-1656):**
- SUB-A: rendszer-számlák tükre a Bizonylatokban + riasztás minden fizetésről (ADR-0414, 0120); élesen a backfill lefutott → 3 rendszer-bizonylat.
- cfm-relé: a .hu megerősítés kivétel minden keret-ÁLLJ alól (`scripts/cfm-relay.mts`).
- SUB-C: partner-adatlap fülekkel, szerkeszthető (ADR-0418) + Üzenetváltások fül, M1 csevegő-szál, e-mail/SMS írás, elutasító-jel a Válaszok panelen, bejövő levelek a szálban (ADR-0421, 0123).
- SUB-E: domain-nyilvántartás adatréteg (0122) + `/domains` hibrid felület (tábla + 7 lépéses életút-sáv + oldalfiók).
- SUB-B: Riport › Előfizetők (A: MRR/ARR, várható bevétel, előfizetők tábla).
- SUB-D: aktivitás 1A (partner-blokk) + 2A (Riport › Tenantok összesítő); a kattintás-mérő és a Forgalom-fül bővítése NEM kért.
- Súgó: új `console-domains`, `console-report-tenants` entry, partner-page Aktivitás + Üzenetváltások képek; a `partner-kb-shot.mts` elrejti a sticky `.con-bnav`-ot a teljes-oldalas lövésnél.
- Ellenőrzés élesen, bejelentkezve (elek): /domains (dunavibehouse.hu látszik), /report/tenants, /report/revenue, /documents (CITO-2026-5/6/7) mind 200.

**Tanulságok:**
- Négy SUB párhuzamos pre-commitja (load 15–34) az időzítés-érzékeny kapukat buktatta → a commit-sor (E→B→D→C) oldotta meg (`~/rc-briefs/fizetes-csomag/commit-sor.md`).
- GitHub-incidens (11-04 délelőtt) alatt a kulcs szakaszosan „Permission denied”-et kapott — nem kulcs-hiba; újrapróbálás.
- Az élesítést kétszer a futó éles scrape tartotta (GATE 4) — megvártuk, nem `--ignore-scrape`.
- Az `admin-modules-amenities` súgó-kép két render között billeg (83234fe9 ↔ 5db5b090); a deploy kép-kapuja ezért időnként bukik — a kapu friss renderjét kell commitolni. Gyökérok nincs kivizsgálva.

**Nyitott (tulaj):** CITO-2026-5 (103 Ft) és -6 (55 Ft) teszt-számlák sztornója; Websupport „tulajdonosi információ nem egyezik a domain profillal” figyelmeztetés a dunavibehouse.hu-n (a domain működik).

**Módosított fájlok (koordinátor):** `MEMORY.md`, `scripts/cfm-relay.mts`, `scripts/partner-kb-shot.mts`, `kb/entries/{admin-modules-amenities,console-partner-page,console-partners,console-documents}/assets/hu/*.png`, ez a jegyzet. Briefek és jelentések: `~/rc-briefs/fizetes-csomag/`.

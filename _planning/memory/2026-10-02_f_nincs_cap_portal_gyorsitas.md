# 2026-10-02 — Places F (SUB): nincs költség-cap, booking.com kihagyva, hovamenjek fullHd

**Brief:** `~/rc-briefs/places-f-nincs-cap-es-portal-gyorsitas.md` · koordinátor: CIT „Places API 600 $” (`~/wt/citddb048b5`)
· döntés: ADR-XXXX (`_planning/decisions/XXXX-nincs-koltseg-plafon-a-scrape-ben.md`).

## Elvégezve
1. **Cap-felirat** (`src/console/views.ts`, KB `console-scrape` két helyen, `screen.png` + `runs.png` újragyártva
   `kb-shot --out`-tal, csak ez a kettő tért el): a cap a mentett új leadek számát vágja, a Places-költséget nem.
   A mező neve „Cap” maradt (a KB **„Cap”** idézetei érvényesek). A `help-start/approved-C.html` befagyott
   terv-kontraktus régi KB-pillanatképet tartalmaz — szándékosan nem írtam át.
2. **Details-keret = figyelmeztetés** (`googleMaps.ts`, `LeadSource.warnings()`, `run.ts` → `stats.warnings`, konzol
   futás-sor ⚠️). Őr: `scrape-coverage-check` ⑧ (mutációval 6 piros).
3. **booking.com `challenge_protected`** (`portals/registry.ts`). Mérve: AWS WAF 202, ~4 KB. Őr: `portal-uncapped-check` 4.
   (mutációval piros), pre-commit trigger a registry-re is.
4. **hovamenjek `fullHd`** a kért cache HELYETT — indok és mérés az ADR-ben (futáson belül 317/321 egyedi URL, a lassúság
   a `main` 404-jeiből jött). `photo-quality-check` igazítva. `portal-backfill.mts` becslése frissítve (49,4 s / 40 lead).

## Mérések
- dev 40 lead (2 pár): hovamenjek 404 140–151 → 0; ≥800 px fotó 351 → 654; wall változatlan (~50 s).
- éles 40 lead (2 pár, lokális olvasás, DB-írás nélkül): wall 98,2 / 63,8 s → 49,3 / 49,5 s; ≥800 px 230 → 340.
- A régi 78 perces becslés a régi kóddal ma sem reprodukálódott (1,6–2,5 s/lead).

5. **2. kör (koordinátor):** a `PLACES_DISCOVERY_MAX_CALLS` is figyelmeztetési szint lett (`PLACES_DISCOVERY_WARN_CALLS`),
   a bejárás végigmegy; őr `scrape-coverage-check` ⑤ (mutációval 4 piros). Külön commitban a main pirosát is javítottam:
   `src/ops/googleCostReport.ts` a közös `formatNumber`-rel csoportosít (`money-format-check` ⑤).

## Nyitott (a koordinátornak)
- A memória `project_after_deploy_portal_backfill` „~78 perc”-et ír — a mérés szerint ~20–45 perc várható.
- A tárolt hovamenjek `main` URL-ek (régi olvasások) a következő újraolvasáskor `fullHd`-re cserélődnek.

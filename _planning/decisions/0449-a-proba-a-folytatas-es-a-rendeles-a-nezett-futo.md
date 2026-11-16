## ADR-0449 — A próba, a folytatás és a rendelés a nézett / futó tervhez kötve

**Dátum:** 2026-11-16 · **Döntött:** tulaj („Próba javaslat OK!”), koordinátor (approved-kapu, rendelés-javítás:
`~/rc-briefs/tervvaltas/A-kiegeszites.md`) · **Kapcsolódik:** ADR-0342 (kártya nélküli próba), ADR-0344/0354
(folytatás), §F.19 / plan-tabs (a rendelés a képernyőn lévő tervhez köt), ADR-0440 (egy kattintásos indítás)

**Kontextus (mérve).** A /p lap több tervet mutat (`/p/<t>/v/<n>`), de
① az „Indítsa el” minden tervlapon `/p/<t>/trial`-ra posztolt, és a `startTrial` mindig a
`prospect.mock_artifact_id`-t (1. terv) konvertálta — a 2. terven indított próba az 1. tervet kapta;
② a próbázó fizetése (`/folytatas`) a `/p/<t>/request`-re ment (1. terv), és a fizetéskori `convertLead` az
ORDER artifactjából újraépíti a site-ot → egy 2. tervű próba fizetéskor 1. tervre váltott volna;
③ a `/p/<t>/v/<n>/request` a terv artifactját átadta, de a rendelés nem tárolta, az aktiválás
`prospect.mock_artifact_id`-t konvertált → fizetés után mindig az 1. terv élesedett.

**Döntés.**
1. **`POST /p/<t>/v/<n>/trial`**: a próba a terv artifactjából épül; a tervlap gombja a saját címére mutat.
   A régi `/p/<t>/trial` = 1. terv marad (a kint lévő linkek nem törnek).
2. **Csak a link saját terve:** a `startTrial` a `listProspectPlans` ellen ellenőriz — idegen artifact →
   `not_found`; a felajánlott, de **elutasított** terv → `not_available`, a foglalás ELŐTT (nincs sor, nincs riasztás).
3. **Approved-kapu:** a tervkészlet `generated` tagja konvertálható — a vevő indítása/rendelése a jóváhagyás
   (`approveArtifactForBuyerOrder`, naplózva, a 2026-09-13-i szabály); a `rejected` továbbra sem.
   A `requestPayment` fulfilment-kapuja a rendelés TERVÉT nézi (`coalesce(plan_artifact_id, prospect.mock_artifact_id)`).
4. **`order_intent.plan_artifact_id` (0137):** a rendelés a beküldés artifactját tárolja; az aktiválás ezt
   konvertálja (NULL = régi rendelés → `prospect.mock_artifact_id`, mint eddig). Más terven beadott azonos
   rendelés nem „iker” (nem kapja a másik terv pay-linkjét).
5. **Folytatás = a futó terv:** `/p/<t>/folytatas` a próba-site `source_artifact_id`-jét mutatja és
   `/p/<t>/folytatas/request`-re posztol; a régi `/p/<t>/request` próbázónál szintén a futó tervet rendeli.

**Kapu:** `scripts/trial-plan-binding-check.mts` (+ `--self-test`), pre-commit bekötve.
**Élesítés:** migráció 0137 → `deploy-prod.sh` pg_dump-pal. Meglévő próbaoldal újrarenderelése nem kell
(a render nem változott).

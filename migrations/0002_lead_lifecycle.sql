-- 0002 lead lifecycle status — the owner-confirmed lead state machine (2026-07-08,
-- see _planning/PROCESS.md "KANONIKUS LEAD-ÉLETCIKLUS"). State 0 (scraping) is the
-- scrape_run level (pre-lead); a lead row is born at state 1 (identified+qualified).
-- Transitions (what advances a lead) are process-driven and come in a later slice;
-- this migration only establishes the state set. Slugs are stable code identifiers.

ALTER TABLE lead ADD COLUMN lifecycle_status text NOT NULL DEFAULT 'qualified'
  CHECK (lifecycle_status IN (
    'qualified',      -- 1: lead beazonosítás + kvalifikáció
    'mock_curation',  -- 2: mock-create + kurátori jóváhagyás
    'outreach',       -- 3: megkeresés
    'conversion',     -- 4: konverzió
    'subscription',   -- 5: előfizetés (fizetés)
    'activation',     -- 6: élesítés (csak fizetés után)
    'modification',   -- 7: módosítás / változás
    'terminated'      -- 8: megszűnés
  ));

CREATE INDEX lead_lifecycle_status_idx ON lead(lifecycle_status);

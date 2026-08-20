-- Curator verdicts on SUSPECTED DUPLICATE lead pairs.
--
-- WHY A VERDICT TABLE instead of merging on sight: the same signal (two leads
-- sharing a website, a phone or a doorstep) covers four different realities,
-- and only a human can tell them apart —
--   · the same business under two names   → Bánó Porta Köveskál / Bánó Gábor
--   · one property, many units            → Abbázia Club Hotel Sárga/Kék/Piros…
--   · one owner, several businesses       → Eldorádó Kemping / Eldorádó Fogadó
--   · a chain sharing one website         → Ensana Thermal Aqua / Ensana Hévíz
-- Auto-merging would fuse two real hotels; auto-ignoring leaves duplicates in
-- the funnel. So the machine PROPOSES, the operator RULES, and the ruling is
-- remembered so the same pair is never raised twice.
--
-- Pair identity is order-independent: (a,b) and (b,a) are the same pair, which
-- the caller enforces by always storing the lexicographically smaller id first.
CREATE TABLE IF NOT EXISTS lead_link (
  lead_a      uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  lead_b      uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  -- duplicate  : same business → one lead kept, the other disqualified
  -- same_owner : distinct units/businesses, one owner → ONE outreach, kept apart
  -- unrelated  : coincidence (shared portal page, neighbours) → never ask again
  verdict     text NOT NULL CHECK (verdict IN ('duplicate', 'same_owner', 'unrelated')),
  -- Which lead was kept when the verdict is 'duplicate' (NULL otherwise).
  kept_id     uuid REFERENCES lead(id) ON DELETE SET NULL,
  -- What made us suspect the pair (website | phone | email | proximity) — kept
  -- so the detector's precision can be measured against real verdicts later.
  signal      text,
  note        text,
  decided_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_a, lead_b),
  CHECK (lead_a < lead_b)
);

CREATE INDEX IF NOT EXISTS lead_link_b_idx ON lead_link (lead_b);

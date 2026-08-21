-- Kiadási időszak: WHEN the unit is available at all, and for how few nights (ADR-0049).
--
-- WHY THIS BELONGS ON THE EXISTING SEASON ROWS AND NOT IN A NEW TABLE: the owner
-- already describes their year once, in unit_price — "Főszezon, 06-15 → 08-31,
-- 28 000 Ft". Adding a second list of periods for "when am I open" would be two
-- records of the same fact, and the two would disagree the first time one is edited.
-- (Exactly the trap already caught once: site_unit vs. the rooms module's own text
-- list.) So a season row now carries all three things a period decides: the price,
-- the minimum stay, and — through the unit's flag — whether it is bookable at all.
--
-- WHY A FLAG RATHER THAN "unlisted = closed": most owners rent all year and only use
-- seasons to vary the price. Making unlisted days closed by default would flip every
-- existing tenant to "nothing is ever free" overnight. Opt-in keeps today's behaviour
-- and lets a seasonal owner say so explicitly.

-- Per-season minimum stay. NULL → the booking module's site-wide minNights applies,
-- so an owner who never touches this sees no change.
ALTER TABLE unit_price
  ADD COLUMN IF NOT EXISTS min_nights integer CHECK (min_nights IS NULL OR (min_nights >= 1 AND min_nights <= 60));

-- "Csak a felsorolt időszakokban adom ki." FALSE (default) = open all year, seasons
-- only refine price/minimum — today's behaviour, unchanged for every existing unit.
ALTER TABLE site_unit
  ADD COLUMN IF NOT EXISTS seasonal_only boolean NOT NULL DEFAULT false;

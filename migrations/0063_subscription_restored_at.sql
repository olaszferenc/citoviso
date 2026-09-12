-- ADR-0080 ⑥ — the THAW needs a trace of its own.
--
-- Measured 2026-09-11 (Elek FK-006b): paying the arrears set status back to
-- 'active' and cleared frozen_at, so the restore left NO mark anywhere. The
-- freeze was loud (red banner, e-mail, five dunning messages); coming back was
-- silent — the owner's only positive signal was a small green dot and the
-- absence of the banner, while the newest message in the feed still read
-- "Honlapja felfüggesztve".
--
-- frozen_at cannot carry this: it is cleared by the very event we want to show.
-- restored_at is the moment the site came back, so the admin can say so for a
-- few days and then stop — a permanent banner would be its own kind of lie.

ALTER TABLE subscription
  ADD COLUMN IF NOT EXISTS restored_at timestamptz;

COMMENT ON COLUMN subscription.restored_at IS
  'When a billing freeze was lifted by payment (ADR-0080 ⑥). NULL = never frozen, or frozen right now.';

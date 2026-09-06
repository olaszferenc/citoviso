-- 0051 BOOKING NOTIFICATIONS — a jóváhagyott Foglalások-fül + levél-terv adatrétege
-- (tulaj-jóváhagyás 2026-09-06, kontraktus: assets/design-refs/tenant-admin/foglalasok-README.md).
--
-- Three columns, one story: the owner SEES requests (badge), DECIDES with a word to
-- the guest (comment into the mail), and every terminal state records WHO ended it —
-- the owner, the guest (cancel link), or the machine (overlap auto-decline, expiry).

-- 1) Badge truth: when the owner first saw this request in the Foglalások tab.
--    NULL = never seen → counts into the nav badge. Set when the tab renders.
ALTER TABLE booking_request ADD COLUMN seen_at timestamptz;

-- 2) The owner's (or guest's, on guest-cancel) message attached to the verdict.
--    Quoted in the guest's e-mail — this is content, not log, hence its own column.
ALTER TABLE booking_request ADD COLUMN decision_note text;

-- 3) Who moved the request into its terminal state.
--    'owner'  — verdict from the e-mail link or the admin
--    'guest'  — the cancel link in the confirmation mail
--    'auto'   — overlap auto-decline (another request won the nights)
--    'system' — expiry (autoDeclineHours passed with no answer)
ALTER TABLE booking_request ADD COLUMN decided_by text
  CHECK (decided_by IN ('owner', 'guest', 'auto', 'system'));

-- Badge query support: unseen pending per site.
CREATE INDEX booking_request_unseen_idx ON booking_request (site_id)
  WHERE seen_at IS NULL;

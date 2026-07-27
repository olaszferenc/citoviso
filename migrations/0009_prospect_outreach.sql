-- 0009 prospect outreach fields (PILOT.md §2.5 + §6) — the tracked-outreach slice.
-- sent_at: when the operator actually sent the outreach (H1 funnel base — the
-- click-through rate is measured against SENT prospects, not created ones).
-- unsubscribed_at: GDPR/Grt. opt-out. An unsubscribed prospect gets no further
-- outreach AND no further tracking (the /p/ page stops recording views/events).
ALTER TABLE prospect
  ADD COLUMN sent_at timestamptz,
  ADD COLUMN unsubscribed_at timestamptz;

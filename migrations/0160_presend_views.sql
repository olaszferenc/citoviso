-- 11-27 (owner: Sirató 82 went out today, the funnel said „last seen 11-25 20:59”, send→open −2135 min): a visit
-- recorded BEFORE the link was sent is ours (check letter, approval page, test), not the lead's. Since this release
-- POST /p/:token/view records nothing for an unsent prospect (server.ts); here the 16 earlier such visits go
-- (mock_event cascades; prospect_question / offer keep their row with the view link nulled).
DELETE FROM mock_view v
USING prospect p
WHERE p.id = v.prospect_id
  AND (coalesce(p.sent_at, p.email_sent_at, p.sms_sent_at, p.mms_sent_at) IS NULL
       OR v.started_at < coalesce(p.sent_at, p.email_sent_at, p.sms_sent_at, p.mms_sent_at));
-- The funnel status those visits raised steps back: 'opened' without any remaining visit = 'sent' (or 'created' if
-- the link never went out). 'engaged' and later are a person's act (question, order) and stay.
UPDATE prospect p
SET status = CASE WHEN coalesce(p.sent_at, p.email_sent_at, p.sms_sent_at, p.mms_sent_at) IS NULL THEN 'created' ELSE 'sent' END
WHERE p.status = 'opened'
  AND NOT EXISTS (SELECT 1 FROM mock_view v WHERE v.prospect_id = p.id);

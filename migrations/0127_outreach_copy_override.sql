-- 0127 OUTREACH COPY OVERRIDE — the owner rewrites one lead's first outreach on the approval page.
--
-- WHY. Owner request 2026-11-06: on the console's approval page (/jovahagyas) he sees exactly what
-- would go out — the letter's subject and body, the companion SMS of the MMS+SMS pair — and may edit
-- it before saying „Mehet”; the send then uses his text for that lead.
--
-- One JSON per dispatch row (one row per lead, unique lead_id): {subject?, parts?{greet,hook,p1,p2,p3,
-- trial,p4}, pairSms?, by, at}. NULL = the machine text. Only the prose is stored; links, opt-out, legal
-- notice and identity are composed around it at send time (src/outreach/copyOverride.ts), so they can
-- never be edited away. Applied only while the row's artifact is the prospect's mock.

ALTER TABLE outreach_dispatch ADD COLUMN IF NOT EXISTS copy_override jsonb;

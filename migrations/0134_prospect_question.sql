-- 0134 PROSPECT QUESTION (ADR-0440, kerdes-inditas — owner approved 2026-11-12, plan
-- assets/design-refs/prospect-page/kerdes-inditas/).
--
-- The lead page's ONE free-question field („Más kérdése van? Írja be…”). The answer to a question
-- that matches a ready category is DETERMINISTIC and shown on the page (no LLM, no API call);
-- this table is the ledger the spam limits count on, and the place an UNMATCHED question waits.
--
--   category  — the ready answer it matched ('ar', 'koltseg', …, 'smalltalk'); NULL = unmatched.
--   recorded  — an unmatched question that went to the owner's approval queue (outreach_reply,
--               source_key 'page:<id>' — ADR-0440 ⑥: nothing is answered automatically outward).
--               At most 5 per prospect per Budapest day; the rest is kept here, unrecorded.
--   own_view  — asked on the owner's own preview (?sajat=1): stored, never queued.
-- Not stored at all: an empty / too long text, a text with a link, e-mail or phone number, a
-- repeat of the previous question, and anything over the per-day or per-IP ceiling.
CREATE TABLE IF NOT EXISTS prospect_question (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  view_id     uuid REFERENCES mock_view(id) ON DELETE SET NULL,
  text        text NOT NULL CHECK (char_length(text) BETWEEN 1 AND 300),
  category    text,
  recorded    boolean NOT NULL DEFAULT false,
  reply_id    uuid REFERENCES outreach_reply(id) ON DELETE SET NULL,
  own_view    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prospect_question_prospect_idx ON prospect_question (prospect_id, created_at DESC);

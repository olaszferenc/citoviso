-- ADR-0045 ③ (§J.25): document-level knowledge-base translations. One row per
-- (entry, lang). source_hash pins the Hungarian source version the translation was
-- made from — a mismatch marks the row stale and the ensure layer regenerates it
-- (the same self-heal doctrine as language_pack, but the unit is a whole markdown
-- document, not a UI string).
CREATE TABLE IF NOT EXISTS kb_translation (
  entry_id     text NOT NULL,
  lang         text NOT NULL,
  source_hash  text NOT NULL,
  title        text NOT NULL,
  body_md      text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entry_id, lang)
);

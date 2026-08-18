-- ADR-0036: one-time provisioned UI-string translation packs, keyed by language.
-- strings: jsonb map { "<hungarian source string>": "<translated string>" }.
CREATE TABLE IF NOT EXISTS language_pack (
  lang         text PRIMARY KEY,
  strings      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status       text NOT NULL DEFAULT 'generated',
  generated_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

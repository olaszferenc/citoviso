-- BEJÖVŐ ÜZENET FORDÍTÁSA a konzol-nyelvre (terv: assets/design-refs/console/orszag-szuro-forditas/).
--
-- Az irányítópult „Válaszok a megkeresésekre” blokkja a beszélgetést (a bejövő üzenet, a kiküldött
-- megkeresés, Poe javaslata, a messenger-kísérőszöveg) az operátor konzol-nyelvén is mutatja. A kód
-- SEMMIT nem fordít (ADR-0412): Bábel kap jegyet, és a konzolon (`babel` fiók) teszi le a fordítást.
-- Egy sor = egy szöveg-rész egy célnyelven. A source_hash a forrás-szöveg ujjlenyomata: ha a forrás
-- megváltozik (Poe átírja a javaslatát), a régi fordítás nem látszik, és új jegy megy.
CREATE TABLE IF NOT EXISTS outreach_reply_translation (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reply_id      uuid NOT NULL REFERENCES outreach_reply(id) ON DELETE CASCADE,
  -- body = a bejövő üzenet · ours = a kiküldött megkeresés (e-mail/SMS) · outreach = a messenger-
  -- megkeresés kísérőszövege · suggestion = Poe javasolt válasza
  part          text NOT NULL CHECK (part IN ('body', 'ours', 'outreach', 'suggestion')),
  -- A célnyelv (operator_user.lang értékkészlete, pl. 'hu', 'en').
  target_lang   text NOT NULL,
  -- sha256(forrás)[0..16] — a fordítás csak ehhez a forráshoz érvényes.
  source_hash   text NOT NULL,
  text          text NOT NULL,
  translated_by text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reply_id, part, target_lang)
);

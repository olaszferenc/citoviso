-- 0162 POE TANUL A KIMENT VÁLASZOKBÓL (tulaj, 2026-11-28: „Poe nézzen mintákat, hogy mik azok a
-- válaszok, amik hivatalosan kimentek, tanuljon abból is”).
--
-- MIÉRT KELL. Küldéskor a válasz saját során álló javaslatot a rendszer törli (0096 / ADR-0340: egy
-- „Visszavonás” után ugyanaz a szöveg ne álljon újra egy koppintásnyira). Így 2026-11-28-ig a 67
-- kiküldött válasz egyikénél sem látszott, mit javasolt Poe, és mit írt át rajta az operátor —
-- pedig Poe pont ebből tanul. A javaslat ezért a KÜLDÉS sorára másolódik, a küldés pillanatában
-- állt alakjában (a válasz során a régi törlés marad).
ALTER TABLE outreach_reply_send
  ADD COLUMN IF NOT EXISTS suggestion_text    text,
  ADD COLUMN IF NOT EXISTS suggestion_subject text,
  ADD COLUMN IF NOT EXISTS suggestion_by      text,
  ADD COLUMN IF NOT EXISTS suggestion_basis   text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN outreach_reply_send.suggestion_text IS 'Poe javaslata a küldés pillanatában (NULL = nem volt javaslat, vagy 0162 előtti küldés) — a kiment szöveggel együtt Poe mintája.';

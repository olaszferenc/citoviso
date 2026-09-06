-- 0053 LEIRATKOZÁS-NAPLÓ — a `prospect.unsubscribed_at` MOZGÁSÁNAK audit-nyoma.
--
-- A hiány, ami kikényszerítette (2026-09-06): a dev DB-ben EGY leiratkozás zárta le
-- mind a 8 prospectet, mert a suppression szándékosan SZEMÉLY-szintű (azonos cím /
-- azonos normalizált szám bárhol → tilt, lásd isEmailSuppressed + isPhoneSuppressed).
-- A tulaj kérdése — „mindenkinél leiratkozott van VALAMIÉRT" — megválaszolhatatlan
-- volt: a `unsubscribed_at` egyetlen dátum, nem mondja meg, KI és MIÉRT.
--
-- És ez a fontosabbik ok: a visszavonás JOGILAG SÚLYOS aktus. Az opt-out a SZEMÉLYÉ
-- (GDPR/Grt.), tehát csak akkor törölhető, ha az érintett maga kérte. Egy „visszavonás"
-- gomb indoklás és nyom nélkül pontosan az a művelet, amivel egy hatósági vizsgálatot
-- el lehet bukni. A napló ezért NEM kényelmi extra, hanem a gomb LÉTFELTÉTELE:
-- ki vonta vissza, mikor, és milyen alapon.
--
-- Mindkét irány ide kerül, hogy a sor teljes legyen:
--   'unsubscribe'  — a címzett maga kattintott a /p/<token>/unsubscribe linken
--   'resubscribe'  — operátor vonta vissza a konzolon, kötelező indoklással
--
-- MIÉRT ÚJ TÁBLA:
--   • mock_event (0003): egy MEGNYITÁSHOZ (mock_view) kötött viselkedés-esemény. A
--     leiratkozás nem feltétlen egy view-ból jön, és az operátori visszavonás pláne nem.
--   • curator_decision (0003): a MOCK jóváhagyása, artifact-hez kötve — más entitás.
--   • tenant_message (0044): a NOT NULL tenant_id per definíció kizárja a hideg
--     megkeresést (ADR-0084 ④) — a prospect még nem ügyfél.
--
-- ⚠️ A napló a BEKAPCSOLÁS NAPJÁTÓL él. A már meglévő `unsubscribed_at` értékekhez NEM
-- gyártunk visszamenőleges sort: kitalált actor/indoklás egy audit-naplóban rosszabb,
-- mint az üres állapot (§B.17). A felület ezt őszintén megmondja.
CREATE TABLE IF NOT EXISTS prospect_optout_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id  uuid NOT NULL REFERENCES prospect(id) ON DELETE CASCADE,
  action       text NOT NULL CHECK (action IN ('unsubscribe', 'resubscribe')),
  -- KI tette. Önkiszolgáló leiratkozásnál a címzett maga ('lead'), visszavonásnál az
  -- operátor felhasználóneve — szabad szöveg, mint a curator_decision.decided_by.
  actor        text NOT NULL,
  -- MILYEN ALAPON. A visszavonásnál KÖTELEZŐ (az alkalmazás kényszeríti ki, mert egy
  -- CHECK nem tudja megkövetelni, hogy értelmes legyen); leiratkozásnál üresen marad.
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- A prospect leiratkozás-története, legújabb elöl (a lead-oldal ezt mutatja).
CREATE INDEX IF NOT EXISTS prospect_optout_log_prospect_idx
  ON prospect_optout_log(prospect_id, created_at DESC);

COMMENT ON TABLE prospect_optout_log IS
  'A prospect.unsubscribed_at mozgásának audit-nyoma: önkiszolgáló leiratkozás és operátori visszavonás (kötelező indoklással). Az opt-out a SZEMÉLYÉ — a visszavonás csak az érintett kérésére jogszerű, és ez a tábla a bizonyítéka.';

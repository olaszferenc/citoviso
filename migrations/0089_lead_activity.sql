-- 0089 LEAD-NAPLÓ — ki szerkesztette utoljára a lead egyes füleit.
--
-- A tulaj kérése (2026-10-05): „a leadnél látszódjon, hogy adott tabot ki szerkesztette
-- utoljára (pl. mockot ki hozta létre)". Jóváhagyott terv: assets/design-refs/console/lead-lastedit/
-- (A változat — minden fül alatt „<név> · <mikor>").
--
-- A hiány: a lead-hez tartozó táblák (lead, mock_artifact, prospect, order_intent…) egyikén
-- sincs szerző-mező, a curator_decision.decided_by pedig minden sorban a beégetett „console"
-- szöveg volt (dev DB: 26/26). Szerzőt utólag kitalálni nem lehet, ezért NAPLÓ kell, ami a
-- KÉRÉS pillanatában rögzíti, ki tette.
--
-- MIÉRT ÚJ TÁBLA, és nem egy-egy `updated_by` oszlop a meglévőkön: a fül nem egy tábla. Az
-- „Adatok" a lead.raw-t írja, a „Megkeresés" a prospectet és a kiküldést, a „Mock" a
-- mock_artifactot és a curator_decisiont. Egy fülenkénti „utolsó" egyetlen helyről csak
-- naplóból olvasható ki, és a mock „Létrehozta" sora ugyanebből jön (subject_id).
--
-- ⚠️ A napló a BEKAPCSOLÁS NAPJÁTÓL él. A meglévő adatokhoz NEM gyártunk visszamenőleges sort:
-- kitalált szerző rosszabb, mint a „—" vagy a „nem rögzített" (§B.17). A felület ezt kimondja.
CREATE TABLE IF NOT EXISTS lead_activity (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      uuid NOT NULL REFERENCES lead(id) ON DELETE CASCADE,
  -- A lead-lap füle, amelyhez a művelet tartozik (a fül `id`-je a konzolon).
  tab          text NOT NULL CHECK (tab IN (
                 'ls-data', 'ls-mocks', 'ls-outreach', 'ls-orders', 'ls-photos', 'ls-contacts', 'ls-admin')),
  -- Gépi kulcs (pl. 'mock.generate', 'prospect.send'); a felirat a konzolon él, nem itt.
  action       text NOT NULL,
  actor_kind   text NOT NULL CHECK (actor_kind IN ('operator', 'owner', 'system')),
  -- Operátor esetén a fiók; a fiók törlése a nevet NEM viszi el (actor_label marad).
  operator_id  uuid REFERENCES operator_user(id) ON DELETE SET NULL,
  -- A megjelenő név PILLANATKÉPE a művelet idején (operátornál a felhasználónév).
  actor_label  text,
  -- A művelet tárgya, ha van: mock_artifact / prospect / order_intent azonosítója.
  subject_id   uuid,
  at           timestamptz NOT NULL DEFAULT now()
);

-- Fülenként a legutóbbi bejegyzés (a lead-lap ezt olvassa).
CREATE INDEX IF NOT EXISTS lead_activity_lead_tab_idx
  ON lead_activity(lead_id, tab, at DESC);

COMMENT ON TABLE lead_activity IS
  'Ki mit tett a lead egyes fülein (operátor / a szállás tulaja / rendszer), a művelet pillanatában rögzítve. A lead-lap fülenként a legutóbbit mutatja, a mock-kártya a „Létrehozta" sort. A bekapcsolás előtti állapotra nincs sor — szándékosan.';

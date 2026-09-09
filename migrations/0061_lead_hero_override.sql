-- OPERÁTORI NYITÓKÉP-VÁLASZTÁS (jóváhagyott terv: assets/design-refs/console/hero-override/)
--
-- A motor választja a nyitóképet (heroPick.ts: galéria-sorrend + vision-pontszám). A gép jó,
-- de nem tévedhetetlen, és a kurátor néha többet tud a leadről, mint amennyi a képen látszik.
-- A gép ítélete javaslat; a döntés az emberé.
--
-- Miért a LEADHEZ tapad és nem a mock-artefaktumhoz (tulajdonosi döntés, 2026-09-09):
-- egy leadhez sok mock készül (új sablon, újraírt szöveg, kurátor-kör). Ha a választás az
-- artefaktumon ülne, minden újragenerálás eldobná, és a kurátor újra és újra ugyanazt a
-- kattintást csinálná — a rendszer pedig "elfelejtené", amit egy ember már eldöntött.
CREATE TABLE lead_hero_override (
  lead_id    uuid PRIMARY KEY REFERENCES lead(id) ON DELETE CASCADE,
  -- A választott fotó URL-je, ahogy a generátor is látja (teljes alak, query-vel együtt;
  -- az egyeztetés query nélküli kulcson megy, mert a Places-URL aláírt és lejár).
  url        text NOT NULL,
  -- KI választotta. A felülbírálat felelősségi aktus: a "miért ez a kép?" kérdésre a
  -- lapon egy név álljon, ne egy anonim sor (ugyanaz az elv, mint az opt-out
  -- visszavonásnál, 0053).
  actor      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE lead_hero_override IS
  'Operátori nyitókép-választás leadenként. Felülírja a heroPick pontszám-sorrendjét, és túléli az újragenerálást.';

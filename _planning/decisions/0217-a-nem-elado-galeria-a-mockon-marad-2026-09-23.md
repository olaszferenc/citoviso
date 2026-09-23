## ADR-0217 — A nem eladó galéria a mockon marad (2026-09-23)

**Dátum:** 2026-09-23 · **Státusz:** elfogadva (megvalósítva az őrben) · **Visszafordíthatóság:** 🔄 ·
**Kapcsolódó:** ADR-0102 (nem eladó modul), a 2026-08-25-i „üzleti csalás" szabály
(`scripts/configurator-placement-check.mts`).

**Kérdés.** Ha a Galéria modul „nem eladó", a csomagválasztó már nem kínálja — de a mockon a
galéria-szekció (a lead fotói) megmaradt. Ez a „ne látsszon semmi, ami nincs a csomagban" szabályba
ütközik.

**Döntés (tulaj, 2026-09-23).** A galéria **marad** a mockon akkor is, ha nem eladó: a lead SAJÁT
fotói, nem kitalált mintaadat, és nélkülük a mock üres volna. A kivétel CSAK a galériára és CSAK
nem eladó állapotra szól; eladható galéria továbbra is a csomagot követi (ki-be kapcsol vele).

**Elvetett alternatíva.** A nem eladó galéria eltűnik a mockról (következetes, de üres mockot ad).

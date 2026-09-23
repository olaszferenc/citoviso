## ADR-0005 — Mock-generálás: paraméteres dizájn-rendszer + AI-ízlés + seed-variáció (nem kaptafa)

- **Dátum:** 2026-07-09
- **Döntés:** A mock NEM fix sablon (klón) és NEM tiszta AI-HTML (megbízhatatlan), hanem **három réteg:**
  (1) **fix tartalom-modell** (mit tartalmaz), (2) **AI arculat-brief** — vízió a fotókból + fellelt adatból:
  paletta + hangulat + layout-archetípus, (3) **renderer szállásra SEED-elve** variálja a betűpárt/szekció-
  sorrendet/akcentet/hero-stílust → egyedi, de reprodukálható. + **régión belüli ütközés-kerülő** (szomszédok
  ne hasonlítsanak).
- **Miért:** a pilot horga a varázslatos, személyre szabott mock; **szűk régióban** a szomszéd-leadek NEM
  kaphatnak hasonló arculatot. Bizalom-kritikus → strukturális biztonság + AI-ízlés korlátok közt.
- **Visszafordíthatóság:** 🔄 (PoC-ként indul; 3-4 valós leaden bizonyítjuk, utána terjesztjük)
- **Elvetett:** tiszta template (kaptafa) · tiszta AI-generált HTML (törik, QA-zhatatlan tömegben, drága).
- **Státusz:** ELFOGADVA (PoC-first).

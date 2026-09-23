## ADR-0007 — Mock-generálás: GROUNDED AI-generátor + minta-katalógus (nem fix könyvtár, nem paraméteres skin)

- **Dátum:** 2026-07-09
- **Kontextus:** a tulaj bemutatta, hogy a Claude API **valóban szerkezetileg különböző** mockokat generál
  (editorial / immersive-dark / quiet-minimal / carousel / cinematic-horizontal) — szemben a paraméteres
  motorral (ADR-0005/0006, reskin) és a 180-as zip-pel (1 váz × típus-skin). → az AI-generálás a helyes út.
- **Döntés:** a mock-motor magja **AI-generálás (Claude API):** szabadon a SZERKEZETEN (itt a sokszínűség),
  de **kötötten a TÉNYEKEN.** Harness:
  - **Szerkezet:** a promptot a **szerkezeti minta-katalógus** (`_planning/DESIGN-CATALOG.md` §1) tereli —
    „diverz = ezek/ezekhez fogható; a régióban már használtakat kerüld" (anti-collision a `mock_artifact`-naplóból).
  - **Stílus:** a 180 type-referencia (`assets/design-refs/types/`) mint few-shot (paletta/hangulat/tipó).
  - **Tartalom SZIGORÚan valós** (DESIGN-CATALOG §3): nincs fabrikált tény, nincs emoji (SVG), valós fotó,
    provenance/demo-jelölés. Ismeretlen adat → szekció kihagyva.
  - **Kuráció-gate** (kész) + retry + HTML-validálás; lead-enként egyszeri generálás.
- **Miért:** valódi szerkezeti sokféleség (a szűk-régiós szomszéd-teszt), bizalom/jog megőrzésével.
- **Visszafordíthatóság:** 🔄 (PoC 3-4 valós leaden; a paraméteres motor fallback marad).
- **Elvetett:** fix statikus könyvtár (kaptafa v. fabrikált tartalom) · szabad AI-HTML grounding nélkül (jogi kockázat).
- **Státusz:** ELFOGADVA (PoC-first). ADR-0005/0006 paraméteres motorja fallback-re degradálva.

## ADR-0012 — Levegősség-kontroll: prompt-budget (számszerű függőleges ritmus) + render-mért QA-gate

- **Dátum:** 2026-07-12
- **Kontextus:** a reveal-fix (2026-07-11) után is maradt „lágy airiness" — a generált mockokban ~13–29%
  (mobil átlag ~20%) HOLT függőleges sáv (szekció-magasság − a tartalom valós kiterjedése). A prompt már
  tiltotta („üres-sáv-tilalom"), de PROSE-ként, nem mérve → törékeny (ld. reveal-tanulság).
- **Diagnózis (objektív, headless render):** három ok — (1) mobil-padding nem skálázódik (asztali ~6–7rem
  függőleges padding mobilra ömlik), (2) lefoglalt, de kitöltetlen magasság (nem-hero `min-height`/`vh` rövid
  tartalommal → alsó üres sáv), (3) túl nagy belső al-blokk-rés (120px+).
- **Döntés (a tulaj választása a 3 opcióból): PROMPT-BUDGET + QA-GATE** — NEM vak runtime CSS-felülírás
  (eltalálná a szándékos luxus-levegőt), NEM (még) auto-regeneráló kör (költség).
  1. **Prompt-budget** (`ADAPT_SYSTEM` 8. szabály): számszerű függőleges-ritmus keret — reszponzív
     `padding-block: clamp(...)` (nincs fix 6rem+), NON-hero magasság a tartalmat kövesse (csak hero lehet
     teljes magasságú), al-blokk-rés ≤ ~2.5rem, cél ~85%+ tartalom-kitöltés, tier-érzék (luxus a felső végén).
  2. **QA-gate** (`src/generator/qaAiriness.ts`): render-alapú levegősség-mérő (tag-agnosztikus sáv-detektálás
     → per-szekció holt sáv). Bekötve `generateMock`-ba best-effort, NEM-blokkoló → mér + `airinessDeadPct`
     az artifactba; egyelőre NEM regenerál. CLI: `scripts/qa-airiness.ts <mock> [width]`.
- **Validálva (élő A/B, Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%.
  A budget STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, a szekció fent/lent-rés 114px→68px,
  nincs nem-hero min-height). A maradék ~17–19% már döntően belső al-blokk-rés + hero-kompozíció (részben
  legitim lélegzés) — a két strukturális ok elhárult.
- **Következő, ha kell:** ha a mért holt% küszöb fölött marad, a QA-gate → célzott regeneráló kör (A2,
  kivétel-alapú); vagy a belső-rés budget élesítése. Az adat (`airinessDeadPct`) most már gyűlik.
- **Visszafordíthatóság:** 🔄 · nincs vak felülírás, a prompt-szabály és a mérő önállóan visszavonható.
- **Státusz:** ELFOGADVA — élő A/B-vel bizonyítva.

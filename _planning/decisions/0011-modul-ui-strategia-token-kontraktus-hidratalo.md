## ADR-0011 — Modul-UI stratégia: token-kontraktus + hidratáló runtime (nem 100×N kézi meló)

- **Dátum:** 2026-07-10
- **Kontextus:** ha ~100 archetípus × N modul, a modul-UI-t NEM lehet archetípusonként kézzel lefejleszteni
  (O(archetípus × modul) = halál). A tulaj kérdése: hogyan kerül pl. a foglaló-modul mind a 100 archetípusba?
- **Döntés — a modul két rétege, és két kontraktus köti össze:**
  1. **Viselkedés = standard, egyszer megírva** (nem UI) — egy hidratáló runtime csatolja.
  2. **Megjelenés kétféle** (modul-jelleg szerint): statikus/egyszerű → az LLM írja in-skin archetípusonként
     (ingyen, natív illeszkedés); komplex/interaktív → EGY token-témázott widget egy slotba mountolva.
  - **A) Téma-kontraktus:** minden archetípus kiadja a szabvány `--cit-*` CSS-tokeneket → a widget/megosztott CSS
     ezekből öltözik → egy widget minden archetípusban natív.
  - **B) Modul-kontraktus:** `data-cit-module="<típus>"` + `data-cit-variant` horgok → egy runtime hidratál,
     bármilyen a markup.
  - **A számla: O(archetípus) + O(modul), NEM O(archetípus × modul).** Új archetípus ≈ O(1) (tokenek+horgok);
     új modul ≈ O(1) (egy handler + ha komplex, egy widget).
- **Most MEGÉPÍTVE (a tulaj: „ne maradjon későbbre"), kredit nélkül validálva:**
  `assets/runtime/cit-modules.css` (token-alapú widget-stílus) + `cit-runtime.js` (registry + hidratálás +
  az első interaktív widget: **booking/érdeklődés**, bar/card variáns) + `src/generator/runtime.ts` (a runtime
  INLINE injektálása a generált mockba, mert az standalone HTML) + a promptok kiadják a kontraktust +
  3 különböző témájú fixture bizonyítja: egy widget, három natív megjelenés (`assets/runtime/fixtures/`).
- **Tényhűség:** a mock-booking érdeklődés/foglalási IGÉNYT állít össze (dátum+létszám), nem hazudik
  élő elérhetőséget/árat/fizetést — az Szint 4 (konverzió után).
- **Következő modulok:** ugyanez a registry-minta (gallery-lightbox, reviews, map…). Spec: DOMAIN/06-UI-CONTRACT.md.
- **Visszafordíthatóság:** 🔄 · Építi ADR-0009/0010-et (moduláris platform, hibrid render szigetek).
- **Státusz:** ELFOGADVA — élő kóddal bizonyítva.

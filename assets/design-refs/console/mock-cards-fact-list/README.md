# Mock-kártya: a tényhűség-jelvény megmondja, MIT jelölt meg (H-2 „1”)

**Jóváhagyva:** 2026-10-02 (tulajdonosi döntés a koordinátoron át: „egyetértek”), §2b terv-kapu, 0 / **1** / 2 változatból.
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A kártya alap-terve a `../mock-cards/` (A); ez a fájl azt köti,
amiben a megjelölt tényhűség-jelvény eltér tőle. Döntés: ADR-0300. Forrás-lelet: Elek élesi jelentése (2026-10-01), H-2.

| fájl | mi ez |
|---|---|
| `terv.html` | a működő terv a valódi konzol-CSS-sel (`?k=0` ma · `?k=1` jóváhagyva · `?k=2`), a viselkedést a `m3-card.js` adja |
| `kartya-mobil.png` | 390 px — a MEGVALÓSÍTOTT kártya csukva és kinyitott listával (a Muschel mock tárolt listájával) |
| `kartya-asztali.png` | asztali — kinyitva |
| `terv-0-1-2-mobil.png` | a döntési kör képe: ma · 1 (csukva, kinyitva) · 2 |

## Amit a terv KÖT
- Megjelölt tényhűség-kapu TÁROLT listával: a jelvény GOMB, és a leletek SZÁMÁT mondja (pl. „Tényhűség: 6 forrás nélküli ▾”).
- Kattintásra a lista a KÁRTYÁN nyílik, a jelvénysor alatt: **„A tényhűség-őr ezekre nem talált forrást:”**, minden tárolt
  tétel, alatta a teendő (javítás, vagy a küldés-felugróban **„Kiküldöm mégis”**). Újra kattintva csukódik.
- Induláskor csukva: a csukott kártya ugyanolyan kompakt, mint a `../mock-cards/` terve.
- Csak a SAJÁT kártyája nyílik (egy kezelő a rácson, nem kártyánként).
- Tárolt lista NÉLKÜL (régi mock) nincs üres lista és nincs kitalált szám: a jelvényen a régi „megjelölve” marad.

## Amit a terv NEM köt
- A lista TARTALMA (ma a MINTA-szakaszok tételeit is felsorolja, a valódi szabad-szöveg szivárgást nem): az a
  szöveg-valódiság szál dolga (ADR-0292). Ez a terv csak azt köti, HOL és hogyan látszik.

## Őr
- `scripts/mock-card-fact-list-check.mts` — a renderelt lead-lap valódi stíluslappal, Chromiumban, 390 és 1280 px;
  `--self-test`: a régi pirulára visszarontva bukik.

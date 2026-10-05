# Mock-kártya: Vera-ellenőrzés a kurátori (Poe-) mockon — az AI-őrök helyett

**Jóváhagyva:** 2026-10-05 (tulajdonosi döntés a koordinátoron át), §2b terv-kapu, **B** változat (A: a jelvény nyitja — elvetve).
**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A kártya alap-terve a `../mock-cards/`; ez azt köti, amiben a kurátori mock kártyája eltér tőle.
Döntés: ADR-0329 (az ADR-0323 D2-t módosítja).

| fájl | mi ez |
|---|---|
| `terv.html` | a működő terv a valódi konzol-CSS-sel (`?v=B` = jóváhagyva; Mobil/Asztali váltóval) |
| `B-{mobil,asztali}-2-urlap.png` | ítélet nélkül: a rögzítő a kártyán, validációs hibával |
| `B-{mobil,asztali}-3-flag.png` | FLAG rögzítve |
| `B-{mobil,asztali}-4-pass.png` | PASS rögzítve |

## Amit a terv KÖT
- A kurátori mockon NINCS Tényhűség / Piac / Vendég-kritikus jelvény (az AI-őr nem fut); a jelvénysorban **„Vera-ellenőrzés”** áll.
- Ítélet nélkül a jelvény „Vera-ellenőrzés: hiányzik”, FIGYELMEZTETŐ színnel (a flag-token), SOHA nem zöld. Zöld (pipa) CSAK PASS-nál; FLAG-nél „megjelölve”.
- Amíg nincs ítélet, a rögzítő ALAPBÓL a kártyán áll (nem kell kinyitni): **„Vera ítélete erre a szövegre”**, PASS/FLAG választó,
  jelentés-mező (kötelező, legfeljebb 200 karakter), megjegyzés (FLAG-nél kötelező, legalább 10 karakter), **„Ítélet rögzítése”** gomb.
  Üres mentés → hibaüzenet a mező alatt, semmi nem mentődik.
- Rögzítés után a rögzítő eltűnik; egy sor marad: ítélet · ki (a bejelentkezett operátor) · mikor · jelentés · megjegyzés · „új ítélet”.
- A szöveg bármilyen változása (kézi átírás, AI-újraírás) törli az ítéletet → újra „hiányzik”.
- Küldéskor hiányzó ítéletre NINCS „Kiküldöm mégis”: előbb ítélet kell. FLAG-re a meglévő megerősítés érvényes.

## Amit a terv NEM köt
- A jelentés-hivatkozás formáját (bármilyen szöveg; Vera a `jelentesek/…md` fájlnevét írja).
- A felugró mintájában látható magyarázó szövegeket (a terv-oldal saját jegyzetei, nem a konzol feliratai).

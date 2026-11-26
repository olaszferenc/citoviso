// „Országok / Árazás” 5. fázis (ADR-0489) — az árváltozás-értesítő levél (src/email/priceChangeNotice.ts) még le nem
// fordított vevő-oldali mondatai. A fordítás Bábel dolga (a kód semmit nem fordít; addig magyar fallback, és a
// fordítás nem blokkol). A HR elfogadási teszt ezt a hiányt engedi (részhalmaz-állítás): amint Bábel lefordítja, magától eltűnik.
export const BABEL_PENDING_ARVALTOZAS: readonly string[] = [
  "A Citoviso díjai {date} napjától változnak. Az Ön előfizetésére ez így vonatkozik:",
  "a folytatás utáni első terhelés (legkorábban {date})",
  "Az előfizetése most szünetel. Ha folytatja, a {date} utáni első terheléstől az új díj érvényes.",
  "Előfizetés kezelése",
  "Első terhelés az új díjjal",
  "évente",
  "havonta",
  "Mostani díj",
  "Új díj",
  "Változik a honlap-előfizetése díja — {site}",
  "Változik az előfizetése díja",
  "/ hó",
  "/ év",
  "Fizetés",
];

-- A piac-megjegyzés az OPERÁTOR képernyőjén (Beállítások ▸ Piacok) jelenik meg, a
-- 0057 seedje viszont két belső ADR-számot írt bele: „Hazai piac: a teljes jogi csomag
-- magyar jogra készült (ADR-0056, ADR-0110)." Az operátor az ADR-számot nem tudja
-- kikeresni — a fejlesztői azonosító helye a kód-komment, nem a felület.
--
-- ⚠️ Ezt egyetlen forrás-grep sem találta meg: a szöveg ADAT, nem literál. A renderelt
-- réteg (scripts/internal-ref-check.mts ①) mérte ki a valódi /settings lapról.
--
-- Csak azt a sort igazítjuk, ami MÉG a seed szövegét viseli — ha egy operátor közben
-- átírta a megjegyzést, az az ő szövege, nem nyúlunk hozzá.
UPDATE market
   SET note = 'Hazai piac: a teljes jogi csomag magyar jogra készült.'
 WHERE country = 'HU'
   AND note = 'Hazai piac: a teljes jogi csomag magyar jogra készült (ADR-0056, ADR-0110).';

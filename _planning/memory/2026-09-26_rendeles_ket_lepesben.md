# 2026-09-26 — Rendelés két lépésben (telefon): az 1. lépés a csomag-listáé (A szál, ADR-0240)

## Kiváltó
A tulaj telefonon (Három Huszár Apartments lead-mock, 20:02) azt látta, hogy a konfigurátor 74vh-s
alsó lapját a pinnelt pénzügyi lábléc tölti ki (Havi/Éves kártyák, MOST FIZETENDŐ, ÁFA, következő
terhelés, gomb). A csomag/modul-listából egy sor látszott. A koordinátor három szálra bontotta:
A = két lépés (ez), B = a lap-görgetés, C = az indító gomb.

## Döntés (§2b)
Két változat került elé: A = üres lábléc, B = lábléc + kis Havi|Éves kapcsoló. A tulaj a
**B**-t választotta. A két nyitott kérdésben a javaslat szerint mentem (a tulaj nem mondott
mást): asztalon is így, és a 2. lépés első látványa a Havi/Éves kártya-pár.
Kontraktus: `assets/design-refs/console/order-two-step/`. Felülírja a `period-toggle-step1`
①② pontját (a README-ben jelölve).

## Megépítve
- `assets/runtime/cit-configurator.js`: új lábléc-szerkezet. `.cit-cfg-s2scroll` (s2top:
  vissza, választott csomag, kérdés, permat; utána sum, vatnote, nextcharge, §A), s2-es
  görgetés-jelző, `.cit-cfg-s1bar` (ppill + mini összeg + „Tovább”), a `.cit-cfg-step2`-ben
  már csak a submit és a jegyzet. `showStep2()` panel-állapot (`cit-cfg-panel--s2`),
  `syncRecap()`, `syncMini()` (currentCharge + ajánlat-sor + delta), `setStrap("choose")`.
  A back3 és a függőség-hiány visszatérés a 2. lépésre visz, a `placeSummary` a sum-ot az
  s2scroll-ba teszi vissza.
- `assets/runtime/cit-configurator.css`: a két lépés szabályai, mobilon 92vh a 2. lépésen, a
  fekvő (max-height:520) ágban dupla osztályú felülírás.
- i18n-katalógus: +8 / −1 („Tovább a megrendeléshez” helyett „Tovább”).

## Őrök
- ÚJ: `scripts/order-two-step-check.mts` (390×844 · 844×390 · 1280×800, elementFromPoint,
  érintetlen görgetés). Önteszt 3/3 piros. Bekötve a `hooks/pre-commit`-be.
- Átállítva: `configurator-price-check` (1. lépés = mini összeg; a jelvényt és a domain-sort a
  2. lépésen méri; a két „már nincs benne” állítás a kártya DOM-szövegére kötve, különben üresen
  zöld lenne), `checkout-item-block-check` (1. lépés váltó = ppill; a fizetés-út a „Tovább”
  után vált), `renewal-date-coherence-check`, Elek FK-009 (`várd: látható "Tovább"`).
- Zöld: checkout-viewport, billing-checkout, module-dependency-cart, optout-offer-price,
  order-send-failed, barion-pixel, renewal-date-coherence, lead-page-surface,
  lead-mobile-check --gate (+ selftest), contract-drift, design-token-lint, i18n-lint.

## Csapda, amit elkaptam
A saját `.cit-cfg-mini__tot small {display:block}` szabályom a beágyazott „/ hó” `small`-t is
blokkszintűvé tette, ezért az egység új sorba tört. Ezt csak a képen láttam, a mérés zöld volt.
Javítás: `> small`.

## Nyitott
- A B szál (lap-görgetés elfogása) és a C szál (indító gomb) ugyanezt a két fájlt érinti. Ha
  utánam landolnak, rebase-kor ütközhetnek a lábléc környékén.
- Nincs élesítve (csak a nagy deployjal együtt).

## Utójavítás (ugyanaznap, tulaj-kérés): az Éves kártya „áráért” sora egy sorban
Asztalon és fekvő telefonon a „10 hónap áráért 12 hónap — 95 000 Ft/év” kettétört: 213 px-t kért egy 172 px-es
kártyában. A kód egy fölösleges „hónap”-ot tett a `period-badge` ⑤ szövegéhez, ezt kivettem (177 px). A széles
váltón (`@container ≥390px`) az Éves kártya `flex-grow: 1.2`-t kap (212 px). Az `order-two-step-check` méri
(különböző sor-tetők száma; a `getClientRects().length` beágyazott spannál egy soron belül is 2-t ad), egy
negyedik önteszt-mutációval.

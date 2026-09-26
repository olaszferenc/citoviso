## ADR-0240 — Rendelés két lépésben: az 1. lépés a csomag-listáé, a pénzügyi döntés a „Tovább” után

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (tulaj, B változat) · **Kontraktus:** `assets/design-refs/console/order-two-step/`

### Kontextus
A tulaj telefonon, egy lead-nézetben (Három Huszár Apartments) azt látta, hogy a konfigurátor
74vh-s alsó lapját a pinnelt lábléc tölti ki. A láblécben a Havi/Éves kártyák, a MOST FIZETENDŐ
kártya, az ÁFA, a következő terhelés és a gomb ült, így a csomag/modul-listából egy sor látszott.
A lábléc-elrendezést a `period-toggle-step1` kontraktus (2026-09-01) írta elő: a váltó az 1. lépés
láblécében, „mindig látszik mobilon is”.

### Döntés
1. Az 1. lépés lábléce egy sor: kis Havi | Éves kapcsoló, a futó összeg (ugyanaz a szám, amit
   elsőre terhelünk, ajánlatnál az „első díjból” sorral) és a „Tovább” gomb.
2. A „Tovább” után (panel-állapot: `cit-cfg-panel--s2`) a lista eltűnik. A 2. lépés sorrendje:
   választott csomag, „Milyen gyakran fizet?”, Havi/Éves kártyák (első látvány), MOST FIZETENDŐ,
   ÁFA, következő terhelés, §A nyilatkozat, pinnelt „Tovább a számlázási adatokhoz”. Mobilon a lap
   92vh-ig nőhet. A görgethető részt mért jelzés mutatja.
3. Mindkét méreten így (asztalon az oldalsávban is), egy szabály. Fekvő telefonon a panel egy
   oszlopban görget.
4. A fizetés-lap (`checkout-fullscreen`) változatlan. Vissza a 2. lépésre visz.

### Mit ír felül
- `period-toggle-step1` ① (a váltó az 1. lépés láblécében) és ② (pinnelt, mindig látszik) — a
  szándék a kis kapcsolóval megmarad, a nagy kártyák a 2. lépésre kerülnek.
- `offer-ui` ①: az ár-kártya helye a 2. lépés; az 1. lépés egysoros összege az ajánlatot is kimondja.
- A `period-badge` és a `checkout-fullscreen` szabályai érvényesek, változatlanul.

### Következmény
- Új őr: `scripts/order-two-step-check.mts` (3 nézet, `elementFromPoint`, piros önteszt 3 visszarontásra).
- Átállított őrök: `configurator-price-check` (1. lépés = egysoros összeg; a jelvényt és a domain-sort
  a 2. lépésen méri; a „már nincs benne” állítások a kártya DOM-szövegére kötve, mert az egysoros
  összeg sosem nevez domaint, és ott üresen zöldek lennének), `checkout-item-block-check` és
  `renewal-date-coherence-check` (a „Tovább” UTÁN váltanak évesre), Elek FK-009 („Tovább”).
- Nem tartozik ide: a lap-görgetés elfogása (B szál) és az indító gomb (C szál).

## ADR-XXXX — Álló telefonon is egy oszlopba csuk a fizetés-lap, ha az űrlapnak nem marad ablak (mért, nem töréspont)

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (hibajavítás a tulaj bejelentésére: „Itt továbbra sem lehet görgetni, kitakar mindent, a lead nem tud vásárolni”) · **Kiterjeszti:** ADR-0243 · **Felülírja:** `assets/design-refs/configurator/checkout-fullscreen/README.md` ② — CSAK ott, ahol fizikailag nem fér ki

### Kontextus
A checkout-fullscreen ② szerint mobilon az összeg felül, a pipák és a gomb alul rögzített, köztük
görög az űrlap. A kapu (`checkout-viewport-check`) ezt 390×844-en mérte — egy böngésző-lapban futó
telefonon viszont a címsor és a rendszersávok ~150 px-t elvisznek. Mérve (a tulaj képével egyezően):
390×690-en az összeg-kártya + ÁFA + következő terhelés (~180 px) és a pipa+gomb blokk (~300 px)
között az űrlap **24 px**-t kapott, benne a „görgessen — még van adat” pirula; 412×760-on 109 px;
360×640-en a „Fizetek” gomb a képernyő alsó éle alá lógott. A lead nem tudott vásárolni. Az
`cfg-sheet-scroll-check` S8 zöld volt, mert egy 24 px-es görgetőt is „végig lehetett húzni”.

### Döntés
A fizetés-lépés ugyanabba az egy görgető oszlopba csuk (fejléc → összeg → tétel → űrlap → pipák →
„Fizetek”), amit a tulaj fekvő telefonra már eldöntött (ADR-0243) — de itt NEM töréspont dönt, hanem
MÉRÉS: a futtatókód (`syncFold`) kiszámolja, mekkora ablakot hagyna a rögzített elrendezés az
űrlapnak, és **150 px alatt** `.cit-cfg-panel--fold`-ot tesz a panelre (vissza 190 px fölött — a
két küszöb közti rés hiszterézis, mert a görgetés-jelzés sávja csak a rögzített állapotban létezik).
Magas telefonon (390×844: 174 px) és asztalon (≥900 px, kéthasábos rács) a ② változatlan.

### Következmények
- Őr: `cfg-sheet-scroll-check` S10 (az űrlap ablaka ≥ 120 px, húzás ELŐTT mérve) + két új tartás:
  böngésző-lapos 390×690 és 360×640; piros önteszt: az összecsukás kivéve → S10 PIROS 390×690-en,
  390×844-en zöld.
- Összecsukott állapotban a „Fizetek” nincs az első képernyőn — ahogy fekvőn sem; a gomb úgyis
  tiltott, amíg a három pipa (amelyek közvetlenül fölötte állnak) nincs bejelölve.

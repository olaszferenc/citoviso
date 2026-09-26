## ADR-XXXX — Fekvő telefonon a fizetés-lap egy oszlopban görög (a checkout-fullscreen ② kivétele)

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (tulaj, a „Fekvő fizetés” kérdésre: „Egy oszlopban görgessen”) · **Felülírja:** `assets/design-refs/configurator/checkout-fullscreen/README.md` ② — CSAK alacsony nézetre

### Kontextus
A checkout-fullscreen kontraktus ② pontja előírja, hogy a három kötelező hozzájárulás, a végösszeg és
a fizetés-gomb EGY nézetben van, görgetés nélkül; a pipák és a gomb alul pinnelve, köztük görög az
űrlap. Fekvő telefonon (mérve 844×390, `scripts/cfg-sheet-scroll-check.mts`) ez fizikailag nem fér
ki: a pinnelt pipa+gomb blokk magasabb volt a képernyőnél, az űrlap görgető-ablaka ~24 px-re
zsugorodott a blokk alá, és a „Fizetek” a képernyő alsó éle alatt ült — semmilyen húzással nem volt
elérhető. Fekve tehát nem lehetett fizetni.

### Döntés
Alacsony nézeten (`@media (max-height: 520px)`, ugyanaz a töréspont, mint az 1. lépés fekvő ágáé) a
fizetés-lépés (`.cit-cfg-panel--billing`) EGYETLEN görgető oszlop: fejléc → összeg/tétel → űrlap →
pipák → „Fizetek”, olvasási sorrendben; a panel görög (`overscroll-behavior: contain`), a belső
zónák nem. A ≥900 px-es kéthasábos rács UTÁN áll, így a széles telefon (932×430) is oszlopba csuk.
Az űrlap saját „görgessen — még van adat” jelzése itt rejtett (az űrlap nem görög külön; a panel
görgetése a natív jelzés). Álló nézeten és asztalon a ② változatlan.

### Következmények
- Őr: `cfg-sheet-scroll-check` S8 (a fizetés-űrlap elérhető húzással) + S9 (a görgetés végén a
  „Fizetek” a képernyőn van, és az ujj ŐT találja), 844×390 és 932×430 tartáson; piros önteszt: a
  blokk kivéve → S9 PIROS fekvőn, álló 390-en zöld.
- ⚠️ Nyitott, NEM ennek a döntésnek a része: álló 360×780-on az ADR-0240 átszervezése után a
  számlázási űrlap ablaka ~24 px (a pipa-blokk takarja) — jelezve a koordinátornak/A szálnak
  (`~/rc-briefs/cfg-mobile-0926/B-jelentes-360-urlap.md`); az őrben hangos ismert-nyitott tétel.

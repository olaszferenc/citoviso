# 2026-09-27 — Fizetés-lap telefonon: mért összecsukás egy oszlopba (ADR-0247)

## Bejelentés
Tulaj, telefonon, egy kiküldött lead-linken: „Itt továbbra sem lehet görgetni, kitakar mindent, a lead nem tud vásárolni.”

## Mérés
Böngésző-lapban a telefon látható része ~390×690 (címsor + rendszersávok ~150 px). A fizetés-lépésen fent maradt
az összeg-kártya + ÁFA + következő terhelés (~180 px), lent rögzítve a 3 pipa + gomb (~300 px):
- 390×690: az űrlap-ablak **24 px**, benne a „görgessen — még van adat” pirula;
- 412×760: 109 px; 360×640: a „Fizetek” a képernyő alsó éle ALATT.
A `checkout-viewport-check` csak 390×844-en mért (ott 174 px), a `cfg-sheet-scroll-check` S8 pedig egy 24 px-es
görgetőt is „végig tudott húzni” — zölden.

## Javítás
- `assets/runtime/cit-configurator.js`: `syncFold()` — kiszámolja, mekkora ablakot hagyna a rögzített elrendezés
  (`panel.clientHeight − (panel.scrollHeight − coScroll.offsetHeight)`); 150 px alatt `.cit-cfg-panel--fold`,
  190 px fölött vissza (hiszterézis); ≥900 px széles nézeten soha. A `syncScrollHint()` hívja (minden elrendezés-
  változáskor) + resize; a fizetés-lépés nyitásakor a panel tetejére áll.
- `assets/runtime/cit-configurator.css`: a fold-osztály ugyanazt az egy-oszlopos szabálysort kapja, mint az ADR-0243
  fekvő `@media (max-height: 520px)` ága.
- `scripts/cfg-sheet-scroll-check.mts`: új S10 (az űrlap ablaka ≥ 120 px, húzás ELŐTT), új tartások 390tab (390×690)
  és 360tab (360×640); piros önteszt `no-fold`; a `no-landcol` szabotázs a fold-ot is kiveszi (különben fekvőn a fold
  gyógyít, és a kontroll semmit nem bizonyít).
- `assets/design-refs/configurator/checkout-fullscreen/README.md` ② — kivétel-bekezdés.

## Kiküldött linkek
Ma 3 link ment ki, mind a dev gépről (élesről 0). A konfigurátor kiszolgáláskor injektálódik
(`src/console/server.ts`), a land a fő fa konzolját újraindította → a meglévő linkek már a javítottat adják.
Tulaj telefonon igazolta: „működik”.

## Tanulság
A kapu-méret (390×844) nem a valódi telefon: böngésző-lapban ~150 px elmegy. Új telefonos őrnél a böngésző-lapos
tartás (390×690, 360×640) is kötelező; és „végig lehet húzni” nem azonos azzal, hogy „használható”.

## Nyitott
- Nincs élesítve (csak a nagy deployjal).
- A 150/190 px küszöb ítélet; ha egy tartáson zavaró ugrást okoz, ott mérni.

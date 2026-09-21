# Citoviso márkajel — jóváhagyott terv (E4)

**Jóváhagyva:** 2026-09-21, tulajdonosi döntés (§2b terv-kapu).
**Assetek:** `assets/brand/mark-e4-dark.svg` (sötét háttér) · `assets/brand/mark-e4-light.svg` (világos háttér).

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **A sötét fejlécben a márkajel van, nem helyettesítő.** ⛔ A `/pay/done` lap 2026-09-21-ig egy
   CSS-ből rajzolt karikát mutatott (`views.ts` `.pd-brand__mark`: 22 px kör,
   `border-right-color:transparent`), amiből **hiányzott a szem és a play-háromszög**. A jel közepe
   mérve **1,06 kontraszt** — vagyis üres. Ez volt a bejelentett „nem látszik jól".
2. **Sötét háttéren a szem VILÁGOS.** A navy pupilla (`#16283f`) a navy fejlécen mérve **1,44**
   kontraszt. A jóváhagyott E4 szem-kontrasztja **5,85**. ⛔ Fehér halo NEM megoldás: mérve
   utána is 1,44 — a glória a kontúrt emeli, a jel közepét nem.
3. **A play-háromszög a C SZÁJÁNÁL áll, nem a szemhez tapadva.** Rés a szem szélétől **21,5**
   rajz-egység; a play bal széle a C nyílásához képest **−2,6** (a korábbi rajzban −14,6 volt, és
   a tulaj ezt kifogásolta: „a play beljebb került a szemben, mint az eredeti logóban").
4. **A C-ív CIÁN** (`#1fb6d6`) mindkét háttéren — tulajdonosi döntés („a C körvonala is kék").
   A 2026-07-07-es `mark-gradient.svg` navy íve ezzel felülírva.
5. **Egy identitás.** Ugyanez a jel megy a számlára (Számlázz.hu), a fejlécbe és a favikonra.
   A világos és a sötét változat geometriája bitre azonos; csak a szem gradiense és a play
   színe tér el.

## Geometria (viewBox 120×120) — ez a kontraktus

| elem | érték |
|---|---|
| C-ív | `M84.6 29.3 A42 42 0 1 0 84.6 90.7`, `stroke-width:12`, `linecap:round` |
| a C szája | x = 84,6 |
| szem | `cx=48 cy=60 r=12.5` |
| csillanás | `cx=42.5 cy=54 r=3.5` |
| play | `M82 49 L82 71 L102 60 Z` |

## Mihez mértük

Vázlat: `assets/design-refs/_drafts/brand-mark-variants.html` (A–G) és `brand-e-play.html`
(E1–E4). A kontrasztok a VALÓDI renderből mérve, 22 px-es jelen, a `/pay/done` gradiensén —
nem tokenből számolva.

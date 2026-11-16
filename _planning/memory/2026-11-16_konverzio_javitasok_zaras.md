# 2026-11-16 — Konverzió-elemzés és a három gépi javítás (zárás, cit8a744532)

**Cél:** ~1000 hideg megkeresés ~0,1%-os konverziójának elemzése, és három NULLA HUMÁN javítás.

## Elvégezve
- Elemzés PDF (2026-11-05), mentés: `~/rc-briefs/elemzes/`.
- B — modulonkénti státusz + beállító varázsló (ADR-0429) — élesen.
- C — viselkedés-üzenetek, leadenként egy (ADR-0439) — élesen 977f90f1 óta; a főkapcsolót a tulaj 2026-11-16-án bekapcsolta.
- A — „Kérdése van?” + egy kattintásos indítás (ADR-0440) — élesen 7a0f111a (prod/20261113-1220) óta, hotfix-úton; azóta a későbbi deployok (f3e5b2fc) is tartalmazzák.
- Útközben: billing-checkout-check picsum-függetlenítés; KB-javítások (console-dashboard, console-free-trial, console-report: ADR-0442 utánkövető levél).

## Döntések (tulaj)
- SMS ékezet nélkül; C = egy üzenet/lead, hétköznap 8–20, −30% eszkaláció marad, „NEM” nem iratkoztat le.
- A: T2, „Megrendelem most” másodlagos link, próba a választott csomaggal, éves −25% az első évre, korlát 100/lead/nap · 300/IP/óra, gépi válasz kifelé még nincs, click-wrap egy mondat, cég-telefon ki a levelekből; jogi oldalakon marad.

## Nyitott
- A picsum.photos-függő ~30 kapu hálózat-függetlenítése (kapu-gazdák).
- trial-report-check 23–24 óra közötti billegése.

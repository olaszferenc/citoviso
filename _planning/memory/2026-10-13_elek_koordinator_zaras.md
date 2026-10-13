# 2026-10-13 — Elek-koordinátor zárása (lead / tenant / IT ellenőrző kör, deploy előtti javítások)

## Elvégzett munka (koordinátor, kódot nem írt)
- Elek ellenőrző körök három lencsével (lead: MEHET, tenant: MEHET + 6 apróság, IT: NEM MEHET → B1/B2/K1/A1).
- Landolt SUB-ok: ADR-0367 portál-naptár javítások · ADR-0368 dinamikus levélár (`src/packageOffer.ts`) · ADR-0369 eszkalációs felső sáv + „+ saját .hu cím” jelvény ·
  ADR-0370 modell-HTML szűrő (`src/generator/modelHtml.ts`) · ADR-0371 21 valódi portál-iCal minta + 4 javítás · ADR-0372 ragadt domain riasztás 24/72 h ·
  ADR-0373 „Mi tartotta vissza?” alsó sáv + önálló SMS GSM-7 · deploy-blokkolók (`src/engine/htmlOutsideScripts.ts`, KB-képek, A1 hiba= jelzés).
- ÉLES: `465e5394` (`prod/20261012-2326`, tulaj-deploy 2026-10-12 23:26).
- Deploy UTÁN landolt (élesen még nincs): `206773c8` tenant-aprók (N1 díjsor végződésenként, N2 levél-gomb, N3 egysoros vendégmezők, N4 első jelszó,
  N6 tényleges domain-díj mondat, iCal azonos-link figyelmeztetés) · ADR-0381 `2c066158` csomag-domain automata igénylés (`claimPackageDomain`) ·
  `a1f05d87` csomag-tartalom díjsor: „A név a csomag része, külön díja nincs. Ha kisebb csomagra vált, a név díja ({ár}/hó) elindul.”

## Tanulság
- Az általam javasolt N6 mondat („12 hónap után a név az Öné marad; a havidíj a honlapért fut”) TÉVES volt: a NÉV díja a hűségidő után is fut,
  amíg a név a honlaphoz tartozik; lemondáskor (hűségidő végigfizetve) vételár nélkül a tulajé (ÁSZF 1.5 §9, `domainFeeForRenewal`).
- Egy SUB (deploy-blokkolók B1) tulaj-engedély nélkül nyitotta a felület-kaput — utólag a tulajhoz vittem; a briefekbe kell: kivétel CSAK a koordinátoron át.
- A tenant-aprók SUB fájában (`~/wt/cit8b8f5c14`) maradt egy nem landolt, egy soros MEMORY.md commit (`e7547459`) — a tartalma ebben a MEMORY.md-ben benne van.

## Nyitott
- 4g/2: első vásárlónak a „régi cím” helyett az ingyenes citoviso.com-os cím? · CSP bevezetése (pilot első napjai után) ·
  valódi Booking/Szállás.hu szinkronteszt egy leaddel ingyen hónapokért · tulaj: /pricing .hu „Csomagban ingyen” pipa ·
  a fenti három landolt változás a következő deployjal megy élesre.

# 2026-10-13 — Webcím díjsor csomag-tartalom névnél: nincs „0 Ft/hó” (tulaj „ok”)

SUB az Elek-teszt koordinátornak (`cit333dea6d`), brief: `~/rc-briefs/domain-csomag-dijsor-szoveg-20261013.md`.
Az ADR-0381 „kívül marad” pontja: az 1. lépés díjsora csomag-tartalomnál „A név díja 0 Ft/hó, és 12 hónapos előfizetés
vállalásával jár …” mondatot írt.

## Megoldás
- `src/domains/domainAdmin.ts`: két új mező — `listFeeByDomain` (a javasolt név végződésének /pricing-díja csomag NÉLKÜL,
  `offeredTldOf(..).monthlyFee`) és `listFeeRange` (a kínált végződések díjsávja).
- `src/server/adminViews.ts` `domainFeeLine`: díj 0 (vagy kijelölés nélkül, ha a csomag viszi a nevet) →
  „A név a csomag része, külön díja nincs. Ha kisebb csomagra vált, a név díja ({price}/hó) elindul.”; a kijelölés váltása
  (data-dline) a végződés díjára vált (.hu 1 000, .eu 1 200). A fizetős mondat változatlan.
- i18n-katalógus: +1 kulcs (a két régi kulcs él tovább a fizetős ágon).
- KB `admin-domain` „Ha a csomagom tartalmazza…” szakasz kiegészítve; a KB-kép fixture-je fizetős → kép változatlan.

## Őr
`scripts/domain-package-claim-check.mts` ⑤: az új mondat, a kijelölt végződés ára, díjsáv kijelölés nélkül, nincs „0 Ft”
(ezres-tagolás levéve), a fizetős sor változatlan. Mérve a régi kódon: 4 bukás; az újon zöld.
`domain-order-single-flight-check` zöld (fixture kiegészítve).

## §2b
Szöveg-csere a meglévő mintán; a tulaj a mondatot 2026-10-13-án kimondva jóváhagyta („ok”).

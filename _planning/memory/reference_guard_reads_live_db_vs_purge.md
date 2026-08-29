# ⚠️ NYITOTT: a bizonylat-lapozás-őr az ÉLŐ dev DB-ből mér — a purge után minden server.ts-commit elakad

**Típus:** reference / open infra gotcha · **Mérve:** 2026-08-29

## A csapda
A `scripts/documents-paging-check.mts` (ADR-0073, „a lapozás sorokat vág, pénzt nem") **a KÖZÖS élő
dev DB-ből** olvas (`getDocuments`), és ≥7 `accounting_document`-et igényel (3 oldal × 3 pageSize),
különben az önvalidációja pirosra megy („0 sor / 3 = 1 oldal — a kapu nem mérne semmit"). A
**teszt-adat purge (ADR-0075) 0-ra ürítette a bizonylatokat** → ez a kapu üres halmazon nem tud
mérni. Diff-scope: `partnerData.ts | partnerViews.ts | **server.ts**` — tehát **BÁRMELY server.ts-t
érintő commit elakad** a gépen, akkor is, ha köze sincs a pénzügyhöz.

## Miért ez a rossz minta
A testvér-kapuk (`module-upsell-check`, moderation) **saját eldobható fixture-t építenek** — ez az egy
az élő DB-re támaszkodik. Két szál döntése ütközik: ADR-0073 (kapu élő adatot vár) ↔ ADR-0075 (purge
kiüríti). Egyik sem hibás önmagában; a metszet a törött.

## Amit ideiglenesen tettem (2026-08-29)
`npx tsx scripts/seed-partner-demo.mts` → 14 `seed-partner-demo`-jelölt bizonylat (DEV-ONLY, idempotens,
`--clean`-nel törölhető, prodon megtagad). Ezzel a kapu mér, a commitok mennek. **Ez részben visszahozza,
amit a purge kitakarított** — kompromisszum, nem javítás.

## A TARTÓS javítás (nyitott, tulaj döntése)
A `documents-paging-check` álljon át a testvérei mintájára **saját eldobható fixture-re** (építsen
throwaway bizonylatokat egy tranzakcióban, mérjen, majd görgesse vissza) — akkor üres dev DB-vel is
mérne, és senkit nem blokkolna. Alternatíva: skip-on-empty (gyengébb — üres DB-n nem mér). Amíg ez
nincs meg, a seedet NE `--clean`-eld, különben újra blokkol minden server.ts-commit.

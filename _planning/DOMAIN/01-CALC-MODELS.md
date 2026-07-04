# 01 — SZÁMÍTÁSI MODELLEK (Citoviso ontológia)

> Az üzleti/pénzügyi számítások kanonikus képletei. Ha egy szám máshol máshogy jön ki, ITT a forrás.

## Unit economics (per tenant)
- **Marginális költség / ügyfél** ≈ néhány € : generálás (gépidő + AI-token, pár cent) + hosting (0,5–2 €/hó megosztott) + domain (~10 €/év, ha adunk).
- **Bruttó margin** @ ~100 €/év vagy €20–50/hó ≈ **90%+**.
- **Volumen-modell:** árbevétel ≈ `tenant_szám × éves_díj`. Cél-nagyságrend: pl. 2000 × 100 €/év = 200k €/év.

## Ügyfél-oldali megtérülés (a horog)
- **Jelenlegi költség:** booking-jutalék = `éves_foglalási_forgalom × 0,15–0,18`. Példa: 3–4M Ft forgalom → 450–700e Ft/év.
- **Megtakarítás:** `átcsábított_direkt_foglalás_arány (20–30%) × jutalék`. A saját oldal havidíja ehhez képest töredék → hónapos megtérülés.

## Árazási sávok (referencia, 2026-07-04)
- Klasszikus kézi/ügynökség: €1000–3000 (EU) / $2000–5000 (US) egyszeri.
- Citoviso: €0–600 setup + €20–50/hó, VAGY ~100 €/év.
- Preferált: **havidíj** (8 €/hó jobban konvertál, mint 100 €/év egyben).

## Rejtett költség
- **Support** — skálázódik a tenant-számmal; önkiszolgáló admin nélkül megöli a margint. Modellben: `support_óra/hó × tenant` → tartsd ~0 közelében.

> TODO: LTV/churn, akvizíciós költség (outreach konverzió), infra-lépcsők (N tenant → szerver-szint).

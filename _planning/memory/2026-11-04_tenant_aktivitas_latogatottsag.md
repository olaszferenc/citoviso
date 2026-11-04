# 2026-11-04 · Tenant-aktivitás és látogatottság a konzolon (SUB-D, Fizetés-szál)

**Fa:** `~/wt/citf899a788` · **Koordinátor:** a Fizetés-szál (cit7e001214) · **Döntés:** ADR-XXXX (tulaj: 1A + 2A).

## Elvégezve
- Felmérés élesen (11-03): `tenant_activity` 4 sor; `site_visit` 1414 sor (1172 nem bot) — a valódi tenantoknál vendég ≈ 0, a tesztdomainek forgalma szkenner; a régi számláló a saját megnyitást is vendégnek vette; az nginx-napló Host nélküli, 14 napos (visszamenőleg nem bontható); ország csak a Cloudflare mögötti slug-hoszton lenne.
- Terv (3 + 2 változat) → befagyasztva: `assets/design-refs/console/tenant-aktivitas/` (README köti).
- Kód: `src/analytics/referrerGroup.ts` (forrás-csoport), `src/console/tenantActivityData.ts` (adat, `summarizeVisits`, `verdictOf`), `src/console/tenantActivityViews.ts` (blokk + Tenantok oldal), `src/console/partnerActivity.ts` (a SUB-C slotja kitöltve), `/report/tenants` route, Riport-fül + nav-elem, CSS-blokk (`ta-*`), őr `scripts/tenant-activity-check.mts` (pre-commit).

## Nyitott
- Kattintás-mérés / ország / UTM / aloldal: új adatkezelés → jogi csomag előbb (tulaj most nemet mondott).
- Linkes belépés nem írja a `tenant_user.last_login_at`-ot.
- Élesítéskor: migráció NINCS, backfill NINCS — tiszta olvasó-réteg.

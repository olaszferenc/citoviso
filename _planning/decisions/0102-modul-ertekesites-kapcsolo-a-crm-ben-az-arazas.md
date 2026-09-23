## ADR-0102 — Modul-értékesítés kapcsoló a CRM-ben; az árazás átköltözik; email-modul alapból nem eladható (2026-09-06)

**Döntés (tulaj):** ① Operátor-kapcsoló modulonként: „értékesíthető igen/nem". Kikapcsolva
ÚJ előfizetés nem köthető a modulra SEHOL, ahol eladás indulhat (prospect-konfigurátor,
outreach-mock ALL-IN minta, konverzió ALL-IN fallback, tenant-admin upsell) — a MEGLÉVŐ
entitlementek érintetlenül futnak és kezelhetők maradnak. ② A teljes `/pricing` felület a
Pénzügyből a **CRM-be** költözik („Árazás és értékesítés"): felső CRM-legördülő menüpont +
Irányítópult CRM-kártya sor `N/14 eladó` badge-dzsel. ③ Az **email-modul alapból NEM
eladható** (seed) — saját marketing-körrel hirdetjük ki később; addig a mockban sem
mutatható mintaként (§I: nem ajánlunk olyat, amit nem adnánk el).

**Megvalósítás:** `src/moduleSales.ts` — a lista EGY `app_setting` sor (`module_sales_disabled`,
JSON), NEM `module_price`-oszlop (ár-sor nélküli modul is kapcsolható + worktree-k közti
migráció-ütközés elkerülése). Hiányzó sor → seed `["email"]`; mentett `[]` explicit
„minden eladó". Mock-oldal: `renderSite({sampleDeny})` — CSAK szűkít, a phase-kaput nem
nyitja (szemben a `sampleAllow`-val). §I-határ: EXPLICIT beküldött order-intent moduljai
konverziókor MEGMARADNAK kikapcsolás után is (az az ajánlat már megtörtént); csak az
ALL-IN fallback szűr. Write-kapuk: `applyModuleChange` + `planModuleChange` a kézzel
formált POST-ot is elutasítja (additív-írás-nem-kapu lecke); a lemondás-visszavonás nem
új eladás, az átmegy. Jóváhagyott terv (2 elutasított „szellős" kör után, kompakt/csík
nélküli végállapot): `assets/design-refs/console/pricing-sales/`.

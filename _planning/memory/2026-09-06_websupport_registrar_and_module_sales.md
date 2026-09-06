# 2026-09-06 — Pilot-leltár · ADR-0102 modul-kapcsoló · Websupport-registrar váltás + citoviso.hu vétel

## Elvégzett munka

**① PILOT-ÉLES LELTÁR (tulaj-jóváhagyott v2)** — `_planning/PILOT-GO-LIVE-INVENTORY.md`
(landolva `e4baccb`). Mért alapok: éles = `a8304ee`, **118 commit / 17 migráció lemaradás**;
GATE 1c (kb-gate token) most BUKIK; **élesen 0 timer fut** (billing/dunning sosem futna!);
`SESSION_SECRET` hiányzik a prod .env-ből (dev-default cookie-aláírás!); INVOICE/PAYMENT=mock,
Barion sandbox-URL. ⛔ Tulaj-korrekció beépítve: **TELJES kör a hatókör** — minden ág, amit a
fizetős út elérhet, induló-blokkoló (domain-ág, SMS-relay is). GATE 1b (jogi) zöld.

**② ADR-0102 — modul-értékesítés kapcsoló (landolva `ef3ccbd`)** — 3 mock-kör után
(2 „szellős" kör tulaj-visszadobva: „ne legyen benne kurva csík") kompakt terv befagyasztva
`assets/design-refs/console/pricing-sales/`. Megvalósítva: `src/moduleSales.ts`
(app_setting `module_sales_disabled`, seed=email-off), szűrés mind a 4 eladási ponton
(konfigurátor+preset, mock all-in `sampleDeny` — csak szűkít, phase-kaput nem nyit,
konverzió-fallback §I-határral: explicit order érintetlen, tenant-upsell write-kapuval),
a teljes `/pricing` átköltözött a CRM-be („Árazás és értékesítés": CRM ▾ legördülő +
Irányítópult-kártya badge `N/14 eladó`), email-modul alapból NEM eladható.

**③ Websupport-registrar váltás (tulaj: „mehet"; INWX ejtve — .hu 2 599 vs ~10 500 Ft/év)**
— két mélyfúró kutatás (domain-API + mailbox-API) + ÉLŐ mérések, majd **citoviso.hu MEGVÉVE
gépileg** (validate→dryRun→order 22266509→pay/byCredit ~5 mp) és a **.hu registry-megerősítés
is géppel lenyomva** (cfm.drr.hu, kód elhasználva=siker). Registrant a registry-űrlapon:
**Olasz Ferenc magánszemély** (a Websupport-admin „tulajdonos" mezője a FIÓKOT mutatja — ez
okozta a Mineral-riadalmat). Részletek+mért API-tények: memória
`reference_websupport_registrar_state`. Botrány+lecke: az első vétel a Mineral-fiókon
futott (számla a Kft.-re, értesítők info@minerallog.hu-ra — a 4 levél továbbítva
olasz.ferenc@citoviso.com-ra); tulaj KÜLÖN Citoviso-fiókot nyitott (olaszferenc/3213041,
kulcsok lokál .env-ben), szolgáltatás-átadás #211604 folyamatban.
⛔⛔ Saját hiba memóriába írva (`feedback_approved_params_are_the_approval`): a jóváhagyott
paraméter (domain-profil) kiesése után újrakérdezés nélkül vettem.

**Mellék-döntések:** hosting-csere NEM (shared alkalmatlan, VPS nyereség-nulla; a hosting
POSTAFIÓKRA jó — tenant-email-modul ~440 Ft/tenant/hó, post-pilot POC a meglévő Mineral
Super csomagon is mérhető); Zoho-kiváltás → POC utánra; terv-B NS-architektúra: megvett
domain a Websupport-NS-en + zone-API + Let's Encrypt a VPS-en (CF-token nem kell) — ADR-ba
írandó.

## Módosított/létrehozott fájlok (mind landolva)
- `_planning/PILOT-GO-LIVE-INVENTORY.md` (új) · `_planning/DECISIONS.md` (ADR-0102)
- `src/moduleSales.ts` (új) · `src/modules.ts` · `src/engine/render.ts` ·
  `src/generator/{configurator,generateEngine,recopy}.ts` ·
  `src/console/{server,views}.ts` · `src/tenant/{modules,moduleChange,moduleUpsell}.ts` ·
  `public/assets/ui/citui-console.css` · `src/i18n/catalog.json`
- `assets/design-refs/console/pricing-sales/` (befagyott terv, 4 fájl)
- Repón kívül: lokál `.env` (WEBSUPPORT_* kulcsok, Citoviso-fiók) + 3 auto-memória fájl

## Nyitott kérdések / következő lépések
1. **ADR-0103 + `websupport.ts` adapter** — a mért API-viselkedésre (HMAC, validate,
   byCredit-retry, autoExtend); vásárlás CSAK igazolt kontakt-adatokkal.
2. **#211604 átadás figyelése** — ha a citoviso.hu megjelenik az olaszferenc-fiókban, szólni;
   utána domain-profil felvétel az új fiókban.
3. **Delegálás-figyelés** — `host -t NS citoviso.hu` ≠ NXDOMAIN után: zone-API + terv-B mérés.
4. **KB-javítások a deploy-kapuhoz** (tudasbazis-or FLAG): admin-modules-booking elavult kép,
   admin-domain hiányzó kép + console-pricing entry frissítése (ADR-0102 után) → kb-gate token.
5. **Leltár-frissítés**: A4/A5 (INWX/CF) → Websupport-tételekre átírni.
6. Tulajnál: minerallog API-kulcs visszavonása · support-ticket (adószám-validátor +
   Mineral-ra ment számla átírása) · Barion éles bolt · Számlázz éles kulcs.

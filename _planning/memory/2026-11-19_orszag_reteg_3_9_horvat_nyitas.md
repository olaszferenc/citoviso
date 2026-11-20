# 2026-11-19 — Ország-réteg 3/9: Horvátország nyitás-kész (scratch DB) + Elek három szerepben

Brief: `~/rc-briefs/orszag-reteg-3i-horvat-nyitas-elek-20261119.md` · session `citc6bc0387` · koordinátor `cit9b4690e3` · ADR-0461.

## Elvégezve
- **HR ország-sor** migrációban (`migrations/0142_country_hr.sql`): EUR, hr, Europe/Zagreb, +385/0, mobil 91 92 95 97 98 99,
  .hr+.com, portálok (apartmanija.hr, direct-croatia.com, adriagate.com, adriatic.hr, smjestaj.com.hr, croatia.hr),
  ünnepnapok NN 110/2019 szerint (fix napok + 2026/2027 húsvét, húsvéthétfő, úrnapja), csak e-mail, ablak 8–17, IFA `none`,
  `invoice_lang hr`. Mellette ÜRES `hr` ár-régió (EUR, nem jóváhagyott). Piac nincs megnyitva (market sor nincs).
- **Küldési ablak a sorból**: `countryOutreach.ts outreachHoursOf` = sor `send_window` ∩ `MOCK_OUTREACH_WINDOW`; HU azonos.
- **§C-kapu jogi sora a jogi csomagból** (`outreachCheck.ts`), katalógus 7218 → 7217.
- **Régi e2e-k a mai valósághoz**: `country-outreach-e2e` (47) és `country-mock-e2e` (31) a csomag nélküli nyelvet a románnal méri.
- **HR elfogadás**: `scripts/country-hr-e2e.mts` (46 ✓) + `scripts/lib/hr-open-fixture.mts` (teszt-ársor HUF→EUR 1 € = 390 Ft, CSAK scratch DB).
- **Elek** (3 perszóna, saját szerver `elek/runs/hr-20261119/serve.mts`, scratch DB, nginx-utánzat a konzol-előtagokra):
  leletek `elek/runs/hr-20261119/{bena,it,vevo}/LELETEK.md`.
- **Javítva Elek nyomán**: EUR-kosár zárja (3/1 maradvány, `console/server.ts`); leiratkozó/visszajelző lap `lang` + cím
  (`views.ts layout({lang})`); mock minta-ár a lap pénznemében + dátum a lap nyelvén (`cit-runtime.js`, `data-cit-currency`);
  adatkezelés telefon-helyőrző → cég telefonja (`legalViews.ts`); **számla- és 6 megújítási levél 100× összege EUR-ban**
  (`invoiceEmail.ts`, `billingEmail.ts` formatMoney → formatMinor).

- **Felület-kapu**: a 4 javítás tulaj-kivétellel (2026-11-19 „mehet”).

## Módosított / új fájlok
`migrations/0142_country_hr.sql`, `src/crm/countryClock.ts`, `src/outreach/countryOutreach.ts`, `src/outreach/outreachCheck.ts`,
`src/i18n/catalog.json`, `src/i18n/catalog-context.json`, `src/console/server.ts`, `src/console/views.ts`,
`assets/runtime/cit-runtime.js`, `src/engine/moduleSections.ts`, `src/engine/recipe.ts`, `src/generator/generateEngine.ts`,
`src/server/legalViews.ts`, `src/email/invoiceEmail.ts`, `src/email/billingEmail.ts`, `scripts/country-hr-e2e.mts`,
`scripts/lib/hr-open-fixture.mts`, `scripts/country-outreach-e2e.mts`, `scripts/country-mock-e2e.mts`,
`scripts/country-layer-check.mts`, `scripts/money-format-check.mts`, `_planning/decisions/XXXX-orszag-reteg-3-9-…md`.

## Nyitott (koordinátor / Bábel / következő kör)
- Bábel: eszkalációs levél jogi sora it/hr; vevő-oldali magyar maradványok, amelyek NINCSENEK `T()`-ben vagy Bábel-mag nélküliek:
  rendelés-panel csomagnevei (Teljes/Ajánlott/Alap), számlázási országlista, VIES-hibaüzenet, vendégoldal szobakártya („fő”, „/ éj”),
  admin foglalási naptár („A szállás egésze”, hónapnév), vendég lemondó oldal `lang=hu`, `/login?l=hr`, citoviso.com főoldal.
- Horvát nyelvtan: többes szám („1 noći”, „2 osoba”), „Kuća” menüpont → „Početna”, „oko Makarska”.
- Szállás.hu a levél és a foglalás-modul naptár-szinkron listáján — országonkénti portál-lista kell.
- OIB ellenőrzőszám nincs validálva (az admin a hibásat is elmenti); OIB-mező a cég-rendelésnél.
- Jogi szövegek a magyar Grt.-re/NAIH-ra hivatkoznak (ügyvédi álláspont 11-18 szerint használható).
- `country-crm-e2e` 2 piros a tiszta mainen is (a válasz tárolt nyelve hu) — nem e kör hibája.

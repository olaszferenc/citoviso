# 2026-11-16 — Ország-réteg 3/2: felületek (ADR-0450)

Session `citb24e7da9`, brief `~/rc-briefs/orszag-reteg-3b-feluletek-20261116.md`, koordinátor `cit9b4690e3`.

## Elvégezve (A rész)
- Új oldal pénzneme az ország-sorból (`src/conversion/provision.ts`).
- Foglalás-beállítás: bármely ISO 4217 pénznem, alapból az országé (`src/tenant/bookingSetup.ts`, `src/text/currencyName.ts`, `assets/runtime/cit-booking-setup.js`, `src/server/bookingSetupViews.ts`); IFA tizedessel, az oldal pénznemében.
- Varázsló ár-lépés pénznem-tudatos (`src/server/setupSteps.ts parsePrice`, `src/server/setupWizard.ts`, `src/tenant/moduleSetup.ts`).
- Tenant-admin összegek a tenant pénznemében, minor unit, a nyelv dönti a jelet (`src/server/adminViews.ts`, `src/server/moduleConfigViews.ts`, `src/tenant/{subscriptionAdmin,multilangCard,wallet}.ts`); számla-összegző pénznemenként.
- IFA-modell kapcsoló: `migrations/0137_country_tourist_tax_model.sql`, `src/country.ts`, widget `data-cit-tax-rule`, vendéglevél (`src/booking/requests.ts`).
- Telefon az ország tervében (`src/tenant/contact.ts`, `src/server/contactViews.ts`, `src/text/phoneCountry.ts`).
- Dátum: `dateLocale` (`src/i18n/lang.ts`), widget „ma” a `data-cit-tz` zónában (`assets/runtime/cit-runtime.js`, `src/engine/{recipe,moduleSections}.ts`, `src/tenant/editor.ts`).
- Partner-levelek és konzol: aktiváló levél, partnerprofil, rendelés-lista, fizetés-eredmény és mock-fizetés oldal a saját pénznemben (`src/email/activationEmail.ts`, `src/payment/activationMail.ts`, `src/console/{partnerProfile,partnerProfileViews,partnerData,views,data,server}.ts`).
- Igénylőlap: a pin országában keres (`src/intake/mockRequest.ts`).
- A parkolt konfigurátor minor-unit patch bent (`assets/runtime/cit-configurator.js`); `money-format-check` ④ igazítva.
- Őr: `scripts/country-layer-check.mts` ⑥ + pre-commit trigger; e2e `scripts/country-surfaces-e2e.mts` (39 PASS).

## B rész (terv-kapu)
Mockok: `assets/design-refs/_drafts/orszag-feluletek/` (nyelv-a/b/c, penznem-a/b/c + `kepek/`), a koordinátornak elküldve. Ajánlás: főoldal B (URL), admin C (fix pénznem + link). Kód a jóváhagyásig nincs.

## Nyitott
- Tizedes szobaár (tulaj-döntés: sémaváltás).
- Forintos példamondatok a foglalás-beállításban, a mock minta-ára, a partner-lap havi diagramja (csak HUF).
- Az új szövegek fordítása: Bábel.

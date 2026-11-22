# 2026-11-22 — Nemzetközi C: konverzió, fizetés, számla, domain, szállás-admin, üzem országfüggően

SUB `cit5664e772`, koordinátor `cit9b4690e3`, brief `~/rc-briefs/nemzetkozi-C-konverzio-uzem-20261122.md`, ADR-XXXX.

## Elvégzett munka
- `0150`: IT/ES/PT/FR/BG ország-sor (valós master-adat, csak e-mail, IFA `none`, ünnepnapok 2026+2027) + ár-réteg (HR-másolat, .com), piac zárva.
- Céges vevő nemzeti azonosítóval (taxId.ts validátorok, `LEGAL_LOCAL.taxIdCheck`, konfigurátor mező), AAM + OSS.
- Nincs csendes HU: buyer.ts, prefill.ts, partner.ts, kliens; legalIdentity: sor nélküli ország → nincs HU csomag.
- Barion-leírás a vevő nyelvén; euró-tárca (providers.ts `walletGap`, readiness „wallet”, pay-link zár).
- Nem-HU számla szövegei a számla nyelvén, hiánynál vár; megrekedt-rendelés riasztás pénznem-szabállyal.
- SMS/MMS ország-őr (`src/sms/countryChannel.ts`), próba/eszkaláció/felszólító „kimarad” okkal.
- Domain: latin betű-átírás (đ…), ország-típusszavak, minden végződésre névváltozat.
- Szállás-admin: IFA-kérdés modell szerint, nem-forint mintaárak, Segítő-prompt országfüggő, naptár-szinkron portálok az országból.
- Idő: ajánlat-határidő a szállás zónájában, előfizetés-kezdet a tenant zónájában.
- Mock: vendég-kritikus a lap nyelvén, angol portál-szobanév → típus a lap nyelvén; próba-telefon a lead országában; kliens trn().
- Teszt: `scripts/nemzetkozi-c-e2e.mts`, `country-layer-check` ⑬.

## Módosított fájlok
migrations/0150_country_it_es_pt_fr_bg.sql · src/billing/{buyer,partner,prefill,taxId}.ts · src/legal.ts · src/payment/{service,providers,billing,subscription}.ts · src/countryReadiness.ts · src/console/{countryViews,payLinkAlert,server}.ts · src/sms/{sender,countryChannel}.ts · src/mms/sender.ts · src/trial/{expiry,escalation,start}.ts · src/domains.ts · src/domains/domainAdmin.ts · src/tenant/{legalIdentity,siteCountry}.ts · src/booking/requests.ts · src/server/{offerViews,bookingSetupViews,moduleConfigViews,portalGuide,public}.ts · src/ai/bookingHelper.ts · src/generator/{configurator,generateEngine,guestCritic,recopy}.ts · src/engine/{render,roomNames,templateKit}.ts · assets/runtime/{cit-configurator,cit-runtime,cit-booking-setup}.js · scripts/{nemzetkozi-c-e2e,country-layer-check,country-hr-e2e}.mts · scripts/lib/babel-pending-nemzetkozi-c.mts

## Nyitott
- Bábel: 51 új felirat (a lista a `babel-pending-nemzetkozi-c.mts`-ben).
- Euró Barion-tárca nyitása (tulaj) → `BARION_WALLET_CURRENCIES=HUF,EUR`.
- Főoldal honosítása (irány-döntés); minta-felszereltség / prózabeli szobanevek nem-HU lapon (A SUB szótára); olasz vezetékes szám (A SUB telefon).

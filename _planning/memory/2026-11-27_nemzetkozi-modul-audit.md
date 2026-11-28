# 2026-11-27 — Nemzetközi modul-audit: minden vevő-oldali modul valódi helyi adattal (HR + IT)

Brief: `~/rc-briefs/nemzetkozi-modul-audit-20261127.md` · SUB `citaa4fc27c` · koordinátor `cit9b4690e3`.
Kiváltó ok (tulaj, a HR [TESZT] próba közben): „akkor hogy sikerült eddig letesztelni a nemzetközi indulást?” A korábbi
országtesztek a feliratok nyelvét és a pénznemet nézték, azt nem, hogy a modul a nem magyar lapon valódi adatot ad-e.

## Hiánylista (élesen csak olvasva mérve: [TESZT] Apartments Ruza, `teszt-apartments-ruza.citoviso.com`, 3770177e)

| # | modul / folyamat | mi rossz nem magyar vevőnél | bizonyíték | súly | állapot |
|---|---|---|---|---|---|
| 1 | Szobák (+Árak, Foglalás, Vélemény-űrlap) | a tárolt alap-egység neve magyarul: „A szállás egésze” a horvát szobakártyán | élő Ruža-lap; `src/tenant/editor.ts` (units) | vevő látja | ✅ javítva |
| 2 | Árak / évszakok | a szezon dátuma magyar év-elöl alakban („07. 01. – 08. 31.”), az összeg magyar számformában („1 200 €”, „od 1 200 €”) | `src/engine/moduleSections.ts` niceDay + money() nyelv nélkül; `src/tenant/prices.ts` formatSpan | vevő látja | ✅ javítva |
| 3 | Mit kínál | a lefordított katalógus-tételt az ikon-egyeztető nem ismeri: ikon nélküli tétel, rövid standard kitöltés | `src/engine/amenityIcon.ts` catalogueIdFor (HU címke + HU/EN/DE kulcsszó) | vevő látja | ✅ javítva |
| 4 | Telefon (lap, foglalási levelek, felfüggesztett oldal) | a csak-magyar displayPhone/onePhone a mentett „+385 91 …” számot „+385912345678”-ra préseli, a nemzeti alakot nem érti | `src/booking/requests.ts` hostContact/guestRows, `src/server/suspendedPage.ts`, `src/engine/render.ts`/`siteData.ts` | vevő látja | ✅ javítva |
| 5 | Online foglalás (widget, levelek, vevő-admin) | összegek nyelv nélkül = magyar számforma | `src/server/public.ts` stay-quote, `src/server/bookingViews.ts` (10 hely), `src/server/adminViews.ts`, `src/booking/requests.ts` | vevő látja | ✅ javítva |
| 6 | Vendég vélemény-köszönő / döntés, tulaj ajánlat- és link-oldal | `<html lang="hu">` égetve → a böngésző „fordítás magyarból” sávot ad | `src/server/moduleConfigViews.ts`, `src/server/offerViews.ts` | vevő látja | ✅ javítva |
| 7 | Tulaj ajánlat-oldal (kliens JS) | a beírt összeg ezres-csoportja magyar | `offerViews.ts` OFFER_JS grp() | kozmetika | ✅ javítva |
| 8 | PWA (citoviso.com app) | manifest-leírás + offline oldal csak magyar | `src/ui/pwa.ts` | vevő látja | ✅ javítva (a látogató nyelve; 4 felirat Bábelnél, 23 nyelvre kész, a land után importálja) |
| 9 | Vendégértékelések (Google-csillag a mockon) | a felderítő 2026-11-09 óta MINDEN országban értékelés-szám nélkül hozza a Maps-csillagot → a `rating()` eldobja → `mapsRating` nincs | élesen: HU magellan-lead heti 75% → 0% (11-09-től: 8191/1, 5653/6), HR 3995/1; `~/rc-briefs/uj-lanc/felderito/out/*/maps_details.jsonl`: „rat” van („3,9”), „(db)” nincs (HU 6/6066, HR 2/5000) | vevő látja (mock) | ⚠️ NEM itt javítva — a koordinátor a lánc-SUB-nak (9d51) adta át (`maps_crawl.mjs` 179–192, `maps_felderito.py` rating()); az élő tenant csillaga a Places-egyezésből jön, országfüggetlen |
| 10 | Heti programok | csak magyarul keres | `src/events/*` | vevő látja | ✅ a heti-programok SUB javította (1fadc2ab); az őr az `src/events/*`-t kivétel nélkül nézi |
| 12 | Eszkalációs ajánlat „különböző napjai” | a cég órájában számol | `src/payment/offers.ts:536` | látens (CET-ben azonos; PT/WET előtt javítandó) | ALLOW-on, indokkal |
| — | Jogi oldalak, számla, zóna-választó, próba-/utánkövető levelek, domain-elszámolás | országfüggő ágon futnak | subagent-audit | — | rendben (szándékos HU alapág) |

## Őrök (a következő országnál maguktól jeleznek)
- `scripts/customer-locale-check.mts` — KÖNYVTÁR-hatókör (src/engine, tenant, booking, ui, server, email, reviews, events,
  payment, invoicing, domains, trial, outreach, conversion, text + src/legal*.ts), 12 szabály a mért hibaosztályokra,
  30 indokolt ALLOW, a lejárt kivétel bukik, `--self-test` 11/11. Bekötve: `hooks/pre-commit`.
- `scripts/country-module-data-e2e.mts` — scratch DB, a VALÓDI HR (0142) és IT (0150) sor, `convertLead`, minden modul
  a tulaj helyi adatával → a renderelő saját modul-blokkjai: ① minden modul a lapon ② nincs magyar szivárgás (a csomag
  által fordított magyar szöveg) ③ a lap dátum- és számformája ④ felszereltség ikonnal ⑤ telefon ⑥ HU iker bájtra.
  Negatív kontroll: a javítások nélkül 7 piros. Új ország = egy sor a `COUNTRIES` tömbben.

## Közös kapu javítva ugyanebben a landban
- `scripts/login-hardening-check.mts`: a foglalási fék mérése a kapu SAJÁT élő fixture-oldalán (fixture-parent, run-bélyeges slug, kilépéskor kaszkádban törlődik), nem a közös park „első élő oldalán”. 2026-11-27 a park 16 oldala `deactivated` lett (dev-előfizetések lezárva, `cit4ee71a6a`), és a kapu a tiszta mainen is piros volt → minden land állt. `// gate-lane: own-fixture-only`.
- `scripts/unit-delete-confirm-check.mts`: ugyanez az osztály — „egy élő park-oldal” artifactját kölcsönözte („nincs használható artifact”, a tiszta mainen is piros); most saját engine-artifactot rögzít (a contact-edit őr minimális receptje).

## Módosított fájlok
src/tenant/editor.ts · src/engine/moduleSections.ts · src/engine/render.ts · src/engine/siteData.ts · src/tenant/prices.ts ·
src/tenant/contact.ts · src/text/phoneCountry.ts · src/booking/requests.ts · src/server/public.ts · src/server/bookingViews.ts ·
src/server/adminViews.ts · src/server/suspendedPage.ts · src/server/offerViews.ts · src/server/moduleConfigViews.ts · src/ui/pwa.ts ·
src/i18n/catalog.json · src/i18n/catalog-context.json · scripts/customer-locale-check.mts · scripts/country-module-data-e2e.mts ·
hooks/pre-commit · scripts/login-hardening-check.mts · scripts/unit-delete-confirm-check.mts · MEMORY.md · ez a jegyzet.

## Nyitott
- A felderítő értékelés-szám regressziója (9. sor) — a scrape-vonal gazdájának.
- Élesítés: a koordinátoré, egy csomagban.

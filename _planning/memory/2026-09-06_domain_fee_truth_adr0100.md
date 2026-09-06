# 2026-09-06 — Saját domain: valós feltételek a konfigurátoron + ADR-0100 (a 2+. évi díj számlázása)

## Kiváltó

A tulaj screenshottal jelezte: a mock-konfigurátor „Saját domainnév" opciója statikus
„+6 000 Ft/év · minimum 1 éves előfizetéssel" szöveget mutatott — az ADR-0093/0094-ben
eldöntött valós feltételek (küszöbtől ingyen, hűségidő = kötbér-modell, csomag-padló)
nem jelentek meg, és a díj sem a kijelzett összesenbe, sem a terhelt árba nem folyt bele.

## Elvégzett munka

### 1) Konfigurátor: valós feltételek + az 1. évi díj terhelése (`ae6d75c`)

- A díj **élőben** oldódik fel a modul-kapcsolók szerint (8 000 Ft/hó küszöbtől 0 Ft);
  a manifest új mezője: `domain.freeMinMonthly`.
- Kiválasztáskor **valós kötbér-feltétel blokk** (12 hó hűségidő, hátralévő hónapok díja,
  domain-vételár elvitelkor, ingyen-ágon a csomag-padló kimondva).
- Az összesítő és a submit-ár a feloldott díjat viszi; a szerver az induló rendelés
  árához **hozzáadja** (ajánlat-kedvezmény CSAK a csomagra — a domain átfolyó
  registrar-költség).
- Verifikálva Playwright-kattintássorral (mobil+desktop, ingyen/díjas ág, 0 JS-hiba);
  képek a tulajnak elküldve.

### 2) ADR-0100: a 2+. évi domain-díj — eddig SENKI nem számlázta (`310bc84`)

Munka közben talált rés (tulaj: „de jó hogy észre vetted! javítsuk!"): a megújulás-motor
csak modulokból számolt, a domain-évet egyik év sem terhelte, miközben az INWX minket
évente terhel. Megoldás (ADR-0100):

- A díj annak az EGY fordulónapos megújuló rendelésnek a **tétele**, amelynek időszakába
  a domain évfordulója esik (`domainFeeForPeriod` a `billing.ts`-ben; ADR-0080 ①: egy
  terhelés, egy számla; nincs külön dunning-szál — a zálog a meglévő lépcső mögött).
- A díj **minden évben újra feloldódik** az akkori csomag ellen (küszöb felett 0 Ft,
  tétel sincs; hűségidő utáni lecsúszás fizetőssé válik). Kupon a díjat sosem éri.
- `order_intent.domain_fee` (0053-migráció, dev DB-n lefuttatva) + a számlán **külön
  tétel**; mellékjavítás: a `domain_upgrade` számla saját domain-tételt kap az
  „előfizetés (éves, 0 modul)" helyett.
- **Kapu:** `scripts/domain-renewal-check.mts` (scratch DB: esedékes / elengedett /
  havi-ablak / bukott-domain / idempotencia; `--self-test` pirosra megy) — bekötve a
  pre-commitba (billing/service/pricing/console-útvonal változásra fut).

## Módosított fájlok

- `assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`
- `src/generator/configurator.ts`, `src/console/server.ts`, `src/console/data.ts`
- `src/payment/billing.ts`, `src/payment/service.ts`, `src/db/schema.ts`
- `migrations/0053_domain_fee_on_order.sql`, `scripts/domain-renewal-check.mts` (új)
- `hooks/pre-commit`, `_planning/DECISIONS.md` (ADR-0100), `src/i18n/catalog.json`

## Státusz / nyitott

- MINDEN LANDOLVA a main-re (`310bc84`, IGAZOLTAN FENT).
- Élesítés NEM történt — a booking-köteggel + a PILOT-ÉLES LELTÁR blokkolóival együtt
  esedékes a következő deploy-körben.
- Kis nyitott: az új konfigurátor-feliratok fordítása (de/en) a nyelvi csomag következő
  frissítéséig hu-fallbacken megy.

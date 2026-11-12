# 2026-11-12 — Ország-réteg 3/1: a pénz útja (ADR-XXXX)

Session `cit8e9c29ff`, brief `~/rc-briefs/orszag-reteg-3a-penzut-20261112.md`, koordinátor `cit9b4690e3`.

## Elvégezve
- Minor unit + pénznemenkénti tizedes-szabály (`src/text/money.ts`, tükör `assets/runtime/cit-money.js`).
- Szigorú, régió-kötelező árazás, régiónkénti modulár, új régió a /pricing-on (`src/pricing.ts`, `src/console/pricingPage.ts`, `assets/runtime/cit-pricing-admin.js`).
- Régió + pénznem a rendelésen / előfizetésen (`migrations/0135_country_money_path.sql`, `src/payment/orderRegion.ts`), minden ár-getter innen.
- Barion: pénznem a rendelésből, locale a vevőből, szolgáltató-képesség + piac-kapu (`src/payment/providers.ts`, `src/payment/barion.ts`).
- Számla: EUFAD37, számlanyelv, MNB-árfolyam, vevő-tények; AAM/OSS-számláló, OSS-riasztás; A60 CSV (`src/billing/{fxRate,taxCounters,a60}.ts`, `src/console/ossAlert.ts`).
- Domain: régiónkénti költségplafon, helyi TLD a saját régió listájából.
- Őr: `scripts/country-layer-check.mts` ⑤; e2e: `scripts/money-path-e2e.mts` (CZ/CZK zöld, RO/RON zártan bukik).

## Nyitott / döntési pontok
- RON/PLN Barionnál: sandbox-próba + tárcaszámla kell, addig RO/PL zárt (vagy másik szolgáltató — tulaj-döntés).
- OSS-küszöbnél a megújítás is visszatartva (a küszöb feletti AAM-számla jogsértő lenne) — tulaj-döntés: OSS-regisztráció.
- Éles `.env`: `LEGAL_ENTITY_EU_VAT_NUMBER` beállítandó a deploy előtt.
- Felület-, riport-, megkeresés-kör: tenant-admin, bevétel-riport, levél ár-mondata még HU-pénznemű.

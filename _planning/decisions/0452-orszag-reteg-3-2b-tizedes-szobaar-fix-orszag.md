## ADR-0452 — Ország-réteg 3/2b: tizedes szobaár, fix ország-pénznem, a nyilvános oldal országa a lead helye

**Státusz:** ELFOGADVA (tulaj-döntés 2026-11-16, a koordinátoron át, `cit9b4690e3`: a B) mockok nyelv-A/B/C és pénznem-A/B/C változata ELVETVE, kötelező irány négy pontban) ·
**Épít:** ADR-0450 (ország-réteg 3/2 felületek), ADR-0437 (lead koordinátája → ország), ADR-0443 (minor unit, `src/text/money.ts`) ·
**Felülírja:** az ADR-0450 ③ pontját (bármely ISO-pénznem választható) és ④ pontját (tört szobaár elutasítva).

### Döntés (tulaj)

① **A nyilvános oldal országa = a lead fizikai helyének országa** (ADR-0437), nyelv és pénznem az ország-sorból. Nincs IP- vagy böngésző-tipp, nincs `/cs/`-féle URL-séma, nincs külön nyelv- vagy országválasztó. A főoldalnak ma nincs lead-kontextusa, ezért a `renderHomepage` a `CF-IPCountry` / `Accept-Language` tippet már nem használja: a magyar oldal és a magyar ársor marad (a `?region=` operátori előnézet). A lead-kontextusú nyilvános felület, a konfigurátor, a 3/1 óta a lead régiójából áraz. Egy lead-kontextusú főoldal-belépés külön döntés (a tulajt erről nem kérdezzük).

② **A domain-végződés az ország-sorból** (ár-régió → TLD-kínálat, `primaryTld`): a főoldal „Saját .hu domain” mondatai a régió saját végződését mondják. HU-ban bájtra a régi.

③ **Nincs pénznem-választó:** a szállás pénzneme az ország-sorból jön, fixen, a felület csak kiírja (`offeredCurrencies`). Nem magyar szállásnál a lista egyelemű, a foglalás-beállítás szövegként mutatja. A már mentett más pénznem nem vész el. A magyar szállás forint/euró párja a „HU felület bitre azonos” korlát miatt marad. A szerver csak a felkínált pénznemet fogadja el.

④ **Tizedes szobaár, a pénznem minor unitja szerint** (`migrations/0138_room_price_exact.sql`, additív): `unit_price.amount_exact`, `booking_request.quoted_total_exact` és `quoted_tax_exact` (`numeric`). Csak akkor íródnak, ha az összegnek tört része van; az egész oszlop továbbra is íródik (kerekítve), a régi olvasóknak. Olvasás: `exact ?? egész` (`readExact`), a foglalás-sorokon a közös `QUOTED_TOTAL` / `QUOTED_TAX` SQL-kifejezéssel. Parse: `parseOfferAmount(raw, currency)` (`src/booking/amount.ts`). Forintnál és pénznem nélkül bájtra a régi szabály; tizedes pénznemnél a záró `,dd` / `.dd` a tört rész. Kijelzés: `formatAmount` (szerver), `money()` a widgetben, `grouped()` és `group()` az adminban. Tört összegnél a pénznem tizedeseivel, egész összegnél (minden forint) a régi `formatMoney`. Végig fedve: admin ár-űrlapok (alapár, szezon, szezon-szerkesztés, évi ár, új szoba, egész ház), foglalás-beállítás, varázsló, ajánlat-ár, foglalási kérés, tulaj-lista, levelek, foglaltság-naptár, konzol lead-ügyfél és értesítő, szezon-emlékeztető és ár-lejárat.

### Mérés
- `scripts/country-surfaces-e2e.mts` ⑧ ⑨: SK/EUR 45,50 € → tárolva (`amount` 46 + `amount_exact` 45,5), visszaolvasva, foglalási kérés 3 éjre 136,50 € (egész iker 137), tulaj-lista 136,5. CZ 1 890,50 Kč. HU 18 900 Ft → nincs exact iker. CZ-nek csak CZK jár, PLN elutasítva.
- `country-layer-check` ⑥ (a pénznem-lista HU-literálja `LEGACY_CURRENCY`-n át).

### Maradt
Ellátás-felár tizedes (`meals.ts parseOfferAmount(raw)` pénznem nélkül) · a foglalás-beállítás forintos példamondatai · a partner-lap havi diagramja · egy lead-kontextusú főoldal-belépés (külön döntés) · a főoldal lefordítása (Bábel), amint lesz lead-kontextusú belépés.

### Visszafordíthatóság
🔄 additív migráció (0138: három nullázható oszlop); a magyar sorok és összegek bitre azonosak (e2e ⑦ ⑧).

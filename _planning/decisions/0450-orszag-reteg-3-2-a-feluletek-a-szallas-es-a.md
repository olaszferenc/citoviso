## ADR-0450 — Ország-réteg 3/2: a felületek a szállás és a partner országában beszélnek (pénznem, dátum, telefon, IFA-szabály)

**Státusz:** ELFOGADVA (tulaj 2026-11-16 „mehet a következő lépés”; brief `~/rc-briefs/orszag-reteg-3b-feluletek-20261116.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 (ország-réteg, „Tartalom” csoport), ADR-0443 (pénzút, minor unit, `regionOfTenant`), ADR-0290 (szállás-időzóna), ADR-0040 (koordináta → ország) ·
**Forrás-diagnózis:** `_planning/RESEARCH-2026-11-12-orszag-reteg-potlo-diagnosztika.md` 2. szakasz.

### Döntés

① **A szállás országa egy helyen oldódik fel** (`src/tenant/siteCountry.ts`: `countryOfSite` / `countryOfTenant`, a lead országa a `countryOfLead` ADR-0040 sorrendjével). A felületek innen olvassák a pénznemet, a telefon-tervet és az IFA-szabályt. Ha nincs ország-sor, a katalógus-alapérték marad — ugyanaz, amit minden magyar oldal eddig kapott.

② **Új oldal az ország pénznemében indul** (`conversion/provision.ts`): ha az ország pénzneme eltér a katalógus-alapértéktől, a `pricing` modul-config egy sort kap a pénznemmel. A magyar oldal továbbra sem kap tárolt sort (bájtra a régi viselkedés).

③ **Bármely ISO 4217 pénznem** választható a foglalás-beállításban (`src/text/currencyName.ts`): a lista az ország pénznemével kezdődik, utána a mentett, aztán az euró. A felirat neve `Intl.DisplayNames`-ből, a jele a közös pénz-szabályból. A magyar oldal listája bájtra a régi: „forint (Ft)”, „euró (€)”. A teljes (kereshető) választó a terv-kapu alatt van (B rész, mock a tulajnál).

④ **A varázsló ár-lépése az oldal pénznemében** (`parsePrice(raw, lang, currency)`): a forint-szabály (Ft/huf levágás, 1000-es padló, 2 000 000 felső határ) CSAK forintra él. Más pénznemnél a kód és a jel levágva, nincs padló, a tizedes jel felismerve. A szobaár viszont egész egységben tárolódik (`unit_price.amount integer`), ezért a valódi tört értéket érthető mondattal elutasítjuk, nem kerekítjük. Tizedes szobaár = külön döntés (nem additív sémaváltás).

⑤ **A tenant-admin minden összege a tenant saját pénznemében** (`adminViews.ts`, `moduleConfigViews.ts`, `moduleSetup.ts`, `setupWizard.ts`, `wallet.ts`): a pénz minor unit, `formatMinor(n, currency, lang)`. A pénznem az adatobjektumból jön (`TenantModuleView.currency`, `SubscriptionAdminData.currency/region`, `MultilangAdminData.currency`, `DomainSettlementView.currency`), a nyelv a jelet dönti el (magyar olvasónál „Ft”, cseh olvasónál „Kč”). A régi `TENANT_VIEW_REGION = HU` megszűnt. A számla-összegző pénznemenként összegez, vegyes pénznemet nem ad össze.

⑥ **Tartalmi kapcsoló: idegenforgalmi-adó modell** (`migrations/0137_country_tourist_tax_model.sql`, `country.tourist_tax_model`: `hu` | `none`, alapból `none`, a HU-sor `hu`). A magyar szabály (a „helyszínen fizetendő” mondat be nem jelentett adónál, és a 18 év alatti mentesség) CSAK `hu` modellnél jelenik meg. A widgetben (`data-cit-tax-rule="none"`) és a vendéglevél adó-sorában is így. A tulaj által megadott összeg mindig tételesen látszik. Az IFA a pénznem tizedeseivel menthető (1,50 €).

⑦ **Telefon az ország tervében** a kapcsolat-űrlapon: a szerver `normalizePhoneIn` + `prettyPhoneIn`, a böngésző `phoneRulesJs`. A HU-terv bájtra a régi. Trönk-előtag nélküli országban (CZ, PL) a csupasz nemzeti szám a nemzeti szám („777 123 456” → „+420 777 123 456”).

⑧ **Dátum a nyelv szerint, „ma” a szállás zónájában:** `dateLocale(lang)` (`i18n/lang.ts`, a magyar olvasónál „hu-HU”, ahogy eddig); a widget `todayISO` a `data-cit-tz` zónájában számol.

⑨ **A régi, pénznem nélküli sor olvasási szabálya egy helyen:** `LEGACY_CURRENCY` (`src/text/legacyCurrency.ts`). Minden ilyen sor magyar volt, mert a piac-kapu addig zárt volt. A `?? "HUF"` literál a felület-fájlokból eltűnt.

⑩ **Az igénylőlap a pin országában keres** (`intake/mockRequest.ts`): ha van koordináta, reverse-geocode → ország → az ország Places-nyelve. Pin nélkül a beérkező terület országa a fallback.

### Mérés
- `scripts/country-layer-check.mts` ⑥ (pre-commit, a trigger a felület-fájlokra bővítve): nincs beégetett `"HUF"` / `"hu-HU"` / `" Ft"` és régió nélküli ár-getter a felület-fájlokban; a maradék ALLOW-listán, okkal (forint-ág bájtra, operátori adó-pénznem, régi sor).
- `scripts/country-surfaces-e2e.mts`: CZ/CZK szintetikus sor scratch DB-ben (provisioning → varázsló → foglalás-beállítás → modul-fül → kapcsolat → widget), és a HU út változatlan. 39 PASS.
- `money-format-check` ④: a konfigurátor a közös `formatMinor`-t is hívhatja (a parkolt kliens-patch bekerült).

### Maradt (következő körök)
Tizedes szobaár (tulaj-döntés, sémaváltás) · a teljes pénznem-választó és a nyelvenkénti főoldal (B rész, terv-kapu) · a foglalás-beállítás forintos példamondatai és a mock minta-ára · a partner-lap havi diagramja csak forintos (riport-kör) · az új szövegek fordítása (Bábel) · ország-specifikus IFA-modellek (pl. cseh „poplatek z pobytu”) a `tourist_tax_model` bővítésével.

### Visszafordíthatóság
🔄 additív migráció (0137, egy oszlop alapértékkel); a magyar felület és viselkedés változatlan (e2e ⑦).

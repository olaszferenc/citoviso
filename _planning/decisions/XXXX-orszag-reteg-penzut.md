## ADR-XXXX — Ország-réteg 3/1: a pénz útja — minden ország a saját pénznemében áraz, fizettet és számláz

**Státusz:** ELFOGADVA (tulaj 2026-11-12: „jó a sorrend … 1-es indulunk”; brief `~/rc-briefs/orszag-reteg-3a-penzut-20261112.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 ⑤3 (kereskedelem-csoport), ADR-0020 (ár-régió), ADR-0360 (végződések), ADR-0111 (piac-kapu), ADR-0098 (AAM) ·
**Forrás-diagnózis:** `_planning/RESEARCH-2026-11-12-orszag-reteg-potlo-diagnosztika.md` 1. szakasz.

### Döntés

① **Összeg = a pénznem minor unitja**, a tizedes-szabály a pénznem tulajdonsága (`src/text/money.ts minorDigits`: ISO 4217, egyetlen szándékos kivétel HUF = 0, mert sem a Barion, sem a Számlázz.hu nem fogad fillért). A HU-összegek így bájtra a régiek. Kijelzés: `formatMinor` (+ böngésző-tükör `cit-money.js`, paritás-őr `money-format-check`).

② **Minden ár-getter KÖTELEZŐEN kapja a régiót** (`src/pricing.ts`); nincs alapértelmezett régió és nincs csendes `global`-ra esés: hiányzó ársor / nem ISO pénznem / hiányzó modulár → `PricingRegionError`, a hívó zártan bukik. A `global` csak az anonim főoldal-látogató kijelzése.

③ **Modulár régiónként** (`module_price_region`, 0135); a `hu` régióé a meglévő `module_price` (nincs második igazság). Új régió a /pricing-on hozható létre (`+ Új ár-régió`: azonosító + ISO-pénznem), hiányosan születik, a fülön tölthető ki (a page major egységet mutat és fogad, a tár minor).

④ **A régiót egyszer oldjuk fel** (`src/payment/orderRegion.ts`): a lead országa → `country.pricing_region`; a vevő számlázási országa csak akkor áll be, ha a leadnek nincs. A rendelés (`order_intent.pricing_region/currency`) és aktiváláskor az előfizetés (`subscription.…`) tárolja; megújítás, upsell, többnyelvűség, modulváltás, domain, lemondás-elszámolás, kártyacsere innen olvas. Az új oszlopok a beszúráskor kötelezők a sématípusban (egy elfelejtett beszúrás fordítási hiba).

⑤ **Fizetési szolgáltató országonként** (`country.payment_provider`, ma `barion`) + képesség-tábla (`src/payment/providers.ts`): Barion — dokumentáltan HUF, EUR, USD, CZK (docs.barion.com/Supported_currencies); a RON és PLN csak az SDK-ban szerepel, ezért amíg sandbox nem igazolja, **nem fogadott → a piac nem nyitható** (a konzol Piacok-panel jelzi, a pay-link kapu tilt). Locale a vevő nyelvéből (`providerLocale`), összeg az adapterben minor → major.

⑥ **Számla a könyvelői szabály szerint:** fordított adózás kulcsa **`EUFAD37`** (docs.szamlazz.hu vat-rates: „Áfa tv. 37. §-a alapján másik tagállamban teljesített, fordítottan adózó ügylet”; a `TAM` tárgyi adómentes volt, hibás); a megjegyzésben „Fordított adózás / Reverse charge” + mindkét közösségi adószám (a miénk a `LEGAL_ENTITY_EU_VAT_NUMBER` configból; hiányában fordított adózású számla nem megy ki). Számla nyelve `country.invoice_lang` (Számlázz-kódra képezve: cs→cz, sl→si). Devizás számla `arfolyamBank=MNB` + az általunk lekért MNB-árfolyam (`src/billing/fxRate.ts`, `fx_rate` gyorsítótár), az `invoice.fx_rate`-ben tárolva.

⑦ **Adó-számlálók** (`src/billing/taxCounters.ts`): AAM-keret konfigurálható, alap a törvényi menetrend (Áfa tv. 188. § (2): 2026: **20 M Ft**; 2027: 22 M; 2028: 24 M — NAV 2025-12-11), a nem-HUF számlák is beleszámítanak. OSS: az EU-s, nem magyar, nem fordított adózású eladások nettó €-összege (tárgyév + előző év, Áfa tv. 49/A. §), figyelmeztetés 80%-tól, **10 000 €-nál az újabb ilyen eladás zártan visszatartva** (nincs pay-link) és riasztás (`ossAlert.ts`); nem számolható összeg = visszatartás. Nem-EU vevő: blokkolva.

⑧ **A60:** `src/billing/a60.ts` + konzol `GET /documents/a60?period=YYYY-MM|YYYY-Qn` → CSV (országkód, közösségi adószám, nettó Ft, nettó ezer Ft). Beadás: 26A60 ÁNYK-nyomtatvány, 26A60-03 lap, ezer forintban (NAV kitöltési útmutató 2026-04-29); ONYA-import nem igazolt, ezért ÁNYK-fájlt még nem gyártunk.

### Mérés
- `scripts/country-layer-check.mts` ⑤ (pre-commit): minden ország régiójának teljes ársora + egyező pénzneme, a szolgáltató fogadja a pénznemet, nyomtatható számlanyelv; nincs pénznem-keverés; minden order-beszúrás régiót+pénznemet ír; minden konfigurátor-hívás régiót ad; nincs beégetett `"HUF"`/`hu-HU`/`"AAM"` a pénzút fájljaiban (ALLOW indokkal).
- `scripts/money-path-e2e.mts`: CZ/CZK szintetikus sor scratch DB-ben, végig (konfigurátor → rendelés → fizetés + Barion-kérés → számla + Számlázz-XML), RO/RON zártan bukik, HU változatlan.

### Maradt (következő körök)
Tenant-admin felületek a HU-régió pénznemében írnak (felület-kör; nem-HU tenant a piac-kapu miatt még nem jöhet létre) · bevétel-riport egy pénznemben (riport-kör) · a hideg levél ár-mondata „Ft”-ot ír (megkeresés-kör; a „-tól” ár már a lead régiójából) · számla-tételnevek és „Bankkártya” magyarul (jog/nyelv-kör) · `buyer.ts` hiányzó ország → HU alapérték.

### Visszafordíthatóság
🔄 additív migráció (0135); a HU-összegek és a HU számla-XML változatlanok (kivéve a fordított adózás kulcsát).

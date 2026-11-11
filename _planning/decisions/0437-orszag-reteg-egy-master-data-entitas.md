## ADR-0437 — ORSZÁG-RÉTEG: egy master-data entitás országonként, amit a lead koordinátája aktivál; a HU-folyamat ettől paraméterezve fut bármely országra

**Státusz:** JAVASOLT (tulaj-brief 2026-11-11: „tetszőleges számban bővíthető ország layer, ami a HUN folyamatot követi, egyedi paraméterekkel… amelyik országban van a lead GPS-koordinátája, az a folyamat lesz igaz rá”) ·
**Épít:** ADR-0040 (koordináta → ország, garantált), ADR-0111 (piac-kapu: a kulcs az ORSZÁG, `market` tábla), ADR-0020 (ár-régió), DOMAIN 03-INVARIANTS §22 és §27 ·
**Lezárja az ADR-0360 nyitott tételét** („Ország-réteg a piac-fülek mellé”) ·
**Felülírja:** a 2026-10-27-i BG/HR roadmap országonkénti (M1–M25) javítási listáját mint MÓDSZERT — a tételek maradnak, de nem országonként javítjuk, hanem egy réteg bekötésével.

### Kiváltó

A 2026-11-11-i kódfelmérés (`_planning/RESEARCH-2026-11-11-orszag-reteg-diagnosztika.md`) szerint az ország
ÖT egymástól független helyen él (`region.country`, `scraper_definition.country` = beégetett „HU”,
`lead.raw.country`, `order_intent.buyer_country`, `pricing_config.region`), és **~40 kódhelyen beégetett
magyar paraméter** van (kulcsszavak, portál-lista, TLD, `languageCode:"hu"`, `+36`-szűrők, `Europe/Budapest`,
`HUF`, `hu-HU`, `szamlaNyelve="hu"`, magyar jogi szöveg, magyar süti-sáv, cirill-rontó homoglif-javítás).
Egy nem magyar lead ma MAGYARKÉNT megy végig a láncon. Ez nem Bulgária-hiba: a rendszerben nincs olyan
hely, ahová egy ország paramétereit be lehetne írni, ezért minden új ország = kódmódosítás.

**Tulaj-vízió (az alapítástól):** nemzetközi gép; az iparág paraméter, az ORSZÁG is paraméter. A master-data
kérdések (ár, csatorna, régiók, vendégnyelvek…) NEM chat-kérdések a tulajhoz, hanem a réteg mezői, amiket
országonként a konzolon tölt ki — ahogy ma a /pricing-ot.

### Döntés

① **`country` entitás — egy sor országonként, master data.** ISO-2 kulcs. A HU-sor a mai beégetett értékekből
jön (migráció tölti), tehát a bevezetés a magyar folyamaton SEMMIT nem változtat. Új ország = új sor + a mezői
kitöltve; kód nem változik. Mezőcsoportok (a diagnosztika lelőhelyei szerint):

| Csoport | Mezők | Ma honnan (beégetve) |
|---|---|---|
| Azonosság | `iso2`, név, `default_lang`, `time_zone`, `currency`, `pricing_region` | `COUNTRY_LANG`, `zoneTime.ts`, `pricing.ts:529` |
| Felderítés | kulcsszó-lista, helyi portál-domainek, saját-honlap TLD-tippek, kereső `lang`/`region`, hívószám + mobil-előtagok + nemzeti formátum, lakcím-irányítószám minta | `scout/rules.ts:15`, `qualify.ts:6`, `enrichPresence.ts:15`, `resolveOne.ts:104`, `webSearch.ts:77`, `phone.ts:62`, `COUNTRY_DIAL` |
| Megkeresés | engedett csatornák (e-mail / sms / mms / viber / wa), küldési ablak (helyi időben), napi kvóta, hivatkozott jogalap-szöveg kulcsa | `sendWindow.ts`, `autoDispatch.ts:57`, `sendOutreachSms.ts:311`, `messenger.ts:460`, `prospectNotice.ts` |
| Tartalom | vendégnyelv-alapkészlet, írásrendszer (latin/cirill/görög) → font-készlet és homoglif-javítás kapcsoló, ország-specifikus szabályok kapcsolói (pl. idegenforgalmi adó modell) | `skins.ts`, `copyCurator.ts:37`, `recipe.ts:541`, `meals.ts:286` |
| Kereskedelem | `pricing_region` (→ ár, pénznem, TLD-kínálat), számla nyelve, vevő-validáció (irsz-minta, adószám-minta), ÁFA-rezsim jelzők (fordított adózás kulcs, B2C küszöb-számláló) | `configurator.ts:446`, `szamlazz.ts:152`, `buyer.ts:168`, `service.ts:1737` |
| Jog | `legal_pack` kulcs (ÁSZF/adatvédelem/impresszum/süti-sáv országonként) | `legal.ts` (egy magyar csomag), `cit-consent.js:197` |

Ami NEM a réteg része, hanem rá hivatkozik: a **nyelvi csomag** (Bábel, ADR-0412), a **jogi szöveg tartalma**
(jogász/tulaj), a **piac-engedély** (ADR-0111 `market` tábla, a tulaj nyitja indoklással). A réteg mondja meg,
MELYIK csomag/nyelv/piac tartozik az országhoz; hogy az létezik-e és engedett-e, azt a saját őre dönti.

② **Aktiválás: a lead koordinátája.** `countryOf(lead)` = `lead.raw.country` (ADR-0040: forrás-tag → reverse-geocode
→ régió-fallback). Ez az EGYETLEN forrás a lánc minden lépésében (felderítés-utáni feldolgozás, dúsítás, mock,
levél, kapu, lead-lap, rendelés-alapértelmezések, provisioning → `tenant.country`). A `scraper_definition.country`
beégetett „HU”-ja megszűnik; a `region.country` csak a koordináta nélküli lead fallbackje (ADR-0040 ③) és a
felderítés kiindulási paramétere (melyik kulcsszó-készlettel induljon Magellan). A vevő számlázási országa
(`buyer_country`) KÜLÖN marad: az a számlára és az ÁFÁ-ra hat, a folyamat országa a SZÁLLÁSÉ.

③ **Ismeretlen ország = fail-closed, hangosan.** Ha a lead országához nincs `country`-sor: a lead eltárolódik
(gyűjtés szabad, ADR-0111 ⑤), de a mock, a levél és a rendelés nem fut, és a konzol „Országok” lapján megjelenik
a hiányzó ország egy „kitöltendő” sorral (az ADR-0111 ⑥ „amelyekkel már találkoztunk” mintája). Nincs csendes
HU-fallback — ez termelte ma a magyar levelet a bolgár leadnek.

④ **Felület:** konzol Beállítások → **„Országok”** (a „Piacok — jogi csomag” panel mellé, ADR-0360 nyitott
tétele). Sor = ország, a mezőcsoportok fülekre bontva, a HU-sor kitöltve. A `/pricing` régió-fül innen
hivatkozott (`pricing_region`). Új országnál a hiányzó mezők pirosak, a sor csak teljes kitöltéssel lesz aktív.
A felület terv-jóváhagyási kapu alá esik (§2b, mock előbb).

⑤ **Bevezetés sorrendje — a magyar folyamat végig változatlan marad:**
1. Entitás + migráció a HU-sorral + `countryOf()` + `countryConfig(iso)` olvasó; a beégetett helyek EGYENKÉNT
   átállnak a rétegre, HU-értékkel azonos viselkedéssel (regressziós kapu: a mai e2e és pre-commit kapuk zöldek).
2. `persist.ts` HU-beégetés megszűnik; a `langForCountry`/`market`/`pricing_region` a rétegből.
3. Fogyasztók csoportonként: felderítés → nyelv/mock → megkeresés → kereskedelem → jog.
4. Elfogadás: `scripts/foreign-market-e2e*.mts` egy SZINTETIKUS ország-sorral zöld (nem BG-specifikus).
5. Konzol „Országok” lap (mock → jóváhagyás → kód).
Utána egy új ország = a sor kitöltése a konzolon + Bábel-csomag + jogi csomag + piac-nyitás (ADR-0111).

### Mérés
- `scripts/country-layer-check.mts` (pre-commit): nincs beégetett `"HU"`/`"hu"`/`+36`/`HUF`/`Europe/Budapest`
  a réteg hatókörébe tartozó fájlokban (ALLOW-lista indoklással); a HU-sor minden mezője kitöltött;
  ismeretlen országra a mock/levél/rendelés tilt és a konzol listáz.
- A két `foreign-market-e2e` szkript szintetikus országgal.

### Visszafordíthatóság
🔄 — additív entitás; a HU-sor a mai értékeket hordozza, a kód ugyanazt olvassa ki, amit ma beégetve tud.
Törléskor a beégetések visszaállnak (a történetben megvannak).

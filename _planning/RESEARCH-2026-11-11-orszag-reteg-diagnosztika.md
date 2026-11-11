# Ország-réteg — rendszer- és folyamat-diagnosztika: hol van relevanciája az országváltásnak

Készült: 2026-11-11, `cit9b4690e3`, három párhuzamos kódolvasó felmérésből. Kód nem változott.
Döntés: ADR-0437 (ország-réteg). Előzmény: `ROADMAP-2026-10-terjeszkedes-bulgaria-horvatorszag.md` (M1–M25).

## Szerkezeti lelet

Az ország öt független helyen él, nincs egy lánc, ami végigvinné:

| Hol | Mi tölti | Állapot |
|---|---|---|
| `region.country` (0018) | konzol régió-form | ⛔ nincs országmező → mindig `HU` (`src/console/data.ts:2504-2536`) |
| `scraper_definition.country` | lead-mentő | ⛔ beégetett `"HU"` (`src/scraper/persist.ts:25`) — EZT olvassa a levél nyelve (`mail.ts:190-210`) és a piac-kapu (`draft.ts:803`) |
| `lead.raw.country` | OSM / Places / Nominatim / régió (ADR-0040) | ✅ paraméteres; a lead-lista szűri (ADR-0038/0040) |
| `order_intent.buyer_country` | a vevő a rendelésnél | ✅ VIES, piac-kapu fizetésnél, számla `<orszag>` |
| `pricing_config.region` (0020) | operátor /pricing | ✅ létezik (`hu` HUF, `global` EUR), de a rendelés NEM ebből olvas |

## 1. Felderítés, lead — beégetett HU
- Kulcsszavak: `src/scout/rules.ts:15`, `googleMaps.ts:78-80`. Places `languageCode:"hu"`, `regionCode:"HU"`: `resolveOne.ts:104-105,227-228`. Brave `search_lang=hu`: `webSearch.ts:77-82`. Portál-letöltés `Accept-Language: hu,en`: `portals/politeness.ts:268`. Honlap-ellenőrző `locale:"hu-HU"`: `enrichPresence.ts:315`.
- TLD-tipp `["hu","com"]`: `enrichPresence.ts:15`; latin ékezet-levágás `:36`; magyar töltelékszavak `:153-165`.
- Portál-lista csak magyar: `qualify.ts:6-155` (`:4` „extend per country”), `MEASURED_OWN_HOSTS :302-314`, adapter-regiszter `portals/registry.ts:85-153`.
- Telefon: `+359…` megmarad, `00359` → `+359`, de nemzeti `0888…` → null (`src/text/phone.ts:62-70`); ragasztott számok csak HU (`:104`); `prettyPhone` csak +36 (`:134`); `COUNTRY_DIAL` HU/HR/AT/SK/SI/RO/RS/DE (`enrichPortal.ts:221-231`).
- Magellan: `query.region.country ?? "HU"` (`magellan.ts:92`); `COUNTRY_AREAS` csak HU (`run.ts:97-99`); beépített régiók HU (`regions.ts:16-55`).
- Lead-szerkesztés ország-aliasai csak magyar nevek: `leadContactRules.ts:28-45`.
- ✅ Paraméteres: OSM országos (`osm.ts:58-66`), időzóna-tábla BG-vel (`zoneTime.ts:21-62`), településfotó ország-Wikipedia (`townPhoto.ts:183`).

## 2. Nyelv
- `COUNTRY_LANG` (`src/i18n/lang.ts:14-28`): HU PL AT DE SK CZ RO HR SI IT GB IE US. Ismeretlen → `DEFAULT_LANG="hu"` CSENDBEN (`:95-99`). `uiLangs()` ebből származik (`:125`).
- Bábel-csomagok (`src/i18n/babel/packs/`): de hr it pl sk teljes (6656), en 1051, sl 1096; nincs bg, cs, ro.
- Nyelv-levezetés hívói: mock `generateEngine.ts:334-341` (régió-ország, ✅), csomag-előtöltés `scrapeJob.ts:74-76`, levél `mail.ts:190-210` (scraper-definíció → mindig HU), tenant-oldal a befagyott mock-nyelvből (`public.ts:1054`).
- Fizetés utáni lapok az OPERÁTOR nyelvén (`views.ts:2823,3298,3437,3530`, `i18nCtx.ts:75`), nem a vevőén.

## 3. Mock és oldal
- ⛔ `fixHomoglyphs` cirill→latin csere feltétel nélkül (`copyCurator.ts:37-43`, hívók `generateEngine.ts:640-647`, `recopy.ts:58,254`).
- ⛔ Piac-relevancia-ellenőrző magyar prompt nyelvtől függetlenül (`marketCheck.ts:810,838,1046,1278`).
- ⛔ Betűk: Google Fonts `css2?family=` subset nélkül (`skins.ts:497-503`); cirill nélküli családok ~13 sablonban (Fraunces, Outfit, Archivo, Josefin Sans, Barlow, Albert Sans, Gelasio, Grandstander, Zilla Slab, Quicksand, Fredoka, Libre Caslon, Public Sans, Bricolage, Figtree); fallback Georgia/system-ui.
- ⛔ Cirill névből üres slug (`domains.ts:56-63`) → `oldalam.citoviso.com` (`:67`), `oldalam-<hex>` (`provision.ts:154`), 0 domain-javaslat (`:130-131`), `mock--…` fájlnév (`generator/persist.ts:106`). Domain-javaslat `…szallas.hu` beégetve (`domains.ts:141-144`).
- ✅ Nyelvhez kötött (jó): minta-szolgáltatás, szobanév-normalizálás, vendég-kritikus csak `lang==="hu"` (`generateEngine.ts:119,123,207,211,604`); pénzformázás `formatMoney(currency, lang)`.
- ⚠️ Magyar jog-modell nyelvtől függetlenül: IFA Ft/fő/éj (`recipe.ts:541-551`, `moduleSections.ts:1305`), 18 év alatti mentesség (`meals.ts:286-291`), foglalási levél IFA-sor (`requests.ts:239-268`), `huDate` (`requests.ts:171,441`), Balaton-szabályok (`copywriter.ts:99-102`, `brief.ts:111,126`), magyar esemény-dedup (`events/gates.ts:119-170`), magyar levél-kritikus perszóna (`letterCritic.ts:89-95`).
- Pénznem-alapértékek `"HUF"`: `requests.ts:253,409,416,498,715,992`.

## 4. Kiküldés — +36-ra kötött
- SMS/MMS pár: `isHuMobileE164` (`phone.ts:73-75`) → `sendOutreachSms.ts:311-316`, `approvalQueue.ts:91`, `approvalCopy.ts:67`, `trialCampaign.ts:252`, `data.ts:1011`.
- Viber/WA (S10): `messenger.ts:460,511` `^\+36(20|30|31|50|70)\d{7}$`; `scripts/s10-a11y/s10_send.py:80-86` `norm()` csak `36\d{8,9}`; a deep linkek (`wa.me`, `viber://chat?number=`) országfüggetlenek.
- Ablak: `SEND_WINDOW_TZ=APP_TZ` Budapest (`sendWindow.ts:40-47,72-74`); kvóta egy közös 40 (`autoDispatch.ts:57,193-233`), a sor (ADR-0409) nem néz országot.
- Levél: `T()`-vel fordul (`draft.ts:308-686`), de összeg HUF (`:390`), hirdető-azonosító HU-alakú (`:153-162`); hiányzó csomag → HU-fallback (`mail.ts:247-252`), SMS-nél tiltás (`sendOutreachSms.ts:235-239`).
- Kiküldés-ellenőrző: HU adószám-minta (`outreachCheck.ts:232-238`), GSM-7 átírás (`:63`, `sms/encoding.ts:57`), magyar tiltás-indokok (`:605-616`); ország-kapu `:599-620` (legacy `lang!=="hu"` `:613`).
- Prospect-keret és leiratkozó lap i18n-en kívül (`prospectNotice.ts:42-60,201,516-525`, `console/server.ts:3414`). Süti-sáv magyar literál (`cit-consent.js:197-205`, `consent.ts:102`).

## 5. Ár, rendelés, fizetés, számla
- ✅ Vevőtípus (magánszemély/cég) a rendelésnél: `cit-configurator.js:2401-2406,2635`, szerver `buyer.ts:150-153`; HU cég → adószám, külföldi cég → közösségi adószám (`:215-249`, `cit-configurator.js:2825-2830`); EU-formátumok 27 tagállam (`taxId.ts:26-56`); VIES egyszer, rendelésnél (`buyer.ts:224-248`, `taxId.ts:177-211`), `invalid` tilt, `unavailable` AAM+jelzés; `vatTreatmentFor` (`taxId.ts:221-230`), DB-kényszer 0029.
- ✅ Ár-régió: `pricing_config` régiónként pénznemmel (0020), `/pricing?region=` (`server.ts:2172-2185`), TLD régiónként (0105). Fallback `global` (`pricing.ts:291-297`).
- ⛔ A rendelés régió nélkül: `configurator.ts:446-451,500-509,539,558`, `server.ts:~1236,~1265,~1276`, `billing.ts:286-295,651`, `moduleUpsell.ts:88`, `multilangOrder.ts:93`. `resolvePricingRegion` csak a főoldalon (`homepage.ts:110`), HU→hu, más→global (`pricing.ts:529`, `partnerData.ts:262`).
- ⛔ Modulárak egy HUF-térkép minden régióra (0016:21-25, 0020:12-13, `pricing.ts:74,114,239,276`); `computeMonthly` EUR-alap + HUF-modul (`pricing.ts:485-492`, `packageOffer.ts:50`); `global` `.hu`-t kínál HUF-költséggel (`pricing.ts:99-111,164`). Nincs „új régió” a /pricing-on (`pricingPage.ts:62-70`, nevek `:38-39`).
- ⛔ Barion: `currency:"HUF"` (`service.ts:218,232,898,910,1063,1075`), `CARD_VERIFY_AMOUNT_HUF` (`:64`, `wallet.ts:195,268`), `Locale:"hu-HU"` (`barion.ts:133,196`), számla-komment `hu-HU`+„Ft” (`service.ts:1406`), „Bankkártya” (`:1766`).
- ⛔ Számla: `szamlaNyelve="hu"` (`szamlazz.ts:152`), pénznem a fizetésé (`:151`), árfolyam-mező nincs; fordított adózásnál `TAM` kulcs (`service.ts:1737`) — EU-s szolgáltatásra `EUFAD37` a valószínű helyes (könyvelő igazolja); bukott számla mindig `"AAM"` (`:1649`). ÁFA-feliratok magyar literál (`legal.ts:70-76`); kliens a VIES ELŐTT mutatja a fordított adózás szövegét (`cit-configurator.js:2848-2856`).
- ⛔ Vevő-űrlap: hiányzó ország → HU (`buyer.ts:163`, `prefill.ts:62`, `cit-configurator.js:2328,2827,2891`); irsz numerikus minden országra (`:2422`); országnevek és hibák magyarul (`configurator.ts:64-78`); nem-EU ország nincs.
- Nincs 10 000 €-s EU B2C számláló / OSS. AAM-számláló 18 M HUF, csak HUF-számlák (`partnerData.ts:333,350-365`, `aamAlert.ts`).
- Eladói közösségi adószám: nincs kódban/env-ben, a számla `<elado>` üres (`szamlazz.ts:159`) → a Számlázz.hu-fiók cégadataiból jön.

## 6. Jog
- Egy magyar jogi szöveg: ÁSZF Eker./Ptk. (`legal.ts:147`), adatvédelem NAIH (`:908`), impresszum 2001. CVIII. (`legalPages.ts:47`); `tenantPrivacySections`/`tenantImprintSections` ország-paraméter nélkül (`legal.ts:729,924`); `<html lang>` a mock nyelve magyar szöveg fölött (`legalPages.ts:383,393`). Útvonalak `/adatvedelem`, `/impresszum` (`legalPages.ts:35-36`, `public.ts:4604`, `console/server.ts:299,3771`). A többnyelvű build a magyar jogi sávot fűzi minden nyelvhez (`multilangGenerate.ts:203,227`).
- Az elv kimondva („másik nyelv = másik ország JOGI CSOMAGJA”, `legal.ts:136-138,640-653`), mechanizmus nincs (`legal_pack` 0 találat).

## Ami kész és országfüggetlen (nem kell hozzányúlni)
Régió-árazás pénznemmel; vevőtípus + VIES + `vat_treatment`; `market` tábla és kapuk (ADR-0111); 29 vendégnyelv és csomag-betöltés; `Intl` pénzformázás; időzóna-tábla; OSM országos lekérdezés; a lead országa a koordinátából (ADR-0040); `+CC` normalizálás.

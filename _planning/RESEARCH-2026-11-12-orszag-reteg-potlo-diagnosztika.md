# Ország-réteg — pótló diagnosztika: pénzút, felületek, riportok, CRM (2026-11-12)

A 2026-11-11-es diagnosztika (`RESEARCH-2026-11-11-orszag-reteg-diagnosztika.md`) kiegészítése, az ADR-0437
1–2. lépésének landolása (e957d07f) UTÁNI kódállapoton. A tulaj kérdezte meg, hogy az árazás, a riportok, a felületek
és a CRM hol tart (11-12). Három párhuzamos, csak olvasó felmérés készült, ez az összesítésük.

Jelölés: ⛔ = egy külföldi eladást blokkol · 💸 = rossz pénz, adó vagy adat · ✎ = kozmetikai.

Forrás-helyesbítés: a korábbi „0016/0020/0105” migrációk (`migrations/0016_pricing.sql`, `0020_pricing_region.sql`,
`0105_package_module_domain_tld.sql`), nem ADR-ek.

## 1. A pénz útja (a lead országától a számláig)

1. **Ár-régió.** A `resolvePricingRegion` (`pricing.ts:523-541`) már az ország-rétegből képez (`country.ts:216`), de csak
   a főoldal (`homepage.ts:110`) és a partner-nézet (`partnerData.ts:263`) hívja. A hiányzó ársor csendben `global`
   (`pricing.ts:292-297`), a getterek alapja `hu` (`:45`). Kell: a régiót egyszer, a lead országából kell kiszámolni,
   és a rendelésen kell eltárolni.
2. **Modulárak.** Egyetlen HUF-térkép van minden régióra (`pricing.ts:115-123,264-277`), és a `module_price` táblának
   nincs `region` oszlopa. 💸 A `computeMonthly` (`:486-495`) EUR alapdíjhoz HUF modulárat ad: global-ban
   „10 € + 2000 €”. Ugyanez a hiba a `packageOffer.ts:50`, `getMultilangTierPrice` (`:480`) és `getOneTimePrice` (`:471`)
   úton.
3. **Új régió a /pricing-on.** Nem hozható létre. Az ismeretlen `?region=` a global-ra esik (`server.ts:2172-2185`),
   és a POST oda is ment (`:2233-2311`). A „+ Ország” fül csak felirat (`pricingPage.ts:73`), a nevek és a pénznem-jelek
   (Ft/€) be vannak égetve (`:35-39`). A `setDisabledModules` csak HU (`server.ts:2326`).
4. **Konfigurátor és rendelés régió nélkül.**
   - A konfigurátor (`configurator.ts:446-451,500-505,558`) és a rendelés (`console/server.ts:1235-1276`) régió nélkül
     áraz. Az `order_intent`-nek nincs `currency`/`region` oszlopa. 💸
   - A vevő országa csak HU + EU27 lehet (`configurator.ts:60-79`, ⛔ nem-EU). Hiányzó országnál HU
     (`buyer.ts:163`, `cit-configurator.js:2358,2855,2919`).
5. **Piac-kapu** (`payment/service.ts:163-170`, `:1922`, `trial/start.ts:169`): szándékos első blokk ⛔.
6. **Próba → fizetős.** A `trial/**` és `conversion/**` régió nélküli. A `/folytatas` a `getCurrency()`-t régió nélkül
   hívja (`public.ts:3073`).
7. **Barion.**
   - `currency:"HUF"` beégetve (`service.ts:218,232,898,910,1063,1075`), `Locale:"hu-HU"` (`barion.ts:133,196`).
   - A `payment.amount` integer (`0006:9`), és mindenhol egészre kerekít (`money.ts:49`, `pricing.ts:633`): az
     EUR-ban nincs cent 💸.
8. **Kártya-ellenőrzés.** `CARD_VERIFY_AMOUNT_HUF=10` (`service.ts:64`, `wallet.ts:195,268`): működik ✎.
9. **Megújítás és upsell régió nélkül** 💸: `billing.ts:173,285-295,651`, `renewalQuote.ts:81`,
   `moduleUpsell.ts:42,88,140`, `multilangOrder.ts:93`, `subscriptionAdmin.ts:195-302`, `moduleChange.ts:126,184`.
   (A `priceExpiry.ts` a tenant szobaárairól szól, nem a mi díjunkról.)
10. **Domain.**
    - A régió-paraméter ki van vezetve (`domainAdmin.ts:193,270-330`, `domainUpgrade.ts:51-70`), de a hívók
      `undefined`-ot adnak (`public.ts:2027,3229`). A global alapértéke `.hu` HUF-fal (`pricing.ts:100-112,165`).
    - A költségplafon csak a HU TLD-listát nézi (`costCap.ts:6-7,28,31`): helyi TLD (.bg, .ro…) vásárlása elutasítva ⛔.
    - `domainSettlement.ts:52,77` HUF.
11. **Számla.**
    - Fordított adózásnál `TAM` kerül a számlára (`service.ts:1737`); valószínűleg `EUFAD37` lenne a helyes, ezt
      könyvelőnek kell igazolnia. A bukott számla mindig `AAM` (`:1649`). Nem-EU vevőre nincs ág.
    - Nincs 10 000 €-s B2C/OSS-számláló.
    - `szamlaNyelve="hu"` (`szamlazz.ts:152`): a `country.invoice_lang` létezik, de 0 olvasója van.
    - Devizás számlához nincs `arfolyam`.
    - A megjegyzés hu-HU/„Ft” (`service.ts:1406`), az `<elado>` üres (`szamlazz.ts:159`).
12. **Visszatérítés és sztornó.** Nincs API (`service.ts:503`), deviza-különbözet kezelés sincs.

Árfolyamot szándékosan sehol nem használunk (`costCap.ts:3-4`): minden régió saját abszolút árat kap, ez akkor működik,
ha a modulár is régiónkénti. Pénznemenkénti kerekítési szabály nincs.

## 2. Felületek

**Szállástulaj-admin**
- ⛔ A beállító varázsló ár-lépése (`setupSteps.ts:123-130`) csak „ft/huf”-ot vág le, 1000 alatt elutasít
  („biztos, hogy forintban írta?”). Pénznem-választás nincs (`:280-290`).
- ⛔ Új oldal pénzneme `moduleConfig.ts:183` `HUF`. A provisioning nem az országból tölti (az időzónát igen,
  `provision.ts:337`).
- ⛔ A foglalás-beállításnál csak HUF/EUR választható (`bookingSetup.ts:381`, `cit-booking-setup.js:219-220`,
  `bookingSetupViews.ts:107-110`), BGN/RON/CZK/PLN nem.
- ⛔ Az előfizetés, a modulkosár és a fizetendő összeg a régió nélküli `getCurrency()`/`getModulePrice()`-t hívja:
  `adminViews.ts:1099,2986,3237,3432,3509,3632,3890`, `modules.ts:274`, `subscriptionAdmin.ts:195`, `moduleChange.ts:126`.
- 💸 További hibák:
  - `setupWizard.ts:142` „Ft / éj”
  - IFA egész számra és Ft-ra (`bookingSetup.ts:429-430`)
  - a kötbér-levél pénzneme (`public.ts:3073`)
  - a számla-összegző vegyes pénznemet összead (`adminViews.ts:5434`)
  - `moduleConfigViews.ts:1056` HUF
  - a kapcsolat-űrlap nemzeti telefonszámot elutasít (`tenant/contact.ts:36,95-104`, `contactViews.ts:195-196`)
- ✎ Kozmetikai:
  - példák Ft-ban (`bookingSetupViews.ts:101,103`)
  - hu-HU dátum (`moduleConfigViews.ts:2706,2791`)
  - magyar címsorrend (`adminViews.ts:6214`)
  - a 429-es lap nyelve (`public.ts:2671`)

**Nyilvános oldalak**
- ⛔ A főoldal csak magyar: `public/index.html` `lang="hu"`, `homepage.ts:32-43` T() nélkül, „Saját .hu domain”.
- 💸 A jutalék-kalkulátor Ft-ban (`index.html:146-154`).
- 💸 Az igénylőlap HU-bbox-ban keres (`mockRequest.ts:37-42,139`).
- 💸 A vendég ajánlat-lejárata hu-HU (`requests.ts:3006-3069`), a lead ajánlat-lapja hu-HU (`offerViews.ts:43-44`).
- 💸 A foglalási widget a magyar IFA-szabályt állítja minden országban (`cit-runtime.js:576-582`).
- ✎ `todayISO` UTC (`cit-runtime.js:58-60`), a demó-ár HUF (`:902`), hu-HU a foglaláslistán (`bookingViews.ts:808,1116`).

**Operátori konzol**
- 💸 Ft-ban jelenik meg: `partnerProfileViews.ts:116,511`, `partnerViews.ts:293`, `partnerData.ts:1000`,
  `views.ts:77,1082`.
- Országszűrő csak a leadlistán van. Nincs a partnerlistán, a bevétel- és próba-riporton, a tölcséren, a
  foglalás- és üzenetlistán.

**Partnernek menő levelek**
- 💸 `orderMail.ts:51,61` és `domainRegistry.ts:404`: régió nélküli `getCurrency()`.
- ✎ `activationEmail.ts:91` `?? "HUF"`.

**Már ország- vagy pénznem-tudatos:**
- `formatMoney`/`currencySign`
- a foglalás `quoted_currency`
- a szállás-időzóna (ADR-0290)
- a tenant-oldal dátuma és pénze a `lang` szerint
- a levelek nyelve `langForTenant`
- a konzol partnerprofil ár-régiója

## 3. Riportok

- 💸 **A bevételi riport keveri a pénznemeket.**
  - `revenueReport.ts:433,446,462`: a `payment.amount` pénznem nélkül adódik össze (a `payment.currency` oszlop van).
  - `:350,349`: MRR és előrejelzés a HU árlistával.
  - `:370,542`: `order_intent.price` pénznem nélkül.
  - `:377`: domain-költség csak HUF.
  - `revenueReportViews.ts:26`: minden összeg „Ft”.
- 💸 **AAM-számláló.** `partnerData.ts:350-393`: a nem-HUF rendszerszámla kimarad. ⛔ (jogi) OSS-számláló nincs,
  `aamAlert.ts:35-58` csak a 18 M Ft-ot nézi.
- 💸 **Tölcsér.** Nincs ország-dimenzió és -szűrő (`reportData.ts:55-58,603`). A „mikor nyitják” hőtérkép budapesti
  órában (`reportData.ts:711`, `reportViews.ts:821`), így rossz küldési órát javasol.
- 💸 **Portálfelismerés.** `referrerGroup.ts:33-41,58,75,83` csak magyar portálokat és levelezőket ismer.
- ✎ Budapest-napokra számolnak:
  - `trialReport*.ts`
  - `tenantActivity*.ts`
  - a tenantnak szóló havi levél (`trafficMail.ts:54,116`, ide `tenant.time_zone` kell)
  - `trafficReport.ts:67`
- **Minta a javításhoz:** a `partnerData.ts:18-108,207-237` KPI-jai pénznemenként vannak.

## 4. CRM és kommunikáció

- ⛔ **Duplikátum-szűrő.** `scraper/dedupe.ts:10-16`: a `normalizeName` csak `[a-z0-9]`-et tart meg, ezért a cirill
  vagy görög név üres. Ezután a 250 m-en belüli (vagy koordináta nélküli) leadek EGY leaddé olvadnak
  (`:149-154,105-110`).
- 💸 **Bejövő válasz.** A `replies/store.ts:72,108,164` a régi `normalizePhone`-t hívja: a nemzeti alakban tárolt
  számú leadhez nem talál, a válasz eldobódik. Ugyanez a hiba:
  - `partnerMessages.ts:151,210,219,222,707-710`
  - `autoDispatch.ts:190` (a telefon-ikerkapu)

  Az új `normalizePhoneIn` (`text/phoneCountry.ts:20`) nincs bekötve.
- 💸 **Idézett előzmény.** A `mime.ts:169-174` csak a magyar és angol idézet-jelölőt vágja le.
- 💸 **Válasznyelv.** Az `outreach_reply`-nak nincs nyelv-oszlopa.
- ⛔ **Poe** (`poe/charter/RUNBOOK.md:112-130`): magyarul válaszol. Az `answerRules.ts:54` aláírása magyar. A
  válaszküldési ablak hétköznap 9–16 budapesti idő szerint, magyar ünnepnapokkal (`answerRules.ts:28-37`,
  `answer.ts:191-192,246`).
- ⛔ **Vera** (`vera/charter/CHARTER.md:53-55`, `ONTOLOGIA.md:57,73`): magyar mobilt és magyar portált vár, ezért egy
  külföldi lead mindig TARTVA marad. Neo (`neo/charter/*`) `.hu`-heurisztikát használ.
- 💸 **Jóváhagyási sor.** Nincs ország-oszlop és -szűrő (`approvalQueue.ts:75-88`).
- 💸 **Partner csendes órák.** 22–07 budapesti idő szerint (`partnerMessages.ts:12,468-473`).
- ✎ **Prospect-visszajelzés.** A `prospectFeedback.ts:109-116` hiányzó nyelvnél `hu`-ra esik vissza (ellentmond az
  ADR-0437 ③-nak).
- **Már működik:**
  - a leadlista országszűrője
  - a `+CC` alakú bejövő szám
  - a kérdőív `T(lang)`
  - a rejecter-őr (nyelvfüggetlen)
  - a Viber- és WA-linkek

## 5. Következmény a bevezetési sorrendre (ADR-0437 ⑤ 3. lépés bővítése)

A tulajnak 11-12-én küldött terv sorrendje:
1. pénz útja
2. szállástulaj-felület és nyilvános oldalak
3. riportok
4. CRM, a kollégák szabályaival
5. kiküldés
6. mock és nyelv (cirill)
7. jogi csomag
8. konzol „Országok” lap
9. első ország

A duplikátum-szűrő cirill-hibája a felderítést is érinti, ezért az ELSŐ külföldi scrape előtt javítandó.

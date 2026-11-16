## ADR-0454 — Ország-réteg 3/3: a riportok pénznemenként, országonként és a helyi időben

**Státusz:** ELFOGADVA (tulaj-jóváhagyás 2026-11-16, „igen mehet”, a koordinátoron át, `cit9b4690e3`; brief `~/rc-briefs/orszag-reteg-3c-riportok-20261116.md`) ·
**Épít:** ADR-0437 (ország-réteg, a lead országa), ADR-0443 (pénzút: régió + pénznem a rendelésen és az előfizetésen, minor unit), ADR-0450/0452 (felületek, `dateLocale`, `siteCountry`) ·
**Felülírja:** a bevételi riport „a hazai pénznemben olvas a riport-körig” átmenetét (ADR-0443).

### Döntés
① **Bevételi riport (Előfizetők fül): egy nézet = egy pénznem.** A `foldRevenueReport(…, currency)` csak az abban fizető előfizetőket, az abban beérkezett fizetéseket (`payment.currency`) és az abban fizetett domain-költséget hajtogatja. Alapból a hazai pénznem (`homeCurrency()` = a `hu` régióé), így a magyar lap bitre a régi. Több pénznemnél a szűrősorban „Pénznem” chip-sor (`?c=CZK`), a lap tetején a „Pénznemenként” tábla (aktív, MRR, beérkezett, kintlévőség soronként). Összeadás és átváltás NINCS. Minden összeg `formatMinor` a nézet pénznemében. A domain megújítása a mi költségünk a regisztrátor pénznemében (`domain_tld.cost_currency`): abban a nézetben látszik, nem a vevőében. A futó próba a lead országának pénznemében számít.
② **A partner-lap havi diagramja pénznemenként egy grafikon.** Forintos partnernél ugyanaz az egy grafikon.
③ **Tölcsér és Viselkedés: ország-szűrő (`ctry`, ISO-2, `-` = ismeretlen) és ország-bontás.** A lead országa: `raw.country`, ennek hiányában a terület országa (`countryOf`). A szűrő ugyanúgy szűkít, mint a „Lead típus”. A legördülő csak akkor jelenik meg, ha az időszakban több ország is van.
④ **A küldési óra és a „Mikor nyitják” rács a LEAD helyi idejében** (az ország-sor `time_zone`-ja). Több országnál a javaslat országonként szól (`heatBest`). Ha minden megnyitás budapesti, a felirat a régi.
⑤ **Portálfelismerés a katalógusból:** `isPortalReferrerHost` (`scraper/qualify.ts`) = a globális lista ∪ minden ország-sor `portal_domains`-e, csak hoszt-bejegyzésekkel. A régi lista megmarad, hogy a magyar szám ne mozduljon. Mérve 2026-11-16 az éles `site_visit` referrereken: egyetlen besorolás sem változik. A levelezők listája határokon átnyúló (seznam, wp.pl, web.de…).
⑥ **A tenant-oldali riportok és levelek a szállás zónájában (`tenant.time_zone`):** a forgalmi riport ablaka és napi sora, a havi levél hónapja és dátum-címkéje (a nyelv `dateLocale`-jével), a próba-riport napjai és időpontjai, a tenant-aktivitás napi látogatói és időpontjai. A naphatár SQL-je literál zónát kap: a SELECT és a GROUP BY csak így ugyanaz a kifejezés.
⑦ **OSS a konzolon:** az `ossStatus` (ugyanaz, ami a fizetést visszatartja) az Irányítópult figyelmeztetései között: 80 %-tól sárga, visszatartásnál piros. A Pénzügy-csempén megjelenik, amint van EU-s magánszemély-forgalom. Az AAM-számláló már a 3/1-ben beszámolta a nem forintos rendszerszámlákat (`nonHufAamInvoicesHuf`): ellenőrizve, nem változott.

### Mérés
- `scripts/country-reports-e2e.mts` (scratch DB; HU, CZ/CZK, SK/EUR és egy PT/Lisszabon sor): három külön pénznem-sor, a HUF-nézet ujjlenyomata bitre azonos a csak-HU riportéval, a CZK-nézet 398,40-et ír. Ország-szűrő és ország-bontás. Küldési óra és hőtérkép prágai és lisszaboni helyi órában. Cseh portál és levelező felismerve. A cseh tenant forgalmi ablaka prágai éjféltől indul, a levél dátuma cseh formájú. Próba- és aktivitás-napok a szállás naptárában.
- `country-layer-check` ⑦: a riport-fájlokban nincs beégetett HUF / hu-HU / „ Ft” / Europe/Budapest, a Budapest-órát csak indoklással importálják, minden összeg-lekérdezés a pénznemét is olvassa, és szerkezeti horgok fogják a pénznemenkénti hajtogatást, a helyi időt, a katalógust és a tenant-zónát.

### Maradt
A tölcsér kohorsz- és idővonal-napjai és a riport hónapjai a cég naptárában (Budapest) maradnak. Ez operátori naptár, pénzt nem kever. A provisioning a tenant zónáját a terület országából tölti, nem a lead koordinátájából (a 3/2 megfigyelése). Az új konzol-feliratok magyarul jelennek meg, amíg Bábel le nem fordítja őket.

### Visszafordíthatóság
🔄 Migráció nincs. Csak olvasó kód. A magyar számok bitre azonosak (e2e ①).

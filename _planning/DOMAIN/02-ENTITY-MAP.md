# 02 — ENTITÁS-TÉRKÉP (Citoviso ontológia)

> A domain entitásai és kapcsolataik. A kód igazsága: **perzisztált** entitásokra `src/db/schema.ts` + `migrations/`; a **generáló-nézetre** `src/scraper/types.ts` (RawLead/QualifiedLead/LeadMaterial) + `src/generator/` (brief/theme) + `src/engine/recipe.ts` (`SiteData`/`Photo`). Ha eltér, a kód nyer — és ezt frissítsd.

## Iparág-agnosztikus közös mag (a régi `Property` utódja)
A Fázis 2 igazolta: **közös, iparág-független mag + specializáció pontosan 3 becsatlakozási ponton (KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ).**
6 mag-entitás (fix, típusos oszlopokkal a közös mezőkre):
- **Vállalkozás-profil** — a konkrét vállalkozás strukturált tényadata (a régi „Property" agnosztikus utódja, az „adat-objektum").
- **Kínálati egység (Offering)** — szoba/apartman ↔ étteremnél menütétel.
- **Ár** — pénznem az Ország-tengelyről.
- **Elérhetőség** — dinamikus állapot (folytonos dátum-tartomány szállásnál ↔ diszkrét idő-slot étteremnél).
- **Foglalás** — az érték-teremtő tranzakció; a jutalék-horog tárgya.
- **Vélemény** — csak VALÓS (lásd 03-INVARIANTS §B.7).

### Kínálati egység (Offering / `site_unit`) — egy fogalom, egy igazság
Az elérhetőség és az ár az EGYSÉGRE kulcsolódik, NEM a Site-ra: az „egy szállás = egy kiadható dolog"
feltevés beégetése hibás (több szoba/apartman esetén törik). Egyetlen `site_unit` nyilvántartás:
a `rooms` modul mutatja, a `booking` foglalja, a `pricing` árazza. Két lista ugyanarról előbb-utóbb
ellentmond. Elv: az ADATOT alakítsd, ne a sablont — ami a `SiteData`-ban változik, az mind a 16
sablonban O(1) költséggel hat (a szekció 16-szori megírása = a 100×N csapda).
Kód: `site_unit` (migráció **0024**), `unit_price` (**0025**), `unit_season` (0028), `src/moduleConfig.ts`.
⚠️ A forrás-review 0027/0028-at mondott; a fában **0024/0025** a valódi szám (a 0027 sorszám két
MÁS migrációé) — a kód nyer.

**⛔ Fölérendelt kínálati egység — az „egész szállás" (ADR-0114, 2026-09-08).**
Tulaj-rendelet: *„ha valaki az egész szállást kéri, akkor a többi egység adott napokra ne legyen
elérhető. ERGO az egész szállás mint egység mindig van, alapértelmezett."* A javítás előtt minden
`site_unit` IZOLÁLT naptár volt (`availability_day` kulcsa `(unit_id, day)`), az „A szállás
egésze" csak NÉV — **a rendszer maga termelt dupla foglalást** (mérve).

- A fölérendeltség **ADAT**, nem névegyezés: `site_unit.is_whole_property` (migráció 0059),
  site-onként legfeljebb egy. ⚠️ **ADR-0232 (2026-09-25) módosítás: a jelölés VÁLASZTÁS, nem
  kényszer** — senki nem jelöli vissza (`ensureUnits` vissza-jelölő ága törölve), üres jelölés =
  a szobák függetlenek; az egész szállás **törölhető és áttehető** (Szobák képernyő, kártya a rács
  fölött; a 2. egység felvételekor kötelező kérdés). Egy egységnél a fogalom láthatatlan.
  **Saját ára van, sosem a szobák összege** (a szumma csak tulaj-oldali tájékoztatás).
- A kizárás **KÉTIRÁNYÚ** (egész ↔ szoba) és **LEVEZETETT**, nem tárolt
  (`src/tenant/unitScope.ts::blockingUnitIds`). Ok: árnyék-sorokat minden lemondásnál vissza
  kellene bontani, és egy kimaradt visszabontás olyan éjszakát hagy, amit senki nem tud
  felszabadítani.
- **Szoba ↔ szoba: NINCS kizárás** (egy négy-apartmanos ház négy foglalást vesz fel).
- Mind a **négy kapun** érvényes: vendég-naptár (`getBlockedDaysFrom`), űrlap gyors-elutasítás,
  elfogadás-tranzakció (`src/booking/requests.ts`), admin hónap-nézet (`source:"linked"`, nem
  szerkeszthető). Az elfogadás a kizárt egységekre váró pending kéréseket is lezárja.
> Általánosítható a vertikumokra: ahol a kínálati egységek hierarchikusak (terem↔asztal,
> egész↔rész), a kizárás LEVEZETETT reláció a fölérendeltségből — nem tárolt árnyék-adat.

**Hibrid adatmodell (adat-szintű invariáns):** a 6 mag-entitás közös mezői fix, típusos oszlopok (`tenant_id`, név, ár, dátum, státusz — indexelt); a 3 becsatlakozási pont **iparág-specifikus** mezői **strukturált JSONB**, amit az Iparág-definíció sémája ír le/validál. → **Új iparág = új definíció-séma, NEM DB-migráció.**

## Property — szállás-pilot generáló-nézet (történeti, NEM kanonikus adatmodell)
> ⚠️ A `Property` interfész **nincs a kódban** (a valós típusok: `RawLead`/`QualifiedLead`/`LeadMaterial` + `GeneratedBrief`/`ThemeBrief`). Ez a szekció a szállás-pilot generáló-brief mezőit írja le fogalmi szinten; a kanonikus adatmodell a fenti 6-entitásos mag. A `git rm` az ÚJ struktúra scaffoldjakor jön.

Egy szálláshely generáló-nézete a következő mezőkkel (fogalmi, nem 1:1 kód):
- `slug`, `name`, `location`, `headline`, `lead`, `capacity`
- `contact` → **Contact** { phone?, email?, address?, postalCode?, city? }
- `amenities[]` → **Amenity** { icon (SVG-sprite id, NEM emoji), label }
- `images[]` → **PropertyImage** { url, source (owner|guest|portal|generated), role?, alt? }
- `unique` → **UniqueSpotlight** { label, title, body, imageUrl?, chips[] } — a szállásra jellemző EGYEDI szekció
- `review?` { quote, score, source } — csak VALÓS vendégvélemény
- `palette` → **Palette** { primary, primary2, accent, ink, cream, cream2, muted } — a fotókból kinyerve
- `stylePreset` — "rustic" | "modern" | "lakeside" | …

## Kapcsolatok / folyamat
```
Source(1..*) --ingest--> Property(partial) --merge--> Property
Property --analyze--> Palette + stylePreset
Property --generate--> Site (HTML + assets)
Site --outreach--> Owner
Owner --convert--> Tenant (Site + Admin, owner-assetekkel)
```

## Propagáció — a mentés NEM publikálás (adat-szintű invariáns)

A publikus Site **statikus pillanatkép** (`sites/<tenant>/index.html`). Ahol a felület állapotot
ír, de a látható kimenetet külön lépés állítja elő, ott a **DB-írás önmagában semmit nem
változtat azon, amit a vendég betölt**. Mérve 2026-09-08: két új `site_unit` sor 18:18/18:20-kor,
a kiszolgált lap 18:16-os, egyetlen szobával; az admin „Mentve"-t mondott, az oldal az
ellenkezőjét, és semmi nem jelezte a rést.

- **Egy közös kijárat:** minden ilyen mentés a `redirectRerendered`-en megy ki
  (`src/server/public.ts:271`).
- **Statikus őr DÖNTÉST követel minden új admin-POST-tól:** renderel, VAGY indoklással a
  kivétel-listán van (`scripts/snapshot-propagation-check.mts`). A kivétel legitim lehet — a
  foglaltságot pl. a vendég-oldal ÉLŐBEN kérdezi —, de indoklással. Route-onként emlékezetből
  tartani ezt lehetetlen.
- **A MÁR elcsúszott állapotot külön eszköz éri utol** (`scripts/rerender-tenant.mts --all`).

### A fotó NÉGY úton ér a lapra
A `mock_artifact.inputs.siteData` **BEFAGYOTT lista**, amit több út újrarenderel — bármely
tartalmi szűrést (pl. `ad_banner` kizárás, [03-INVARIANTS] §A) MIND A NÉGYEN érvényesíteni kell:
`generate` · `provision` (élesítés) · `tenant/editor::assembleEffective` · `heroOverride`.
A generálás-idejű szűrés magában **hármat hagyna ki**.

### ⚠️ A propagáció harmadik vak foltja: a CDN
A deploy zöld lehet, miközben a látogató törött oldalt kap: a szerver-oldali HTML azonnal
frissül, a CDN-ről jövő statikus fájl viszont **órákig nem** (mérve: `cache-control:
max-age=14400` = 4 óra, `cf-cache-status: HIT`, purge-kulcs NINCS a prod .env-ben). A kiszolgált
`home.css`-ben **0** `#cit-consent` szabály volt a lokális 11 helyett. Ellenszer: a statikus
fájl hivatkozása a TARTALOMHOZ kötődjön (`?v=<sha1 8 jegy>`, `withAssetVersions` —
`src/server/public.ts:331`), és CSS/JS-t érintő deploy után az **élesen kiszolgált** fájlt kell
mérni, nem a lokálisat.

<!-- distill:begin 6159edab18605704 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Propagáció — a mentés NEM publikálás (új bekezdés)
> **Forrás-memória:** project_after_deploy_rerender_tenant_sites_v1.md, 2026-10-11_portal_szinkron_elek_javitasok.md
> **Review:** `_inbox/20261019T060001Z.md` (87. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

### A DEPLOY sem publikálás: a runtime a pillanatképbe van ágyazva
Az élő tenant-oldal renderelt pillanatkép, a benne lévő foglalási/szelvény-runtime-mal együtt. Egy
runtime-javítás deployja az élő oldalakon **semmit nem változtat**, amíg nincs újrarenderelés
(`scripts/rerender-tenant.mts --all`). Különben az újrafuttatott teszt hamis „nem javult”-at
mér (mérve 10-13: a mobil végösszeg-javítás). ⚠️ Fordítva: a `/p/<token>` lead-link a runtime-ot
kiszolgáláskor injektálja (`injectConfigurator`, a már injektált oldalon cserél), ezért ott a deploy
újrarenderelés nélkül él. A két út eltér: runtime-változás után mindig kérdezd meg, melyiken fut.
<!-- distill:end -->


<!-- distill:begin f444a97c293e17aa 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Propagáció — a mentés NEM publikálás (adat-szintű invariáns)
> **Forrás-memória:** 2026-10-04_pakli_galeria_torles.md · 2026-10-07_csomag_kartya_kedvezmenyes_ar.md · feedback_photo_removal_standing.md
> **Review:** `_inbox/20261011T020001Z.md` (56. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

### A mock-HTML a runtime PILLANATKÉPÉT hordozza
A kliens-runtime-ot az `injectRuntime` BEÁGYAZZA a lapba, és a már beágyazottat nem cseréli
(`src/generator/runtime.ts`: `if (html.includes("data-cit-runtime")) return html`). Következmény:
egy runtime-változás (új funkció vagy törölt kód) a MÁR legyártott mockokra nem hat, azok a saját
példányukkal futnak tovább; a törlés ezért nem töri el őket, a javítás viszont csak újrarenderre
ér el hozzájuk. Ellenpélda: a konfigurátor (`cit-configurator.js`) KÉRÉSENKÉNT injektálódik, ezért
annak változása rerender nélkül él. Ugyanez az elv adat-szinten: a `rerender-mock` a mock TÁROLT
receptjéből (`inputs.siteData.photos`) renderel, nem a lead `raw`-jából — a leadről levett kép a
kész mockon addig marad, amíg a receptből is ki nem vesszük.
<!-- distill:end -->


<!-- distill:begin 388933f3bbbc688b 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Propagáció — a mentés NEM publikálás (a szakasz végére, új alcím)
> **Forrás-memória:** `2026-09-23_preview_nowrite_upsell_oneoff.md`
> **Review:** `_inbox/20260927T020001Z.md` (211. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

### Az ELŐNÉZET nem ír (ADR-0089 ④ / ADR-0213)
A megvásárlás ELŐTTI modul-előnézet olvasó művelet — mégis írt: a Szobák/Árak/Foglalás (és
mérve az Értékelések) előnézete `ensureUnits()`-en át **`site_unit` sort INSERT-elt** egy semmit
nem vett fiókban, tehát a puszta megnézés adatot hozott létre. A szétválasztás egy függvény:
`peekUnits(siteId)` (`src/tenant/units.ts:106`) memóriabeli MINTÁT ad, sosem perzisztál; az
`ensureUnits()` marad az író út, és lustán, a konverzió UTÁN fut.
⛔ **Az őre vak volt rá**, mert a függvénytörzs SZÖVEGÉT nézte („writes nothing" komment), nem a
mellékhatást — a mély írást DB-pillanatképpel kell mérni (`module-preview-nowrite-check`, 12
modul, piros ikerrel), és a szöveg-alapú `module-preview-check` fejléce ma kimondja, hogy vak rá.
⭐ Általánosítható: **ahol egy „csak megnézem" út a termék író függvényét hívja, a mérés a
DB-állapotot vesse össze, ne a kód szándékát.**
<!-- distill:end -->


## Realizált konverziós & pénzügyi entitás-lánc (kód-igazság, ADR-0014/0029/0080)
> Ezek a korábban „tervezett" entitások MA a kódban élnek (`src/db/schema.ts`, `migrations/`).
> A lánc: **lead → prospect → order_intent → payment → invoice**, plusz
> **tenant → site → module_entitlement → subscription**.

- **prospect** — a kiküldött megkeresés (a lead és a konverzió közötti állapot).
- **order_intent** — a megrendelés + a rábélyegzett **vevő-nyilatkozat** ([03-INVARIANTS] §K) és a
  választott modulok. `kind ∈ initial | upsell | multilang | domain_upgrade | renewal |
  domain_settlement` (`src/db/schema.ts:291` — a forrás-review `new`-t írt, a kódban `initial`).
  MINDEN fizetős út EZEN a láncon megy (nincs párhuzamos fizetési út); minden `kind`-nek külön
  `handleWebhook` `paid`-ága van (fulfillment, `src/payment/service.ts`).
- **payment → invoice** — a fizetés és a bizonylat.
- **subscription** — tenantonként egy, fordulónappal (ADR-0080, ld. [01-CALC-MODELS]).
- **market / market_log** (migráció 0057) — a PIAC mint jogrendszer-egység, append-only
  döntés-naplóval; fail-closed olvasó `src/markets.ts::isMarketApproved`. Kapuzza a hideg
  megkeresést, a pay-linket és az élesítést (ld. [00-GLOSSARY] Piac).
- **site_unit / unit_price / availability_day / booking_request** — a foglalási mag (a régi
  „tervezett Booking"); az elérhetőség és az ár az EGYSÉGRE kulcsolódik (ld. fent).
- **domain_provisioning** — az egyedi-domain állapotgép hordozója (ADR-0071/0078).
- Két fizetési sík elkülönül ([03-INVARIANTS] §G.19): Tenant→Citoviso (a mi bevételünk, ezek az
  entitások) ↔ Vendég→Tulaj (a tulaj fiókján, nem rajtunk át).

**⚠️ Adatmodell-gotchák (a kód tanította):**
- **Az `invoice`-on NINCS `tenant_id`.** A tenanthoz vezető út JOIN:
  `invoice → payment.order_intent_id → order_intent.prospect_id → prospect.lead_id =
  tenant.lead_id`. Tenant-admin bizonylatlistához / PDF-route jogosultsághoz ez kell (idegen id →
  404, nem tartalom). Igazolva: az `InvoiceTable` `payment_id`-t hordoz, `tenant_id`-t nem.
- **`vat_key`/`vat_rate` PER SZÁMLA** (AAM=0 most). Gotcha: a küszöb-átlépés csak jövőbeli
  sorokat billent, nincs séma-migráció (ld. [01-CALC-MODELS] Adó).
- **A multilang rendelés a vevő-azonosságot az `initial` rendelésről ÖRÖKLI, fail-closed:**
  honnan-örökölni-hiánynál NINCS pay-link (számlázhatatlan pénzt nem veszünk el — ADR-0029 kapu).
  Forrás: `src/tenant/multilangOrder.ts`.
- **Prospect outreach-pecsétek — csatornánként külön.** `sent_at` = az ELSŐ ÉRINTÉS (H1-funnel
  bázis), plusz `email_sent_at` / `sms_sent_at` / `mms_sent_at` csatornánként
  (`src/db/schema.ts:145–153`). ⛔ A közös `sent_at`-ot csatorna-kapuként használni HIBA (az egyik
  csatorna elzárja a másikat — mért, ADR-0082). `mms_sent_at` `sms_sent_at` nélkül = megszakadt pár.
- **Bizonylat FIZIKAI helye — egy szabály, két ág:** amit MI generálunk (kimenő számla PDF),
  kicsi és kevés → **DB** (`invoice.pdf_base64`, 0030 — „one document, one home"); amit
  FELTÖLTENEK (szkennelt bejövő bizonylat), nagy és tetszőleges mennyiségű → **fájl**
  (`accounting_document.document_file`, `sites/_documents/`, 0031, DB csak útvonal+sha256).
  Küszöb: ~1 GB fölött a kimenő ág is fájlba költözik. Mielőtt bármelyikre építesz, tisztázd a
  gazdát. ⛔ A fájlos tár mentése nyitott rés. Forrás: ADR-0086 ②.
- **`schema_migrations` a fájl NEVÉT jegyzi, a Postgres KÖZÖS a worktree-k közt** → két szál
  azonos sorszámú, eltérő tartalmú migrációja némán „már alkalmazott". ⚠️ Élesen megtörtént, és
  **nem elszigetelt eset: 2026-09-17-én megszámolva HAT ütköző sorszám él a fában** — `0027`
  (kb_translation + reviews) · `0051` (aam_alert + booking_notifications) · `0052` (alert_settings
  + booking_quoted_price) · `0053` (domain_fee_on_order + prospect_optout_log) · `0059`
  (tenant_message_traffic + unit_whole_property) · `0066` (multilang_tier + scrape_run_heartbeat).
  ⛔ **Ez a rés RENDSZERES, nem baleset** — ugyanaz a mechanizmus, mint az ADR-számok ütközésénél,
  csak itt a DB nyeli el némán. Új migráció előtt: `git fetch` + MINDEN worktree ellenőrzése.
  Ellenőrző parancs: `ls migrations/ | sed -E 's/^([0-9]{4})_.*/\1/' | sort | uniq -d`
  (⚠️ a listát MÉRD, ne idézd — a fenti hat a mérés napján volt igaz.)
- **Tenant-login kulcs = stabil felhasználónév, NEM e-mail.** Indok: mi adunk a tenantnak
  e-mailt/domaint → az e-mail INSTABIL azonosító. A login = a vállalkozásnévből generált stabil
  `tenant_user.username` + megjegyezhető jelszó (scrypt `password_hash`); a **kommunikációs
  e-mail külön, módosítható mező** (`contact_email`, 0013). Magic-link ELVETVE (nem-tech tulajnak
  macerás) — ⚠️ a `TenantUserTable` fejléc-kommentje még „magic-link login"-t mond
  (`src/db/schema.ts:645`), az elavult; a MEZŐK a jelszavas utat írják le. Két elkülönített
  identitás-realm (control plane = `operator_user` / data plane = `tenant_user`),
  realm-elkülönített cookie-aláírással — tenant-cookie sosem validál operátorként
  ([03-INVARIANTS] §G).

<!-- distill:begin cea30e09048d118d 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Realizált konverziós & pénzügyi entitás-lánc (kód-igazság, ADR-0014/0029/0080)
> **Forrás-memória:** 2026-10-09-ingyenes-proba-A-allapot-konvertalas.md · 2026-10-07_valaszok_a_megkeresesekre.md · 2026-10-08_valasz_az_iranyitopultrol.md · 2026-10-05_lead_sajat_aldomain_link.md
> **Review:** `_inbox/20261011T020001Z.md` (42. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

- **free_trial** (0097, 0099) — a próba a `subscription`-ön KÍVÜL él (ld. [00-GLOSSARY] Ingyenes próba); `tenant_id` FK `SET NULL`, mert a törlés után a sor marad az ÁSZF-elfogadás bizonyítékaként (`purged`, `purge_report`). Napló: `free_trial_notice` (t3/t1/p7), `free_trial_alert`.
- **outreach_reply / outreach_reply_send** (0094, 0096) — a megkeresésre érkezett válasz (SMS a gammu-ból, e-mail IMAP-ból) és a konzolról küldött válasz. ⛔ A válasz NEM suppression-esemény (ld. [03-INVARIANTS] §C).
- **lead.preview_label** (0090, egyedi, kisbetűs) — a lead SAJÁT előnézeti aldomainje (`<címke>.citoviso.com`), ez a megkeresés linkje; vásárláskor a slug-alapértelmezés, más slug esetén elengedődik (`src/outreach/previewLabel.ts`, ADR-0330).
<!-- distill:end -->


## Adatmodell-gotcha: „ugyanaz a duplikátum-jel NÉGY különböző valóságot takar"
Egy közös név/telefon/domain jel NEM jelent automatikus összevonást — négy külön eset van:
egy üzlet két néven · egy szálloda több épülete (Abbázia ×6) · egy tulaj több üzlete (Eldorádó) ·
lánc közös honlappal (Ensana/Danubius). → **a gép JAVASOL, az ember DÖNT** (`lead_link`, migráció
0022, három verdikt: `duplicate` [a megtartott elnyeli a vesztes naplóját, a vesztes
VISSZAVONHATÓan disqualified] · `same_owner` [mind marad, EGY megkeresés — a küldő-pipeline-nak
tiszteletben kell tartania] · `unrelated`).
⚠️ **Tranzitivitás-csapda:** egy GYENGE él mindent megfertőz (közös ügynökségi honlap 34 km-re lévő
falvakat láncolt) → csak ERŐS él fűz össze (2+ jel VAGY egy helyrajzi pont VAGY <300 m).
Kód: `src/console/duplicates.ts` (`DupVerdict`).

<!-- distill:begin d58b4d12f6caaac4 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Adatmodell-gotcha (a duplikátum-szakasz után, új alszakasz)
> **Forrás-memória:** 2026-10-04_foto_darabszam_duplikat_portal.md · 2026-10-04_koordinator_eles_hibak_javitasa.md
> **Review:** `_inbox/20261011T020001Z.md` (70. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

## Adatmodell-gotcha: a portál-fotó azonossága nem az URL
Portál-HÁLÓZATOK ugyanazt a fájlt több hoston szolgálják ki (hotels-in-hungary.net = lake-balaton.com, www/nem-www;
mérve 2026-10-04: 9 lead, 145 duplikátum-pár, „129 kép” 59 valódi helyett). Az azonosság kulcsa az ÚTVONAL, host és
query nélkül (`portalPhotoIdentity`, `src/scraper/portalPhotos.ts`; 8 karakternél rövidebb útvonalnál marad a host) —
EGY szabály minden számlálóra és a mock galériájára. Más útvonalú újraközlésre (portálok egymás képeit veszik át) a
tartalmi azonosság a 64 bites dHash (`src/generator/photoHash.ts`, `src/engine/samePicture.ts`; mérve: másolat ~4 bit,
kivágás ~18, más fotó 27–40).
<!-- distill:end -->


<!-- distill:begin f712be1beb16c493 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Adatmodell-gotcha: „ugyanaz a duplikátum-jel NÉGY különböző valóságot takar"
> **Forrás-memória:** feedback_twin_leads_merge_without_asking.md
> **Review:** `_inbox/20261011T020001Z.md` (50. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

⚠️ **Ötödik valóság — a közös jel a MI hibánk:** két lead egyező e-mailje/telefonja ugyanarról a `own_site` forrású honlapról származhat, mert az egyik leadhez TÉVESEN rendeltünk honlapot (mérve 2026-10-08: Mohács ↔ Fadd, más város, más telefon, a Mohács-lead e-mailje a faddi honlapról). Ez nem iker és nem `same_owner`, hanem rossz presence-találat ([03-INVARIANTS] §F.14). Összevonás ELŐTT: ha a város és a telefon eltér, és az egyező kontakt egy honlapról jön → nincs összevonás, a honlap-hozzárendelést kell javítani.
<!-- distill:end -->


## Tervezett entitások (még nincs kód)
> ⚠️ A `Tenant` és a `Booking` KIKERÜLT innen: mindkettő realizált (`tenant`/`site`/
> `module_entitlement`/`subscription`, illetve `booking_request`/`availability_day`) — lásd a
> realizált láncot fent.
- **Vertical** — vertikum (szállás / étterem) → sablon-készlet + entitás-bővítés (étteremnél Menu/MenuItem). Ma csak `lead.industry` (szabad szöveg) létezik, önálló entitás nincs.
- **OutreachCampaign** — megkeresés + leiratkozás-állapot (GDPR). Ma nincs kampány-entitás: a megkeresés a `prospect` csatorna-pecsétjein (`sent_at`/`email_sent_at`/`sms_sent_at`/`mms_sent_at`) és a `prospect_optout_log`-on keresztül él.
- **Data-plane asset-tábla** — a kép-provenance ma a pillanatkép-adaton utazik (`Photo.provenance` a `SiteData`-ban), nem önálló entitásként. Amíg nincs, minden provenance-szabályt a négy render-úton kell érvényesíteni (lásd a propagációs szekciót).

> TODO: étterem-vertikum entitásai (Menu, MenuItem, OpeningHours, Reservation).


<!-- distill:begin 6a65ab627e579829 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** (új gotcha) Modul-konfig mentése
> **Forrás-memória:** 2026-10-13_ellatas_es_felarak.md
> **Review:** `_inbox/20261019T060001Z.md` (131. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

- **Az általános modul-mentés (`setSiteModuleConfig`) CSAK a posztolt mezőket tárolja.** Egy saját
  szerkesztővel írt kulcsot (pl. `meals`, `priceIncludes`) egy másik űrlap mentése (pl. pénznem)
  némán törölne. Ezért a modul-definíció `editorKeys`-ben sorolja fel ezeket (`src/moduleConfig.ts`),
  és az általános mentés megkíméli őket. Új bespoke kulcs = `editorKeys` bejegyzés.
<!-- distill:end -->


<!-- distill:begin e97728fe9316f5f3 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** Realizált konverziós & pénzügyi lánc (gotcha)
> **Forrás-memória:** 2026-10-11_elek_it_javitasok_opsuti_xss_fizetes.md, 2026-10-14_teszt3_javito_szal.md, 2026-10-14_elek_szallasado_fizetes.md
> **Review:** `_inbox/20261019T060001Z.md` (117. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

- **A `payment` `failed`/`cancelled` VÉGÁLLAPOT.** Egy utólag érkező „paid” jelzés nem aktivál,
  hanem naplósort + `paid-after-end-state` ház-riasztást ad (`src/payment/service.ts`). A lezárt
  fizetésen az újrapróba ÚJ fizetést nyit ugyanarra a rendelésre.
- **A fizetés-visszaigazolás nem a számlán múlik.** A számla-levél bukásakor (pl. Számlázz error 136,
  lejárt fiók) a vevő akkor is írásos visszaigazolást kap; ugyanígy jár levél a lemondásról, a
  visszalépésről és a kártyás megbízás visszavonásáról is (tartós adathordozó).
- **Lemondott előfizetés (`cancel_at_period_end`)** a fordulónapon terhelés nélkül zárul, és rá nem
  megy T−3 előértesítő, nem keletkezik megújítási rendelés (`src/payment/billing.ts`). Minden
  számlázási felület „zárul, nem terhelünk”-et mond.
<!-- distill:end -->


<!-- distill:begin 2350baa8813ec668 20261019T060329Z -->
### ⏳ Desztillált javaslat — ELHELYEZÉSRE VÁR (20261019T060329Z)
> **Kért hely a review szerint:** (új szakasz) Portál-naptárszinkron (iCal) gotchái
> **Forrás-memória:** 2026-10-12_portal_ical_valodi_mintak.md, 2026-10-11_portal_szinkron_elek_javitasok.md, 2026-10-11_portal_naptarszinkron_ical.md
> **Review:** `_inbox/20261019T060001Z.md` (99. sor)
> A gép a SZAKASZ végére tette; a pont-szintű helyet ember dönti el. Elfogadás = a keret-kommentek és ez az idézet-blokk törlése.

## Portál-naptárszinkron (iCal) — adatmodell-gotchák (ADR-0361/0367/0371)
- **Napra kulcsolunk, nem UID-re.** A régi Airbnb-export minden letöltésnél új UID-t ad; a
  foglalás és a kézi zárás egyik portálon sem különböztethető meg biztosan. Kimenetben stabil UID.
- **Sikertelen vagy csonka letöltés NEM felszabadítás:** a link legutóbbi éjszaka-halmaza a
  következő SIKERES letöltésig érvényben marad (`src/booking/sync.ts`). A „lemondás” = az esemény
  eltűnése egy sikeres feedből.
- **Nálunk elfogadott éjszakát a szinkron nem töröl:** ütközésnél `calendar_conflict` napló + egyszeri
  tulaj-levél.
- **Export:** csak `VALUE=DATE` (az Airbnb az időpontos eseményt elutasítja), a szállás időzónájában;
  az üres naptár helyőrző eseményt kap (az Airbnb az üres linket elutasítja); a portálonkénti export
  kihagyja az attól a portáltól jött éjszakákat (echo-védelem). A link a TENANT-hoszton él
  (`/naptar/<token>.ics`), `.ics`-re végződik.
- Szállás.hu-mintánk nincs (nincs nyilvános minta), a portálok saját importja nincs igazolva.
<!-- distill:end -->

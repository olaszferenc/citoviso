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

## Tervezett entitások (még nincs kód)
> ⚠️ A `Tenant` és a `Booking` KIKERÜLT innen: mindkettő realizált (`tenant`/`site`/
> `module_entitlement`/`subscription`, illetve `booking_request`/`availability_day`) — lásd a
> realizált láncot fent.
- **Vertical** — vertikum (szállás / étterem) → sablon-készlet + entitás-bővítés (étteremnél Menu/MenuItem). Ma csak `lead.industry` (szabad szöveg) létezik, önálló entitás nincs.
- **OutreachCampaign** — megkeresés + leiratkozás-állapot (GDPR). Ma nincs kampány-entitás: a megkeresés a `prospect` csatorna-pecsétjein (`sent_at`/`email_sent_at`/`sms_sent_at`/`mms_sent_at`) és a `prospect_optout_log`-on keresztül él.
- **Data-plane asset-tábla** — a kép-provenance ma a pillanatkép-adaton utazik (`Photo.provenance` a `SiteData`-ban), nem önálló entitásként. Amíg nincs, minden provenance-szabályt a négy render-úton kell érvényesíteni (lásd a propagációs szekciót).

> TODO: étterem-vertikum entitásai (Menu, MenuItem, OpeningHours, Reservation).

# MEMORY — Citoviso
Utolsó frissítés: 2026-08-21

## Aktív feladat
**2026-08-21 — 💳 A FIZETÉS UTÁNI ÚT: 404-TŐL A MEGNYITHATÓ OLDALIG. LOKÁLBAN KÉSZ, PUSHOLVA.**
- **Kiváltó (tulaj, éles Barion sandbox teszt-vásárlás):** „A Barion fizetésig sikeres volt minden.
  Sikeres fizetés után oldal nem található felületre küldött. […] nincs értesítés a további
  teendőről. Ettől a vevő tuti idegösszeomlást kapna…" Majd: „NEM AKTIVÁLÓDOTT AZ OLDAL."
- **EGY teszt-vásárlás NÉGY hibát tárt fel:**
  ① ⛔ **`GET /pay/done` route NEM LÉTEZETT** — a Barion `RedirectUrl` oda küldi a fizető vevőt,
    aki 404-et kapott. A vevő-tájékoztató lap (`payResultPage`) KÉSZ volt, csak a MOCK gateway útja
    hívta. **Alatta a súlyosabb:** lokálban a szerver-oldali callback el sem éri a gépet → a payment
    `pending`-ben ragadt, az **aktiválás/belépési e-mail/számla SOSEM futott volna le**. Fix: a
    `/pay/done` ugyanazon az **idempotens** `handleWebhook` úton (Barion `GetPaymentState`) oldja fel
    az állapotot → sandbox-teszttel végigjátszva: `paid`, site `live`, e-mail + számla kiment.
  ② ⛔⛔ **Ismeretlen `<slug>.citoviso.com` a MARKETING LANDINGET adta 200-zal** (élesen bizonyítva:
    `nemletezooooo.citoviso.com` → 200 + a honlapunk). A frissen fizetett tulaj a saját linkjén a mi
    honlapunkat látta; és bármennyi kitalált aldomain azonos tartalmat adott = **duplikált tartalom a
    teljes `*.citoviso.com` hálózaton** (ADR-0041 reputációs kockázat) → most **404**.
  ③ A vevő sehol nem látta, hogy a **fizetés** sikeres (csak „Köszönjük, kész!") → explicit sor a
    terhelt összeggel, mindkét ágon.
  ④ A `PLATFORM_DOMAIN` fordítási idejű konstans → minden lokál teszt **PROD URL-t** hirdetett, ami
    elvileg sem nyílt meg → `tenantSiteUrl()` + dev-only `/t/<slug>`. **Prodon SOHA nem él** (ott
    második, canonicallal versengő cím lenne = ugyanaz a ②-es hiba) — prod-konfiggal ténylegesen
    lefuttatva verifikálva.
- **Mellék-lelet:** a lokál `.env`-ből hiányzott az `EMAIL_PROVIDER`/`SMTP_URL` → a `mock` adapter
  **fájlba írta** a leveleket (a tulaj ezért nem kapott semmit; prodon a Zoho rég működik).
  ⚠️ Átmásolva → **a lokál gép mostantól VALÓDI levelet küld** (outreach-teszt előtt gondolni rá).
- ⭐ **MÓDSZERTAN: a mock-út teljessége elfedte az éles út hiányát** (mock pay-page ✓ / Barion-
  visszatérés ✗ · mock e-mail ✓ / valódi SMTP ✗ · lokál tenant ✓ / a hirdetett URL ✗). `tsc` és mind
  a 12 pre-commit kapu ZÖLD volt — a hibát a tulaj ELSŐ valódi teszt-vásárlása fogta meg.
- **Következő:** ⚠️ **éles deploy NEM történt meg** (a prod fa több szálnyival le van maradva; a
  fájl-szintű deploy indításkor megölné a konzolt — koordinált utó-deploy kell, ld. lent).
  BACKLOG: végponttól-végpontig konverziós füst-teszt, ami a gateway-VISSZATÉRÉST is végigjátssza.
  Részletek: `_planning/memory/2026-08-21_payment_return_and_tenant_host.md`.

## Nyitott — infrastruktúra (2026-08-22, mérve)
**A párhuzamos sessionök csendben veszítenek munkát. Mérve, nem sejtve:**
- 16 worktree él; a GitHubon **összesen 1 db `wt/*` ág** volt fent → a záró `push` a legtöbb
  sessionben **soha nem történt meg** (a `main` percenként mozog → non-fast-forward → csendes bukás).
  Egy éles **DKIM-hibajavítás** (a kimenő levelek aláírása) egy halott sessionben ült; megmentve
  (`9c121d2`). Hátra: `a5a21b7` (dev-only `/t/<slug>`), és a fő fa 4 pusholatlan commitja.
- **A „tesztkörnyezet" egy véletlen worktree-ből futott** (`cit2167c7de`), nem a `main`-ből → ez a
  „productionben megvan, teszten nincs" élmény valódi oka.
- **Az éles nem verzió, hanem kollázs:** 20 fájl soha nem ment ki, 47 eltér, a kint lévők 8
  különböző dátumból valók → olyan kombináció fut, ami egyetlen commitban sem létezett. Kézi
  élesi szerkesztés viszont NINCS (0 fájl van kint, ami ne lenne a gitben). → **ADR-0051**.
- ⚠️ **A commit-szám és a `git cherry` HAZUDIK** (rebase → új SHA/patch-id); a 9 „beragadt"
  commitból tartalmi ellenőrzés után **1** maradt. Csak szemantikus ellenőrzés mond igazat.

- **AZ IZOLÁCIÓ FÉLKÉSZ (ADR-0052).** A worktree-pool a KÓDOT izolálta, de minden fa ugyanoda mutat:
  `sites/`, `node_modules`, `.env` symlink a fő fába, és **egyetlen közös Postgres**. A DB
  **megőrzi a hatást, a kód nem**: egy szál migrációt futtat és adatot ír, a fája eltűnik, az adat
  marad → a teszten úgy LÁTSZIK, hogy egy funkció működik, pedig a kódja sehol nincs (és fordítva).
- **Miért nem jelentkezett ez a MineREAL-ban:** ott a tulaj a SOROSÍTÓ — egy szál, egy feladat, és
  ő maga látja a `git push` kimenetét. Itt tíz szál fut, és egy asszisztens ÖSSZEFOGLALÓT ad a nyers
  hiba helyett. Nem a munkamódszer rossz; a párhuzamosság + delegálás vitte át azokat a lépéseket,
  amiket eddig ember figyelt.
- **A fegyelem = doktrína ÉS kapu.** Bizonyíték a saját repóból: az i18n, dizájn-token, modul-konfig
  és tudásbázis-doktrína EGYSZER SEM sérült (mind mögött pre-commit kapu); a „commit + push
  záráskor" és a „csak a módosított fájlok élesre" mögött nem állt semmi — mindkettő elbukott.
  **A leírt szabály emlékeztető; a futó kapu tény.**

**Teendő:** ① **dev DB szálanként** (`CREATE DATABASE citoviso_<slug> TEMPLATE citoviso_dev` — a
`citoviso_dev` mindössze **12 MB**, tehát ~200 MB tizenhat szálra) + saját `sites/` ② `land` script
(fetch → rebase → kapuk → push → **visszaellenőrzés**, hangos bukással) ③ a fő fa legyen integrációs
pont + tesztkörnyezet, ne munkaterület ④ 9 halott worktree lezárása **tartalmi** ellenőrzés után
(⚠️ a commit-szám és a `git cherry` hazudik) ⑤ ADR-0051 implementálása (éles = verzió).

## Előző szál (ugyanaznap)
**2026-08-21 — 🔗 A BACKFILL MEGTALÁLTA A PORTÁL-OLDALAKAT, AZTÁN ELDOBTA ŐKET. ÉLES, 1 NYITOTT HIBÁVAL.**
- **Tulaj kiinduló gyanúja:** „miért nem a teljes linkjét mentjük a portáloldalaknak, ahol megtaláltuk
  a leadet?" — **HAMIS premissza:** a deep-link mindig tárolódott (`PortalListing.url`), a konzol csak
  rövid HOST-felirattal mutatja, de a `href` a teljes URL (éles lead-oldalon ellenőrizve, minden külső
  link konkrét aloldalra megy). ⚠️ Ezt előbb tévesen „hazudik a címke" hibaként adtam el.
- **A valódi baj, ami emiatt előkerült:** prodon 419 leadből **4**-nek volt portál-linkje. Ok kettő:
  ① `reenrich.ts` `changes`-kapuja csak honlap/e-mail/telefon változást számolt → a CSAK portál-linket
  vagy kontakt-naplót kapó lead a `continue`-nál kiesett, a `raw` sosem íródott vissza;
  ② a mailto-regex átfutott a saját markupját escapelő oldal `&quot;&gt;` farkán → törött e-mail
  került volna a leadre (`info@…hu&quot;&gt;info(@)…&lt;/a&gt;`).
- **Éles eredmény:** ugyanaz a 108 lead: 16 → **98** érintett, 0 → **146** elmentett portál-link;
  prod portál-jelenlét **4 → 61 lead, 10 → 159 link** + 149 `listing` provenance-sor. Commit `9e7fd65`,
  2 fájl scp-vel (backup `deploy-20260821-203120`), pre-apply DB-dump `reenrich-20260821-223812`.
- ⛔⛔ **FŐ TANULSÁG: a dry-run NEM kapu a nem-determinisztikus osztályra.** 0 honlap-átminősítést
  mutatott és ezt hoztam garanciának — az `--apply` mégis 1-et csinált (a webes keresés futásonként
  más találatot ad).
- ⚠️ **NYITOTT HIBA (engedélyre vár, élesi írás):** `Muschel Panzió` `portal_only → has_own` lett a
  `hotels-in-hungary.net` white-label aldomain-farmon (hiányzik a `qualify.ts` PORTAL_DOMAINS-ből,
  pedig a `hungaryhotel.net`/`com-hotel.website` már rajta van) → a lead KIESETT a célcsoportból
  „van saját honlapja" címen, holott nincs. Teendő: ① domain felvétele a listára ② a lead
  visszaállítása `no_site`-ra ③ `citoviso-console.service` restart (a mailto-fix a konzol
  „újra-dúsítás" gombjához csak úgy él). Részletek:
  `_planning/memory/2026-08-21_backfill_discarded_portal_links.md`.

## Előző szál (ugyanaznap)

**2026-08-21 — ⭐ KONFIGURÁTOR: nyitott lista, KÖVETHETŐ ÁR, szabad domain-választás (ADR-0051). RÉSZLEGESEN ÉLES.**
- **Tulaj:** a lead a kapott linken lássa alapból nyitva a „testre szabom" részt, és folyamatosan
  kövesse a havi díj alakulását; a rész vizuálisan is térjen el; és adhasson meg SAJÁT domain nevet,
  amit „Ellenőrzés" gombbal nézünk le.
- **Kész:** nyitott tételes lista (a gomb csak összecsukásra), saját akcent-élű doboz
  (`.cit-cfg-custombox`), a láb-összeg nem görgethető el (`flex:0 0 auto`) + minden kapcsolásra
  megdobban és kiírja a különbséget (`−690 Ft/hó`); saját domain + `GET /configure/:id/domain-check`
  (DNS+RDAP, normalizálás, foglalt név sosem választható, szerkesztés érvényteleníti az ítéletet).
- **Őr:** `scripts/configurator-price-check.mts` (1180px + 390px + „régi backend" nézet), **öt**
  szándékos rontással pirosra futtatva; pre-commitba kötve. Mellékesen kiderült, hogy a
  `smoke-configurator-browser` két lépése az info-ikonra kattintott → némán SEMMIT nem mért.
- **Éles:** csak a 2 runtime-fájl ment ki (backup `cfgprice-20260821-202239`, console-restart,
  edge-en böngészővel verifikálva). ⚠️ **A `server.ts` NEM mehetett:** az éles fa ~4 szálnyival le
  van maradva (51 eltérő, 20 hiányzó fájl; a konzol import-gráfjából 10 függőség hiányzik; 29 vs 22
  migráció) — fájl-szintű deploy indításkor megölte volna a konzolt. A domain-ellenőrző mező ezért
  élesen (tudatosan) még nem jelenik meg.
- **Következő:** koordinált utólagos éles deploy (hiányzó fájlok + 7 migráció, a többi szál mai
  munkájával együtt). Részletek: `_planning/memory/2026-08-21_configurator_price_visibility.md`.

## Előző szál (ugyanaznap)

**2026-08-21 — 📸 PORTÁL-FOTÓK: A BEKÖTÉSTŐL A TULAJDONÍTÁSIG (ADR-0050). KÉSZ, FELKÜLDVE.**
- **Kiváltó (tulaj):** „Különböző portálokról miért nem scripeljük le a fotókat? Mennyi mennyiségű
  fotót tudnánk elérni így? Kiválogathatná a legjobbakat a honlapra."
- **A válasz első fele:** MÁR scrape-eltük (adatlaponként akár 60 képet) — csak a `portalProfiles`-t
  **`src/scraper/`-en kívül SEMMI nem olvasta**, így a mock a 6 Places-képből épült.
- **Három láthatatlan hiba alatta, mind zöld `tsc`-vel és zöld pipeline-őrökkel:**
  ① a motor minden képre egységes `provenance: "places"` bélyeget ütött → a **§A élő-kapu fikcióra
  döntött volna** (külön seam-be emelve, mert a blanket literál tökéletesen fordul);
  ② ⛔ **a mentés visszagörgetett EGY TELJES FUTÁST** — nyers URL a `matched_entity` JSONB oszlopba
  → `22P02`, és mivel egy scrape **egy tranzakcióban** megy, **mind az 554 lead** elveszett.
  **Ez magyarázza, miért nem volt SOHA portál-adat a DB-ben.** A crawl mégis megmaradt: a
  **JSON-dump a mentés ELŐTT íródik** → `seed-from-json` visszajátszotta, 0 Ft többletköltséggel;
  ③ a **`watermarked` jelölés eltűnt a tulaj első kattintására** (mind a 3 szerkesztő-út emlékezett
  a provenance-ra, és mind elfelejtette a vízjelet) — **látens hiba, ami a KÖVETKEZŐ szeletre várt**.
- **⭐ A VALÓDI baj: a kinyert képek fele nem a szállásé.** Az első éles merítés (Balaton északi part,
  554 lead, 607 portál-fotó) szerint **8 leadből 2 téves hero-t kapott volna**: a Köveskáli
  Diákkempingnek egy falusi **TEMPLOM** (utazási cikkből), a Landhaus Dörgicsének régió-stock a
  Booking `/images/city/` útvonaláról. **§B.17-sértés:** a mock azt mondja „ez a te helyed", és mást
  mutat. Mellettük zászló-ikon (32×22), hirdetés-bannerek, Pinterest megosztó-linkek (nem is képek),
  térkép-grafikák, 150×150 bélyegképek.
- **Tulaj-döntés:** a FORRÁST nem szűkítjük (airbnb/booking/szallaskereso valódi galériát ad, csak
  nincs még a registryben) — **méret + URL-alak** szerint szűrünk, **800px** hosszabb éllel.
- **A küszöbök MÉRVE, nem tippelve:** a bannerek mind 980×240 (**4,08:1**), a legszélesebb VALÓDI
  fotó egy medencés vendégház 980×360 (**2,72:1**) → a szalag-határ **3,0**, nem 2,5 (az levágta
  volna). A méret a fájl **FEJLÉCÉBŐL** jön (Range-kérés, 64 KB), mert 607-ből csak **8**-nak volt
  tárolt mérete. Amit nem lehet lemérni, azt megtartjuk. **Nem törlünk, olvasáskor ítélünk.**
- **Eredmény: 607 → 169 tulajdonítható kép.** Mindkét téves hero megszűnt (az a két lead inkább
  0 portál-fotót kap és Street View-ra esik vissza — ez az őszinte kimenet). 9 lead hero-ja
  szemrevételezve: mind valódi épület/belső/medence. Ahol van igazolt adatlap, **átlag ~29 kép**.
- **⭐ A vízjel-detektort NEM építettük meg** (pedig a listán ez volt a következő): 24 valós képen
  **egyetlen vízjel sincs** — nem létező problémára nem költünk képenkénti vision-hívást. A §A.2
  attól még érvényes, és a jelölés útja immár készen áll.
- **Mellék-lelet:** a portál-képek Cloudflare mögül **blokkolják az Anthropic letöltőjét** → a brief
  és a copywriter némán generikusra esett („Unable to download the file"). Fix: `toImageBlocks`,
  mi töltjük le és base64-ben ágyazzuk be (3 hívóhely).
- **⛔⛔ MÓDSZERTAN:** ezen a szálon **HÁROMSZOR hazudott zöldet a saját őröm** — (a) a mérés nem ért
  el a `generateEngine` mappingjéig, (b) egy `?? BASE.photos` fallback zöldet adott NO-OP
  szerkesztésekre, (c) az őr szemetet hagyott a repóban. **Minden őrt pirosra futtatni ÉS
  ellenőrizni, hogy a rontás tényleg megtörtént.** A `photo-quality-check` ezért **mindkét irányban**
  mér: lazításra 3 eset pirosodik, a TÚL szigorú 2,5-ös aránynál a valódi Lavia-fotó bukik el.
- **⚠️ Saját csapda:** kétszer **csonkolt URL-t** diagnosztizáltam (a saját `.slice(0,105)`
  kiírásomat), és ebből hamis „404 / 401" következtetést vontam le. A rövidített diagnosztikai
  kiírás ne kerüljön a bizonyítékok közé.
- **Kapuk (mind piros-tesztelve, pre-commitban):** `portal-photo-check`, `persist-portal-check`
  (valódi DB round-trip), `photo-quality-check` (14 valós url+méret eset), `photo-rights-edit-check`.
  Egyszeri: `backfill-portal-photo-size` (577 kép lemérve).
- 7 commit felküldve (`d64e57a`…`cccf65a`). Részletek:
  `_planning/memory/2026-08-21_portal_photos_attribution.md`.

## Korábbi szál (ugyanaznap)
**2026-08-21 — ⭐⭐ MODULOK: A VÉLEMÉNY, A HELY ÉS AZ EGY FOLYAMAT (ADR-0046/47/48/49). KÉSZ, FELKÜLDVE.**
- **① `reviews` (ADR-0046):** a gerinc a FIRST-PARTY vélemény (`site_review`, moderáció a booking
  mintájára: a tulaj a LEVÉLBŐL dönt egy koppintással). A Google-ból **csak a SZÁM** jön át — két
  szabály együtt zárja be a szöveget: tárolni tilos (a Places egyetlen korlátlan mezője a `place_id`,
  a mi oldalunk statikus snapshot) **és** futásidőben ~9 Ft/hívás → a 690 Ft/hó-s modul ~77
  oldalletöltés után veszteséges. A szám viszont TÉNY, és a resolve eddig is lekérte, majd eldobta.
  Két kapu, mindkettő zárva bukik: `match_confidence ≥ 0.7` + 30 nap frissesség. Csillagos rich
  resultot NEM ígérünk. A Google-invitálás iránya MEGFORDÍTVA: a nálunk író TÁVOZÓ vendéget hívjuk.
- **② ⛔ A tulaj élő `/configure/` linken kapta el: „egy csíkba, bal oldalt, van az összes modul"**
  (ADR-0047). Három hiba egymáson, és MINDEN meglévő őr zöld volt mindhármon: (a) a konfigurátor a
  `querySelector("footer")` elé injektált, de **12/16 sablon `<footer>`-rel jelöli a vélemény-idézet
  szerzőjét** → a teljes kínálat egy idézet-kártyába préselve, **230–530px**; (b) a minták csak a
  panel első megnyitásakor jelentek meg → **a lead 0 modult látott**; (c) a 10 blokk egy tömbben az
  enquiry elé ment — az `editorial`-on az a lap TETEJE, tehát **élő tenant-oldalon is** a galéria és
  a vélemények ELÉ ömlött. Fix: **négy megnevezett slot** sablononként (`showcase/trust/practical/
  closing`); a blokk-KÓD közös marad (nincs 100×N), csak a HELYE sablon-specifikus.
- **③ Egy oldal, EGY folyamat (ADR-0048):** a „ha van foglalás, nincs érdeklődés" eddig csak a SLOT-ra
  állt — **26 beégetett felirat 13 fájlban** maradt „Érdeklődés", a foglalás bekapcsolása egyetlen
  gombot sem cserélt. A CTA-szó most adatból jön (`ctaLabel`). + **`SAMPLE_REVIEWS` KIVEZETVE**:
  kitalált idézetek („Péter", „a Kovács család") valós cég oldalán, a valós Google-átlaga alatt —
  úgy olvasódott, mintha a 143-ból mutatnánk hármat. Helyette a valós szám + őszinte mondat.
- **④ Kiadási időszak (ADR-0049):** „milyen időszakokban adja ki egyáltalán, milyen minimum hány
  napra?" A szezon MÁR létezett (`unit_price`, MM-DD, egységenként) → **nem csináltunk második
  listát**: a sor hordozza az árat, a min. éjszakát és (a `seasonal_only` kapcsolón át) hogy
  kiadható-e. Éjszakánként vizsgálunk (a kilógó foglalás sem csúszik át), és a zárt nap a vendég
  naptárában is foglalt — nem elég beküldéskor nemet mondani.
- **Kapuk:** új `review-flow-check` (24), `module-slot-check`, `configurator-placement-check`,
  `shot-review-form` (390px); bővítve `module-render-check` (kitalált vélemény 0/16 sablon + 0/11
  archetípus) és `module-config-check` (+9 szezon-ellenőrzés). Mind pirosra futtatva.
- **⭐ MÓDSZERTAN (ez a szál fő hozadéka):** *a jelenlét nem elrendezés* — minden őr azt kérdezte,
  „ott van-e a tartalom?", egyik sem azt, hogy „HOL, és milyen SZÉLES?"; *a rontást is ellenőrizni
  kell* (kétszer maradt zöld egy piros-teszt, mert a minta nem illeszkedett — nem volt rontás);
  *a mérés is elavulhat* (a slot-lefedettség renderelt oldalon nézte a jelölőket, és a KÓD volt jó);
  *féloldalas fix + féloldalas őr = zöld hazugság* (a 16 sablon javítva, a 11 archetípus fabrikált).
- **Mellék-leletek:** `POST /api/hirlevel` **NEM LÉTEZIK** (a hírlevél-űrlap a semmibe küld);
  az `extract-i18n` sosem olvasta a `moduleSections.ts`-t → minden modul-felirat kiesett a
  katalógusból (312 → 346, javítva).
- Migrációk: `0027_reviews.sql`, `0028_unit_season.sql`. 4 commit felküldve (`0153a67`…`c8cbd69`).
  Részletek: `_planning/memory/2026-08-21_modules_placement_and_reviews.md`.
**2026-08-21 — 📚 TUDÁSBÁZIS-DOKTRÍNA (ADR-0045 ①–④). KÉSZ, PUSHOLVA.**
- **Tulaj-rendelet:** IT-kezdő célközönség → súgó print screenekkel, doktrína+őr, UI-ba építve,
  kereshetően; új entry AUTOMATIKUSAN forduljon minden nyelvre; új régió csomagja a KB-t is vigye.
- **Kész:** 03-INVARIANTS **§J** + 9 entry (5 admin-fül + 4 modul-képernyő) script-generált 390px
  screenshotokkal · kereshető **Súgó** fül + `data-kb-anchor`/súgó-belépő minden szekción ·
  AUTOMATA hurok: `kb-scan.mjs` PostToolUse + pre-commit `kb-check --coverage` + LABEL-DRIFT
  (**„félkövér-idézett”** felirat szó szerint kell a view-forrásban) · `kb_translation` (0027) az
  `ensureLanguagePack`-be kötve → scrape/generate/boot/CLI mind fedi; lengyel KB 9/9 ÉLES ·
  `tudasbazis-or` agent. Minden őr pirosra tesztelve; a hook élesben 2 valós hibát fogott.
- **Következő jelöltek:** operátor-konzol súgó-rétege (audience: operator) VAGY B) outreach
  küldő-pipeline. Részletek: `_planning/memory/2026-08-21_knowledge_base_doctrine.md` + ADR-0045/a–d.


## Előző szál (ugyanaznap)
**2026-08-20/21 (Brave-szál) — 📇 KONTAKT-NAPLÓ + PORTÁL-JELENLÉT + DUPLIKÁTUM-ELLENŐRZÉS. ÉLESEN KÉSZ.**
- **Kiváltó:** a tulaj ÉLES tesztjei a Brave-élesítés után — minden pont alatt egy konkrét lead,
  amin a rendszer megbukott (Ferenc Ház, Bánó Porta, Bánó Gábor).
- ⭐ **KONTAKT-NAPLÓ (tulaj-kérés):** minden talált elérhetőség MEGMARAD — érték + forrás
  (places/osm/own_site/web_snippet/a beolvasott oldal hosztja) + nyitható forrás-URL + elfogadva/
  **elvetve + INDOK magyarul** + első észlelés. Eddig EGY címet választottunk és a többit némán
  eldobtuk → nem lehetett megkülönböztetni a „nincs adat"-ot a „a jót dobtuk el"-től. **A rangsor
  szabályait a valós kiküldés-eredményekből** állítjuk majd fel, nem mai találgatásból.
- **Tulaj-tesztek leletei:** ① Ferenc Ház — a Brave MEGTALÁLTA (1. találat kali.hu, a cím a 4–5.
  snippetben), de a tárolt portál-cím BLOKKOLTA a keresést + csak snippetet olvastunk → most
  **oldal-beolvasás** (top 3, mailto:/tel: elsőbbség); ② Bánó Porta — 404-es honlap ≠ elérhető lead
  → **a kiváltó a HIÁNYZÓ CÍM, nem a honlap-státusz**; ③ Bánó Gábor — a kézi újragyűjtés `force=true`
  (a takarékosság a tömeges scrape-é; kézi kérésnél a BIZONYÍTÉK kell).
- **DIGITÁLIS LÁBNYOM:** a portál-adatlapok linkkel a kártyán („ellenőrizve" jellel, amit beolvastunk)
  — kurátori ellenőrzés + leggazdagabb ingyenes adatforrás + maga az outreach-érv.
- **DUPLIKÁTUM-ELLENŐRZÉS (0022 `lead_link`, új konzol-menü):** ugyanaz a jel NÉGY valóságot takar
  (egy üzlet két néven · egy szálloda 6 épülete · egy tulaj több üzlete · lánc közös honlappal) →
  **a gép javasol, az ember dönt** (duplicate/same_owner/unrelated), csoportonként EGY döntés,
  a döntés megjegyződik. Az „ugyanaz" a megtartottba OLVASZTJA a másik naplóját+listingjeit; a
  vesztes disqualified = VISSZAVONHATÓ. ⚠️ Tranzitivitás-csapda: egy közös ügynökségi honlap 34 km-re
  lévő apartmanokat láncolt egybe → csak ERŐS él klaszterez. Élesen: 20 csoport.
- **Adat-takarítás élesen:** 9 sablon-/intézményi cím törölve; **9 lead visszakerült a célzásba**
  (portál-URL `modern`-ként ült = néma vevő-vesztés, a §F bug FALS NEGATÍV iránya).
- **UI:** galéria (fotó+sablon, nyilakkal, görgethető) · ⭐ **CSS-SPECIFICITÁS csapda** (`.con form`
  erősebb az önálló osztálynál → a flex NÉMÁN vesztett; fejetlen Chromium-méréssel derült ki) ·
  honlap-ikon a BEÍRT címet nyitja · a Places bejelöli magát a Források közé.
- ⭐ **FŐ TANULSÁG:** minden beépített őr ZÖLD volt a rossz kimeneten; a hibákat a tulaj tesztje vagy
  utólagos mintavétel fogta meg. A visszatérő minta: **a szűrőim némán zárták le a keresést.**
  A védelem nem a szigorúbb szabály, hanem a **LÁTHATÓSÁG**.
- Részletek: `_planning/memory/2026-08-21_contact_ledger_and_duplicates.md`

## Előző szál (ugyanaznap)
**2026-08-21 — 🔄 „A TESZT HÁTRÉBB VAN, MINT A PROD" — ÁLLÓ DEV-SZERVER INCIDENS + ÖNJAVÍTÓ INFRA. KÉSZ.**
- **Kiváltó (tulaj, jogos dühvel):** a lokál konzolon nem voltak kinézet-kártyák, alig volt sablon —
  miközben a prod frissebbnek tűnt. **Ok:** a :4600 konzol-processz aug 20. 12:37 óta futott
  újraindítás nélkül, a `tsx` nem hot-reloadol → a felület **~30 commitnyi** friss main-t nem látott
  (köztük a kártyarács `7dbfcd6` + a 16 sablon). A git rendben volt; a KÓD mind ott volt.
- **Fix (repo-n KÍVÜLI infra, systemd):** `citoviso-console.service` (:4600) + `citoviso-public.service`
  (:4800) — `tsx watch` + `Restart=always` + `TimeoutStopSec=10` (a tsx lomha SIGTERM-re, e nélkül
  a restart 90 s-ig ragad), enabled → reboot-álló. Logok: `~/.claude/citoviso-{console,public}.log`.
- ⭐ **tsx-watch HAMIS-ZÖLD lelet (piros-teszt fogta):** a tsx watch szülő túléli a node-GYEREK
  halálát (csak fájlváltozásra respawnol) → a systemd „active"-ot mutat halott port mellett.
  → `citoviso-health.timer` (percenként): a **PORTOT** curl-özi (azt méri, ami számít — HTTP 000 =
  restart). Élesben tesztelve: `kill -9` → **32 mp alatt vissza HTTP 200-zal**.
- Innentől: commit a mainbe = azonnal él a konzolon; crash = 1 percen belül feltámad; reboot = magától.
- **Session-zárásnál talált lelet:** a fő fában egy másik session TELJES ADR-0045 KB-munkája
  commitolatlanul ült → tételes fájllistával commitolva (`feat(kb)`, 38 fájl, minden pre-commit kapu
  zöld) + rebase az origin 2 commitjára (kinézet-kártya fix) konfliktus nélkül.
- Részletek: `_planning/memory/2026-08-21_stale_dev_server_systemd.md`.

## Előző szál (ugyanaznap)
**2026-08-21 — 🖱️ A VÁLASZTÓ, AMI NEM VÁLASZTOTT (kinézet-kártyák). ÉLESEN KÉSZ.**
- **Kiváltó (tulaj, telefonról, éles admin):** „nem tudok mock típust választani mert akkor csak a
  mock nyílik meg nagyban ha rákattintok".
- **Ok:** a kártya képére kötött `onclick="event.preventDefault();citTplGallery(…)"` letiltotta a
  `<label>` aktiválását → a kép (a kártya ~80%-a) CSAK nagyított, sosem választott. Választani
  egyedül a keskeny névsávval lehetett — telefonon eltalálhatatlanul. A választó **létezett,
  látszott, és nem működött.**
- ⭐ **ELV:** az elsődleges művelet kapja a nagy felületet, a másodlagos saját explicit vezérlőt.
  Ha két művelet ugyanazon a pixelen osztozik, az egyik elvész — ne „okos" eseménykezeléssel
  válaszd szét, hanem külön felülettel.
- **Fix:** az egész kártya (kép is) választ; a nagyítás saját sarok-**gombot** kapott
  (`.tpl-card__zoom`, 32×32 tap, `zoom` SVG a közös készletből) — a `<button>` interaktív
  tartalomként nem aktiválja a label-t, így szerkezetileg nem tud ütközni. Kurzor-javítás
  (kártya=pointer, gomb=zoom-in); a régi globális `.tpl-card{cursor:zoom-in}` maga is hazudott.
- **ŐR (viselkedést mér, nem jelölést):** `scripts/template-picker-check.mts` valódi Chromiumban
  RÁKATTINT a kártya képére és állítja: rádió bepipálva · nagyító NEM nyílt · kártya megjelölve ·
  előnézet váltott; majd a zoom-gombra kattint (galéria nyílik, választás megmarad) + tap-méret
  ≥30px. **Desktop + 390px mobil.** `--self-test` a visszatört jelölésen → **10 PIROS** (egy őr,
  ami nem tud pirosra menni, nem őr). Pre-commitba gate-elve (csak ha views.ts / console CSS staged).
- **Éles:** commit `fe6f856` → main → prod scp-deploy (3 fájl, diff-before-deploy: prod pontosan a
  lokál HEAD~1-en volt; `.bak-20260821-162458` rollback; SHA256-egyezés; restart → active, log
  tiszta, `:4600/leads`=303; a kiszolgált CSS tartalmazza a `.tpl-card__zoom`-ot).
- Részletek: `_planning/memory/2026-08-21_template_picker_affordance.md`.

## Előző szál (e-mail hitelesítés)
**2026-08-21 — 📧 E-MAIL HITELESÍTÉS: DKIM MEGJAVÍTVA + DMARC-FIGYELŐ ŐR. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj):** „Google DMARC-jelentés jött, kell ez?" → a jelentés minden rekordja
  `spf=pass` / **`dkim=fail`** volt (5 levél, mind a saját Zoho-IP-ről; spoofing NEM történt).
- **Gyökérok:** a Cloudflare `zmail._domainkey` TXT base64 kulcsának **50. karaktere nagy `I`
  volt a kis `l` helyett** — 216-ból 1. (Két külön RSA-kulcs MINDEN karakterében különbözne →
  csak elgépelés lehet; a böngésző-fontban a két glif azonos.) Emiatt a Zoho `Ellenőrzés` sosem
  ment át → a selector `Ellenőrizetlen` → **a Zoho alá sem írta a kimenő leveleket**.
  A nyers XML árulta el: az `auth_results`-ban EGYÁLTALÁN nem volt `<dkim>` elem.
- **Javítás:** Cloudflare API PATCH az EGY rekordra (tulaj explicit engedélyével, backup
  `_planning/backups/dkim-txt-20260821-194751.json`), terjedés visszamérve 3 resolverről,
  majd Zoho admin → Tartományok → E-mail konfiguráció → DKIM → `Ellenőrzés` + `Állapot` be.
- **Függetlenül igazolva** (port25 verifier, valódi levél a Zoho SMTP-n): `SPF pass` /
  `DKIM pass` / `dmarc=pass` / `iprev pass` + megjelent a `DKIM-Signature: … s=zmail` fejléc.
- **Új őr `scripts/dmarc-report.mts` (`npm run dmarc:check`):** NULLA új dependency (IMAP a
  `node:tls`-en, ZIP `zlib.inflateRaw`-val). A forrásonkénti VERDIKTET méri, nem azt, hogy
  „jött-e jelentés": se SPF se DKIM → exit 1; csak az egyik → WARN (a forwardolt levél elhasal).
  Pirosra is futtatva: `--selftest` 4/4, rossz jelszó/hiányzó config → exit 2 (sosem hazudik OK-ot).
- **⚠️ TANULSÁG:** a küldő-config **a PROD `.env`-ben** van (`/opt/citoviso/app/.env`), nem
  lokálban (lokál = `mock`, és maradjon is). Tévesen állítottam, hogy „nincs sehol", mert csak
  a lokál `.env`-eket néztem. Részletek: `_planning/memory/2026-08-21_email_auth_dkim_fix.md`.
- **Hátra:** SPF `~all`→`-all`, DMARC `p=none`→`p=quarantine`, **domain-bemelegítés** (a domain
  reputációja ~0 — ezért esett spambe a korai, még aláíratlan teszt), `dmarc:check` cronba.

## Előző szál (ugyanaznap)
**2026-08-21 — 📱 MOBIL STICKY FOGLALÓ-DOKK FIX + REGRESSZIÓS KAPU. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj, screenshot):** több mockon a sticky érdeklődés-dokk mobilon az EGÉSZ viewportot
  kitakarta (a magas, függőlegesen tördelt foglaló-form a tetőre pinnelt).
- **Ok:** 2 elem volt `position:sticky;top:0` mobil-guard nélkül: `cinematic .cn-dock` és az
  `immersive-parallax` archetípus `.cit-arch-dock`. (`parallax .t-dock` már védve volt; `cardSidebar
  .bcard` + a sidebar-archetípusok eleve `min-width` desktop-only.)
- **Fix:** `@media(max-width:700px){…position:static}` mindkettőre (a bevált `.t-dock` mintát tükrözve).
  Commit `7d89e3c` → main → **deploy prodra** (rsync 2 fájl `/opt/citoviso/app`-ba + restart).
- **Már publikált oldal javítása:** 1 érintett lead = **Ferenc Ház** (cinematic), amiből ÉLES `site`
  is volt (`ferenc-haz`, has_edits=true). Determinisztikus re-render az `inputs`-ból (mock) +
  `rerenderTenantSnapshot(...,{as:"live"})` (élő, tulaj-szerkesztések megőrizve) — ⛔ AI-tervező
  ÚJRA NEM (bait-and-switch). Drift-kapu: diff a backuphoz = KIZÁRÓLAG a guard-sor. Új memória:
  [[reference_snapshot_rerender_propagation]].
- **Teljes audit:** mind a 46 `sticky`/`fixed` átnézve (16 template + archetípusok + chrome + render-utak)
  — csak a 2 volt bűnös, más nem.
- **REGRESSZIÓS KAPU (commit `710b68c`):** `scripts/mobile-sticky-check.mts` — minden template+archetípust
  390px-en renderel a hidratált (`injectRuntime`) foglaló-formmal; FLAG, ha a formot tartó elem/őse
  sticky|fixed ÉS >40% vh. A HIBÁT méri (nem CSS-szöveget). Fixture-bizonyított (guard nélkül PIROS,
  guarddal ZÖLD). Pre-commitba gate-elve (csak ha engine template/archetypes/render/runtime staged →
  ~10s nem lassít). Dev-idejű kapu → nincs prod-deploy.

## Korábbi szál (2026-08-20)
**2026-08-20 (4. szál) — 🔎 BRAVE SEARCH ÉLESÍTVE + BACKFILL. ÉLESEN KÉSZ.**
- **Kiváltó (tulaj):** „vezessük be a brave apit, most már fontos elem". A kód (ADR-0026) 2026-08-07
  óta készen állt, csak kulcs nem volt; a tulaj megszerezte (free plan: 1 q/s, ~2000/hó).
- **Élesítés + 3 kódhiba élő próbán:** `country=hu` → **HTTP 422** (a Brave-nek NINCS HU piaca →
  `country=ALL&search_lang=hu`); throttle kellett az 1 q/s ellen (a hívók 3 workerrel lőnek);
  a **kontakt-kereső ág a régi CSE-kulcsra volt kapuzva** → tiszta Brave-konfignál (= a prod)
  némán kimaradt volna.
- **ÚJ ESZKÖZ — `npm run reenrich`:** a MEGLÉVŐ állomány újradúsítása. Azért kellett, mert az
  enrichment csak scrape KÖZBEN futott, a perzisztálás pedig csak BESZÚR (az átfedés-dedup a létező
  leadet kihagyja) — a 2026-08-07-i 99 lead sosem látott volna webes keresést. Mellé:
  `reenrich:rollback` és `scripts/scrub-contacts.mts`.
- **ÉLES EREDMÉNY (Keszthely, 111 no_site lead):** **35 lead frissült** — 10 valódi honlap-felfedezés
  (`juhaszfogado.hu`, `stefivendeghaz.hu`, `agnesalmai.hu`, `kapri.hu`, `tulipancamping.hu`, …)
  + 22 email + 15 telefon; plusz 9 régi sablon-/intézményi cím kitakarítva (maradék 0).
- ⭐ **NÉGY korrobációs réteg, mind ÉLES fals pozitívból tanulva** (találatok 40→13→10, valódi egy sem
  esett ki): ① geo-horgony a lead **városára** (ADR-0043, 3. szál) → ② **márka-a-domainben** (a saját
  oldal a cégről van ELNEVEZVE; köznév és FÖLDRAJZI token nem korroborál — „Mária Hotel" ⊂
  `balatonmariafurdo.hu` csapda) → ③ white-label **aldomain-farmok** (`x.hungaryhotel.net`) →
  ④ **megosztott-kontakt őr** (egy telefonszám egy üzleté: a tourinform száma két vendégházhoz is).
- ⛔ **Az ELSŐ éles apply 6-ból 4 rossz honlapot írt** (még a régió-címke horgonnyal) → **teljes,
  determinisztikus visszavonás**, majd újra tisztán. A revert azért volt biztos, mert minden érintett
  `no_site` volt + az eredeti honlap a `presence_check` provenance-sorban megvolt.
- ⭐ **FŐ TANULSÁG (a 3. szállal azonos, két úton egy nap):** a hibát **egyik pipeline-őr sem kapta el**
  — csak az utólagos, kézi mintavétel. Ezért minden lelet **fixture** lett:
  `scripts/geo-verify-check.mts` = 7 geo + **16 márka-domain** eset, mind éles adatból.
- Kapuk: `tsc` ✅ · i18n/design pre-commit ✅ · regressziós kapu ✅ · prod checksum-verifikált deploy.
- Részletek: `_planning/memory/2026-08-20_brave_live_and_backfill.md`

## Párhuzamos szál (ugyanaznap)
**2026-08-20 — 🔑 TULAJ VISSZA-BELÉPÉS (ADR-0042) + SESSION-IZOLÁCIÓ WORKTREE-VEL. Lokálban KÉSZ.**
- **Kiváltó (tulaj):** „élesítés után a tenant nem tudja hol tud adminjába belépni".
- **Lelet:** valós rés — a tenant-hoszt a `/`-on kívül **mindent 404-ezett** (a `/admin` tipp hibára
  futott), a lábléc kredit-csíkja pedig csak a `citoviso.com`-ra mutatott. Egyetlen mutató: a go-live
  e-mail — ami elveszik.
- **KÉSZ (ADR-0042):** `/admin`·`/login` → **302** a tenant-loginra; + **halk** „Tulajdonosi belépés"
  sor a kredit-csík alatt (keret nélkül, hogy annak folytatása legyen — a live oldal közönsége a
  LÁTOGATÓ, egy hangsúlyos gomb az ő konverzióját rontaná). A go-live e-mail marad az elsődleges út.
- ⭐ **SERVE-time injektálás** (`src/server/ownerLogin.ts`, demoFrame-minta): a motor kimenete tiszta
  marad, és a link **soha nem szivároghat outreach-mockra** — ott nincs fiók, egy „belépés" felirat
  hamis ígéret volna (§I). Ára: kívül esik a generálás-idejű i18n-őrön → a boot-self-heal tölti.
- Kapuk: `tsc` ✅ i18n ✅ katalógus ✅ design-token ✅ · füst-teszt ✅ · **390px + 1280px** ✅ ·
  ⚠️ a 302 élő tenant-hoszton NEM futott (kódolvasással ellenőrizve).
- ⚠️ **MUNKAMÓD-LELET:** ~11 session futott EGY fában → a saját munkámat **egy másik session
  `git add .`-elte be** (`44a6d82`, 27 fájl, 4 téma keverve), az ADR egy i18n-commitba. Semmi nem
  veszett el, de a történet kevert. Megoldás leszállítva: **`~/bin/rc-wt.sh`** = sessiononként külön
  git worktree (saját branch + saját portok; a DB abszolút socketen **automatikusan közös**).
  ⛔ **KÖTŐJEL TILOS a worktree-útvonalban** — a watchdog `basename.replace("-","/")`-tel invertál,
  kötőjeles név esetén **rossz fában támasztaná fel a sessiont, csendben**.
- Részletek: `_planning/memory/2026-08-20_tenant_owner_login_and_worktrees.md`

## Előző szál (ugyanaznap)
**2026-08-20 (3. szál) — 🎯 GEO-HORGONY (ADR-0043) + LEAD-ADATKÁRTYA. Lokálban KÉSZ.**
- **Kiváltó (tulaj):** „beírom a két alap lead adatot a keresőbe — Tekergő balatonberény — és azonnal
  találok honlapot, míg a leadnél faszság van” + „forrásnak az OSM van feltüntetve? miért nem lehet
  megnyitni?” + „nincs ország/város, a mentés gomb alatt vicc ahogy kinéz”.
- **Lelet:** a Brave ÉLESBEN futott — a baj a **horgony**. Sugaras régióban a régió-címke rossz
  horgony egy leadhez, és **ugyanaz a gyökér okozta mindkét irányú hibát**: a Tekergő fals negatívját
  (a valódi oldal sosem írja le, hogy „Keszthely” → eldobtuk) ÉS a keszthelyi backfill 4 fals
  pozitívját (visszavonva). Külön hiba: a `szállás` töltelékszó a foglalóportáloknak adja a top
  helyeket. Harmadik: az OSM `website` tagje rothad (404-es mélylink, miközben a gyökér él).
- **KÉSZ (ADR-0043):** horgony = a lead **városa**, és **HELYETTESÍTI** a régió-tokeneket (az unió a
  fals pozitívokat visszahozná); cím-szöveg tilos horgony (`hungary` 40/56 leadnél). Query:
  `<név> <város> hivatalos oldal`. Törött link → gyökér→webes keresés, **mindkettő geo-igazolva**.
  Források őszinték + nyithatók (a Places bejelöli magát, `sourceRefs` túléli a dedupe-ot).
  Per-lead **újragyűjtés-gomb** lifecycle-őrrel. Lead-kártya újraépítve (ország/város a fejlécben,
  3-oszlopos űrlap, kattintható honlap, fact-grid a 130px-es `dl` helyett).
- ⭐ **FŐ TANULSÁG:** a hibát **egyik pipeline-őr sem kapta el** (verify, portál-katalógus,
  sekély-útvonal, korroboráció mind ZÖLD volt egy rossz eredményen) — csak utólagos emberi
  mintavétel. Ezért determinisztikus fixture-kapu: `scripts/geo-verify-check.mts` (7/7 PASS).
- Bizonyítva: Tekergő 404 → élő, mobilbarát oldal → **nem is lead**; Borbaratok `outdated`→`modern`,
  kép 11→43. Kapuk: `tsc` ✅ design-token ✅ i18n ✅ · 1440px+390px ✅ · **éles DB-re semmi**.
- ⚠️ **Munkamód:** ~11 session futott egy fában → kevert commit (`44a6d82`), amiből **kimaradt a
  reenrich route**, bár a gomb bekerült. Szabály: soha `git add .`; commit után hívó+hívott ellenőrzés.
- Részletek: `_planning/memory/2026-08-20_geo_anchor_and_lead_card.md`

## Előző szál (ugyanaznap)
**2026-08-20 (2. szál) — 🌍 AUTOMATA NYELVI PROVISIONING (ADR-0036 + /b) ÉLES.**
- **Kiváltó (tulaj):** „működik a multilanguage? pl. lengyel leadre?” → nem: minden vevő-felület
  magyarul volt beégetve. Tulaj-irány: **automatizáltan** (a scrape új nyelvterülete magától
  generálja a felületeket), majd **doktrína-szintre** emelni + tracking/deploy-check.
- **KÉSZ + ÉLES:** a nyelv PARAMÉTER (régió `country`→nyelv), nyelvi csomag = egyszeri AI-fordítás
  nyelvenként (`language_pack`, kulcs = a magyar forrás-string), trigger: scrape-indulás +
  mock-generálás + **boot-time self-heal** (deploy+restart feltölti a friss katalógusra).
  `SiteData.lang` perzisztált (mock=live); AI-írók cél-nyelven; 8 sablon `T()`, widgetek `tr()`.
- **§B.18 DOKTRÍNA + HÁRMAS KAPU:** vevő-felirat SOHA nem beégetett — PostToolUse-hook +
  versionált git pre-commit (i18n-lint + katalógus-frissesség + design-token-lint) + kézi lint.
  A kapu élesben is fogott (elavult katalógus → commit elutasítva).
- **§C ORSZÁG-KAPU:** nem-magyar nyelvterületre outreach FLAG az ország JOGI csomagjának
  tulaj-jóváhagyásáig (mock/oldal/konfigurátor szabadon megy). PL csomag él (292 string).
- Bizonyítva: lengyel render PASS, **hu-regresszió 21/21 PASS** (bájtazonos), negatív próba blokkolt.
- Részletek: `_planning/memory/2026-08-20_i18n_doctrine_and_guards.md`

## Előző szál (ugyanaznap)
**2026-08-20 — 🔎 TENANT-OLDAL SEO ALAP (ADR-0041 RÉTEG A) ÉLES + TESZT-KONVERZIÓ PURGE.**
- **Kiváltó (tulaj):** „mennyire SEO-optimalizált a tenantnak adott honlap? + nem érdemes
  folyamatosan frissülő tartalom-modult (helyi programok) kínálni a találatokért?” majd:
  „azt akarom elkerülni, hogy a pilot alatt kikerülő oldalak hátrányt szenvedjenek”.
- **Modell-korrekció (ADR-0041, ELFOGADVA):** a tenant-SEO **URL-TERMELÉS**, nem „tartalom-frissesség”.
  Audit-lelet: a head jó volt (meta/OG/JSON-LD/fázis-robots/alt/lazy), DE **nem volt sitemap/robots
  route** (indexelés belépője nulla), nem volt canonical, a JSON-LD hardcode `LodgingBusiness`+`"HU"`
  (iparág-agnosztikus termékben beégetett vertikum), és a plafon: **a tenant-oldal 1 indexelhető URL**.
- **RÉTEG A = pilot-előfeltétel, KÉSZ + ÉLES (`c660fcd`):** `/robots.txt` + `/sitemap.xml` a
  tenant-hoston; canonical+og:url (live-only, editor.ts injektálja); `seoTitle()` „Név — Város” minta
  mind a 8 render-helyen; iparág-vezérelt JSON-LD `@type` (`SCHEMA_TYPE_BY_INDUSTRY`); NAP-mezők a
  lead facetjeiből; **301 slug→saját domain** (ÚJ szabály az ADR-0020 mellé: enélkül a domain-upsell
  elvinné a felhalmozott rangsor-egyenleget). Verifikálva: tsc+2 lint zöld, motor-füst-teszt mindkét
  fázisban ÉS mindkét render-úton, e2e teszt-tenanttal, prodon diff-before-deploy + 0 hiba.
- **RÉTEG B (aloldalak) + tartalom-modul: POST-PILOT** (később pótolva nulla büntetés). A tulaj
  programajánló-ötlete ELFOGADVA, de **indok-cserével + saját URL-en**; nyers scrape-lista TILOS
  (N tenanton azonos tartalom = scaled content abuse, a `*.citoviso.com` hálózat reputációját viszi)
  → helyette **geo-horgonyzott környezet-modul** a saját POI-vagyonból.
- **PURGE (tulaj: „teszt cucc, töröljünk leadig vissza mindent”):** mentés után (prod + lokál
  `_planning/backups/`, untracked!) tranzakcióban törölve 2 tenant, 2 site, 24 entitlement,
  1 tenant_user, 3 prospect, 4 order_intent, 3 payment, 1 invoice + 2 snapshot. **419 lead megmaradt**
  (lifecycle → `qualified`), 30 mock_artifact érintetlen. Minden fizetés mock → nincs valódi bizonylat.
- **⚠️ NYITOTT, A LEGFONTOSABB:** a purge előtt az egyetlen `live` site **6 db `places`-fotóval** ment
  owner-override nélkül = **§A-sértés élesben**. A site törlésével megszűnt, de az OK nincs kivizsgálva
  (régi site, vagy élő rés az `activate`→`rerenderTenantSnapshot` úton). **Az első valódi go-live előtt
  ellenőrizni!** Továbbá: `custom_domain` beállításához nincs re-render trigger (a canonical nem állna át).
- Jegyzet: `_planning/memory/2026-08-20_seo_layer_a_adr0041.md`.

---

## Korábbi aktív feladat
**2026-08-19/20 — 🌍 LEAD ORSZÁG+VÁROS FACET + KERESZT-RÉGIÓ DEDUP + KRK-TÖRLÉS + KESZTHELY ÚJRA-SCRAPE — MIND ÉLES (ADR-0038/0039/0040).**
- **① Ország/Város szűrő a konzol lead-listáján (ADR-0038, tulaj-kérés):** a RÉGIÓ oszlop
  scrape-terület, nem közigazgatási hely (`scraper_definition.country` fixen HU, `city` null volt) →
  a facet leadenkénti tény lett, a SCRAPE nyeri ki: OSM `addr:*` + Places `addressComponents`
  (field-maskok bővítve, `resolveOne` is), dedupe viszi át, a `raw`-ba perzisztál (NINCS migráció).
  Konzol: 2 új oszlop + colFilter multi-select, üres vödör = „ismeretlen". (`c8d0451`)
- **② Kereszt-futás/kereszt-régió DEDUP (ADR-0039, tulaj kapta el a rést):** a scrape NEM dedupált
  a tárolt leadekhez → újra-scrape duplikált volna, átfedő körök (balaton-north ⊃ badacsony/keszthely)
  ugyanazt a szállást többször hozták volna. Fix az EGYETLEN choke-pointon (`completeScrapeRun`):
  `partitionNewLeads` a teljes store ellen (normalizált név + ~250 m, koord KÖTELEZŐ — távoli azonos
  nevek nem olvadnak össze); diszkvalifikált sem támad fel. Élesben vizsgázott: keszthely újra-scrape
  → pontosan a meglévő 100 dup kihagyva, 319 új beszúrva. (`9d7942d`)
- **③ KRK TÖRÖLVE prodról (tulaj-döntés: régió+1000 lead):** ELŐTTE downstream-csekk (krk: 0 mock/
  prospect/tenant → biztonságos; keszthelyen 2 ÉLŐ TENANT+26 mock lóg → azt NEM töröljük, a dedup véd)
  + teljes pg_dump backup (prod `/var/tmp/` + dev `_backups/citoviso-pre-krk-delete-20260819.sql.gz`).
  Tranzakcióban: 1100→100 lead, tenant/mock érintetlen.
- **④ GARANTÁLT ország-kitöltés (ADR-0040, tulaj-elv: „koordinátából MINDIG kikövetkeztethető"):**
  a keszthelyi friss scrape-ben 419-ből csak 17 kapott országot (OSM-ben ritka az addr:country tag)
  → réteges kitöltés: forrás-tag → per-lead Places-lookup `addressComponents` (0 plusz API-hívás) →
  `enrichGeo.ts` Nominatim reverse-geocode (1 req/s, zoom=10) → régió-ország fallback (Region.country).
  + `scripts/backfill-geo.mts` (roncsolásmentes, idempotens). PROD-BACKFILL LEFUTOTT:
  **419/419 ország ÉS 419/419 város kitöltve** (Hévíz 54 · Keszthely 45 · Kehidakustány 32…). (`2c34d2e`)
- **Éles állapot:** minden deploy scoped rsync + restart, mindkét service `active`; a szűrő élesben
  teljes értékű. Jövőbeli scrape-ből ország nélküli lead szerkezetileg nem születhet.
- **NYITOTT (kurációs tulaj-döntés):** kell-e külön `badacsony`/`keszthely-es-kornyeke` régió, ha a
  `balaton-north` (30 km) földrajzilag lefedi őket? (Dedup miatt már nem duplikál, csak rendezettség.)
- Jegyzet: `_planning/memory/2026-08-19_geo_facets_dedup_krk.md`.

---

## Korábbi aktív feladat
**2026-08-19 (este) — 🎨 KONFIGURÁTOR „LÁSSA, MIT VESZ" JAVÍTÁSOK (tulaj-riport tabletről) — ÉLES (prod-deploy kész).**
- Tulaj-panasz: modul bekapcsolva (pl. Online foglalás), de sehol nem látszik az előnézetben;
  a csomagok tartalma láthatatlan; nincs modul-leírás.
- Javítás (lokál, Playwright-tal 1280px+390px verifikálva):
  ① MINDEN bekapcsolás rágörget az érintett szekcióra (present+minta egyaránt) + akcent-keret
    villantás (`.cit-cfg-flash`, token-témázott, reduced-motion ág van);
  ② preset-kártyán „Mit tartalmaz? (N szekció)" kibontható teljes modul-checklist (✓/✗);
  ③ modul-soron ⓘ ikon → 1 soros leírás (`publicDesc` a katalógusban) + „Megnézem az oldalon"
    ugrás (mobilon a bottom-sheetet összecsukja, a fül visszahozza);
  ④ scrim ≥561px-en 12%-ra halványítva (a 42% fekete elnyelte az előnézetet);
  ⑤ új track-események: `module_info`, `module_see`, `preset_info`.
- Fájlok: `src/modules.ts` (publicDesc mind a 13 modulra), `src/generator/configurator.ts`
  (desc a manifestben), `assets/runtime/cit-configurator.{js,css}`, `src/i18n/catalog.json`
  (3 új kulcs). Őrök: tsc ✅ i18n-lint ✅ design-token-lint ✅.
- **Prod-deploy KÉSZ** (tulaj-engedéllyel, 2026-08-19 este): backup
  `/opt/citoviso/backups/cfgsee-20260819-204606/`, az 5 fájl felmásolva,
  `citoviso-console.service` restart, CF-edge-en verifikálva (marker-grep egy élő
  /p/ oldalon). A verifikációs curl-ok keltette 2 db `mock_view` sort töröltem
  (ne szennyezze a lead-statisztikát). Git: `962ca2f` pusholva.
- **2026-08-20 reggel — „menjen élesre" UTÓ-DEPLOY (tulaj-engedéllyel) + teljes
  lokál↔prod fa-diff.** A konfigurátor már bitre egyezett; a fa-diff KÉT lemaradt
  csomagot talált, mindkettő kiment:
  ① `12d2375` Keszthely dry-run szigorítások — 4 scraper-fájl
    (`enrichSiteSearch/enrichWebSearch/qualify/reenrich.ts`), backup
    `scraper-keszthely-20260820-054742`; restart nem kellett (szerver nem importálja).
  ② az `5ffc81a` ikon/token-refaktor 3 KIMARADT fájlja: `src/server/adminViews.ts`,
    `public/assets/ui/citui-admin.css` (prodon nem is létezett!), `public/assets/home/home.css`;
    backup `uirefactor-rest-20260820-055218`, `citoviso-public.service` restart, origin+edge 200.
  - ⚠️ Tanulság: deploy után `git ls-files src assets scripts public | md5` fa-diff a
    prod ellen — ma ez fogta meg a kimaradt fájlokat. „Csak a módosított fájlok" =
    a commit TELJES fájllistája, ne emlékezetből.
  - ⚠️ CF-cache: a régi `home.css` max ~4 óráig élhet még az edge-en (a CF-token
    DNS-scope-ú, purge-joga nincs — auth error) — TTL-lel magától frissül.
  - ⚠️ Önhiba, elhárítva: smoke-tesztként importáltam prodon a `reenrich.ts`-t, ami
    top-level futtatja a main()-t; időben megöltem + alapból DRY-RUN (DB-írás nem
    történt, legfeljebb pár Brave-query). Szabály: szkript-belépőpontot SOHA ne
    importálj tesztként — a checksum-egyezés az elég verifikáció.
  - Megjegyzés: `_planning/DECISIONS.md`-ben commitolatlan ADR-0041 (SEO, JAVASLAT,
    kód nincs) — másik szál munkája, nem nyúltam hozzá.

---

## Korábbi aktív feladat
**2026-08-19 — 🎨 KONZOL LEAD-OLDAL ÚJRATERVEZVE + KONFIGURÁTOR KÉTLÉPCSŐS — mindkettő ÉLES.**
- **Lead-oldal (konzol):** a 4 egyforma auto-fit kártya HELYETT workflow-first elrendezés:
  azonosító-sáv (név+badge+tény-csík) → desktop 2 oszlop (MUNKA: adat-űrlap→generálás→
  rendelések→mockok | KONTEXTUS: fotók görgethető rácsban→megkeresés→admin) → ≤1100px EGY
  oszlop feladat-prioritás szerint (`display:contents` + `order`, szekció-ID-k `#ls-*`).
  Fájlok: `src/console/views.ts` (leadPage hero+grid), `public/assets/ui/citui-console.css`
  (`.con-lead-head/facts/grid`). Prodra ment (csak a CSS hiányzott — a views már kint volt).
- **Prospect-konfigurátor (ADR-0015 réteg):** ① panel 360→440px; ② KILÓGÓ FÜL a panel szélén
  (collapse: állapot megmarad, fül kandikál; mobil bottom-sheetnél a lap TETEJÉN); ③ KÉTLÉPCSŐS
  láb: 1. modulok+domain+összeg+„Tovább a megrendeléshez" → 2. Havi/Éves + §A nyilatkozat +
  Megrendelem (+„Vissza"). Új track-események: `checkout_step`, `panel_collapse`. Fájlok:
  `assets/runtime/cit-configurator.{css,js}` + `src/i18n/catalog.json` (3 új tr()-kulcs,
  i18n-lint ✅). Prod-deploy: backup `/opt/citoviso/backups/cfg-20260819-105328/` + konzol-restart,
  CF-edge-en verifikálva.
- **🐞 MOBIL KÁRTYA-FEJLÉC FIX (du., tulaj-riport, ÉLES):** a `.con .panel` volt a vízszintes
  görgető → széles táblát (Riport/Leadek) oldalra húzva a fejléc-sáv+szöveg is elgörgött
  (csonka sötét sáv). Fix: táblák saját `.tblwrap`-ben görögnek, a panel `overflow-x:hidden`
  (6 hely a views.ts-ben). Ezzel együtt az IKON/TOKEN-REFAKTOR is prodra ment
  (views+server+icons.ts+citui.css+citui-console.css, backup: `ui-20260819-114800`).
- Lokál teszt-operátor a konzolhoz: `claude-test` (UI-tesztekhez hasznos).
- **Git:** minden pendinget munkaszálanként commitoltunk + push (fizetési kapu-fix,
  konfigurátor, konzol-ikon/token-refaktor, docs). `_backups/` gitignore-ba (DB-dump nem mehet ki).

---

## Korábbi aktív feladat
**2026-08-18 — 🐞 FIZETÉSI FLOW-HIBA JAVÍTVA: jóvá NEM hagyott mockon is lehetett fizetni.**
- **Tünet (tulaj kapta el):** teszt-vásárlás után nem jött belépő-email; a `/pay/.../paid` oldal
  mégis „elküldtük"-öt írt. **Ok:** a mock artifact `generated` (nem `approved`) volt →
  `convertLead` eldobta magát → nincs site/belépő/email; közben payment=paid + mock-számla kiment
  + hamis siker-oldal. (Log: `must be 'approved' to convert (is 'generated')`; `contact_email` is üres volt.)
- **Kód-fix (2 fájl, prodra deployolva `tsx` restart):**
  - `src/payment/service.ts` — `requestPayment` **fulfillment-kapu**: csak `approved` mockra ad
    pay-linket; egyébként `null` + warn → az order rögzül, a kliens „a linket emailben küldjük"-öt
    mutat, az operátor jóváhagyás után újraküld. Egyetlen szerver-oldali choke-point.
  - `src/console/views.ts` — `payResultPage` **őszinte ág**: `!activated` esetén NEM hazudik élő
    oldalt/kiküldött belépőt.
- **Éles takarítás** (a „Panzió" saját teszt): payment→cancelled, order_intent→abandoned,
  mock-számla (MOCK-2026-B1A51C) törölve. Prod backup: `*.bak-20260818` a `src/`-ben (rollback).
- **NYITOTT (döntés kell):** a `handleWebhook` bukott aktiválásnál is számláz — nem-szállított
  szolgáltatásra kiálljon-e számla? Külön eldöntendő.
- Lokál git: 2026-08-19-én commitolva+pusholva (session-zárás).

---

## Korábbi aktív feladat
**2026-08-14→16 — 🐞 SABLON-AUDIT: dopamine matrica-átfedés + dark-luxury szél-levágás — JAVÍTVA, ÉLES.**
- **Tünet (tulaj kapta el az élő sport-udulo.citoviso.com-on):** a dopamine hero lebegő matricája
  („Balaton északi part") belelógott a címsorba — fix `top:%` pozíció a címsor sávjában.
- **Fix (`336fcc3`):** matricák determinisztikusan ütközésmentes horgonyra: fotós hero → a hero-fotó
  felső sarkai (`.t-heroimgwrap`), flat hero → üres alsó sáv; `dark-luxury`: a `.t-heroin{width:100%}`
  felülírta a `t-wrap` szélesség-korlátját → cím a viewport-szélig folyt/levágódott — width törölve.
- **Mind a 7 sablon auditálva** az éles sport-inputokból renderelve (1500px+390px) — a többi 5 tiszta.
- **Éles deploy (scope-olt engedéllyel):** 2 sablonfájl scp → `/opt/citoviso/app`, service-restart,
  sport-udulo snapshot újrarender a kanonikus `rerenderTenantSnapshot`-tal (tulaj-szerkesztés +
  live fotó-politika megőrizve), élő URL-en verifikálva.
- **BACKLOG-ba felírva (tulaj-rendelet): hiba-ticketing rendszer** — beküldés → kurátori jóváhagyás →
  AI-feldolgozás; ⛔ az AI az alap STRUKTURÁLIS kódhoz nem nyúlhat (a mag definíciója külön ADR lesz).
- Tanulság-minta: élesről a `mock_artifact.inputs` (recipe+siteData) kiolvasható és lokálban
  hűen újrarenderelhető → biztonságos éles-hiba-reprodukció mutálás nélkül.

---

## Korábbi aktív feladat
**2026-08-07/08 — ⭐⭐ A TULAJ ELSŐ VALÓS TESZTJE: A–Z lánc önjáró + konzol üzemképes + keresés-backend rendbe.**
- **Az A–Z lánc ÖSSZEÉRT** (a tulaj követelése: „érjen össze minden, triggerelődjön magától"):
  rendelés → **auto pay-link** (`719f215`) → fizetés → webhook → tenant+entitlement+**LIVE site**
  → **auto számla** → **a vevő MEGKAPJA a belépését** (`282fc2e`, eddig sehol nem hívódott!) →
  **`<slug>.citoviso.com`** (`d0d086f`, 0017) → érthető „mi a teendő" képernyő (`4bc841a`).
  E2E prodon mock-gateway-jel, kézi lépés nélkül. Kurátori jóváhagyás szándékosan EMBER.
- **⚠️ FOLYAMAT-TANULSÁG (a tulaj kapta el): a döntés ADR-be megy, nem session-jegyzetbe.**
  A keresés-backend döntés (Brave; a Google CSE „entire web" 2027-01-01-ig kivezetve, Bing halott)
  2026-07-07/11 óta megvolt — de csak jegyzetben, ezért tévedésből a CSE-re építettem.
  → **ADR-0026** + `webSearch.ts` diszpécser (Brave → CSE legacy → HANGOS hiba; csendes degradáció
  TILOS). Időzítés VÁLTOZATLAN: a fizetős search-tail az **automata kurációhoz** kötve.
- **Honlap-felderítés 3 hibája javítva:** a keresés sosem keresett honlapot (`enrichSiteSearch` ÚJ) ·
  a portál-lista naiv substring volt (`danubiushotels.com` ⊂ `hotels.com` → hoszt-alapú lett) ·
  a 403-at csendben nyelte (üres találat = „nincs honlapja" = hitelesség-romboló).
- **Scrape-területek KÖRÖK** (0018+0019): Nominatim címkereső + rádiusz-csúszka + koncentrikus
  gyűrűk; a bbox származtatott, a `run.ts` haversine-nel szűr → tényleg kör. `/scrape` 3 fül
  (Indítás · Térkép · Területek); a Térképen minden lead színezve + a területek körei.
- **Konzol-UX (mind tulaj-visszajelzésből):** kvalifikáció-**badge** (SVG) · lead-oldali
  „Begyűjtött adatok" + **fotók** (igény szerint, Places-költség miatt) · **diszkvalifikálás**
  indokkal (megmarad, újra-scrape sem hozza vissza) · **fejléc-szűrők**: kereshető MULTISELECT
  élő darabszámmal, név-autocomplete, „legalább N" (`b826124`) · a szűrő most azonnal alkalmaz.
- **Prod = main** (0 kódfájl-eltérés), 19 migráció, 100 valós lead (Keszthely és környéke).
  `PAYMENT_GATEWAY=mock` (hogy az A–Z kártya nélkül fusson), `BRAVE_API_KEY` nincs (szándékosan).
- **KÖVETKEZŐ:** a tulaj végigfuttatja az A–Z-t · valós árak + e.v.-adatok (§C-kapu) · éles Barion/
  Számlázz a sandbox-teszt után · ADR-0025 hátralévő minőség-körei (④ interlock → ③ ritmus + ⑥ crop).
- Jegyzet: `_planning/memory/2026-08-07_console_ux_and_search_backend.md`.

---

## Korábbi aktív feladatok
**2026-08-06 (2. blokk) — ⭐⭐ ADR-0025 ①② LEIMPLEMENTÁLVA + KURÁTORI KAPU + PROD PIPELINE-INFRA ÉLESÍTVE.**
- **Styling ①② (commit `4ecc426`):** `RecipeSection.emphasis` (focal|normal|quiet); ① restraint (enforce nem húz
  be kényszer-mintát, max 1 minta-modul), ② pontosan egy focal szekció + minta=quiet; render `data-cit-emphasis`
  + `EMPHASIS_CSS`. Determinisztikus (`scripts/verify-emphasis.ts` PASS), mock=live, dizájn-kapu pass.
- **Kurátori kapu (commit `ec04714`, tulaj-szabály):** kiküldés CSAK ha a mock_artifact `approved` (ember,
  curateArtifact). `sendOutreachMail` + `listSendableProspects` zár; nincs vak auto-send.
- **VALÓS-FEEDBACK PIVOT (tulaj):** ne csiszoljunk vakon; blokkolók után a normál folyamaton át kis valós kör,
  minden mock előtt kurátori jóváhagyás. B3=egységes prod, B2=tulaj állítja az árakat a /pricing-en (kapu verifikált).
- **PROD B3 1–5 KÉSZ+verifikált (deploy-doktrína, current-turn go):** deploy (main→prod ~40 fájl) · Anthropic-kulcs
  már volt · chromium+`CHROMIUM_PATH` · 0016 migráció (16) · **`admin.citoviso.com`** konzol (nginx→:4600, operátor
  `olaszferenc`, login e2e OK). Részletek: [[reference_citoviso_prod_infra]]. Jegyzet: `_planning/memory/2026-08-06_prod_pipeline_golive.md`.
- **KÖVETKEZŐ (6. lépés): a kis valós kör** — tulaj beviszi a valós árakat (/pricing) → scrape prodon → mock (új
  motor) → kuráció admin.citoviso.com-on → kis batch (per-batch külön tulaj-go a hideg küldéshez).

---

**2026-08-06 — ✅ FOTÓ-DERIVÁLT PER-SZÁLLÁS AKCENT (§B.6) KÉSZ (`0dc0f57`) — az utolsó „mind ugyanaz" rés bezárva.**
- A brief eddig is kinyerte a szállás fotóiból a palettát, de az engine-path ELDOBTA → minden azonos-skines
  szállás **byte-ra azonos akcentet** kapott. Mostantól a fotó-hue a skinbe **HARMONIZÁLVA** kerül: a HUE a
  fotóból, a LUMINANCIA a skin akcentjéhez igazítva (WCAG-luminancia bináris kereséssel) → a skin világos/sötét
  karaktere + kontraszt-garanciái sértetlenek (dark-luxury sosem világosodik ki), csak a szín per-szállás egyedi.
- **Determinisztikus → mock=live megmarad** (`SiteData.palette.accent` perzisztált); érvénytelen/kontraszt-bukó
  szín → skin-akcent fallback. Egyetlen token (`--cit-accent`) cserélődik (hoverek color-mix-esek → követik);
  11-token dizájn-kapu PASS. Új: `src/engine/palette.ts`. Verifikáció: 2 lead × 5 art direction, azonos skin +
  más szállás → más akcent, kontraszt ≥6; `tsc` tiszta. Jegyzet: `_planning/memory/2026-08-06_photo_derived_accent.md`.
- ⚠️ Változatlanul nyitva: a 20 art-direction mock **őr-köre** (`tenyhuseg-or` + `dizajn-doktrina-or`) kiküldés előtt kötelező.

---

**2026-08-06 — ⭐ MINŐSÉG-ÍV II. TERV ELFOGADVA (ADR-0025, deliberációs session — még NINCS kód).**
- **Tulaj:** az 5 art direction után is „bedobált szar" az érzés; pilotnak elég, de a globális megkeresésekhez kevés.
- **Diagnózis:** eddig a modulokat (részeket) optimalizáltuk; a „bedobált" érzés a WHOLE tulajdonsága — szekció-közti
  VISZONY + oldal-HIERARCHIA + a konkrét szállásra REAGÁLÁS. **Amatőr hozzáad, profi elhagy és kiemel.** Kód-gyökér:
  a `Recipe`-nek nincs szókincse a súlyra/fókuszra/viszonyra; az AI-brief is csak ezt tölti.
- **Döntés:** bővítsük a `Recipe` szótárát + az AI-briefet (vízióval) — render marad determinisztikus, mock=live/§B.17/§I
  sértetlen (additív opcionális mezők). Az ADR-0019 „(C)" útja: ugyanaz a motor, okosabb brief. NEM új motor.
- **7 levél → mechanizmus:** ①restraint (töltelék-szekció kiesik) ②`emphasis:focal` fókusz-szekció ③ritmus-súly
  ④interlock/bleed (a legerősebb kézműves tell) ⑤fotó-derivált paletta (`palette.accent` mező VAN, `engine/palette.ts`
  NINCS) ⑥`Photo.role` crop-szerepek ⑦narratív copy-ív. Fojtópont: `RECIPE_SCHEMA`+`planRecipe`+render.
- **ELFOGADOTT SORREND (a styling-session ebből indul):** 1) ①restraint+②fókusz együtt · 2) ④interlock ·
  3) ③ritmus+⑤paletta+⑥crop. Mérce változatlan (`reference-quality/`); kiküldés-kapu: tényhűség+dizájn-őr.
- Jegyzet: `_planning/memory/2026-08-06_quality_composition_roadmap.md`. Döntés: `_planning/DECISIONS.md` ADR-0025.

---

**2026-08-05 — ⭐⭐ A MINŐSÉGI PLAFON ÁTTÖRVE: az 5 referencia-mock ART DIRECTION archetípusként (`e0614dd`).**
- **Kiváltó (tulaj):** „rettentőek… mind ugyanaz, csak egymás után dobálva a modulok, ez nagy bukta lesz így",
  „eddig amiatt az egész projekt halálra van ítélve". **A kritika technikailag IGAZ volt:** az archetípus-réteg
  addig CSAK szekció-sorrend/rács volt ugyanabból a vékony blokk-készletből; a dizájn-őr kimérte, hogy két
  `stone-masonry` mock **byte-ra azonos palettát** kapott. NEM regresszió — PLAFON: a mai kimenet strukturálisan
  azonos volt a 07-26-i „sokkal jobb"-nak ítélt mintával (az ADR-0019 a szavakat+mozgást javította, a dizájnt nem).
- **A döntés:** a tulaj 5 jóváhagyott referencia-mockja (`assets/design-refs/reference-quality/`) **TELJES art
  directionként** beportolva. NEM új motor és NEM stratégiaváltás (ADR-0016/0019 érintetlen: kompozíciós motor,
  `mock=live`, §I) — a 07-23 óta írásban álló terv végigvitele („a sokszínűséget optimalizáltuk, nem az alap kraftot").
  **5 art direction:** `fullbleed-glass` · `dark-luxury` · `card-sidebar` · `editorial-press` · `immersive-parallax`.
- **A régi 6 sorsa (tulaj kérdezte: „minden archetípust újra kell gondolni?"):** a régi 5 rács-séma **RETIRED** —
  a tervező nem választhatja, de a registryben MARAD (a perzisztált receptek örökre újra-renderelhetők = mock=live).
  `stacked` = semleges technikai tartalék. Precedens: a 07-16-i korpusz-karantén.
- **Új motor-mechanizmusok** (mind determinisztikus): `Archetype.preferredVariants` (az art direction MAGÁVAL hozza
  a szekció-változatait — nem AI-szeszély) · `navLinks` · `skinAffinity` (sötét kompozíció ne kapjon világos skint) ·
  `retired` · `planner.withArchetype()` · **14 új primitív-variáns** · ÚJ `location` szekció-fajta (térkép+kapcsolat) ·
  ÚJ `alpine-bold` skin · CLI `--archetype=` `--skin=`.
- **⭐ ÚJ ESZKÖZ `scripts/engine-matrix.ts`** (1 lead × N art direction kontakt-lap): az AI-lépések leadenként
  EGYSZER futnak, a többi lap ugyanannak a receptnek a determinisztikus újrarenderelése → **egyben a mock=live
  bizonyítéka** (soronként azonos szöveg/tény/fotó) és ~5× olcsóbb.
- **Elkapott VALÓS hibák:** dupla kártya (a runtime widget saját kerete az archetípus konténerén belül) ·
  olvashatatlan márkanév a parallax navban · akcent-szó akcent-háttéren · **cirill homoglyph az AI-copyban**
  (`fixHomoglyphs`) · halott „Kapcsolat hamarosan" CTA → mailto→tel→disabled létra. ⚠️ **TOOL-hiba, nem mock-hiba:**
  az `engine-shot.ts` nem görget capture előtt → a reveal-tartalom üresnek látszott (a mockok jók voltak).
- **Verifikáció:** 4 kvalifikált lead × 5 art direction = **20 oldal** — dizájn-kapu PASS · round-trip AZONOS ·
  11 token · 0 emoji · minta-jelölés · AI-copy címekben nincs nem-forrásolt szám. `tsc` tiszta.
  **Tulaj a 2. körre: „Oké, ez most meggyőzőbb."**
- **⚠️ KIKÜLDÉS ELŐTT KÖTELEZŐ:** az **őrök ítélet-igényű köre a 20 mockra NEM futott le** (session-limit) —
  a `tenyhuseg-or` + `dizajn-doktrina-or` hívása kötelező (az „Óbester vályogfal"-típusú fabrikációt csak ők fogják el);
  **demo-framing lábléc** (§A.12); **mobil burger-menü** (<900px nincs szekció-nav).
- **KÖVETKEZŐ SZELET (javasolt): fotó-derivált per-szállás paletta (§B.6)** — az utolsó strukturális „mind ugyanaz" rés.
- Párhuzamos szál külön commitban (`e49da11`): **operátor-szerkeszthető árazás** (`src/pricing.ts` + 0016 migráció +
  konzol `/pricing`; a beégetett árak DEFAULT-tá szelídültek, a futásidejű igazság a DB; `PRICING_CONFIRMED` kapu áll).
- Session-jegyzet: `_planning/memory/2026-08-05_reference_art_directions.md`.

---

**2026-08-02/04 — ⭐⭐ ÉLES INFRA FELÁLLT: citoviso.com ÉL + e-mail-infra hitelesítve (ADR-0024).**
- **ADR-0024 (hoszting-döntés):** **Hetzner Cloud CX23** (2 vCPU/4 GB/40 GB, NBG1, €5,49 nettó/hó) —
  fő kritérium a TELJESKÖRŰ API-vezérlés (A1-elv) + óraalapú skálázás; **Cloudflare** (registrar+DNS+
  később for SaaS); tenant-domain-vásárláshoz **INWX** (.hu-t is tud API-ból; trigger: 1. egyedi-domain
  rendelés). Tárigény-becslés valós mérésből: **100 tenant ≈ 2–15 GB** → nem veszünk előre tárat.
  ⚠️ Hetzner 2026-06-15-i áremelés: a CPX-vonal 2,4×-ére drágult → CX-vonal kell.
- **Szerver + DNS API-ból:** `citoviso-app-1` (158171031), Debian 13, **IP 178.104.3.223**, tűzfal
  (22/80/443), napi backup, dedikált SSH-kulcs. DNS: A @ · CNAME www · **A * (wildcard tenant-aldomain)**
  → proxyzva. ⚠️ CF-token-csapda: az ÚJ „Account API tokens" (cfat_) NEM ad zóna-DNS-jogot — a
  klasszikus **User-token „Edit zone DNS" sablon** kell (dash.cloudflare.com/profile/api-tokens).
- **Bootstrap (tulaj-engedéllyel):** node20 + PG17 (friss DB, 15 migráció) + nginx (önaláírt origin-cert,
  CF Full) + systemd (`citoviso-public` :4800, `citoviso-console` :4600 kifelé ZÁRVA). Deploy = **rsync
  a dev-gépről** (`git ls-files`; nincs git a szerveren). Éles `.env`-ben CSAK app-kulcsok (infra-tokenek
  nem). **https://citoviso.com ÉL** (+www +wildcard).
- **E-mail-infra (2026-08-03):** **Zoho Mail Lite** 1 user `olasz.ferenc@citoviso.com` + **`info@` ingyenes
  ALIAS** (€10,80/év). DNS mind API-ból: verify-TXT · MX · SPF · **DKIM `zmail._domainkey`** (openssl-lel
  validált kulcs) · **DMARC p=none**. Bejövő ÉL. Kliens: `imappro/smtppro.zoho.com` (fizetős → „pro" hostok!).
  **A külső küldő KIZÁRÓLAG a hideg-kézbesíthetőség miatt kell** (friss IP+domain = spam → hamis pilot-mérés);
  a tenant-email felár-modul ettől független, saját mail-stackkel is megoldható.
- **⭐ AZ ELSŐ VALÓS LEVÉL ELMENT (2026-08-04):** app-jelszóval `SMTP_URL`+`OUTREACH_FROM`+
  `EMAIL_PROVIDER=smtp` az éles .env-ben; `scripts/email-smoke.ts` a szerverről kétszer is lefutott.
  ⚠️ **HETZNER PORT-BLOKK:** a 25-ös ÉS 465-ös kimenő port BLOKKOLT (timeout), a **587 (STARTTLS)
  nyitva** → azon megy. **A KÜLDŐ-ÚT KÉSZ.**
- **Nyitott (tulaj): IMAP-kliens (Outlook) még nem megy** — a Zoho szerver válasza: „you are yet to
  enable IMAP for your account". A házirend már engedi, de KÉTLÉPCSŐS: a **WEBMAILBEN** kell bekapcsolni
  (mail.zoho.com → fogaskerék → Levelezőfiókok → cím → IMAP Access pipa), NEM az admin-konzolban.
  Az app-jelszó JÓ. **Nem pilot-blokkoló** (a kiküldés SMTP-n megy, válasz a webmailben olvasható).
- **KÖVETKEZŐ FEJLESZTÉSI DÖNTÉS:** valós árak + `PRICING_CONFIRMED` (§C-kapu) · **dev↔prod DB
  egységesítés** (a leadek a dev-gépen, a szerver DB-je üres — ez KELL a szerverről kiküldéshez) ·
  majd a **teljes A–Z sandbox-teszt**.
- **Nyitott technikai szálak:** dev↔prod DB kettéválás (scrape/kuráció ma a dev-gépen fut, a szerver DB-je
  külön/üres — egységesíteni kell a pilot-tölcsérhez) · konzol-elérés élesben (SSH-tunnel vs admin-aldomain)
  · tenant host-routing (a wildcard ma ugyanazt az oldalt adja, nincs `slug.citoviso.com` → tenant-site) ·
  CF „Always Use HTTPS" kapcsoló. Jegyzet: `_planning/memory/2026-08-02_prod_infra_golive.md`.

---
**2026-08-02 — §A PER-KÉP PROVENANCE A GO-LIVE ÉLEN KÉSZ (`40d48e9`, őr-verifikált).**
- **Photo += `provenance`** (§A.3: owner|guest|portal|places|streetview|generated) + `watermarked`;
  ÚJ `src/engine/photoPolicy.ts`: live-renderből KIZÁRÓLAG places/streetview/vízjeles/ismeretlen esik ki
  (ismeretlen=drop A4 safe default; `/uploads/` prefix = legacy owner); guest/portal az önnyilatkozattal
  élesre megy csere nélkül. Bélyegzés: motor Places-fotó=`places`, tenant-feltöltés=`owner`.
- **Go-live sorrend (őr-jelezte rés fixálva):** `activate()` → §A-policys live render ELŐBB
  (`rerenderTenantSnapshot(tenantId,{as:"live"})`), status-flip CSAK sikeres render után; legacy
  HTML-copy artifact nem auto-élesedik. Tenant-szerkesztő live-státuszú re-renderje is policy-s.
- **⭐ BÓNUSZ BUGFIX:** `toPrivatePreview` létező robots metát noindexre CSERÉL — az engine-renderelt
  provisioned privát előnézet eddig `index,follow` volt (Bonvino bizonyította)! + eddig a live site a
  provisioned NOINDEXES snapshotot szolgálta ki (nem volt go-live re-render) — mindkettő zárva.
- **Remediáció:** GRANDIS pre-policy legacy live sandbox-site → provisioned (0 live site a dev DB-ben).
- E2E (Bonvino): provisioned=demó-fotó+noindex · live=0 Places-URL+owner-fotók+index · tsc tiszta.
- **Őr-jegyzetek (kis nyitottak):** `watermarked` ma halott kód (portal-ingestnél kötelező lesz a
  bélyegzés); az engine-renderelt provisioned előnézetben nincs demo-framing lábléc (noindex+token véd,
  de §A.12-súrlódás — tulajjal eldöntendő, kell-e keret).
- **Temp-screenshot kivizsgálva:** a tulaj 08-01 21:23-as mobil-fotója a 23:22-es szerver-restart
  ELŐTTI régi konzol-UI-t mutatta; a mostani konzol 390px-en Playwrighttal verifikálva RENDBEN
  (tabsor + panelen belüli tábla-görgetés). Kódmódosítás nem kellett.
- **KÖVETKEZŐ: teljes A–Z sandbox-teszt** (scrape→mock→outreach→rendelés→fizetés→számla→élesítés
  egyben) — tulaj-döntés szerint ez előzi a Barion/Számlázz éles kulcsokat. Kozmetika hátra: régió-slug
  a levél hook-mondatában.

---

**2026-08-01 (2. session) — B) OUTREACH KÜLDŐ-PIPELINE KÉSZ (§C-kapu a csőben, E2E-verifikálva).**
- **SMTP-adapter** (`src/email/sender.ts`): nodemailer a stub helyett (`SMTP_URL`+`OUTREACH_FROM` kötelező,
  hangosan bukik); mock/outbox marad a default. `EmailMessage` += `headers`.
- **HTML-sablon** (`src/email/outreachEmail.ts`): a §C-kapuzott SZÖVEGES piszkozat bekezdéseiből renderel
  (egy-forrás → §I-hű), brand-színek, CTA, NINCS tracking-pixel; **RFC 8058 one-click unsubscribe** fejlécek.
- **Pipeline** (`src/outreach/sendBatch.ts` + `scripts/outreach-send.ts`, `npm run outreach:send`): EGYETLEN
  őrzött út (konzol-gomb + batch + CLI konvergál); §C-kapu/státusz/leiratkozás a küldés PILLANATÁBAN újra fut;
  cap 20/futás + 5s pacing; `--dry-run/--limit/--prospect`. Konzol: draft-oldalon „Küldés e-mailben" gomb
  (`POST /prospect/:id/send`), `/p/:token/leiratkozas` POST-tal (one-click).
- **⭐ Jog-provenance-őr FLAG-elt → 3 fix:** (1) **cím-szintű suppression** (`isEmailSuppressed`: bármely valaha
  leiratkozott sor azonos e-maillel = tilos — a token-szintű opt-out Grt.-sértés volt); (2) **atomi created→sent
  claim** küldés előtt (dupla-küldés kizárva, hibán revert); (3) List-Unsubscribe-assert a hideg-úton.
  E2E: FLAG-út/dry/sent/re-send-SKIP/one-click-unsub/suppression mind verifikálva; `tsc` tiszta.
- **Konzol e-mail-előnézet** (`cc0eaa4`): a draft-oldalon élő HTML-iframe = PONTOSAN a kimenő levél
  (`/prospect/:id/email-preview`; FLAG-állapotban is nézhető).
- **⭐ Nagyobb csali (tulaj-kérés, `fe2c64e`):** ① a mock NYITÓKÉPE a levélben (`heroShot.ts`, CID-inline =
  nem open-tracking; §A-szalag a pixelekbe égetve: „ELŐZETES LÁTVÁNYTERV — CITOVISO") ② „már havi X forinttól"
  ár a `modules.ts BASE_PRICE_MONTHLY`-ból (egy ár-forrás) ③ „kipróbálhatja" CTA (fedezett: /p/=konfigurátor).
  **Őr 2. kör → fix:** artifact-verdikt assert küldés előtt (FLAG-es mock képe nem mehet postafiókba) +
  **`PRICING_CONFIRMED` kapcsoló** (placeholder-ár hirdetését a §C-kapu blokkolja). Őr-jelezte MEGLÉVŐ rés
  BACKLOG-ra: `order_intent.price` kliens-küldött → szerver-oldali újraszámítás kell terhelés előtt.
- **Éleshez kell (tulaj):** ⭐ valós árak a `modules.ts`-be + `PRICING_CONFIRMED=true` · küldő-domain SPF/DKIM →
  `SMTP_URL`+`EMAIL_PROVIDER=smtp` · publikus HTTPS → `PUBLIC_BASE_URL` · `OUTREACH_SENDER_*`.
  Kozmetika hátra: régió-slug a hook-mondatban („godollo").
- Session-jegyzet: `_planning/memory/2026-08-01_outreach_send_pipeline.md`.
- **⭐ BELSŐ UI ① KÉSZ (`14f02fb`):** konzol `/scrape` (régió+cap indítás a felületről — a CLI child-processként,
  élő napló, futás-történet; E2E: badacsony cap=5 a felületről → 5 lead perzisztálva) + `/riport` (H1–H5
  hipotézis-tábla küszöbökkel + szegmens-bontás; H1/H5 bázis = TÉNYLEGESEN kiküldött prospectek).
  Fejléc-nav: leadek · scrape · riport.
- **⛔ TULAJ-DÖNTÉS (2026-08-01): Barion+Számlázz ÉLESÍTÉS PARKOLVA** — előtte kötelező egy teljes A–Z
  sandbox-teszt (scrape→mock→outreach→rendelés→fizetés→számla→élesítés egyben); az éles kulcs-beszerzést
  se kezdjük még. (A belső konzol Tailscale-only védelme MEGHALADVA még aznap → operátor-login, lásd lentebb.)
- **Árazás:** belső ár-UI NINCS (ár = `modules.ts`, placeholder + `PRICING_CONFIRMED=false` kapu);
  a hierarchikus GEO-árazás (országfüggő) a BACKLOG-ban rögzített 1. belső modul — pilot UTÁN épül,
  trigger: 2. ország. A pilothoz a tulaj mondja a számokat, kézzel írjuk be.
- **⭐ FELNŐTT KONZOL (`fbced93`, tulaj-kritika nyomán):** operátor-LOGIN (0014 `operator_user` +
  `operatorAuth`, HMAC-cookie külön realm; auth-kapu minden belső route-on, publikus kivétel-lista) —
  publikus hostingon is védett; állandó MENÜ + vezérlőpult (`/`=számok, lead-lista→`/leadek`); a konzol
  inline CSS-e törölve → KINÉZET A DIZÁJN-MAGBÓL (`citui.css` + új `citui-console.css`). Fiók:
  `scripts/operator-user.ts`. Publikus oldalak chrome nélkül.
- **⭐ ANGOL ÚTVONAL-STRUKTÚRA (`650d8db`, tulaj-rendelet):** minden route angolra: `/login /logout /leads
  /report /privacy /p/:token/unsubscribe /admin/{text,contact,photos}` (mindkét szerver); a honlap halott
  `/adatvedelem` linkje javítva (`/privacy` a :4800-on is). Magyar = megjelenítési nyelv. **MULTILANGUAGE-igény
  rögzítve** (tenant-admin + belső konzol is; BACKLOG „Multilanguage / i18n", trigger: 2. nyelv/ország).
- **⭐ ÁR-INTEGRITÁS FIX (`a6122f0`):** order-ár SZERVER-oldalon számolva (kliens-ár csak kijelzés,
  eltérés naplózva, kamu modul kiszűrve) — az őr-jelezte rés zárva.
- **⭐ §A ÖNNYILATKOZAT-FLOW (`6a1b29d`):** 0015 + legal.ts (determinisztikus szöveg) + kötelező
  konfigurátor-checkbox (a címke = a bélyegzett szöveg, egy forrás) + szerver 400-kapu + activate()
  §A-recheck a go-live élen + tenant-admin modul-kártya.
- **⛔ NEM nyitott döntés — VÉGREHAJTÁSI feladat (session-végi tanulság):** a §A fotó-politika 2026-07-13
  óta ELDŐLT (guest/portal = önnyilatkozattal élesíthető; **Places/StreetView SOHA → saját képre csere**,
  ezért van az A2 feltöltés). Tévesen döntésként kérdeztem újra → a tulaj jogosan reklamált.
- **KÖVETKEZŐ SESSION ELSŐ FELADATA (pontosítva — a „csak owner-kép" megfogalmazásom HIBÁS volt,
  a tulaj elkapta):** a MEGLÉVŐ §A.1/b kikényszerítése a go-live élen: per-kép provenance-osztály
  (§A.3) a pipeline-ban + a live-renderből KIZÁRÓLAG a places/streetview/vízjeles esik ki (csere) —
  a **guest/portal a 0015-ös önnyilatkozattal ÉLESRE MEGY, csere nélkül** (owner-kép csak opció, A2).
  Utána: teljes A–Z sandbox-teszt.

---

**2026-08-01 — PILOT-INFRA ÉPÍTÉS: dizájn-mag + publikus honlap + self-serve auto-mock + tenant-belépés/admin.**
- **⭐ ADR-0021 — Citoviso saját felület-világ:** központi **dizájn-mag** (`public/assets/ui/citui.{css,js}`,
  `--citui-*` tokenek + komponensek + styleguide; a brand `assets/brand/`-ból: navy/cián, Inter+Space Grotesk).
  Elkülönítve a motor `--cit-*` skin-tokenjeitől. **Kettős identitás-realm** (control/data plane) + granuláris belső
  RBAC TERV (6 szerepkör: superadmin/operátor/sales/pénzügy/dizájner) — de a belső RBAC a pilotra HALASZTVA.
- **⭐ Publikus honlap** (`public/index.html` + `assets/home/`): **vevő-fókuszú** tartalom (tulaj-visszajelzés:
  NE a technikai hátterünkről szóljon — [[feedback_landing_customer_value_not_tech]]); a lap GERINCE a **minta-igénylés**.
  No-JS reveal-fix (JS nélkül is látszik). A landing a tulaj mintájából újraépítve (nem copy-paste), a magra.
- **⭐⭐ ADR-0022 — self-serve auto-mock:** honlap-űrlap (**Leaflet térkép-pin** = pontos helyszín) → `POST /api/mock-request`
  → egy-vállalkozás feloldás (`resolveOne`: Places pin/locationBias v. név+település) → `generateEngineMock` → ŐR-KAPUK
  (tényhűség/jog/dizájn + A4 konfidencia) → **őr-kapuzott auto** e-mail (magabiztos+PASS→auto; FLAG→needs_review, A2).
  E-mail: **EmailSender interfész + Mock-adapter** (`outbox/`; SMTP éles később). `mock_request` tábla (0010).
- **⭐⭐ ADR-0023 — tenant-belépés + minimál admin** (a pilot kiemelt hiánya: vásárlás után belépés): **felhasználónév +
  jelszó** (mi generáljuk a vállalkozásnévből + megjegyezhető jelszó `kilato-levendula-47`; magic-link ELVETVE — a
  nem-tech tulajnak macerás; e-mail INSTABIL login-kulcs mert mi adunk neki e-mailt). **Kommunikációs e-mail** külön,
  módosítható. scrypt hash + aláírt session-cookie. Admin (dizájn-magon): **A1 szöveg-szerkesztés** + **A2 saját fotó
  feltöltés/csere** (§A: demó kép élesre nem mehet → saját kép váltja; `AssetStore` interfész + LocalAssetStore
  `sites/<tenant>/uploads/`). Re-render mock=live. Táblák: `tenant_user`+`login_token` (0011), `password_hash` (0012),
  `username`+`contact_email` (0013), `site.edited_site_data`.
- **⚙️ ÚJ PUBLIKUS SZERVER:** `src/server/public.ts` (:4800, `PUBLIC_PORT`) — statikus `public/` + `/api/mock-request`
  + `/m/:token` (előnézet, demo-framing) + `/belepes` `/admin` `/admin/{szoveg,kapcsolat,foto,foto/torol}` `/kilepes`
  + `/site/:token` + `/uploads/`. **Folyamatosan fut** (setsid/nohup; leváltotta a python statikust). Böngészőből:
  `http://100.97.188.105:4800/`. (A belső konzol továbbra is `:4600`.)
- **Commitok (mind PUSHOLVA, origin/main szinkron):** `82e7e87` (mag+honlap+auto-mock) · `a5b471b`+`4d2a381` (tenant-auth)
  · `41f3978` (A2 fotó). ADR-0021/0022/0023 a `_planning/DECISIONS.md`-ben.
- **KÖVETKEZŐ (pilot kritikus út):** **B) outreach küldő-pipeline** (~100 hideg megkeresés kiküldése: SMTP-adapter a
  meglévő EmailSender mögé + batch + §C-kapu + HTML-sablon). Opcionális: modul-kezelés az adminban, jogi
  önnyilatkozat-flow az élesítésnél.
- **🔑 KÜLSŐ BLOKKOLÓK (tulaj):** citoviso.com + **publikus hoszting** (outreach-link + Barion-webhook + honlap élesítés
  előfeltétele) · éles Barion + Számlázz kulcs · küldő-domain/postafiók (SPF/DKIM) az e-mail-küldéshez.
- Session-jegyzet: `_planning/memory/2026-08-01_pilot_infra_build.md`.

---

**2026-07-27/30 — PILOT-FELKÉSZÜLÉS: domain-stratégia (ADR-0020) + követett outreach-gerinc + §C-kapus email-piszkozat + pilot-hatókör újradefiniálva.**
- **⭐ ADR-0020 — DOMAIN-stratégia (tulaj-döntés):** alap = `<slug>.citoviso.com` aldomain (olcsóbb út);
  **egyedi domain rajtunk keresztül = min. 24 hó előfizetés-vállalás** (upsell+retenció); a konfigurátor
  rendeléskor 3–5 szabad nevet javasol **valós idejű előzetes csekkel** (`src/domains.ts`: DNS-over-HTTPS+RDAP,
  kulcs nélkül, ~0,5 mp). Konfigurátor „Címe az interneten" lépés + `order_intent` 0008 domain-mezők
  (`domain_type`/`domain_name`/`commitment_months`) + operátor-nézet. SEO canonical = POST-PILOT (tulaj).
- **⭐ KÖVETETT OUTREACH-GERINC (PILOT.md §2.5+§3) KÉSZ:** `/p/<token>` instrumentált link — mock_view
  pageloadonként + esemény-beaconök (scroll-mérföldkő, dwell, panel_open, module_add/remove, preset/period/
  domain, order-submit); prospect-tölcsér `created→sent→opened→engaged→order_intent` (sosem regresszál);
  konzol Megkeresés-panel (link-készítés szegmens-címkével, Kiküldve=H1-bázis); GDPR-lábléc + leiratkozás
  (0009: `sent_at`+`unsubscribed_at`; leiratkozás után NULLA tracking). E2E: curl + Playwright verifikálva.
- **⭐ EMAIL-PISZKOZAT + §C-KAPU:** determinisztikus, valós adatra személyre szabott piszkozat
  (`src/outreach/draft.ts`; rating CSAK az artifact A4-kapuzott SiteData-jából — §I: a levél=amit a mock mutat);
  `outreachCheck.ts` runtime-kapu (C1–C4). **A jog-provenance-őr élesben ítélt: 3 küldés-blokkoló** →
  javítva: `/adatvedelem` GDPR Art.13/14 oldal (adatforrás-megjelöléssel) + kapu-szigorítás (privát/CGNAT-IP,
  nem-HTTPS, placeholder-kontakt = FLAG). Konzol: `/prospect/:id/draft` másolható piszkozat verdikttel (A2 kézi küldés).
- **⭐⭐ PILOT-HATÓKÖR MÓDOSÍTVA (tulaj, 2026-07-30):** a pilot = **TELJES loop éles fizetéssel + automata
  számlázással** (nem csak order-intentig). **Jogi forma ELDŐLT: egyéni vállalkozás** (Mineral-híd okafogyott).
  Fizetés-állás: sandbox-validált, éles NINCS (`BARION_URL=test`, `INVOICE_PROVIDER=mock`) — élesítési
  checklist PILOT.md §7c (kulcsok után env-csere + kis összegű füst-teszt).
- **„MÉG MESSZE AZ INDULÁS" — felület-leltár (PILOT.md §7d):** ① belső UI fixálás (scrape ma csak CLI,
  nincs tölcsér-riport) · ② email HTML-sablon + küldő-pipeline (ma szöveges+kézi) · ③ tenant-admin csak
  read-only → önkiszolgáló szerkesztő kell (§E.12) · ④ **Citoviso alap honlap NINCS** (bizalom-horgony).
  **Elfogadott sorrend: ①honlap(dogfooding a motorral) → ②email → ③belső UI → ④tenant-admin.**
- **Külső előfeltételek (tulaj):** citoviso.com regisztráció · hoszting-döntés (publikus HTTPS = kiküldés-kapu
  ÉS Barion-webhook előfeltétele) · Barion+Számlázz éles fiók (ev.) · ÖVTJ-csekk · küldő-domain/postafiók.
- Commitok: `1b0e3ac` (ADR-0020 domain) · `d70053e` (követett link+instrumentáció) · `b9112ce` (outreach+§C)
  · `0432d96`+`2778a95` (PILOT.md §7b-d). Session-jegyzet: `_planning/memory/2026-07-30_pilot_launch_gearing.md`.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA: a Citoviso alap honlap** (saját motorral generálva, lokálban építhető).

---

**2026-07-24/26 — A MINŐSÉGI KÖR LEZÁRVA: a „wow" a MOTORON belül (ADR-0019) + éles bekötés + finomítás + SEO.**
- **⭐⭐ ADR-0019 — a plafon-döntés eldőlt: MOTOR-ÚT nyert, NINCS HIBRID.** A teherhordó kísérlet (UGYANARRA
  az adatra, `A'`=felokosított motor vs `B`=bespoke) megmutatta: a bespoke előnye NEM sablonozhatatlan, hanem
  (1) szerkesztőségi szöveg + (2) strukturális ízlés + (3) mozgás → mindhárom BEÉPÜLT a motorba, a `mock=live`
  feláldozása nélkül. A tulaj: „wow" → „sokkal jobb". Réteg: `SectionCopy` a receptben + `heroEditorial`/
  `roomsShowcase` variánsok + grounded **copywriter** (`src/engine/copywriter.ts`, a motor 2. AI-lépése, §B.17-hű) +
  keresztmetsző **MOTION_CSS** (`primitives.ts`) + `autoReveal()` (`assets/runtime/cit-runtime.js`: lépcsőzött
  scroll-reveal, hero ken-burns, kép-hover-zoom, kártya-emelés; reduced-motion/no-JS → statikus).
- **⛔⛔ ÚJ INVARIÁNS §I (03-INVARIANTS + [[invariant_no_bait_and_switch_delivery]]):** amit a leadnek megajánlunk
  (outreach-mock) = PONTOSAN azt kapja fizetés után. Bait-and-switch a nulladik ponton ABSZOLÚT TILOS (üzletileg
  öngyilkos + jogilag súlyos: Fttv.). A `mock=live` ezt konstrukció szerint garantálja. Külön §B.17-től: igaz tartalom + HŰ szállítás.
- **ÉLES BEKÖTÉS KÉSZ:** a copywriter+mozgás+editorial variánsok BEKÖTVE a `generateEngineMock`-ba (konzol :4600 +
  CLI is ezt adja, nem csak proof). `resolveGatedPhotos` a valós Google-**ratinget** is visszaadja (ugyanaz az A4-kapu);
  a copy a PERZISZTÁLT receptbe sül → `convertLead` LIVE = mock (round-trip AZONOS ✅).
- **FINOMÍTÁS + SEO (ma):** SVG-csillag a rating-statban (nem ★ glyph — designCheck) · robusztus hero-scrim (világos
  skin) · **GYIK-modul** (új `faq` primitív, natív `<details>`, §B.17 minta-kapu) · **auto-SEO** (`src/engine/seo.ts`,
  §H): meta description + fázis-tudatos robots (mock=noindex, live=index) + OG/Twitter + **Schema.org LodgingBusiness
  JSON-LD** a valós adatból (név/cím/geo/telefon/rating). `SiteData` += `geo`/`rating` strukturált mező.
- **BIZONYÍTÉK (letölthető minták, `:4700/sample-*.html`):** Villa Oliver/Gödöllő (4★/46), Villa Pátzay (4,1★/57),
  Rózsakő ház/Badacsony (5★/12) — mind HIGH-match, valós fotó+rating, 3 külön skin, mozgás+GYIK+SEO. Dizájn-kapu PASS, round-trip AZONOS.
- **A Fortuna-eset (tanulság):** a match-gyanú (név-egyezés 0,17: borozó↔vendégház) helyesen KÖZEPES sáv + kurátor-flag → nem attribuál vakon (A4).
- **Session commitok (mind LOKÁL, push deploy key-re vár):** `8e351fa` (§I invariáns) · `fb4e669` (editorial+mozgás) ·
  `12d46bf` (éles bekötés) · `2d2771b` (finomítás+GYIK+SEO). Eszközök: `scripts/engine-{max-plus,from-lead-plus,generate}.ts`.
- **✅ PUSH KÉSZ (2026-07-26):** a deploy key MŰKÖDIK (SSH `git@github-citoviso`), a `main` szinkronban az originnal.
  A korábbi „deploy key-re vár" jegyzet ELAVULT.
- **KÖVETKEZŐ SESSION ELSŐ TÉMÁJA (tulaj kérése): a SEO CANONICAL + PROVISIONING terv ÁTNÉZÉSE fejlesztés ELŐTT.**
  (A `seo.ts` ma szándékosan kihagyja a `<link rel=canonical>`+`og:url`-t — nincs élő domain mock-időben; a
  provisioning-fázisban injektálandó.) Opcionális: hero-parallax · proof-scriptek dedupe a `generateEngineMock` mögé ·
  VAGY tovább a konverziós szálra (konfigurátor+élő előnézet, ADR-0015).

---

**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
**2026-07-23 — MOTOR VÉGIGÉPÍTVE (ADR-0016 lezárva) + KIT-PASSZOK + MINŐSÉG-ÍV (ADR-0017/0018).**
- **ADR-0016 KÉSZ, éles-validált:** archetípus-réteg (registry) + `lead→SiteData` mapping + generálás
  motorra (`generateEngine.ts`, perzisztálja recept+SiteData) + `convertLead` motorra (live = perzisztált
  recept determinisztikus re-renderje, `mock=live`). **Motor = alapértelmezett generátor** (konzol+CLI, ADR-0017).
- **Kit-passzok (ADR-0017):** SKIN 2→9 (korpuszból) · PRIMITÍV-VARIÁNS (recept `variant`) · ARCHETÍPUS 3→6.
  ⚠️ runtime bugfix: `cit-modules.css` fallback `:root` → `@layer` (nem írja felül a skint). Planner-QA:
  a planner hangulat-helyesen varál (`engine-qa.ts`, 7 fixtúra).
- **⭐⭐ MINŐSÉG-ÍV (ADR-0018):** a desktop-screenshot megmutatta: a kimenet „template"/„gagyi" volt.
  A tulaj 5 referencia-mockja MENTVE mérceként: `assets/design-refs/reference-quality/` + README kraft-standard.
  Javítások: immerzív hero · sticky nav + gazdag lábléc (`chrome.ts`) · amenity SVG-ikonok (`icons.ts`) ·
  szoba+vélemény MINTA-modulok §B.17 fázis-kapuval (mock: jelölt minta; live: adat híján kiesik) ·
  kép-vezérelt szoba-kártyák + `stats` modul. `scripts/engine-max.ts` = **~80% Silva, nem gagyi.**
- **⚠️ NYITOTT DÖNTÉS (a következő session ELSŐ lépése):** a tulaj szerint még mindig gagyibb a mintáknál.
  Plafon-bizonyíték UGYANARRA az adatra: **A = motor** (`:4700/max-craft.html`, mock=live+szerkeszthető) vs
  **B = bespoke AI-HTML** (`:4700/bespoke-mock.html`, `scripts/bespoke-mock.ts` — igényesebb, egyedi, DE nem
  mock=live/nem szerkeszthető) vs **HIBRID** (bespoke outreach-mock + motor szerkeszthető live — a javaslatom).
  Fontos: a minták ÉS B IS fabrikált adatra épülnek (§B.17 mindkét útra vonatkozik). Részletek + tools:
  `_planning/memory/2026-07-23_engine_quality_bar.md`. Böngészhető nézetek: `:4700` (statikus szerver a `sites/_engine-proof`-on).
- **⚠️ PUSH: 13 commit áll LOKÁLBAN (d27e76b…33817fa), deploy key-re vár.**

---

**2026-07-21 (este) — BARION SANDBOX-KÖR LEZÁRVA + a generáló MOTOR architektúrája (ADR-0016).**
- **Barion sandbox teljes kör ✅** — valós teszt-kártyás (`4444 8888 8888 5559`) fizetés → `GetPaymentState`
  Succeeded → payment PAID (4880 Ft) → site LIVE → lead activation → **valós AAM teszt-számla `OV-2026-2`**
  (Számlázz teszt-fiók). A memória függő POSKey-szála KIPIPÁLVA. Sandbox-tanulság: draft-shop = `ShopIsInDraftState`
  (submittelni kell, auto-approve), az approval `secure→api.test.barion.com` ~2,5 perc alatt propagál; a pay-link
  ~perc alatt `Expired`. `.env`: `PAYMENT_GATEWAY=barion` MARADT, `INVOICE_PROVIDER=mock`-ra visszaállítva.
  Eszközök: `scripts/barion-{smoke,pilot}.ts` + `pilot-inspect.ts`. Részletek: `_planning/memory/2026-07-21_engine_architecture.md`.
- **⭐⭐ ADR-0016 — KOMPOZÍCIÓS MOTOR + recept-absztrakció** (a tulajjal közösen döntve): `adat → [AI-tervező] →
  recept → determinisztikus render(recept+adat+skin) → HTML`; **`mock=live` GARANTÁLT egy motorból**; **WP KIZÁRVA**.
  Réteg-számláló: **1 BACKEND** (fix) + **1 közös MODUL/PRIMITÍV-készlet** (token-témázott, NEM archetípusonként
  újra = 100×N elkerülve) + **N ARCHETÍPUS** (=elrendezés-séma, a „frontend ami változik") + **M SKIN** (ráhúzható).
  Sokszínűség = archetípus × skin × modul-kompozíció (KOMBINATORIKA, nem darabszám). Auto-memória: `project_composition_engine`.
- **Bizonyító szelet ÉPÍTVE** (`src/engine/`, additív — a régi pipeline érintetlen): `recipe/skins/primitives/
  render/planner.ts`. `scripts/engine-prove.ts` = **mock=live skeleton AZONOS ✅**; `scripts/engine-plan.ts` =
  valós Claude-tervező (GRANDIS prémium→`immersive-dark`, Nefelejcs családias→`editorial-warm`, fotó nélkül→nincs gallery).
- **Következő:** ① archetípus-réteg (elrendezés-nyelvtanok: rács/scroll/split) · ② lead→SiteData mapping ·
  ③ `convertLead` átkötése a motorra (mock-HTML-másolás kiváltása) · ④ készlet-bővítés · ⑤ tenant-admin recept-szerkesztő.
  VAGY: valós árak (`src/modules.ts`); hoszting; prospect-pilot.

---

**A KERESKEDELMI KÖR LOKÁLBAN ZÁRVA (2026-07-20).** A teljes tölcsér-vég működik és verifikálva, kulcs nélkül:
```
mock → kurátor → prospect-konfigurátor (ALL-IN + ÁR) → order_intent
  → pay-link (mock↔Barion) → fizetés → webhook → site LIVE + lead ACTIVATION
  → AAM auto-számla (mock↔Számlázz Agent) → recurring megújítás / nem-fizet → deaktiválás
```
Minden external integráció **interfész mögött, mock-adapterrel** (build-behind-an-interface): a valós
Barion (gateway) + Számlázz.hu Számla Agent (számla) **drop-in kulcs-cserekor** (env). NEHEZEN visszafordítható
= a gateway + kártya-tokenek (tudatos Barion-döntés); minden más könnyen cserélhető.
**Következő = external lépés a tulajnál:** Barion-fiók + kulcsok (+ variable-amount MIT-jóváhagyás kérése),
Számlázz Agent-kulcs. Utána a valós adapterek bekapcsolása. Vagy: hoszting (Cloudflare for SaaS + Hetzner),
vagy valós prospect-pilot (outreach/prospect-token flow).
**Parkolt:** pricing-modul (első BELSŐ modul, hierarchikus geo-árazás) → pilot UTÁN; korpusz-bővítés.

### 2026-07-16/20 — KONFIGURÁTOR + A KERESKEDELMI KÖR (slice 1–3) + billing/hoszting-kutatás
- **Prospect-konfigurátor (ADR-0015 impl):** serve-time overlay a `/configure/:artifactId`-n
  (`src/generator/configurator.ts` + `assets/runtime/cit-configurator.{css,js}`). **ALL-IN framing** (tulaj-döntés):
  nincs fogaskerék; a wow vezet, halk pill úszik fel → nyitáskor MINDEN modul ON, onnan trimmel lefelé (ár-horgony).
  **Ergonómia a nem-tech tulajra:** preset-elsődleges (Teljes/Ajánlott/Alap) + „Testre szabom" alatt a 12 kapcsoló;
  **tulaj-nyelvű címkék** (nincs „modul/CTA"); no-risk keret; mobil bottom-sheet. Egy-forrás katalógus `src/modules.ts`.
- **Korpusz-QA:** a `vertical-ribbon-nav` (GRANDIS bal-menü) „fos" volt → **3 gyenge archetípus karanténba**
  (`retired:true` a manifestben, `selectCorpusDesign` kihagyja: egyszeru-2/kozep-2/premium-2). Új eszköz:
  `scripts/corpus-contact-sheet.ts` (27 archetípus egy képen, vizuális triage). GRANDIS regen → immersive-dark (tiszta).
- **Kereskedelmi kör (slice 1–3), mind mock-adapterrel + lokál verifikálva:**
  - **Slice 1 — árazás + rendelés:** bázis + Σ modul havi ár + éves (2 hó ingyen) a konfigurátorban; submit → valós
    **`order_intent`** (a 0003 pilot-instrumentáció feltöltve). Placeholder árak a `modules.ts`-ben (tulaj állítja).
  - **Slice 2 — fizetés:** `src/payment/` gateway-interfész + MockGateway + env-selector (Barion=stub); `payment`
    tábla (0006); pay-link → webhook → **aktiválás** (`convertLead` + site LIVE + lead ACTIVATION); nem-fizet → deaktiválás.
  - **Slice 3 — számla + recurring:** `src/invoicing/` (InvoiceProvider + Mock + **SzamlazzAgent a HIVATALOS XML-spec
    szerint**, `afakulcs=AAM`); `invoice` tábla (0007) — **`vat_rate` PER SZÁMLA** (0 most). `src/payment/billing.ts`
    + `scripts/billing-cycle.ts`: megújítás + grace utáni deaktiválás.
- **Billing/hoszting-kutatás (deep-research, `_planning/RESEARCH-2026-07-billing-hosting.md`):** Gateway = **Barion**
  (nincs belépő/havi díj, token-recurring, first-party Számlázz; ⚠️ változó összeg → MIT külön jóváhagyás). Számla
  Agent AAM-számlát tud, NAV auto. **AAM-küszöb 2026 = 20M Ft** (nem 18M). Hoszting: **Cloudflare for SaaS**
  (auto custom-domain+TLS, kemény kritérium) + **Hetzner VPS** (a hoszting-verify rate-limitbe futott → tudás-alapú).
- Commitok: konfigurátor `392d3ed`/`139e1c0`; korpusz `2f299df`; slice1 `430e860`; kutatás `a7b3808`;
  slice2 `d139469`; pricing-modul jegyzet `e811f72`; slice3 `5372f65`/`5886637`. Minden LOKÁL, push nincs.
- **Nyitott döntések (BACKLOG):** domain-választás (4 javaslat + real-time csekk a checkoutnál, egyéni domain);
  email-modul (10 postafiók, csak saját domain); pricing-modul (geo-hierarchia) → pilot után.

### 2026-07-13/15 — KONVERZIÓS SZÁL: doktrína-alap + provisioning-gerinc + a sales-felismerés
- **Fogalmi alap (commit `50e1d71`):** **ADR-0013** — a `tier` NEM minőség-létra, hanem KARAKTER/REGISZTER
  (illeszkedés); a gyártási minőség konstans-maximum. Következmény: közös, tier-agnosztikus archetípus-pool +
  lágy súly (impl. külön ADR + A/B mögött; a `luxus:1` gond így nem „kevés luxus-szerkezet"). **ADR-0014** —
  **provisioning ≠ élesítés** (3 túlterhelt szó tisztázva: aktiválás/előfizetés/provisioning). Provisioning =
  PRIVÁT előnézet (noindex, token-URL), fizetés ELŐTT is; élesítés = NYILVÁNOS go-live, fizetés-kapus (a tulaj
  „fizet→aktivál" sorrendje áll — nem volt valós ütközés). **Site-állapotgép:** draft→provisioned→live→suspended.
  **§A átírva:** `guest`/`portal` demó-kép ÉLESRE kerülhet a tenant fizetéskori jogi ÖNNYILATKOZATÁVAL
  (rendelkezés + szavatosság + kártalanítás) + csere-lehetőséggel; `places`/`streetview` (Google-jog) + vízjel
  SOHA → csere. `jog-provenance-or` őr-agent §A-mátrixa igazítva.
- **Adat-réteg (commit `8fa6452`):** `migrations/0004_conversion.sql` — `tenant` (első `tenant_id`-hordozó,
  lead_id UNIQUE), `module_entitlement` (05-MODULES, UNIQUE tenant+module), `site` (állapotgép, preview_token,
  source_artifact_id). `lead_lifecycle` CHECK bővítve `disqualified`-dal. **RLS szándékosan MÉG NINCS** (nincs
  vendég-PII, egy-operátoros) → az első vendég-PII táblánál (booking) lép be. §G.18. schema.ts tükör szinkron.
- **Provisioning (commit `8b02674`, pusholva):** `src/conversion/provision.ts` — `convertLead(leadId, artifactId,
  modules[])` idempotens: approved mock → `sites/<tenant_id>/index.html` (noindex injektálva, demo-framing
  MEGTARTVA mert privát preview = még demó-fázis), entitlement upsert (additív), lead→`conversion`. `.gitignore`:
  `sites/`. Élesben verifikálva (Sophia/GRANDIS/Harsona Gödöllő).
- **Konzol-felület (commit `a8f22b5`):** `data.ts` (getConversion/getSiteByToken/getTenantAdminByToken),
  `views.ts` (MODULE_CATALOG 12 modul, convertForm checkboxok, convertedBlock, tenantAdminPage), `server.ts`
  (POST /lead/:id/convert, GET /site/:token, GET /admin/:token). Böngészőből (Tailscale :4600) a POST /convert
  élőben lefutott.
- **⭐⭐ A SZÁL FŐ FELISMERÉSE (commit KÖVETKEZŐ, ADR-0015):** a Harsona-teszt (mind a 12 modul bepipálva)
  megmutatta: az entitlement rögzül, de a Site NEM renderelődik újra a modul-választásból → a tulaj elkapta:
  **„sosem-látott modulért nem áldoz pénzt senki."** IGAZA VAN. Korrekció: **modult csak LÁTHATÓAN adunk el**;
  a **interaktív modul-konfigurátor + élő előnézet a KONVERZIÓ SZÍVE** (BACKLOG-ból előléptetve). Tényhűség
  fázis-határa élesítve (§B.17): adat nélküli modul az ELŐNÉZETBEN minta-állapottal MEGmutatható (jelölve, mint
  a demó-fotó), de az ÉLŐ oldalra SOHA adat-fedezet nélkül. A provisioning-gerinc (táblák + convertLead) marad
  mint kereskedelmi réteg; a konfigurátor rá ül. ⚠️ EZ A COMMIT (ADR-0015 + §B.17 + BACKLOG) még csak lokál.
- **Következő szelet:** a konfigurátor SCOPE-olása (mit renderel újra, hogyan togglel, hol a minta-állapot).

### 2026-07-12 — Őr-agent réteg + ontológia-megszilárdítás (3 guardian-kapu)
- **Koncepció:** nem mesterség-szerinti (frontend/backend) agentek, hanem a projekt INVARIÁNSAIRA horgonyzott
  esemény-triggerelt VERIFIEREK (őrök) — a doktrínát a gép tartja be, nem az én figyelmem. Minta:
  **kontraktus (DOMAIN-invariáns élesítve) → subagent (`.claude/agents/`) → runtime-kapu (ahol van felület) → dev-hook.**
- **Ontológia átvezetve** (`_inbox/20260712` distill-review): 00-GLOSSARY Architektúra-fogalmak (Control/Data plane,
  Iparág×Ország, Site-képlet, hibrid render); 02-ENTITY-MAP iparág-agnosztikus 6-entitásos közös mag (Property→történeti);
  03-INVARIANTS új §G (izoláció/jog/ember-a-hurokban), §H (SEO/lokalizáció). Commit `cef6736`.
- **1. őr — TÉNYHŰSÉG (2 réteg, commit `4d26165`):** §B.17 enforce-olható kontraktussá élesítve. Runtime-kapu
  `src/generator/factCheck.ts` (determinisztikus előszűrő + LLM-verifier, AI-mockra MINDIG fut) bekötve `generate.ts`-be;
  dev-hook `scripts/factcheck-scan.mjs` + `.claude/settings.json` (PostToolUse, minden `mock-*.html`). FLAG→kurátor-sor (§G.20).
  Ugyanebben a commitban az ADR-0012 airiness QA-gate is (generate.ts-ben összefonódott) — lásd lentebb, KÉSZ.

### 2026-07-13 — Levegősség-kontroll (ADR-0012): prompt-budget + render-mért QA-gate
- **Rés:** a reveal-fix után maradt „lágy airiness" — a mockok mobil átlaga ~20% HOLT függőleges sáv
  (szekció-magasság − a tartalom valós kiterjedése). 3 ok: nem-skálázódó mobil-padding, kitöltetlen
  nem-hero `min-height`/`vh`, túl nagy belső al-blokk-rés.
- **Fix (a tulaj választása 3 opcióból): PROMPT-BUDGET + QA-GATE** (NEM vak runtime CSS-felülírás, NEM auto-regen).
  (1) `ADAPT_SYSTEM` 8. szabály: számszerű ritmus — reszponzív `padding-block:clamp()`, nem-hero magasság a
  tartalmat kövesse, belső rés ≤2,5rem, ~85% kitöltés, tier-érzék. (2) `src/generator/qaAiriness.ts` render-alapú
  mérő (tag-agnosztikus sáv-detektálás) → `generateMock`-ba best-effort, nem-blokkoló → `airinessDeadPct` az
  artifactba. CLI: `scripts/qa-airiness.ts <mock> [width]`. ADR-0011-re épül.
- **Éles A/B (Gödöllő):** Nefelejcs (azonos lead) 20,5%→19%; új hármas átlag ~17,6% vs régi ~20%. A budget
  STRUKTURÁLISAN érvényesül (a modell átvette a `clamp()`-et, fent/lent-rés 114→68px, nincs nem-hero min-height);
  a maradék = belső rés + hero-kompozíció (részben legitim lélegzés). Ha küszöb fölött marad → QA-gate célzott regen (A2).
- **Fájlok:** ÚJ `src/generator/qaAiriness.ts`, `scripts/qa-airiness.ts`; MÓD `mockFromCorpus.ts` (8. szabály),
  `generate.ts` (QA-gate), `_planning/DECISIONS.md` (ADR-0012). Commit `4d26165` (a tényhűség-kapuval összefonódva).
- **2. őr — JOG/PROVENANCE (commit `35b6165`):** §A provenance×fázis mátrix + §C outreach 4 eleme, NOW/DEFERRED címkézve.
  Runtime: `provenanceCheck.ts` demo-framing check (az EGYETLEN valós felület ma; konverziós asset-kapu + outreach-küldés
  DEFERRED, mert a pipeline nincs). Subagent `jog-provenance-or.md` (fázis-tudatos).
- **3. őr — DIZÁJN-DOKTRÍNA (commit `35b6165`):** §B dizajn-enforce. `designCheck.ts` determinisztikus (emoji-tilalom
  `\p{Extended_Pictographic}`, 11 `--cit-*` token, booking-horog). Subagent `dizajn-doktrina-or.md` az ítélet-igényű részre.
- **Mind a 3 kapu füst-tesztelve** (pozitív+negatív), `tsc` tiszta. ⚠️ NINCS élő end-to-end generálás-teszt (valós API+DB).
  Új subagent-típusok natív hívhatósága session-újraindítás után. Részletes tudás: `_planning/memory/2026-07-12_guardian_agents.md`.

### 2026-07-12 (este) — Őr-agentek ÉLES PRÓBA + guardian-bug fix + matchConfidence bekötés
- **A fenti nyitott kérdések LEZÁRVA:** mindhárom subagent (`tenyhuseg-or`, `jog-provenance-or`, `dizajn-doktrina-or`)
  **natívan hívható** session-restart után ÉS ítéletet hoz. A grandis mockon mind PASS; a tényhűség-őr megtalálta a
  `leads-godollo.json` igazságforrást és minden HARD tényt strukturált mezőhöz kötött (nem hitte el vakon).
- **Guardian-bug fix (commit `ecce21e`):** `designCheck.ts` emoji-szűrő false-positive-olt a `©`/`®`/`™` jogi jeleken
  (footer-copyright miatt 3 jó mock tévesen FLAG-elt) → `EMOJI_ALLOWLIST` (a `★` szándékosan bukik: dekoratív = SVG).
- **matchConfidence bekötve (commit `408f445`):** eddig csak a kontakt/fotó-hiányos OSM-leadek kaptak konfidenciát;
  a Places-natív leadek (pl. GRANDIS, `sources=[google_places]`) `undefined`-del maradtak → §F.17b nem tudott zárni.
  Fix: Places-natív = self-match (`scoreMatch` táv 0 / név 1 / OSM-korroboráció) → google_places önmagában **0.85 high**,
  +osm **1.00**. ⚠️ A meglévő JSON-artifactek csak a **következő éles scrape-nél** töltődnek (tulaj-döntés: nincs backfill).
- **BREV-IRÁNY halasztva (tulaj-döntés):** a `webSearch()` MA is Google CSE-t hív (kivezetés alatt); a Brave-backend
  NINCS megírva és **nem is íródik, amíg a kurátor nem automata**. `BRAVE_SEARCH_API_KEY` nem kell most.
- **API-kulcs állás:** a re-scrape magját kulcs nem blokkolja — `GOOGLE_MAPS_API_KEY` + `GOOGLE_CSE_ID` +
  `ANTHROPIC_API_KEY` mind kitöltve a `.env`-ben. SMTP/outreach + Brave halasztva; `DATABASE_URL` = beágyazott dev-PG.
- Commitok: `ecce21e`, `5dc79a3` (distiller inbox-archív), `a3438b6` (doksik), `408f445`. Kapcsolódó rés a
  BACKLOG A4-ben: match-konfidencia ma mechanikus (név+táv+OSM), kontextuális/vélemény-korroboráció nélkül.

### 2026-07-11/12 — Runtime-modulok (gallery/map/reviews) + üres-sáv réteges fix + Sissi presence-fix
- **3 új runtime-modul** (ADR-0011 minta, progresszív fejlesztés → JS nélkül is tartalom):
  `gallery` (megosztott lightbox), `map` (kattintásra-betöltő Google-embed facade, GDPR), `reviews`
  (snap-carousel valós kártyákra; kamu tilos → gyakran kimarad). `assets/runtime/` + 2 fixture. Commit `aba5e05`.
- **⚠️ QA üres-sáv — RÉTEGES fix (commit `cd1e1c9`):** (1) `injectRuntime` determinisztikus no-JS háló:
  üres booking-slot → statikus érdeklődés-kártya (mailto); `<noscript>` + `cit-anim` a scroll-reveal
  tartalomra. (2) `cit-runtime.js::initReveal()` — a **reveal MOSTANTÓL RUNTIME-viselkedés** (IntersectionObserver
  a `.reveal`-re). Kiváltó: a `vertical-timeline-scroll`/`vertical-ribbon-nav` archetípusok JS-sel is üres sávosak
  voltak (a per-archetípus IO törékeny; a gated CSS-t az LLM megírta, az observert elhagyta → JS-sel örökre rejtett).
  Valós telefon-teszt fogta el (GRANDIS). Fix után: no-JS 76%→0%, mobil 14/14 reveal felszabadul. Prompt-szabály:
  reveal = PE, saját IO tiltva. (3) Két friss éles mock generálva validálásra (Sissi, GRANDIS).
- **Presence fals negatív — FORDÍTOTT SORREND fix (commit `3eba776`):** Sissi Panzió `no_site` volt, PEDIG van
  saját oldala (`panziosissi.hu`; a domain = típus-szó ELÖL). A `enrichPresence.candidateHosts` most a fordított
  token-sorrendet is próbálja. Élőben verifikálva → `has_own`. GRANDIS NEM hiba volt (`modern`, force-generált teszt-mock).
- **Új tartós tudás:** [[project_hybrid_review_model]] (külső scrape + first-party „oldalon hagyott" vélemény);
  a presence-memória Sissi-tanulság + Brave-időzítés (`_planning/memory/2026-07-07_presence_detection.md`).

### 2026-07-10 — MOCK-MOTOR (két-agent) + modul-UI + Gödöllő-pilot
- **ADR-0009 — archetípus-elsődleges korpusz:** a korpusz tengelye az ARCHETÍPUS (szerkezet), tier a
  partíció; a KÖRNYEZET lefokozva grounding-hintté (nem korpusz-mappa). A 36-metszet (env×tier) modell
  ELDOBVA. Kevesebb dizájn, nagyobb pool/anti-collision, régió-független. Korpusz: `assets/design-refs/corpus/{tier}/{n}.html` + `manifest.json` (27 dizájn, 21 egyedi archetípus).
- **Két agent:** `src/generator/corpus.ts` (agent-1, korpusz-építő, `scripts/build-corpus.ts` — `--tier=`) +
  `src/generator/mockFromCorpus.ts` (agent-2: osztályozás→tier-kiválasztás+anti-collision→grounded).
- **ADR-0010 — modul = FUNKCIÓ-tengely, ADAT nem korpusz-tengely** (nincs archetípus×modul robbanás).
  Katalógus: `_planning/DOMAIN/05-MODULES.md` (Szint 0–1, csak szállás).
- **ADR-0011 — modul-UI: token-kontraktus + hidratáló runtime** (`assets/runtime/cit-modules.css` +
  `cit-runtime.js` + `src/generator/runtime.ts` inline-injektor). Rendszer-költség O(archetípus)+O(modul),
  NEM O(arch×modul). Első interaktív widget: booking/érdeklődés (bar/card), token-témázott. Spec:
  `_planning/DOMAIN/06-UI-CONTRACT.md`. 3 fixture bizonyítja: egy widget, több natív téma.
- **Konzol átkötve az új pipeline-ra** (`generate.ts` régió koordinátából, `server.ts` fire-and-forget +
  auto-frissülő „folyamatban", `views.ts`). Konzol: http://100.97.188.105:4600/ · néző: :8899/
- **Gödöllő-pilot:** 24 hely (cap 40), 13 lead, 10 grounded mock — mind más archetípus, a bor/tó-íz
  groundinggal semlegesítve. Bizonyítja: a korpusz NEM régió-zárt (Balaton-korpusz Gödöllőt is kiszolgál).
  `scripts/build-corpus.ts` `--cap` a scraperben; `poc-corpus-mock.ts <regionId> <n>` régió-szűrővel.

---

**Nulláról tervezés — FÁZIS 1–4 ✅ KÉSZ. Következő: FÁZIS 5 (éles pilot) VAGY a tényleges ÉPÍTÉS.**
Jóváhagyott 6-fázisú roadmap: `_planning/ROADMAP.md`. Alapmodell:
`.../2026-07-04_business_model_understanding.md`. Kimenetek: phase1/2/3/4 doksik. A régi teszt-kód/modell eldobva.
Stack (MVP): Node/TS, Postgres (RLS+JSONB), Playwright, Claude API; build-vs-buy; managed felhő.

### ⭐ Kereszt-metsző alapelvek (minden fázisra — lásd ROADMAP tetején)
- **A1 — Automatizálás-elsőbbség:** minden folyamat besorolandó (Automatizált / Manuális→tenant / Manuális→ház);
  minden manuális pontnál kötelező kérdés: hogyan automatizálható később? Az automatizáció = fő értékajánlat.
- **A2 — Kivétel-alapú, önmagát visszavonó ember a hurokban** (kuráció, pénzügy, support).
- **A3 — Nyelv ≠ korlát; AI-vezérelt kontextus-lokalizáció** (nem hardcoded; Site/admin/outreach). Határ: jog+formátum+pénznem = determinisztikus, ország-szabály.
- **⚠️ A4 — A mock ALAPJA = bizalmi alapkő; TÖBB-RÉTEGŰ ellenőrzés** (provenance + több-jeles párosítás + kereszt-forrás korroboráció + AI-ellenőr + konfidencia-fallback + kuráció + tulaj-megerősítés). „Bizonytalanság → kevesebb, sosem hamis." A provenance/verifikáció a scraper+generátor melletti 3. bizalom-kritikus komponens. Részletek: BACKLOG.

### Fázis 1–2 fő felismerések (röviden)
- ⭐⭐ **3 becsatlakozási pont: KÍNÁLAT · ELÉRHETŐSÉG · KONVERZIÓ** — egy Iparág-definíció = e 3 interfész implementálása; minden más közös (Fázis 2, két iparágon igazolva).
- ⭐ A motor **Iparág × Ország** kétdimenziós: `Site = Tenant + (Iparág-def × Ország-lokalizáció) + Vállalkozás-profil + Modulok`.
- ⭐ **Control plane (mi világunk) vs. Data plane (honlap világa, per-tenant izolált)** — entitlement-vezérelt provisioning (instant modul-aktiválás). Tiered izoláció (RLS+PII-titkosítás), hibrid adatmodell (fix mag+JSONB), hibrid render (statikus+dinamikus szigetek), réteges időtárolás.
- ⭐ **Két moduláris platform:** külső (tenant Site-modulok) + belső (operátor back-office: pénzügy/sales/CRM/bizonylat) — külön RBAC.
- ⭐ **Két kulcs-motor:** scraper/lead-discovery (volumen) + generátor (termék). A **scraper is Iparág × Ország** paraméterezett (platform-regiszter: globális/lokális-nagy/helyi-kicsi + digitális lábnyom-profil; kvalifikáció: nincs/elavult/modern honlap). MVP: szállás + Balaton (teszt).
- ⭐⭐ **A „nincs semmije" lead a LEGÉRTÉKESEBB szegmens** (max hozzáadott érték + konverzió + verseny-mentes). Technikailag legnehezebb (kevés anyag), üzletileg legjobb → a „minimál-adatból varázslatos mock" képesség a fő MOAT. Megoldás standardizáltan: régiós kontextus-scraper + stock/placeholder + AI (lásd BACKLOG).
- ⭐ **Meta-domain jelenlét mindig megmarad** → aggregátor/portál vektor (saját booking-alternatíva; Fázis 6).
- Kötelező **tenant-izoláció**; a vendég nem üzleti aktorunk. Modul-taxonómia + minimum→szofisztikált à la carte lépcső.

## Státusz
- **Alapmodell rögzítve (jóváhagyott):** iparág-AGNOSZTIKUS, AI-üzemeltetett, volumen-alapú
  disztribúciós gép. Elsődleges ígéret = LÁTHATÓSÁG. Horog = előre kész, személyre szabott mock.
  Tölcsér: lead-scrape → mock (előre kész) → multi-csatorna megkeresés → élesítés (= 1. fizetős kapu)
  → moduláris upsell → megszűnéskor inaktiválás.
- **⚠️ A régi `src/` (Property-központú szűk szállás-modell) + DOMAIN `02-ENTITY-MAP` ELDOBVA.**
  Csak teszt-visszaigazolás volt (badacsonyi validáció: 85% nincs saját honlap). Tényleges
  `git rm` az új struktúra scaffoldjakor.
- Git remote: github.com/olaszferenc/citoviso — push továbbra is deploy key-re vár.
- Éles hoszting/deploy: TBD.

## Parkolt ötletek
`_planning/BACKLOG.md` — pl. interaktív mock-konfigurátor + élő próbatér (fizetés előtt); adat-vezérelt lead-priorizálás.

## Következő lépés (folytatás innen)

**A modul-szál 2026-08-21-én lezárult** (ADR-0046/47/48/49, 4 commit felküldve). Sorrendben, ami hátra van:

1. **`seasonal_only` + nincs booking = ál-választás?** A „csak a felsorolt időszakokban adom ki"
   kapcsoló a PRICING képernyőn ül (tulaj jóváhagyta). Ha a tenant nem vette meg a booking modult,
   a kapcsolónak ma nincs látható hatása. Vagy rejtsük booking nélkül, vagy adjunk neki
   booking-független jelentést (az ártáblán: „ebben az időszakban adjuk ki"). **Ez az első, mert
   a doktrína szerint amit nem támogatunk, azt nem kínáljuk.**
2. **KB-bejegyzés + súgó-horgony** a vélemény-kezelőhöz és a szezon-kapcsolóhoz (ADR-0045 §J).
   ⚠️ A `kb-check --coverage` ma csak a MÁR KITETT horgonyokat kéri számon, tehát az új
   admin-funkció súgó nélkül némán átcsúszik — ezért kell kézzel odafigyelni rá.
3. **`POST /api/hirlevel` nem létezik** — a hírlevél-űrlap a semmibe küld (ugyanaz a hibaosztály).
4. **ÉLES DEPLOY** — a prod a `0022`-nél áll; a `0023`–`0028` migráció és a teljes modul-réteg
   hiányzik. Külön, scope-olt engedély kell hozzá.
5. `booking-maintenance` cron (nem sürgős, a portál-szinkron sötét).

**Tesztelés:** `npx tsx scripts/demo-tenant.mts` → háromegységes demó, kiírja a belépést (csak helyi
DB-n fut). Szerverek systemd alatt: konzol :4600, publikus :4800 (`tsx watch`, önjavító).

## Nyitott kérdések (szándékosan elhalasztva a folyamat-modellig)
- Pénzügyi séma: előfizetés / egyösszeg / kombináció — képlékeny.
- Visszatérő érték / churn; upsell-időzítés.
- Hotlink-kép üzemeltetési törékenysége (idegen szerver leszedi → kép eltűnik).
- Google Maps kép-kivétel kezelése.
- Kiküldés-előtti belső jóváhagyás részletei.
- Globális enterprise-nyitottak: ki a "user" (tenant vs. végfelhasználó), időtárolás/audit mélysége,
  booking-sync (Booking.com/Airbnb) vs. tiszta direkt-foglalás, i18n-mélység (RTL/CJK, pénznem, jog).

## Előzmények
- 2026-08-21: **A választó, ami nem választott.** A lead-oldal kinézet-kártyáin a képre kötött
  `preventDefault()` letiltotta a label aktiválását — a kártya 80%-a csak nagyított. Elv rögzítve:
  az elsődleges művelet kapja a nagy felületet, a másodlagos saját vezérlőt. Új böngészős
  viselkedés-őr önteszttel (`scripts/template-picker-check.mts`), pre-commitba kötve.
  Éles: `fe6f856` → `admin.citoviso.com`.
- 2026-08-21: **MODULOK — a beállítástól a renderelt oldalig (ADR-0044).** Kiváltó: „megvetetjük a
  tenanttal az összes modult felárért, oszt nem tudja beállítani". FŐ TANULSÁG: az őr azt mérje, ami
  SZÁMÍT — a lint „van-e űrlap"-ot mért, nem „látszik-e az oldalon", és napokig zöld volt, miközben a
  tenant beírta a felszereltséget és semmi nem történt (3× ugyanaz a hibaosztály, vö. ADR-0043).
  Leszállítva: modul-konfig réteg (SITE-kulcs, verziózott, history) · EGYSÉGEK (`site_unit` = egy
  igazság: rooms mutatja / booking foglalja / pricing árazza) · egységenkénti ár ismétlődő szezonokkal ·
  foglalás kérés→levélből-döntés→visszaigazolás, duplafoglalás DB-kulccsal kizárva · iCal-réteg
  (kompatibilitás, UI sötét — a Booking-integráció NEM scope) · portál-scraper · vendég-oldali
  foglalási űrlap · egység-aloldalak `/apartman/<slug>` a főoldallal AZONOS recepten (stílus-azonosság
  mérve, 16 sablon) · §A fotó-doktrína LEZÁRVA (önnyilatkozattal minden demó-kép élesíthető).
  Kapuk a pre-commit-ben: module-config-lint, module-render-check, unit-subpage-check, +fixture-kapuk.
  Nyitott: `reviews` (nincs vélemény-adat), ÉLES DEPLOY (prod a 0022-nél áll).
- 2026-08-20 (konverzió-szál): **A konverziós modulokat a TULAJ választja, nem az operátor.** A lead
  „Mock-artefaktumok" konverziós lépéséből TÖRÖLVE az operátori „Megrendelt modulok" checkbox — a tulaj
  a prospect-konfigurátorban (ALL-IN nyit) dönt (`order_intent`). Új egyetlen forrás:
  `modulesForConversion()` (`src/modules.ts`), ALL-IN fallbackkal; `convertForm` read-only; convert
  handler az order-ből dolgozik. Éles: commit `582e12f`, `admin.citoviso.com` restartolva (scp-deploy,
  nincs git a prodon). Részletek: `_planning/memory/2026-08-20_conversion_modules_from_owner.md`.
- 2026-07-07/08 (tervezés+infra szál): **1. INFRA-PILLÉR — tartós adat-réteg leszállítva:** embedded
  Postgres 18 (userspace, `.pgdata`, socket :5433) + Kysely + saját migráció-runner; 6 mag-entitás
  (`migrations/0001`, `src/db/`). **4 planning-doksi:** `PROCESS.md` (réteges, event-driven ügyviteli
  folyamat), `CONTEXT.md` (validációs brief), `PILOT.md` (instrumentált tanuló-pilot a megrendelésig),
  `VISIBILITY.md` (felfedezhetőség-motor + retention). ⭐ Fő felismerések: **iparág-agnosztikus** (a
  szállás csak az ELSŐ vertikum — CLAUDE.md+memória javítva); **láthatóság ≠ honlap** (kell auto
  felfedezhetőség-motor: SEO+Schema.org+GBP fél-automata); **retention = leállítható dinamikus funkció**
  (foglalás=OTA-jutalék-kiváltás), NEM a tartós, odaadott láthatóság; pilot-számlázás **Mineral-híd** +
  fallback. **Következő (build): 2. pillér — motorok átkötése az adat-rétegre + instrumentált preview.**
- 2026-07-07: **Presence-detektálás** (scraper). Feltárt kritikus rés: a „nincs honlap" eddig csak a
  Maps `websiteUri` hiányából jött (nem bizonyíték). Kutatás: Bing Search API halott, Google CSE
  „entire web" kivezetés alatt (2027-ig). Megoldás: guess+geo-verifikált HTTP-proba (0 API). ⚠️ VÉRREL
  TANULT: naiv guess 4/8 hamis pozitív → talált honlap CSAK geo-egyezéssel érvényes (§F invariánsok).
  Leszállítva: `src/scraper/enrichPresence.ts` + run.ts-bekötés + `03-INVARIANTS.md` §F. Következő: Brave.
- 2026-07-04 (session 2): MEGÉRTÉS fázis. A tulaj elmondta az iparág-agnosztikus disztribúciós-gép
  modellt; üzleti-folyamati kérdésekkel közösen tisztáztuk (fő ígéret, mock-mechanika, jogi állás,
  domain, humán-pontok). Alapmodell jóváhagyva és mentve. Régi kód/modell eldobásra jelölve.
- 2026-07-04 (session 1): Repó létrehozva (Node+TS scaffold + doktrínák). Remote/watchdog per-repo
  CIT idle-slot. Badacsony piac-teszt (85% nincs saját honlap) validálta az ötletet. Árazás +
  motor-tanulságok + remote-setup a `_planning/memory/`-ban.

# 2026-09-25 — Az író kapuk auditja: ki futhat az író-sávban (ADR-XXXX)

**Kérés (tulaj, 2026-09-25):** „két párhuzamos lehetőség: várakozósor szervező + 14 író kapu auditja” —
ez a MÁSODIK (brief: `~/rc-briefs/gate-writer-audit.md`). Előzmény: ADR-0227 (a ② fázis írói sorban,
~186 s a 266-ból). Feltétel: kapu és állítás nem csökkenhet; egy rossz jelölés újranyitná a mért
versenyosztályt (`prospect-owned-check` globális számláló · `module-upsell` fix scratch-DB · `mock-photo-gate`
közös `sites/`).

## A halmaz: 27, nem 14
A brief 14 nevet sorolt; a `<git-common-dir>/cit-gate-writers` regiszter az audit napján **22 sort** tartalmazott
(a lista futásról futásra nő, ahogy a csak-olvasó elutasítás új írót jelöl), és a briefben nevesített 5 kapu
(programs-editor · booking-screen · room-editor · booking-offer · season-year-price) NEM volt rajta. A kettő
uniója = **27 kapu**, mind auditálva (öt párhuzamos olvasó ügynök, közös rubrika, `fájl:sor` idézetekkel,
termék-függvényekig követve; utána a szerkezeti őr és a lenti FK-tények kézzel ellenőrizve).

## Két mért tény, amin a verdiktek fele múlik
1. **`lead.scrape_run_id … ON DELETE CASCADE`** (`migrations/0001_core_entities.sql:36`), és 22 kapu a
   `finally`-jában törli a SAJÁT `scrape_run`-ját. Aki tehát „bármelyik” `scrape_run`-t kölcsönzi FK-szülőnek
   (`selectFrom("scrape_run").select("id").executeTakeFirst()`, vagy rosszabb: `orderBy created_at desc limit 1`
   = a LEGFRISSEBB = nagy eséllyel egy testvér épp beszúrt sora), annak a teljes fixture-ét (lead → tenant →
   subscription → order → payment) egy testvér takarítása viszi el mérés közben. Mérve: a `scrape_run` 0.
   heap-lapján 86 sor él, MIND kapu-fixture-címkés (`_mcfg_check | bookingscreen | mlresume | mltierchk |
   modpaychk | wholecheck`) — a park régi sorai kitörlődtek, a slotokat a kapuk töltik újra, tehát a
   „heap-első” sor ma is kapu-fixture. Érintett: **wallet, charge-retry, order-paylink, outreach-link-live,
   mock-photo-gate**.
2. **`site.source_artifact_id` SET NULL** (`migrations/0004_conversion.sql`) + `loadSiteForEdit` `null`-t ad,
   ha az artifact hiányzik (`src/tenant/editor.ts:560`) → a tenant-admin lapok elhalnak. Aki „az első élő
   site” artifactját kölcsönzi (`where status='live' … executeTakeFirst()`), az egy testvér (pl. market-gate)
   törlődő artifactján ül. Érintett: **booking-offer, season-year-price, price-on-request**; a consent-check /
   consent-style a mérés TÁRGYÁT választja így (üres zöld, ill. `tenant_user … limit 1` → a testvér törölt
   felhasználójával `/admin` → valódi piros).

## Az audit táblázata (27 kapu)
| kapu | ír (dev-DB táblák) | globális olvasás | egyéb közös erőforrás | verdikt · ok |
|---|---|---|---|---|
| module-dependency | scraper_definition, scrape_run, lead, tenant, site, site_unit, module_entitlement, prospect, order_intent, payment (`_moddep_<ts+pid>`) | csak konfig (`loadPricing`, `settings.module_sales_disabled`) | — | **sáv** |
| pay-mock-upsell | scraper_definition, scrape_run, lead, prospect, tenant, order_intent, payment (`_payup_<stamp>`) | nincs | port 0 ×2 | **sáv** |
| barion-webhook-ack | scraper_definition, scrape_run, lead, prospect, order_intent, payment (`ackchk<ts>`) | nincs | — | **sáv** |
| market-gate | market(+log) `X<pid%26>`, scraper_definition, scrape_run, lead, mock_artifact, prospect, order_intent, tenant, payment | HU market-sor (senki más nem írja) | — | **sáv** (⚠️ fák KÖZÖTT 1/26 ön-ütközés a pid%26 miatt — nem sáv-kérdés) |
| module-purchase-state | scraper_definition, scrape_run, lead, tenant, site, prospect, order_intent, payment, multilang_generation (`modpaychk<ts>`) | konfig (`loadPricing`) | — | **sáv** (⚠️ `scrape_run`+`scraper_definition` sosem törlődik: 380+380 árva sor mérve) |
| entitlement-paid | CSAK scratch-DB (`scratchDbName`) | dev-DB drift-riport szűretlen, csak `console.log`, nem ítél | — | **sáv** (nem dev-író) |
| domain-renewal | CSAK scratch-DB | nincs | — | **sáv** (nem dev-író) |
| module-upsell | CSAK scratch-DB | nincs | — | **sáv** (nem dev-író; a memória „fix scratch-név” jegyzete elavult, ADR-0223 ③ óta egyedi) |
| renewal-date-coherence | CSAK scratch-DB | nincs | `mkdtemp` preview, `file://` | **sáv** (a legtisztább: futás-random bélyeg) |
| multilang-tier | scraper_definition, scrape_run, lead, tenant, mock_artifact, site, prospect; termék: order_intent, multilang_generation | konfig (`loadPricing`; beégetett 22 900/30 000 függ tőle, testvér nem írja dev-ben) | `mkdtemp` | **sáv** (⚠️ `scrape_run`+`scraper_definition` árván marad futásonként) |
| coupon-rounding | scraper_definition, scrape_run, lead, prospect, tenant, order_intent, offer, module_entitlement | konfig (`module_price`, referencia és termék ugyanabból a cache-ből) | `setContent`, nincs szerver | **sáv** |
| programs-editor | + settlement (pid-alapú osm_id), event_gather_run, local_event, site_module_config | földrajzi (30 km-es kör a `settlement`/`local_event`-en) — az egyetlen másik seeder (module-config-check) 68 km-re, és NEM sáv-tag | `sites/<tenantId>` | **sáv** |
| booking-screen | scraper_definition, scrape_run, lead, tenant, tenant_user, mock_artifact, site, module_entitlement, site_unit, booking_request, availability_day | nincs (DOM-számlálás saját sütivel) | `assets/Temp` fix név CSAK `--shots` alatt (allow-indok) | **sáv — a jelölés FÜGGŐBEN** (audit-verdikt: own-fixture-only, de ebben a körben NEM jelöltem: a fájl érintése a saját triggerét tüzeli, és) ⚠️ **a kapu MA az origin/main-en (8fefaf00) egyedül futtatva is PIROS** (fixture-ablak 09-29…10-01 + kézi blokk 10-04 nem fér a szeptemberi naptárba; fagyasztott órával 09-25 piros, 09-30/10-01 zöld — a szülő session mérte). NEM versenyhiba, külön szálon javul; a lenti versenymérésből ezért KIHAGYVA, és a jelölés az első zöld napján egy sorral pótolandó (a marker + `gate-lane-allow` az `assets/Temp` soron). |
| room-editor | mint booking-screen + 3 site_unit, `sites/<tenantId>/uploads` | nincs | `assets/Temp` fix név CSAK `--shots` alatt; `os.tmpdir()+Date.now()` | **sáv — a jelölés FÜGGŐBEN** (audit-verdikt: own-fixture-only; a versenyben 10/10 zöld load ≤35-ön), de ebben a körben NEM jelöltem: **terhelés-törékeny** — egyedül futtatva load 23–45-ön háromból három piros, KÉT különböző mechanizmussal: ① a negatív kontroll 80 ms után a `.rs-libcell img` opacitás-ÁTMENET közbenső értékét olvassa (`off:0.55371`, `var(--citui-transition)`), ② a süti-párbeszéd elfogja a Mentés kattintását (`dismissConsent` után is). Nem sáv-hiba; az ① mechanizmust a rebase alatt egy MÁSIK szál már landolta (`cfc4e5db`, 220 ms-os átmenet — a saját, azonos javításomat igazolatlanul visszavontam, kétszer nem írjuk meg), a ② nyitva; a jelölés a stabil zöld után — addig a triggerét sem szabad megérinteni egy másik szál commitjából. |
| consent | site_visit egy IDEGEN site_id-ra (fire-and-forget; saját fixture NINCS) | „első élő site” szűretlen (`:68–73`) — a mérés tárgyát választja; testvér-fixture-nél 404 → üres zöld | port 0 | **soros** · kölcsönzött sor (kétség = bukás) |
| consent-style | site_visit (4 GET) | `tenant_user … limit 1` (a `claude-test` horgony NINCS a parkban → mindig ez, `:117–123`); `site live limit 1`; `preview_token limit 1`; `mock_request limit 1`; `payment paid orderBy asc` | port 0 ×2 | **soros** · a testvér törölt tenant_user-ével `/admin` → valódi piros |
| wallet | lead, tenant, prospect, order_intent, subscription, payment, saved_card_history (`hrtime`) | **`scrape_run` szűretlen `executeTakeFirst()` (`:268`) FK-szülőnek** | `mkdtemp` | **soros** · CASCADE a testvér takarításától |
| charge-retry | lead, tenant, prospect, order_intent, subscription, payment | **`scrape_run` szűretlen (`:116`)** | — | **soros** · ugyanaz |
| mock-photo-gate | lead, mock_artifact, curator_decision | `scrape_run orderBy id limit 1` (`:382–387`), `operator_user limit 1` | `sites/_photo-gate-check-<pid>` | **soros** · kölcsönzött sor (ma egy tartósan árva sorra mutat, de nem szerződés) |
| order-paylink | lead, mock_artifact; termék: prospect, order_intent, curator_decision, payment, invoice | **`scrape_run` szűretlen `executeTakeFirstOrThrow()` (`:86`)** | mock gw, nincs szerver | **soros** · CASCADE |
| outreach-link-live | lead, prospect (pid) | **TELJES `prospect` tábla (`:83–86`) → MINDEN lead lapja ítélve**; `scrape_run … orderBy created_at desc limit 1` (`:304`); `operator_user limit 1` | port 0 | **soros** · globális enumeráció + legfrissebb scrape_run |
| upsell-atomicity | scraper_definition, scrape_run, lead, prospect, tenant, order_intent, payment; termék: module_entitlement, invoice | nincs az ítéletben | **`CREATE/DROP TRIGGER ON module_entitlement`** (`:186, :214, :254, :269`) — SHARE ROW EXCLUSIVE zár, 19 kapu ír ebbe a táblába | **soros** · táblaszintű DDL |
| partner-registry | CSAK scratch-DB | `count(*) partner` — scratchen | **`rm -rf outbox/` (`:160, :190`)** + `files.length === 1` a közös outboxon | **soros** · a közös `outbox/` törlése (booking-offer/season-year-price/price-on-request ott várja a saját levelét) |
| scrape-liveness | scraper_definition, scrape_run (`ŐR-…-<stamp>`) | `getScrapeRuns(40)` = globális `limit 40` + **`reapStaleScrapeRuns()` UPDATE az EGÉSZ táblán** | — | **soros** · globális söprés+mutáció |
| price-on-request | scraper_definition, scrape_run, lead, tenant, site(live), site_unit, unit_price, tenant_user, module_entitlement, tenant_message; `sites/por-<stamp>` | **„első élő site” artifact kölcsön (`:125–126`)** (SET NULL → admin-lap elhal) | `outbox/` olvasás címzett+mtime szűrve; `assets/Temp/_por-${SCOPE}` | **soros** · kölcsönzött artifact |
| booking-offer | + booking_request, availability_day, tenant_message; `sites/offer-<stamp>` | **`maintainDatedPrices(today)` ×3 (`:447–453`) — MINDEN tenant unit_price-a, és `m2.reminded === 0` GLOBÁLIS számláló az ítéletben; `expireStaleOffers()` (`:426`) minden tenant**; + „első élő site” artifact (`:125–127`) | outbox olvasás szűrve | **soros** · globális söprés (más tenant sorait bélyegzi/törli/levelezi; a season-year-price pozitív kontrollját ELVINNÉ) |
| season-year-price | mint booking-offer | **`maintainDatedPrices(today)` ×2 (`:420, :427`)**; „első élő site” artifact (`:120–122`) | outbox olvasás szűrve | **soros** · ugyanaz a söprés, verseny a booking-offerrel a ugyanarra a reminder-claimre |

**Összesen: 12 jelölt a sávban (+2 függőben: booking-screen, room-editor) · 13 soros.** A 12-ből 4 egyáltalán nem dev-DB-író (scratch-DB), csak a `CREATE DATABASE`
akad fenn a csak-olvasó módon.

## Amit építettem
- **Jelölés a forrásban** (2. lépés): `// gate-lane: own-fixture-only` + 3 magyarázó sor 12 kapu fejlécén (booking-screen és room-editor a fentiek miatt függőben —
  mindkettőnél az `assets/Temp` sorra `// gate-lane-allow: csak --shots alatt ír` indok kell majd).
- **Őr** (3. lépés): `scripts/gate-lane-check.mts` — a jelölt kapuk forrásán tíz szerkezeti osztály: ① kysely-lánc
  `.where` nélkül · ② nyers SQL `where` nélkül sémabeli táblán · ③ LIKE-takarítás · ④ fix port · ⑤ fix `/tmp`/`assets/Temp`
  · ⑥ scratch-DB `scratchDbName` nélkül · ⑦ ismert söprő hívás (`maintainDatedPrices`, `expireStaleOffers`,
  `getScrapeRuns`, `reapStaleScrapeRuns`, …) · ⑧ közös `outbox/` (törlés kivétel nélkül tilos, olvasás indokkal) ·
  ⑨ kölcsönzött sor (csak literál-predikátumú `where` + `executeTakeFirst`/`limit(1)`) · ⑩ táblaszintű DDL. Kivétel
  csak `// gate-lane-allow: <indok ≥ 8 kar>`. Piros önteszt: 19 szintetikus sértés + tiszta fixture (2 indokolt
  kivétellel) + negatív kontroll (a wallet-check jelöletlenül is 1 leletet ad). `--probe <fájl>` az audithoz.
  ⛔ Amit NEM lát: a termék-függvények belsejét (ezt az audit + a ⑦ lista adja) — a listát új söprőnél bővíteni kell.
  Hook: mindig fut (~1 s CPU), a saját/futtató változásakor öntesztet is.
- **Verseny mérve** (4. lépés): lásd lent.
- **Író-sáv a futtatóban** (5. lépés): lásd lent.

## Verseny MÉRVE (4. lépés)
A 13 akkor-jelölt kapu (a booking-screen KIHAGYVA; a room-editor még benne volt, 10/10 zöld — lásd fent, ma egyedül is piros) **4 szálon, 10 fordulóban,
egy munkafából, a fő fa közös dev-DB-jén, terhelt gépen (közben a futtató-őr 11-es önteszte és ~10 másik session
is futott): 130 kapu-futás, 0 bukás.** Harness: session-privát `race.mjs` (pool 4, exit-kód + idő futásonként).
Forduló-idők: 50 · 50 · 52 · 66 · 143 · 131 · 100 · 82 · 81 · 65 s (a 5–7. forduló alatt futott az önteszt).
Kapunként (átlag / max, s): room-editor 39,7/70,7 · renewal-date-coherence 32,2/55,7 · domain-renewal 23,0/36,8 ·
module-upsell 21,8/34,3 · entitlement-paid 20,9/37,4 · programs-editor 17,1/36,9 · multilang-tier 12,9/28,4 ·
coupon-rounding 10,9/19,5 · pay-mock-upsell 10,8/23,1 · module-dependency 9,9/19,6 · market-gate 9,8/20,7 ·
module-purchase-state 9,7/19,7 · barion-webhook-ack 9,5/19,1. (Sorban, egyedül ugyanez a 13: ~211 s — lent.)

## Író-sáv (5. lépés) — `scripts/lib/gate-runner.mjs`
A ② fázis két sávra vált: a futtató a kapu forrásának első 40 sorában keresi a `// gate-lane: own-fixture-only`
sort (`laneMarked`); a jelöltek ugyanazon a `pool()`-on futnak, mint az ① fázis (PARALLEL szál, „szkript önmagával
nem fut”, első piros után nincs új ütemezés), a jelöletlenek UTÁNUK sorban, a hook sorrendjében. Összegző sor:
`… · N író-sávban (jelölt, K szál) · M sorosan (író) · …`. `CIT_GATE_JOBS=1` = minden sorban.
⚠️ A párhuzamos „Kapu-várakozósor” szál (gép-szintű slot-szemafor a `run()` köré) a land pillanatáig NEM landolt
az origin/main-re — a sáv a jelenlegi `run()`-t hívja, a slot-kérés a `run()` köré kerülve automatikusan a sávra is
vonatkozik majd.
Őr: `scripts/gate-runner-check.mts` **F forgatókönyv** (három előre regisztrált író: két jelölt ÁTFED — >300 ms —,
a jelöletlen csak a sáv vége UTÁN indul; az összegző sor kiírja a sáv-számot) + 2 új visszarontás („a sáv-jelölés
vak” → nincs átfedés; „minden író a sávba” → a jelöletlen is átfed): **11/11 piros, A–F zöld.**

**A/B a teljes hookon (ugyanaz a szintetikus diff, régi = origin/main futtató, új = ez, gyorsítótár KI):**
- 1. kísérlet (ADR-0227 4 felületi fájlja): MINDKÉT futás a booking-screen-check-nél állt meg (ma piros a main-en,
  naptár-ablak — lásd fent), a régi 208 s-nál a soros írók közepén, az új 120 s-nál a sáv után a szigorú sáv előtt →
  **egyik szám sem mérvadó** (alsó korlátok, nem összehasonlíthatók). Feljegyezve, nem eredményként.
- 2. kísérlet (adminViews.ts · citui-admin.css · payment/service.ts · console/views.ts — sok író, booking-screen
  trigger nélkül; load 18–22, 5 idegen hook futott közben): **mindkettő zöld, 106 kapu (84 olvasó · 22 író).**
  Régi: 22 író sorban, **1028 s** összesen (load 30–40 alatt). Új: 11 a sávban + 11 sorban, **684 s** (load ~20). A
  terhelés-különbség miatt az összidő NEM tiszta A/B — a kapunkénti `CIT_GATE_TIMES` viszont igen: az olvasók Σ-ja
  1679 → 1247 s (a régi futás ~35%-kal lassabb gépen ment). A ② fázis soros-egyenértéke: régi 208 (sáv-tagok) + 381
  (szigorúak) = **589 s sorban**; új: a 11 sáv-tag Σ=170 s 4 szálon (≈45–70 s fal), + a szigorúak Σ=294 s → **≈350 s**.
  Terhelés-korrigálva a régi ② ≈ 437 s → **a sáv ~90–110 s-ot vesz le a ② fázisból ezen a diffen.** A maradék soros
  időt egyetlen kapu uralja: **outreach-link-live 159 s** (minden lead lapját megnyitja) — a következő nyereség NEM
  több párhuzamosság, hanem a soros kapuk kölcsönzött sorainak megszüntetése (5 kapu, egy-egy sor) és az
  outreach-enumeráció szűkítése (lásd „Nyitva”).

## Alapvonal (egyenként, sorban, 2026-09-25, terhelt gépen — load 5–16)
Sáv-jelöltek (s): module-dependency 4 · pay-mock-upsell 23 · barion-webhook-ack 22 · market-gate 22 ·
module-purchase-state 20 · entitlement-paid 27 · domain-renewal 20 · module-upsell 11 · multilang-tier 7 ·
coupon-rounding 3 · renewal-date-coherence 21 · programs-editor 5 · room-editor 26 · (booking-screen 11, rc=1) →
**Σ ≈ 211 s** (a 13 zöld). Sorosak (s): consent 26 · consent-style 56 · wallet 28 · charge-retry 18 · mock-photo-gate 48 ·
partner-registry 15 · scrape-liveness 3 · order-paylink 5 · upsell-atomicity 4 · price-on-request 13 ·
**outreach-link-live 154** (minden lead lapját megnyitja — a park méretével nő) · booking-offer 34 · season-year-price 30
→ Σ ≈ 434 s. Egy adott diffen persze nem fut mind a 27.

## Nyitva / javaslat a tulajnak (NEM csináltam meg — kód-módosítás a kapukban)
- **A „kölcsönzött sor” osztály az EGÉSZ kapusorban él, nem csak az íróknál.** A szülő session mérte: a
  `help-collapse-check` (OLVASÓ, ① fázis, minden commiton fut) `tenant_user⋈site limit 1` (:47–51),
  `operator_user limit 1` (:45), `partner limit 1` (:382) park-sort mér; ma két fában pirosra ment („van találati
  csoport — 0”, „JS NÉLKÜL 3 cikkcím — 0”, TimeoutError), majd 5/5 zöld ugyanazon a terhelésen — a tünet pontosan a
  kölcsönzött sor eltűnése egy testvér-SESSION írójának takarítása alatt (sessionek KÖZÖTT az író és az olvasó
  átfed; a futtató csak egy sessionen belül rendez). Bizonyítatlan, javítás nem történt. A szerkezeti őr
  `--probe`-jával az összes `*-check.mts`-en végigmérve **36 kapu 73 helyen** olvas kölcsönzött/szűretlen egyetlen
  sort (①/⑨ osztály): artifact-label-quote · booking-offer · button-weight · charge-retry · configurator-float ·
  consent · consent-style · console-contrast · copy-panel · dialog-fires · domain-provision · help-collapse ·
  hero-override · hero-override-ui · hu-machine-form · internal-ref · kb-translation-coverage · lead-page-surface ·
  mock-card-plan · mock-photo-gate · module-preview-nowrite · order-paylink · outreach-link-live · outreach-preview ·
  outreach-row-truth · outreach-sendability · outreach-send-bar · partner-registry · pattern-badge · price-on-request ·
  prospect-owned · quote-request · scrape-liveness · season-year-price · verdict-dialog-dom · wallet.
  Ez egy KÜLÖN szál tárgya (a park horgony-sorai — `claude-test` operátor/tenant_user, egy állandó „park” site —
  hiányoznak vagy nem védettek; a kölcsönzés helyett kimondott, sosem törlődő horgony kellene).
- **Egy-soros javítások, amik 5 soros kaput sávba emelnének:** saját `scraper_definition`+`scrape_run` a
  wallet, charge-retry, order-paylink, mock-photo-gate, outreach-link-live kapukban a kölcsönzött sor helyett
  (a module-dependency `:201–217` mintája). Az outreach-link-live-nál ettől még marad a teljes `prospect`-enumeráció.
- **`claude-test` tenant_user a parkba** → a consent-style horgonya él, a `limit 1` fallback nem fut.
- **Takarítás-lyuk:** module-purchase-state (380+380 árva `scrape_run`/`scraper_definition`), multilang-tier,
  booking-screen, room-editor sosem törli a `scrape_run`-ját — ezek az árvák a „legfrissebb/első” kölcsönzők célpontjai.
- **⚠️ Mellékes, nem sáv-kérdés:** `.env` `EMAIL_PROVIDER=smtp` mellett a booking-offer / season-year-price
  `maintainDatedPrices`-sweepje VALÓDI levelet küldhet bármely dev-tenantnak, akinek nem-fenntartott `contact_email`-je
  és 14 napon belül lejáró dátumos ára van (az ügynök lelete, kód-olvasásból).
- `module-purchase-state-check.mts:347` egy NUL bájtot tartalmaz → a sima `grep` binárisként kihagyja (repo-széles
  grep-őrök vakfoltja).

# 2026-09-30 — A nagy deploy végrehajtása (koordinátor, citc4db0d86)

**Éles = `a1b134e6fdaee06a8d27231b206537a8b4ce807f`** (tag `prod/20260930-0839`), a `263ef8dd` (prod/20260924-1004) után:
344 commit, 1246 fájl, 10 migráció (0071–0080), séma 0080-ig. Brief: `~/rc-briefs/deploy-vegrehajtas-koordinator.md`.
Naplók: `~/rc-briefs/reports/deploy-keszenlet/deploy-dry-20260930-080453.log`, `deploy-go-20260930-081820.log` (1. futás), `deploy-go2-…log` (2. futás).

## Menet (UTC)
1. 06:04 száraz futás a munkafából (a fa HEAD = cél = fő fa HEAD): minden kapu zöld a GATE 6-ig; friss KB-token (`263ef8dd..a1b134e6`).
   Éles pg_dump a dev gépre is: `~/citoviso-prod-backups/db-20260930-0805.sql.gz`.
2. 06:16 **éles `.env` +10 kulcs** (mentés `/opt/citoviso/backups/env-pre-bigdeploy-20260930-081624`): `REGISTRAR_PROVIDER=websupport`,
   `DNS_PROVIDER=websupport` (ADR-0103 ③), a 4 `WEBSUPPORT_*`, 2 `CLOUDFLARE_*`, `GOOGLE_MAPS_BROWSER_KEY` (= az éles szerver-kulcs, a tulaj
   döntése; webcím-korlát NINCS rajta → külön, `*.citoviso.com/*`-ra korlátozott kulcs kellene), és a briefben nem szereplő 10.:
   **`DOMAIN_HUF_PER_EUR=380`** (nélküle a Websupport-vétel fail-closed, ADR-0103 ④). Értékek a dev `.env`-ből; sehol nem íródtak ki.
3. 06:18 `--go` #1: push, GATE 3 dump (`/opt/citoviso/backups/db-pre-20260930-081838.sql.gz`), checkout, npm, **10 migráció OK**, majd
   **GATE 5 ELBUKOTT**: `en: 3694/3701 — 7 UI-string hiányzik` (38 AI-hívás, 2,54 USD). A servicek nem indultak újra (régi kód, új séma —
   stabil; a domain-resume az új kódból hibátlanul futott: „nincs függő beszerzés”).
   Ok: mind a 7 `{Art} …` kezdetű (magyar névelő-placeholder); az AI angolban elhagyja, a placeholder-őr eldob, újrapróba nincs
   (`src/i18n/packs.ts` `translateBatch`). Determinisztikus: a restart utáni boot-öngyógyítás is ugyanazt a 7-et bukta.
4. 06:36 `--go` #2 ugyanarra a SHA-ra (tulaj-engedéllyel): HEAD egyezik → checkout kimarad; nincs migráció; **GATE 5 KIMARADT** (üres diff —
   a szkript nem nézte az éles csomag állapotát; javítva később: ADR-0281); GATE 6: 6 időzítő telepítve/visszamérve (+events, +events-pending,
   +`citoviso-alert@.service`, public/console OnFailure); restart console 303 (8 s) → public 200 (8 s). ✅ 06:39.
   ⚠️ A `DEPLOYED` utolsó sora `prev=a1b134e6` (önmagát látta előzménynek); a valódi előző verzió `263ef8dd`.
5. Füst-próba, olvasó rész: 6 időzítő fut, events-pending programokat gyűjtött, `/logout` sütije Secure+HttpOnly+Lax (HEAD → 405 szándékos,
   GET-tel mérve), `cf-cache-status: DYNAMIC`, 0 saját hiba. **Rerender** (`rerender-tenant --all`, engedéllyel): ferenc-haz + nyugalom-demo,
   a tenant hostok az új runtime-ot adják (galéria, egész-ház sáv, `#cit-unit`).
6. Vendég-út élesen a tenant hoston (`POST /api/foglalas`, ferenc-haz): kérés `FG-9DC835` (ár nélkül → ajánlat-út), vendég-levél a
   `olaszferenc+smoke@gmail.com`-ra helyes (nincs „(nem valódi)” lábazat), tulaj-levél kiment. Az ajánlat-utat nem vittük végig
   (a tulaj a teljes tölcsért kérte inkább egy teszt-leaden).
7. **Teszt-lead a teljes tölcsérhez:** a Muschel Panzió (a legadatgazdagabb nem-vásárló lead: 10 fotó, 8 forrássor) másolata
   „[TESZT] Muschel Panzió”, e-mail/telefon a tulajé. A tulaj mind a 19 skint legenerálta (tényhűség-őr: FLAG → kurátor-sor, ahogy kell),
   kiküldte (prospect, aurora), majd egy **98%-os `campaign` ajánlat-sorral** (4 880 → 97 Ft; egész-számos százalék, pontosan 100 nem
   jön ki) **valódi Barion-vásárlás 07:32**: payment paid, bérlő `teszt-muschel-panzio` élesítve, belépő kiment, üdvözlő kupon született.
   **Számla ELBUKOTT**: Számlázz error 378 (a fiók nincs összekötve a NAV Online Számlával) — a tulaj összekötötte; a kód-hiány
   (nincs riasztás/újrapróba/újrakiadás) → ADR-0283. A teszt-lánc kaszkáddal törölve 08:06 (mentés
   `/opt/citoviso/backups/testlead-muschel-20260930-080641.json`), a partner-sor („OLASZ-BALOGH VIKTÓRIA”) maradt; **új másolat:**
   lead `e629826b-ffdf-4877-b3e8-a4ce3de16069` — a tulaj ezen viszi újra a tölcsért, számlával.

## Élesen talált hibák és a sorsuk
- **Mock hős-címe** (tulaj, laptopon): a hosszú egyedi mondat `clamp(…7vw…)`-vel rálóg a fejlécre/CTA-ra (dark-luxury, transit; mind a 19 skin
  érintett lehet). → Koordinátor-SUB `~/wt/cit66a15e89` (brief `~/rc-briefs/mock-hero-tipo-koordinator.md`, képek
  `~/rc-briefs/reports/hero-tipo/`). Külön deploy viszi.
- **7 `{Art}` angol string** → SUB `i18nart`: ADR-0281 (újrapróba; névelő nem-magyar nyelven üres; GATE 5 fut, ha az éles csomag hiányos). Landolt.
- **SMS élesen nem ment**: éles `SMS_PROVIDER` hiányzott (mock → az `sms_outbox` üres maradt) ÉS a dev relay a dev szervert ürítette
  (`SMS_RELAY_URL=http://localhost:4800`). → 07:33 éles `.env` `SMS_PROVIDER=queue` (mentés `env-pre-smsqueue-20260930-073350`) + restart
  console→public; dev `.env` `SMS_RELAY_URL=https://citoviso.com` + az éles `SMS_RELAY_SECRET` (mentés `.env.bak-smsrelay-20260930-093450`);
  a relay elérte az élest („üres sor”). ⚠️ A restart-parancsom `set -e` alatt az első curl-nél kilépett: a console újraindult, a public nem —
  külön lépésben pótolva; mindkettő egészséges.
- **MMS élesen nem tud menni**: `mms-send` csak a dev gépen; relay nem volt; a konzol MMS-előnézete PIL nélkül bukott. → SUB `mmsrelay`:
  ADR-0282 (éles `mms_outbox` + pull/ack, dev relay-időzítő, sharp). Landolt; deploy után `MMS_PROVIDER=queue` élesen + dev timer.
- **Bukott számla néma** → SUB `szamlaretry`: ADR-0283 (riasztás, napi újrapróba, CLI-újrakiadás, Számlázz külső azonosító). Landolt;
  a „Számla újra ▸” gombot a tulaj a képeken jóváhagyta → SUB `utomunka3` landolja.
- **Places-backfill szárazon** (§4.8): 211 megerősítve, 56 telefon + 60 honlap levétele, 27 érintetlen — élesre a kör végén, engedéllyel.

## Tulaj-döntések (2026-09-30)
- Provider élesen websupport/websupport; HUF/EUR 380; a Maps böngésző-kulcs a meglévő szerver-kulcs (később külön kulcs).
- Teszt-bérlők (ferenc-haz, nyugalom-demo) törlése a füst-próba UTÁN, a `purge-test-data --go`-val (a próbavásárlás soraival együtt).
- Számla-gomb: mehet. Névelős fordítások újrakérése: igen (deploy után, élesen). Beragadt MMS: `unknown` + riasztás, nincs újraküldés.
  Esti MMS: a relay 19:30 után nem húz. **„Menjen élesre az MMS”** → új deploy a mai mainről (a hős-cím javítás külön, később).

## Második deploy (ugyanaznap): éles = `888e8875f71d6b2cb40fc599438aa072d3a928ea` (tag `prod/20260930-1216`)
- Tartomány `a1b134e6..888e8875`, 16 commit: ADR-0281 (i18n újrapróba + GATE 5 akkor is fut, ha az éles csomag hiányos), ADR-0282 (MMS-relay,
  0081 `mms_outbox`, sharp, esti tiltás 19:30), ADR-0283 (bukott számla riaszt/újrapróbál/CLI + „Számla újra ▸” gomb — a tulaj a képeken
  jóváhagyta), `i18n-article-refresh.mts`, KB-pótlás (a tudásbázis-őr két körben: az MMS-sor operátori állapotai és az `mms-relay` riasztás).
- KB-token: `node scripts/kb-gate.mjs pass "a1b134e6..888e8875" …` (az őr kivonata; a záró commit csak a két KB-fájlt érintette).
- Előtte éles `.env` `MMS_PROVIDER=queue` (mentés `env-pre-mms-20260930-101405`). Deploy 10:14–10:16 UTC: GATE 3 dump, 0081 OK,
  **GATE 5 egy hívásból pótolta a 9 hiányzó angol stringet (en 3703/3703, 0,02 USD)**, GATE 6 egyezik, restart 303/200. 0 hiba.
- Utána: dev gépen `citoviso-mms-relay.timer` telepítve (`/etc/systemd/system/`, percenként); élesen `i18n-article-refresh --go`
  (31 kulcs × 1 nyelv [csak `en` él], 0,06 USD, tiszta) — a szerverek a következő restartnál veszik fel.
- Az első deploy `DEPLOYED`-sorának `prev=` hibája nem ismétlődött (prev=a1b134e6 helyes).
- Nyitott döntés (utomunka3 lelet): az éles unitok UTC-ben futnak → a hideg SMS ablaka nyáron 10–22 budapesti idő; javítás a
  `sendWindow.ts`-ben budapesti órára (egy sor). A tulaj még nem döntött.

## Harmadik deploy (ugyanaznap): éles = `9c71b7f3999c45afad0169b3a6dbef2d2b334c22` (tag `prod/20260930-1400`)
- Tartomány `888e8875..9c71b7f3`, 2 commit, 22 fájl: **ADR-0284** — a hős-cím mérete a szöveg hosszától és a nézetablak magasságától
  (`templateKit.ts` `heroFit()`/`HERO_FIT_CSS`, 14 mondat-címes sablon `min(<clamp>, var(--cit-hero-cap))`, dark-luxury/horizontal/cinematic
  fejléc a folyásba alacsony asztalon, `scripts/hero-fit-check.mts` őr a pre-commitben). A tulaj az előtte/utána képeken (laptop 1320×570,
  asztali, mobil; `~/rc-briefs/reports/hero-tipo/`) hagyta jóvá a Deploy-koordinátorban; a jóváhagyást tmux-üzenettel adtam át a
  hős-cím sessionnek (`cit66a15e89`), jelentése `~/rc-briefs/reports/hero-tipo/jelentes.md` (skin-tábla 19 + 28 mockra, 4 méret).
- Nincs migráció, nincs KB/katalógus-változás (GATE 5 és KB-token nem kellett), GATE 6 egyezik; restart 303/200, 0 hiba (12:00 UTC).
- A 36 meglévő éles mock újrarenderelését a tulaj NEM kérte („teszt mock volt az élesen, inkább kezdem elölről egy új tesztmokkal”).
- Nem oldja meg: watercolor 1320×570-en a cím utolsó sora a hajtás alá esik (elrendezés, nem betűméret).

## Zárás (14:55 UTC+2) — a session archiválva a tulaj kérésére
- Élesen a zárás pillanatában **`d4a85b53`** (`prod/20260930-1433`): a negyedik mai deployt már egy MÁSIK koordinátor (`cit94bb80e7`,
  eszkalációs ajánlat admin, ADR-0285) vitte ki a tulaj engedélyével — a három deploy ebből a sessionből: 06:39 `a1b134e6`, 10:16 `888e8875`,
  12:00 `9c71b7f3` (UTC). A `DEPLOYED` és a `prod/*` tagek a forrás.
- A 4 SUB (i18nart, szamlaretry, mmsrelay, utomunka3) landolt, tiszta, retire-elve (watchdog `HANDOFF-RETIRE` 14:52); a hős-cím session archivált.
- ⚠️ A tulaj ELŐRE engedélyezte a 98%-os `campaign` ajánlat beírását a `e629826b…` teszt-lead ELSŐ prospectjére; a figyelő ezzel a
  sessionnel leáll — az új tölcsér-kör koordinátora írja be (mint a 7. pontban: `kind=campaign, percent=98, scope=initial, expires 24 h`).

## Folytatás (este, `561cbb96`, átadás után) — számla + SMS/MMS + takarítás
- 18:17 UTC: a rossz címzettű (`+36301200971` = a modem SIM-je) várakozó MMS `907a2c29…` → `failed` (tulaj: „nem jó a címzett”;
  a lead-szám nem default a kódban, csak a teszt-lead adata volt). Éles `.env` += `MOBILE_SEND_WINDOW_OFF=1`
  (mentés `/opt/citoviso/backups/env-pre-mobilewindow-20260930-181736`) — **⚠️ MÉG BENT VAN**, a teszt végén ki + restart.
- 18:20 UTC deploy `448a7480` (`prod/20260930-2020`; minden kapu zöld). Számla újra: **`CITO-2026-1` kiállítva** (97 Ft, Számlázz),
  levél a vevő-címre. A `szamlaKulsoAzon` nem okozott díjcsomag-hibát.
- Új teszt-lead: **„[TESZT] Lovász apartman”** `18905305-4551-4916-ab15-149506ea8c89` (10 fotó, 8 forrássor; e-mail a tulajé,
  telefon NINCS — a valódi szállás-szám kivéve, a tulaj írja be).
- 18:34 UTC a tulaj kérésére törölve (mentés `/opt/citoviso/backups/purchases-test-20260930-183442.json`): a `[TESZT] Muschel Panzió`
  bérlő + a Visa-tokenes havi előfizetés, 4 Barion order_intent/payment (97 paid + számlasor, 97 failed, 3 900 és 7 040 failed).
  Élesen 0 tokenes előfizetés maradt. A partner-sor marad (tenant_id → NULL).

## Nyitott (a folytatásból)
- `MOBILE_SEND_WINDOW_OFF=1` ki az éles `.env`-ből + restart, a tulaj szavára.
- Ferenc Ház (éves, számlás, mock-fizetés) és Nyugalom (domain_upgrade fizetés nélkül) bérlő: törlés vagy demó — tulaj-döntés.
- `CITO-2026-1` valódi számla a Számlázz/NAV-ban; a DB-sora törölve — sztornó a Számlázz felületén, ha a tulaj kéri.

## Nyitott / következő
- Új deploy (MMS + i18n + számla): utomunka3 land → száraz → `--go` → éles `.env` `MMS_PROVIDER=queue` → dev `citoviso-mms-relay.timer` →
  `i18n-article-refresh --go` élesen → a tulaj új tölcsér-kör az `e629826b…` teszt-leaden (mock → kiküldés → 98% ajánlat → vásárlás → SZÁMLA).
- Hős-cím deploy, majd purge (§4.8), Places-backfill `--apply --backup`, teszt-partner kézi törlése.
- D+1 (10-01 reggel): `journalctl -u "citoviso-*" -p warning --since yesterday` — events 05:30, billing 07:00 (+invoice-retry lépés), traffic-mail 08:00 UTC.
- Külön kulcs a Maps JS-hez webcím-korláttal; `python3-pil` élesen már nem kell (sharp).
- Az admin modul-lista kliens-oldali névelője (`adminViews.ts` `data-art`) nem-magyar nyelven magyar névelőt ír (i18nart DÖNTÉS KELL #2).

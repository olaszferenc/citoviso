# API-hívás leltár — mi hív külső API-t, miért, mennyiért (2026-10-27)

Megbízó: OF → CIT brief (`~/rc-briefs/api-hivas-leltar-20261027.md`), a tulaj kérésére. Csak olvasás és mérés:
kód (`wt/cit612a4d2b`, = main `8658ed58`), éles DB/journal (`1ef70a4c`), dev DB, dev crontab. Kódot, élest nem módosított.

## 0. Röviden

- **OpenAI / ChatGPT / Kimi / Gemini API: NINCS.** Egyetlen hívás vagy függőség sincs (`package.json`: csak `@anthropic-ai/sdk`,
  `nodemailer`, `playwright-core`). Az `openai|kimi|gemini` találatok megjegyzések: `engine/skins.ts:451`, `engine/templates/gateOpening.ts:4`
  („Kimi B” mock-változat neve), `replies/answer.ts:260` („Gemini Superior” = eszköz).
- **Claude-CLI (`claude -p`) a kódban nincs.** A dev-crontabban egy van (`distill.sh`, hétfő 08:00), az az ELŐFIZETÉSBŐL megy, nem API-kreditből.
- **Egy Anthropic-kulcs van, és dev + éles UGYANAZT használja** (`ANTHROPIC_API_KEY`, sha256-ujjlenyomat egyezik). Ugyanígy a
  `GOOGLE_MAPS_API_KEY` és a `BRAVE_API_KEY` is közös. ⚠️ A `GOOGLE_MAPS_BROWSER_KEY` ÉRTÉKE = a szerver-oldali `GOOGLE_MAPS_API_KEY`
  (mindkét gépen), pedig a böngésző-kulcs szándékosan kikerül a lapba (`server/contactViews.ts:246`, tenant-admin Térkép).
- **Mért Anthropic-költés (éles):** a fordítás 10-07…10-27 összesen **$138,62**, ebből 10-27 **$130** (Opus 4.8; a szlovén csomag, a Bábel-brief viszi).
  A hős-fotó pontozás **nincs könyvelve**: becslés ≈ **$0,002/kép**, ami 10-09-én ~$18, 10-21-én ~$16, 10-27-én ~$13, 09-25 óta ≈ **$65+**
  (alsó becslés). A mock-generálás 10-06 óta $0 (a szöveget a kollégák írják). Az események napi ~$0,45, a tenant-AI $0,006 összesen.
- **Google: becslés $0–0,72/nap**, a valós számla-ág 10-02 óta végig „számla: missing” (a billing export nincs bekapcsolva).

## 1. Claude / Anthropic API (kulcs: `ANTHROPIC_API_KEY`, dev = éles)

Árak (`src/ai/usage.ts`): opus-4-8 $5/$25, haiku-4-5 $1/$5, haiku-5-5 $0,10/$0,50 per MTok.
„Mock-futás” = konzol `POST /lead/:id/generate` és a kurátori szöveg útvonala (`console/server.ts:2711/2766`), nyilvános
`POST /api/mock-request` (`server/public.ts:4322`), `src/generator/run.ts` — ezek mind a `withMockBudget` (`ai/dailyCap.ts`) alatt futnak.

| # | Mi hívja (fájl:sor · függvény) | Mi indítja | Miért | Modell · max_tokens | Költségmérő | Nagyságrend (mért) | Plafon / kapcsoló |
|---|---|---|---|---|---|---|---|
| A1 | `generator/heroPick.ts:433` `scoreHeroCandidates` (≤24 fotó base64-ként) | ① **kurátori szöveg útvonala → `buildSourcePack`** (`server.ts:2780` → `console/sourcePack.ts:101` → `resolveGatedPhotos`) — a Poe-lánc éjjel-nappal ezt hívja; ② `POST /lead/:id/places-photos` (`server.ts:4187/4191`); ③ `POST /lead/:id/hero` (`heroOverride.ts:147`); ④ mock-futás (`generateEngine.ts:331`); ⑤ szkriptek: `rescore-photo-verdicts.mts`, `rerender-mock --rehero`, `hero-pick-check` | nyitókép-pontszám + vízjel/molinó-szűrés, eredmény `photo_hero_score` cache (url_key) | haiku-4-5 · 2048 | **NINCS** az ①②③⑤ úton (a `recordAiUsage` a `withMockBudget`-en kívül no-op); a ④-nél `aiUsage`, de oda már teli cache-sel ér → „AI-költség: 0 hívás” | új cache-sor/nap: 10-09: 8953 · 10-21: 7843 · 10-26: 1307 · 10-27: 6430 (alsó korlát: az újrapontozás a `scored_at`-et nem írja). Hívásonként mérve $0,0175 / 13 947 be + 776 ki token (8 mért hívás) → ≈ $0,002/kép → 10-27 ≈ $13 | **nincs** (csak a ④ esik a napi plafon alá) |
| A2 | `i18n/packs.ts:242` `translateBatch` (`ensureLanguagePack`) | **mindkét szerver indulása** (`console/server.ts:5207`, `server/public.ts:4648`; ki: `I18N_BOOT_TOPUP=0`), `deploy-prod.sh:503` (`i18n-pack-status.mts --ensure`), mock-futás, scrape-job, outreach-küldés (`sendBatch.ts:410`, `sendOutreachSms.ts:235`), `i18n/mail.ts:230`, multilang | UI-nyelvi csomag (hiányzó fordítások pótlása) | opus-4-8 · 4000 | `translation_spend` (host, process, trigger, lépés, nyelv, token, $) | 10-07…10-26: $0,01–1,65/nap (`i18n-pack-status.mts`, cli); **10-27: server.ts on-demand 2106 hívás $125,72 + cli $4,31** | **nincs** (a napi plafon ezt nem látja) |
| A3 | `i18n/kbPacks.ts:91` `translateEntry` | minden `ensureLanguagePack` (`packs.ts:321`) — tudásbázis-cikk × nyelv | KB-súgó fordítása | opus-4-8 · **16000** | `translation_spend` | a fenti összegben | **nincs** |
| A4 | `tenant/multilangGenerate.ts:64` `translateStrings` | fizetési webhook (`payment/service.ts:533`) + `citoviso-multilang-resume.timer` (5 percenként) | vásárolt többnyelvű tenant-oldal | opus-4-8 · 8000 | **NINCS** (no-op `recordAiUsage`) | élesen 0 tenant → ma ~0 | **nincs** |
| A5 | `events/gather.ts:211` `extractBatch` | `citoviso-events.timer` (05:30) + `citoviso-events-pending.timer` (5 percenként, `--pending`) → `scripts/gather-events.mts` | helyi programok kinyerése (Brave-találatokból) a tenant-oldalra | haiku-4-5 · 4096 | `event_gather_run` (token + `cost_usd`, Brave-tal együtt) | futási napokon 33–50 település, **$0,37–0,50/nap** (09-30, 10-14, 10-19, 10-26) | nincs (advisory lock: egyszerre egy futás) |
| A6 | `ai/bookingHelper.ts:271` `askBookingHelper` | tenant-admin `POST /admin/booking-setup/ask` (`public.ts:3217`) | „Foglalás beállítása” segítő | haiku-5-5 · 1500 | `tenant_ai_call` | összesen 9 hívás, $0,006 (10-13/14) | **40 hívás / oldal / nap** (saját); a globális plafon nem látja |
| A7 | `generator/brief.ts:414` `generateBriefAndCopy` | mock-futás, recopy (`server.ts:3009`) | szöveg + brief | opus-4-8 · 2000 | `mock_artifact.inputs.aiUsage` | 10-04/05: 115 hívás $15,24; 10-06 óta ~0 | **napi plafon `AI_DAILY_CAP_USD`** (élesen nincs beállítva → alap $20) |
| A8 | `generator/marketCheck.ts:1094` `verifyMarketRelevance` | mock-futás, recopy (max. 3×/futás) | piaci relevancia-őr | opus-4-8 · 2500 | `aiUsage` | 282 hívás $13,70 (10-04/05) | napi plafon |
| A9 | `generator/factCheck.ts:455` `verifyFactuality` | mock-futás, recopy | tényhűség-őr | opus-4-8 · 1500 | `aiUsage` | 182 hívás $13,64 | napi plafon |
| A10 | `generator/guestCritic.ts:712/821` `critiqueCopy` / `rewriteCopy` | mock-futás, recopy (max. 2 kör) | vendég-szemű kritika + átírás | opus-4-8 · 3000/4000 | `aiUsage` | 350+168 hívás $21,04 | napi plafon |
| A11 | `engine/planner.ts:315` `planRecipe` | mock-futás; `engine-*.ts` szkriptek | sablon-recept | opus-4-8 · 512 | `aiUsage` / szkriptből NINCS | kicsi | mock-futásban napi plafon |
| A12 | `outreach/letterCritic.ts:168` `critiqueLetter` | kézi szkript `outreach-letter-critic.mts` | megkereső levél kritikája | opus-4-8 · 4000 | NINCS (ítélet-JSON) | alkalmi | nincs |
| A13 | Csak szkriptből: `brief.ts:191` `generateBrief`, `engine/copywriter.ts:167`, `generator/aiMock.ts:119`, `generator/corpus.ts:168`, `scripts/bespoke-mock.ts:58` (stream, 32000), `scripts/ai-usage-selfcheck.mts` | kézi futtatás | kísérleti/korpusz | opus-4-8 | NINCS | alkalmi | nincs |
| A14 | Holt kód (nincs élő hívó): `mockFromCorpus.ts:81/259`, `generator/copy.ts:82`, `generate.ts:750` | — | régi generálási út | opus-4-8 | — | 0 | — |
| A15 | `console/stallWatch.ts:81` `GET /v1/models` | `offer-followup.timer` (óránként) / `keyDeath.ts` | kulcs-életjel | — | — | ingyenes | — |

**Miért írja a mérő, hogy „AI-költség: 0 hívás”, miközben napi 6–9 ezer kép pontozódik?** Élesen 10-27-én a konzol 364-szer írta ki a
„0 hívás”-t és 267 kurátori-szöveg futást. A sorrend: a kurátori út ELŐBB `buildSourcePack`-et hív (`server.ts:2780`), ami a
`withMockBudget`-en KÍVÜL pontoz → a `recordAiUsage` no-op. A generálás ezután teli cache-t talál (`heroPick.ts:407`), ezért 0 hívást
mér, és ez igaz is: a pénz előtte, könyveletlenül ment el. A `--resample` rerender (dev-cron `sorba.sh`, 10 percenként SSH-n az élesre)
NEM hív API-t, csak a cache-t olvassa (`rerender-mock.mts:47` `readCachedScores`). Ismételt fizetést okozhat: a 2048-as `max_tokens`
24 fotóra elvághatja a JSON-t (a `stop_reason` nincs ellenőrizve → semmi nem cache-elődik, a következő hívás újra fizet); a hiányzó
verdikt; párhuzamos hívások ugyanarra a nem cache-elt fotóra. Ma élesen 16-szor jött 400-as hiba („image dimensions exceed … 3000
pixels” many-image kérésnél) — ez nem kerül pénzbe, de azt jelenti, hogy azoknak a leadeknek a pontozása kimarad.

## 2. Google API-k (kulcsok: `GOOGLE_MAPS_API_KEY`; `GOOGLE_MAPS_GENERATOR_KEY` élesen NINCS → visszaesik az API-kulcsra; `GOOGLE_MAPS_BROWSER_KEY` = ugyanaz az érték)

| # | Mi hívja | Mi indítja | Miért | Végpont / SKU | Mérő | Plafon / kapcsoló |
|---|---|---|---|---|---|---|
| G1 | `scraper/sources/googleMaps.ts:298/332` | scrape (CLI / konzol) | felderítés (csak ID-k) | Places `searchText` | `scrape_run.cost_estimate` + napló | `SCRAPE_PAID_APIS=on` kell (élesen NINCS bekapcsolva); `PLACES_DISCOVERY_WARN_CALLS` 600 csak figyelmeztet (ADR-0298) |
| G2 | `googleMaps.ts:351/611` | scrape 2. lépés | új hely adatlapja | Place Details (~$20/1000) | `places_detail_cache`, `scrape_run` | ua.; 4000-es figyelmeztetés |
| G3 | `googleMaps.ts:680` `fetchPlaceReviews` | (a) dúsítás; (b) **minden motoros generálás friss értékelés nélkül** (`generateEngine.ts:378`) | vendég-értékelések | Details `reviews` (Enterprise+Atmosphere) | **NINCS** | (a) `SCRAPE_PAID_APIS`; **(b) nincs kapu**, csak a kulcs léte |
| G4 | `generator/generate.ts:474` `askPlaces` + `images.ts:17` Photo Media (≤6/lead) | `resolveGatedPhotos` `auto` (generálás, ha nincs élő portálfotó) és `curator` (fizetős gomb `POST /lead/:id/places-photos`) | fotó, ha nincs portálkép | Text Search / Details / Photo Media | `lead_places_cache` (leadenként egyszer fizet, nem jár le) | `curator`: `SCRAPE_PAID_APIS`; **`auto`: nincs kapu** |
| G5 | `scraper/resolveOne.ts:95/218` | **nyilvános, nem hitelesített `POST /api/mock-request`** (`public.ts:4322`) | látogató kér mockot | Places `searchText` (Enterprise) + utána a teljes generálás (Places, értékelés, Street View, Opus) | NINCS (az Opus része `aiUsage` + plafon) | **nincs throttle, nincs `SCRAPE_PAID_APIS`**; élesen a journalban nincs nyoma használatnak |
| G6 | `generator/images.ts:222` `streetViewUrl` (+ `images.ts:176` szerver-oldali letöltés vision-höz) | fotó nélküli lead generálása | nyitókép-pótlás | Street View **Static** (fizetős) | NINCS | nincs. ⚠️ A URL a kulcsot tartalmazza és a mock HTML-be kerülhet; élesen a `sites/`-ban **0 db** ilyen URL / `AIza` (mérve 10-27) |
| G7 | `scraper/streetview.ts:16` | dúsítás | van-e utcakép | Street View metadata (ingyenes) | — | `SCRAPE_PAID_APIS` |
| G8 | `server/contactViews.ts:246` (böngésző) | tenant-admin Térkép/Elérhetőség | térkép a vevő adminjában | Maps JS + Geocoding | NINCS | ⚠️ ugyanaz a kulcs, mint a szerveré (referrer-korlát csak a Google-konzolban látszik) |
| G9 | `ops/googleCostReport.ts:166/294` | `citoviso-google-cost-report.timer` 07:10 | napi költség-riport (Monitoring + BigQuery) | gcloud OAuth | ez maga a mérő → `~/.claude/citoviso-google-cost-report.log` | csak riport, semmit nem állít le; küszöb 20 $ / 7000 Ft / 18 € csak jelzés |
| G10 | `scraper/sources/webSearch.ts:18` | csak ha nincs `BRAVE_API_KEY` | tartalék-kereső | Custom Search | NINCS | — |
| — | Holt: `reviews/placeRating.ts:156` | nincs hívó | — | Details | — | — |

Nem kerül pénzbe: Maps-beágyazás kulcs nélkül (`engine/primitives.ts:1091`), térkép-linkek, Google Fonts.
**Mért:** a riport-becslés 10-19…10-26: $0,00–0,72/nap; Places-hívás 10-01 21:31 óta ~0 (`lead_places_cache` új sora: 10-04: 2, 10-14: 2, 10-15: 1).
Valós számla: „missing” minden nap → a billing export (`mineralcrm.billing_export`) nincs bekapcsolva, a valós Google-költséget a rendszer nem látja.

## 3. Egyéb külső API-k

| # | Szolgáltatás | Mi hívja / mi indítja | Kulcs | Mérő | Plafon |
|---|---|---|---|---|---|
| X1 | **Brave Search** | `scraper/sources/webSearch.ts:76`: (a) dúsítás (`enrichWebSearch`, `enrichSiteSearch`, `portalListing`, konzol reenrich); (b) események (`events/gather.ts:335`, településenként 1 lekérdezés, events-timerek) | `BRAVE_API_KEY` (dev = éles) | (a) NINCS; (b) `event_gather_run.cost_usd`, beégetett $0,005/lekérdezés (`gather.ts:53`) | 1,1 mp-es szünet; (a) `SCRAPE_PAID_APIS`; (b) nincs kapu. Mért: 33–50 lekérdezés/futási nap ≈ $0,25 |
| X2 | Nominatim / Overpass (OSM) | `scraper/enrichGeo.ts`, `scraper/sources/osm.ts`, `events/settlements.ts`, konzol térkép-kereső | — | — | ingyenes (használati szabály: 1 kérés/mp) |
| X3 | **Barion** | `payment/barion.ts` (Start, ismétlődő terhelés, állapot, Capture…) — pénztár, `citoviso-billing.timer` 07:00, `offer-followup` | `BARION_POSKEY` | tranzakciós díj, bevételhez kötve | — |
| X4 | **Számlázz.hu** | `invoicing/szamlazz.ts:190/259` — fizetés után + `billing/invoiceRetry.ts` | `SZAMLAZZ_AGENT_KEY` | előfizetéses | `keyGuard.ts` |
| X5 | VIES (adószám) | `billing/taxId.ts:185` | — | ingyenes | — |
| X6 | **Websupport** (domain-vétel kreditből + DNS) | `domains/registrar/websupport.ts:170` — `citoviso-domain-resume.timer` (2 percenként), `domain-renewal.timer` 04:20; élesen `REGISTRAR_PROVIDER=websupport` | `WEBSUPPORT_API_KEY` | NINCS költés-mérő (fiók-kredit) | csak a fiók-kredit |
| X7 | Cloudflare / INWX DNS | `domains/dns/cloudflare.ts` — csak `DNS_PROVIDER=cloudflare` esetén | `CLOUDFLARE_API_TOKEN` | — | régi opció |
| X8 | Let's Encrypt (certbot) | `deploy/tenant-tls/citoviso-tenant-tls.sh` — 2 percenként | — | ingyenes (rate limit) | — |
| X9 | SMTP / IMAP (Zoho) | `email/sender.ts:245`; outreach-dispatch, offer-followup, traffic-mail, billing, riport, riasztás; IMAP: `replies-email.timer`, `registryConfirmWatch.ts` | `SMTP_URL` | Zoho-csomag | outreach `app_setting.outreach_auto.dailyCap` (ma 150, 16:05-kor vissza) |
| X10 | SMS / MMS (saját SIM800C modem) | `sms/sender.ts:89` (élesen sor, a dev-gép küld), `mms/sender.ts`; relay-timerek percenként | — | szolgáltatói díj, NINCS mérő | outreach napi keret + 9–16 ablak; házi riasztás 4/óra |
| — | Stripe, NAV-közvetlen, Twilio, DeepL, push, OpenAI | — | — | **nincs a kódban** | — |

## 4. Dev-gép (crontab, `~/rc-briefs/watch/`)

| Bejegyzés | Ütem | Külső fizetős hívás? |
|---|---|---|
| `_planning/DOMAIN/_tools/distill.sh` | hétfő 08:00 | `claude -p` — **előfizetés**; a cron környezetében nincs `ANTHROPIC_API_KEY` (a szkript nem tölti be a `.env`-et) |
| `watch/pipemeter.py --log` | óránként :03 | `api.anthropic.com/api/oauth/usage` (előfizetés-olvasás, OAuth, nem kredit) |
| `watch/napi-keret.py` | 10 percenként | nincs (a kollégák 30%-os napi token-plafonja, tmux STOP) |
| `watch/sorba.sh`, `masodik-terv.sh` | 10 percenként | SSH-n élesre: `rerender-mock --resample` (API nélkül) + sorba tétel → később SMTP/SMS/MMS |
| `proba-kampany.sh` (10-27 09:00), `cap-vissza-150.sh` (10-27 16:05) | egyszeri | levél+SMS / DB-írás |
| `cfm-relay.mts`, `valasz-watch.py`, `design-cred-guard.py` | percenként / 2 percenként | nincs |
| A kollégák (Magellan, Neo, Poe, Vera, -bb) | folyamatos | **előfizetés** (Claude Code), nem API — de a konzolon keresztül ők indítják az A1 pontozást |

## 5. Mérő-vakfoltok és hiányzó plafonok

1. **Hős-fotó pontozás (A1) a mock-futáson kívül: se mérő, se plafon.** Mindennapos, ezres nagyságrendű; a legnagyobb könyveletlen Anthropic-tétel.
2. **A napi AI-plafon (`AI_DAILY_CAP_USD`, élesen az alap $20) csak a `mock_artifact.inputs.aiUsage`-t összegzi.** A fordítás (`translation_spend`),
   az események, a tenant-AI és a pontozás nem számít bele → 10-27-én $130 ment el úgy, hogy a plafon semmit nem látott.
3. **A fordítás (A2/A3) a szerver-indulásra fut**, minden restartnál (10-27: 08:29, 11:57, 14:00 az éles public szerveren), mérve, de plafon nélkül; a KB-hívás 16 000-es `max_tokens`-szel.
4. **Multilang (A4):** fizetés után fut, se mérő, se plafon (ma 0 tenant, ezért még nem fáj).
5. **Egy Anthropic-kulcs dev + éles:** a konzolon a kettő nem választható szét; egy dev-restart fordítás-pótlása ugyanarra a számlára megy.
6. **Google valós számla vak** (billing export nincs bekapcsolva); a riport csak becsül, semmit nem állít le; Google-oldali kvóta a repóból nem látszik.
7. **Google-kulcs: a böngésző-kulcs = a szerver-kulcs** → a tenant-admin lapjába kiírt kulccsal Places/Street View is hívható, ha a Google-konzolban nincs API- és referrer-korlát (ellenőrizni csak ott lehet).
8. **`SCRAPE_PAID_APIS` nem minden fizetős Google-utat véd:** G3(b) értékelés generáláskor, G4 `auto`, G5 nyilvános mock-kérés, G6 Street View Static.
9. **Nyilvános `POST /api/mock-request`:** hitelesítés és throttle nélkül indít Places- és Opus-hívást (az Opus a plafon alatt van, a Google-rész nem).
10. **Brave:** a dúsítás mérő nélkül; az események ára beégetett becslés.
11. **Szkriptből futó AI (A12/A13, `rescore-photo-verdicts.mts`):** mérő nélkül.
12. **SMS/MMS, Websupport-kredit:** nincs költés-mérő (a modem-díj és a domain-vétel a fiókokban látszik).

## Források
- Éles SELECT-ek 2026-10-27 ~16:30: `translation_spend`, `photo_hero_score`, `tenant_ai_call`, `event_gather_run`, `lead_places_cache`, `mock_artifact.inputs.aiUsage(.byStep)`.
- Éles journal: `citoviso-console` (10-27: „AI-költség: 0 hívás” ×364, kurátori szöveg ×267, 400-as képméret-hiba ×16), `citoviso-public` indulások.
- `systemctl list-timers` (éles), `.env` változónevek (érték nélkül), kulcs-ujjlenyomatok (sha256 első 10 jegy).
- Dev: `~/.claude/citoviso-google-cost-report.log`, `crontab -l`, `~/rc-briefs/watch/*`; dev DB 10-14 óta elhanyagolható.

# Elek — éles teszt 2. kör (c0095a28): V-1 és a T-leletek javultak, L-1 és O-2 maradt


Kérés: a koordinátor (citfb4ed7ab-92) üzenete, a tulaj „mehet”-jével: deploy → újrarenderelés → Elek elölről, FRISS [TESZT] szálláson.
Éles verzió: `c0095a28` (prod/20261014-1022, ellenőrizve: `git -C /opt/citoviso/app rev-parse HEAD`). Fa: `~/wt/cit1cfac043`.
Képek: `_elek/shots2/`, levelek: `_elek/mail2/`. Minden útvonal a fához relatív. Az 1. kör: `_elek/JELENTES.md`.
Élesi írás: a lead-másolat (egy tranzakció, lent szó szerint), minden más KIZÁRÓLAG felületen át. Minden más SQL `begin read only` volt.

## Állapot egy sorban
[TESZT] Boglárka Vendégház lead → 1 mock (Kártyás, $0,48) → jóváhagyás → követett link (KIKÜLDÉS NÉLKÜL) → Elek mobilon „14 nap ingyen” (ugyanazzal az elek@ címmel, **nem utasította el**) → belépő levél → admin: 4 fő, alapár 20 000, „Őszi szünet” 24 000, reggeli/félpanzió + gyerekár, IFA 400 → Segítő 2 kérdés → próba-foglalás → Elek vendégként mobilon foglal (2 felnőtt + 1 gyerek, reggeli) → 2 levél → tulaj mobilon visszaigazol → visszaigazoló levél → operátor-nézet. **Mindhárom szerep végigment.** Fizetés, Barion, domain, kiküldés nem volt. **Az 1. kör BLOKKOLÓ hibája (V-1) javult.**

## Élő linkek
- Minta-honlap (a lead linkje): https://citoviso.com/p/0ofgNSfyZ8cUNQo6aMJQ6VWg (megnyitás = mérés; saját megnyitáshoz `?sajat=1`)
- Élő próba-oldal: https://teszt-boglarka-vendeghaz.citoviso.com
- Tenant-admin: https://citoviso.com/login (felhasználó `teszt-boglarka-vendeghaz`; a jelszó `_elek/state2/owner-pw.txt`-ben, 600)
- Konzol, lead: https://admin.citoviso.com/lead/30509134-97af-4088-9927-240d7e6934f4

## A korábbi leletek — JAVULT / NEM JAVULT
| # | 1. kör | 2. kör | Bizonyíték (2. kör) |
|---|---|---|---|
| V-1 | BLOKKOLÓ: mobilon a szelvény végösszege ellátás nélkül (68 000) | ✅ **JAVULT** — mobilon a beküldés előtt 4 tételsor, „Összesen a szállásért 90 500 Ft”; a szerver, a visszaigazoló képernyő és mindhárom levél ugyanennyi | `shots2/guest-05-quote-form-m.png`, `shots2/guest-07-sent-m.png` |
| O-1 | KÖZEPES: a próbázó leadnek hideg megkeresést kínált | ✅ **JAVULT** — a piszkozat: „E-mail: most NEM küldhető — a lead már ügyfél (saját oldala van vagy fizetett) — hideg megkeresés tilos”, a küldés-gomb szürke; a lead fejléce: „KIKÜLDVE: nem kell — már ügyfél (próba vagy saját oldal)” | `shots2/op-18-draft-trialing-lead.png`, `shots2/op-11-lead-after-trial.png` |
| O-2 | KÖZEPES: az operátor a próbát és a foglalást nem látja | ⚠ **RÉSZBEN** — a lead fejléce jelzi, hogy ügyfél (próba vagy saját oldal). A próba adatai (lejárat, tenant) a lead lapján nincsenek, az Irányítópult nem említi, a Riport tenant-fülén próba = 0 (a teszt helyesen kiszűrve). A foglalás a konzolban sehol nem látszik (`/tenant/<id>` 404, a konzol-kód a `booking_request`-et csak a riasztásban olvassa). Nem volt a javítási listán. | `shots2/op-10-dashboard.png`, `shots2/op-12-lead-package.png`, `shots2/op-16-report-tenants.png` |
| T-1 | KÖZEPES: a Segítő szerint „nincs” reggeli/gyerekár, nem létező menü | ✅ **JAVULT** — ugyanarra a kérdésre: reggeli 2 felnőtt + 1 gyerek = 7 500 Ft/éj, alapáron 82 500 Ft, szezon-figyelmeztetés, IFA 2 400 (a gyerek mentes). A „Mutasd” chip működő link a helyes lapra (`m=pricing`). Maradék APRÓ: a chip és a válasz felirata „Haladó beállítások › Árak és időszakok”, a menüpont neve „Árak, szezonok”. | `shots2/owner-13-helper-q1-d.png`, `shots2/owner-13b-helper-link.png` |
| T-2 | KÖZEPES: „12 éves korig” vs „12 év alatt” | ✅ **JAVULT** — admin, élő oldal, szelvény („EBBŐL GYERMEK (12 ÉVES KORIG)”), próba-foglalás: mind „12 éves korig”. A Segítő mobilon is ezt mondja; azt, hogy maga a 12 éves gyerek-e, most sem mondja ki (a felirat ezt már egyértelművé teszi). | `shots2/guest-05-quote-form-m.png`, `shots2/owner-23-helper-q2-m.png` |
| T-3 | KÖZEPES: az IFA a gyerekre is | ✅ **JAVULT** — „400 Ft / fő / éj × 2 fő × 3 éj = 2 400 Ft”, + magyarázat: „A 18 év alatti vendég mentes…, és a 13–17 évesek után sem kell megfizetni.” Szelvényen, levelekben, próba-foglalásban egyaránt. | `shots2/guest-07-sent-m.png`, `mail2/462.txt` |
| T-4 | APRÓ: „Kipróbálás” próba nélkül „Kész”; nincs ellátás/gyerek mező | ✅ **JAVULT** — előtte „5 / 6 rész kész”, „Kipróbálás — Még nem próbálta ki”; a próba-foglalásban van Ellátás- és „Ebből gyermek (12 éves korig)” mező; reggelivel + 1 gyerekkel 90 500 / IFA 2 400 = kézi számolás | `shots2/owner-12-setup-d.png`, `shots2/owner-18b-try-full.png` |
| T-5 | APRÓ: Szobák mentése után az Online foglalás lap jön | ✅ **JAVULT** — `?tab=modulok&m=rooms&saved=1` | `shots2/owner-10-room-capacity.png` |
| T-6 | APRÓ: a szelvény lenyílója nem mutat gyerekárat | ✅ **JAVULT** — a lenyíló alatt: „Gyermeknek (12 éves korig): 1 500 Ft / fő / éj” | `shots2/guest-05-quote-form-m.png` |
| T-7 | APRÓ: a levelekből nem derül ki a gyerekszám | ✅ **JAVULT** — vendég-, tulaj- és visszaigazoló levél: „Létszám: 3 fő, ebből 1 gyermek” | `mail2/462.txt`, `mail2/463.txt`, `mail2/464.txt` |
| L-1 | APRÓ: asztalon a pirula-pár fénye a foglalási kártya címére lóg; jobb szélső árnyéksáv | ❌ **NEM JAVULT** — 1366×900-on a „14 nap ingyen / Itt rendelheti meg” pár a jobb oldali foglalási kártya címét takarja („…] Boglárka Vendégház”, a „[TESZT” eltűnik), a jobb szélen ott a sötét sáv. Mobilon rendben. (Az ADR-0377/0382/0383 a hős-címre és a képváltó-csíkra vonatkozott, a kártyára nem.) | `shots2/lead-01-open-d-fold.png` |
| O-3 | APRÓ: „8–20 óra” felirat | ✅ **JAVULT** — „a megkeresési ablak (hétköznap 9–16 óra; a kísérő SMS 8–20 óra között)” | `shots2/op-18-draft-trialing-lead.png` |
| I-1 | INFO: „Poe dolgozik rajta (10.12. 08:20 óta)” | ⚠ változatlan, ma már ~2 napja | `shots2/op-10-dashboard.png` |
| I-2 | INFO: a mock távolság-állítása | — az új mockban nincs távolság; az új állítás („árnyékos udvar, házigazdák kedvessége”) forrását nem ellenőriztem | `shots2/lead-01-open-d-fold.png` |

## Új leletek
| # | Súly | Lelet | Bizonyíték |
|---|---|---|---|
| N-1 | APRÓ | **A „havi forgalom” levél címkéje félrevezető, és az egynapos tenant is megkapja.** A tegnap 18:01-kor indult [TESZT] Keresztes ma 08:00-kor „— szeptemberi forgalom” levelet kapott „Megnyitások: 17 … Telefonon nézte: 65%” adattal, ami teljes egészében október 13-i (az 1. kör megnyitásai). Ok (`src/analytics/trafficMail.ts`): a jelentés a megelőző 30 napot méri, és a címkéje `monthLabel(now − 30 nap)` → „szeptember”; az idempotencia hónaponként egy levél, így a hónap első futásakor minden élő tenant kap, akkor is, ha egy napja él. Valódi próbázónál az első napon egy „szeptemberi” jelentés zavaró. | `mail2/460.txt` |
| N-2 | INFO | **A dev-gép élő vevő-levelet küldött Elek címére** („1 szobájának nincs ára — … 14 napja hiányos”, 10-13 21:00). A link `http://100.97.188.105:4800/...`, ez a dev-gép Tailscale címe, tehát a dev-környezet heti ár-emlékeztetője (a dev Elek-park tenantjának). Élesről nem ment (az éles `tenant_message` nem tartalmazza). Valódi címre nem mehetett, mert a dev-ben Elek a címzett. | `mail2/458.txt` |

Javult a 10-13 óta, nem volt külön lelet: a próba-indítás ugyanazzal az e-mail címmel (elek@, a Keresztes-próba még fut) **nem** ütközik, kerülő nem kellett.

---

## 0. A [TESZT] lead — a koordinátor engedélyével, egyetlen tranzakció
- Forrás: `a918a0df-6dcf-43b1-985a-aadec6fc816c` „Boglárka Vendégház”, Balatonboglár, 10 fotó. Ellenőrizve: 0 prospect, mock, mock_request, próba, tenant, trial_campaign, outreach_reply, lead_activity; az 5 névrokon (Boglárka …) leadnél is 0 prospect / 0 tenant. **Érintetlen** (utólag: név, telefon, csatorna = sms változatlan).
- Új lead: **`30509134-97af-4088-9927-240d7e6934f4`** „[TESZT] Boglárka Vendégház”, + 3 `lead_provenance` sor. E-mail `elek@citoviso.com`, telefon ÜRES (raw.phone törölve, scrapedContact.phone = null, a kontakt-lista csak az elek@ cím), csatorna `email`.

A futtatott SQL (szó szerint `_elek/lead-copy-2.sql`):
```sql
begin;
with src as (select * from lead where id = 'a918a0df-6dcf-43b1-985a-aadec6fc816c'),
ins as (
  insert into lead (scrape_run_id, name, lat, lng, address, category, qualification, weight, match_confidence, raw, lifecycle_status)
  select scrape_run_id, '[TESZT] Boglárka Vendégház', lat, lng, address, category, qualification, weight, match_confidence,
    (raw - 'phone' - 'emailCuratedAt' - 'curatorEditedAt')
      || jsonb_build_object(
           'name', '[TESZT] Boglárka Vendégház',
           'email', 'elek@citoviso.com',
           'contactChannel', 'email',
           'contacts', jsonb_build_array(jsonb_build_object('kind','email','value','elek@citoviso.com','source','manual','accepted',true,'firstSeen','2026-10-14')),
           'scrapedContact', (raw->'scrapedContact') || jsonb_build_object('name','[TESZT] Boglárka Vendégház','email','elek@citoviso.com','phone',null)),
    'qualified'
  from src returning id
),
prov as (
  insert into lead_provenance (lead_id, field, value, source, matched_entity, confidence, observed_at)
  select ins.id, p.field, case when p.field = 'discovery' then '[TESZT] Boglárka Vendégház' else p.value end,
         p.source, p.matched_entity, p.confidence, now()
  from lead_provenance p, ins where p.lead_id = 'a918a0df-6dcf-43b1-985a-aadec6fc816c'
  returning lead_id
)
select (select id from ins) as new_lead_id, (select count(*) from prov) as prov_rows;
commit;
-- → new_lead_id 30509134-97af-4088-9927-240d7e6934f4, prov_rows 3
```

## 1. Operátor (konzol, `elek` fiók)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 1.1 | Belépés (a deploy utáni kiléptetés miatt újra) | ✅ | `op-00-dashboard.png` |
| 1.2 | Lead lapja: név, elek@, telefon „–” | ✅ | `op-01-lead.png` |
| 1.3 | Mock, 1 kinézet (Kártyás): 1:41 alatt, **$0,48** (10 AI-hívás), 6 kép, nyitókép 68 pont, minden kapu zöld | ✅ | `op-04-gen-done.png`, `op-05-mock-card.png` |
| 1.4 | Jóváhagyás | ✅ | `op-06-megkereses.png` |
| 1.5 | Követett link, az e-mail előtöltve; **kiküldés nem volt** (`email_sent_at`/`sms_sent_at` üres) | ✅ | `op-07-prospect-form.png`, `op-08-prospect-created.png` |
| 1.6 | Próba után: piszkozat „NEM küldhető”, fejléc „nem kell — már ügyfél” | ✅ O-1 | `op-18-draft-trialing-lead.png`, `op-11-lead-after-trial.png` |
| 1.7 | A próba részletei / a foglalás látszik-e? | ⚠ / ❌ O-2 | `op-10`, `op-12`, `op-16`, `op-15-pricing.png` („Most 2 próba fut”) |
| 1.8 | Riport: a teszt nem számít bele (0/177 próba) | ✅ | `op-16-report-tenants.png` |
| 1.9 | Riasztások | ✅ nem kellett szólniuk | — |

**Riasztások.** A `house_alert_once`, `house_alert_sms`, `free_trial_alert` tábla 0 sor, `sms_outbox` 10-13 óta 0 sor (utolsó 10-09). Minden lépés rendben ment, tehát **helyesen nem szólt semmi**. A hiba-ágat élesen most sem lehetett kiváltani (kód- és szerver-módosítás nélkül nincs rá mód).

## 2. Szállástulaj (Elek)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 2.1 | A minta mobilon + asztalon | ✅ mobil / ❌ L-1 asztal | `lead-01-open-{m,d}-fold.png` |
| 2.2 | „14 nap ingyen” → Teszt Elek, elek@, +36 30 516 1631 (tulaj teszt-mobil), 2 pipa → beküldés | ✅ | `lead-02-trial-form-m.png`, `lead-03-trial-filled-m.png` |
| 2.3 | „A hozzáférést elküldtük”, lejárat 2026. 10. 28.; tenant `5503cd1c…`, site `teszt-boglarka-vendeghaz` **live**, ugyanaz az elek@ cím elfogadva | ✅ | `lead-04-trial-after-m.png` |
| 2.4 | Belépő levél 08:28 (#461) → jelszó beállítva → szerkesztő | ✅ | `mail2/461.txt` |
| 2.5 | Szoba 4 fő, mentés után a Szobák lap | ✅ T-5 | `owner-10-room-capacity.png` |
| 2.6 | Alapár 20 000 | ✅ | `owner-05-base-saved.png` |
| 2.7 | Ellátás: Reggeli +3 000 (gyerek 1 500), Félpanzió +7 000 (gyerek 3 500), 12 éves korig, „takarítás, ágynemű, törölköző” | ✅ | `owner-06-meals-filled.png`, `owner-07-meals-saved.png` |
| 2.8 | „Őszi szünet” okt. 24. – nov. 2., 24 000, min. 2 éj, minden évben | ✅ | `owner-08-season-filled.png`, `owner-09-season-saved.png` |
| 2.9 | Foglalás beállítása: 5/6, Kipróbálás „Még nem próbálta ki”; IFA 400 a 4. részben | ✅ T-4 | `owner-12-setup-d.png`, `owner-15-ifa-filled.png` |
| 2.10 | Segítő asztalon (ár + IFA), 9 mp | ✅ T-1 | `owner-13-helper-q1-d.png` |
| 2.11 | Segítő mobilon („12 éves gyerek?”) | ✅ / kitér | `owner-23-helper-q2-m.png` |
| 2.12 | Próba-foglalás nov. 1., 3 éj, 3 fő, Reggeli, 1 gyerek: 90 500 / IFA 2 400 | ✅ | `owner-18b-try-full.png` |
| 2.13 | Foglalások fül (mobil) → „Visszaigazolom” → megerősítés → „Visszaigazolva” | ✅ | `owner-20-before-accept-m.png`, `owner-21-accept-step-m.png`, `owner-22-accepted-m.png` |

## 3. Vendég (Elek, mobil 390 px + asztal)
**Kézi számolás** (2026. 11. 01. → 11. 04., 3 éj, 2 felnőtt + 1 gyerek, reggeli):
szállás 2 × 24 000 (11-01, 11-02 az Őszi szünetben) + 1 × 20 000 = **68 000**; reggeli 3 × (2 × 3 000 + 1 × 1 500) = **22 500**; **végösszeg 90 500 Ft**; IFA 400 × 2 felnőtt × 3 éj = **2 400 Ft** (a gyerek mentes).

| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 3.1 | Élő oldal, Árak + Ellátás szakasz („Gyermeknek (12 éves korig)”) mobil + asztal | ✅ | `guest-09-site-{m,d}-{fold,full}.png` |
| 3.2 | Asztal, 2. lépés: 4 tételsor, 90 500, IFA 2 400 | ✅ | `guest-05d-quote-form-m.png` (asztali futás, a név öröklött) |
| 3.3 | **Mobil, 2. lépés: 4 tételsor, 90 500, IFA 2 400** | ✅ **V-1 javult** | `guest-05-quote-form-m.png` |
| 3.4 | Beküldés: `POST /api/foglalas` 200, FG-014226, total 90 500, children 1 | ✅ | `guest-07-sent-m.png` |
| 3.5 | Vendég-levél 08:36 (#462): tételek, 90 500, IFA 2 400 + mentesség, „3 fő, ebből 1 gyermek” | ✅ | `mail2/462.txt` |
| 3.6 | Tulaj-levél 08:36 (#463): Ellátás: Reggeli, 90 500, „ebből 1 gyermek”, Elfogadom/Nem szabad | ✅ | `mail2/463.txt` |
| 3.7 | Visszaigazoló levél 08:37 (#464), lemondó linkkel | ✅ | `mail2/464.txt` |

Címzettek: minden levél kizárólag `elek@citoviso.com`-ra ment. SMS egy sem. A tulajnak nem ment semmi.

## Költség
Mock $0,48 (10 hívás), Segítő 4 hívás $0,003, Places/fizetős API 0.

## Takarítás — ELŐKÉSZÍTVE, NEM FUTOTT (a koordinátor „takaríts” üzenetére)
Szkript: `_elek/cleanup-2.sh` (az 1. körös `_elek/cleanup.sh` mintájára; az is vár). Alapból száraz (mentés, törlés tranzakcióban, ROLLBACK, a mentést eldobja); élesben `bash _elek/cleanup-2.sh --go`. A mentés-lekérdezést csak-olvasó módban kipróbáltam (14 KB), magát a szkriptet nem futtattam.
1. Mentés: `/opt/citoviso/backups/elek-eles-teszt-2-20261014-<ts>/` — teljes `pg_dump -Fc` + `rows.json` (lead, tenant, site, free_trial, prospect, mock_artifact, offer, booking_request).
2. Egy tranzakció: `delete from mock_request …` (ma 0 sor), majd `delete from lead where id='30509134…' and name='[TESZT] Boglárka Vendégház'`. Kaszkáddal viszi: `lead_provenance`, prospect `62968ec4…`, mock_artifact `ac8d1c51…`, free_trial `322df409…`, tenant `5503cd1c…` (site `bcd496fd…`, szoba, árak, ellátás, booking_request `01422677…`, tenant_user `ca1ccf8c…`, tenant_ai_call 4 sor), offer `9d84eb09…`. A deploy utáni FK-gráfot újra ellenőriztem: a láncba mutató nem-kaszkádoló FK-k mind SET NULL, RESTRICT nincs.
3. Ellenőrző select ugyanabban a tranzakcióban: lead/tenant/site/trial/prospect = 0, a forrás-lead (`a918a0df…`) = 1.
4. Fájlok a mentés mellé (mv): `/opt/citoviso/app/mock-teszt-boglarka-vendeghaz-card-sidebar-ac8d1c51.html`, `/opt/citoviso/app/sites/5503cd1c-534c-4233-a4ed-8374906018d0/`.
5. Marad: Elek postafiókjában a #461–#464 levél.

# Elek — éles teszt három szerepben (próba · ellátás · foglalás) · JELENTÉS 2026-10-13

> A SUB zárójelentése (`~/wt/cit1cfac043/_elek/JELENTES.md`). A `shots/` és `mail/` hivatkozások a commitolatlan munkaanyagra mutatnak (`~/wt/cit1cfac043/_elek/`). A teszt-adat élesen még MEGVAN; a takarítás a koordinátor szavára fut (`_elek/cleanup.sh`, lent).


Brief: `~/rc-briefs/elek-eles-teszt-20261013.md` · fa: `~/wt/cit1cfac043` · éles = `97cc4ddf` (prod/20261013-1733)
Képek: `_elek/shots/`, levelek: `_elek/mail/`. Minden útvonal a fához relatív.
Élesi írás: a lead-másolat SQL-je (a koordinátor engedélyével, lent szó szerint), a többi KIZÁRÓLAG felületen át (konzol, `/p/` link, tenant-admin, élő oldal). Ezen kívül az SQL csak `begin read only` volt.

## Állapot egy sorban
[TESZT] lead → 1 mock (Kártyás) → jóváhagyás → követett link (KIKÜLDÉS NÉLKÜL) → Elek tulajként mobilon „14 nap ingyen” → élő oldal + belépő levél → admin: szoba 4 fő, alapár, szezonár, reggeli/félpanzió + gyerekár, IFA (a Segítőn át), Segítő 2 kérdés, próba-foglalás → Elek vendégként mobilon foglal (2 felnőtt + 1 gyerek, reggeli) → 2 levél → tulaj mobilon visszaigazol → visszaigazoló levél → operátor-nézet. **Mindhárom szerep végigment.** Fizetés, Barion, domain, kiküldés nem volt.

## Élő linkek (a tulaj maga is végigkattinthatja)
- Minta-honlap (a lead linkje): https://citoviso.com/p/aEHM6052HEiGzecilHYf9Xj7 (megnyitás = mérés; saját megnyitáshoz `?sajat=1`)
- Élő próba-oldal: https://teszt-keresztes-apartmanhaz.citoviso.com
- Tenant-admin: https://citoviso.com/login (felhasználó `teszt-keresztes-apartmanhaz`; a jelszó `_elek/state/owner-pw.txt`-ben, 600)
- Konzol, lead: https://admin.citoviso.com/lead/94d32846-85f6-4e18-ba89-e0955947fae6

## A legfontosabb leletek (súlyosság szerint)
| # | Súly | Lelet | Kép |
|---|---|---|---|
| V-1 | **BLOKKOLÓ** | **Mobilon a foglalási szelvény 2. lépésén a végösszeg nem tartalmazza az ellátást.** A vendég beállít 3 főt, 1 gyereket, Reggelit. A tömör összesítő ezután is „Összesen a szállásért 68 000 Ft”-ot mutat, felár-sor nincs. Az IFA-sor közben 3 főre frissül. A beküldés után a visszaigazoló képernyő és a levelek **90 500 Ft**-ot írnak. A vendég tehát egy 22 500 Ft-tal (+33%) alacsonyabb árra kattint, mint amit a kérés rögzít. **Asztalon helyes** (90 500 Ft a beküldés előtt). Mobil a fő vendég-csatorna. Ár-feltüntetési kockázat. | `guest-05-quote-form-m.png` (68 000), `guest-07-sent-m.png` (90 500), `guest-05d-quote-form-d.png` (asztal, 90 500) |
| O-1 | KÖZEPES | **A konzol a próbázó leadnek is hideg megkeresést kínál.** A lead lapján ez áll: „KIKÜLDVE: még nem — ez a következő”. A piszkozat-lap szerint „E-mail: most kiküldhető — a küldő-út minden kapuja zöld”, pedig a leadnek élő próba-oldala van. A kódban a küldési kapuk (`src/outreach/`) sehol nem nézik a `free_trial`-t vagy a bérlőt (`ownedSiteForLead`), csak a `trialCampaign.ts`. Egy figyelmetlen kattintás a már próbázó tulajnak „Ez egy honlap-terv az Ön szállásáról” levelet küld. | `op-18-draft-trialing-lead.png`, `op-11-lead-package.png` |
| O-2 | KÖZEPES | **Az operátor a próbát és a foglalást nem látja.** A lead lapján és a lead-sorban próba-jelzés nincs, ott csak „jóváhagyva” áll. Az Irányítópult a próbáról semmit nem mond. A Riport „Tenantok” füle „3. kör — készül”. Csak a `/pricing` írja ki: „Most 1 próba fut”. A foglalás a konzolban sehol nem látszik. | `op-10-dashboard.png`, `op-17-leads-search.png`, `op-15-pricing.png` |
| T-1 | KÖZEPES | **A Segítő téves állapotot mond.** Kérdés: „2 felnőtt + 8 éves gyerek reggelivel, 3 éj, november eleje, mennyi?” Válasz: „A reggeli és a gyerekár nincs a szállás árában, ezeket a Haladó beállítások › Árak és időszakok »Ellátás« részében adhatja meg.” Mindkettő 2 perccel korábban mentve volt. A Segítő kontextusából hiányzik az ellátás-beállítás. Nem létező menü-feliratot is ad: a menüpont neve „Árak, szezonok”. | `owner-13-helper-q1-d.png` |
| T-2 | KÖZEPES | **A gyerek-korhatár kétféle.** Az admin „Gyermeknek számít 12 éves korig” felirata és az élő oldal „Gyermeknek (12 éves korig)” sora szerint a 12 éves még gyerek. A szelvény „EBBŐL GYERMEK (12 ÉV ALATT)” felirata szerint már nem. A Segítő erre a kérdésre nem válaszol, a Súgóba küld. | `guest-05-quote-form-m.png`, `owner-07-meals-saved.png`, `owner-23-helper-q2-m.png` |
| T-3 | KÖZEPES (jogi ellenőrzést kér) | **Az IFA a gyerekre is számolódik:** „400 Ft / fő / éj × 3 fő × 3 éj = 3 600 Ft”. A Htv. 31. § a) szerint a 18. életévét be nem töltött magánszemély IFA-mentes, tehát a helyes összeg 2 400 Ft. A vendég ezt az összeget a visszaigazoló levélben is megkapja. | `guest-07-sent-m.png` |
| T-4 | APRÓ | **A Segítő „Kipróbálás” része „Kész” állapotú**, mielőtt a tulaj bármit kipróbált volna. A próba-foglalásban nincs Ellátás- és gyerek-mező, ezért a tulaj az ellátás-árat nem tudja kipróbálni. A szállás-ára helyes: 68 000 Ft. | `owner-12-setup-d.png`, `owner-18-try-scenario.png` |
| T-5 | APRÓ | **A Szobák lapon a „Mentés” után az Online foglalás lap jön be** (`m=booking&saved=1`), nem a Szobák. A szobák űrlapjáról hiányzik a `back=rooms`. | `owner-10-room-capacity.png` |
| T-6 | APRÓ | **A szelvény Ellátás-listája a gyerekárat nem mutatja** („Reggeli — + 3 000 Ft / fő / éj”). Az oldal Ellátás-szakasza mutatja. | `guest-05-quote-form-m.png` |
| T-7 | APRÓ | **A levelekből nem derül ki, hogy a 3 főből 1 gyerek.** Ez sem a vendég-, sem a tulaj-levélből nem derül ki. A tételsor („Reggeli, gyermek”) utal rá, a tulaj-levélben viszont csak végösszeg van. Az admin kártyája helyes: „Reggeli · 1 gyermek”. | `_elek/mail/455-vendeg.txt`, `_elek/mail/456-tulaj.txt` |
| L-1 | APRÓ | **Asztalon (1366×900) a pirula-pár fénye a jobb oldali foglalási kártya címére lóg**: „[TESZ…”. A jobb szélen a sötét árnyék-sáv (a 10-01-i L-4) ma is ott van. | `lead-01-open-d-fold.png` |
| O-3 | APRÓ (ellenőrizendő) | **A piszkozat „a 8–20 óra közti küldési ablakot” írja**, a mock-megkeresés szabálya viszont hétköznap 9–16 (`feedback_mock_send_window_weekday_9_16`). Lehet, hogy ez a mobil-ablak felirata, nem néztem utána. | `op-18-draft-trialing-lead.png` |
| I-1 | INFO | **Az Irányítópulton a Viola Vendégház válaszánál „Poe dolgozik rajta (tegnap 08:20 óta)” áll**, tehát kb. 36 órája nincs javasolt válasz. Nem a teszt része, de az operátor ezt látja elsőként. | `op-10-dashboard.png` |
| I-2 | INFO | **A mock bevezetője („Pár perc séta a vízpartig…”) távolság-állítás.** A Tényhűség-kapu zöld volt, a forrását nem ellenőriztem. | `lead-01-open-d-fold.png` |

Javult a 10-01 óta: a követett link e-mail mezője előtöltődik (H-4).

---

## 0. A [TESZT] lead — a koordinátor engedélyével, egyetlen tranzakció
Élesen nem volt [TESZT] lead (0 bérlő, 0 próba), és a konzolban nincs „új lead” űrlap. A díjmentes `/scout` csak egy csempe 6 kulcsszavas lezárásával ad leadet, ami Magellan térképét szennyezné. A korábbi [TESZT] leadek (09-30) SQL-másolatok voltak, ezért a koordinátor az „A” változatot engedélyezte: egy írás, egy tranzakció.
- Forrás: `b6d041c8-d5cb-47c9-9e74-4e20f98b53ca` „Keresztes Apartmanház”, Balatonlelle. 10 fotó, soha nem kontaktált, nem vásárolt. **Érintetlen** (utólag ellenőrizve).
- Új lead: **`94d32846-85f6-4e18-ba89-e0955947fae6`** „[TESZT] Keresztes Apartmanház”, + 4 `lead_provenance` sor.
- Minden e-mail `elek@citoviso.com`, a telefon ÜRES (raw.phone törölve, scrapedContact.phone = null), kontakt-csatorna `email`.
- Időzítő-ellenőrzés: a próba-kampány (`trialCampaign.ts`) csak kiküldött hideg megkeresésű leadet vesz fel, és a teszt-leadet kizárja; más automata, ami friss leadet magától felvenne, nincs.

A futtatott SQL (szó szerint `_elek/lead-copy.sql`):
```sql
begin;
with src as (select * from lead where id = 'b6d041c8-d5cb-47c9-9e74-4e20f98b53ca'),
ins as (
  insert into lead (scrape_run_id, name, lat, lng, address, category, qualification, weight, match_confidence, raw, lifecycle_status)
  select scrape_run_id, '[TESZT] Keresztes Apartmanház', lat, lng, address, category, qualification, weight, match_confidence,
    (raw - 'phone' - 'emailCuratedAt' - 'curatorEditedAt')
      || jsonb_build_object(
           'name', '[TESZT] Keresztes Apartmanház',
           'email', 'elek@citoviso.com',
           'contactChannel', 'email',
           'contacts', jsonb_build_array(jsonb_build_object('kind','email','value','elek@citoviso.com','source','manual','accepted',true,'firstSeen','2026-10-13')),
           'scrapedContact', (raw->'scrapedContact') || jsonb_build_object('name','[TESZT] Keresztes Apartmanház','email','elek@citoviso.com','phone',null)),
    'qualified'
  from src returning id
),
prov as (
  insert into lead_provenance (lead_id, field, value, source, matched_entity, confidence, observed_at)
  select ins.id, p.field, case when p.field = 'discovery' then '[TESZT] Keresztes Apartmanház' else p.value end,
         p.source, p.matched_entity, p.confidence, now()
  from lead_provenance p, ins where p.lead_id = 'b6d041c8-d5cb-47c9-9e74-4e20f98b53ca'
  returning lead_id
)
select (select id from ins) as new_lead_id, (select count(*) from prov) as prov_rows;
commit;
-- → new_lead_id 94d32846-85f6-4e18-ba89-e0955947fae6, prov_rows 4
```

## 1. Operátor (konzol, `elek` fiók)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 1.1 | Belépés `admin.citoviso.com/login` | ✅ | `op-00-dashboard.png` |
| 1.2 | Lead lapja: név, e-mail elek@, telefon „–” | ✅ | `op-01-lead.png` |
| 1.3 | Mock generálás, 1 kinézet (Kártyás): 1:55 alatt, **$0,31** (9 AI-hívás). Kapuk: Tényhűség, Piac, Dizájn, Nyitókép mind zöld | ✅ | `op-03-gen-selected.png`, `op-05-mock-card.png` |
| 1.4 | Jóváhagyás | ✅ | `op-06-megkereses.png` |
| 1.5 | Követett link (`/p/aEHM6052HEiGzecilHYf9Xj7`), az e-mail mező előtöltve (elek@). **Kiküldés nem volt** (`email_sent_at`/`sms_sent_at` üres) | ✅ | `op-07-prospect-form.png`, `op-08-prospect-created.png` |
| 1.6 | A próba után: látszik-e a próba? A lead lapján nem (O-1, O-2), a `/pricing`-on „Most 1 próba fut” | ❌ / részben | `op-11…op-18` |
| 1.7 | A foglalás látszik-e a konzolban? Nincs hozzá felület (Tenantok fül „készül”) | ❌ | `op-14-report.png` |
| 1.8 | Riport: a teszt NEM számít bele (0/177 próba), helyesen | ✅ | `op-14-report.png` |
| 1.9 | Riasztások (lent külön) | ✅ (nem kellett szólniuk) | — |

**Riasztások.** A próba indulása és a vendégfoglalás tervezetten nem riaszt. Az operátor csak hibánál kap jelzést: bukott próba-indulás, 30 percen belül nem élesedett oldal, 15 percen belül ki nem ment belépő levél, elhasalt foglalási levél (`houseAlert`).
- Ma minden rendben ment, ezért **egyetlen riasztás sem szólt, és ez a helyes viselkedés**: a `house_alert_once`, `house_alert_sms` és `free_trial_alert` tábla üres, az `sms_outbox` utolsó sora 10-09-i.
- A riasztó-utat élesen hibát okozva nem tudtam kiváltani (kód- és szerver-módosítás nélkül nincs rá mód), tehát ez **nincs élesen igazolva**.
- Beállítás: `alert_phone = +36305161631`, `alert_email` = 3 cím.
- Megfontolandó (tulaj-döntés): kérjen-e az operátor egy „új próba indult” értesítést. Ma erről semmit nem kap (O-2).

## 2. Szállástulaj (Elek)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 2.1 | A minta mobilon és asztalon, operátor-süti nélkül | ✅ (L-1) | `lead-01-open-{m,d}-fold.png` |
| 2.2 | „14 nap ingyen” → űrlap: Teszt Elek, elek@, +36 30 516 1631 (a tulaj teszt-mobilja), 2 pipa → „Elindítom a 14 napos próbát” | ✅ | `lead-02-trial-form-m.png`, `lead-03-trial-filled-m.png` |
| 2.3 | „A hozzáférést elküldtük”, lejárat 2026. 10. 27.; tenant `d3ef5e00…`, site `teszt-keresztes-apartmanhaz` **live** | ✅ | `lead-04-trial-after-m.png` |
| 2.4 | Belépő levél 18:01 (#454), jelszó-beállító link → beléptet a szerkesztőbe | ✅ | `_elek/mail/454-belepes.txt`, `owner-02-after-setpw.png` |
| 2.5 | Áttekintés: próba-sáv, 3 teendő (üres modulok) | ✅ | `owner-03-overview-d.png` |
| 2.6 | Szoba férőhely 4 | ✅ (T-5) | `owner-10-room-capacity.png` |
| 2.7 | Alapár 20 000 Ft/éj | ✅ | `owner-05-base-saved.png` |
| 2.8 | Ellátás: alap = csak szállás; Reggeli +3 000 fő/éj, gyerek 1 500; Félpanzió +7 000, gyerek 3 500; gyermek 12 éves korig; „takarítás, ágynemű, törölköző” | ✅ | `owner-06-meals-filled.png`, `owner-07-meals-saved.png` |
| 2.9 | Szezonár „Őszi szünet” okt. 24. – nov. 2., 24 000 Ft, min. 2 éj (a dátumválasztóval) | ✅ | `owner-08-season-filled.png`, `owner-09-season-saved.png` |
| 2.10 | Foglalás beállítása (Segítő-lap): 6/6 kész; IFA 400 Ft/fő/éj a 4. részben | ✅ (T-4) | `owner-12-setup-d.png`, `owner-15-ifa-filled.png`, `owner-17-setup-after-ifa.png` |
| 2.11 | Segítő, asztal: ár + IFA kérdés (5,2 mp) | ❌ téves állítás (T-1) | `owner-13-helper-q1-d.png` |
| 2.12 | Segítő, mobil: „12 éves gyerek vagy felnőtt?” | ⚠ kitér (T-2) | `owner-23-helper-q2-m.png` |
| 2.13 | Próba-foglalás nov. 1., 3 éj, 3 fő: „Szállás: 68 000 Ft” = kézi számolás | ✅ (ellátás nem próbálható, T-4) | `owner-18-try-scenario.png` |
| 2.14 | Foglalások fül (mobil): a kérés „Reggeli · 1 gyermek · 90 500 Ft” → „Visszaigazolom” → „Igen, visszaigazolom” | ✅ | `owner-19-bookings-m.png`, `owner-21-accept-step-m.png`, `owner-22-accepted-m.png` |

## 3. Vendég (Elek, mobil 390 px — az összesítőt asztalon is)
**Kézi számolás** (a beállított árakból, 2026. 11. 01. → 11. 04., 3 éj, 2 felnőtt + 1 gyerek, reggeli):
- Szállás: 11-01 és 11-02 az „Őszi szünet”-ben (a „nov. 2.” vég az aznapi éjt még tartalmazza) 2 × 24 000 = 48 000; 11-03 alapár 20 000. Összesen **68 000**.
- Reggeli: 3 éj × (2 × 3 000 + 1 × 1 500) = **22 500**.
- **Végösszeg: 90 500 Ft.** IFA a helyszínen: 400 × 3 fő × 3 éj = 3 600 Ft (lásd T-3: helyesen 2 400).

| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 3.1 | Élő oldal, Árak + Ellátás szakasz helyes adatokkal (mobil + asztal) | ✅ (T-2 felirat) | `guest-09-site-{m,d}-fold.png`, `-full.png` |
| 3.2 | Naptár: nov. 1. → nov. 4. Ár-bontás 48 000 + 20 000 = 68 000, IFA 2 fővel | ✅ | `guest-03-dates-m.png` |
| 3.3 | 2. lépés: 3 vendég, 1 gyerek, Reggeli. **A végösszeg 68 000-en marad** | ❌ **V-1** | `guest-05-quote-form-m.png` |
| 3.3d | Ugyanez asztalon: 4 tételsor, **90 500 Ft** | ✅ | `guest-05d-quote-form-d.png` |
| 3.4 | Beküldés: `POST /api/foglalas` 200, FG-8E70E6. A szerver végösszege **90 500 Ft** = kézi számolás | ✅ | `guest-07-sent-m.png` |
| 3.5 | Levél a vendégnek 18:14 (#455): „Foglalási kérését rögzítettük”, tételesen 90 500 + IFA 3 600 | ✅ (T-7) | `_elek/mail/455-vendeg.txt` |
| 3.6 | Levél a tulajnak 18:14 (#456): „Foglalási kérés: Vendég Elek…”, Ellátás: Reggeli, 90 500, Elfogadom/Nem szabad linkek | ✅ | `_elek/mail/456-tulaj.txt` |
| 3.7 | Visszaigazolás után levél a vendégnek 18:19 (#457), lemondó linkkel; „mellékelt naptár-fájl” | ✅ (a mellékletet az olvasó eszköz nem listázza, a levél szövege igen) | `_elek/mail/457-visszaigazolas.txt` |
| 3.8 | A lemondó link GET-re csak megerősítést kér, nem dönt | ✅ | `guest-08-cancel-get-m.png` |

Címzettek: minden levél kizárólag `elek@citoviso.com`-ra ment. SMS egy sem (sms_outbox üres). A tulajnak nem ment semmi.

## Költség
Mock $0,31, Segítő 3 hívás (~$0,001), Places/fizetős API 0.

## Takarítás — ELŐKÉSZÍTVE, NEM FUTOTT (a koordinátor „takaríts” üzenetére)
Szkript: `_elek/cleanup.sh`. Alapból száraz: mentés, törlés tranzakcióban, ROLLBACK, a mentést eldobja. Éles futás: `bash _elek/cleanup.sh --go`. A mentés lekérdezését csak-olvasó módban kipróbáltam (14 KB), magát a szkriptet nem futtattam.
1. Mentés: `/opt/citoviso/backups/elek-eles-teszt-20261013-<ts>/` — teljes `pg_dump -Fc` + `rows.json` (lead, tenant, site, free_trial, prospect, mock_artifact, offer, booking_request).
2. Egy tranzakció:
   - `delete from mock_request` (ma 0 sor; az FK SET NULL, ezért külön);
   - `delete from lead where id='94d32846…' and name='[TESZT] Keresztes Apartmanház'`. Ez kaszkáddal viszi: `lead_provenance`, prospect (`77510622…`, mock_view/mock_event), mock_artifact (`d83184a6…`), free_trial (`3ac0b131…`), tenant (`d3ef5e00…`, site `4d747100…`, site_unit, árak, ellátás, booking_request `8e70e653…`, tenant_user `41e77694…`, tenant_ai_call 3 sor), offer (`1e8eb190…`, 25% kupon).
   - Az FK-gráfot ellenőriztem: minden azonosító-oszlopnak van FK-ja. Ami nem kaszkádol, az SET NULL, és csak törlendő sorokra mutat.
3. Ellenőrző select ugyanabban a tranzakcióban: lead/tenant/site/trial/prospect = 0, a forrás-lead (`b6d041c8…`) = 1.
4. Fájlok a mentés mellé (mv, nem rm): `/opt/citoviso/app/mock-teszt-keresztes-apartmanhaz-card-sidebar-d83184a6.html`, `/opt/citoviso/app/sites/d3ef5e00-ad2d-4300-9870-b55324ca8183/`.
5. Ami MARAD: Elek postafiókjában a #454–#457 levél (az ő fiókja). Számla és fizetés nem keletkezett, sztornó nem kell.

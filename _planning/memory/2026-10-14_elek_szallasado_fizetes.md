# Elek mint szállásadó — éles teszt 3. kör (0038426a): valódi fizetés sikeres, a számla bukott (Számlázz 136)

> A SUB zárójelentése (`~/wt/cit7127850b/_elek/JELENTES.md`). A `shots/` és `mail/` hivatkozások a commitolatlan munkaanyagra mutatnak (`~/wt/cit7127850b/_elek/`). A teszt-adat élesen MEGVAN; a takarítás a koordinátor szavára fut (`_elek/cleanup.sh`), az előfizetés lemondása 2026-11-29 előtt KÖTELEZŐ.


Brief: `~/rc-briefs/elek-szallasado-20261014.md` · fa: `~/wt/cit7127850b` · éles = `0038426a` (prod/20261014-1403, ellenőrizve: `git -C /opt/citoviso/app rev-parse HEAD`).
Képek: `_elek/shots/`, levelek: `_elek/mail/`. Minden útvonal a fához relatív. A képek nincsenek commitolva, a munkafában maradnak.
Élesi írás kézzel: két SQL, mindkettőt a brief engedte (lent szó szerint). Minden más felületen át történt (konzol, levél-link, `/p/` link, tenant-admin, Barion). Az összes többi SQL `begin read only` volt.

## Állapot egy sorban
[TESZT] Nussbaum Panzió lead → mock (Kártyás, $0,45) → jóváhagyás → **megkereső levél KIKÜLDVE a konzolból** elek@-ra (14:10) → Elek a levélből mobilon és asztalon megnyitja a mintát → „14 nap ingyen” → próba + belépő levél → admin: szoba, alapár, ellátás + gyerekár, szezon, IFA, Segítő, próba-foglalás → próba alatt „Folytatom” → Alap csomag, havi → számlázási adatok → **valódi Barion-fizetés 103 Ft** (a tulaj fizetett a telefonján, Visa, 14:28) → admin: előfizető, Pénztárca „sikeres”. **A számla NEM készült el** (Számlázz error 136, a Citoviso Számlázz.hu-fiókjának díja lejárt), ezért **Elek semmilyen levelet nem kapott a fizetés után**.

## Élő linkek
- Minta-honlap (a levél linkje): https://teszt-nussbaum-panzio.citoviso.com (követett link: https://citoviso.com/p/XB04--bNyHBC8Dt3ay3T5gP7, saját megnyitás `?sajat=1`)
- Tenant-admin: https://citoviso.com/login (felhasználó `teszt-nussbaum-panzio`; a jelszó a `_elek/state/owner-pw.txt`-ben, 600)
- Konzol, lead: https://admin.citoviso.com/lead/68f896bd-ddb3-4af8-98b7-80e3de75c8f0

## Leletek (súlyosság szerint)
| # | Súly | Lelet | Bizonyíték |
|---|---|---|---|
| P-1 | **BLOKKOLÓ** | **A fizetés után a számla nem készül el.** A 103 Ft-os Barion-fizetés 14:28:07-kor `paid`. A számla 2 mp-cel később `failed`, a hiba szó szerint: „Számlázz error 136: Bejelentkezési hiba (lejárt a fizetési határidő). Kérjük lépjen be a Számlázz.hu rendszerbe böngészőn keresztül.” A Számlázz.hu a Citoviso fiókját elutasítja, mert a fiók díja lejárt. Amíg ez így van, **minden éles fizetés számla nélkül marad**: ez számlaadási kötelezettség, és a vevő nem kap bizonylatot. Teendő (tulaj): belépni a Számlázz.hu-ba böngészőből és rendezni a díjat. Utána a napi számlázási kör naponta egyszer magától újra kiállítja a számlát (`src/billing/invoiceRetry.ts`, ADR-0283), vagy az operátor kézzel küldi újra (konzol / `scripts/invoice-retry.mts`). A riasztás működött: SMS a tulaj teszt-mobiljára („Citoviso RIASZTAS: a szamla NEM keszult el - CIT-8B57B976. Reszletek e-mailben.”, 14:28), és e-mail a riasztási címekre. | DB `invoice` (csak olvasva), `sms_outbox`, `owner-42-docs-{d,m}.png` („Számlázás folyamatban · Még nincs bizonylat · 103 Ft”) |
| P-2 | KÖZEPES | **A fizetés után a vevő egyetlen levelet sem kap, ha a számla elbukik.** Fizetés után az egyetlen vevőnek szóló levél a számla-levél (`deliverInvoiceEmail`, `src/payment/service.ts`). Bukott számlánál Elek postafiókjába 14:28 után semmi nem jött: se „sikeres fizetés”, se „köszönjük a megrendelést”. A pénzét levonták, és írásban semmi nem igazolja. A Barion saját nyugtáját a tulaj telefonja láthatta, én nem. Javaslat (tulaj-döntés): a fizetés-visszaigazolás menjen ki a számlától függetlenül. | `_elek/mail/` (nincs új levél #472 után) |
| P-3 | KÖZEPES | **A próba alatt vásárolt Alap csomag után az admin úgy mutatja, mintha mind a 11 modult kifizette volna.** Megrendelve: `gallery, enquiry, location` (Alap, 5 180 Ft/hó), a többi 8 modul csak a próba miatt aktív (`module_entitlement.trial_grant = true`). Hol téves: (a) az Áttekintés teendői: „Töltse ki: Amit kínál (felszereltség) **490 Ft/hó — kifizette, de üres**”, és ugyanígy „Nyitvatartás, érkezés 290 Ft/hó — kifizette”. Egyiket sem vette meg. (b) A Modulok fül „Az én moduljaim” alatt mind a 11 modul áraival és „Kikapcsolom” gombbal áll, közben a fejléc „Jelenleg 5 180 Ft/hó”. Az oldalsáv: „11 modul aktív”. (c) Sehol nem derül ki, hogy 8 modul 10-28-án kikapcsol. A konfigurátor a fizetés előtt még kiírta („Amit most nem választ ki, az is bekapcsolva marad a próba végéig (2026. 10. 28.), csak utána kapcsol ki”), fizetés után ez sehol nem látszik. Ok: az `adminViews.ts` „kifizette” ága csak a `trialActive`-ot nézi (ez a fizetés után hamis), a modul `trial_grant` jelzőjét nem. | `owner-40-after-pay-overview-m.png`, `owner-45-my-modules-d.png`, `owner-44-modules-d.png` |
| L-1 | APRÓ | **Asztalon a pirula-pár ma is a jobb oldali foglalási kártyán ül, csak most a csillag-sort takarja.** ADR-0387 a kártya CÍMÉT tette szabaddá. 1366×900-on a „14 nap ingyen / Itt rendelheti meg” pár (x 452–915) a kártya fejlécének csillagjait (`.bcard .bc-head .stars`, x ≈ 845–910) teljesen eltakarja: „3,8 · 293 vélemény” látszik, a ★★★★ nem. 1280/1440/1920-on ugyanígy alul ül. A jobb szélen a sötét árnyék-sáv változatlanul ott van. | `lead-01c-pills-on-1366.png` vs `lead-01c-pills-off-1366.png`, `lead-01-open-d-fold.png` |
| N-1 | APRÓ | **A levél linkje az aldomainre visz (`teszt-nussbaum-panzio.citoviso.com`), nem a `/p/<token>` linkre, ezért a próba-űrlapon az e-mail mező ÜRES.** A 2. körben (a `/p/` linkről indulva) előtöltött volt (H-4). A mérés ettől működik (5 megnyitás a prospectnél), csak az előtöltés vész el. | `lead-02-trial-form-m.png` |
| N-2 | INFO | **A mockot a Piac-kapu megjelölte** („A főcím üres hangulat — a »keszthelyi nyár a maga tempójában« bármely keszthelyi szállásra rámásolható… A kültéri medence kiszorul”). A kiküldés ezt felugróban mutatja, és megerősítést kér („Kiküldöm mégis”). A kapu tehát helyesen jelez, és helyesen nem tilt. A vevő ezt a gyenge főcímet látta. | `op-05-mock-card.png`, `op-11-send-confirm.png` |
| T-1r | APRÓ (maradék) | **A Segítő a „12 éves még gyerek?” kérdésre most is kitér**, és az ügyfélszolgálatra küld. A „Mutasd” chip felirata „Haladó beállítások › Árak és időszakok”, a menüpont neve „Árak, szezonok”. Az asztali ár-kérdésre a válasz helyes (82 500–94 500 Ft sáv, IFA 2 400, a gyerek mentes), de így zárul: „a pontos árat a szállásadó dönti el”, holott a kérdező maga a szállásadó. | `owner-23-helper-q2-m.png`, `owner-13-helper-q1-d.png` |
| I-1 | INFO | **Kétféle új riasztás szólt a tulaj teszt-mobilján, mindkettő helyesen:** „UJ PROBA - TESZT Nussbaum Panzio, Keszthely” (14:16) és a P-1 számla-riasztás (14:28). A 10-13-i kör óta új: az operátor értesítést kap a próba indulásáról (O-2 részben kiváltva). | `sms_outbox` (csak olvasva) |

Rendben volt (nem lelet): a levél tárgya, feladója, jogi lábléce, leiratkozó linkje; a próba-indítás és a belépő levél; az admin minden mentése (szoba → Szobák lapra tér vissza); a szezonár a dátumválasztóval; az ellátás + gyerekár; az IFA a gyereket nem számolja; a próba-foglalás 90 500 / IFA 2 400 = kézi számolás; a konfigurátor árai (Alap 5 180 → −98% → 103 Ft, éves 51 800 → 1 036 Ft); a „Fizetek — 103 Ft” felirat és a figyelmeztetés („valódi kártyaterhelést indít”); a Barion-oldal egy friss böngészőből is megnyílik; a Pénztárca (Visa, automatikus terhelés, következő 2026. 11. 29. · 5 180 Ft, „Terhelések: 103 Ft sikeres”); a Dokumentumok becsületesen „Még nincs bizonylat”; a Modulok „A következő számla tételei” helyesek (3 900 + 790 + 490).

## 0. Előkészítés (operátorként — nem része a vizsgált útnak)
### 0.1 [TESZT] lead — egy tranzakció (brief 1. pont)
- Forrás: `011c3bc2-8650-43e2-a8e2-11da3c78ae68` „Nussbaum Panzió”, Keszthely, portál-only (nincs saját honlapja), 10 fotó. Ellenőrizve: 0 prospect, mock, mock_request, próba, tenant, trial_campaign, outreach_reply, lead_activity, hero-override; névrokon lead nincs. **Érintetlen.**
- Új lead: **`68f896bd-ddb3-4af8-98b7-80e3de75c8f0`** „[TESZT] Nussbaum Panzió”, + 3 `lead_provenance` sor. E-mail `elek@citoviso.com`, telefon üres, csatorna `email`.
- SQL: `_elek/lead-copy.sql` (a 2. kör `lead-copy-2.sql`-jének mintája, csak a forrás-id és a név más).

### 0.2 Konzol (`elek` fiók)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 0.2.1 | Belépés | ✅ | — |
| 0.2.2 | Mock, 1 kinézet (Kártyás): ~2,5 perc, **$0,45** (11 AI-hívás), 6 kép, nyitókép 92 pont | ✅ | `op-04-gen-done.png`, `op-05-mock-card.png` |
| 0.2.3 | Kapuk: Tényhűség, Dizájn, Nyitókép zöld; **Piac: megjelölve** („A főcím üres hangulat — a »keszthelyi nyár a maga tempójában« bármely keszthelyi szállásra rámásolható… A kültéri medence kiszorul a főcímből”) | ⚠ (N-2) | `op-05-mock-card.png` |
| 0.2.4 | Jóváhagyás → követett link (e-mail előtöltve: elek@) | ✅ | `op-08-prospect-created.png` |
| 0.2.5 | Piszkozat: „E-mail: kiküldhető”, jogszerűségi kapu PASS, a Piac-kapu sértése kiírva; a küldés gombja a levél alján | ✅ | `op-09-draft.png` |
| 0.2.6 | **Kiküldés** 14:10 (hétköznap, a 9–16-os ablakban): a gomb felugróban mutatja az őr leletét („kiküldöd mégis?”) → „Kiküldöm mégis” → „Kiküldve (smtp) — elek@citoviso.com; státusz: sent”; utána „E-mail: most NEM küldhető — … (nincs újraküldés)” | ✅ | `op-11-send-confirm.png`, `op-12-sent.png` |

### 0.3 A ~100 Ft-os ajánlat (brief 3. pont) — egy sor
A kód (`src/trial/offer.ts`, `pinTrialOffer`) a próba INDULÁSAKOR rögzíti a lead legjobb élő ajánlatát (a többit lezárja), és a folytatás (`liveTrialOffer`) csak ezt nézi. Ezért a sort a próba ELŐTT kellett beszúrni: utána beszúrva hatástalan lett volna, és a fizetés a 25%-os bevezető áron (3 885 Ft) ment volna.
```sql
insert into offer(kind,prospect_id,percent,scope,expires_at,note)
values('campaign','4d50ea15-79ec-481c-a48a-610bb99cf035',98,'initial',now()+interval '2 days','[TESZT] ~100 Ft')
-- → 11ca00ac-b2ce-4722-8256-676096246b4f
```
A próba indulásakor: a 98%-os sor lett a próba-ajánlat (lejárat 10-28 23:59), a levél 25%-os bevezető ajánlata (`6516ba52…`) lezárult („ADR-0359: lezárva — a próba az űrlapon kiírt ajánlatot viszi”). Mellékhatás: Elek a próba-űrlap után mindenhol „−98%”-ot lát (levél, admin-sáv, folytatás). Ez a teszt műterméke, nem lelet.

## 1. A vizsgált út — Elek, a szállásadó
| # | Lépés | Eredmény | Kép / forrás |
|---|---|---|---|
| 1.1 | Levél a postafiókban (#468, 14:10): tárgy „[TESZT] Nussbaum Panzió – honlap-terv”, feladó „Citoviso <olasz.ferenc@citoviso.com>”. Állítások: nincs saját honlap (igaz: portál-only), 25% bevezető, „havi 5 180 forint helyett 3 885 forinttól” (= Alap havi, igaz), „jutalék nélkül”. Linkek: a minta (aldomain) 200, a leiratkozó link, az adatkezelés. Jogi lábléc: jogos érdek, küldő adatai. | ✅ (N-1) | `mail/468-megkereses.txt`, `op-09-draft.png` |
| 1.2 | Minta mobilon (390) és asztalon (1366): fejléc-sáv „Ez egy honlap-terv…”, 6 fotó, pirula-pár | ✅ mobil / ⚠ asztal L-1 | `lead-01-open-{m,d}-fold.png`, `-full.png` |
| 1.3 | „14 nap ingyen” → űrlap: Teszt Elek, elek@, +36 30 516 1631 (tulaj teszt-mobil), 2 pipa → „A hozzáférést elküldtük”, lejárat 2026. 10. 28. | ✅ | `lead-02-trial-form-m.png`, `lead-03-trial-filled-m.png`, `lead-04-trial-after-m.png` |
| 1.4 | Belépő levél (#472, 14:15): felhasználónév, jelszó-beállító link, „98% kedvezmény… évesen az első évre, havinál az első hónapra” → jelszó beállítva → szerkesztő | ✅ | `mail/472-belepes.txt`, `owner-02-after-setpw.png` |
| 1.5 | Áttekintés: próba-sáv („még 14 nap… Próba-kedvezmény (−98%)… Folytatom”), 3 teendő | ✅ | `owner-03-overview-d.png` |
| 1.6 | Szoba 4 fő → mentés után a Szobák lap | ✅ | `owner-10-room-capacity.png` |
| 1.7 | Alapár 20 000; ellátás: Reggeli +3 000 (gyerek 1 500), Félpanzió +7 000 (gyerek 3 500), 12 éves korig | ✅ | `owner-05-base-saved.png`, `owner-06/07-meals-*.png` |
| 1.8 | „Őszi szünet” okt. 24. – nov. 2., 24 000, min. 2 éj | ✅ | `owner-08-season-filled.png`, `owner-09-season-saved.png` |
| 1.9 | Foglalás beállítása: 5/6, „Kipróbálás — Még nem próbálta ki”; IFA 400 a 4. részben | ✅ | `owner-12-setup-d.png`, `owner-15-ifa-filled.png` |
| 1.10 | Segítő asztalon (ár + IFA), 10 mp: helyes | ✅ (T-1r apró) | `owner-13-helper-q1-d.png` |
| 1.11 | Segítő mobilon („12 éves gyerek?”) | ⚠ kitér (T-1r) | `owner-23-helper-q2-m.png` |
| 1.12 | Próba-foglalás nov. 1., 3 éj, 3 fő, Reggeli, 1 gyerek: 68 000 + 18 000 + 4 500 = **90 500**, IFA **2 400** (a gyerek mentes) = kézi számolás | ✅ | `owner-18b-try-full.png` |
| 1.13 | „Folytatom” → `/p/<token>/folytatas` (a minta-oldal, „Itt rendelheti meg” pirulával) → konfigurátor: alapból Éves; Teljes 103 000 → 2 060 Ft/év | ✅ | `owner-30-continue-m.png`, `owner-31-cfg-m.png` |
| 1.14 | Alap + Havi: „5 180 Ft → 103 Ft / hó · Próba-kedvezmény (−98%) — csak az első hónapra”; „A fizetett időszak a próba vége után indul (2026. 10. 29.)… A következő terhelés 2026. 11. 29.: 5 180 Ft / hó, automatikusan.” | ✅ | `owner-31b-cfg-alap-havi-m.png`, `owner-32-order-form-{m,d}.png` |
| 1.15 | Kép-jogi nyilatkozat → számlázási adatok (magánszemély: Teszt Elek, 8360 Keszthely, Teszt utca 1.; e-mail előtöltve elek@), 3 pipa (azonnali kezdés / elállási jog, ÁSZF, ismétlődő kártyás fizetés) → „Fizetek — 103 Ft” | ✅ | `owner-33-billing-m.png`, `owner-34-billing-filled-m(-full).png` |
| 1.16 | Barion: `secure.barion.com/Pay?Id=…`, „Fizetek: 103 Ft”. Egy friss, süti nélküli böngészőben is megnyílik. A kártyás fizetést a koordinátor kérésére a tulaj végezte a saját telefonján. | ✅ | `owner-35-barion-m.png` |
| 1.17 | Fizetés: `payment` paid 103 Ft, 14:28:07, ismétlődés indítva; előfizetés active 10-29 → 11-29, Visa | ✅ | DB, csak olvasva |
| 1.18 | **Számla: failed (Számlázz 136)** | ❌ **P-1** | DB `invoice` |
| 1.19 | **Visszaigazoló levél: nem jött** (14:28 után 0 levél) | ❌ **P-2** | postafiók |
| 1.20 | Admin a fizetés után: a próba-sáv eltűnt; oldalsáv „Havi előfizetés · megújul 2026. 11. 29.”; Modulok: díj 5 180 Ft/hó, a következő számla tételei helyesek | ✅ / ⚠ P-3 | `owner-44-modules-d.png`, `owner-45-my-modules-d.png` |
| 1.21 | Áttekintés a fizetés után: „Amit kínál… 490 Ft/hó — kifizette, de üres”, „Nyitvatartás… 290 Ft/hó — kifizette” | ❌ **P-3** | `owner-40-after-pay-overview-m.png` |
| 1.22 | Pénztárca (asztal + mobil): Visa, lejárat, „Automatikus terhelés bekapcsolva”, következő 11-29 · 5 180 Ft, „103 Ft sikeres”; „Megbízás visszavonása” gomb | ✅ | `owner-41-wallet-{d,m}.png` |
| 1.23 | Dokumentumok (asztal + mobil): 0 kiállított számla, „Számlázás folyamatban · Még nincs bizonylat · 103 Ft” | ✅ (becsületes; a számla a P-1 miatt hiányzik) | `owner-42-docs-{d,m}.png` |

Címzettek: minden levél kizárólag `elek@citoviso.com`-ra ment (#468, #472). SMS csak a tulaj teszt-mobiljára ment (két operátori riasztás, I-1). Valódi szállásnak és valódi számra semmi nem ment. A forrás-lead (`011c3bc2…`) érintetlen.

## Költség
Mock $0,45 (11 hívás), Segítő 2 hívás, Places/fizetős API 0. Fizetés: 103 Ft (a tulaj kártyájáról, ő fizetett).

## Takarítás — ELŐKÉSZÍTVE, NEM FUTOTT
Szkript: `_elek/cleanup.sh` (az 1–2. kör mintájára, a fizetés miatt kibővítve). Alapból száraz: mentés, törlés tranzakcióban, ROLLBACK, a mentést eldobja. Éles futás: `bash _elek/cleanup.sh --go`. A szkriptet nem futtattam.

**⛔ KÜLÖN, HATÁRIDŐS: az előfizetést 2026. 11. 29. ELŐTT le kell mondani**, különben a tulaj kártyáját a Barion 5 180 Ft-tal terheli (havi ismétlődés, a megbízás él). Út a felületen (Elekként, tenant-admin): **Pénztárca → „Megbízás visszavonása”** (vagy Modulok → Előfizetés → „Megbízás visszavonása”). Ezt a koordinátor „takaríts” üzenetére először a felületen futtatom, és képpel igazolom. A `--go` megtagadja a futást, amíg az előfizetés nincs lemondva.

Sorrend:
1. **Előfizetés lemondása a felületen** (fent). Határidő: 11-29.
2. **Számla:** ma nincs kiállított számla (P-1). Ha a Számlázz-fiók rendeződik, a napi kör magától kiállítja (103 Ft, „Teszt Elek”). **A sztornó a tulajé** (memória: „valódi Számlázz-számla készül, sztornó a tulajé”). A `--go` megtagadja a futást, amíg van sztornó nélküli kiállított számla. A helyi `invoice` sorok a törléssel kaszkádban mennek (invoice → payment → order_intent), az `accounting_document` sorok maradnak (SET NULL).
   ⚠ Mérlegelendő: ha a takarítás a számla kiállítása ELŐTT fut, a fizetés-sor törlődik, és a napi újrapróba nem állít ki számlát egy valóban kifizetett 103 Ft-ra. Ezért a törlés vagy a számla + sztornó után fusson, vagy a tulaj döntse el, hogy a 103 Ft-ról kézzel ad bizonylatot.
3. Mentés: `/opt/citoviso/backups/elek-szallasado-20261014-<ts>/`: teljes `pg_dump -Fc` + `rows.json` (lead, tenant, site, free_trial, prospect, mock_artifact, offer, order_intent, payment, invoice PDF nélkül, subscription recurrence-token nélkül, partner, booking_request).
4. Egy tranzakció: `delete from mock_request …`, majd `delete from lead where id='68f896bd…' and name='[TESZT] Nussbaum Panzió'`. Kaszkáddal viszi: `lead_provenance`, prospect `4d50ea15…` (mock_view, offer ×2, order_intent `a2266670…` → payment `8b57b976…` → invoice), mock_artifact `43f8d005…`, free_trial `f4e577e3…` (SET NULL), tenant `e04bd3ea…` (site `aff70a30…`, szoba, árak, ellátás, module_entitlement, subscription, tenant_user, tenant_message, tenant_ai_call). Az FK-gráfot csak olvasva ellenőriztem: RESTRICT nincs, a nem-kaszkádolók SET NULL-ok.
5. Ellenőrző select ugyanabban a tranzakcióban: lead/tenant/site/trial/prospect/orders/subs = 0, a forrás-lead (`011c3bc2…`) = 1.
6. Fájlok a mentés mellé (mv): `/opt/citoviso/app/mock-teszt-nussbaum-panzio-card-sidebar-43f8d005.html`, `/opt/citoviso/app/sites/e04bd3ea-2fdd-4797-9eab-2a818d3d097a/`.
7. Ami MARAD: Elek postafiókjában a #468 és #472 levél; a Barion-tranzakció (103 Ft) a Barion-fiókban (visszatérítés nincs, a tulaj elfogadta); az operátori SMS-ek.

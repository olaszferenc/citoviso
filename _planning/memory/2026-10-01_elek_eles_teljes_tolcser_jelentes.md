# Elek — éles teljes tölcsér · JELENTÉS (KÉSZ — mindhárom szerep végigment)

> A SUB 🟩2.1 zárójelentése, változatlanul. A `shots/` és a `mail/` hivatkozások a commitolatlan munkaanyagra mutatnak (88 MB, `~/wt/citec0aeb80/_elek/`), azokat nem tettük a repóba. A V-1, T-1, T-2 és SZ-1/2 leletek javítva vannak a mainen (d5a93b63, 04ae2743, 705053c8, f26f7671); a többi nyitott.

Brief: `~/rc-briefs/elek-eles-teljes-tolcser.md` · fa: `~/wt/citec0aeb80` · 2026-10-01 · éles = `87dd8ab1`
Minden útvonal a fához relatív. Képek: `_elek/shots/`. Repóba nem írtam (az `_elek/` nincs gitignore-ban, de nem commitolom).
Élesi írás KIZÁRÓLAG felületen át történt (konzol, lead-oldal); SQL csak `begin read only`.

## Állapot egy sorban
Lead → mock (editorial) → jóváhagyás → kiküldés (e-mail + MMS + SMS) → lead-szemmel megnyitva (asztal + mobil) →
konfigurátor → fizetési lap (itt megálltam, a tulaj fizetett: 186 Ft, 11 modul, benne a foglalás) → élő oldal +
belépő levél + számla → tenant-admin (2 szoba, árak, időszak, foglalási szabályok) → 2 vendég-foglalás (asztal + mobil)
→ 1 visszaigazolás levél-linkből + 1 adminból → vendég-lemondás. **Mindhárom szerep végigment.**

## A legfontosabb leletek (súlyosság szerint)
| # | Súly | Lelet |
|---|---|---|
| V-1 | **MAGAS** | A tulaj-levél „Elfogadom” / „Nem szabad” linkje **GET-re azonnal dönt** (`src/server/public.ts:3663`), miközben a vendég-oldali ajánlat- és lemondó-link szándékosan nem, mert „mail clients prefetch links”. Egy levélszűrő link-ellenőrzése (Safe Links stb.) egyetlen kattintás nélkül visszaigazolhat vagy elutasíthat egy foglalást. Élőben megmérve: `owner-01-accept-link-m.png`, egyetlen GET → „Elfogadva”. |
| T-1 | **MAGAS** | A **megvett „Térkép, megközelítés” modul nincs az élő oldalon**. Az admin szerint aktív, a „Térkép látszódjon” be van kapcsolva, cím és koordináta megvan, az élő HTML-ben mégsincs `data-cit-module="map"` szekció. |
| SZ-1 | **MAGAS** | Forrástalan szolgáltatás-ígéretek (bérelhető kerékpár, saját parkoló, főtt reggeli, grill). **Az élő oldalra is kikerültek** (lásd a szöveg-minőség fejezetet). |
| SZ-2 | **MAGAS** | Tegezés és magázás keveredik, az élő oldalon is („AMIT ITT KAPSZ”, „várjuk a leveled”). |
| T-2 | KÖZEPES | Az **„Érkezés és távozás” minta-időpontjai (14:00–20:00 / 10:00) az élő oldalon tényként jelennek meg**. A Nyitvatartás modulban mentett értékként állnak, a tulaj soha nem adta meg őket. |
| F-1 | KÖZEPES | A **számla vevő-címe vegyes**: az irányítószám és a város a SZÁLLÁSÉ (8360 Keszthely, a rendelő űrlap a leadből előtöltötte), az utca a tulajé („Ráckevei út 083/2 hrsz.”), a végén egy 11 jegyű, adószám-formájú számmal (`24393470213`), az adószám-mező pedig üres. NAV-ba ment számla. |
| F-2 | KÖZEPES | A Barion „Canceled” állapota (a vevő visszalépett) nálunk `failed`, és a vevő a „Fizetés elutasítva / A fizetés nem sikerült” lapot kapja. Naplósor nincs róla. Részletek: 2.4b. |
| A-1 | KÖZEPES | A **„Szoba törlése” kérdés nélkül töröl** (naptárral és árakkal együtt). Ez a saját szkript-hibámból derült ki, részletek: 2.6. |
| K-1 | KÖZEPES | A konzol lead-lapján a bukott 97 Ft-os kosárnál ott maradt a „Fizetési kérés küldése ▸”, a súgószöveg pedig hamis: „Barion helyén mock … Auto-terhelés (MIT) = 2. fázis”. |
| … | | a többi lelet alább, szakaszonként |

---

## 0. Előfeltétel — PASS
- Éles `87dd8ab1`, 0 prospect / 0 mock / 0 bérlő a kezdéskor; lead `e629826b…` = `[TESZT] Muschel Panzió`, 8 forrássor.
- Zoho IMAP csak-olvasás (EXAMINE/BODY.PEEK) működik.
- Konzol-belépés: az `elek` fiókkal OK (`/belepes` → `/login` → `/`).

## 1. Operátor (konzol)

| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 1.1 | Lead e-mail → `olasz.ferenc@citoviso.com` (Adatok fül, „Adatok mentése”) | PASS | `shots/op-01-lead-before.png`, `shots/op-02-email-saved.png` |
| 1.2 | Első mock (Fullbleed) a pillanatképhez, majd mind a 19 kinézet ennek a leadnek az adatával (`tpl-preview`) | PASS | `shots/skins-contact.png`, `shots/skin-*.png`, `shots/grid-{card-sidebar,editorial,watercolor}-{d,m}.png` |
| 1.3 | **Választás: Szerkesztői (editorial, `editorial-warm`)** → mock `f504c405` | PASS | `shots/grid-mock-editorial-d.png`, `shots/mock-editorial-{d,m}-full.png` |
| 1.4 | Jóváhagyás | PASS | `shots/op-09-approved.png` |
| 1.5 | Követett link (`/p/teszt-muschel-panzio/2uxtd…`), piszkozat, kiküldés MINDKÉT csatornán | PASS | `shots/op-11-prospect-created.png`, `shots/op-12-draft.png`, `shots/op-14-send-confirm.png`, `shots/op-15-after-send.png` |

**Miért az editorial:** a 19 kinézetből ez olvasható leginkább egy valódi butik-panzió oldalaként. A 6 valódi fotó polaroid-galériában érvényesül, a foglalási szelvény már az első képernyőn ott van, és mobilon is rendezett marad. A második helyezett a Kártyás (card-sidebar): tiszta, de Airbnb-klón hatású. A sötét skinek (dark-luxury, cinematic, artdeco) egy rózsaszín, kertes keszthelyi panzióhoz túl „hotel-esek”, az Arch-frames nyitóképernyője pedig üres.

**Címzett-ellenőrzés kiküldés előtt:** a lead nyers adataiban a VALÓDI Muschel Panzió elérhetőségei is szerepelnek
(`info@muschelhotel-balaton.hu`, `+36 70 212 0874`, `(06 83) 314 380`). A küldőgombok címzettjét a szkript tételesen ellenőrizte. Csak `olasz.ferenc@citoviso.com` és `+36301200971` szerepelt.
Kiment: e-mail 08:37 (smtp) · MMS 08:38 (`sent`, message_id `B8F8B0EE…`) · SMS 08:39 (`sent`).

### Operátor-leletek
- **H-1 · KÖZEPES · Kinézet-előnézet: óriási fekete térkép-tű + üres keret.** A `/lead/:id/tpl-preview?tpl=…` lapon minden kinézetnél a „Megközelítés” blokkban egy ~300 px-es fekete tű van (`shots/grid-editorial-d.png`, jobb oszlop). A kész mockon ugyanez 34×34 px, ott rendben van. Valószínűleg az előnézetből hiányzik a modul-szekciók CSS-e. Ezen a képen dönt a kurátor a kinézetről.
  Repro: bármely lead, amelynek van mockja → Mock és generálás → a kinézet-rácsból bármelyik → előnézet.
- **H-2 · KÖZEPES · Tényhűség-kapu: „megjelölve”, de a kártyán nem derül ki, MIT jelölt meg.** A mock-kártyán csak a „Tényhűség: megjelölve” pirula látszik, a „Részletek ▾” sem sorolja fel a tételeket. A tételek csak a piszkozat-lapon és a küldés-megerősítőben jelennek meg. Ráadásul ott is a MINTA-tételeket listázza (Wi-Fi, fürdő, erkély, kisállat, érkezési idő), a valódi forrástalan szabad szöveget nem (lásd a szöveg-minőség fejezetet, SZ-1).
- **H-3 · KÖZEPES (GYANÚ) · Szegmens-ellentmondás.** A lead „modern / saját honlap” besorolású, ezért a szegmens előválasztása „van lábnyom”. Ennek a levélmondata viszont ez: „Saját, modern oldal viszont még nincs a képben.” A konzol ugyanarról a leadről egyszerre állítja, hogy van és hogy nincs saját modern oldala. Megjegyzés: a „honlap” valójában egy portál-aldomain (`muschel-panzio.hotels-in-hungary.net`), tehát a levél állítása lehet igaz, és a besorolás téved.
- **H-4 · ALACSONY · A követett link e-mail mezője üres.** Az Adatok fülön mentett `olasz.ferenc@citoviso.com` nem töltődik elő a „Követett link készítése” űrlapba. Kézzel kellett beírni, különben „a rendszer nem tud levelet küldeni”.
- **H-5 · ALACSONY · A második generálás gombja más helyen és más felirattal van.** Az első mock után a generáló űrlap egy csukott „Új mock generálása, forrás és szöveg-újraírás” blokkba kerül, a gomb felirata pedig „Mock újragenerálása” lesz. Ez azt sugallja, hogy felülírja a meglévőt, pedig új, második mock készül mellé.
- **H-6 · ALACSONY · Elavult értesítés.** Jóváhagyás után a lap tetején a „Kész: a mock legenerálva. 0:43 alatt” sáv áll, nem a jóváhagyás visszajelzése.
- **H-7 · ALACSONY · „8–20 óra közti küldési ablak”.** A piszkozat-lap ezt ígéri, miközben élesen `MOBILE_SEND_WINDOW_OFF=1` van beállítva (a teszt idejére szándékos). A felirat ilyenkor nem igaz.
- **H-8 · INFO · Az MMS tárgya csonka:** „Citoviso latvanyterv - [TESZT] Muschel P” (ékezet nélküli és levágott).
- INFO: az `/belepes` → `/login` átirányítás működik. A List-Unsubscribe fejléc hiánya szándékos (`OUTREACH_LIST_UNSUBSCRIBE=off`, ADR-0069).

## 2. Szállástulaj (lead-szemmel) — a fizetésig

| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 2.1 | A levél megérkezett az INBOX-ba (#348, 08:37). Saját magának küldött levél: ugyanaz a példány a Sent-ben (#631). Tárgy: „[TESZT] Muschel Panzió – honlap-terv” | PASS | `mail/01-outreach.eml`, `shots/lead-01-mail-{d,m}.png` |
| 2.2 | A link mobilon (390 px) és asztalon, friss böngészőben, operátor-süti nélkül | PASS (leletekkel) | `shots/lead-02-open-m-fold.png`, `shots/grid-lead-02-m.png`, `shots/lead-02-open-d-fold.png`, `shots/lead-02-open-d-full.png` |
| 2.3 | „Itt rendelheti meg” → csomag (Teljes, benne az Online foglalás) → ingyenes aldomain (`teszt-muschel-panzio.citoviso.com`, előtöltve) → Havi → képjogi nyilatkozat → számlázási lap | PASS | `shots/lead-03-config-d-1.png`, `shots/lead-04-step2-d.png`, `shots/lead-05-billing-d.png` |
| 2.4 | **FIZETÉS — MEGÁLLTAM.** A lap: „Fizetek — 4 650 Ft” (valódi Barion-terhelés). Számlázási adatot NEM töltöttem, egyetlen pipát sem tettem be. order_intent/payment: 0 sor. | STOP | `shots/lead-05-billing-d.png` |

A leiratkozó linket szándékosan nem nyitottam meg, mert már egy GET kérés is leiratkoztat.

### Lead-oldali leletek
- **L-1 · KÖZEPES · Az eszkalációs ajánlat ~3 perc alatt feljött, és „Most még gondolkodom” után is életben marad.** A 3. megnyitásra (08:40) jött a „Szeretnénk segíteni a döntésben — Látjuk, hogy már többször megnézte…” ablak, −50% és 71:59:10-es visszaszámláló (`shots/lead-03-veil-d.png`). A három megnyitás az én tesztem volt, tehát ez mérés-zaj, de egy valódi tulaj is megnyitja 2–3-szor néhány perc alatt (telefon + gép). A „Látjuk, hogy…” megfogalmazás figyelés-érzetet kelt.
  ⚠️ Élesen létrejött egy `offer` sor: `kind=escalation, percent=50, expires 2026-10-04 06:39 UTC, prospect eae55f63…`. **A koordinátornak tudnia kell róla a 98%-os kampány beírásakor.**
- **L-2 · KÖZEPES · Egy kedvezmény két néven ugyanazon a lapon.** A fizetési lapon bal oldalt ez áll: „Bemutatkozó ajánlat a levélből (−50%)”, jobb oldalt: „Döntés-segítő ajánlat: −50%”. A levél viszont 25%-ot ígért. A bal oldali felirat hamis: az 50% nem a levélből jön.
- **L-3 · KÖZEPES · Az első fotó feliratsávja mobilon a kép alsó negyedét takarja** („[TESZT] Muschel Panzió — 1. kép”, `shots/lead-02-open-m-fold.png`). Ráadásul gépies, semmitmondó felirat, és mind a 6 galériaképen ugyanez a minta ismétlődik („— 1. kép” … „— 6. kép”).
- **L-4 · ALACSONY · Asztalon a jobb szélen sötét árnyék-sáv lóg be** (`shots/lead-02-open-d-fold.png`, x≈1340–1366). Valószínűleg a csukott konfigurátor-fiók árnyéka.
- **L-5 · ALACSONY · A térkép-keret üres** (fehér doboz tűvel és névvel), asztalon és mobilon is, headless Chromiumban. Lehet, hogy csak a headless böngésző nem tölti be a Google-beágyazást; valódi telefonon érdemes megnézni.
- **L-6 · ALACSONY · „Nem kötelező.”** a „Tovább a számlázási adatokhoz” gomb alatt (`shots/lead-04-step2-d.png`), közvetlenül egy kötelező nyilatkozat-pipa mellett. Zavaró: mi nem kötelező?

---

## Szöveg-minőség (AI-szag + valóság-illeszkedés)

A tényhűség-őr (`tenyhuseg-or` agent) ítélete a mockra: **FLAG**.

### SZ-1 · MAGAS · Forrástalan szolgáltatás-ígéretek a generált szabad szövegben
| Állítás (idézet) | Hol | Forrás |
|---|---|---|
| „bérelhető biciklik a Balatonhoz”, „Bérelhető kerékpárok a Balaton körüli túrákhoz”, „kerékpárok a tó körül” | idézet-főcím, tagline, kiemelés (3 helyen) | ⛔ nincs strukturált mező, és képen sem látszik |
| „Bőséges saját parkoló” | kiemelés | ⛔ nincs |
| „frissen főtt tojással és kiváló kávéval”, „Friss, főtt reggeli” | bevezető, kiemelés | ⛔ nincs |
| „grillezési lehetőség”, „Grillezős terasz” | bevezető, kiemelés | ⛔ a képen terasz látszik, grill nem |
| „a nyugodt Nádas közben” | bevezető | a cím igaz, a „nyugodt” forrástalan |
| „Kültéri medence napozóágyakkal”, „árnyékos terasz”, „gondozott kert” | | ✅ képről igazolható |
| „4,8 · 145 vélemény” | | ✅ Places-adat |

A generátor ezeket „piaci tény”-ként (marketFactsNamed) a vendégvéleményekből vette. A véleményszöveg viszont nem tárolódik, ezért utólag NEM auditálható, és a §B.17 szerint önmagában nem is forrás.
**Egy valódi vendég szemével:** ha nincs bérelhető kerékpár, a vendég ezt a honlapon ígéretként olvassa, és számon kéri. Ez a leg-károsabb hibafajta.
**A kapu vakfoltja:** a kapu a MINTA-tételeket (Wi-Fi, fürdő, erkély, kisállat, érkezési idő) sorolta fel sértésként. Azok jelölve vannak, tehát rendben. A valódi szivárgást (fenti táblázat) a kapu nem nevezte meg, a konzol pedig ezt mutatja az operátornak.
*Javaslat (nem a motor átírása):* vendégvéleményből jövő szolgáltatás csak forrás-hivatkozással vagy „vendégeink szerint…” keretben jelenjen meg, és a kapu a szabad szöveget is listázza.

### SZ-2 · MAGAS · Tegezés és magázás keveredik, egy mondaton belül is
- „**AMIT ITT KAPSZ**” (tegező szekciócím), miközben a lap többi része magázó („Írja meg”, „Ön”).
- „Kérdés, egyedi kérés, csoportos érkezés? A foglalási szelvényen vagy az alábbi elérhetőségeken várjuk a **leveled**.” A mondat magázó kontextusban tegez.
Egy magyar vendég ezt azonnal hibának olvassa: „nem ember írta”.

### SZ-3 · KÖZEPES · AI-szag, konkrét mondatokkal
- **Ál-idézet főcímként:** „„Kerti medence, grillezős terasz és bérelhető biciklik a Balatonhoz”” — idézőjelben áll, de senki nem mondta. Ráadásul a „biciklik a Balatonhoz” értelmetlen vonzat (mihez? oda vezetnek?).
- **„Medence, reggeli és kerékpárok a tó körül”:** a „tó körül” a medencére és a reggelire is vonatkozik, ami értelmetlen. Hármas felsorolás plusz hely, tipikus generált minta.
- **„Friss, főtt reggeli”:** tükörfordítás-ízű (cooked breakfast). Magyarul a „főtt reggeli” főtt ételt jelent, nem meleg reggelit.
- **„A HÁZ SZÁMOKBAN”** alatt egyetlen szám áll (4,8). Üres sablon-ígéret.
- **„Képes krónika”, „No. 1 / No. 2 / No. 3”, „Foglalási szelvény”, „Szerkesztőség”, „Nyomtatva a világhálón”:** az editorial-skin magazin-játéka. Egyenként szellemes, együtt erőltetett. Egy panzió oldalán a „Szerkesztőség” mint kontakt-rovat és a „Nyomtatva a világhálón” lábjegyzet idegen.
- **„A Muschel Panzió gondozott kertjében kék vizű medence és árnyékos terasz várja a vendégeket”:** „X várja a vendégeket”, a legtipikusabb szálláshely-generált nyitás.
- Drop-cap mellékhatás: a szövegben „AMuschel Panzió…” egybeolvad (képernyőolvasón és másoláskor).

### SZ-4 · KÖZEPES · „Programok a környéken” — konkrét dátumú, kitalált események
„2 OKT. Termelői piac · 3 OKT. Borkóstoló est · … 14 OKT. Kiállítás-megnyitó”. A valódi dátumok és napok stimmelnek, csak a bevezető mondat elején áll „Minta-napirend.”, majd ugyanaz a bekezdés hozzáteszi: „Élesben itt a következő két hét valós programjai állnak”. Egy vendég eljöhet az „okt. 3. Borkóstoló est”-re. *Javaslat:* tételenkénti MINTA-pirula vagy dátum nélküli megjelenítés.

### SZ-5 · KÖZEPES · A megkereső levél
- „A Google-on 4,8 csillagos, 145 vélemény alapján.” — alany nélküli csonka mondat; gépies.
- „Saját, modern oldal viszont még nincs a képben.” — a „nincs a képben” idegen fordulat (≈ „nem tud róla”), és ellentmond a konzol saját besorolásának (H-3).
- „Tisztelt [TESZT] Muschel Panzió!” — egy céget szólít meg; élesben „Tisztelt Szállásadó!”/név jobb lenne (a teszt-előtag itt nem hiba).
- Pozitív: rövid, konkrét, az ár és a jogi lábléc világos; a kép a levélben jó horog.
- SMS: „…A Citoviso Csapata” (nagy Cs — angolos); amúgy rendben.

### SZ-6 · ALACSONY · Valóság-illeszkedés egyebek
- „Amit kínálunk (MINTA)” „Klíma” és „Kisállat” ikonokkal állításnak hat — a generátor saját listáján a klíma épp a lemaradt tény.
- Galéria-feliratok „[TESZT] Muschel Panzió — N. kép”: értéktelen, gépies alt-szöveg látható feliratként.

---

## Élesben létrejött rekordok (eddig)
- lead `e629826b…`: e-mail kurátori javítás → `olasz.ferenc@citoviso.com`
- mock_artifact `7d12c718…` (fullbleed, generated) · `f504c405…` (editorial, **approved**)
- prospect `eae55f63…` (van_labnyom), link `/p/teszt-muschel-panzio/2uxtdEIQaAaAqId0agj3jEQB`, e-mail + mobil-páros kiküldve
- offer `27e23a7c…` (outreach 25%) · offer `f38781e4…` (**escalation 50%, lejár 2026-10-04 06:39 UTC**)
- mms_outbox `86c78555…` sent · sms_outbox `7148e2c1…` sent
- AI-költség: 2 generálás (az editorial 3 hívás, $0.21)

## Képek / HTML a koordinátornak (fához relatív)
- Skin-döntés: `_elek/shots/skins-contact.png`, `_elek/shots/grid-editorial-d.png`, `_elek/shots/grid-editorial-m.png`, `_elek/shots/grid-card-sidebar-d.png`
- Kész mock: `_elek/shots/grid-mock-editorial-d.png`, `_elek/shots/mock-editorial-d-full.png`, `_elek/shots/mock-editorial-m-full.png`
- Levél: `_elek/mail/01-outreach-render.html` (kattintható), `_elek/shots/lead-01-mail-d.png`, `_elek/shots/lead-01-mail-m.png`
- Lead-oldal: `_elek/shots/lead-02-open-m-fold.png`, `_elek/shots/grid-lead-02-m.png`, `_elek/shots/lead-02-open-d-fold.png`
- Eszkaláció + rendelés: `_elek/shots/lead-03-veil-d.png`, `_elek/shots/lead-03-config-d-1.png`, `_elek/shots/lead-04-step2-d.png`, `_elek/shots/lead-05-billing-d.png`
- Konzol: `_elek/shots/op-12-draft.png`, `_elek/shots/op-14-send-confirm.png`
- Szövegek: `_elek/mock-editorial-text.txt`, `_elek/mail/01-outreach.txt`
- Fizetés után: `_elek/shots/grid-live-d.png`, `_elek/shots/grid-live-m.png`, `_elek/shots/invoice-CITO-2026-2-1.png`, `_elek/mail/03-invoice-szamla-CITO-2026-2.pdf`
- Tenant-admin: `_elek/shots/ten-02-after-login.png`, `_elek/shots/ten-08-rooms-filled.png`, `_elek/shots/ten-09-room-editor.png`, `_elek/shots/ten-12-season-saved.png`, `_elek/shots/ten-13-booking-config.png`, `_elek/shots/ten-16-after-accept.png`
- Vendég: `_elek/shots/guest-02-filled-d.png`, `_elek/shots/guest-03-sent-d.png`, `_elek/shots/guest-m-02-dates.png`, `_elek/shots/guest-03-sent-m.png`, `_elek/shots/owner-01-accept-link-m.png`, `_elek/shots/guest-04-cancel-page-m.png`, `_elek/shots/guest-05-cancelled-m.png`
- Levelek (kattintható HTML): `_elek/mail/04-owner-booking-d-render.html`, `_elek/mail/05-guest-booking-d-render.html`, `_elek/mail/09-guest-confirmed-m-render.html`, `_elek/mail/c358-render.html`

## Koordinátori közjáték
- A koordinátor beírta a 98%-os kampány-ajánlatot (`offer cf57e5f9…`, scope initial, 2026-10-02 10:27 UTC-ig), és a tulajnak elküldte a linket; a tulaj fizet.
- ~10:27 UTC körül a koordinátor egy curl GET-tel megnyitotta a lead-oldalt. Ha a Tevékenység-naplóban ott egy plusz megtekintés látszik, az az övé, nem a tulajé és nem az enyém.

## 2 (folytatás). Fizetés után — tulajként

### 2.4b · A bukott 97 Ft-os fizetés (koordinátori kérés)
- `payment 548e31cd…`: 97 Ft, 3 modul (gallery, enquiry, location), létrehozva 10:28:05, státusz `failed`, `paid_at` üres.
- **Barion (GetPaymentState, csak olvasás):** `Status = Canceled`, `CompletedAt = 10:28:39Z` (34 mp-cel az indítás után), a tranzakció `Rejected`, `FundingSource` üres, `Errors` üres.
  → Nem kártya-elutasítás, hanem **a vevő megszakította a Barion-oldalon** (valószínűleg visszalépett, hogy a foglalással bővebb csomagot válasszon; a 2. kísérlet 67 mp múlva indult).
- **Mit látott a tulaj (kódból, megerősítendő):** a `FAILED_STATES` (`src/payment/barion.ts:31`) a Canceled-et is `failed`-re képezi, ezért a visszatérő lap: „**Fizetés elutasítva** — A fizetés nem sikerült. Nem történt terhelés. A megrendelése megmaradt…” (`src/console/views.ts:2984`). Egy önkéntes visszalépés „elutasítás”-ként jelenik meg. **Kérlek, kérdezd meg a tulajt, ezt látta-e.**
- **Napló:** a `journalctl` 10:27:30–10:31 között a bukásról EGYETLEN sort sem tartalmaz (a sikeresről hat sort ír). Néma bukás.
- A bukott `order_intent 6a9dbb3c…` státusza ma is `submitted`, és a konzol a „Fizetési kérés küldése ▸” gombot kínálja hozzá (K-1).

### 2.5 · Élő oldal, belépő levél, számla
| Lépés | Eredmény | Kép / fájl |
|---|---|---|
| Élő oldal `teszt-muschel-panzio.citoviso.com`, asztal + mobil | PASS, leletekkel | `shots/grid-live-d.png`, `shots/grid-live-m.png`, `shots/live-{d,m}-full.png` |
| „Belépési adatai – [TESZT] Muschel Panzió” (10:29:58) | PASS, leletekkel | `mail/02-login.txt` (a jelszó kitakarva) |
| „Számla CITO-2026-2 – Honlap-előfizetés (havi)” + PDF (10:30:03) | PASS, leletekkel | `mail/03-invoice-szamla-CITO-2026-2.pdf`, `shots/invoice-CITO-2026-2-1.png` |

Leletek:
- **T-1 MAGAS:** nincs térkép a megvett Térkép-modullal (lásd fent).
- **T-2 KÖZEPES:** a minta érkezési idők tényként jelennek meg (lásd fent).
- **T-3 · KÖZEPES · A belépő levél a jelszót nyílt szövegben küldi**, és „Ha elfelejtené, válaszoljon erre a levélre” — nincs önkiszolgáló jelszó-visszaállítás.
- **T-4 · ALACSONY · Fordított névsorrend:** „Kedves **Viktória Olasz-Balogh**!” (levelek) és a számla vevője ugyanígy. Az order_intent `buyer_name` így áll, tehát a vevő így írta be. Magyar vevőnél az űrlap nem kérdez külön vezeték- és keresztnevet, és a megszólítás sem igazítja.
- **F-1 KÖZEPES:** vegyes számla-cím (lásd fent). **Kérlek, kérdezd meg a tulajt, mit írt be, és hova szánta a `24393470213`-at.**
- **F-3 · ALACSONY · Egy kedvezmény három néven:** a számlán „Üdvözlő kedvezmény: … −98%” áll, holott ez a *campaign* ajánlat. Az *üdvözlő* kupon egy KÜLÖN 25%-os ajánlat (`offer e3dc5629…`), ami a fizetés után született.
- **F-4 · ALACSONY (GYANÚ) · Az üdvözlő kupon (25%, 90 nap) nem látszik a „Következő számla (2026. 11. 01.) 9 300 Ft” soron** (Modulok lap). Vagy nem érvényesül automatikusan, vagy a lap nem mutatja.
- **T-5 · GYANÚ (jogi őrszem) · Az élő oldal portál-/Places-fotókkal élesedett.** Az admin maga mondja: „Jelenleg bemutató képek — **az élesítéshez** a saját, jogtiszta fotói kellenek”, miközben az oldal már „Élő (publikus)”. A rendelésnél bepipált képjogi nyilatkozat ezt a tulajra hárítja, de a felirat ellentmond az állapotnak (§7 jogi őrszem).
- Pozitív: az élő oldal programlistája valódi, forrásolt eseményekből áll (keszthely.hu, visitbalaton365.hu, km-rel), a MINTA-jelölések lekerültek.

### 2.6 · Tenant-admin
| Lépés | Eredmény | Kép |
|---|---|---|
| Belépés (`citoviso.com/login`, a levélben kapott adatokkal) | PASS | `shots/ten-02-after-login.png` |
| Szobák: „Erkélyes kétágyas szoba” (2 fő, 18 000 Ft) + „Családi szoba” (3 fő, 24 000 Ft), külön naptárral; felszereltség, leírás, 2-2 fotó | PASS | `shots/ten-08-rooms-filled.png`, `shots/ten-09-room-editor.png` |
| Időszaki ár: Főszezon 06.15–08.31, 28 000 Ft, min. 3 éj (Családi szoba) | PASS | `shots/ten-12-season-saved.png` |
| Foglalási szabályok: min. 2 éj, értesítés `olasz.ferenc@citoviso.com`, IFA 500 Ft/fő/éj, az árban: takarítás, ágynemű, törölköző; okt. 24–25. nem kiadó (Családi) | PASS | `shots/ten-13-booking-config.png` |
| Foglalási modul-vétel | nem kellett: a 11 modulos csomagban benne volt (koordinátori mérés) | — |

**⚠️ Saját hiba (élesben, a tenant-adminban):** a szoba-tartalom mentésekor a szkriptem a „Mentés” helyett a „**Szoba törlése**” gombot nyomta meg (a dialógus utolsó gombját választotta). Az eredeti egység (`site_unit 7c68202c…`, eredetileg „A szállás egésze”, foglalás és ár nélkül) **törlődött**. A felületen át visszaállítottam („Erkélyes kétágyas szoba”, új azonosító `2b279e43…`), utána a gombot pontos felirat alapján választottam. Foglalás, ár vagy más tenant nem sérült; SQL-írás nem volt.
- **A-1 · KÖZEPES · A „Szoba törlése” megerősítés nélkül töröl.** A futtatóm minden böngésző-dialógust naplóz, itt egy sem jelent meg. Egy kattintás a naptárral, árral és képekkel együtt elviszi az egységet. Ezzel szemben a foglalás-visszaigazolás az adminban kérdez („Igen, visszaigazolom”). A gomb egyébként jó helyen van, elkülönítve (`ten-09-room-editor.png`).
- **A-2 · ALACSONY · Törlés után a megmaradt szoba „az egész szállás” szerepében jelenik meg:** „Eddig egy szobája volt: Családi szoba. … Családi szoba marad az egész szállás”.
- **A-3 · ALACSONY · Az időszak nyers formában jelenik meg:** „06-15 – 08-31 · minden évben” (a választóban „jún. 15. – aug. 31.” áll).
- **A-4 · ALACSONY:** a Foglalások lapon a „Most nincs döntésre váró kérés. ✔” szövegjel-ikont használ (ikon-doktrína: SVG).
- Pozitív: a szobakezelés („Mit ad ki?”, a teljes szállás és a szobák viszonya) végiggondolt; az IFA-mező magyarázata kiváló („Számot nem találunk ki Ön helyett”).

## 3. Szállóvendég

| Lépés | Eredmény | Kép / fájl |
|---|---|---|
| Asztal: Erkélyes kétágyas szoba, 2026.11.06–08., 2 fő → `FG-7C4137` | PASS | `shots/guest-01-booking-d.png`, `shots/guest-02-filled-d.png`, `shots/guest-03-sent-d.png` |
| Mobil: Családi szoba, 2026.11.13–16., 3 fő (kétlépcsős űrlap) → `FG-DB84FA` | PASS | `shots/guest-m-02-dates.png`, `shots/guest-02-filled-m.png`, `shots/guest-03-sent-m.png` |
| Levelek: tulaj-értesítő ×2, vendég „rögzítettük” ×2 | PASS | `mail/04-owner-booking-d.txt`, `mail/05-guest-booking-d.txt`, `mail/06-*`, `mail/07-*` |
| Tulajként: FG-7C4137 a levél „Elfogadom” linkjéből (mobil), FG-DB84FA az adminból, üzenettel | PASS (V-1!) | `shots/owner-01-accept-link-m.png`, `shots/ten-15-accept-confirm.png`, `shots/ten-16-after-accept.png` |
| Vendég „Visszaigazolt foglalás” ×2, `.ics` melléklettel | PASS | `mail/08-guest-confirmed-d.eml`, `mail/09-guest-confirmed-m.txt` |
| Vendégként: lemondó link (GET = csak megerősítő lap) → „Igen, lemondom” → a vendég és a tulaj is levelet kap | PASS | `shots/guest-04-cancel-page-m.png`, `shots/guest-05-cancelled-m.png`, `mail/c357.txt`, `mail/c358.txt` |

Leletek:
- **V-1 MAGAS:** GET-re döntő tulaj-linkek (lásd fent).
- **V-2 · KÖZEPES · „Az ár a TELJES SZÁLLÁSRA szól éjszakánként”** jelenik meg egy SZOBA foglalásakor (`guest-02-filled-d.png`), holott a szobák külön telnek.
- **V-3 · ALACSONY · Az idegenforgalmi adó eltűnik az összesítőből:** a foglaló panel kiírja (2 000 Ft a helyszínen), de a „Elküldtük a kérését” lap és a vendég-levél „Összesen: 36 000 Ft”-ja már nem említi. Mobilon a 2. lépés összesítője is csak „Összesen a szállásért” sort mutat, miközben a létszámot csak EZUTÁN állítja be a vendég.
- **V-4 · ALACSONY · Kevert host a lemondó linkben:** a levél-linkből visszaigazolt foglalásé a bérlő hostján van (`teszt-muschel-panzio.citoviso.com/foglalas/…/lemondom`), az adminból visszaigazolté a platformén (`citoviso.com/foglalas/…/lemondom`). Mindkettő működik (200), de a vendég az utóbbinál egy idegen domaint lát.
- **V-5 · ALACSONY (GYANÚ) · A vendég-levél feladója „[TESZT] Muschel Panzió — Citoviso” <foglalas@citoviso.com>.** A vendég-oldali „semmi Citoviso” elvvel ütközhet; ha szándékos (megbízhatósági jelzés), nem lelet.
- Pozitív: a lemondás GET-je csak megerősít, a POST dönt; a lemondó lap a szállásadó elérhetőségét is felajánlja „ha csak módosítani szeretne”; a naptár azonnal mutatja a lezárt napokat; a „Mi a következő lépés?” blokk egyértelmű.

## 4. Konzol (operátor) a vásárlás után
- A lead mind a 6 lépése zöld (BEGYŰJTVE → … → FIZETVE 2026-10-01). PASS. `shots/op-20-lead-after-purchase.png`, `shots/op-20-orders-tab.png`
- **K-1 KÖZEPES:** mindkét csomag-igény ma is `submitted` (a fizetett is); a bukott 97 Ft-os mellett „Fizetési kérés küldése ▸”. A lap alján hamis súgószöveg: „Pilot fizetés: pay-link (**Barion helyén mock**) … Auto-terhelés (MIT) = **2. fázis**.” Élesen valódi Barion fut, és a terhelési token már el van mentve (`[billing] terhelési token eltárolva … Visa ····6021`).


## 5. Koordinátori utólagos kérés: SMS/MMS a tulaj valódi számára (2026-10-01)
A `+36301200971` a modem saját feladó-SIM-je, tehát a pár valójában a modemre ment (mms 06:38, sms 06:39 UTC, `sent`).
- **Telefonszám átírva** a konzolban (Adatok fül, „Adatok mentése”): `+36301200971` → `+36305161631`. PASS. `shots/op-30-phone-changed.png`
- **Újraküldés: NEM lehetséges, nem kerültem meg.** A piszkozat-lapon a mobil-megkeresés „kiküldve”, a szöveg: „Egy csatornán csak egyszer megy ki hideg megkeresés … A pár = EGY megkeresés … Újraküldés nincs.” A lapon nincs egyetlen küldő űrlap sem. `shots/op-31-draft-after-phone.png`
  Elvi kerülőút lenne a lead-lapon egy ÚJ követett link (új prospect). Ez azonban egy már megrendelt, fizető leadre új hideg megkeresést indítana, ezért nem csináltam.
- **K-2 · KÖZEPES · A piszkozat-lap a kiküldött pár címzettjeként a lead MOSTANI számát mutatja.** „Mobil-megkeresés — kiküldve — **+36305161631** … A mobil-páros kiment: 2026-10-01 06:38.” A pár valójában a `+36301200971`-re ment (mms_outbox / sms_outbox `to_phone`, csak olvasva ellenőrizve). Az e-mail oldal ezt helyesen kezeli („A levél erre a címre ment ki: … — a cím módosítása ezen már nem változtat”), a mobil oldal nem. Az operátor rossz számot olvas ki a megkeresési előzményből.
- **K-3 · INFO · A modem saját SIM-jére is engedett hideg megkeresést küldeni.** A feladó és a címzett ugyanaz a szám volt. Egy „címzett ≠ saját SIM” kapu ezt kiszűrné.

## Élesben létrejött rekordok (teljes leltár)
- lead `e629826b…`: kurátori e-mail-javítás
- mock_artifact `7d12c718…` (fullbleed) · `f504c405…` (editorial, approved)
- prospect `eae55f63…`; offer: `27e23a7c` (outreach 25%), `f38781e4` (escalation 50%, okt. 4-ig), `cf57e5f9` (campaign 98%, felhasználva; a koordinátoré), `e3dc5629` (üdvözlő kupon 25%, dec. 30-ig)
- order_intent ×2, payment ×2 (97 Ft canceled→failed; 186 Ft paid), számla CITO-2026-2, tenant `23d59f37…` (élő)
- site_unit: `d90c184a…` Családi szoba, `2b279e43…` Erkélyes kétágyas szoba (+ a törölt `7c68202c…`); 1 időszaki ár; 2 nem kiadó nap
- foglalás: `FG-7C4137` (visszaigazolva, 11.06–08., **él**), `FG-DB84FA` (visszaigazolva, majd a vendég lemondta)
- mms_outbox ×1, sms_outbox ×1 (+36301200971)
- ⚠️ **Nyitva maradt:** az FG-7C4137 visszaigazolt foglalás él (11.06–08.), és a tenant-előfizetés 2026-11-01-én **automatikusan 9 300 Ft-ot terhel** a mentett kártyára, ha addig senki nem mondja le. Ezt a koordinátor/tulaj döntse el.

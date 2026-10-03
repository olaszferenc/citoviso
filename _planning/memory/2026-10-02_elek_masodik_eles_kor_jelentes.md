# Elek — második élesi kör · JELENTÉS (KÉSZ — mindhárom szerep végigment)

> Az Elek-SUB zárójelentése, változatlanul. A `shots/`, `mail/` stb. hivatkozások a commitolatlan munkaanyagra mutattak (`~/wt/cit6364caa7/_elek/`), azokat nem tettük a repóba (a tulaj 2026-10-01-i döntése: a folyamat képi anyaga nem kell). A leletek javításai külön commitokban vannak a mainen.

Brief: `~/rc-briefs/elek-eles-masodik-kor.md` · fa: `~/wt/cit6364caa7` · 2026-10-02 · éles = `c01b0ecc` (`prod/20261002-1253`)
Minden útvonal a fához relatív. Képek: `_elek/shots/`. Repóba nem írtam és nem commitolok (az `_elek/` nincs gitignore-ban).
Élesi írás KIZÁRÓLAG felületen át (konzol, lead-oldal); SQL csak `begin read only`.

## Állapot egy sorban
Lead → 2 mock (editorial + Séta) → 20 kinézet előnézete → editorial jóváhagyva → követett link → kiküldés (e-mail + MMS + SMS a
`+36305161631`-re) → lead-szemmel (asztal + mobil) → konfigurátor (Teljes, 11 szekció, benne az Online foglalás) →
számlázási lap (MEGÁLLTAM; a tulaj fizetett: 97 Ft, a saját választása szerint az Alap csomag) → élő oldal + jelszó-beállító levél + számla →
tenant-admin → foglalási modul (+ Szobák + Árak, 43 Ft, a mentett kártyáról, a tulaj jóváhagyásával) → 2 szoba, árak, időszak, szabályok →
A-1 (törlés-megerősítés, „Mégsem”) → 2 vendég-foglalás (asztal + mobil) → 1 visszaigazolás levél-linkből (GET → megerősítő lap → POST) + 1 adminból →
vendég-lemondás (GET → megerősítő lap → POST). A tulaj utóbb levette a mentett kártyát; a kártya nélküli állapotot is megmértem. **Mindhárom szerep végigment.**

## A legfontosabb leletek (súlyosság szerint)
| # | Súly | Lelet |
|---|---|---|
| SZ2-1 | **MAGAS** | Két forrástalan állítás ment ki a mock szövegében, és a vendég-kritikus **átengedte**: „Grillezési lehetőség a **fedett** teraszon” / „a fedett terasz alatt grillezési lehetőséggel” (a vélemény csak „cozy terrace … barbecue facilities”), és a szekciócím: „Medence a kertben, **reggeli a teraszon**” (a reggeli helyéről nincs forrás). Az elsőt a kritikus maga is kifogásolta (`forrastalan_igeret`, javítandó), a verdikt mégis `pass`, „3 kör, blokkoló kifogás nincs”. A „javítandó” szint tehát nem javít és nem blokkol. |
| S-1 | **KÖZEPES** | **A Séta-sablon ennél a leadnél nem sétál.** A „Séta a kapun át” mockon nincs egyetlen séta-lépés sem, csak a szokásos szekciók: hős-kollázs, kiemelések, minta-szobák, galéria. Oka: a mock 6 Places-fotóból áll (alanyuk `pool_garden ×2, exterior ×3, interior`), a kollázs ebből hármat elvisz, így nem marad 3 különböző alany. Az ADR-0304 szerint ez szándékos („3 lépés alatt nincs séta”), csakhogy a konzol a sablont „ragadós séta-jelenet a fotókból” néven kínálja, és sem generálás előtt, sem a kész kártyán nem jelzi, hogy a séta elmaradt. A kurátor egy séta nélküli, átlagos lapot kap, és erről nem tud. |
| OP-1 | KÖZEPES | **A konzol kártyáján elavult piac-indoklás áll.** „PIAC-KAPU INDOKLÁSA: … a főcím konkrét, használható szolgáltatásokat nevez meg (medence, grillezős terasz, **bérelhető bicikli**)”. A kiküldött szövegben nincs bicikli: a vendég-kritikus kivette. A piac-verdikt tehát egy korábbi szövegváltozatról szól, nem a kiküldöttről. |
| ADM-1 | KÖZEPES | A foglalás kosárba tétele magyarázat nélkül két további fizetős modult tesz be (Szobák, Árak): 742 Ft helyett 1 627 Ft, +2 170 Ft/hó. A tulaj javító SUB-ot indíttatott rá. (2.8) |
| LV-1 | KÖZEPES | Nem megvett modulok szekciói (`usp`, `reviews-pending`) az élő oldalon. A tulaj javító SUB-ot indíttatott rá. (2.7) |
| ADM-2 | KÖZEPES | A koordinátor kampány-ajánlata a bérlőnél „−98% kupon — Az induló előfizetéséért kapta” néven jelenik meg. A nyugtán és a számlán már helyesen „Egyedi ajánlat” áll. (2.9) |
| L2-1 | KÖZEPES | **Az eszkalációs −50% ismét kb. 3 perc alatt feljött** (3. megnyitás, 11:53). Ezt a saját mérő-megnyitásaim váltották ki, ugyanúgy, mint az első körben. Élesen keletkezett: `offer e3899f89… escalation 50%, lejár 2026-10-05 11:53 UTC`. **A koordinátornak ezt kell felülírnia a 98%-os kampánnyal.** |

## 0. Előfeltétel — PASS
- Éles `c01b0ecc`. Kezdéskor 0 prospect / mock / bérlő / fizetés / ajánlat / order_intent.
- Lead `e629826b…`: e-mail `olasz.ferenc@citoviso.com`, telefon `+36305161631` (kurátori, a konzol Adatok fülén).
- Konzol-belépés az `elek` fiókkal: OK.

## 1. Operátor (konzol)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 1.1 | Lead-lap: 71 kép (10 Places + 60 saját honlap), portál-fotó NINCS (a 3 listázásnak 0 fotója van) | info | `shots/op-01-lead-before.png` |
| 1.2 | Két mock egy körben: Szerkesztői (editorial) + Séta a kapun át (walk-through), 2:20 alatt, $0,44 / mock (9 hívás, benne 3 vendég-kritikus kör) | PASS | `shots/op-04a-generate-submitted.png`, `shots/op-05-mocks-tab.png` |
| 1.3 | Mind a 20 kinézet előnézete ennek a leadnek az adatával; mind 200, törött kép 0 | PASS | `shots/skins-contact.png`, `shots/skin-*.png` |
| 1.4 | A két kész mock asztalon és mobilon, végiggörgetve: törött kép 0, vízszintes túlcsordulás 0 | PASS | `shots/grid-mock-editorial-{d,m}.png`, `shots/grid-mock-walk-{d,m}.png`, `shots/mock-*-fold.png` |
| 1.5 | **Választás: Szerkesztői (editorial)** → jóváhagyva | PASS | — |
| 1.6 | Követett link (`/p/teszt-muschel-panzio/juI9bnK3HiRJC05AEnGnLsuv`), piszkozat, kiküldés MINDKÉT csatornán | PASS | `shots/op-12-draft.png`, `shots/op-13-before-send.png`, `shots/op-14-send-confirm.png` |

**Miért az editorial, és nem a Séta:** ennél a leadnél a Séta nem áll össze (S-1), így egy átlagos, egyhasábos lapot kapnánk, amelynek a hős-mondata is gyengébb („…és **tojásétel a reggelinél**”, ezt a kritikus is furának jelölte). Az editorial teljes: 6 kép polaroid-galériában, foglaló szelvény az első képernyőn, mobilon rendezett. A magazin-játék („Szerkesztőség”, „Nyomtatva a világhálón”, drop-cap) eltűnt. A kontaktlapon a sötét skinek (dark-luxury, cinematic, artdeco) egy rózsaszín, kertes panzióhoz most is túl „hotel-esek”, az Arch-frames nyitóképernyője ma is üres.

**Címzett-ellenőrzés kiküldés előtt:** a küldőgombok címzettjét a szkript tételesen ellenőrizte. Csak `olasz.ferenc@citoviso.com` és `+36305161631` szerepelt, idegen cím (muschelhotel, 70 212 0874, 83 314 380, gmail, 30 120 0971) nem.
Kiment: e-mail 11:51 (smtp) · MMS 11:52 (`sent`, `B9F47FF0…`) · SMS 11:53 (`sent`). **Kérdés a tulajnak: megjött-e az MMS és az SMS a telefonjára, és jó-e a kép?**

### Operátor-leletek
- **S-1 · KÖZEPES · a Séta elmarad, és ezt senki nem jelzi:** lásd fent. *Javaslat:* a kinézet-választó jelezze előre („ennél a leadnél nem áll össze séta: N különböző fotó-alany”), vagy a kártyán álljon: „séta nélkül készült”.
- **OP-1 · KÖZEPES · elavult piac-indoklás a kártyán:** lásd fent.
- **OP-2 · ALACSONY · a 71 képből 6 kerül a mockra.** A lead-lapon ez áll: „ANYAG: 71 kép”. A mock viszont csak a Places-fotók közül hatot használ (`PLACES_PHOTO_CAP = 6`); a saját honlap 60 képe nem kerül be (ez a jogi őrszem miatt rendben lehet). A kurátor a 71-es számból többet vár.
- **H-4 · ALACSONY · változatlan:** a „Követett link készítése” űrlapba nem töltődik elő a mentett e-mail, kézzel kellett beírni.
- **H-6 · ALACSONY · változatlan:** jóváhagyás után a lap tetején a „Kész: 2 mock legenerálva. 2:20 alatt” sáv áll, nem a jóváhagyás visszajelzése.
- **H-8 · INFO · változatlan:** az MMS tárgya csonka és ékezet nélküli: „Citoviso latvanyterv - [TESZT] Muschel P”.
- **OP-3 · INFO · a purge után maradt sor:** az `sms_outbox`-ban ma is ott van az első kör SMS-e (`7148e2c1…`, `+36301200971`, 10-01). A prospectje már nincs meg. A purge az `sms_outbox`-ot nem takarítja (az `mms_outbox`-ot igen).

## 2. Szállástulaj (lead-szemmel) — a fizetésig
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 2.1 | A levél megjött az INBOX-ba (#364, 11:51). Tárgy: „[TESZT] Muschel Panzió – honlap-terv”. A szöveg megegyezik az első körével. | PASS | `mail/01-outreach.eml`, `mail/01-outreach-render.html`, `shots/lead-01-mail-{d,m}.png` |
| 2.2 | **/p/ megnyitás-mérés:** 2× `curl` → 0 megnyitás, a státusz `sent` marad. Böngésző, 2 mp, érintés nélkül → 0. Mobilon görgetve → 1, státusz `opened`. Asztalon → 2. | **PASS** | — |
| 2.3 | A mock mobilon és asztalon, friss böngészőben | PASS (leletekkel) | `shots/lead-02-open-m-fold.png`, `shots/grid-lead-02-m.png`, `shots/lead-02-open-d-fold.png`, `shots/grid-lead-02-d.png` |
| 2.4 | „Itt rendelheti meg” → Teljes (11 szekció, benne az Online foglalás, 9 300 Ft/hó) → ingyenes aldomain → Havi → képjogi nyilatkozat → számlázási lap | PASS | `shots/lead-03-config-d-1.png`, `shots/lead-04-step2-d.png`, `shots/lead-05-billing-d.png` |
| 2.5 | **FIZETÉS — MEGÁLLTAM.** A gomb: „Fizetek — 4 650 Ft” (valódi Barion-terhelés). | STOP | `shots/lead-05-billing-d.png` |

### Lead-oldali leletek
- **L2-1 · KÖZEPES · az eszkaláció ~3 perc alatt jön:** lásd fent.
- **L-4 · ALACSONY · változatlan:** asztalon a jobb szélen ma is belóg egy sötét árnyék-sáv (`shots/lead-02-open-d-fold.png`, x≈1340–1366).
- **L-6 · ALACSONY · változatlan:** a „Tovább a számlázási adatokhoz” gomb alatt ma is „Nem kötelező.” áll, a kötelező nyilatkozat-pipa mellett.
- **L2-2 · ALACSONY · mobilon a menü 4. eleme le van vágva** („A HÁZ · SZOLGÁLTATÁSOK · KÉPEK · |”, `shots/lead-02-open-m-fold.png`). Ha ez vízszintesen görgethető sáv, akkor semmi nem jelzi, hogy görgethető.

## Szöveg-minőség (AI-szag + valóság) — a vendég-kritikus után
A tényhűség-őr (`tenyhuseg-or`) ítélete: **FLAG**. Teljes szöveg: `_elek/tenyhuseg-editorial.md`; a mock szövege: `_elek/mock-editorial-text.txt`.

**Mennyi maradt az első kör hibáiból:**
| Első kör | Most |
|---|---|
| „bérelhető biciklik / kerékpárok” (3 helyen) | **eltűnt** (a vendég-kritikus kivette) |
| „Bőséges saját parkoló” | „Elegendő parkolóhely a vendégeknek”. A vélemény „Sufficient parking spaces”-t ír, tehát a vélemény erejéig hű (B-szabály). **javítva** |
| „frissen főtt tojással”, „Friss, főtt reggeli” | „Reggeli tojással és kávéval”. A tükörfordítás eltűnt; a „**friss** kávéval” túlfordítás („great coffee”), ALACSONY |
| „Grillezős terasz” (forrástalan) | a grill a vélemény erejéig rendben, de **„a fedett terasz alatt”** kikövetkeztetés, **MAGAS** (SZ2-1) |
| tegezés („AMIT ITT KAPSZ”, „várjuk a leveled”) | „AMIT ITT KAP”, „várjuk levelét”. **javítva** |
| ál-idézet főcímként | nincs. **javítva** |
| „X várja a vendégeket” | nincs |
| „A HÁZ SZÁMOKBAN” egy számmal | nincs |
| „Szerkesztőség”, „Nyomtatva a világhálón”, „No. 1/2/3” | nincs. **javítva** |
| dátumos minta-programok („2 OKT. Borkóstoló est”) | dátum nélkül, „a környéken”, MINTA-pirulával. **javítva** |

**Ami maradt (idézetekkel):**
- MAGAS: „Medence a kertben, **reggeli a teraszon**”. A reggeli helyére nincs forrás; ritmusért kitalált párhuzam.
- MAGAS: „Grillezési lehetőség a **fedett** teraszon”.
- KÖZEPES: „**baráti társaságnak és családnak egyaránt**” (tagline + lábléc). Forrástalan célcsoport-ígéret, felsorolásból összerakott tagline.
- KÖZEPES: a foglaló dobozban „Fizetés a helyszínen”, „A szállásadó személyesen igazolja vissza”. Sablon-állítás, a dobozon csak lent áll egy általános „Minta” felirat.
- KÖZEPES (gyanú): a 4. galériakép egy fehér, nádtetős ház, nem a rózsaszín villa. Lehet szomszéd vagy melléképület.
- AI-szag: „A barátságos házigazda, a tiszta, tágas szobák és a reggeli tojással **teszik kellemessé az itt töltött időt**.” Prospektus-zárás, egy szállásadó nem így ír. A „reggeli tojással” itt nyelvtanilag is döcög.
- Összkép: az első körhöz képest **nagyságrendi javulás**. Kitalált szolgáltatás (bicikli) és tegezés nincs. Két forrástalan részlet maradt (fedett, terasz-reggeli) és egy sablonos zárómondat. Egy valódi vendég a „reggeli a teraszon”-t számon kérheti.

**A megkereső levél (változatlan):** „A Google-on 4,8 csillagos, 145 vélemény alapján.” (alany nélküli csonka mondat) · „Saját, modern oldal viszont még nincs a képben.” (idegen fordulat, H-3 ellentmondás a „van lábnyom” szegmenssel). SMS: „A Citoviso Csapata”. A megszólítás tulaj-döntés szerint jó.

## Visszamérés — az első kör leletei élesen
| Lelet | Állapot | Bizonyíték |
|---|---|---|
| /p/ megnyitás-mérés (curl nem számít) | **javítva** | 2× curl → `mock_view` 0, státusz `sent`; 2 mp érintés nélkül → 0; görgetve → 1 + `opened` |
| SZ-1 kerékpár / parkoló / „főtt reggeli” | **javítva** (kettő forrástalan részlet maradt, SZ2-1) | `_elek/mock-editorial-text.txt`, `_elek/tenyhuseg-editorial.md` |
| SZ-2 magázás | **javítva** | „AMIT ITT KAP”, „várjuk levelét”, „Írja meg, milyen volt” |
| SZ-3 ál-idézet | **javítva** | nincs idézőjeles főcím; „Medence és grillezős terasz a kertben” |
| SZ-4 dátumos minta-programok | **javítva** | „Termelői piac · a környéken” … MINTA-pirulával, dátum nélkül |
| L-2 / F-3 egy ajánlat = egy név | **javítva** (fizetési lap) | eszkalációval mindkét oldalon „Döntés-segítő ajánlat (−50%)” (`shots/lead-05-billing-d.png`); a koordinátor kampánya után mindkét oldalon „Egyedi ajánlat (−98%)”, 186 Ft/hó (`shots/lead-06-billing-campaign-d.png`). A számlát a fizetés után mérem. |
| F-1 számlacím előtöltés nélkül | **javítva** | irányítószám / település / utca üres, csak az e-mail töltődik elő; a név mintája „pl. Olasz-Balogh Viktória”; új „Cégként vagy egyéni vállalkozóként” |
| H-1 előnézeti térkép-tű | **javítva** | `tpl-preview` 4 kinézeten: tű 34×34 px, iframe 338 px magas (első kör: ~300 px-es tű) |
| L-3 fotó-feliratok | **javítva** (látható felirat) / részben (alt) | látható figcaption 0; az `alt` ma is „[TESZT] Muschel Panzió — N. kép” (képernyőolvasón gépies) |
| T-1 térkép az élő oldalon | **javítva** | élő HTML: `data-cit-module="map"`, iframe `maps.google.com/maps?q=46.7668…,17.2583…`, tű 34×34, asztal + mobil |
| T-2 nincs kitalált érkezési idő | **javítva** (ebben a csomagban) | az élő szövegben nincs 14:00 / 10:00 / „Érkezés és távozás”; a Nyitvatartás modul nincs megvéve, így a mentett-minta eset nem mérhető |
| T-3 jelszó-link | **javítva** | levélben jelszó nincs; a link GET-re csak mutat, POST-ra beállít, újra 410; a régi munkamenetek lezárva |
| F-1 számlacím | **javítva** (a számlán is) | VEVŐ: „2340 Kiskunlacháza, Ráckevei út 083/2 hrsz.”, egységesen a tulajé, adószám-forma nincs benne |
| F-3 egy ajánlat — egy név (számla) | **javítva** | számla-megjegyzés: „Egyedi ajánlat: a 4880 Ft-os díjból −98%” |
| K-1 konzol csomag-igény állapot | **javítva** | „97 Ft / hó fizetve · fizetés: sikeres · számla: CITO-2026-3”; a súgó Barion + mentett kártya, igaz |
| F-2 megszakított fizetés lapja | **nem mérhető** | a tulaj elsőre fizetett, visszalépés nem volt |
| V-1 levél-link megerősítő lap | **javítva** | 2× `curl` GET (elfogadom + elutasítom) → mindkét kérés `pending` marad; böngészőben „Elfogadja ezt a foglalást? … Amíg nem nyomja meg a gombot, semmi nem változik” → POST → `accepted`. `shots/owner-01-accept-get-m.png`, `shots/owner-02-accept-post-m.png` |
| A-1 szoba-törlés megerősítés | **javítva** | „Szoba törlése” → „Törli az „Erkélyes kétágyas szoba” szobát? A szobával együtt végleg törlődik: az alapár … Ezt nem lehet visszacsinálni.” + Mégsem / Igen, törlöm; a „Mégsem” után 2 egység marad. `shots/ten-18-room-delete-confirm.png` |
| V-2 ár-mondat | **javítva** | „Az ár a szoba egészére szól éjszakánként („Erkélyes kétágyas szoba”) — a létszám nem befolyásolja (jelenleg 2 fő).” |
| V-3 IFA a nyugtán / levélben | **javítva** | a foglaló panelen, a „Elküldtük a kérését” lapon, a vendég „rögzítettük” levelében és mindkét visszaigazoló levélben is: „Idegenforgalmi adó — 500 Ft / fő / éj × 2 fő × 2 éj = 2 000 Ft”; mobilon 3 fővel 4 500 Ft. A kérésen be van fagyasztva (`quoted_tax_per_person_night = 500`). A tulaj-értesítőben nincs IFA-sor (ALACSONY). |
| A-3 időszak nyers formában | **javítva** | „jún. 15. – aug. 31. · minden évben” |
| A-4 szövegjel-ikon | **javítva** | „Most nincs döntésre váró kérés.” (✔ nélkül) |
| V-4 kevert host a lemondó linkben | **nem javítva** | a levél-linkből visszaigazolté `teszt-muschel-panzio.citoviso.com/foglalas/…/lemondom`, az adminból visszaigazolté `citoviso.com/foglalas/…/lemondom` (`mail/09-guest-confirmed-373.txt`) |
| L-4, L-6, H-4, H-6, H-8, T-4 | **nem javítva** (ALACSONY, a brief nem kérte) | lásd a szakaszokat |

## Koordinátori közjáték
- 98%-os kampány-ajánlat: `offer 39cbd96b…`, 2026-10-03 11:56 UTC-ig. A link a tulajnál van, ő fizet.
- Ellenőrzésként egyszer megnyitottam a számlázási lapot (mock_view +1), adatot nem töltöttem ki. A konfigurátor ekkor 186 Ft/hó árat mutatott, „Egyedi ajánlat” néven.


## 2 (folytatás). Fizetés után — tulajként

### 2.6 · Miért lett 3 modul? (koordinátori kérés) — NEM hiba, a tulaj választotta
A `mock_event` napló, a tulaj látogatása (`mock_view b782ed3c…`, Windows, 12:07:44 UTC):
`open` → `panel_open` → **12:07:47 `preset_select {"preset":"alap"}`** → `checkout_step` → `photo_rights_declared` →
`billing_step_open` → 12:08:04 `order_intent_submitted` + **`billing_invalid {"fields":"buyer_address"}`** → 12:08:14 `order_intent_submitted` → `checkout_redirect`.
- Az „Alap” csomag = képek, elérhetőség, térkép = `gallery, enquiry, location`. 4 880 Ft × 2% = **97 Ft**. A tulaj 3 mp-cel a megnyitás után maga választotta, a konfigurátor tehát nem ejtett el semmit.
  (Az én böngészőmben a Teljes csomag állt; a csomag-választás böngészőnként külön tárolódik, a tulaj gépére nem száll át.)
- Az első beküldést a cím-mező őre visszadobta, 10 mp múlva ment át. A mentett cím „Ráckevei út 083/2 hrsz.”, adószám-forma nincs benne. Ez valószínűleg az ADR-0303 adószám-a-címben őre, amely működik (**kérdés a tulajnak: mit írt be először?**).
- **F2-1 · ALACSONY (megfigyelés):** a konfigurátor már a megnyitás pillanatában nyitva van (`panel_open` 0,17 mp-cel az `open` után), ezért a tulaj a mockot gyakorlatilag nem látta, rögtön csomagot választott. A koordinátor linkje valószínűleg erre a nyitott állapotra mutat; ha így van, ez nem lelet.

### 2.7 · Élő oldal, belépő levél, számla
| Lépés | Eredmény | Kép / fájl |
|---|---|---|
| Élő oldal `teszt-muschel-panzio.citoviso.com`, asztal + mobil: törött kép 0, túlcsordulás 0, MINTA-jel 0 | PASS, leletekkel | `shots/grid-live-d.png`, `shots/grid-live-m.png`, `shots/live-{d,m}-fold.png`, `live-text.txt` |
| „Belépési adatai – [TESZT] Muschel Panzió” (12:11:15): felhasználónév + **„Jelszó beállítása” link**, 7 napig él, egyszer használható, „Jelszót e-mailben nem küldünk.” | **PASS** | `mail/02-login.txt` (a link kitakarva, a nyers .eml törölve) |
| Jelszó-link: GET → csak az űrlap (200) · POST → „Kész — beléptetjük … a korábban megnyitott belépések megszűntek” · ugyanaz a link újra → **410** „már nem érvényes” | **PASS** | `shots/ten-02-after-pwset.png`, `shots/ten-03-pwlink-reuse-410.png` |
| „Számla CITO-2026-3 – Honlap-előfizetés (havi)” + PDF (12:11:20), 97 Ft, AAM | PASS | `mail/03-invoice-szamla-CITO-2026-3.pdf`, `shots/invoice-CITO-2026-3-1.png` |
| Konzol, Csomag és fizetés: „97 Ft / hó **fizetve** · fizetés: sikeres · számla: CITO-2026-3”; a súgó igaz (Barion, mentett kártya, auto-terhelés) | **PASS** | `shots/op-21-orders-tab.png`, `shots/op-20-lead-after-purchase.png` |

Leletek:
- **LV-1 · KÖZEPES · Nem megvett modulok szekciói az élő oldalon.** A rendelés 3 modulos (gallery, enquiry, location), az élő HTML-ben mégis van `data-cit-module="usp"` (a „Medence a kertben, reggeli a teraszon” kiemelés-lista) és `reviews-pending`. Utóbbi a „Vendégek véleménye … Itt a vendégek véleményei jelennek meg. Minden vélemény valódi vendégtől származik, és közzététel előtt a szállásadó hagyja jóvá.” blokk. A tenant-admin mindkettőt „Még nem vette meg” alatt sorolja („Miért Önt válasszák”, „Vendégek véleménye”). Vagy az élő oldal ad ingyen valamit, amit a Modulok lap pénzért kínál, vagy a vélemény-blokk olyan funkciót ígér a vendégnek (vélemény-beküldés, jóváhagyás), ami nincs megvéve.
- **T-4 · ALACSONY · változatlan:** „Kedves **Viktória Olasz-Balogh**!” (levelek és számla). A név mező mintája most „pl. Olasz-Balogh Viktória”, a tulaj mégis fordítva írta be; a megszólítás nem igazítja.
- INFO: az élő oldal érdeklődő űrlapja „Előzetes érdeklődés — nem végleges foglalás”. Foglalási modul még nincs, ez így helyes.
- INFO (nem lelet, csak jelzés a koordinátornak): az admin Áttekintése „Jelenleg bemutató képek — az élesítéshez a saját, jogtiszta fotói kellenek.” + „Cserélje sajátra” gombot és teendőt mutat. A briefben kapott tulaj-döntéssel (a vevő nyilatkozott) ez ellentétes lehet; a döntés a koordinátoré.

### 2.8 · Tenant-admin — foglalási modul vásárlása (MEGÁLLTAM a fizetésnél)
| Lépés | Eredmény | Kép |
|---|---|---|
| Belépés a jelszó-beállítás után (a jelszó a scratchpadban, 600-as fájlban; nincs kiírva) | PASS | `shots/ten-04-admin-home.png` |
| Modulok: előfizetés 4 880 Ft/hó, „−25% kupon … a következő vásárlásánál magától levonjuk — érvényes 2026-12-31-ig” (az F-4 most érthető) | PASS | `shots/ten-05-modules.png` |
| „Online foglalás” → Kosárba teszem → a kosárban **3 tétel**: Szobák 518 Ft + Árak 367 Ft + Online foglalás 742 Ft = **1 627 Ft most**, a következő számla 7 050 Ft (+2 170 Ft) | lelet | `shots/ten-07-cart.png`, `shots/ten-11-rooms-autoadded.png` |
| „Tovább a fizetéshez” → megerősítő kártya (nem POST-ol): „A mentett kártyámmal — Visa ····6021 · Terhelés és élesítés — 1 627 Ft” / „Másik kártyával · Tovább a fizetéshez — 1 627 Ft” | **STOP** | `shots/ten-09-pay-confirm-saved.png`, `shots/ten-10-pay-confirm-new.png` |

- **ADM-1 · KÖZEPES · A foglalás kosárba tétele magyarázat nélkül két további fizetős modult tesz be.** Egy kattintás, és a kosárban „+ bekapcsol · Szobák, apartmanok”, „+ bekapcsol · Árak, szezonok” is áll. Indoklás („a foglaláshoz szobák és árak kellenek”) sem a kosárban, sem a kártyán nincs. A tulaj 742 Ft-ot vár, 1 627 Ft-ot lát; a havidíj 2 170 Ft-tal nő (a foglalás önmagában +990 Ft lenne). A függőség lehet jogos, de a kimondása hiányzik. (Lemondáskor a kód ad indoklást: `REQ[...].why`; hozzáadáskor nem.)
- Pozitív: a megerősítő kártya tételes (hónap × ár − 25%), kimondja a következő számlát, és a kártya-választás szerint más gombfeliratot és más magyarázatot ad. Fizetés gomb nélkül nincs POST (hálózat-naplóval ellenőrizve).

### 2.9 · A koordinátor 98%-os vásárlási kampánya (offer `d50b0298…`) — NEM terheltem
- A kosár (Szobák + Árak + Online foglalás) a megerősítő kártyán: 14 + 10 + 19 = **43 Ft** (soronként „1 hó × ár − 98%”).
  A koordinátor kb. 35 Ft-ot várt, és arra kért, hogy eltérésnél ne terheljek → **nem terheltem**, a kártyát a „Mégsem” gombbal zártam (POST nem ment ki).
  A 43 Ft a 3 modul listaárának (2 170 Ft) 2%-a; a 35 Ft-os becslés valószínűleg az ADM-1 előtti, egymodulos kosárból indult. `shots/ten-12-pay-confirm-campaign.png`
- **ADM-2 · KÖZEPES · A kampány-ajánlat a bérlőnél az üdvözlő kupon nevét és indoklását viseli.** A Bővítés-sávban ez áll:
  „**−98% kupon** — **Az induló előfizetéséért kapta.** A következő vásárlásánál magától levonjuk — érvényes 2026-10-03-ig.” (`shots/ten-12b-campaign-banner.png`).
  Ez egy *campaign* ajánlat (ADR-0303 ②: kampány → „Egyedi ajánlat”), nem az induló előfizetésért járó kupon. A mondat tehát a nevében és az indoklásában is téves.
  Közben a valódi 25%-os üdvözlő kupon eltűnt a sávból („Kedvezmények nem adódnak össze”); a tulaj nem látja, hogy a kupona megmaradt-e.

### 2.10 · Modul-vásárlás — terhelés (a tulaj jóváhagyásával: „mehet”, 43 Ft)
| Lépés | Eredmény | Kép / fájl |
|---|---|---|
| Megerősítő kártya: „Terhelés és élesítés — 43 Ft”, a mentett kártya (Visa ····6021) kiválasztva → gomb | PASS | `shots/ten-12-pay-confirm-campaign.png` |
| Nyugta a lapon: „Kész. Mostantól él: Szobák, apartmanok · Árak, szezonok · Online foglalás · 3 modul a fordulónapig 2 170 Ft · **Egyedi ajánlat (98%)** −2 127 Ft · A kártyáját megterheltük 43 Ft” | PASS | `shots/ten-13-after-charge.png` |
| `payment 763b9e8b…` 43 Ft `paid` (12:48:34, 1 mp a kattintás után); a díj 7 050 Ft/hó | PASS | — |
| „Számla CITO-2026-4 – Modul-bővítés — időarányos első díj” (12:48:37), PDF: „Egyedi ajánlat: a 2170 Ft-os díjból −98%, így a fizetendő 43 Ft” | PASS | `mail/04-invoice-modules.txt`, `mail/04-invoice-modules-szamla-CITO-2026-4.pdf`, `shots/invoice-CITO-2026-4-1.png` |
| Az élő oldalon az érdeklődő űrlap helyén azonnal a foglalási naptár áll | PASS | `shots/guest-01-booking-d.png` |

- **INV-1 · ALACSONY · A modul-bővítés számlasora ugyanaz, mint az előfizetésé:** „Citoviso előfizetés (havi, 3 modul) – 98% kedvezménnyel” áll a CITO-2026-3-on és a CITO-2026-4-en is. A levél tárgya különbözik („Modul-bővítés — időarányos első díj”), a PDF tételsora nem. A levél is „Köszönjük az előfizetést” mondattal indul. A könyvelő két egyforma „havi előfizetés” számlát lát egy napon.

### 2.11 · Tenant-admin — szobák, árak, szabályok
| Lépés | Eredmény | Kép |
|---|---|---|
| Új szoba: „Erkélyes kétágyas szoba” (2 fő, 18 000 Ft); a meglévő „A szállás egésze” → „Családi szoba” (külön naptár) | PASS | `shots/ten-16-rooms-filled.png` |
| Szoba-tartalom: férőhely, leírás, felszereltség, 2-2 fotó (mindkét szoba) | PASS | `shots/ten-17-room-editor-open.png` |
| **A-1:** „Szoba törlése” → tételes megerősítés → **„Mégsem”** (nem töröltem) | **PASS** | `shots/ten-18-room-delete-confirm.png` |
| Családi szoba alapár 24 000 Ft; Főszezon jún. 15. – aug. 31., 28 000 Ft, min. 3 éj | PASS | `shots/ten-21-season-saved.png` |
| Foglalási szabályok: min. 2 éj, értesítés `olasz.ferenc@citoviso.com`, IFA 500 Ft/fő/éj, az árban: takarítás, ágynemű, törölköző; okt. 24–25. nem kiadó (Családi) | PASS | `shots/ten-23-booking-config.png`, `shots/ten-24-booking-unavail.png` |

### 2.12 · A mentett kártya levétele után (koordinátor: `payment_method=invoice`)
- Modulok: „KIKAPCSOLVA · Fizetés díjbekérővel — A fordulónapon fizetési linket küldünk e-mailben … Újra bekapcsolni a Pénztárcában tud”; következő számla 7 050 Ft (2026. 11. 02.). Következetes. `shots/ten-29-modules-nocard.png`
- Pénztárca: „NINCS MENTETT KÁRTYA · A díjakat fizetési linkkel, e-mailből tudja rendezni.” · „Korábbi kártyák (1)” · „Következő terhelés 2026. 11. 02. · fizetési link e-mailben”. `shots/ten-30-wallet-nocard.png`
- **W-1 · ALACSONY · „Terhelések ezen a kártyán — Még nem volt terhelés.”** Ez a sor kártya nélkül is megjelenik, miközben a korábbi kártyáról ma 2 terhelés ment le (97 + 43 Ft). Mivel nincs „ez a kártya”, a sor félrevezető. A „Következő terhelés … fizetési link” is „terhelés”-t mond egy díjbekérőre.
- **K2-1 · ALACSONY · A konzol súgója nem követi a bérlő állapotát:** a lead „Csomag és fizetés” lapján ma is ez áll: „A megújítást a mentett kártyáról automatikusan terheljük”, holott a bérlőnek már nincs mentett kártyája. `shots/op-22-orders-tab-final.png`
- Áttekintés: 0 nyitott teendő. A korábbi „Jelenleg bemutató képek … Cserélje sajátra” felirat helyett most „Saját nyitókép — A saját fotói láthatók az oldalán” áll (a 2.7 INFO-ja ezzel tárgytalan). `shots/ten-28-overview-nocard.png`

## 3. Szállóvendég
| Lépés | Eredmény | Kép / fájl |
|---|---|---|
| Asztal: Erkélyes kétágyas szoba, 2026.11.06–08., 2 fő → `FG-B97644`. Panel: „Alapár: 2 éj × 18 000 Ft = 36 000 Ft · Az ár a szoba egészére szól … · takarítás, ágynemű, törölköző benne van · IFA 2 000 Ft” | PASS | `shots/guest-01-booking-d.png`, `shots/guest-02-filled-d.png`, `shots/guest-03-sent-d.png` |
| Mobil: Családi szoba, 2026.11.13–16., 3 fő (kétlépcsős) → `FG-C2598D`, 72 000 Ft + IFA 4 500 Ft | PASS | `shots/guest-02a-price-m.png`, `shots/guest-02-filled-m.png`, `shots/guest-03-sent-m.png` |
| Levelek: tulaj-értesítő ×2, vendég „rögzítettük” ×2 (IFA-val) | PASS | `mail/05-owner-booking-d.txt`, `mail/06-guest-booking-d.txt`, `mail/07-*`, `mail/08-*` |
| Tulajként: FG-B97644 a levél „Elfogadom” linkjéből (mobil: előtte 2× curl GET → nem dönt; böngésző GET → megerősítő lap; POST → elfogadva); FG-C2598D az adminból („Visszaigazolom” → „Igen, visszaigazolom”) | **PASS (V-1 javítva)** | `shots/owner-01-accept-get-m.png`, `shots/owner-02-accept-post-m.png`, `shots/ten-26-accept-confirm.png`, `shots/ten-27-after-accept.png` |
| Vendég „Visszaigazolt foglalás” ×2, naptár-melléklettel, IFA-val | PASS | `mail/09-guest-confirmed-372.txt`, `mail/09-guest-confirmed-373.txt` |
| Vendégként lemondás: curl GET → `accepted` marad; böngésző GET → „Biztosan lemondja…? … Amíg nem nyomja meg a piros gombot, a foglalása változatlanul él.”; POST → `cancelled`; levél a vendégnek és a tulajnak | PASS | `shots/guest-04-cancel-page-m.png`, `shots/guest-05-cancelled-m.png`, `mail/10-guest-cancel.txt`, `mail/11-owner-cancel.txt` |

Leletek:
- **V-4 · ALACSONY · változatlan:** kevert host a lemondó linkben (lásd a visszamérés táblát).
- **V2-1 · ALACSONY · A tulaj döntési lapján (bérlő-host) Barion-süti-sáv jelenik meg:** „A biztonságos kártyás fizetéshez a fizetési szolgáltatónk (Barion) csalásmegelőző sütiket használna…”. Egy foglalás elfogadásánál nincs kártyás fizetés. `shots/owner-01-accept-get-m.png`
- **V2-2 · ALACSONY · A tulaj-értesítőben nincs IFA-sor** (csak „Ár összesen … 36 000 Ft”). A vendég mindenütt látja.
- **V2-3 · INFO · A vendég-levél feladójában dupla szóköz van:** „[TESZT] Muschel Panzió  — Citoviso”.
- Pozitív: a foglaló panel átlátható (alapár-sor, mi van benne, IFA külön, „nem része a szállásdíjnak”); a tulaj-oldali megerősítő lap kimondja, hogy az ütköző kéréseket elutasítja; a 48 órás határidő mindkét oldalon látszik.

## 4. Konzol a vásárlás után
- Csomag-igények (2): „43 Ft / hó fizetve · Szobák / apartmanok · Árak / szezonok · Foglalás (upsell) · sikeres · CITO-2026-4” és „97 Ft / hó fizetve · … · CITO-2026-3”. **K-1 javítva.** `shots/op-22-orders-tab-final.png`
- K2-1 (a súgó a mentett kártyáról beszél), lásd 2.12.

## Élesben létrejött rekordok (teljes leltár)
- mock_artifact `333a78ad…` (walk-through, generated) · `0dbcdc91…` (editorial, **approved**)
- prospect `99e03159…` (van_labnyom, `opened`), link `/p/teszt-muschel-panzio/juI9bnK3HiRJC05AEnGnLsuv`
- offer `9bed7945…` (outreach 25%) · offer `e3899f89…` (**escalation 50%, lejár 2026-10-05 11:53 UTC**)
- mms_outbox `0f3327c9…` sent · sms_outbox (`+36305161631`) sent · mock_view ×5 (mind az enyém)
- offer `39cbd96b…` (campaign 98%, a koordinátoré, felhasználva) · üdvözlő kupon 25% (2026-12-31-ig)
- order_intent `38488587…` (3 modul, 97 Ft) · payment 97 Ft paid · számla CITO-2026-3 · tenant `3bef8ec2…` (élő)
- tenant_user `teszt-muschel-panzio`: a jelszót ÉN állítottam be a levél linkjével (a scratchpadban, 600-as fájlban); a tulaj kérésre megkapja, vagy „Elfelejtett jelszó?”-val újat állít
- offer `d50b0298…` (campaign 98%, purchase-scope, a koordinátoré, felhasználva) · payment `763b9e8b…` 43 Ft paid (a mentett kártyáról) · számla CITO-2026-4
- site_unit `575b550c…` Családi szoba (3 fő, 24 000 Ft) · `fcf5461b…` Erkélyes kétágyas szoba (2 fő, 18 000 Ft); 1 időszaki ár (Főszezon); 2 nem kiadó nap; foglalási beállítások
- booking_request: `FG-B97644` (visszaigazolva, 11.06–08., **él**), `FG-C2598D` (visszaigazolva, majd a vendég lemondta)
- AI-költség: 2 mock, kb. $0,88
- ⚠️ A `mail/05-*`, `mail/08-*` és `mail/09-*` fájlokban élő foglalás-tokenek vannak: az FG-B97644 lemondó linkje működik. Csak a koordinátornak szólnak; nyilvános helyre ne kerüljenek.
- ⚠️ **Nyitva maradt:** az FG-B97644 visszaigazolt foglalás él (11.06–08.). A bérlő előfizetése aktív, 2026-11-02-án 7 050 Ft-os díjbekérő megy ki (kártya már nincs, automatikus terhelés nem lesz).

## Képek / HTML a koordinátornak (fához relatív)
- Kinézet-döntés: `_elek/shots/skins-contact.png`, `_elek/shots/grid-mock-editorial-d.png`, `_elek/shots/grid-mock-editorial-m.png`, `_elek/shots/grid-mock-walk-d.png`, `_elek/shots/grid-mock-walk-m.png`, `_elek/shots/mock-walk-d-fold.png`
- Levél: `_elek/mail/01-outreach-render.html` (kattintható), `_elek/shots/lead-01-mail-d.png`, `_elek/shots/lead-01-mail-m.png`
- Lead-oldal: `_elek/shots/lead-02-open-m-fold.png`, `_elek/shots/grid-lead-02-m.png`, `_elek/shots/lead-02-open-d-fold.png`, `_elek/shots/grid-lead-02-d.png`
- Rendelés: `_elek/shots/lead-03-config-d-1.png`, `_elek/shots/lead-04-step2-d.png`, `_elek/shots/lead-05-billing-d.png`
- Konzol: `_elek/shots/op-12-draft.png`, `_elek/shots/op-05-mocks-tab.png`
- Szöveg: `_elek/mock-editorial-text.txt`, `_elek/mock-walk-text.txt`, `_elek/tenyhuseg-editorial.md`, `_elek/live-text.txt`
- Fizetés után: `_elek/shots/grid-live-d.png`, `_elek/shots/grid-live-m.png`, `_elek/shots/invoice-CITO-2026-3-1.png`, `_elek/shots/invoice-CITO-2026-4-1.png`, `_elek/mail/03-invoice-render.html`, `_elek/mail/02-login.txt`
- Tenant-admin: `_elek/shots/ten-07-cart.png`, `_elek/shots/ten-11-rooms-autoadded.png`, `_elek/shots/ten-12-pay-confirm-campaign.png`, `_elek/shots/ten-12b-campaign-banner.png`, `_elek/shots/ten-13-after-charge.png`, `_elek/shots/ten-18-room-delete-confirm.png`, `_elek/shots/ten-21-season-saved.png`, `_elek/shots/ten-23-booking-config.png`, `_elek/shots/ten-29-modules-nocard.png`, `_elek/shots/ten-30-wallet-nocard.png`
- Vendég: `_elek/shots/guest-02-filled-d.png`, `_elek/shots/guest-03-sent-d.png`, `_elek/shots/guest-03-sent-m.png`, `_elek/shots/owner-01-accept-get-m.png`, `_elek/shots/owner-02-accept-post-m.png`, `_elek/shots/guest-04-cancel-page-m.png`, `_elek/shots/guest-05-cancelled-m.png`
- Levelek (kattintható HTML): `_elek/mail/05-owner-booking-d-render.html`, `_elek/mail/06-guest-booking-d-render.html`, `_elek/mail/09-guest-confirmed-373-render.html`, `_elek/mail/10-guest-cancel-render.html`

# Elek — harmadik, célzott élesi kör · JELENTÉS (KÉSZ — mind a három feladat lefutott, fizetés nélkül)

> Az Elek-SUB zárójelentése, változatlanul. A `shots/`, `mail/` stb. hivatkozások a commitolatlan munkaanyagra mutattak (`~/wt/cit42c62244/_elek/`), azokat nem tettük a repóba (a tulaj 2026-10-01-i döntése: a folyamat képi anyaga nem kell). A leletek javításai külön commitokban vannak a mainen.

Brief: `~/rc-briefs/elek-eles-harmadik-kor.md` · fa: `~/wt/cit42c62244` · 2026-10-02 este · éles = `6179595c` (`prod/20261002-2252`)
Minden útvonal a fához relatív. Képek: `_elek/shots/`. Repóba nem írtam, nem commitolok. Élesi írás csak felületen át
(konzol: 2 mock, jóváhagyás, követett link; tenant-admin: csak kliens-oldali kosár). SQL csak `begin read only`.
Fizetés, kártya, telefon/SMS/MMS: semmi. A Muschel-kosár üres, POST egy sem ment ki (hálózat-naplóval ellenőrizve).

## Állapot egy sorban
Erika villa → 2 mock (Szerkesztői + Séta) → a Séta-jelzés mind a négy helyen szól → Szerkesztői jóváhagyva → követett link
(`/p/teszt-erika-villa/yGGlXVcIvxqZIeOr9GzKTg12`) → az e-mail először NEM volt küldhető (BLK-1, a cím a Muschel-körben kapott már levelet) →
koordinátori döntés: plus-alcím `olasz.ferenc+erika@citoviso.com` → kiment (smtp, 21:24 UTC), INBOX + Sent pár mp alatt → lead-szemmel mobil + asztal →
konfigurátor (Teljes) → számlázási lap: **MEGÁLLTAM** („Fizetek — 4 650 Ft”, nem nyomtam meg). A 3. feladat (Muschel tenant-admin) is végigment.

## Legfontosabb leletek (súlyosság szerint)
| # | Súly | Lelet |
|---|---|---|
| BLK-1 | (feloldva) | `olasz.ferenc@citoviso.com`-ra a Muschel-körben már ment hideg megkeresés → „E-mail: most NEM küldhető — erre a CÍMRE már ment hideg megkeresés (cím-szintű egy-lövés)”. Helyes viselkedés. Feloldás (koordinátor): plus-alcím, lásd 1.11. |
| SZ3-1 | **MAGAS** | **A vendég-kritikus megint átengedett egy forrástalan hely-részletet:** „a házhoz **kerti pihenő és bútorozott terasz** tartozik”, és ugyanez a kiemelésben („Kerti pihenő, bútorozott terasz”) és a címben („Csendes környék és **kerti pihenő**”). Egyik forrás-idézet sem említ teraszt vagy kerti bútort. A vision csak „rendezett kert”-et és „virágos pergolá”-t lát; az egyik galériaképen egy erkély látszik egy műanyag székkel. Kritikus: „2 kör, blokkoló kifogás nincs”, javítandó sem maradt (`guestCriticObjections = []`). Tényhűség-kapu: PASS. A K2 (ADR-0309) tehát **részben** javított: a fajtát („fedett”, „reggeli a teraszon”) most nem látjuk, de a pergola → terasz → bútorozott terasz → kerti pihenő kikövetkeztetés ugyanaz a hibaosztály. |
| OP3-1 | KÖZEPES | **A tényhűség-kapu a MINTA-blokkokat forrástalan tényként számolja, és két sablonon mást dönt.** Séta-mock: `factVerdict = flag`, „13 forrás nélküli”. Ebből 12 a MINTA-jelölt szoba-, szolgáltatás- és érkezés-blokkból jön („Ingyenes Wi-Fi (1. szoba)”, „Parkolás”, „Reggeli”, „Kisállat”, „Érkezés 14:00 – 20:00”…), a 13. a „programok 30 km-es körzetből”. A Szerkesztőin ugyanezekből 5 kerül a `factUnsourced`-ba, a verdikt mégis `pass`. A Séta-mock így a küldés-kapun elakadna („Kiküldöm mégis” kellene hozzá) olyan tartalom miatt, amit a lap maga mintának jelöl, a Szerkesztői meg átmegy. A kapu ítélete sablonfüggő és nem determinisztikus. |
| L3-1 | KÖZEPES | **Az eszkalációs −50% ismét azonnal jön (L2-1 változatlan):** a kiküldés után kb. 2 perccel, a 3. böngészős megnyitásra (az én mérő-megnyitásaim) már „Szeretnénk segíteni a döntésben … Látjuk, hogy már többször megnézte … −50% … 71 óra 59 perc”. Élesen keletkezett egy −50%-os ajánlat, lejár okt. 5. 23:26. Ha a tulaj fizetni akar, a koordinátornak ezt kell felülírnia. `shots/lead-03b-escalation-d.png` |
| L3-2 | ALACSONY | **Két viszonyítási alap egy árnál:** a konfigurátor első paneljén „4 650 Ft / hó **−2 325 Ft/hó**” áll (a −25%-os bemutatkozó árhoz mért különbség), alatta „−50% az első díjból”. A következő lépésen és a számlázási lapon „~~9 300 Ft~~ 4 650 Ft” és „Döntés-segítő ajánlat (−50%) **−4 650 Ft**” (a listaárhoz mérve). Ugyanaz az ajánlat két helyen két különböző megtakarítással. `shots/lead-03-config-d-1.png` ↔ `shots/lead-04-step2-d.png` |
| ADM3-1 | ALACSONY | **A modul-kártya „+367 Ft/hó”-t ír, de a −25% kupon egyszeri.** A „Vendégek véleménye” kártyán „~~490 Ft~~ **+367 Ft/hó**” áll. Ugyanez a kosárban: „fizetés most: 367 Ft (1 hónap a fordulónapig)” és „Következő számla így: 7 540 Ft (**+490 Ft** a mostanihoz képest)”. A „/hó” a kártyán tartós havidíjat ígér, holott az csak az első díj. (`shots/ten-03-card-reviews-in-cart.png`, `shots/ten-04-cart.png`) |
| OP3-2 | ALACSONY | A „Fejlesztői adatok” szerint a mock `regionId = "balaton-north"`. Siófok a déli parton van, a lead-lapon „Terület: Balaton-Kelet” áll. A szövegben nem jelenik meg (a tényhűség-őr mellékes észrevétele, kód-szinten nem néztem utána). |
| INFO | — | A megkereső levél aláírása „Olasz Ferenc / Olasz Ferenc e.v.”, nem „Citoviso”. A memória szerint a levél aláírása konfigból jön (az SMS-é „A Citoviso csapata”). A brief „aláírás Citoviso”-t vár: ez a konfig kérdése, a tulaj döntése; a személynevet nem veszem fel leletnek. |

## 1. Operátor — Erika villa
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 1.1 | Lead-lap: „nincs honlap” címke, HONLAP-STÁTUSZ „csak portál-jelenlét” (A1), anyag 84 kép, telefon „–” | PASS | `shots/op-01-lead-before.png` |
| 1.2 | **Választó generálás előtt:** a Séta-kártyán „Séta: előre nem tudható”, bejelölve: „Előre nem tudható, összeáll-e a séta — … ezt a generálás méri. Ha 3-nál kevesebb különböző tárgy jön ki, a séta elmarad, és a kész mock kártyája ezt kimondja.” | **PASS** (ADR-0310 ①) | `shots/op-02-gentab.png`, `shots/op-03-walk-ticked.png` |
| 1.3 | Két mock egy körben: Szerkesztői (stone-masonry) $0,35 + Séta (gravel-grotesque) $0,46, 2:14 alatt | PASS | `shots/op-04-generate-submitted.png` |
| 1.4 | **Mock-kártya:** Séta-mockon „SÉTA · **elmaradt** · 1 fotó-tárgy, 3 kell” | **PASS** (ADR-0310 ③) | `shots/op-05-card-0.png` |
| 1.5 | **Választó generálás után:** „Séta: nem áll össze (1/3)”, magyarázat: „Ennél a leadnél a séta nem áll össze … A nyitó-kollázs képei után 1 tárgy marad: A ház kívülről · Kert és udvar · A kilátás · Asztalnál · Odabent … Ha mégis ezt választod, séta nélküli, egyhasábos lapot kapsz ezen a néven.” | **PASS** (ADR-0310 ①) | `shots/op-06-walk-selector-after.png` |
| 1.6 | **Előnézet:** a Séta kijelölésekor sárga sor: „Ez az előnézet ennél a leadnél séta nélkül áll össze (1 fotó-tárgy, 3 kell) — a görgetés lent nem sétál.” Szerkesztőire váltva eltűnik. Asztal + mobil. | **PASS** (ADR-0310 ②) | `shots/op-08-walk-preview-warn.png` |
| 1.7 | A két mock asztalon és mobilon, végiggörgetve: törött kép 0, vízszintes túlcsordulás 0, térkép-tű 34×34 | PASS | `shots/grid-mock-editorial-{d,m}.png`, `shots/grid-mock-walk-{d,m}.png`, `shots/mock-*-fold.png` |
| 1.8 | **Választás: Szerkesztői.** A Séta itt nem sétál (1/3), és a tényhűség-kapuja flag. A Szerkesztői teljes: polaroid-galéria, foglaló szelvény az első képernyőn. | PASS | — |
| 1.9 | Követett link: a szegmens magától „nincs honlap” (A1) · H-4 változatlan: az e-mail nem töltődik elő, kézzel írtam be | PASS / H-4 | `shots/op-10-*` |
| 1.10 | Piszkozat: „Jogszerűségi kapu: PASS” · **e-mail: „a CÍMRE már ment ki”** · mobil: „nincs szám — a páros nem indítható” | STOP (BLK-1) | `shots/op-11-draft.png` |
| 1.11 | **Plus-alcím (koordinátor):** a lead Adatok fülén `olasz.ferenc+erika@citoviso.com` (a telefon üres maradt). **Megfigyelés:** a lead-adat átírása a meglévő követett linket NEM frissíti: a piszkozat a létrehozáskori címen maradt, és továbbra is „a CÍMRE már ment ki”-t mutatta. A piszkozat saját „Cím mentése” mezőjében is át kellett írni. Utána: „E-mail: most kiküldhető — a küldő-út minden kapuja zöld”. **Az egy-lövés őr tehát a plus-alcímet KÜLÖN címnek veszi** (a `+tag`-et nem normalizálja). Teszthez kényelmes, valódi címzettnél viszont ugyanaz az ember kaphat két hideg levelet (INFO, tulaj-döntés). | info | `shots/op-13-email-plus-saved.png`, `shots/op-14-draft-plus.png` |
| 1.12 | Küldés-gomb a levél végiggörgetése után aktív · címzett tételesen ellenőrizve: „Küldés e-mailben — olasz.ferenc+erika@citoviso.com” · megerősítés: „Kiküldöd a levelet erre a címre: olasz.ferenc+erika@citoviso.com?” → „Kiküldve (smtp) … státusz: sent”, 21:24 UTC | **PASS** | `shots/op-15-after-send.png` |

### Szöveg-ítélet (vendég-kritikus + piac-őr) — Szerkesztői
A mock szövege: `_elek/mock-editorial-text.txt`. Bemenetek és forráspanel: `_elek/src/editorial-inputs.json`. Tényhűség-őr (`tenyhuseg-or`): **FLAG**.

- **Előtte/utána nem látható:** a kritikus mindkét mockon 2 kör után „blokkoló kifogás nincs”-et mondott, a kiszállított változatra a kifogás-sor üres. A köztes változatot a rendszer nem tárolja, csak a kiszállítottat (`guestCriticObjections = []`), ezért idézni nem tudom. A prod-napló csak a végeredményt írja.
- **Forrásolt, rendben:** „kb. 5 perc sétára a szabadstrandtól” (vélemény: „A szabadstrand kb 5 perc sétára van”) · „a szomszédban élelmiszerbolt” („szomszédságában van egy Spar”) · „közel a vízhez” („Close to the lake”) · „Csendes, nyugodt környék” · „szépen berendezett, mindennel felszerelt”. Az „ingyenes strandolást” a szöveg helyesen NEM ígéri.
- **MAGAS (SZ3-1):** „kerti pihenő és bútorozott terasz”, háromszor.
- **ALACSONY–KÖZEPES:** „A szobák **világosak**” (a forrás „hangulatos”-t ír) · „**Csendes udvar**, otthonos szobák” (a forrás a *környéket* mondja csendesnek, az udvart nem) · „Tiszta, mindennel felszerelt szobák” (a vélemény egyetlen szobáról szól).
- **AI-szag:** kevés. „meghitt, családias hangulatú szállás” (prospektus-nyitány) · „Csendes udvar, otthonos szobák, közel a vízhez” (hármas ritmus) · „A hangulatos homlokzattól a nyugodt kertig” (galéria-cím). Nincs tegezés, ál-idézet vagy kitalált szám.
- **Piac-indoklás a kiszállított szövegről szól-e (OP-1):** **igen.** Szerkesztői: „(csendes környék, kerti pihenő, 5 perc séta a szabadstrandtól)”; mindhárom szerepel a kiküldött főcímben. Séta: „(tágas szobák + szabadstrand közelsége)”, a főcím pedig „Tágas szobák pár perc sétára a szabadstrandtól”. **OP-1 javítva.** Csakhogy a piac-őr a forrástalan „kerti pihenő”-t is erényként idézi, vagyis a tényt nem ellenőrzi (ez nem is a dolga).
- A Séta „Spar a szomszédságban” kiemelése márkanevet hoz a lapra (forrásolt, ALACSONY ízlés-kérdés).

## 2. Lead-szem — fizetés nélkül, a számlázási lapig
| # | Lépés | Eredmény | Kép / fájl |
|---|---|---|---|
| 2.1 | A levél az **INBOX**-ban (#376) és a Sentben (#657), 21:24:58, pár mp-cel a küldés után (IMAP csak EXAMINE + BODY.PEEK). Tárgy: „[TESZT] Erika villa – honlap-terv”, From: „Olasz Ferenc <olasz.ferenc@citoviso.com>” | PASS | `mail/01-outreach.eml`, `mail/01-outreach.txt`, `mail/01-outreach-render.html`, `shots/lead-01-mail-{d,m}.png` |
| 2.2 | **L1 (ADR-0306):** „Láttuk, hogy a Google-on 73 értékelés alapján 4,8 csillagos. **Saját honlapot viszont nem találtunk.**” A szegmens-mondat illik a mért adathoz (no_site, A1). Értékelés 4,8 > 4,0. A csonka mondat és a „nincs a képben” fordulat eltűnt. | **PASS** | `mail/01-outreach.txt` |
| 2.3 | Aláírás: „Olasz Ferenc / Olasz Ferenc e.v.” (konfigból), a brief „Citoviso”-t várt. Az MMS-hez tartozó kísérő SMS-ben „A Citoviso csapata” (nem ment ki). | INFO | — |
| 2.4 | **/p/ megnyitás-mérés:** mobil (görgetve) + asztal → 2 megnyitás, `opened`. Egy `curl` után is 2 maradt: a curl nem számít. | **PASS** | — |
| 2.5 | A mock a levélből, mobil 390 px és asztal: túlcsordulás 0, törött kép 0. Felül „Ez egy honlap-terv az Ön szállásáról”, a MINTA-blokkok jelölve. A forrástalan „Kerti pihenő, bútorozott terasz” a lead szemével is kiemelésként áll (SZ3-1). | PASS (SZ3-1 lelettel) | `shots/grid-lead-02-{m,d}.png`, `shots/lead-02-open-{m,d}-fold.png`, `lead-page-{m,d}.txt` |
| 2.6 | 3. megnyitás → eszkalációs felugró ablak (−50%, 72 óra) | L3-1 | `shots/lead-03b-escalation-d.png` |
| 2.7 | „Itt rendelheti meg” → Teljes (11 szekció, benne az Online foglalás, 9 300 Ft/hó) → ingyenes `.citoviso.com` cím → Havi → képjogi nyilatkozat → „Tovább a számlázási adatokhoz” | PASS (L3-2 lelettel) | `shots/lead-03-config-d-1.png`, `shots/lead-04-step2-d.png` |
| 2.8 | Számlázási lap: „Havi listaár 9 300 Ft / hó · Döntés-segítő ajánlat (−50%) −4 650 Ft”. A cím-mezők üresek, csak a számlázási e-mail töltődik elő (`olasz.ferenc+erika@…`). A név mintája „pl. Olasz-Balogh Viktória”. 3 kötelező pipa. | PASS | `shots/lead-05-billing-d.png`, `shots/lead-05-billing-d-full.png` |
| 2.9 | **„Fizetek — 4 650 Ft” — MEGÁLLTAM**, nem nyomtam meg, adatot nem töltöttem ki | **STOP** | — |

- L-6 változatlan (ALACSONY): a „Tovább a számlázási adatokhoz” alatt ma is „Nem kötelező.” áll, a kötelező képjogi pipa mellett.

## 3. Tenant-admin — Muschel (fizetés nélkül)
| # | Lépés | Eredmény | Kép |
|---|---|---|---|
| 3.1 | Áttekintés: „Saját nyitókép · A saját fotói láthatók az oldalán”. **Nincs** „cserélje sajátra”, „bemutató képek”, „jogtiszta” szöveg (asztal + mobil) | **PASS** (ADR-0305) | `shots/ten-01-overview.png`, `shots/ten-07-overview-m.png` |
| 3.2 | Modulok: a megmaradó kupon sora: „−25% kupon — Az induló előfizetéséért kapta. A következő vásárlásánál magától levonjuk — érvényes 2026-12-31-ig. Kedvezmények nem adódnak össze; mindig a nagyobb érvényesül.” | **PASS** (ADM-2, kupon-sor) | `shots/ten-02-modules.png` |
| 3.3 | Az ajánlat-sáv neve („Egyedi ajánlat”) **nem mérhető**: a bérlőnek most nincs élő kampány-ajánlata (a −98% elfogyott a 2. körben). Ehhez a koordinátornak kampányt kellene adnia. | n/a | — |
| 3.4 | „Vendégek véleménye” → Kosárba: „+ bekapcsol · Vendégek véleménye · fizetés most: 367 Ft (1 hónap a fordulónapig) · Következő számla így: 7 540 Ft (+490 Ft a mostanihoz képest)” | PASS (ADM3-1 lelettel) | `shots/ten-03-cart-reviews*.png`, `shots/ten-04-cart.png` |
| 3.5 | „Tovább a fizetéshez” → megerősítő kártya: „Vendégek véleménye · 1 hó × 490 Ft − 25% = 367 Ft · Következő számla (2026. 11. 02.) így 7 540 Ft (+490 Ft)” → **Mégsem**. POST nem ment ki. | PASS / STOP | `shots/ten-05-pay-confirm.png` |
| 3.6 | **ADM-1 előre irányban nem mérhető ezen a bérlőn:** a katalógusban csak két függőség van (booking → pricing → rooms), és a Muschel mindhármat megvette. Egyik meg nem vett modulnak (amenities, usp, reviews, poi, hours) sincs társ-modulja; a kosárba tett véleménynél helyesen nem jön társ. | n/a | — |
| 3.7 | **ADM-1 visszafelé:** „Árak, szezonok → Kikapcsolom” → „**Árak, szezonok nem kapcsolható ki, amíg Online foglalás él.** Az online foglalás összeget mond a vendégnek a naptárban, és ugyanaz az összeg megy ki a visszaigazoló levélben is — az árakat az Árak modul adja. · Árak −490 Ft · Online foglalás −990 Ft · [Mégsem, marad minden] [Mind a 2-t lemondom]” → Mégsem. A függőséget, az indoklást és az árhatást is kimondja. | **PASS** | `shots/ten-06-pricing-off-dialog.png` |
| 3.8 | Kosár kiürítve („Kiürítem a kosarat”), a kártyán ismét „Kosárba teszem”. A kosár kliens-oldali, újratöltés után üres. | PASS | — |
| 3.9 | **LV-1:** élő `teszt-muschel-panzio.citoviso.com` HTML: modul-horgonyok csak `booking`, `booking-section`, `gallery`, `map`, `pricing`, `rooms`; **nincs** `usp` és `reviews`, a „Medence a kertben, reggeli a teraszon” és a „Vendégek véleménye” blokk eltűnt. A menü-horgonyoknak mind van célja. Asztal + mobil: törött kép 0, túlcsordulás 0. | **PASS** | `shots/grid-live-{d,m}.png`, `shots/live-{d,m}-fold.png`, `live-text.txt` |

- INFO: `https://citoviso.com/admin?tab=fotók` (ékezetes, ismeretlen fül) az Áttekintést adja „Még nincs üzenet” / „–” látogatóval, a valódi lap 3 üzenetet és 2 látogatót mutat. Kézzel beírt rossz URL kell hozzá, ALACSONY.

## Visszamérés — a 2. kör leletei élesen
| Lelet | Állapot | Bizonyíték |
|---|---|---|
| S-1 Séta-jelzés (ADR-0310) | **javítva** | választó-címke, magyarázat, előnézet-sor, kártya „elmaradt — 1 fotó-tárgy, 3 kell” (1.2–1.6) |
| OP-1 piac-indoklás a kiszállított szövegről | **javítva** | az indoklás a kiküldött főcím elemeit idézi, mindkét mockon |
| SZ2-1 forrástalan hely-/minőség-részlet blokkol (ADR-0309) | **részben** | „fedett” / „reggeli a teraszon” típus nem jött elő, de a „kerti pihenő és bútorozott terasz” átment (SZ3-1) |
| L1 megkereső levél (ADR-0306) | **javítva** | a postafiókba érkezett levélben: „Saját honlapot viszont nem találtunk.”; értékelés 4,8; a csonka mondat eltűnt (2.2) |
| /p/ megnyitás-mérés (curl nem számít) | **javítva** (változatlanul jó) | 2.4 |
| L2-1 eszkaláció ~3 perc alatt | **nem javítva** | L3-1 |
| L-6 „Nem kötelező.” a kötelező pipa mellett | nem javítva (ALACSONY) | 2. szakasz |
| A1 aggregátor-besorolás (ADR-0307) | **javítva** | Erika villa: „nincs honlap”, a link szegmense magától `nincs_honlap` |
| ADM-1 társ-modulok + árhatás | **javítva** (visszafelé mérve) / előre **nem mérhető** | 3.6–3.7 |
| ADM-2 ajánlat-név + megmaradó kupon | **részben mérve** | a kupon-sor él (3.2); az „Egyedi ajánlat” név kampány nélkül nem mérhető (3.3) |
| LV-1 nem megvett modul az élő oldalon (ADR-0308) | **javítva** | 3.9 |
| ADR-0305 nincs saját-fotó nyomás | **javítva** | 3.1 |
| H-4 e-mail előtöltés a link-űrlapon | nem javítva (ALACSONY) | 1.9 |

## Képek / fájlok (a fához relatív)
- Lead-szem: `_elek/mail/01-outreach.txt`, `_elek/mail/01-outreach-render.html`, `_elek/shots/lead-01-mail-d.png`, `lead-01-mail-m.png`, `grid-lead-02-m.png`, `grid-lead-02-d.png`, `lead-02-open-m-fold.png`, `lead-02-open-d-fold.png`, `lead-03b-escalation-d.png`, `lead-03-config-d-1.png`, `lead-04-step2-d.png`, `lead-05-billing-d.png`
- Operátor: `_elek/shots/op-01-lead-before.png`, `op-02-gentab.png`, `op-03-walk-ticked.png`, `op-05-card-0.png` (Séta-kártya), `op-05-card-1.png`, `op-06-walk-selector-after.png`, `op-08-walk-preview-warn.png`, `op-11-draft.png`, `op-12-mail-preview-d.png`, `op-12-mail-preview-m.png`
- Mockok: `_elek/shots/grid-mock-editorial-d.png`, `grid-mock-editorial-m.png`, `grid-mock-walk-d.png`, `grid-mock-walk-m.png`, `mock-*-fold.png`; szövegek: `_elek/mock-editorial-text.txt`, `_elek/mock-walk-text.txt`; bemenet: `_elek/src/editorial-inputs.json`
- Tenant: `_elek/shots/ten-01-overview.png`, `ten-02-modules.png`, `ten-03-card-reviews-in-cart.png`, `ten-04-cart.png`, `ten-05-pay-confirm.png`, `ten-06-pricing-off-dialog.png`, `ten-07-overview-m.png`
- Élő oldal: `_elek/shots/grid-live-d.png`, `grid-live-m.png`, `_elek/live-text.txt`

## Élesi nyomok, amit hagytam
- Erika villa: 2 mock (Szerkesztői jóváhagyva, Séta aktív), 1 követett link (`sent` → `opened`/`engaged`, 7 mock_view), e-mail-cím a leaden és a linken: `olasz.ferenc+erika@citoviso.com`, 1 eszkalációs −50% ajánlat (okt. 5. 23:26-ig). Rendelés és fizetés nincs.
- Muschel: semmi (a kosár kliens-oldali volt, üresre téve).

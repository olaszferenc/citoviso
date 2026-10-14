# Elek mint foglaló vendég — éles teszt · JELENTÉS 2026-10-14

> A SUB zárójelentése (`~/wt/cit794e134e/_elek/JELENTES.md`). A `shots/` és `mail/` hivatkozások a commitolatlan munkaanyagra mutatnak (`~/wt/cit794e134e/_elek/`). A teszt-adat élesen még MEGVAN; a takarítás a koordinátor szavára fut (`_elek/cleanup.sh`, lent).


Brief: `~/rc-briefs/elek-foglalo-20261014.md` · fa: `~/wt/cit794e134e` · éles = `0038426a` (prod/20261014-1403).
Szállás: https://teszt-boglarka-vendeghaz.citoviso.com (a 2. kör élő próba-oldala; árak, ellátás, gyerekár, IFA be volt állítva, nem nyúltam hozzá).
Képek: `_elek/shots/` (nincsenek commitolva), levelek: `_elek/mail/`. Minden útvonal a fához relatív.
Élesi írás: KIZÁRÓLAG az élő oldal foglalási űrlapja és a lemondó link gombja. Az SQL csak `begin read only` volt. A szállásadói döntéseket (1 visszaigazolás, 2 elutasítás) a `cit1cfac043-6d` session hozta meg felületen át, a koordinátor kérésére.

## Állapot egy sorban
Böngészés (mobil + asztal) → 1. foglalás mobilon (2 felnőtt + 1 gyerek, reggeli, szezonnal átfedő): **86 500 Ft = kézi számolás = szelvény = visszaigazoló képernyő = mindhárom levél** → visszaigazolás → levél + helyes .ics → lemondó link (GET csak kérdez) → lemondás gombbal → lemondó levél + CANCEL-.ics, a napok felszabadultak → 2. foglalás (dupla kattintással) → elutasítás → „nem szabad” levél. Határesetek: 7 alatt 4 rendben, 3 lelet. **BLOKKOLÓ hiba nincs.**

## Leletek
| # | Súly | Lelet | Bizonyíték |
|---|---|---|---|
| F-1 | KÖZEPES | **Férőhely-túllépés: a 4 fős szállásra 7 fős kérés megy át, figyelmeztetés nélkül.** A Vendégek számláló korlát nélkül nő (7 fő, 6 gyerek is beállítható), a szerver elfogadja (`200`, FG-E0FA1A, `guests: 7`), a vendég „Elküldtük a kérését” képet kap. A szállásadói oldalon sincs jelzés: az admin-kártyán „3 éj · 7 fő · 60 000 Ft” áll aktív „Visszaigazolom” gombbal, a tulaj-levélben (#476) „Létszám: 7 fő” és egykattintásos „Elfogadom” link (a szállásadó-session megfigyelése). Ha a tulaj nem veszi észre, túltelt szobát igazol vissza. | `shots/g12-capacity-m.png`, `shots/g07-sent.png`, `mail/476.txt`, `mail/477.txt`; tulaj-oldal: `~/wt/cit1cfac043/_elek/shots2/r3-owner-30-decline7-*.png` |
| F-2 | KÖZEPES | **A minimum éjszakát csak a beküldéskor, a legvégén mondja ki.** Az „Őszi szünet” min. 2 éjes. Egy éjszakára (10.26 → 10.27) a naptár árat ad („Összesen a szállásért 24 000 Ft”), a „Tovább” gomb aktív. A vendég kitölti a nevet, e-mailt, telefont, és csak a gombnyomás után jön: „Legalább 2 éjszakára lehet foglalni.” A honlapon (Árak táblázat, szelvény) a minimum éjszaka sehol nem szerepel. (Egy szezonon kívül érkező, a szezonba átnyúló foglalásra a minimum nem vonatkozik: a 10.22 → 10.25 foglalás 1 szezon-éjjel átment. Ez lehet szándékos, a tulaj döntése.) | `shots/g11-minstay-season-1night-m.png`, `shots/g05-sent.png` |
| F-3 | KÖZEPES | **A galéria egyik képe a valódi szállás szallas.hu-reklám molinója**, rajta a valódi tulaj telefonszáma (+36 30 492 0035) és gmail-címe, illetve a „www.szallas.hu” felirat. Egy vendég ezt látja a honlapon, ami a saját kapcsolatként elek@ címet mutat: két különböző elérhetőség, és egy konkurens portál reklámja a saját foglalási oldalon. (A teszt-oldalon ráadásul a valódi szállásadó száma látszik.) A kép-válogatásnak ki kellene szűrnie a portál-reklámot és a szöveges képet. | `shots/g01-site-m-full.png`, `shots/g06-back.png` |
| F-4 | APRÓ | **Az elutasító levél mindig azt írja: „A kért időpont sajnos nem szabad”**, akkor is, ha a szállásadó indoka más (itt: férőhely). A vendég nem tudja, hogy más időpontra vagy kevesebb fővel érdemes-e újra próbálni. A levélben nincs hivatkozás-szám (FG-…), a szállásadó üzenetének záró idézőjele egyenes („…"). | `mail/478.txt`, `mail/479.txt` |
| F-5 | APRÓ | **Átmeneti kitiltás a hibás beküldések után.** A foglalási végpont IP-nként 10 percenként 5 POST-ot enged, a hibás (400-as) próbálkozás is beleszámít, és az ablak az első kéréstől számít (`src/server/public.ts` `throttled()`). A számláló az összes tenant-oldalra KÖZÖS. Egy vendég, aki 4-szer elgépel valamit, 10 percre kizárja magát. Mobilszolgáltatói közös IP (CGNAT) mögött több vendég is osztozik ugyanazon a keretén. Én a validációs próbák után kaptam: „Túl sok próbálkozás. Kérjük, várjon pár percet.” | a futás naplója (a 429-es kép a következő futásnál felülíródott) |
| F-6 | APRÓ | **Az űrlap-hiba egyszerre egyet mutat, a hibás mező nincs kiemelve**: üres űrlapnál csak „Kérjük, adja meg a nevét.”, a gomb alatt. „abc” telefonszámra is ez jön: „Kérjük, adja meg a telefonszámát…”, pedig megadta, csak hibásan. | `shots/g14-*-m.png` |
| F-7 | APRÓ | **A visszaigazoló levél szövegéből hiányzik a szállás címe** (hová kell menni). Az .ics-ben megvan (LOCATION), a levélben csak a szállás neve és a honlap-link. A sikeres-beküldés képernyő „Létszám: 3 fő”-t ír, a gyerekszámot nem (a levelek már igen). | `mail/467.txt`, `shots/g03-sent.png` |
| F-8 | APRÓ | **A „Megközelítés” térkép üres doboz** (gombostű + név), útvonaltervező link nélkül. Valószínűleg a Maps böngészőkulcs élesen hiányzik (memória: `project_registrar_keys_only_in_dev_env`). | `shots/g01-site-d-full.png` |
| F-9 | INFO | **A „Programok a környéken” légvonalban mér**: Badacsonytomaj „11 km” Balatonboglártól, de az a tó túlpartja, közúton ~70 km. | `state/site-m.txt`, `shots/g01-site-d-full.png` |
| F-10 | INFO | **Egy függő (még nem visszaigazolt) kérés nem foglalja a napokat**: amíg az FG-6FFFA4 függőben volt, a 10.21 → 10.23 kiválasztható volt. Kérés-alapú foglalásnál ez valószínűleg szándékos; a visszaigazolás után a napok azonnal foglaltak lettek. | `shots/g10c-overlap-pending-m.png` |

## A vizsgált út
**Kézi számolás, 1. foglalás** (2026. 10. 22. → 10. 25., 3 éj, 2 felnőtt + 1 gyerek, reggeli): 10-22 és 10-23 alapár 2 × 20 000 + 10-24 „Őszi szünet” 24 000 = **64 000**; reggeli 3 × (2 × 3 000 + 1 500) = **22 500**; **végösszeg 86 500 Ft**; IFA 400 × 2 felnőtt × 3 éj = **2 400 Ft**, a gyerek mentes.

| # | Lépés | Eredmény | Bizonyíték |
|---|---|---|---|
| 1.1 | Oldal mobilon + asztalon: 200, nincs vízszintes görgetés, nincs törött kép | ✅ (F-3, F-8, F-9) | `shots/g01-site-{m,d}-{fold,full}.png` |
| 1.2 | Árak (Őszi szünet 10.24–11.02: 24 000; egyébként 20 000), Ellátás (reggeli +3 000 / gyerek 1 500, félpanzió +7 000 / gyerek 3 500), „12 éves korig”, benne foglalt szolgáltatások, Szállás 4 fő | ✅ a beállítással egyezik; a minimum éjszaka nincs feltüntetve (F-2) | `state/site-m.txt` |
| 2.1 | Mobil szelvény: 4 tételsor, 86 500, IFA 2 400 + mentesség | ✅ | `shots/g02-quote.png` |
| 2.2 | Asztali szelvény: ugyanez | ✅ | `shots/g04d-quote.png` |
| 2.3 | Beküldés: `200`, FG-6FFFA4, total 86 500, children 1; visszaigazoló képernyő 86 500 | ✅ (F-7) | `shots/g03-sent.png` |
| 2.4 | Levelek: vendég „kérését rögzítettük” (#465), tulaj (#466) „3 fő, ebből 1 gyermek”, Reggeli, 86 500 | ✅ | `mail/465.txt`, `mail/466.txt` |
| 3.1 | Foglalt nap: 11.01–03 tiltva; átnyúló időszak → „Sajnos ezek a napok már foglaltak.”; távozás foglalt napon → engedi (helyes) | ✅ | `shots/g10-booked-span-m.png`, `shots/g10b-checkout-on-booked-m.png` |
| 3.2 | Min. éj (1 éj a szezonban) | ❌ F-2 | `shots/g11-minstay-season-1night-m.png` |
| 3.3 | Több vendég, mint a férőhely (7 / 4) | ❌ F-1 | `shots/g12-capacity-m.png` |
| 3.4 | Múltbeli dátum: a naptárban tiltva; begépelve „A legkorábbi foglalható érkezés: 2026. 10. 14.”, a Tovább nem jelenik meg; fordított dátum: „A távozás legyen későbbi az érkezésnél.” | ✅ | `shots/g13-*-m.png` |
| 3.5 | Hibás e-mail (`elek@citoviso`) → szerver 400 „érvényes e-mail címet”; szóközös → böngésző-validáció; üres / hibás telefon → üzenet | ✅ (F-6) | `shots/g14-*-m.png` |
| 3.6 | Dupla kattintás a beküldésen → **1** POST, 1 foglalás (FG-856A8E) | ✅ | `shots/g06-sent.png` |
| 3.7 | Vissza gomb a sikeres küldés után → kezdőlap, nincs újraküldés | ✅ | `shots/g06-back.png` |
| 4.1 | Visszaigazolás után levél (#467): tételek, 86 500, IFA, lemondó link; **melléklet `foglalas.ics`** (DTSTART 20261022, DTEND 20261025, LOCATION = cím, CONFIRMED); Reply-To a szállásadó | ✅ (F-7) | `mail/467.txt`, `mail/467.eml` |
| 4.2 | A naptárban 10.22–24 foglalt lett | ✅ | `shots/g10-booked-span-m.png` (2. futás) |
| 4.3 | Lemondó link GET (mobil + asztal): „Biztosan lemondja a foglalását?”, POST-űrlap, „Igen, lemondom” / „Mégsem” — **a GET nem dönt** | ✅ | `shots/g20-cancel-get-{m,d}.png` |
| 4.4 | Gomb → „Foglalása lemondva”; a link újra megnyitva: „A link már nem él” | ✅ | `shots/g21-cancel-done-m.png`, `shots/g22-cancel-again-m.png` |
| 4.5 | Lemondó levél (#469) **CANCEL-.ics-szel** (ugyanaz az UID, SEQUENCE 1, CANCELLED), tulaj-levél (#470); a 10.22 újra foglalható | ✅ | `mail/469.txt`, `mail/469.eml`, `mail/470.txt` |
| 5.1 | 2. foglalás (11.10 → 11.13, 2 fő, félpanzió: 60 000 + 3 × 7 000 × 2 = **102 000** = szelvény = szerver) → elutasítva | ✅ | `shots/g06-sent.png` |
| 5.2 | Elutasító levél (#478): „A kért időpont sajnos nem szabad”, + a szállásadó üzenete | ✅ (F-4) | `mail/478.txt` |
| 5.3 | Férőhely-teszt (FG-E0FA1A) is elutasítva → ugyanaz a levél (#479) | ⚠ F-4 | `mail/479.txt` |

Címzettek: minden levél kizárólag `elek@citoviso.com`-ra ment. SMS nem volt (a vendég-telefon a tulaj teszt-mobilja, +36 30 516 1631). Fizetés nem volt (a helyszínen fizetendő).

## Az általam keletkezett éles adat
`booking_request` 3 sor a `teszt-boglarka-vendeghaz` oldalon (`guest_email = elek@citoviso.com`):
- `6fffa490-f763-4ece-9c71-2c97de83240a` FG-6FFFA4 — cancelled
- `856a8e0e-9bec-498d-8cc0-64a76645eeec` FG-856A8E — declined
- `e0fa1a5e-01ff-4b3d-85a0-ffbaa14f35e2` FG-E0FA1A — declined

A 400-as és 429-es próbálkozások nem hoztak létre sort (csak-olvasó lekérdezéssel ellenőrizve). Elek postafiókjában: #465–#467, #469–#470, #473–#474, #476–#479.

## Takarítás — ELŐKÉSZÍTVE, NEM FUTOTT (a koordinátor „takaríts” üzenetére)
- Szkript: `_elek/cleanup.sh`. Alapból száraz: mentés, törlés tranzakcióban, ROLLBACK, a mentést eldobja. Éles futás: `bash _elek/cleanup.sh --go`.
- Mentés helye: `/opt/citoviso/backups/elek-foglalo-20261014-<ts>/booking_request.json`.
- A törlés a fenti 3 azonosítót érinti, és csak akkor, ha a sor ehhez az oldalhoz és az elek@ címhez tartozik. Ellenőrzés: 0 saját sor marad, a másik szál 2. körös foglalása (`01422677…`) megmarad.
- Egyetlen FK mutat a `booking_request`-re: a `site_review.booking_request_id`, SET NULL.
- **Nem kell futtatni, ha** a 2. kör `~/wt/cit1cfac043/_elek/cleanup-2.sh --go` lefut: az a teljes [TESZT] Boglárka tenantot törli, ezek a sorok kaszkáddal vele mennek.

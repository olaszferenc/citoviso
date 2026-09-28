# FK-013 — Elek FELTÖLT MINDENT, TELEFONON: három egység, három szezon, tizennyolc fotó, programok, felszereltség

cél: Elek megvette a modulokat (FK-012), most megtölti a honlapját — úgy, ahogy egy IT-kezdő szállásadó tenné: a telefonján, este, egy kézzel, először látva a felületeket. Ahol lehet, TÖBB rekordot visz fel (három egység, három szezon, több program, sok fotó), mert a második és a harmadik rekord mutatja meg, hogy a felület skálázódik-e. Az ítélet: meg tudja-e tölteni a honlapját segítség nélkül, és a mentések valóban rögzülnek-e. A többnyelvű honlap tudatosan a LEGUTOLSÓ szakasz: a fordítás a már elmentett tartalomból készül.
felület: tenant-admin
nézet: telefon
kontraktus: assets/design-refs/tenant-admin/season-datepicker/README.md

## Előkészítés

- [ ] Elek belép a saját adminjába a telefonján
  user: anon
  út: /login
  tedd: írd "#username" "${ELEK_NIGHT_USER}"
  tedd: írd "#password" "${ELEK_NIGHT_PASSWORD}"
  tedd: kattints "button[type='submit']"
  tedd: várj "Áttekintés" 25
  # A süti-sáv a BEJELENTKEZETT adminban is kint van (390×125 px, a képernyő 15%-a, a
  # 660–784 sávban — pont a mentés-gombok magasságában). Egyszeri elfogadás után eltűnik,
  # de addig takar: a kör ezért itt lekezeli. A lelet marad.
  tedd?: kattints ".cit-consent__yes"
  várd: látható "Áttekintés"
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ① Fotók — a saját képei kerülnek a bemutató-képek helyére

- [ ] A Fotók fül megmondja, hogy most még bemutató-képek vannak kint
  út: /admin?tab=fotok
  várd: látható "Fotók"
  kézi: 390-en kiderül-e, hogy a jelenlegi képek NEM a sajátjai, és hogy az élesítéshez a saját fotói kellenek; a „Fotók választása" és a „Fényképezés" gomb ujjal elérhető-e; a korlátok (max 6 MB, max 12 egyszerre, 24 a könyvtárban) olvashatók-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Tizenkét fotót tölt fel egyszerre (a megengedett maximum)
  tedd: töltsd-fel "#adm-file" "${ELEK_NIGHT_PHOTOS_A}"
  tedd: várj "feltöltve" 120
  várd: látható "feltöltve"
  adat: ELEK-NIGHT 12 fotó (portál-forrás, dev teszt)
  kézi: a feltöltés közben látott-e a tulaj VISSZAJELZÉST (haladás képenként), és a végén megtudta-e, hány kép került fel; 390-en a rács átlátható-e; a nagy (fél megabájtos) képek átmentek-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Még hat fotót tölt fel — a könyvtár feltöltődik
  út: /admin?tab=fotok
  tedd: töltsd-fel "#adm-file" "${ELEK_NIGHT_PHOTOS_B}"
  tedd: várj "feltöltve" 120
  adat: ELEK-NIGHT +6 fotó
  kézi: a számláló (n / 24) követi-e a valóságot; a második feltöltés után is a SAJÁT képek látszanak-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az első kép lesz a nyitókép, és Elek képaláírást ír
  kézi: a képen: felismerhető-e, MELYIK a nyitókép; a „Legyen nyitókép" és a képaláírás-mező ujjal elérhető-e 390-en; a húzással rendezés működne-e ujjal (vagy van-e helyette gomb)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ② Szobák — három egység

- [ ] Az első egység felvétele
  út: /admin?tab=modulok&m=rooms
  várd: látható "A szobái"
  tedd: kattints "Új szoba felvétele"
  tedd: írd "form:has(input[name='price_on_request']) input[name='name']" "Nádas apartman"
  tedd: írd "form:has(input[name='price_on_request']) input[name='capacity']" "4"
  tedd: írd "form:has(input[name='price_on_request']) input[name='price']" "24000"
  # ⛔ MÉRT LELET (2026-09-27): a szállásnak MÁR VAN egy egysége („A szállás egésze"),
  # ezért az ELSŐ saját egység felvételekor is KÖTELEZŐ az „Az egész szállást is kiadja
  # egyben?" választás — az a mezők FÖLÖTT, 390 px-en a képernyőn kívül volt, és a
  # „Hozzáadás" NÉMÁN nem csinált semmit. JAVÍTVA (2026-09-28, room-add-B): a kérdés a
  # gomb fölött áll, kihagyva a gomb alatt piros sor mondja meg, mi hiányzik.
  tedd: kattints "form:has(input[name='price_on_request']) button[type='submit']"
  várd: látható "Még egy döntés hiányzik"
  tedd: kattints "label:has(input[name='whole'][value='igen'])"
  tedd: görgess-középre "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: kattints "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: várj "Felvettük" 20
  várd: látható "Nádas apartman"
  adat: ELEK-NIGHT egység (Nádas apartman, 4 fő, 24 000 Ft)
  kézi: 390-en a felvevő űrlap egy oszlopban, feliratozva van-e; a mentés visszajelzése megmondja-e, mi történt és mi látszik a vendégnek
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A második egység — itt a rendszer rákérdez az egész szállásra
  tedd: kattints "Új szoba felvétele"
  tedd: írd "form:has(input[name='price_on_request']) input[name='name']" "Kisházi szoba"
  tedd: írd "form:has(input[name='price_on_request']) input[name='capacity']" "2"
  tedd: írd "form:has(input[name='price_on_request']) input[name='price']" "16000"
  tedd: kattints "label:has(input[name='whole'][value='igen'])"
  tedd: görgess-középre "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: kattints "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: várj "Felvettük" 20
  várd: látható "Kisházi szoba"
  adat: ELEK-NIGHT egység (Kisházi szoba, 2 fő, 16 000 Ft) + egész szállás igen
  kézi: az „Az egész szállást is kiadja egyben?" kérdés érthető-e egy kezdőnek 390-en, és kiderül-e, MIÉRT kérdezzük; kötelező-e (ha igen, látszik-e, hogy az)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A harmadik egység
  tedd: kattints "Új szoba felvétele"
  tedd: írd "form:has(input[name='price_on_request']) input[name='name']" "Kerti stúdió"
  tedd: írd "form:has(input[name='price_on_request']) input[name='capacity']" "3"
  tedd: írd "form:has(input[name='price_on_request']) input[name='price']" "19000"
  tedd: görgess-középre "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: kattints "form:has(input[name='price_on_request']) button[type='submit']"
  tedd: várj "Felvettük" 20
  várd: látható "Kerti stúdió"
  adat: ELEK-NIGHT egység (Kerti stúdió, 3 fő, 19 000 Ft)
  kézi: három egységgel a kártya-rács 390-en hogyan áll (két hasáb? olvasható a név és az ár?); a „Koppintson rá — a szerkesztő felugrik" útmutatás igaz-e ujjal
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ③ Egy egység részletei — leírás, felszereltség, képek

- [ ] A szerkesztő felugró megnyílik, és a fülek használhatók ujjal
  tedd: kattints ".rs-gcard[data-rs-card]"
  várd: darab ".rs-modal" >= 1
  kézi: a felugró 390-en majdnem teljes képernyő-e, és a három fül (Alapok · Képek · Felszereltség) ujjal váltható-e; a „Mentés" a rögzített lábazatban tényleg látszik-e görgetés nélkül
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Leírást ír az egységhez, és elmenti
  tedd: írd "textarea[name='description']" "Nádfedeles parasztház felső szintje: két hálószoba, saját fürdő, tágas terasz a burjánzó kertre. Reggeli a kovácsoltvas asztalnál, csendben."
  tedd: kattints ".rs-pop__foot button[type='submit']"
  tedd: várj "Mentve" 20
  kézi: a mentés után hol van a tulaj (visszakerült-e a listára vagy a felugróban maradt), és tudja-e, hogy a leírás kint van; a szövegmező 390-en elég nagy-e a gépeléshez
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ④ Árak — alapár és HÁROM szezon

- [ ] Az Árak képernyő egységenként külön kártyát ad
  út: /admin?tab=modulok&m=pricing
  várd: látható "Nádas apartman"
  várd: látható "Alapár"
  kézi: 390-en a három egység kártyája elkülönül-e, és kiderül-e, melyik ár melyik egységé; az „Ez érvényes, amikor egyik időszak sem" mondat érthető-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


# ⛔ MÉRT LELET (2026-09-28): a korábbi lépések a LAP ELSŐ kártyájára („A szállás egésze")
# találtak (szűkítetlen szelektorok), a naptár 390 px-en EGY hónapot mutat és a MAI
# hónapra nyílik (a `06-15` nap nem volt a DOM-ban), a záró nap koppintása pedig magától
# becsukja a naptárat (az utána kért `[data-done]` rejtett). A felület tap-pel mérve
# hibátlan volt (06-15 → 08-31 rögzült, DB-ben visszaolvasva). Ezért: minden lépés a
# Nádas kártyájára szűkítve, a hónapot az „Az év, egy pillantásra" sáv hónap-gombja
# választja (ahogy egy tulaj is ugrana — és a mai dátumtól független), és a nyitott
# naptár KÜLÖN lépés, hogy a képe megmaradjon.
- [ ] Az első szezon: Főszezon — a naptár NYITVA (kép a következő ítélet-körnek)
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='label']" "Főszezon"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-sdp='from']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='6']"
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='06-15']" >= 1
  kézi: a naptár 390-en a mezők ALATT nyílik-e (nem takarva), egy hónap látszik-e, a „Válassza ki a kezdő napot” lépés-felirat érthető-e; az „Az év, egy pillantásra” hónap-gombja a jó hónapra ugrott-e; a hónap-léptetés nyilai ujjal elérhetők-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Az első szezon: Főszezon — kezdő és záró nap, ár, felvétel
  # A runner a 390-es kép UTÁN fekvő és asztali képet is készít (szélesség-váltás), ami
  # a naptárat szándékosan becsukja — ezért a hónap-gomb itt újranyitja.
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='6']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='06-15']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='8']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='08-31']"
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='amount']" "34000"
  tedd: görgess-középre ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: várj "Mentve" 20
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) [data-strip][data-label='Főszezon']" >= 1
  adat: ELEK-NIGHT szezon (Főszezon, 06-15 → 08-31, 34 000 Ft, Nádas apartman)
  kézi: a felvétel után a Nádas kártyáján megjelenik-e a Főszezon az évsávval, és kiderül-e, hogy a többi szobára NEM vonatkozik
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A második szezon: Őszi szünet — a naptár NYITVA (kép a következő ítélet-körnek)
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='label']" "Őszi szünet"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-sdp='from']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='10']"
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='10-23']" >= 1
  kézi: a nyitott naptárban a MÁR felvett Főszezon napjai jelölve vannak-e („másik időszak napjai”) — itt októberben nem, de a jelmagyarázat megjelenik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A második szezon: Őszi szünet — kezdő és záró nap, ár, felvétel
  # A runner a 390-es kép UTÁN fekvő és asztali képet is készít (szélesség-váltás), ami
  # a naptárat szándékosan becsukja — ezért a hónap-gomb itt újranyitja.
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='10']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='10-23']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='11']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='11-02']"
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='amount']" "28000"
  tedd: görgess-középre ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: várj "Mentve" 20
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) [data-strip][data-label='Őszi szünet']" >= 1
  adat: ELEK-NIGHT szezon (Őszi szünet, 10-23 → 11-02, 28 000 Ft, Nádas apartman)
  kézi: a MÁSODIK szezon felvétele után a lista 390-en átlátható-e (mi van elöl, mi a sorrend), és a két időszak nem fedi-e egymást észrevétlenül
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A harmadik szezon: Szilveszter (átnyúlik az évfordulón) — a naptár NYITVA (kép a következő ítélet-körnek)
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='label']" "Szilveszter"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-sdp='from']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='12']"
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='12-28']" >= 1
  kézi: a decemberi naptár 390-en; a záró napot a következő év januárjából választja — kiderül-e a lépés-feliratból („Most a záró napot (december 28. után)”), hogy januárt választhat
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A harmadik szezon: Szilveszter (átnyúlik az évfordulón) — kezdő és záró nap, ár, felvétel
  # A runner a 390-es kép UTÁN fekvő és asztali képet is készít (szélesség-váltás), ami
  # a naptárat szándékosan becsukja — ezért a hónap-gomb itt újranyitja.
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='12']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='12-28']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-syear] [data-m='1']"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] [data-scal] [data-d='01-02']"
  tedd: írd ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] input[name='amount']" "39000"
  tedd: görgess-középre ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: kattints ".adm-card:has(h2:text-is('Nádas apartman')) form[data-sadd] .pn-go"
  tedd: várj "Mentve" 20
  várd: darab ".adm-card:has(h2:text-is('Nádas apartman')) [data-strip][data-label='Szilveszter']" >= 1
  adat: ELEK-NIGHT szezon (Szilveszter, 12-28 → 01-02, 39 000 Ft, Nádas apartman)
  kézi: az ÉVFORDULÓN átnyúló időszakot elfogadta-e, és a felület kimondja-e, hogy ez év végén kezdődik és a következő évben ér véget — vagy a tulaj azt hiheti, elgépelte
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑤ Felszereltség — amit az egész szállás kínál

- [ ] A felszereltség-választó ujjal használható, és a mentés rögzül
  út: /admin?tab=modulok&m=amenities
  # ⛔ ELŐFELTÉTEL, KIMONDVA (2026-09-28): ez a lépés CSAK akkor mér, ha a bérlőnek van
  # AKTÍV `amenities` modulja — a modul-képernyő kapuja csak arra nyílik. Ha nincs, a lap
  # a Modulok fület adja vissza, és a mező hiánya „regressziónak" látszik (mérve: egy
  # futásban az FK-012 kihagyta a felszereltséget, és a hiba ITT jelent meg).
  várd: látható "Amit kínál"
  tedd: írd "textarea[name='other']" "Kerti grill\nKovácsoltvas kerti bútor\nNádtető alatti terasz"
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
  tedd: görgess-középre "Beállítások mentése"
  tedd: kattints "Beállítások mentése"
  tedd: várj "Mentve" 20
  adat: ELEK-NIGHT felszereltség (3 saját tétel)
  kézi: 390-en a csempés választó használható-e ujjal (a csempék ≥ 44 px), a kereső segít-e; a „soronként egy" utasítás érthető-e; mentés után visszajelzés van-e

## ⑥ Miért Önt válasszák — több sor egy mezőben

- [ ] Négy erősséget ír be, és elmenti
  út: /admin?tab=modulok&m=usp
  várd: látható "Miért Önt válasszák"
  tedd: írd "textarea[name='items']" "Nádfedeles parasztház a Káli-medence szívében\nÁrnyas, burjánzó kert, csendes zugokkal\nNincs átmenő forgalom — igazi vidéki nyugalom\nA Balaton 12 km, a Kőtenger 5 km"
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája
  tedd: görgess-középre "Beállítások mentése"
  tedd: kattints "Beállítások mentése"
  tedd: várj "Mentve" 20
  adat: ELEK-NIGHT USP (4 sor)
  kézi: kiderül-e, hogy SORONKÉNT egy erősség kell, és hogy legfeljebb hatot mutatunk; 390-en a mező elég nagy-e négy sorhoz; a mentés után visszaolvasható-e, amit beírt

## ⑦ Nyitvatartás, érkezés

- [ ] Érkezési és távozási idő megadása
  út: /admin?tab=modulok&m=hours
  várd: látható "Nyitvatartás"
  tedd: írd "input[name='checkInFrom']" "14:00"
  tedd: írd "input[name='checkOutUntil']" "10:00"
  tedd: írd "input[name='note']" "Késői érkezés előre egyeztetve lehetséges — hívjon minket."
  tedd: görgess-középre "Beállítások mentése"
  tedd: kattints "Beállítások mentése"
  tedd: várj "Mentve" 20
  adat: ELEK-NIGHT nyitvatartás (14:00 / 10:00)
  kézi: az idő-mezők telefonon a natív időválasztót nyitják-e, és az érték látszik-e utána; a mezők feliratai egyértelműek-e („Érkezni ettől lehet" vs. „Távozás eddig")
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑧ Térkép és elérhetőség

- [ ] A cím megadása és a térkép-tű
  út: /admin?tab=modulok&m=location
  várd: látható "A szállás helye"
  tedd: írd "#pl_addr" "Köveskál, Fő utca 12."
  tedd: kattints "#pl_find"
  tedd: várj "Megközelítés" 15
  kézi: a „Megkeresem a térképen" megtalálta-e a címet 390-en; a térkép és a tű látszik-e, és a tű ujjal HÚZHATÓ-e; a tulaj tudja-e, hogy ez a pont vezeti majd a vendéget
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Megközelítés és parkolás, majd mentés
  tedd: írd "textarea[name='approachNote']" "A 71-es útról Köveskál felé, a templomtól a második utca jobbra. A kaputól a ház a kert végében."
  tedd: írd "input[name='parkingNote']" "Ingyenes parkolás az udvarban, két autónak."
  tedd: görgess-középre "#pl_save"
  tedd: kattints "#pl_save"
  tedd: várj "Nincs mentetlen változás" 20
  adat: ELEK-NIGHT hely + megközelítés
  kézi: a „Mentés és frissítés" után az állapot-sor megmondja-e, hogy minden mentve; 390-en a térkép 300 px-es magassága elég-e a tű pontos elhelyezéséhez
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Telefon és e-mail az Elérhetőség fülön
  út: /admin?tab=elerhetoseg
  várd: látható "Telefon és e-mail"
  tedd: írd "#ct_phone" "+36 30 555 0100"
  tedd: írd "#ct_email" "elek@citoviso.com"
  tedd: görgess-középre "Mentés és frissítés"
  tedd: kattints "Mentés és frissítés"
  tedd: várj "Nincs mentetlen változás" 20
  adat: ELEK-NIGHT elérhetőség
  kézi: a telefonszám formátumát elfogadta-e; a mentés visszajelzése látszik-e 390-en
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑨ Heti programajánló — több program, mobil fülekkel

- [ ] A programajánló képernyő megnyílik telefonon
  út: /admin?tab=modulok&m=poi
  várd: látható "programajánló"
  kézi: 390-en mit lát a tulaj: javasolt programokat, vagy a „Most gyűjtjük a környéke programjait" üzenetet; a két fül (Javasolt / Az Ön oldalán) látszik-e és váltható-e ujjal; ha nincs mit választani, a felület megmondja-e, mikor lesz
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Saját programot vesz fel — ELSŐ
  tedd?: kattints "[data-pa-act='new']"
  tedd?: írd "input[name='title']" "Borkóstoló a teraszunkon"
  tedd?: írd "input[name='start']" "2026-10-24"
  tedd?: kattints "[data-pa-act='fok']"
  kézi: a saját program űrlapja 390-en kitölthető-e (cím, dátum, hol lesz); a „Helyben / Máshol" választás érthető-e; a felvétel után látszik-e a listán
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Saját programot vesz fel — MÁSODIK
  tedd?: kattints "[data-pa-act='new']"
  tedd?: írd "input[name='title']" "Szüreti felvonulás a faluban"
  tedd?: írd "input[name='start']" "2026-10-25"
  tedd?: kattints "[data-pa-act='fok']"
  kézi: a második tétel felvétele után a sorrend követhető-e, és a „Mentés a honlapra" gomb AKTÍV lett-e (előtte tiltott volt)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Mentés a honlapra
  tedd?: kattints "[data-pa-save]"
  tedd: várj "Mentve" 25
  adat: ELEK-NIGHT programok (2 saját)
  kézi: a mentés visszajelzése látszik-e; a tulaj tudja-e, hogy ez MOSTANTÓL kint van a honlapján
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑩ Vélemények — a szabályok beállítása (véleményt a vendég ír)

- [ ] A vélemény-modul beállítása, és hogy kiderüljön: a tulaj nem ír véleményt
  út: /admin?tab=modulok&m=reviews
  várd: látható "Vendég"
  tedd: írd "input[name='notifyEmail']" "elek@citoviso.com"
  tedd: görgess-középre "Beállítások mentése"
  tedd: kattints "Beállítások mentése"
  tedd: várj "Mentve" 20
  kézi: 390-en kiderül-e, hogy a véleményeket a VENDÉG küldi, és a tulaj csak dönt róluk; az üres állapot („Még nem érkezett vélemény") őszinte-e; a Google-értékelés kártya mit mond
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑪ Online foglalás — szabályok és naptár

- [ ] A foglalás szabályai: minimum éjszaka, értesítési cím, IFA
  út: /admin?tab=modulok&m=booking
  várd: látható "Online foglalás"
  tedd: írd "input[name='minNights']" "2"
  tedd: írd "input[name='notifyEmail']" "elek@citoviso.com"
  tedd: írd "input[name='touristTaxPerPersonNight']" "600"
  tedd: írd "input[name='priceIncludes']" "Ágyneműt, törülközőt és a reggeli kávét az ár tartalmazza."
  tedd: görgess-középre "Beállítások mentése"
  tedd: kattints "Beállítások mentése"
  tedd: várj "Mentve" 20
  adat: ELEK-NIGHT foglalás-szabályok (min 2 éj, IFA 600)
  kézi: 390-en a szabály-mezők feliratai érthetőek-e egy kezdőnek (mit jelent a „Legkorábbi érkezés mostantól"); az IFA mezőnél kiderül-e, mire kell; a mentés visszajelzése látszik-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] A naptárban kizár néhány napot („Mikor nem kiadó?")
  kézi: a képen: a naptár 390-en átlátható-e (nem kell vízszintesen görgetni), a napokra koppintás jelöl-e, és a „Naptár mentése" gomb elérhető-e; egy kezdő érti-e, hogy itt a SAJÁT zárva tartását jelöli
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑫ Többnyelvű honlap — a LEGUTOLSÓ lépés (a mentett tartalomból fordít)

- [ ] A többnyelvű kártya megmondja, hogy a már elmentett szövegekből fordít
  út: /admin?tab=modulok
  várd: látható "Többnyelvű honlap"
  kézi: 390-en olvasható-e a figyelmeztetés, hogy a fordítás a MOST elmentett tartalomból készül; a csomagok (Alap / Bővített / Teljes) és a nyelvválasztó ujjal használható-e; a tapadó ár-sáv nem takarja-e a nyelveket; kiderül-e, hogy ez EGYSZERI díj
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


- [ ] Nyelveket választ és megrendeli
  tedd?: kattints "label.adm-mltc:has(input[value='alap'])"
  tedd?: kattints "label.adm-mlang[data-lang='de']"
  tedd?: kattints "label.adm-mlang[data-lang='en']"
  kézi: a képen: a választott nyelvek kijelöltnek látszanak-e, a kapacitás-sor („Még N nyelvet választhat UGYANEZÉRT") érthető-e, és a fizető gomb felirata megmondja-e az árat; a két gomb-példány (kártya + tapadó sáv) nem zavaró-e
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája


## ⑬ Összkép

- [ ] Meg tudta volna tölteni a honlapját egy IT-kezdő, telefonon?
  kézi: a futás minden képe alapján: melyik szerkesztő volt a legnehezebb ujjal (megnevezve), hol nem derült ki, mit kérünk tőle, hol veszett el a mentés visszajelzése, és hol kellett volna asztali gépet elővennie; külön: mennyi idő alatt lehetne ezt végigvinni telefonon, és mi a sorrend, amit a felület MAGÁTÓL ajánl (van-e ilyen egyáltalán)
  tűrt-hiba: 429 — a forrás-portál fotó-korlátja (a bemutató-képek onnan jönnek), nem a felület hibája

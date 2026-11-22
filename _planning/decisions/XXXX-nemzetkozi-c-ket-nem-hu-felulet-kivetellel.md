## ADR-XXXX — Nemzetközi C: a két nem-magyar felület (szobatípus a mockon, ország-portálok a szállás-adminban) felület-kapu kivétellel

**Státusz:** ELFOGADVA (tulaj 2026-11-22 a koordinátoron át, `cit9b4690e3`; MEMORY „TULAJ-DÖNTÉSEK (nemzetközi C után)” (2))
· **Épít:** ADR-0468 (Nemzetközi C), ADR-0464 ③ (`hungarianRoomName` minta), ADR-0361 (iCal-szinkron).

### Kivétel
A §2b terv-jóváhagyási kapu alól a tulaj KIVÉTELT adott, minta nélkül — mindkét változás meglévő felület
országfüggővé tétele, új elrendezés nélkül. A képernyőképek (mobil + asztali) a session zárójelentésében.

### Döntés
① **Mock, nem-magyar és nem-angol lap:** a portál ANGOL szobaneve helyett a szoba TÍPUSA a lap nyelvén
(`roomNames.ts localRoomName` → `templateKit.ts roomTypeName`, típusonként egy szó szerinti `T()`, 13 kulcs:
Lakosztály … Családi szoba). Az összetett név fordítása Bábel munkája lenne, nem egy tábláé, ezért a típus.
Render- és generálási időben (`render.ts`, `generateEngine.ts portalRooms`); az élő lap a tulaj saját nevét
mutatja, azt nem érinti. Hiányzó fordítás = jelentett fallback (`collectFallbacks`) → a meglévő nyelvi kapu
tartja a lapot, amíg Bábel nem importál; magyar szó nem megy ki. Magyar lap bájtra azonos, angol lap a nevet tartja.

② **Szállás-admin › Online foglalás › „Hirdeti máshol is?”:** a naptár-szinkron kártyák és az útmutató fülei
a szállás országának `calendarSyncPortals` listájából (`public.ts` → `BookingEditorData.syncPortals`,
`portalGuide(lang, only)`); HR = Booking.com + Airbnb, a bevezető mondat Szállás.hu nélküli változata.
Magyar és ország nélküli (régi) szállásnál a kártya bájtra változatlan.

### Mérés
`npx tsx scripts/nemzetkozi-c-felulet-check.mts` (scratch DB, 0142 HR sor): HR mock 21 sablonban angol név
nélkül, HR admin csak Booking + Airbnb (390/1280, JS-hiba 0), HU = ország nélküli bájtra.

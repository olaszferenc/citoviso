# 2026-10-21 — A minta-szolgáltatáslista csak a forrásból (ADR-XXXX)

**Szál:** CIT SUB `cita3d7c954`, koordinátor `cita291565c` (brief: `~/rc-briefs/minta-szolgaltatas-hamis-tetel-20261021.md`), Vera J-leletei éles mockokon.

## Ok (élesről olvasva, csak olvasás)
- **Dunapart Villa (625416e9), Hosszúhegyi (cfa02265):** „Reggeli” — a recept `sampleAmenities`-ében nincs; az `amenitiesSampleBlock` generikus feltöltése tette be (wifi, parkolás, reggeli, klíma, terasz, kisállat — ami nem tiltott).
- **Hargita (553e075a), Hotel Garni (74e3f1e3):** „Étterem” — `descriptionSellingPoints` a „A közelben található étterem” mondatot igenlőnek vette; a forrás-panelen `source: description`.
- **Hotel Garni:** „Reggeli” — generikus feltöltés („Ellátást nem tudnak biztosítani” nem tiltotta); „1.–3. szoba” — hovamenjek `roomCount = 3` a „3 db szoba légkondicionált” mondatból, a szöveg „9 szobában összesen 24 főt”.

## Javítás
- `src/engine/sampleFromSource.ts`: `sampleAmenityItems(sourced, deny)` generikus feltöltés nélkül; `affirmedSampleTypes`; `roomCountContradicted`; `deniedSampleTypes` → „önellátó” / tagadott „ellátás” = breakfast tiltva.
- `src/generator/marketCheck.ts`: `proseAffirms` — közeli jelző (a közelben, környéken, sétatávolság, N m-re, N perc sétára) a tagmondatban → a létesítmény idegen; hely-szavak (strand, vízpart, kilátás, panoráma, stég, móló) kivételek.
- `src/engine/templateKit.ts`: számozott minta-kártyán típusos chip csak forrásban álló típussal.
- `src/engine/moduleSections.ts`: a generikus lista kivéve.
- `src/generator/generateEngine.ts`: `sampleHintsOf()` — egy függvény a generátornak és a `--resample`-nek; ellentmondott szobaszám → null.
- `scripts/rerender-mock.mts --resample`: AI nélkül újraszámolja és perzisztálja a 4 minta-jelzést, majd renderel.
- `scripts/sample-from-source-check.mts` ④b: valós forrásszövegek; piros kontroll a régi kódon 5 bukás.

## További esetek (koordinátor, ugyanaznap)
- Kis Duna Garden (f380ad0a), Malomkert (ed655504), Margaréta-Bia (a6354819), Kőrösi (9d0833bd), Családi Kikötő (9d7248b2): „Reggeli” = generikus feltöltés → sima rerender.
- Tölgyes (ea9d0041), Olympos (ba60f1c8): „Étterem” a közelben → `--resample`.
- Vilma (28321def): szobaszám 2 („Ebből 2 szoba erkélyes”) vs „3 db … szoba” → `--resample`.
- Tomi Apartman (d36898cc): „Strand” a „város strandjain”-ból → `--resample` (descriptionFactIsOwn).
- Szömörce (fe105370, mockok 67b67db2, bdeef646): „1.–4. szoba” a „Csak egyben adjuk ki” háznál, „Reggeli” a „reggeli kávé”-ból, „Strand” a „Balatonfüred központja, a strandok”-ból → `--resample` (wholeLetOnly + MORNING_ADJ + többes strand). Az éles leaden futtatva: minta = Panoráma, Parkoló, Klíma, Kert, Terasz, Free Wi-Fi; nincs sampleRoomCount.
- Kavics (8302c1f0), Belvárosi (1ec76cb0): „Medence/Szauna/Panoráma” a Várfürdő és a vártorony mondatából → `--resample` (idegen-létesítmény mondat).
- Kalandor (ad440016): csak „Welcome drink” + generikus „Reggeli” → sima rerender.
- Kőrösi alt-szövegek: a saját honlap `<img alt>`-ja (ownSiteImages), NEM fájlnév — koordinátor-döntés: forrásnak számít, nem javítjuk.
- Olympos/Családi Kikötő galéria-cím: kurátori kézi szöveg (copyManual.gallery.title, Poe) — nem generátorhiba.

## Kapcsolat-kép (koordinátor, este)
- Vera 8 leadnél (Germering a5cfe07f, Balaton Panzió 21df1854, Dinasztia b4114d05, Bodza bc58db3a, Admirál fbaef9c8, Kék Madár ab708be5, Szerencsemák 38fa0b7c, Hold utca 3a2c6b88): a Parallax a csomag UTOLSÓ képét tette a kapcsolathoz „<név> környezete” alttal → fürdő/WC. Ugyanez a Fullbleed/Dopamine (photos[3]) és a Dark luxury (utolsó) sablonban.
- Javítás: `contactPhotoOf` (templateKit), render-idejű, a mentett `photos[].subject`-ből. Élesen mérve: 567 érintett-sablonú mockból 276-on fürdő/WC volt, utána 0.
- Deploy után: SIMA rerender elég (nincs --resample): a négy sablon (parallax, fullbleed, dopamine, dark-luxury) minden mockja — `inputs->'recipe'->>'template' in (…)`, 567 db; a rerender determinisztikus, biztonságos.

## Deploy után (koordinátor)
- Dunapart (91ea411d, 79ee68e0), Hosszúhegyi (69d2dab2, 3a41bbf7): `npx tsx scripts/rerender-mock.mts <id>`.
- Hargita (46890f5b, 457540ef), Hotel Garni (bd5cf0d6, 37aa6d95): `npx tsx scripts/rerender-mock.mts <id> --resample`.
- A `--resample` mind a négyen biztonságos (a sima rerender is benne van).

## Nyitott
- A mock SZÖVEGÉBE (író-kimenet) korábban bekerült „étterem” említést a rerender nem javítja; új generáláskor az író tény-listájából kiesik.

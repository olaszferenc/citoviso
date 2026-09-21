# 2026-09-21 — A publikus szoba-kártya és részletek-felugró MEGVALÓSÍTÁSA (ADR-0195)

**Mandátum:** `~/rc-briefs/rooms-card-brief.md` (tulajdonosi utasítás).
**Kontraktus:** `assets/design-refs/tenant-site/rooms-card/README.md` — a §2b kör
lezárult, a tulaj a **B változatot** hagyta jóvá 2026-09-21-én (commit `6514d63`).
**Élesítés NEM volt a feladat.**

## Amit szállítottam

1. **A `note` szétszedése.** `src/tenant/editor.ts` többé nem fűzi egy mondatba a
   leírást és a felszereltséget. A `Room` strukturált mezőket kap
   (`description`, `amenities: {label, icon}[]`, `photos[]`, `slug`, `wholeProperty`),
   a `note` a minta-szobáké és a legacy archetípus-renderelőké marad — azok
   `roomNoteLine()`-t olvasnak, hogy NE veszítsenek szöveget.
2. **Közös kártya-réteg** (`src/engine/templateKit.ts`): `roomShell` (héj +
   `data-cit-room` horgony + valódi `<a href="/apartman/<slug>">`), `roomHint`
   (a képen álló jelvény), `roomDetails` (no-JS `<details>` = a felugró adatforrása).
3. **A felugró a runtime-ban**: `register("rooms", mountRoomDetails)` a `mountGallery`
   mintájára; a meglévő `.cit-lb` lightbox a teljes méretű nézet; rétegzett ESC;
   közös görgetés-zár (`syncScrollLock`).
4. **Horgony mind a 19 sablonban** (12 saját + 7 közös tartalék), őrrel védve.
5. **Egy predikátum a thin-content kapura** (`unitPageIsWorthWriting`) — az aloldal-író
   és a kártya link-döntése ugyanazt olvassa, így kártya nem mutathat 404-re.

## Mérés

- **`scripts/room-details-check.mts`** (ÚJ, bekötve a `hooks/pre-commit`-be,
  diff-scope-olva): **38 mérés · 114 kártya · 114 horgony**, zöld.
  Negatív önteszt: **kontroll zöld + 7 visszarontás mind pirosra viszi.**
- **`scripts/room-card-overflow-check.mts`** (meglévő, idegen): **114 mérés · 342
  kártya**, zöld. A fixture-je `note` helyett `description`-t használ, különben olyan
  szöveget tűzött volna ki, amit egyetlen sablon sem rendel többé.
- `contract-drift-check`: **7 kötő felirat** él a kódban (a README §6 megjelölve).
- `guard-wiring-check`, `i18n-lint`, `design-token-lint`, `tsc --noEmit`: zöld.
- i18n-katalógus frissítve (6 új kulcs).

## Öt saját hiba, mind mérésből

1. ⛔ **A CSS forrás-sorrendje.** Az asztali `@container` blokkomat a bázisszabályok ELÉ
   tettem, ezért a bázis felülírta: a lap 1280 px-en a mobil elrendezést kapta, és
   9 felszereltségből **2** látszott. A szabály helyesen olvasódott és semmit nem csinált.
2. ⛔ **Pixel-költségvetést hangoltam, nem szabályt.** A fix galéria-magasság artdeco-n
   átment, három másik sablonon megbukott — a felugró a SKIN betűit viseli. A javítás
   szerkezeti: a tények kapják a helyet, a kép veszi, ami marad.
3. ⛔ **A saját mérőm két álbukást gyártott:** a hálózat-tiltásom `net::ERR_FAILED`-jét
   „JS-hibának" olvasta, a nyers sztring-illesztés pedig 3 hamis leletet adott a
   csupa-nagybetűs sablonokon (`innerText` a MEGJELENÍTETT szöveget adja).
4. ⛔ **Két visszarontásom nem vitt pirosra** — az egyik már nem létező mechanizmust
   célzott, a másik gyengébb volt a javításnál. Amíg egy visszarontás nem reprodukálja
   a hibát, az állítás bizonyítatlan.
5. ⛔⛔ **A kártya összezsugorodását egy IDEGEN őr fogta meg.** A kattintható héj egyetlen
   flex-elemmé fogta a kártya tartalmát, és egy `align-items:flex-start` rácsban a szoba
   fotója teljes szélességűről **75×50 px-re** esett össze. Az én kapum ezt nem kérdezte
   meg — most megkérdezi (`a-burkolo-osszezsugoritotta-a-kartyat`).

## Egy NEM keresett lelet

Az `aurora` sablon `body>*:not(.au-aurora):not(.au-nav){position:relative}` szabálya
(0,2,1) leütötte a felugró `position:fixed`-jét: az overlay **4029 px-re lent, nulla
magassággal** nyílt. ⚠️ **Ugyanez a szabály a MÁR MEGLÉVŐ nagykép-lightboxot is érintette,
csendben, eddig is** — vagyis aurora-sablonos élő oldalon a galéria-nagyítás is a
dokumentum közepén nyílt. Mindkét réteg pozíciója most `!important`, kimondott indokkal.

## Módosított / létrehozott fájlok

- `src/engine/recipe.ts` — `RoomAmenity`, a bővített `Room`, `roomNoteLine()`
- `src/engine/templateKit.ts` — `roomPhotos`, `roomHint`, `roomShell`, `roomDetails`
- `src/engine/moduleSections.ts` — a közös tartalék `roomsBlock` (1 és N egység)
- `src/engine/primitives.ts` — 4 legacy renderelő `roomNoteLine()`-ra
- `src/engine/templates/` — 12 fájl (artdeco, aurora, cinematic, claymorphism,
  horizontal, organic, scrapbook, transit, watercolor, archFrames, tiltedGallery,
  wordmarkGrow)
- `src/tenant/editor.ts` — a szétszedés + `unitPageIsWorthWriting()`
- `src/tenant/multilangCore.ts` — `description` + `amenities[].label` fordítása
- `assets/runtime/cit-runtime.js` — `register("rooms")`, `syncScrollLock`
- `assets/runtime/cit-modules.css` — a felugró, a jelvény, a `<details>` stílusai
- `scripts/room-details-check.mts` — ÚJ őr
- `scripts/room-card-overflow-check.mts` — a fixture igazítása
- `hooks/pre-commit` — az új őr bekötése
- `assets/design-refs/tenant-site/rooms-card/README.md` — §6 kötő feliratok + Hatókör
- `_planning/DECISIONS.md` — ADR-0195
- `src/i18n/catalog.json` — 6 új kulcs

## Nyitott kérdések

1. ⏳ **NÉGY SABLON A TULAJ DÖNTÉSÉRE VÁR** (`arch-frames`, `tilted-gallery`,
   `wordmark-grow`, `transit`). Ezek kártyája se leírás-sort, se Foglalás gombot nem
   ismert; a kontraktus szó szerint nem valósítható meg rajtuk. A szállított „A"
   változat: a KÉPEN álló jelvény az egyetlen belépő, a sablon rajza marad. A képeket
   megkapta. A „B" mind a négyet az artdeco-szerű kártyára rajzolná át.
2. ⏳ **Az ár-sor alakja.** A tulaj a „minimumtól" formát vetette fel; ma a kártya a
   teljes SÁVOT mutatja, mert az Elek FK-007 mérés szerint a mai nap ára ellentmondott
   az ár-táblázatnak ÉS a foglaló-widgetnek egy képernyőn. Külön kör, külön mérés.
3. ⏳ Az **admin** szoba-szerkesztő külön §2b kört kér (a kontraktus §5 kiveszi).
4. ⏳ A felugró interakciójának mérése ma a FIXTURE-ön fut; élő tenant-lapon
   (Elek-forgatókönyv) még nincs végigkattintva.

# 2026-11-25 — Kép nélküli és kevés képes lead: településkép-tár (megvalósítás, `cit561ec018`)

Brief: `~/rc-briefs/kepnelkuli-hero-megvalositas-20261125.md` · koordinátor: `cit9b4690e3` · ADR-0479 · terv: `assets/design-refs/console/kepnelkuli-hero/` (befagyasztva, README a kontraktussal)

## Elvégzett munka
- **Választó** (`src/media/townPick.ts`, v3): Commons-jelöltek (település → a környék tájképe csak kevés hero esetén, csak a saját országból → régió). Egy CLIP-beágyazás képenként. Laza küszöb, igen/nem kérdések: kültér, tágas kép, látkép, sportpálya, nappal, feliratos homlokzat, egyetlen ház közelről, felülnézet (csak hero), fényesség és üres ég (rangsor). GPS ≤15 km, fájlnév-tiltások. Kimenet: 3–6 hero, 4–6 helyi galériakép, stílus.
- **Tár** (`migrations/0153_town_photo_set.sql`, `src/media/townPhotoSet.ts`): e-mail-kapu, szétosztás (i mod n hero, forgatott galéria, majdnem azonos képek nélkül). **Just-in-time gyűjtés a mock előtt** (`generator/townHero.ts`); előre futtatott pótlás nincs (tulaj). Karbantartás: `scripts/town-photo-sets.mts --rescreen/--restyle`.
- **Lap** (`engine/render.ts`, `engine/stock.ts`, `engine/templateKit.ts`): település-hero kevés saját képnél is; helyi galéria; 3 MINTA-szobakártya; galéria 12 képig; helyi kép a sávokban; MINTA-jelvény és forráslista; a cím ikon-karakterei (PUA) kikerülnek.
- **Kapuk:**
  - `mockPhotoGate`: `DISPATCH_PHOTOS_OK_SQL` és `MOCK_TOWN_PICK_OK_SQL`; a tulaj kapcsolója `town_photo_dispatch`, alapból KI.
  - `mockRenderGate` v11: minta csak jelölve, galéria- vagy szobahelyen; település-képek újraítélése a 330 px-es bemeneten; település-oldalon mobilon betöltött hero és legalább 12 kép.
  - A kiküldő út (`sendBatch`, `autoDispatch`, `approvalQueue`, `qa-review`) erre a szabályra állt át.
- **Őrök:** `scripts/town-photo-check.mts` (pre-commit); a `qa-review-check` új sora: kikapcsolt kapcsolónál a <5 képes ág zárva.
- **Stílusos szobatár** (`scripts/stock-rooms-build.mts` → `src/engine/stockRooms.json` + `public/assets/stock/styled/`): 53 SAJÁT KISZOLGÁLÁSÚ kép (Commons + Rawpixel CC0), az éles képszűrőn és a régi táron is átszűrve; Flickr nincs (koordinátor: nincs kapu-kivétel).

## Mérés (dev DB, $0)
- 52 település (első kör): 49 saját kép, 3 környék, 0 semmi; 65 s/település → gyorsítva 32 s/település (3 párhuzamos, nice).
- Vak 20 (v2): 7 jó, 10 gyenge, 3 rossz. A rosszak közös oka „egyetlen ház, tető vagy szerkezet közelről” → ebből lett a v3-szabály. Vak 20 (v3, just-in-time): 7 jó, 7 gyenge, 2 rossz (vasúti épület; egyetlen tető, határeset), 4 lapot a kapu visszatartott (kép nélkül, illetve kevesebb mint 12 kép). Vak 20 (v4): 7 jó, 6 gyenge, 0 rossz; 5 visszatartva (3 üres nyitókép, 2 címsor-sortörés). Vak 20 (v5): 8 jó, 7 gyenge, 2 rossz, 1 visszatartva — a cél (0 rossz, ≤3 gyenge) még nincs meg.

## v6 — végső bíró
- `src/media/townJudge.ts`: a CLIP legjobb 6 jelöltjét egy előfizetéses `claude -p` képes ítélet bírálja, csak a „jó” lehet hero. 5. vak kör: 13 lead → 7 kimenő (0 rossz), 6 kiesik (46%).

## Nyitott
- Döntés („a”, 2026-11-26): a válogatás a Debianon fut a lánc lépéseként (`scripts/town-photo-gather.mts`, `CIT_DB=prod|dev`); az éles generátor csak olvas. Átállás: `~/rc-briefs/uj-lanc-hr/atallas-telepkep.sh go`, a HR-élesítéssel együtt, a tulaj szavára (előfeltétel: 0153 élesen). Dev teljes kör igazolva (kontakt → válogatás → mock → kapu).
- A `town_photo_dispatch` kapcsolót a tulaj nyitja. Élesítés csak az ő kérésére.
- A szobatár bővítése (Pexels: a kereső Cloudflare-ellenőrzést ad, saját böngészőprofilos kolléga kell).
- Fakóság-padló a hero-ra (a v4 gyengéinek fele szürke, párás), vak újraméréssel.
- Openverse Flickr-ág a szobatárhoz: a Flickr CDN szerveroldali letöltésre 403-at ad, a render-kapunak kivétel kellene (döntés).
- A „gyenge” kategória (fakó, borús, túl sok ég, sima erdő): a jobb jelölt sokszor nincs meg a Commonsban. Új jelölt-forrás kellene (pl. Wikivoyage banner, a szomszéd település nevezetessége), szabályként.

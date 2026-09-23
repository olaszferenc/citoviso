## ADR-0074 — Felszereltség-katalógus és -választó (F terv): 70 standard tétel, címke-tárolás, hatókör-szabály, rooms+amenities párosítás

- **Dátum:** 2026-08-26 · **Státusz:** ELFOGADVA, implementálva lokálban · **Kapcsolódó:**
  ADR-0059 (unit-elsődleges felszereltség), ADR-0036/0067 (i18n), ADR-0044 (modul-beállítások),
  ADR-0033/0072 (fizetés-kapuk). **Terv-kontraktus:** `assets/design-refs/tenant-admin/amenity-picker-f*.html`
  (tulaj-jóváhagyás 2026-08-26: „Kombináció — E feje + D teste").
- **Tulaj-kérés (szó szerint):** „Legyen standardizáltan választható ikonokkal reprezentált. […]
  tegyél bele minél több választhatót. Nyilván figyelni kell továbbra is, hogy fordítható legyen;
  nyelvi poolból vegye a szavakat." + korábbról: felszereltség „szállás egésze + unitonként".

**Döntések.**
1. **Katalógus:** 70 tétel, 10 kategória, tételenként saját inline SVG (nincs emoji, §B) —
   `src/tenant/amenityCatalog.ts`. Az `id` angol slug (kód-nyelv rendelet), de SOSEM tárolódik.
2. **A TÁROLT ÉRTÉK A MAGYAR CÍMKE, nem az id** — szándékosan. A meglévő csatornák (amenities
   modul-config `items`, `site_unit.amenities`) tulaj-szövegezésű stringeket tartanak, és a
   multilang-út a tartalom-stringet fordítja. A címke-tárolással minden meglévő sor, a vendég-oldali
   render és a fordítási út ÉRINTETLEN (nincs migráció); az admin-felület a címkét `T()`-n át
   fordítja — a címke MAGA az i18n-kulcs (a katalógus-fájl a `extract-i18n` DATA_FILES listáján).
   A picker tehát UI-réteg a mai adat fölött, nem új adatcsatorna (ADR-0059 „beszövés" elv).
3. **Hatókör (scope) tétel-szinten:** `property` (medence, stég, recepció…) / `unit` (saját
   fürdőszoba, erkély, kiságy…) / `both` (wifi, TV, klíma…). A szoba-képernyő unit+both-t kínál,
   a szállás-képernyő property+both-t. ⛔ A szabály a MENTÉSEN is él (`composeAmenities`): a
   hamisított vagy Egyéb-mezőn át becsempészett rossz-hatókörű címke KIESIK — az őr találta meg,
   hogy az Egyéb mező kerülőút volt.
4. **Öröklés:** a szállás-szintű kiválasztás a szoba-kártyán szürke, szaggatott, NEM kapcsolható
   csempeként látszik („az egész szállásra") — a tulaj látja a teljes képet, de nem duplázhat.
5. **Jogosultság (tulaj-döntés):** a szobánkénti felszereltség szerkesztéséhez a `rooms` ÉS az
   `amenities` modul EGYÜTT kell. Modul nélkül a kártya KONVERZIÓS PANELT mutat (ajánlat + halvány
   valódi csempék + ár), nem hibaüzenetet. **Mellék-javítás:** a `POST /admin/units/content` volt
   az EGYETLEN unit-hatókörű mentés modul-kapu nélkül (a link rejtve volt, a közvetlen POST írt) —
   most rooms-kapu a művelet szintjén; a felszereltség-írás amenities-kapu mögött; hiányzó
   picker-mezőknél a tárolt lista érintetlen (a locked-kártya mentése nem törölhet).

**Őr:** `scripts/amenity-picker-check.mts` (pre-commit): compose-hatókör + kerekasztal-kör
(split→compose veszteségmentes) + renderelt felület (bejelölt állapot, örökölt csempe input nélkül,
locked-panel nulla inputtal, EGY űrlap) + route-alak. Piros önteszt (`--self-test`). Élő E2E kör
lefutott: kattintás → mentés → visszaolvasás, az Egyéb-mezős „Medence"-csempészés kiesett.

**Visszafordíthatóság:** 🔄 — a tár változatlan; a picker levételével a régi textarea
visszatehető, adatvesztés nélkül.

**Nyitott.** ① ✅ KÉSZ (2026-08-27, tulaj-utasításra): vendég-oldali ikonos megjelenítés —
`src/engine/amenityIcon.ts` resolver (pontos katalógus-match → magyar kulcsszó-illesztő →
semleges pipa), bekötve a modul-blokkba (`moduleSections.listBlock`), a `featuresAmenities`
primitívbe ÉS mind a 16 sablon saját highlight-szekciójába (a közvetlen `matchIcon`-hívások
lecserélve). Fordított oldalon a `SiteData.amenityIconMap` híd viszi át az ikont: az
`applyTranslationMap` a fordítás pillanatában (amikor forrás és fordítás együtt van) rögzíti a
fordított-címke → katalógus-id párokat — német címke alatt is a saját ikon áll (őr méri).
② A KB-screenshot magassága vágta a pickert → elem-szintű felvétel (picker.png) megoldotta.
③ A kategória/tétel-készlet bővítése tulaj-kérésre (a katalógus additív) — továbbra is nyitott.

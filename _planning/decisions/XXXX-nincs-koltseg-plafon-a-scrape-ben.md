## ADR-XXXX — Nincs költség-plafon a scrape-ben: a Details-keret figyelmeztet, a cap igazul van felcímkézve; booking.com kihagyva, hovamenjek fullHd (2026-10-02)

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (SUB „F rész”, koordinátor: CIT „Places API 600 $” fő session; brief:
`~/rc-briefs/places-f-nincs-cap-es-portal-gyorsitas.md`) · **Kapcsolódó:** ADR-0294 (mellékleletek a/b), ADR-0295 ③
(Details-keret), ADR-0296 (a cap a dúsítás UTÁN vág).

**Tulajdonosi döntés (2026-10-02):** „Nincsen cap. Saját magunkat korlátozzuk be.” — nem akarunk költség-plafont,
ami megállítja a munkát; a B-SUB két gyorsítása mehet („3. Ok”).

**Döntés.**
1. **A `--cap` igaz felirata.** A konzol Scrape-űrlapja azt állította, hogy a cap „korlátozza” a Google Places-költséget.
   Hamis: a cap a dúsítás UTÁN vág (`run.ts`), addigra minden új szereplő adatát lekérte a futás. A felirat most azt
   mondja, amit tesz: a mentett ÚJ leadek számát vágja (a kontaktálhatók elöl), a Places-költséget nem csökkenti. A KB
   (`console-scrape`) két helyen ugyanígy javítva (a „megszakadt” résznél is a cap-re hivatkozott költség-fékként); a
   két súgó-kép újragyártva. A mező neve („Cap”) és helye változatlan — elrendezés nem változott.
2. **`PLACES_DETAILS_MAX_CALLS` → figyelmeztetési szint, nem plafon.** A Google-forrás minden új place id-ra lekéri az
   adatlapot; ha a futás hívásszáma a szint fölött van (`PLACES_DETAILS_WARN_CALLS`, a régi név is él, alap 4 000 ≈ 80 $),
   HANGOS figyelmeztetés megy a naplóba ÉS a futás statjába (`scrape_run.stats.warnings`) — előre, a hívások előtt,
   mert a szám akkor már ismert. A forrás-interfész új, opcionális `warnings()`-a hordozza; a konzol a lefutott futás
   sora alatt mutatja (ugyanaz a sor, ahol a hibaüzenet áll). A felderítő bejárás `PLACES_DISCOVERY_MAX_CALLS`
   kerete (ingyenes ID-hívások, lefedettség-korlát) változatlan, de a figyelmeztetése szintén a statba kerül.
3. **booking.com = `challenge_protected`.** A meglévő registry-mechanizmus (szallas.hu óta): a jelölt-gyűjtés
   eldobja, a beolvasás le sem kéri, és a felszabadult jelölt-helyre más portál jöhet. Mérve: AWS WAF-kihívás
   (HTTP 202, ~4 KB, adat nélkül) — 2026-10-01: 6/6, 2026-10-02: 2/2 minta; dev-parkon 486 jelöltből 40 (8%),
   ~1,3 s/URL soros olvasással → élesen a ~426 URL ≈ 9 perc egy szálon. Nyílt iker-domain nincs.
4. **hovamenjek: `main` helyett `fullHd`, NEM cache.** A brief képméret-cache-t kért; a mérés mást mutatott:
   egy futáson belül a kép-URL-ek 99%-a egyedi (317/321), így a cache az első teljes körön semmit nem gyorsítana, és
   egy újraolvasást átélő cache tartós tárolót kívánna (tulaj-döntés). A valódi ok: a `largestPhotoUrl` a `main`
   változatra írt át, ami csak a NEVES fájloknál létezik — a számozottaknál 404, és a 404 lassú (0,35–0,9 s, a 200
   ~0,2 s). A lap lightbox-a (`data-src`) minden galériaképhez `fullHd`-t nevez meg (1080 px hosszú él), ami nevesre
   és számozottra egyaránt 206. Az átírás célja ezért `fullHd`; a próba + visszaesés az eredetire változatlan.

**Mérés (dev-park, 40 véletlen lead, valódi portál-olvasás, két váltott futás-pár).**
| | előtte | utána |
|---|---|---|
| hovamenjek kép-kérés / ebből 404 | 298–306 / 140–151 | 170 / **0** |
| hovamenjek kérés-idő (párhuzamos kérések összege) | 146–186 s | 59–70 s |
| portál-fotó / ebből ≥ 800 px | 593–597 / 351 | 842–843 / **654** |
| wall-idő (40 lead, 4-es párhuzamosság) | 49–52 s | 52–54 s |
A wall-idő a dev-mintán NEM változott: ott nem a hovamenjek és nem a booking.com a padló.

**Mérés (ÉLES minta: 40 véletlen éles lead, a lead-adat olvasva, a portál-olvasás lokálisan, DB-írás nélkül; két pár).**
| | előtte | utána |
|---|---|---|
| wall-idő (40 lead) | 98,2 s / 63,8 s | **49,3 s / 49,5 s** (átlag −39%) |
| hovamenjek kép-kérés / kérés-idő | 240 / 124 s | 178 / 56–67 s |
| booking.com olvasás (ablak) | 10–18 kérés, ~46–59 s ablak | 0 |
| portál-fotó / ebből ≥ 800 px | 437–439 / 230–232 | 488–490 / **340** |
Az éles mintán az „előtte” padló a booking.com soros sora volt (59 s-os ablak), utána a hovamenjek (~44 s). Teljes
parkra vetítve (1,24 s/lead × 1 057) ~22 perc — az ADR-0294 78 perces modelljét a régi kóddal ma sem sikerült
reprodukálni (1,6–2,5 s/lead → 28–43 perc), tehát a 78 → 40 perces cél a mai hálózati viszonyok mellett már teljesül.
A mellékhatás viszont nagy: a hovamenjek galériája 574 px helyett 1080 px-ben jön, így átmegy a 800 px-es küszöbön
(a ≥ 800 px-es portál-fotók száma a mintán +86%).

**Őr.** `scripts/scrape-coverage-check.mts` ⑧ (szint 5 mellett 180 új hely → 180 adatlap + figyelmeztetés; szint alatt
csend) — mutáció: a régi `slice` → 6 állítás piros. `scripts/portal-uncapped-check.mts` 4. (booking.com nem olvasódik, a
mellette álló nyitott adatlap igen; pre-commit trigger a `portals/registry.ts`-re is) — mutáció: `access: "open"` → piros.
`scripts/photo-quality-check.mts` (a `largestPhotoUrl` → `fullHd`, a tárolt `main` URL is átíródik).

**Visszafordíthatóság:** 🔄 olcsó (felirat, egy konstans jelentése, két registry-sor).
**Elvetett:** kép-méret-cache (lásd 4.); a Details-plafon megtartása magasabb értékkel (a tulaj nem akar plafont).

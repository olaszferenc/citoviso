## ADR-0235 — A vendég telefonon: érintési-cél, rétegzés és tisztás-doktrína a mock-motorban (FK-010)

**Dátum:** 2026-09-26 · **Státusz:** elfogadva (lokál, nem élesítve) · **Szál:** „Mobil · Elek a VENDÉG szemével”

### Kontextus

A tulaj (2026-09-26): *„a wow effekt eléréséhez nagyon fontos, hogy a mobilnézet hibátlan legyen”*, és *„remélem ha van hiba akkor annak javítása a mock motorban történik”*. A két dev-lead (Ifjúsági Szállás Tihany, Laguna Panzió) 19+19 mockját mértük egy VALÓDI telefon-kontextusban (touch + mobil-flag, 390×844, 360×780, fekvő 844×390), a vendég útján végig: első képernyő → szoba-felugró → galéria-nagyító → naptár → hibás dátum → minta-küldés → vélemény. A gépi mérés (`scripts/guest-mobile-check.mts`) 38 lapon 132 HIBA-szintű leletet adott az első körben — a nagy része a KÖZÖS rétegben (runtime CSS/JS), a többi 4–5 sablonban.

### Döntés

1. **Érintési cél ≥ 44×44 px** minden vezérlőn, amit a vendég ujjal nyom (naptár-léptető, vendégszám ±, felugró és nagyító X és lapozó, szoba „Részletek”/„Foglalás”, ár-fül, masthead „Foglalás”). Kivétel: a naptár nap-cellái (7 oszlop 262 px-ben → ≥ 36 px a padló) és a folyó szövegben álló link (ergonómiai lelet, nem hiba).
2. **Mező-betű ≥ 16 px telefonon** (`≤ 559 px`): különben iOS a fókuszra az egész lapot nagyítja. A runtime CSS a lap VÉGÉN, forrás-sorrendben az alap-szabály UTÁN mondja ki.
3. **Az átfedő rétegek (szoba-felugró, nagyító) NEM alkudhatók:** `position`, `inset` ÉS `z-index` is `!important` a runtime CSS-ben. Mérve: az aurora `body>*:not(.au-aurora):not(.au-nav){z-index:1}` szabálya a felugró z-indexét 1-re írta, a fejléc (z 100) és a mobil-sáv (z 120) a felugró X-e FÖLÉ került — a vendég nem tudta bezárni.
4. **Tisztás a tapadó sáv alatt:** a runtime a betöltéskor és átméretezéskor megméri a felül ülő fixed/sticky sávokat (a görgetésre megjelenő, opacity:0-ról induló app-bar-t IS, top ≤ 20 px), és `--cit-stick`-be írja; minden `[id]`, `[data-cit-module]` és a nyugta `scroll-margin-top`-ja ebből jön — az ugrás célja és a küldés utáni nyugta címe nem bújik a sáv alá.
5. **Közös gomb-stílus fallback:** a `.cit-btn` (vélemény-küldő, CTA-sáv linkje) a runtime `cit-fallback` rétegében kap gomb-ruhát — 4 sablon (arch-frames, claymorphism, tilted-gallery, wordmark-grow) sosem stílusozta, 21 px-es nyers gomb volt a vendég „küldés”-e. A sablon saját, rétegen kívüli szabálya változatlanul nyer.
6. **A lap nem lehet szélesebb a készüléknél** (a mobil böngésző kicsinyít): a hero Ken Burns-hátterét a hero vágja, rács-oszlop `minmax(0,1fr)` + `min-width:0`, a flex-elem `min-width:0`, a nowrap jelvény tördelhető. Sablon-szintű javítások: cinematic (hero-margó, alsor, foglalás-kártya a hero ALATT), artdeco (poszter-cím telefonon kisebb + elválasztás), brutalism (`hyphens:auto` a `overflow-wrap:anywhere` előtt), transit (a szoba-táblázat telefonon kártyaként), card-sidebar és editorial-press archetípus.
7. **Őr:** `scripts/guest-mobile-check.mts` — kapu-módban minden sablon + archetípus 390 px-en (touch-kontextus), a fenti ①–⑨ szabályokkal; HIBA bukik, ERGONÓMIA csak `--strict`-tel. **Negatív kontroll:** `--selftest` — ültetett hibák (réteg a sáv alatt, 20 px-es vezérlők, készüléknél szélesebb lap, halott hónap-léptető) mind pirosat adnak, a tiszta lap zöld. A pre-commit a runtime/sablon/archetípus/moduleSections/templateKit érintésekor futtatja. ⚠️ A kapu-módú render `page.reload()`-dal a `setContent` lapot `about:blank`-ra töltötte volna — a ⑦⑧⑨ próbák NÉMÁN nem futottak; az önteszt fogta meg, ezért van.
8. **Elek forgatókönyv:** `FK-010-guest-mobile-mock.md` (`felület: fájl`, `nézet: telefon`), a runner telefon-kontextusban futtatja a kattintásokat, a 390-es kép az ELSŐDLEGES, fekvő (844×390) és asztali a másodlagos; `elek/bin/run-guest-mobile.mts` a 19 stílus × 2 lead mátrixot vezényli (`ELEK_RUN_TAG`, dátumok a minta-foglaltság szabályából).

### Kiegészítés (2026-09-26, tulajdonosi mandátum: „javaslat szerint … saját belátásuk szerint … utólag ellenőrzök”)

9. **A foglalás-widget telefonon KÉT LÉPÉS („B”, a tulaj választása):** 1) naptár + dátum-sáv + a widget saját állapot-mondatának tükre a dátum-sáv ALATT + ár + egy „Tovább” gomb (állapot-feliratú, ≥ 44 px); 2) összegző sáv (időszak · éj · ár vagy „egyedi ár” · „Módosítom a napokat”) + mezők + küldő gomb. Csak `≤ 559 px`-en; asztalon a kéthasábos kártya változatlan. Kontraktus: `assets/design-refs/tenant-site/booking-mobile-two-step/README.md` (+ `plan.html` a valódi runtime-on, `shots/`). Az őr méri (⑥két-lépés), negatív kontroll: rejtett „Tovább” → piros. Mérve: a hibaüzenet 20 px-re a dátum-sávtól (volt ~750), az összegző és a küldő gomb egy lépésben.
10. **arch-frames, wordmark-grow telefonon:** a „Foglalás” pirula és a menülinkek az első képernyőn, a sablon hangján (kiskapitális / szómárka), két csendes sorban; a fotó-nyitány érintetlen. (A `.a-nav a` / `.w-nav a` szabály a pirula színét is felülírta — láthatatlan felirat — külön szabály védi.)
11. **A minta-egység felugrója NEM üres:** a minta-szobák illusztratív leírást és 3–4 generikus felszereltséget kapnak, a felugró feje „MINTA · Apartman”, a lista címe „Minta-felszereltség — az éles oldalon az Ön tényleges listája kerül ide”; kemény tény (szám, m², ár) SEHOL (§B.17, ADR-0061). A katalógus-ikonok 20 px-esek (méret nélkül 120 px-esre nőttek).
12. **editorial tapadó menü:** telefonon egy görgethető sor (a tördelt 44 px-es pillérek 97–138 px-es sávot adtak).

### Következmény

A mock-*.html fájlok KIMENETEK: a bizonyíték a javított motorból újrarenderelt lap (a két lead 38 mockja újrarenderelve: 132 → 0 HIBA 390 px-en). Az élő mockok a következő generáláskor/újrarenderkor kapják meg; a Villa Suzy-féle régebbi mockok is.

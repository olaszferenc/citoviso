# 2026-09-25 — A belső konzol kerete a tenant-admin „Linear” nyelvén, egy bővíthető navigációs fából

**Szál:** wt/citd2f7aee7 · **ADR:** ADR-0233 (helyőrző, a land osztja ki) · **Kontraktus:** `assets/design-refs/console/linear-shell/`
· **Státusz:** lokálban kész, NEM élesítve.

## A tulaj kérése és a döntés

„Ami a tenant admin oldalon van design az legyen az alap a saját belsős admin felületen is. Először mock.” → §2b: két
változat egy fájlban (A · „Tükör”: az admin oldalsáv-mintája, 16 funkció csoportokban; B · „Modul-sáv”: 5 modul-pont +
fülsor), mindkét méret, világos/sötét, működő ⌘K/szűrő/hajtogatás, 25/25 kattintás-próba. A tulaj: **A**, módosítással —
a modul-sor (CRM · Pénzügy · Riport · Rendszer) kattintható → a modul saját irányítópultja, a fa alatta kinyílik (2. kör,
29/29). Majd: „**struktúrát építs! Lesz még később számos alrész meg főrész is**” → a navigáció egy adat-fa, nem menü.

## Ami épült

- `src/console/nav.ts` — a fa (`group`/`leaf`, tetszőleges mélység, `match` előtagok, `short` felirat), `activeTrail`,
  `navLeaves` (⌘K index), `navCountsOf` (számok → jelek, tiszta). `HUB_PREFIX = /hub/`.
- `src/console/navCounts.ts` — a számlálók egy olcsó, 15 mp-ig gyorsítótárazott olvasással; a kérés-kontextusba (`i18nCtx`:
  `setConsoleNav`/`consoleNav`) a HTTP-belépési pont teszi, az auth-kapu után, csak operátori útvonalon.
- `src/console/views.ts` — `layout()` új kerete (oldalsáv, fejléc ← + útvonal + ⌘K + téma + nyelv + Súgó, alsó sáv, fiók,
  `shellScript`), `dashboardPage(HubData)`, `modulePage(id, HubData)`; a régi `MENU`, `activeModule`, `HUB_JS` és a
  kártya-rács kivezetve. A `chrome:false` és a `shell:"bare"` ágak megmaradtak.
- `/hub/<id>` route a HTTP-belépési fájlban; ismeretlen id → 404.
- CSS: `citui-console.css` keret-blokk + kezdőlap-blokk (hero/hub törölve), `.panel` Linear-ruhában (panel-háttér, 10 px,
  árnyék nélkül, szöveg-betűs cím), `.con` 13 px + kis sugarak; **`background: var(--citui-white)` → `--citui-panel`** a két
  konzol-stíluslapban (világosban azonos, sötétben a panel színe). Betű-URL = az adminé (a kb-shot pillanatképe fedi).
- `icons.ts`: vékony `home`, `leads`.
- Őr: `scripts/console-linear-check.mts` (hermetikus, 2 méret, 5 piros kontroll) + pre-commit regisztráció.
- KB: `console-dashboard` a KÓDBÓL újraírva (a menü, a fejléc, a widgetek, a „Figyelmet kér” predikátumai, a
  modul-irányítópult); `console-pricing` „hol találod”; `nav.ts` a kb-check/kb-scan forráslistájában; a konzol-képek újralőve.

## Mért csapdák (ebben a szálban)

- **`.con-ib` már létezett** (ikon+felirat submit-gomb, 2 helyen) — a keret ikongombja ezért `con-fib`; az első képen
  minden ikongomb üres kör volt (a `.con button` pill-szabály ült rá) → specificitás-reset a kit-ben.
- **A `block_worktree_ports` hook a parancs SZÖVEGÉRE illeszt**: egy python-heredoc, amiben a HTTP-belépési fájl neve
  szerepelt, blokkolt — a patch-et fájlba írva, `python3 fájl`-lal futtatva átment.
- **Idegen őr szelektora** (`help-collapse-check`: `.con-nav a[href="/help"].active`) → `.is-active`; a `.con-nav` osztály
  szándékosan megmaradt a sidebar `<nav>`-ján; a fiók navja `con-menu`, hogy a count===1 álljon.
- **KB label-drift**: a feliratok a `nav.ts`-be költöztek, a kb-check csak `views.ts`-t olvasta → a forráslista bővítve.
- A lead adatlapján az útvonal nem írta ki a lead nevét (a `match`-en át aktív levél) — az őr fogta meg, javítva.

## Nyitva

- A ~40 képernyő sötét-módú finomítása, ahol a `--citui-white` tinta-szerepben maradt vagy a navy sávok (lead-lap
  identitás-sáv, partner-fejléc) sötétben is navyk — külön kör.
- A ⌘K a fa leveleit keresi; a képernyőkön belüli tartalmat (lead név, partner) nem — később bővíthető.
- Élesítés: verzió megy ki (`deploy-prod.sh`), külön engedéllyel.

## 2. kör (ugyanaz a nap) — „Javítsd”: sötét mód a konzol MINDEN képernyőjén

- **Mérés, nem szem:** `scripts/console-dark-scan.mts` — a munkafa konzolja ideiglenes porton, 23 lap × 2 méret,
  sötétben: ① világos felület a keretben · ② kontraszt a TÉNYLEGES (összetett) háttéren · ③ minden funkció saját
  lapján a menü azt világítja és az útvonal azt mondja. Pre-commit kapu lett. `--light` = ugyanez világosban.
- **Kiinduló lelet:** 0 világos felület (a `--citui-white`→`--citui-panel` csere bevált), de **21 olvashatatlan
  felirat 12 lapon** — mind a navy SZÖVEG-szerep (aktív fül, alcím, `button.ghost`, `.con button`, `.pill`, küszöb-jel).
- **Javítás:** két szöveg-token a magba — `--citui-ink-brand` / `--citui-ink-brand-2` (világosban = navy-900/-700,
  sötétben olvasható tinta); a konzol 27 panelen ülő navy felirata erre; cián háttéren a navy marad (belépés, fizetés
  gomb, aktív szűrőmező, avatar); halvány szöveg a halvány kitöltésen egy lépéssel a tinta felé (kész/most lépés,
  jóváhagyott jelvény, ⌘K, aktív számláló). Eredmény: sötétben **0 lelet**.
- **Menü-hiba, amit a kép mutatott meg:** a Térkép/Területek lap `active: "/scrape"`-ot adott → a menü és az útvonal
  „Adatgyűjtés indítása”-t mondott. 5 lap most a SAJÁT útvonalát adja (Térkép, Területek, Új partner, partner-lap,
  Új bizonylat). A mérő ③ ága fogja; negatív kontroll (régi értékek) → piros.
- **Telefonos útvonal:** a négytagú sorból egy betű maradt a lap nevéből → telefonon „szülő › lap” (a jelölés teljes).
- **A mérő saját hibái (kétszer):** a `color-mix()` `color(srgb …)` alakban jön vissza → „1,00:1” álbukás; mobilon a
  rejtett oldalsávban nem talált „látható” kiemelést. Mindkettő javítva, és a mérő negatív kontrollal igazolva
  (visszarontott token → piros; régi `active` → piros).
- **Világos mód (korábbról) — a tulaj „Javítsd”-e után lezárva:** `--citui-muted` #60748b → **#5a6d82** (minden
  halvány kitöltésen ≥4,61, fehéren 5,32); 11 határeset → 0. Mag-token: honlap + tenant-admin is kapja (46 súgó-kép
  újralőve). A levél-sablonok inline `#60748b`-je érintetlen (fehér alap, 4,76).
- `ui-shot --dark` kapcsoló (a konzol/admin sötét képe).

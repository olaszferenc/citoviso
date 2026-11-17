## ADR-XXXX — Ország-réteg 3/6: a mock a lead országának nyelvén, írásával és szabályaival készül — magyar maradvány = TARTVA

**Státusz:** ELFOGADVA (tulaj 2026-11-17, „mehet a mock generálás”; brief `orszag-reteg-3f-mock-nyelv-20261117.md`, koordinátor `cit9b4690e3`) ·
**Épít:** ADR-0437 (ország-réteg), ADR-0450/0452 (felületek, `tourist_tax_model`), ADR-0455 (CRM), ADR-0456 (kiküldés: `untranslated`-mérés, „Bábelre vár”), ADR-0036/0412 (nyelvi csomag, csak Bábel fordít), ADR-0329 (kurátori út) ·
**Forrás:** `_planning/RESEARCH-2026-11-11-orszag-reteg-diagnosztika.md` 2. és 3. szakasz.

### Kiváltó

A leadnek generált bemutató oldal magyarra volt kötve: a cirill szöveget latinra hajlította, a
betűi nem hordoztak cirillt (Fraunces, Outfit, Archivo… → a bolgár betű rendszer-fontban), a cirill
névből üres slug és `oldalam`/`mock--` fájlnév lett, a domain-javaslat `….hu`/`…szallas.hu` volt, a
piac-bíró és a levél-kritikus magyar perszónával ítélt, a lapra a teljes nyelvi csomag (konzol-
feliratok ⛔/✅ jelekkel) került, ezért a dizájn-őr MINDEN idegen mockot FLAG-elt, és semmi nem mérte,
hogy a lapon maradt-e magyar felirat.

### Döntés

① **Írás a nyelvből** (`src/i18n/script.ts`, CLDR: `Intl.Locale(lang).maximize().script`): a
homoglyph-javítás a lap nyelvének írására igazít — latin nyelven a régi cirill→latin csere bájtra,
cirill nyelven csak a VEGYES írású szó igazodik cirillre (latin márkanév, cirill szöveg érintetlen),
más írásnál (görög) nem nyúl hozzá. Hívók: motor, újraírás, kurátori csomag.

② **Betűk az írás szerint** (`src/engine/fontScripts.ts`, a `renderSite` közös zárásában): latin írású
lap érintetlen; cirill/görög lapon minden olyan család, amelyik nem hordozza az írást, a sablon
karakteréhez illő TARTALÉKRA cserélődik (URL + CSS), és az URL kéri az írás subsetjét. A családok
írás-készlete MÉRT adat (Google Fonts css2, 2026-11-17), a tartalékok cirillt ÉS görögöt hordoznak.

③ **Slug és domain:** cirill/görög név átírva (`src/text/translit.ts`: bolgár hivatalos átírás +
a többi cirill ábécé betűi, görögnél ELOT 743) → slug, előnézeti cím, fájlnév sosem üres. A
domain-javaslat a piac kínálatából csak a lead országának saját végződéseit (`own_site_tlds`) és a
generikusakat (.com, .eu) adja (`endingsForCountry`); a „…szallas” változat csak .hu alatt; a
piac saját végződése elöl, ugyanazokkal a névváltozatokkal, mint a .hu.

④ **Ellenőrzők és írók a célnyelven:** a piac-bíró idegen lapon a nyelv + ország blokkot kapja, a
magyar szótáras strukturális rétegei (szótő, építőanyag, érték-szókincs) nem futnak rajta; az író
(brief + editorial) a CÉL-NYELV mellé az ország-szabályt kapja (Balaton és magyar táj csak példa);
a levél-kritikus perszónája az ország szállásadója az ország nyelvén (`letterCriticSystem`,
`outreach-letter-critic.mts --country=XX`). A vendég-kritikus marad magyar-only (a nyelvtudása a
lényege: idegen lapon nincs ítélet, nem hamis ítélet). Magyar lapon minden prompt bájtra a régi.

⑤ **Helyi szabályok:** az IFA-szöveg a `tourist_tax_model`-ből (ADR-0450 óta él az élő oldalon és a
levélben; a mock demó-mondata szabály nélküli); a foglalási levelek napja a levél nyelvén
(`formatDay(…, lang)`, a magyar alak változatlan); az esemény-dedup cirill névre átírt kulcsot képez
(addig minden aznapi bolgár program egy üres kulcsba olvadt); a település-fotó wiki-nyelve az
ország-sorból; a lapon a Google-érték a lap számformájában.

⑥ **Nyelv-levezetés zártan:** a lead levél-nyelve a mock nyelve (lang nélküli mock = magyar mock, a
`siteData` kontraktusa), mock nélkül az ország nyelve — ismeretlen országra NINCS magyar visszaesés,
a hívás hibát dob. A fizetés utáni lapok (`/pay/go`, `/pay/done`, mock-fizetés) a VEVŐ nyelvén
(`buyerLangOfPayment`), nem az operátorén.

⑦ **A mock nyelvi kapuja** (`src/generator/mockLanguage.ts`): a render méri a saját magyar fallbackjeit
(szerver-oldali `T()` + a runtime `tr()`-feliratai a csomagból), és a nem magyar mock
`langVerdict` (`pass`/`flag`) + `langUntranslated` kulcsot kap. A küldés-kapu (`mockVerdictGate`)
a FLAG-et tartja — és a többi őrrel ellentétben megerősítéssel SEM oldható („Bábelre vár —
TARTVA, magyarul nem megy ki”). Kiút: Bábel fordítása után `rerender-mock.mts` (újramér). A lapra
a runtime-nak csak a saját feliratai kerülnek (nem a teljes csomag) — így a dizájn-őr idegen mockon
is valós ítéletet ad. A kredit-sáv a lap nyelvén.

⑧ **Követő üzenetek** (nem-nyitó, viselkedés, eszkaláció, próba-kampány): a renderjük a fallback-mérés
alatt fut, a §C-kapu NYELV-okkal tartja a hiányosat; a viselkedés- és az eszkalációs üzenet ára a
lead régiójának pénznemében (nem-forint ármondat a `foreignPrice.ts`-ben, a magyar levél-család
kritikus-ujjlenyomata érintetlen).

### Ami NEM változott

A HU-mock: szöveg, betű (font-URL subset nélkül), slug, prompt, IFA, Balaton-szabály, javaslat-lista;
a mért render bájtra a régi `renderSite` + `injectRuntime` (e2e méri).

### Mérés

- `scripts/country-layer-check.mts` ⑩ (pre-commit, a bekötés mintája bővítve).
- `scripts/country-mock-e2e.mts` (scratch DB, HU + CZ + BG, AI és hálózat nélkül): 29 ellenőrzés zöld.
- ui-shot: bolgár mock három sablonon (editorial, brutalism, organic), mobil + asztali.

### Nyitva (nem ebben a lépésben)

A jogi lapok betűje és szövege (7. lépés, jogi csomag); a heroOverride/copyManual újrarenderelése a
tárolt nyelvi ítéletet viszi tovább (a fix feliratok nem változnak tőle); a nem-nyitó levél még a
budapesti mock-ablakot nézi; a „global” ár-régiós `foreign-market-e2e` a tiszta mainen is bukik
(hiányzó modulár) — mérő-szkript, nem kapu.

### Visszafordíthatóság

🔄 — migráció nincs; a kód a HU-lapon a régi kimenetet adja. Visszaállítás = a commit visszavonása.

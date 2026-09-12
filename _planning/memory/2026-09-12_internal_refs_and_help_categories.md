# 2026-09-12 — A fejlesztői azonosító nem felhasználói szöveg + a súgó kategóriái (ADR-0126)

**Kiindulás:** Elek FK-000 újramérés a friss mainen (23a1114). Két bejelentett lelet:
① a konzol Árazás-lapján „Egyedi domain — feltételek (ADR-0109)" (+ két további ADR-szám a
magyarázatban), ② a `/help` kategória nélküli, 35 cikkes fal.

## Amit mértem (nem a bejelentés szó szerinti hatóköre)

A bejelentés 3 sort nevezett meg; a végigmérés **132 találatot** adott. A hibaosztály sokkal
szélesebb volt, mint a két hivatkozott sor:

| Osztály | Példa | Miért nem látszott eddig |
|---|---|---|
| Kapu-feliratok | `§C-kapu: PASS — küldhető` | senki nem nézte együtt a felületet és a doktrínát |
| Kapu-OK-sorok | `C4: … — §A demo-framing sérül` | **csak a HIBÁS ágon** renderelődik |
| Súgó-cikkek | `## A §C-kapu — először mindig ezt nézd` | az operátor olvassa, de nem „felület" |
| Teszt-forgatókönyv címek | `FK-004 — … → §C-kapu → …` | a Teszt-napló lapon jelenik meg |
| **Migrációs SEED** | `note: '…(ADR-0056, ADR-0110).'` a `/settings`-en | **ADAT, nem literál** |
| Küldés-visszautasítások | `§C-kapu FLAG — nem küldhető: …` | átirányítás query-paraméterén át jut a UI-ra |

⛔ **A seed-lelet a tanulság:** egyetlen forrás-grep sem találhatta volna meg, mert a szöveg a
`0057_market.sql` INSERT-jéből jött. **A renderelt réteg mérte ki**, a valódi `/settings` lapról.

## Amihez NEM nyúltam (mert mérve nem hiba)

- A riasztási e-mail mező @ nélküli címe: a mentés-validáció (`console/server.ts`) MÁR elutasítja;
  amit Elek látott, elavult seed a dev DB-ben.
- `COMMENT ON …` a migrációkban, `console.warn/error` naplósorok, kód-kommentek, a CSS/JS blokk-
  kommentek a template-literálokban: **ott a hivatkozás a helyén van** (ADR-0126 ①).
- Jogszabályi §: `2001. évi CVIII. törvény 4. §-a`, `Ptk. 6:78. §`, `Grt. 6. §`. Az őr negatív
  öntesztje külön méri, hogy ezekre NE piruljon — egy túlbuzgó minta a jogi lábazatot
  kényszerítené hazugságba.

## Az őr (`scripts/internal-ref-check.mts`)

Három réteg, mert mindegyik ott vak, ahol a másik lát — és ezt **negatívan igazoltam**:

| Visszarontás | ① renderelt | ③ statikus |
|---|---|---|
| ADR-szám kód-literálba | 🔴 `konzol/pricing` | 🔴 `views.ts:665` |
| ADR-szám a DB-be (seed-szöveg) | 🔴 `konzol/settings` | ✅ (vak — ahogy kell) |

- **Lefedettség emlékezet nélkül:** a konzol route-listája a szerver SAJÁT forrásából, a
  tenant-admin fülei az admin-nézetből származnak; ami se nem látogatott, se nem indoklással
  kihagyott → bukás. 59 + 30 lap.
- **Nem mért rész kimondva:** a `--fast` mód (commit-kapu) a megjegyzés-sorban leírja, hogy az
  ① réteg nem futott. A néma szűkítés „mindent lefedtünk"-nek olvasódna.
- **Fixture nélkül nincs zöld:** ha nincs lead/prospect/tenant, a réteg nem fut le és ezt
  kimondja — a „0 találat" nem lehet a hiányzó mérés szinonimája.

## Súgó-kategóriák (tulaj-döntés, AskUserQuestion)

A tulaj a **frontmatter `category:` + kapu** utat választotta (nem kódbeli slug-táblázatot), és a
**MUNKAFOLYAMAT szerinti** csoportosítást (nem a menü tükrét). Megvalósítva:
`src/kb/kbCategories.ts` regiszter, 35 cikk fejléce, `kb-check` kötelezi (hiányzó / ismeretlen /
rossz olvasó-körű kategóriára külön-külön piros — mindhárom lemérve), és csoportosít a konzol
`/help` ÉS a tenant-admin `?tab=sugo` (ugyanaz a fal volt ott is, 19 cikkel).
A kategória-felirat a tenant szemébe is megy → bekerült az i18n betakarításba (`DATA_FILES`).

## Módosított fájlok

- ÚJ: `scripts/internal-ref-check.mts`, `src/kb/kbCategories.ts`,
  `migrations/0065_market_note_no_internal_refs.sql`
- Felület/szöveg: `src/console/views.ts`, `src/console/server.ts`, `src/console/aamAlert.ts`,
  `src/server/adminViews.ts`, `src/server/public.ts`, `public/assets/ui/citui-admin.css`
- Kapu-szövegek: `src/outreach/outreachCheck.ts`, `sendBatch.ts`, `sendOutreachSms.ts`,
  `sendOutreachPair.ts`, `pairRepair.ts`
- Adat/tudás: 35 × `kb/entries/*/entry.hu.md`, `elek/scenarios/FK-004…`, `FK-007…`,
  `migrations/0057_market.sql` (seed), `scripts/kb-shot.mts` (fixture)
- Kapuk: `hooks/pre-commit`, `scripts/kb-check.mts`, `scripts/extract-i18n.mts`, `src/kb/kb.ts`

## Összecsukható csoportok (ugyanaznap, tulaj: „mehetnek, csináld meg")

§2b kör: három MŰKÖDŐ vázlat valós adattal (A harmonika / B exkluzív / C mobilon-csukva),
mobil+asztali képpel, végigkattintva. ⚠️ **A vázlatom első verziója a tulaj eszközén a döntés
FELÉT nem tudta volna megmutatni:** telefonon az „Asztali" mód nem lehet szélesebb a
képernyőnél (mérve 354px) — javítva: asztali módban 1100px-en RENDEZ és kicsinyítve mutat.
Választás: **A + „Mindet kinyitom/becsukom"**. Kontraktus befagyasztva:
`assets/design-refs/console/help-collapse/` (README mondja ki, mit KÖT).

⛔ **A `<details>` nem stílus-döntés volt:** a súgó keresése sima GET, a lap JS nélkül is
használható — egy csak-JS-sel nyitható összecsukott lista no-JS-en HASZNÁLHATATLAN súgó.
A keresés találatai szerver-oldalon `open`-nel renderelnek (enélkül a lap „N találatot" írna
csukott fejlécek mögött).

**Az őr NÉGY valódi hibát talált a saját kódomban** (egyik sem látszott volna képernyőképen):
① a konzol gombpárja NÉMA volt — a script a lista ELŐTT futott, így a `#kb-toc` még nem
létezett; ② a `display:flex` ÜTÖTTE a `[hidden]`-t, ezért JS nélkül HALOTT gombpár látszott
(ez a specificitás-csapda harmadszor ült be); ③-④ ugyanez a tenant-adminon.
Plusz a token-őr elkapott egy kitalált `--citui-cyan-600`-at, a kontraszt-mérés pedig a
cián-500-at (fehéren **2,41** — kis aláhúzott szöveghez kevés) → navy-900 (14,57).

## Nyitott

- A `/help` 35 cikkes listája mostantól 9 csukott csoport — a lap rövid.
- (LEZÁRVA ugyanaznap) A `C1…C4` / `C-ORSZÁG` kapu-kódok is emberi TÁRGY-prefixre cserélve —
  a rename a rá horgonyzó két őrt, a súgó két cikkét és az Elek-önteszt 15 elvárását is
  mozdította. Tanulság: egy felirat-csere akkor kész, amikor minden IDÉZŐJE is követi.

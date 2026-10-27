## ADR-XXXX — Bábel: kontextusos fordító munkatárs, és nyelvenként egyetlen, plafonos fordítás

**Dátum:** 2026-10-27 · **Státusz:** elfogadva (lokál, nem élesítve) · Kiegészíti: ADR-0036, ADR-0045, ADR-0067 ③, ADR-0281

### Kontextus

**Az eset (élesen mérve, 2026-10-27).** 09:55Z-kor a tulaj a konzolt szlovénre (`sl`) állította. A
`/operator/lang` a kérésen BELÜL, a válasz előtt fordíttatta le a teljes katalógust (5651 string, ~110
Opus-hívás). Percekig tartott, a böngésző/Cloudflare 499/504-gyel feladta; minden újratöltés és minden
további konzol-oldal (a bejelentkezett operátor betöltése is `await`-elt) ÚJ teljes fordítást indított,
mert semmi nem tudta, hogy egy már fut. Napló: 16 indítás 09:55–11:02Z között, 5 egyszerre 20 mp alatt;
utána a súgó 24 cikke 5× párhuzamosan. Főkönyv (`translation_spend`): 2149 hívás, **$130,03**, két
kredit-újratöltés. Egy tiszta futás ~$6–8 lett volna. A fordítás költségét mértük (0092), de semmi nem
olvasta vissza: plafon nem volt.

**A tulaj kérése.** „Hozzon létre egy új digitális munkatársat, akinek a neve Bábel lesz, és a feladata,
hogy a fordításokat kontextusban értelmezze … nem a beküldött szöveget kell fordítgatni, hanem Bábel a
teljes ontológia birtokában és kontextustudással tudja a megfelelő fordításokat elkészíteni.”

**Mért minőségi hiba.** A régi fordító 40 stringes vak adagokban dolgozott, egy bekezdésnyi
rendszerprompttal: nem tudta, hol jelenik meg a szöveg, és mit jelent egy szó nálunk. A vendég-honlap
„Elérhetőség” menüpontja angolul **„Availability”** lett („Contact” helyett); a „Csomag/Modul/Élesítés”
önálló feliratok több nyelven üresen maradtak; ugyanaz a fogalom adagonként másképp fordult.

### Döntés

**A) Bábel, a fordító munkatárs — perszóna ÉS a keze.**
1. **Bábel perszóna** (`babel/charter/` — CHARTER, ONTOLOGIA, RUNBOOK; jegyzetek `~/babel/`), Poe/Vera
   mintájára: saját sessionben (előfizetés, nem API) gondozza a fordítói tudást, egy új nyelv teljes
   csomagját EGY műként maga készíti, és átnézi a gépi fordítást. Csak a saját fájljait szerkeszti
   (`src/i18n/babel/**`, `babel/**`); éles DB-be nem ír.
2. **A tudása a repóban, verzióként:** `src/i18n/babel/ontology.md` (mi a Citoviso, ki melyik felületet
   olvassa, a ház szavai, kemény szabályok) és `glossary.json` (fogalom → kötelező forma nyelvenként;
   több jelentésnél a felület dönt — pl. lemondás: Stornierung / Kündigung).
3. **Bábel magja** (`src/i18n/babel/packs/<nyelv>.json`): a sessionben készült, ellenőrzött fordítás
   (`scripts/babel-pack.mts import --seed`). Commit + land + deploy viszi ki; a deploy `--ensure` lépése a
   magot a csomagra teszi (felülír), és a fizetős gép csak a maradékot fordítja. **Kézi éles DB-írás
   nincs** — Bábel munkája ugyanúgy verzió, mint a kód (ADR-0053).
4. **A keze — a fordító-motor** (`src/i18n/babel.ts`): MINDEN fordítás (UI-csomag, súgó, a
   többnyelvűség-modul honlap-szövege) ezen megy át. Rendszerprompt = Bábel + ontológia + a célnyelv
   glosszárium-oszlopa + a feladat szerződése, egy prompt-cache-jelölt blokkban (~2,5k token; ha a modell
   cache-minimuma fölött van, egy csomag ~95 hívása egyszer fizeti). Minden string a FELÜLETÉVEL megy
   (`catalog-context.json`, az `extract-i18n` írja; frissességét a pre-commit kapu nézi), az adagok
   felületenként rendezve (egy adag ≈ egy képernyő), a válasz sorszám-kulcsos (a magyar kulcs
   visszhangja eddig a kimenet ~felét vitte).

**B) A hibajavítás — a mai eset ne ismétlődhessen.**
1. **Nyelvenként egy futás.** Folyamaton belül minden hívó UGYANAZT az ígéretet kapja; folyamatok között
   (konzol, public, CLI, deploy) Postgres advisory lock nyelvenként. Aki vár (levél, mock-generálás,
   kiküldés), a lock mögé áll, és utána a DB-ből olvas (ott már kész); aki nem várhat, azonnal a mostani
   lefedettséggel tér vissza. Gyors út: teljes csomagnál lock sincs.
2. **A kérés nem vár fordításra.** A nyelvváltás, a konzol-oldalrender (operátor-betöltés) és a
   szállásadói admin / login / felfüggesztett-oldal render `prepareRenderLang`-ot hív: betölti a csomagot,
   és ha hiányos, a HÁTTÉRBEN egyszer elindítja (`requestLanguagePack`). A konzol addig „készül” sávot
   mutat, a hiányzó feliratok magyarul jelennek meg. A levelek (`prepareMailLang`) várnak — egy levél
   inkább késsen, mint félig magyarul menjen —, de a single-flight miatt soha nem indítanak újat.
3. **Költségplafon** a `translation_spend` főkönyvre, MINDEN hívás ELŐTT: napi (`TRANSLATION_DAILY_CAP_USD`,
   alap $25, budapesti nap) és futásonkénti (`TRANSLATION_RUN_CAP_USD`, alap $12). Elérésekor a futás
   megáll (az addig lefordított megmarad), ⛔⛔ napló + a ház riasztása (levél + SMS, naponta egyszer).
   Env-only, mint a mock-plafon (`AI_DAILY_CAP_USD`); elírás → alapérték, soha nem „nincs plafon”.
4. **Scrape-indítás:** a fordítás a „már fut egy scrape” kapu MÖGÉ került, és nem vár.
5. **Őr:** `scripts/i18n-single-flight-check.mts` (pre-commit, diff-scope-olt, ön-triggerrel) — valódi
   párhuzamos hívás hamis Bábel-transzporttal: 5 hívó egy folyamatban és 3 folyamat egyszerre → minden
   string pontosan egyszer; a kérés-út <50 ms alatt visszatér; plafonnál 0 hívás, 1 riasztás; a mag
   elsőbbsége; a bekötés statikusan.

### Elvetett alternatívák

- **Csak a hibajavítás, Bábel nélkül:** a költség-robbanást megfogja, a minőséget („Availability”) nem.
- **Bábel csak perszóna, gépi kéz nélkül:** a deploy-delta (minden új felirat) és egy váratlan új nyelv
  (pl. a tenant megrendeli a horvát modult) emberi sorra várna; a fizetett többnyelvűség-generálás
  megakadna. A gép marad, de Bábel tudásával és plafon alatt.
- **Bábel éles DB-be importál:** minden javítás külön éles-írási engedély lenne (§0.3), és a „mi fut
  élesen?” nem lenne verzió. A mag commitolva ugyanazt adja, a meglévő deploy-kapun át.
- **Glosszárium a DB-ben:** dev és éles elcsúszna; a fájl verziózott, átnézhető, a deploy viszi.

### Következmények

- **Költség, becslés** (élesen mért régi hívás-átlagból: 1273 be / 1877 ki token / 40 string): egy teljes
  csomag (UI + 24 súgó-cikk) gépi úton ~$7 (régen ~$10,5); **Bábel sessionjében $0 API** (előfizetés). A
  pontos új szám az első éles futás `translation_spend` soraiból mérhető. A deploy-delta (néhány tucat
  új felirat) centekbe kerül.
- A glosszárium mag-változata 2026-10-27-i: a meglévő csomagok helyes formái + a kontextus-vak hibák
  javítása; cs/ro/sl oszlop is van. Bővítése és a meglévő csomagok auditja Bábel első feladata.
- Élesítés után a konzol nyelvváltása azonnali (hu + „készül”), a csomag a háttérben egyszer készül.
- A `.env`-ben nincs teendő: a plafonok alapértéke él; módosítani csak env-ben lehet.

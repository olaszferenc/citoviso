## ADR-0045 — Tudásbázis-doktrína: vezetett felhasználó-oktatás mint termék-réteg (KB + kontextuális súgó + KB-őr + locale-integráció)
- **Dátum:** 2026-08-21
- **Kiváltó / Kontextus (tulaj):** a célközönség IT-felkészültsége alacsony — kell egy tudásbázis,
  ami print screenekkel és folyamatleírásokkal vezeti a felhasználót, KIEMELTEN az adminban
  (szolgáltatás hozzáadása/módosítása). A tulaj rendelete: (1) doktrína-szinten kezelendő, őrrel,
  aki a fejlesztéseket figyeli és bővítteti a tudástárat; (2) a UI-t eleve úgy fejlesztjük, hogy az
  adott részen súgó-ikon mutassa be a munkafolyamatot; (3) a tudásbázis nem csak lokálisan (adott
  felületen), hanem az adminon belül külön, KERESHETŐ felületként is elérhető; (4) új KB-bejegyzés
  AUTOMATIKUSAN legenerálódik minden már létező nyelvi csomagra; (5) új régió → az automata
  kontextuális nyelvi-csomag-generálásba a tudásbázis is beleértendő, nem csak a UI-feliratok.
- **Döntések:**
  - **A) A KB termék-réteg, repo-forrással.** Forrás: `kb/entries/<slug>/entry.hu.md` — magyar
    forrás-tartalom (ugyanaz az elv, mint az i18n-katalógusnál: a magyar a forrás), de a slug, az
    anchor és minden struktúra ANGOL (2026-08-01 struktúra-rendelet). Frontmatter: `id`, `title`,
    `audience` (tenant|operator), `anchors` (vesszővel), `updated`. Git-verziózott → pre-commit-
    őrrel kapuzható. Cél-mérce: az IT-kezdő tulaj TELEFONRÓL, segítség nélkül végigmegy a folyamaton.
  - **B) UI-horgonyzás.** Minden tenant-admin szekció `data-kb-anchor` attribútumot + súgó-ikont
    visel (`src/ui/icons.ts`, inline SVG — nem emoji); az ikon a szekcióhoz tartozó KB-entryt nyitja
    helyben. Emellett kereshető **Súgó** felület az adminon belül (`/admin?tab=help`). Mobil-nézet
    (~390px) kötelező verifikáció.
  - **C) KB-őr — a bevált hármas-kapu minta** (kontraktus → determinisztikus check → subagent →
    pre-commit): ① `scripts/kb-check.mts` gépiesen: entry-lint (frontmatter-mezők, anchor-nyelvtan
    + globális unicitás, nem-placeholder törzs, képhivatkozás-épség, külső kép tilos) — MOST megy a
    pre-commitba; `--coverage` mód (minden view-beli `data-kb-anchor` ↔ entry bijekció + az 5
    admin-fül kötelező lefedettsége) a B) UI-szelettel együtt élesedik a pre-commitban — addig
    szándékosan piros. ② `tudasbazis-or` subagent az ítélet-igényű részre: a leírás TÉNYLEG a
    felületet írja-e le (gombfeliratok!), IT-kezdőnek érthető-e, screenshot aktuális-e. A 2026-08-21
    őr-tanulság beépítve: az őr azt méri, ami számít (a súgó a felhasználót vezeti-e, nem azt, hogy
    „van-e fájl"), és szándékos rontással pirosra futtatva.
  - **D) Locale-integráció (a tulaj két kemény szabálya):**
    1. **Új/módosult KB-entry → automata fordítás MINDEN élő nyelvre.** Mechanizmus:
       `kb_translation(entry_id, lang, source_hash, title, body_md, generated_at)` tábla — NEM a
       `language_pack` (az 1:1 rövid-string map; a KB fordítási egysége a TELJES markdown-dokumentum,
       markdown-tudatos fordító-prompttal: szerkezet/képhivatkozás/anchor változatlanul marad).
       Staleness = `source_hash` eltérés → regenerál, ugyanazzal a boot-self-heal mintával, mint az
       `ensureAllLanguagePacks()`.
    2. **Új régió/nyelv → EGY belépési pont.** A nyelv késszé tétele (`ensureLanguagePack`) bővül:
       UI-csomag + KB-fordítás EGYÜTT készül (`ensureKbTranslations(lang)` ugyanabból a hívásból) —
       a KB szerkezetileg NEM felejthető el.
  - **E) Screenshot csak reprodukálható.** Script-generált, nyelv-paraméteres capture (Playwright,
    `scripts/kb-shot.ts` — az engine-shot minta): UI-változásnál és új nyelvnél újragenerálódik.
    Kézi screenshot csak átmeneti, nyelv-jelölt mappában (`assets/<lang>/`). Ok: a kézi kép a UI
    változásakor elavul ÉS nyelv-hamis (magyar UI-kép a lengyel súgóban bizalmat rombol).
- **Miért:** §E.12 — az önkiszolgáló admin (support≈0) a volumen-modell FELTÉTELE; a KB ennek az
  eszköze. Doktrína + őr nélkül a súgó-lefedettség a fejlesztési lendületben pont úgy maradna el,
  mint a i18n-burkolás az őr előtt — ezért ugyanaz a fizikai kapu-minta.
- **Visszafordíthatóság:** 🔄 additív (új `kb/` mappa, új check, agent-fájl; az admin-módosítás a
  B) szeletben, szintén additív attribútum+ikon).
- **Elvetett alternatívák:** külső help-tool (Intercom/Notion/GitBook) — nem verziózott a repóval,
  nem köthető pre-commit-őrhöz, nem fér be az automata locale-pipeline-ba, plusz függés; KB a
  `language_pack` stringjeiként — a fordítási egység dokumentum, nem UI-string; csak tooltipek KB
  nélkül — nem kereshető és nem vezet folyamatot; DB-first KB szerkesztő-UI-val — a pilotban mi
  írjuk a tartalmat, a git-verziózás + kapu többet ér.
- **Szelet-sorrend:** ① doktrína (§J) + `kb/` struktúra + első entry (Fotók) + `kb-check`
  lint a pre-commitban + `tudasbazis-or` agent. ② UI-horgony: `data-kb-anchor` + súgó-ikon +
  kereshető Súgó-fül + `--coverage` kapu élesítése + `kb-shot`. ③ Locale-futómű: `kb_translation`
  + ensure-integráció.

### ADR-0045/b kiegészítés (2026-08-21) — a ② szelet + az AUTOMATIKUS töltődés két hurka

A tulaj megerősítő kérdésére („legyen hurok, ami minden commit/deploy előtt megnézi, kell-e
menteni a tudástárba — akkor jó, ha automatikus") a ② szelet a detektálást KÉT determinisztikus
hurokkal tette automatává; a tartalom-fordítás automatikája a ③ szelet.

1. **Szerkesztés-idejű hurok:** `scripts/kb-scan.mjs` PostToolUse-hook (a hármas-kapu i18n-mintája) —
   admin-view VAGY KB-fájl minden mentésekor azonnal fut a teljes `kb-check --coverage`; sértés
   blokkol. A fejlesztő (agent) nem tud úgy felület-változást menteni, hogy a súgó ne kövesse.
2. **Commit-idejű hurok:** a pre-commit MINDEN commitnál futtatja ugyanazt — fizikai kapu.
3. **Label-drift kontraktus (az „azt mérje, ami számít" elv):** az entryben **„félkövér-idézett”**
   felirat = UI-állítás, aminek SZÓ SZERINT szerepelnie kell a view-forrásban — egy gomb-átnevezés
   pirosra váltja a kaput, amíg a súgó nem frissül ugyanabban a commitban. Sima „idézet” szabad próza.
4. **② leszállítva:** `helpLink()` + `data-kb-anchor` az 5 admin-fül kártyafején, `help` ikon az
   ikon-készletben, **Súgó** fül (6. nav-elem) kereshető, no-JS GET-kereséssel (`src/kb/kb.ts`
   betöltő + szűkített markdown-renderelő; `?topic=` anchort VAGY entry-id-t old fel), session-kapuzott
   kép-út (`/admin/kb/<id>/assets/…`, path-fence), `scripts/kb-shot.mts` (390px viewport-capture,
   nyelv-paraméteres, egyenesen az entryk `assets/hu/`-jába) + mind az 5 entry beágyazott
   screenshottal. Coverage-kapu ÉLES a pre-commitban. Önellenőrzés pirosra futtatva: label-átnevezés
   ÉS horgony-eltávolítás is fogott; a kapu élesben elkapta a saját fejlesztés 2 valós hibáját
   (sortörésen átfolyó label, template-változós anchor-kinyerés).
### ADR-0045/c kiegészítés (2026-08-21) — a ③ szelet: locale-futómű

1. **`kb_translation` tábla (0027):** (entry_id, lang) kulcs + `source_hash` (a magyar forrás
   sha256-a) + title + body_md. Hash-eltérés = elavult → az ensure újragenerálja (ugyanaz a
   self-heal doktrína, mint a language_pack-nél, de az egység a teljes markdown-dokumentum).
2. **EGY belépési pont, nulla új hívóhely:** az `ensureLanguagePack` hívja az
   `ensureKbTranslations`-t — így MIND A NÉGY meglévő trigger (scrape új régióba,
   mock-generálás, boot self-heal, CLI `--ensure`) automatikusan fedi a KB-t. A `PackStatus.ok`
   innentől a KB-t IS méri; a boot-log és a status-CLI KB-oszlopot kapott.
3. **Integritás-őr = a KB „placeholder-őre":** a fordítás CSAK akkor kerül DB-be, ha a
   **„félkövér-idézett”** gombfeliratok SZÓ SZERINT (magyarul!) túlélték — a felület ma magyar
   feliratú, a lengyel súgó a képernyőn látható magyar gombot idézi, a mondat körülötte lengyelül
   magyaráz —, a kép-útvonalak változatlanok, és az alcím-váz egyezik. Sértő fordítás eldobva
   (a következő ensure újrapróbálja). Ha a tenant-admin egyszer language_pack-burkolást kap, ez a
   kontraktus vált: a felirat a pack-ból fordul, és a KB követi (a drift-kapu jelzi majd).
4. **Kiszolgálás a tenant nyelvén:** `getTenantContent` kiadja a site nyelvét (ADR-0036,
   `SiteData.lang`); a Súgó fül a `localizedKbEntries(lang)` overlay-ből keres/nyit — elavult
   fordítás is kiszolgál (olvasható jobb, mint a magyar fallback), a következő ensure frissíti.
   A hu-screenshotok helyesek: a felület ma minden tenantnak magyar.
5. **Bizonyíték:** integritás-őr 5 esetből 5-öt helyesen ítél (lefordított gombfelirat, átírt
   kép-útvonal, eldobott alcím, üres → mind bukik); ÉLES lengyel generálás 5/5 entry (természetes
   Pan/Pani regiszter, magyar labelek túléltek); hash-rontásos elavulás-próba → státusz jelzi +
   ensure öngyógyít; hu-út érintetlen.

### ADR-0045/d kiegészítés (2026-08-21) — ④ a modul-beállító képernyők súgója

A tulaj eredeti hangsúlya („kifejezetten fontos az admin felületén, ahol szolgáltatásokat ad
hozzá vagy módosít") a modul-képernyők mélyét jelenti — ez a szelet oda viszi le a KB-t.

1. **Szöveges súgó-belépő, nem csak ikon:** a modul-beállító képernyők tetején „Útmutató ehhez
   a képernyőhöz" pill (`.mcfg-help`, moduleConfigViews `helpLink()`) — az IT-kezdő szavakat
   olvas, nem ikont. Horgony-hozzárendelés a bespoke szerkesztő szerint: `admin.modules.booking`
   | `.rooms` | `.pricing`, generikus mező-űrlap → `admin.modules.settings`.
2. **4 új entry** (foglalás: kérés-döntés + naptár + egységek; szobák: egységek + tartalom +
   aloldal-feltételek; árak: alapár + MM-DD szezonok; általános beállítás-képernyő: mentés +
   „Vissza az előzőre"), mind valós feliratokból, screenshottal (kb-shot kibővítve a
   moduleSettingsSection-fixture-ökkel). Portál-szinkron NEM dokumentált (PORTAL_SYNC_UI=false —
   amit nem támogatunk, arról súgó sincs).
3. **A hurok élesben vizsgázott:** a horgony-kirakást a kb-scan hook azonnal blokkolta, amíg az
   entryk el nem készültek (5→4→3→2→0 hiba), és elkapott egy valós hibát is (a kommentbeli
   `helpLink`-minta fantom-horgonyként olvasódott). A lengyel KB az ensure-ből automatikusan
   9/9-re bővült.

- **Státusz:** ELFOGADVA; ①–②–③–④ IMPLEMENTÁLVA — a doktrína teljes: entry-változás → minden élő
  nyelvre automata fordítás; új régió/nyelv → UI-csomag + KB EGY hívásból; a fül-szint ÉS a
  modul-képernyő-szint is lefedett.

### ADR-0045/e kiegészítés (2026-08-21) — ⑤ az OPERÁTOR-KONZOL súgó-rétege

A doktrína `audience: operator` ága eddig csak struktúra volt (a mező létezett, entry nem).
Ez a szelet a belső konzolt (:4600) hozza a §J alá — a konzol az ERP-mag (ADR-0014 kontextus),
és a tulaj TELEFONRÓL operálja, tehát ugyanaz a „vezetett folyamat" mérce áll rá.

1. **Audience-bontott őr, nem közös korpusz.** A `kb-check` VIEW_FILES audience-csoportokra
   válik: tenant → `adminViews.ts`+`moduleConfigViews.ts`, operator → `src/console/views.ts`.
   A label-drift kontraktus a SAJÁT audience view-forrása ellen fut — egy közös korpusz hamis
   zöldet adna (tenant-entry felirata véletlenül matchelhet konzol-forrásra és fordítva; az őr
   azt mérje, ami számít). Coverage-bijekció szintén audience-bontásban; a kötelező horgony-lista
   a konzol fő képernyőivel bővül (`console.dashboard|leads|lead|scrape|duplicates|report|
   pricing|settings`). A `kb-scan` hook scope-ja követi.
2. **Operator-entry NEM fordul.** Az `ensureKbTranslations`/`localizedKbEntries` `audience==="tenant"`-ra
   szűr: a konzol felülete ma magyar, a tenant sosem éri el az operátor-súgót — lengyelre fordítani
   AI-költség értelem nélkül, ÉS a §J.25 elve („a súgó a képernyőn látható feliratot idézi") épp a
   NEM-fordítást követeli, amíg a konzol nem nyelvesedik. Ha a konzol egyszer language_pack-ot kap
   (2026-08-01 multilanguage-rendelet, post-pilot), a szűrő egy feltétel — a doktrína kész rá.
3. **Súgó-belépő a konzolban:** `helpLink()` a panel-fejléceken (`data-kb-anchor` + ikon, az admin
   mintája) + kereshető **Súgó** oldal (`/help`, operátor-login mögött, `?topic=` anchort vagy
   entry-id-t old fel, audience=operator szűréssel) + menüpont. Kép-út: `/help/<id>/assets/…`
   path-fence-szel, login mögött.
4. **Screenshot ugyanabból a csőből:** a konzol-view-k tiszta függvények → a `kb-shot` fixture-
   adatokkal, szerver és login nélkül capture-öl (390px — a tulaj valós eszköze).
- **Miért:** a §J.24 mércéje („segítség nélkül végigmegy a folyamaton") az operátorra is áll —
  a pilotban a tulaj MAGA az operátor, és a lead→mock→kuráció→megkeresés→konverzió lánc a
  legösszetettebb folyamat a rendszerben. A support≈0 elv (§E.12) befelé is érvényes.
- **Visszafordíthatóság:** 🔄 additív (entryk, horgonyok, route; az őr-bontás a meglévő kaput
  pontosítja).
- **KÉTSZINTŰ TUDÁSBÁZIS (tulaj-rendelet, 2026-09-01/02):** a belső felhasználó az ÖSSZES
  útmutatóhoz hozzáfér — a konzol-Súgó MINDKÉT csoportot listázza („Konzol-útmutatók" +
  „Tenant-súgó — amit az ügyfél a saját adminján lát", jelöléssel); a tenant a saját adminján
  KIZÁRÓLAG tenant-entryt lát, és a tenant-oldali KB-kép-út audience-KERÍTÉST kapott (operátor-
  entry képe tenantnak URL-találgatással sem szolgálható ki — a lista-szűrés önmagában kevés
  volt). Felület: a tulaj a B) „Súgóközpont" tervet hagyta jóvá (§2b kör, kontraktus:
  `assets/design-refs/console/help-center/`): desktopon a témalista MINDIG a cikk mellett,
  mobilon egyoszlopos + no-JS fragment-ugrás a nyitott cikkre.
- **Rebase-jegyzet (2026-09-01):** a szelet landolása 205 commitnyi upstream-re történt; az
  operator view-csoport a partner/bizonylat felületekkel bővült (`partnerViews.ts`,
  `partnerData.ts` — a párhuzamos szál entry-i változatlan anchorokkal beálltak a bijekcióba),
  a tenant-csoport a `modulePreview.ts`-sel (ADR-0089). A helpLink-regex az ADR-0067-es
  többargumentumos hívást is elfogadja. +1 kötelező operátor-anchor: `console.outreach_draft`
  (a §C-kapus küldő-képernyő — a tudasbazis-or FLAG-je hozta felszínre, két hamis
  viselkedés-állítással együtt, amiket az entry-javítás rendezett).

### ADR-0045/f kiegészítés (2026-09-03) — ⑥ a tudás-őr a DEPLOY-CSŐBEN + periodikus frissesség-kör

A tulaj két felvetése (2026-09-01/02): (1) legyen időzített kör, ami az éles rendszeren
feltérképezi az új folyamatokat és frissítteti a tudásbázist; (2) „éles deploy előtt minden
anyagot ő [a tudás-őr] nézzen át; és ha a deploy frissített munkafolyamatot tartalmaz,
frissítse a tudásbázist."

**A kulcs-határ (a tulajjal egyeztetve):** az őr DETEKTÁL és BLOKKOL, de tartalmat felügyelet
nélkül NEM ír — §J.24: a hamis súgó rosszabb a hiányzónál; egy deploy-pillanatban generált,
senki-által-nem-látott útmutató pont ezt termelné. A „frissített munkafolyamat → frissült
tudásbázis" garancia úgy áll elő, hogy enélkül a deploy KI SEM MEHET; a tartalom a normál,
kapuzott fejlesztési úton készül.

1. **GATE 1c a `deploy-prod.sh`-ban (az egyetlen csőtorkolat, ADR-0053).** Ha a
   `PROD_SHA..SHA` tartományban KB-releváns diff van (view-csoport fájlok ∪ `kb/entries/` ∪
   `src/kb/` ∪ `scripts/kb-*`):
   a) determinisztikus réteg: `kb-check --coverage` a CÉL-commit tiszta worktree-jén (nem a
      kézben lévő fán — az mást mérne);
   b) ítélet-réteg: friss `tudasbazis-or` PASS-verdikt KELL pontosan erre a tartományra —
      evidencia a `scripts/kb-gate.mjs` token-tárban (a surface-gate mintája: a néma út
      lehetetlen, a verdikt tudatos, naplózott aktus range-kötéssel és lejárattal);
   c) screenshot-frissesség WARN: ha a tartományban view-fájl változott, de egyetlen
      entry-asset sem, a dry-run kiírja („kb-shot futtatás hiányozhat") — nem hard-fail,
      mert a vizuális érintettséget az ítélet-réteg dönti el.
   KB-releváns diff nélkül a kapu néma. Első sync (nincs PROD_SHA) → kapu kihagyva.
2. **Periodikus kör: `citoviso-kb-freshness.timer` (napi, dev-gép).** `scripts/kb-freshness.mts`:
   ① prod↔repo drift (ssh READ-ONLY: az élesen futó SHA kora/lemaradása az origin/main-hez);
   ② screenshot-elavulás az origin/main-en (view-csoport utolsó commitja újabb-e, mint az
   entry-assetek utolsó commitja, audience-enként); ③ `kb-check --coverage` a fő fán.
   FLAG → nem-nulla exit (a systemd státusz mutatja) + log (`~/.claude/citoviso-kb-freshness.log`).
   Az agent-hívás cronból NEM része a v1-nek (headless ítélet törékeny); a cron a determinisztikus
   réteget méri, az ítélet a deploy-kapunál kötelező.
3. **Elvetett:** deploy-időben AI-tartalomgenerálás (hamis-súgó kockázat, lásd határ);
   pixel-diff a screenshot-frissességre (a PNG-render nem bájt-determinisztikus → hamis riasztás);
   agent-hívás a bash deploy-szkriptből (a verdikt-evidencia a session-ben születik, a szkript
   a bizonyítékot kényszeríti ki).
- **Visszafordíthatóság:** 🔄 additív (új kapu-szakasz + új szkript + timer; a deploy többi
  kapuja érintetlen).

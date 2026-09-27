## ADR-0252 — A kapu alanya saját fixture vagy kimondott predikátum, sosem a közös dev-DB „első sora” — és egy őr, ami a vak `limit(1)`-et megfogja

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulaj: „nyiss új sessiont”, brief `~/rc-briefs/kapu-sajat-fixture-elv.md`) · **Kapcsolódik:** ADR-0249 ⑥ (az elv első kimondása, a tiszta-main próba), ADR-0229/0230 (író-sáv, `own-fixture-only`), ADR-0198 (szoba-rács csak 2+ egységnél), ADR-0250/0251 (a lead-lap időzítése), ADR-0067 ③ (operátoronkénti konzol-nyelv)

### Kontextus
2026-09-27-én három kapu volt piros a **tiszta origin/mainen** is, és egyik sem a vizsgált változás miatt:
1. `photo-normalize-check` — `db.selectFrom("tenant_user").limit(1)`: a közös dev-DB „első tenantja”
   (Lidó) egyegységes, a szoba-feltöltő csak 2+ egységnél létezik (ADR-0198) → minden
   `adminViews.ts`-commit piros lett. Javítva: `d3daca69` (több egységes tenant, `having`).
2. `console-contrast-check` és 3. `outreach-link-live-check` — az első `mock_artifact` leadje +
   a lead-lap lassú networkidle-je (a gyökérokot az ADR-0250 javította, a kapukon 90 s-os
   korlát maradt, ADR-0251).

A minta mindháromnál ugyanaz: a kapu **nem a saját fixture-jén mér, hanem a közös dev-DB éppen
aktuális sorain**. Ha a közös adat változik (új tenant, purge, egy testvér-szál tesztadata), a kapu
véletlenszerűen billeg — vagy **vakon zöld**, mert az alany épp nem viseli azt, amit mérni kellene.
A memóriában ugyanennek az osztálynak további esetei is élnek (module-upsell scratch-DB, prospect-owned
globális számláló, közös `sites/` fixture, Elek-park óra — ADR-0249 lista).

A leltár (mérve, `_planning/memory/2026-09-27_gate_subject_inventory.md`) 230 fájlon (minden
`*-check`, `scripts/lib`, és minden szkript, amit a `hooks/pre-commit`/`land.sh` név szerint futtat)
**40 vak „első sort” talált 22 kapuban** — ebből 16 az operátor-belépés („`claude-test` ?? az első
operátor”, vagy egyből az első operátor). Ez NEM közömbös: az `operator_user.lang` az adott ember
konzol-NYELVE (ADR-0067 ③), vagyis egy tetszőleges operátorral a kapu azon a nyelven renderel, amit
az illető magának választott. A `consent-style-check` „`claude-test` tenant ?? első tenant” ága
pedig SOSEM találta meg a `claude-test` tenant-fiókot (nincs ilyen) — mindig az első sort mérte.

### Döntés
1. **Az elv.** Kapu alanyt csak így választhat:
   - **(a) saját fixture-ből** — maga szúrja be, bélyegzett kulccsal (ADR-0229 `own-fixture-only`);
   - **(b) a közös DB-ből KIMONDOTT predikátummal** (`.where` / `.whereRef` / `.having`: „több egységes
     tenant”, „a `claude-test` operátor”, „lead mockkal és prospecttel”), stabil sorrenddel, és ha
     a predikátumnak nincs alanya, **HANGOSAN bukik** („ELŐFELTÉTEL HIÁNYZIK: …”) — sosem hagy ki
     csendben, és sosem esik vissza „bármelyik” sorra;
   - **(c) a vak „első sor”** (predikátum nélküli `selectFrom` egy sort véve; nyers SQL `limit 1`
     `where` nélkül) — **HIBA**.
2. **Nevesített alanyok** — `scripts/lib/gate-subject.mts`: `gateOperator` (`claude-test`),
   `gateTenantUserWithSite`, `gateLeadWithMockAndProspect`, `gateDraftableProspect`,
   `gatePartnerWithContact`. Mindegyik megmondja, MIT kell az alanynak viselnie, a legrégebbi
   ilyen sort veszi (új sorok nem keverik át), és `executeTakeFirstOrThrow` „ELŐFELTÉTEL”-lel bukik.
   Egy új kapu ezekből választ, vagy saját fixture-t épít.
3. **Őr: `scripts/gate-subject-check.mts`**, a pre-commitban MINDIG fut (szöveg-őr, ~1 s). Kód-részen
   mér (egy saját lexer kiveszi a kommentet, a string- és a sablon-szöveget és a regex-literált, így
   egy őr önteszt-fixture-je nem számít; a `${…}` viszont kód). Leletek: ① `selectFrom` egy sort
   véve predikátum nélkül (`executeTakeFirst*` / `.limit(1)` / `.execute())[0]`) — az `innerJoin`
   NEM predikátum; a változóban tartott predikátum nélküli lekérdezés későbbi `.limit(1)`-je is;
   ② nyers SQL `limit 1` `where` nélkül. Az aggregátum (`count`/`max`…) nem alany-választás.
4. **Kivétel csak indokkal**: `// gate-subject-allow: <indok>` (≥12 karakter) a lánc során, fölötte
   vagy az utasítás fejsora fölött. Az üres/rövid indok és az **elavult kivétel** (ami semmilyen
   leletet nem fed) maga is bukás. A kivételek száma és helye a kimenetben (ma 4, 3 fájlban:
   két artefaktum-id, ami csak a manifest `requestUrl`-jébe kerül · a `prospect-owned-check` két
   join-predikátumos, ELŐFELTÉTEL-lel bukó választása).
5. **A meglévő 40 lelet**: 36 javítva a nevesített alanyokra (a mérés TARTALMA nem gyengült: a
   lead-/partner-/prospect-lapok a legteljesebb alakjukban mérődnek, és ahol eddig csendes
   kihagyás volt — `console-contrast-check`, `console-dark-scan`, `outreach-row-truth-check`,
   `help-collapse-check` —, ott most hangos ELŐFELTÉTEL-bukás), 4 indokolt kivétel.

### Következmények
- Önteszt (`--self-test`, a saját változásakor a pre-commitban): 14 visszarontás (egysoros ·
  többsoros · `execute())[0]` · `?? első sor` · `innerJoin` · `${…}`-ben · backtickes regex-literál
  előtte · lekérdezés-változó · nyers SQL ×2 · üres/rövid/elavult allow) mind piros; a tiszta fixture
  zöld; **negatív kontroll a CLI-n át** (egy szándékosan vak `limit(1)`-es fixture-kapu → exit 1);
  **történeti kontroll**: a `photo-normalize-check` a `d3daca69` ELŐTT piros, UTÁNA zöld; a hatókör
  utó-feltétele: minden horog-futtatott szkript benne van, és legalább egy `.ts` is.
- Mérve: a felismerő első változata **vak volt a `mock-photo-gate-check`-re** (egy backtickes
  regex-literál sablonnak olvasta a fájl hátralevő részét) — a nyers soros leltárral való
  keresztellenőrzés fogta meg (a javítás után 38 = 38). A lekérdezés-változó felismerése ezen felül +2-t adott (`hu-machine-form-check`: `tenantUserQ.limit(1)`), amit a soros leltár nem látott. Mindkét eset benne van az öntesztben.
- ⛔ **Amit az őr NEM tud:** a (b) „hangosan bukik” felét nem bizonyítja. A leltárban kézzel nézve
  **csendes kihagyással** élő (b)-választások: `consent-check` (élő site), `consent-style-check`
  (élő site · előnézeti token · fizetett payment · artefaktumos `mock_request` — ez utóbbi a
  dev-DB-ben ma NULLA, vagyis a `/m/<token>` ág most sem mérődik, csak kiírja), `hero-override-check`
  (kiajánlott mock). Ezek hangosítása NYITOTT tétel: a `mock_request`-ágnak előbb saját fixture kell,
  különben a kapu azonnal piros. A beégetett azonosító (`copy-panel-check` `LEAD` uuid) szintén külön
  hibaosztály, nem ennek az őrnek a tárgya.
- A két 90 s-os időkorlát (`console-contrast-check`, `outreach-link-live-check`) visszavétele a
  tulaj döntése marad — ez az ADR nem érinti.

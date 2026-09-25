## ADR-XXXX — Író-sáv a kapu-futtatóban: a kimondottan „own-fixture-only” jelölt író kapuk egymással párhuzamosan, a többi utánuk sorban; a jelölés a kapu mellett él, őr méri, és a versenyt mértük (2026-09-25)

- **Kiváltó (tulaj, 2026-09-25):** *„két párhuzamos lehetőség: várakozósor szervező + 14 író kapu auditja”* —
  ez a második (brief: `~/rc-briefs/gate-writer-audit.md`). Előzmény: ADR-0227 ③ — az írók a ② fázisban
  EGYMÁSSAL SEM futnak párhuzamosan, mert a közös táblákba szúrt fixture-jeiket a globális számlálós őrök
  látnák; nyitva hagyta: „kimondottan »saját fixture, globális számlálás nélkül« jelölés után párhuzamos
  író-sáv — őrönként kell auditálni”. Feltétel: kapu és állítás nem csökkenhet.

**Az audit (27 kapu — a regiszter 22 sora ∪ a brief 5 nevesítettje; jegyzet:
`_planning/memory/2026-09-25_gate_writer_audit.md`):** 14 kapu ír és olvas vissza KIZÁRÓLAG saját,
futásonként bélyegzett fixture-t (ebből 4 scratch-DB-s, dev-DB-t nem is ír) — 12 kapott jelölést, kettő (booking-screen,
room-editor) függőben, lásd 4.; 13 NEM — és a 13 oka
nem „globális `count(*)`” volt, ahogy vártuk, hanem négy másik osztály, amit csak a fájlok elolvasása
hozott elő:
- **kölcsönzött sor:** „bármelyik `scrape_run`” FK-szülőnek (`lead.scrape_run_id ON DELETE CASCADE` —
  a testvér takarítása a teljes fixture-t viszi; a heap-első sor MA is kapu-fixture, mérve), „az első élő
  site” artifactja (`SET NULL` → `loadSiteForEdit` null → az admin-lap elhal), „egy `tenant_user`” sütihez;
- **globális söprő termék-hívás:** `maintainDatedPrices`, `expireStaleOffers`, `getScrapeRuns`
  (→ `reapStaleScrapeRuns` UPDATE az egész táblán) — más tenant sorait bélyegzi, törli, levelezi, és a
  globális számuk az ítéletben áll;
- **táblaszintű DDL:** hibainjektáló `CREATE/DROP TRIGGER ON module_entitlement` (zár minden író ellen);
- **közös fájl-erőforrás:** a mock-levelező `outbox/` mappájának törlése (`rm -rf`) — három sáv-jelölt ott
  várja a saját levelét.

**Döntés**

1. **A jelölés a kapu forrásában él, nem a futtatóban:** `// gate-lane: own-fixture-only` a fejléc első
   40 sorában (+ 3 magyarázó sor: mit ígér, mikor kell levenni). Aki a kaput szerkeszti, látja az ígéretet.
   A futtató ezt olvassa; lista nincs.
2. **A jelölés ígéretét őr méri:** `scripts/gate-lane-check.mts` — MINDIG fut (szöveg-őr), tíz szerkezeti
   osztályt zár (szűretlen kysely-lánc · szűretlen nyers SQL · LIKE-takarítás · fix port · fix `/tmp`/
   `assets/Temp` · scratch-DB `scratchDbName` nélkül · ismert söprő hívás · közös `outbox/` · kölcsönzött
   sor · táblaszintű DDL). Kétség = bukás; kivétel CSAK `// gate-lane-allow: <indok>` (≥ 8 karakter), és
   a kivétel a kimenetben jegyzőkönyvezve. Piros önteszt 19 sértéssel + tiszta fixture + negatív kontroll
   (egy ismert soros kapu jelöletlenül is leletet ad). ⛔ Kimondva, amit NEM lát: a termék-függvények
   belsejét — a söprő-lista az auditból jön, új söprőnél bővítendő; ezért a jelölés feltétele az audit
   ÉS a mért verseny, nem az őr zöldje önmagában.
3. **Író-sáv a ② fázisban:** a jelölt írók N szálon (ugyanaz a `CIT_GATE_JOBS`, ugyanaz a „szkript
   önmagával nem fut” kizárás), a jelöletlenek UTÁNUK, sorban, a hook sorrendjében. Egy jelölt kapu az
   ① fázisban továbbra is csak-olvasó módban indul (ha nem ír, ott zöldül); a jelölés csak a ② fázis
   ütemezését érinti. `CIT_GATE_JOBS=1` = minden sorban, mint eddig.
4. **Verseny MÉRVE, nem következtetve** (a brief 4. lépése): a jelölt írók 4 szálon, 10 fordulóban,
   0 bukás a mérésbe bevont 13 kapun — lásd a jegyzetet. A booking-screen-check a mérésből KIHAGYVA és ebben a
   körben NEM jelölve: az origin/main-en egyedül futtatva is piros ma (hónap-végi fixture-ablak, a szülő session
   mérte, külön szálon javul), és a fájl érintése a saját triggerét tüzelné → a commit nem mehetne át. Az
   audit-verdikt (own-fixture-only) áll; a jelölés az első zöld napján pótolandó, a sávbeli viselkedését akkor kell
   visszamérni. A room-editor-check ugyanígy függőben: a versenyben 10/10 zöld volt, de egyedül futtatva load
   23–45-ön háromból három piros, két különböző terhelés-mechanizmussal (opacitás-átmenet közbenső értéke a
   negatív kontrollban · a süti-párbeszéd elfogja a kattintást) — a stabilizálása külön kör. ⛔ Bukó vagy
   terhelés-törékeny kapu jelölést nem kap — ez a szabály, nem kivétel; a sáv több párhuzamos böngészőt jelent,
   tehát pont a terhelés-érzékenységet erősíti fel.
5. **A 13 soros kapu marad soros**, és a jegyzet kapunként megnevezi, miért. Öt közülük egysoros
   javítással (saját `scraper_definition`+`scrape_run` a kölcsönzött helyett) sávba emelhető — ez
   tulajdonosi döntés, ebben a körben nem nyúltam a kapuk logikájához.

**Eredmény (mérve 2026-09-25, jegyzet: `_planning/memory/2026-09-25_gate_writer_audit.md`):**
- Verseny: a 13 jelölt író 4 szálon, 10 fordulóban — **130 futás, 0 bukás** (a booking-screen a fenti okból kihagyva).
- A teljes hook egy 106 kapus szintetikus diffen (22 író): a ② fázis soros-egyenértéke 589 s-ról ≈350 s-ra; a 11
  sáv-tag Σ170 s-ja 4 szálon fut, a maradék ~300 s soros időt egy kapu uralja (outreach-link-live 159 s — a park
  MINDEN lead-lapját megnyitja). Az összidő 1028 → 684 s, de a két futás terhelése eltért (load 30–40 vs ~20), ezért
  csak a kapunkénti idők A/B-je mérvadó. A futtató összegző sora mostantól kiírja a két ②-sáv saját idejét.
- A következő nyereség helye kimérve: 5 soros kapu egyetlen kölcsönzött `scrape_run`-sora (saját fixture-rel sávba
  emelhetők) és az outreach-link-live enumerációja — tulajdonosi döntés, ebben a körben nem nyúltam hozzájuk.
- Mellékleletek a tulajnak: a „kölcsönzött sor” osztály 36 `*-check`-ben 73 helyen él (olvasókban is — a
  help-collapse-check tünetét a szülő session sessionek KÖZÖTT mérte); 380+380 árva `scrape_run`/`scraper_definition`
  a module-purchase-state takarítás-lyukából; `EMAIL_PROVIDER=smtp` mellett a `maintainDatedPrices`-sweepes kapuk
  valódi levelet küldhetnek dev-tenantnak.

**Elvetve:** (a) lista a futtatóban — a kapu szerkesztője nem látná, mit ígér; (b) a jelölés az őr zöldje
alapján automatikusan — az őr szöveges, a termék-függvénybe nem lát (a `maintainDatedPrices` osztályt
csak az audit hozta elő); (c) a kölcsönzött-sor kapuk „gyakorlatilag stabil” (árva sorra mutató) besorolása
sávba — a heap-slot újrahasznosítás mért, nem szerződés.

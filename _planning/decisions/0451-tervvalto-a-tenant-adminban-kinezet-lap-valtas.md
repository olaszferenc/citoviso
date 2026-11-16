## ADR-0451 — Tervváltó a tenant-adminban: „Kinézet” lap, váltás bármikor a lead saját tervei között

**Dátum:** 2026-11-16 · **Döntött:** tulaj („a 2 két tervet bármikor lehessen váltogatni. Miért ne?”; a C3 mock
„3.A” változata; a terv egészére „igen mehet”) · **Kapcsolódik:** ADR-0449 (a próba, a folytatás és a rendelés a
nézett/futó tervből), plan-tabs (`listProspectPlans`, §I „egyszer felajánlott terv marad”), ADR-0063 (fordítás
„stale”), ADR-0045 (§J súgó), §B.17 (tényhűség), §2b (terv-kapu)

**Kontextus (mérve, B felmérés).** A lead linkje legfeljebb 3 tervet kínál (`MAX_PLANS`); élesen 1706 terv-pár,
a teljes `siteData` 80%-ban azonos. A vevő szerkesztései (`site.edited_site_data`) mezőnév-alapúak, a
modul-tartalom külön táblákban van, a renderút csak DB-t és cache-t olvas — a váltás `site.source_artifact_id`
csere + `rerenderTenantSnapshot`, fizetős hívás nélkül. A vevőnek eddig nem volt módja a próba vagy a vásárlás
után másik tervre váltani.

**Döntés.**
1. **„Kinézet” fül** a tenant-admin „Az oldalam” csoportjának élén, jelvénnyel („N. terv”); az Áttekintés
   nyitókép-kártyáján „Kinézet: N. terv” + „Másik terv”. Terv-kártyák élő előnézettel, „Ezt választom” →
   megerősítés (próba / élő szöveg) → kész-sáv „Megnézem az oldalt” + „Visszavonás”. Kontraktus:
   `assets/design-refs/console/tervvalto-admin/README.md`. JS nélkül is működik (szerver-oldali állapotok).
2. **Csak a lead SAJÁT tervei** (`tenantPlanSet` → `listProspectPlans`, a prospect, amelynek készlete a futó
   tervet tartalmazza). Nyers sablon-csere nincs (megkerülné Vera, a dizájn-kapu és a szobamodul-szűrő
   ellenőrzését). Kurátor által **elutasított** terv nem választható; kivétel a csak testvér-jóváhagyás miatt
   („`superseded_by:`”) elutasított terv — az könyvelés, nem ítélet, és nélküle a visszavonás elbukna.
3. **Jóváhagyás = a vevő választása** (a 2026-09-13-i szabály, ADR-0449 mintája): a `generated` terv a váltáskor
   `approveArtifactForBuyerOrder`-rel approved lesz (naplózva, `site_switch:<site>`), így a `/folytatas` →
   `requestPayment` kapuja átengedi, és a fizetéskori konverzió a futó tervet élesíti.
4. **Napló:** `site_plan_switch(site_id, from_artifact_id, to_artifact_id, at, actor)` (migráció 0138). A
   visszavonás = váltás az előzőre, ugyanúgy naplózva. A `from/to` szándékosan idegen kulcs nélküli (a napló
   történet; a SET NULL a lead-törlés kaszkádjával ütközött).
5. **Sorrend és visszaállás:** a site-sor előbb mozdul (a render a DB-ből olvas), sikertelen rendernél
   visszaáll, a régi terv újrarenderel, és nem íródik napló-sor.
6. **Előnézet = élő render a vevő tartalmával** (`renderTenantPlanPreview`, `GET /admin/kinezet/elonezet`): a
   brief a cache-elt terv-képeket javasolta, de azok a hideg mockot mutatják; a render ugyanúgy ingyenes,
   semmit nem ír, és azt mutatja, amit a vevő váltás után kap (§B.17).
7. **Fordítás:** a váltás a fordítás tartalom-hash-ét elmozdíthatja → „stale” (igaz), de a „szöveg változott”
   levél nem megy ki (`rerenderTenantSnapshot({ quietStale: true })`) — a változást a vevő maga választotta.
8. **Horgony-alias** (`cit-runtime.js`): egy mentett régi sablon-horgony (`#t-gallery`, `#h-rooms`, `#ko-faq`,
   `#cit-contact` …) az új terven a megfelelő szakaszra visz; létező horgonyhoz nem nyúl.
9. **Szöveg-pontosítás (§B.17):** a mock „a szövegei … megmaradnak” mondata túlígért. A felület: az átírt szövegek,
   a képek, az elérhetőség és a modulok tartalma marad; amit a vevő nem írt át, ott a másik terv saját szövege
   látszik (néhol kicsit eltér).

**Kapu:** `scripts/plan-switch-check.mts` (+ `--self-test`), pre-commit bekötve; mock szolgáltatókkal fut.
**Súgó:** `kb/entries/admin-look/` (`admin.look`), képek a `kb-shot.mts`-ből.
**Élesítés:** migráció 0138 → `deploy-prod.sh` pg_dump-pal. Meglévő tenantoknál nincs teendő: a váltó csak ott
kínál választást, ahol a lead linkjén 2+ terv volt (élesen 6 a 13-ból, B 2.2).

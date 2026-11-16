# Tervváltó a tenant-adminban — „Kinézet” lap (A) — jóváhagyott terv

**Jóváhagyva:** 2026-11-16, tulajdonosi döntés (§2b terv-kapu). A tulaj kérése: „a 2 két tervet bármikor lehessen
váltogatni. Miért ne?” → a C3 mock **3.A** változata (külön „Kinézet” lap), majd a terv egészére: „igen mehet”.
**Vázlat:** `plan.html` (csak az A változat; Próba / Megrendelve állapot, Mobil 390px / Asztali váltó). A mock
Talentum Erdei Iskola valós két tervének képeit mutatja.
**Hatókör:** `src/server/planSwitchViews.ts` · `src/server/adminViews.ts`
**Háttér:** a B felmérés (`~/rc-briefs/tervvaltas/jelentes-B.md`) és a C3 jelentés. ADR: `_planning/decisions/*-tervvalto-admin*`.
**Megvalósítás:** `src/tenant/planSwitch.ts` (`tenantPlanSet`, `switchSitePlan`) · `src/tenant/editor.ts`
(`renderTenantPlanPreview`, `rerenderTenantSnapshot({ quietStale })`) · `src/server/planSwitchViews.ts` (a lap) ·
`src/server/adminViews.ts` (menüpont + jelvény, Áttekintés-kártya) · `src/server/public.ts` (`/admin?tab=kinezet`,
`POST /admin/kinezet`, `GET /admin/kinezet/elonezet`) · `assets/runtime/cit-runtime.js` (horgony-alias) ·
migráció `0138_site_plan_switch.sql` · kapu `scripts/plan-switch-check.mts`.

## Mit KÖT ez a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Menüpont:** „Kinézet” az oldalsáv „Az oldalam” csoportjában, ELSŐ helyen; mellette jelvény a futó tervvel
   („1. terv”). Mobilon a Menüben (fiók) érhető el, és az Áttekintés kártyájáról. Az alsó sáv öt pontja nem változik.
2. **Csak a lead SAJÁT tervei** (amiket a linkjén látott, `listProspectPlans`, legfeljebb 3). Nyers sablon-csere
   nincs. Egy kurátor által elutasított terv nem választható (a lapon látszik, „Nem választható”).
3. **Egy terv esetén** a lap kimondja, hogy ehhez az oldalhoz egy terv készült, és nem kínál váltást
   (a menüpont ilyenkor is megvan, jelvény nélkül).
4. **Előnézeti kártyák** tervenként: kép, „N. terv”, egysoros leírás (a sablonból), „Ez látszik most” jelölés a
   futón. „Asztali nézet / Telefonos nézet” váltó: asztalin egymás mellett, mobilon két oszlopban.
   Gombok: futó terven „Ezt használja” (tiltott), a többin **„Ezt választom”**; mindegyiken
   „Megnézem nagyban” (mobilon „Nagyban”) → teljes képernyős, görgethető előnézet Asztali/Telefon váltóval és
   „Ezt választom” gombbal.
   ⭐ **Megvalósítási pontosítás:** az előnézet nem a hideg mock képe, hanem a terv élő renderje a vevő
   MOSTANI tartalmával (átírt szövegek, képek, modulok) — azt látja, amit váltás után kapna. Ingyenes:
   csak DB + cache olvasás, nincs fizetős hívás (B 2.7); semmit nem ír.
5. **„Ezt választom” → megerősítés:** cím „Átvált a N. tervre?”, a futó és az új terv bélyegképe egymás mellett
   („Most: …” → „Új: …”), utána:
   - **Próba alatt:** „A próbaoldala azonnal az új tervvel jelenik meg. A próba ideje nem változik ({dátum}).”
   - **Élő oldalon:** borostyán figyelmeztetés: „Az oldala élő: a vendégek azonnal az új tervet látják.”
   - a megmaradó dolgok mondata (lásd 7.), és: „Bármikor visszaválthat az N. tervre — ugyanígy, egy kattintással.”
   - „Mégsem” · „Átváltok a N. tervre”; nyomás után „Átváltás… az oldala újraépül az új tervvel.”
   A megerősítés JS nélkül is működik (szerver-oldali állapot, `?valaszt=N`).
6. **Kész-sáv** a váltás után: „Kész — az oldala mostantól a N. tervvel látszik.” + próba: „A próbaoldala már az új
   kinézettel jelenik meg.” / élő: „A vendégek már az új kinézetet látják.” Gombok: **„Megnézem az oldalt”** (új lapon)
   és **„Visszavonás ({n}. terv)”** — megerősítés nélkül visszavált az előzőre (a visszavonás = váltás az előzőre,
   ugyanúgy naplózva).
7. **⛔ Szöveg-pontosítás (§B.17 — a mock túlígért):** a mock azt írta: „a szövegei, képei és beállításai megmaradnak”.
   Igaz állítás, és ez KÖT: **az ÁTÍRT szövegek, a feltöltött/átrendezett képek, az elérhetőség és a modulok tartalma
   marad; amit a vevő nem írt át, ott a másik terv saját szövege látszik** (a terv-párok ~20%-ában ez kicsit eltér,
   B 2.1/2.2). Feliratok:
   - megerősítés: „A **módosításai megmaradnak**: az átírt szövegek, a feltöltött és átrendezett képek, az elérhetőség
     és a modulok tartalma. Amit nem írt át, ott a másik terv saját szövege látszik — ez néhol kicsit eltér.”
   - **„Váltáskor megmarad”** doboz: az átírt szövegek (név, szlogen, bemutatkozás, kiemelések) · a feltöltött képek és
     a sorrendjük, a nyitókép · elérhetőség, térkép · modulok és beállításaik, árak, foglalások, üzenetek · webcím és a
     próba / előfizetés.
   - **„Ami változik”** doboz: elrendezés (hol áll a kép, a cím, a gombok) · betűtípusok és színek · a szakaszok
     sorrendje és formája · amit nem írt át: a másik terv saját szövege látszik (néhol kicsit eltér).
   - kész-sáv: „Az átírt szövegei, a képei és a beállításai megmaradtak.”
8. **Áttekintés nyitókép-kártyája:** címke „Kinézet: N. terv” és **„Másik terv”** belépő (→ Kinézet lap) — csak ha
   2+ terv van.
9. **Fizetés:** a próba utáni `/folytatas` a `site.source_artifact_id`-t viszi (ADR-0449), tehát váltás után a rendelés
   a FUTÓ tervet veszi meg. A váltás a választott `generated` tervet jóváhagyja (`approveArtifactForBuyerOrder`,
   naplózva), hogy a fizetési kapu átengedje.
10. **Nincs mellékhatás-levél:** ha a váltás a fordítások tartalom-hash-ét elmozdítja, a fordítás „elavult” lesz
    (igaz), de a „szöveg változott” értesítés nem megy ki — a változást a vevő maga választotta (B 2.6).
11. **Mentett belső linkek:** egy régi sablon-horgony (`#t-gallery`, `#h-rooms`, `#ko-faq`, `#cit-contact` …) az új
    terven a megfelelő szakaszra visz (`cit-runtime.js`, horgony-alias), nem az oldal tetejére.
12. Saját felület: `--citui-*` tokenek, ikon `src/ui/icons.ts`, emoji nincs; minden felirat `T()` (§B.18).

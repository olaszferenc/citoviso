## ADR-0189 — A mock-kártya a MOCKOT mutassa: pillanatkép a nyitóoldalról, harmadakkora kártyán (2026-09-20)

**Kontextus.** A lead-lap „Mock és generálás" fülén az artefaktumok teljes szélességű panelekként
álltak egymás alatt — a tulaj beküldött képernyőképén **mérve 1529 × 586 px**, tizennyolc mezős
recept-ráccsal. Három baj egyszerre: ① a generáló-panel volt a fül első eleme, tehát a MEGLÉVŐ
mockok a hajtás alá kerültek; ② két mock összehasonlításához görgetni kellett; ③ **a mock
LÁTVÁNYA sehol nem jelent meg**, pedig a kurátor pont azt ítéli meg. Az ADR-0164 (lead-page terv)
④ pontja az összehasonlító táblával a *különbséget* megoldotta — a *látványt* nem.

**Döntés.** A kártya a §2b kapun ment át: három változat (kép-vezérelt / adat-vezérelt /
sor-igazított subgrid), asztali ÉS mobil képen, kattintható HTML-lel, valós adaton. A tulaj az
**A — kép-vezérelt csempét** választotta, **mobilon 1 oszloppal**. Kontraktus:
`assets/design-refs/console/mock-cards/`.

1. **Ha van mock, az a fül első eleme**; a generáló/forrás/másoló panel alá kerül, csukva. Mock
   nélküli leaden fordítva — egy üres rács nem lehet a lap első mondata.
2. **A kártya alapból CSUKVA, és kártyánként nyílik.** A csukott kártyán csak az áll, ami a
   mockok között KÜLÖNBÖZIK (pillanatkép · sablon · képszám · nyitókép · a négy kapu). Minden
   más — recept, indoklások, AI-költség, nyers adat, élesítés, törlés — a kinyitott részbe
   költözött. ⛔ **Semmi nem tűnt el**: a kisebb kártya rétegezés, nem információ-vesztés, és ezt
   az őr tételesen ki is méri.
3. **Pillanatkép a generált nyitóoldalról** — a `heroShot.ts` MÁR LÉTEZŐ gyorstárából, vagyis
   **ugyanaz a kép, ami a megkeresésbe megy**. Új: kártyára méretezett JPEG (`ensureCardJpeg`) és
   három artefaktum-szintű útvonal (`shot.jpg` · `shot-state` · `POST shot`).

**⭐ A pillanatkép ÁLLAPOTA is felirat, nem csak a kép.** Négy állapot, mind kimondja magát:
kész · készül · hibázott (az OKKAL) · még nem kérték. ⛔ **`<img>` CSAK `ready` esetén születik**,
és a kép-útvonal **CSAK GYORSTÁR** — soha nem renderel. Ez nem óvatosság, hanem egy MEGFIZETETT
lecke: az Elek FK-004 H1-ben ugyanez az `<img>` 2×30 s Chromiumot indított, a végén 404-et adott,
a kurátor pedig egy törött-kép ikon mellett látott élő küldés-gombot. Az őr legfontosabb két
állítása ezért NEGATÍV: „hiányzó képnél SEHOL nincs `<img>`" és „a kép-kérés NEM indított
renderelést".

**Mérve (nem becsülve).** Csukott kártya **403 × 476 px = a mai 21 %-a** · asztalin **3 kártya /
sor**, 390 px-en **1** · a négy kapu **egyetlen sorban**.

**Két saját hiba, ami a munka közben derült ki.**
- A kapu-jelvények a teljes `mockInputLabel` névvel (`Tényhűség-kapu`) **két sorba törtek** —
  szemben a tulaj által jóváhagyott képpel. A jóváhagyott vázlat a kontraktus: a KÓDOT igazítottam
  hozzá (rövid név a `Kapuk` felirat alatt, a teljes név a `title`-ben), nem a tervet a kódhoz.
- A méret-állítás először **a KINYITOTT kártyát mérte** (391 × 1131 = a mai 49 %-a, piros). A terv
  a CSUKOTT kártyát köti — egy kinyitott kártya más kérdésre felel.

**Egy őrt igazítottam — de csak a viselkedés MÉRÉSE után.** A `lead-tab-anchor-check` pirosra ment
az új `#a-<uuid>` visszairányításon. Előbb megmértem, hogy a fül-kapcsoló a panelen BELÜLI
horgonyra is vált (`mock-card-plan-check` ⑧: a mock-fülre vált **és** a kártya látszik), és csak
utána vettem fel a prefixet — a mérésre hivatkozva, prefixre szűkítve, nem „minden ismeretlenre".

**A feliratokat NEM neveztem át.** Az `előnézet ▸` és a `prospect-konfigurátor ▸` szó szerint
szerepel az `elek/scenarios/FK-003b`-ben és a `kb/entries/console-lead`-ben — egy „szebb"
rövidítés mindkettőt elnémította volna.

**Hatókör:** `src/console/views.ts` · `src/console/server.ts` · `src/outreach/heroShot.ts` ·
`public/assets/ui/citui-console.css`. Kapu: `scripts/mock-card-plan-check.mts` (piros önteszttel,
pre-commitbe kötve).

**Amit SZÁNDÉKOSAN nem old meg:** a pillanatkép automatikus legyártását a generáláskor (Chromium a
generálási úton — külön döntés), és az ADR-0164 ④ összehasonlító tábláját (azt a C változat
váltotta volna ki, és a tulaj nem azt választotta).

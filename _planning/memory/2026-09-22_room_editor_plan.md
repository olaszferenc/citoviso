# 2026-09-22 — A tenant-admin SZOBA-SZERKESZTŐ §2b terv-köre (ADR-0198)

**Mandátum:** `~/rc-briefs/rooms-admin-brief.md` (tulajdonosi, 2026-09-21). §2b kapu: terv előbb,
kód csak jóváhagyás után. **Élesítés NEM volt feladat. Kód NEM született.**

## Mi lett

A tulaj a **D változatot** hagyta jóvá: *„B tetszik. kártya kattintás popup és fülek elrendezés."*
Kontraktus befagyasztva: **`assets/design-refs/tenant-admin/room-editor/`** (README + `plan.html`
+ 8 kép, mobil ÉS asztali). Döntés: **ADR-0198**.

## A mért kiindulópont (ez adta a kérés súlyát)

| Tény | Mérés |
|---|---|
| a 4 szoba egyetlen görgetés, kinyitás nélkül | **9 103 px** mobilon, **6 422 px** asztalin |
| egy szoba KÉT űrlapon szerkeszthető | név+férőhely a „Mit ad ki?" kártyán, leírás+képek külön |
| borítókép-fogalom nincs | `editor.ts` — `const mine = unitPhotos.get(u.id) ?? []; const own = mine[0];` |
| **két szoba UGYANAZT a fotót mutatja a honlapon** | a `p3` kép a Tetőtéri ELSŐ és a Kerti faház EGYETLEN képe |
| a felszereltség-választó kinyitva ül | 70 tétel × 4 szoba |

## A terv-kör menete

1. **Fixture a TERMÉK forrásából**: dev DB (`site_unit` + `edited_site_data.photos`) + a valódi
   ikon-resolver (`amenityByLabel`/`amenitySvg`) → **17/17 pontos katalógus-találat**. A képek
   base64-ben inline-olva (önhordó terv), a CSS a valódi `citui.css` + `citui-admin.css`.
2. **Három változat egy fájlban** (A lista · B kártyarács · C fülek), négy kapcsoló-tengellyel:
   Változat · Méret (`@container`, nem `@media`) · Adat (valós/kitöltött minta) · Felszereltség
   modul (be/ki). **Mindhárom változat mobilra ÉS asztalra külön tervezve.**
3. **Mérő** (`check-admin-plan.mts`): minden láthatóság-állítás a KIFESTETT téglalapot méri.
4. A tulaj választott → **D változat** megépítve, mérve, elküldve, jóváhagyva.
5. Befagyasztás + ADR + land.

## ⛔ Hat hiba — négyet a KÉP fogott meg, kettőt a saját mérőm hazudott zöldre

**Amit a gépi mérés átengedett, és a kép mutatott meg:**
1. a státusz-jelvény **94 px-nyi darabját levágta** a kártya `overflow:hidden`-je — pont azt nem
   lehetett elolvasni, AMI HIÁNYZIK; a görgető-doboz túlcsordulása közben **0 px** volt
2. a feltöltő csempe a szalag végén asztalin **kiszorult a vízszintes görgetésbe** — a tulaj
   legfőbb kérése a képen nem is látszott
3. a terv **címsora navy-on-navy** (kontraszt **1,00**): a `citui.css` a `h1`-nek saját sötét
   színt ad, a sötét sáv `color` öröklése nem írja felül
4. a Felszereltség fül üres szobánál **nagy fehér semmi** (21 % kitöltöttség)

**Hamis zöldek a SAJÁT mérőmben:**
5. „az ütközés-figyelmeztetés ELTŰNT" → a két jelvény ott volt a DOM-ban, helyesen frissítve;
   a kattintás **auto-görgetése** tolta ki a keretből (**y = −275 px**). Keret-metszet nem
   alkalmas annak bizonyítására, hogy valami MEGSZŰNT.
6. a kontraszt-parserem a `color-mix()` `color(srgb 0.97 0.94 0.87)` alakját **0–255-ként**
   olvasta → világos háttér ≈ fekete → **3,32 / 3,21 „éppen átment"** álértékek. Javítva: 5,53 / 5,57.
   ⭐ A gyanú a küszöb körüli értékből jött — a szabály másodszor is fizetett.
7. (bónusz) a „kitölti-e a felugrót" mérés `scrollHeight/clientHeight`-tal dolgozott, ami rövid
   tartalomnál **100 %-ra csuklik** — az üres lapra is zöldet adott.
8. (bónusz) két állítás a **data-URL első 64 karakterét** hasonlította: két JPEG feje azonos,
   tehát az egyenlőség-vizsgálat hamisan ÁTENGEDETT volna egy néma borító-váltást.

⭐ **Amit CSAK a szigorított mérés hozott elő:** a kártya státusz-jelvényének színét egy
leíró-szöveg szabály **(0,1,1)** verte a jelvény **(0,1,0)** fölött → mind a 4 jelvény semleges
szürke, kontraszt 5,5 → 4,2. Ugyanaz a specificitás-ütközés, mint a link-szabály vs. gomb-szín.

Minden javításhoz **negatív kontroll** (a javítás előtti állapoton piros). Záró mérés:
**103 állítás zöld, 0 JS-hiba**, valós adaton, mobil és asztali méreten.

## Koordináció

- A `wt/szobakartya` szál **landolt** (ADR-0195) a munka közben → rebase-eltem rá, és
  ellenőriztem: a borító-szabály (`mine[0]`) változatlanul él, csak új sorszámon.
- A `land.sh` törli a `_drafts/`-ot → a generátor/mérő/fixture **kimentve**:
  `~/rc-briefs/rooms-admin-ref/`.

## Módosított / létrehozott fájlok

- `assets/design-refs/tenant-admin/room-editor/README.md` — a KONTRAKTUS
- `assets/design-refs/tenant-admin/room-editor/plan.html` — a jóváhagyott, működő terv
- `assets/design-refs/tenant-admin/room-editor/D-{mobil,asztali}-*.png` — 8 kép
- `_planning/DECISIONS.md` — ADR-0198
- `_planning/memory/2026-09-22_room_editor_plan.md`, `_planning/memory/INDEX.md`, `MEMORY.md`

## Nyitott

1. **A megvalósítás** — a kontraktus a szerződése. A **kötő feliratok és horgonyok megjelölése a
   megvalósítás UTOLSÓ lépése** (a terv előtt nem létező szöveget jelölni a kaput jogosan buktatná).
2. A szobánkénti borító **tárolási modellje** (jelölés a fotón / egységenkénti sorrend /
   `site_unit` oszlop) — az ADR-0198 szándékosan nyitva hagyja.
3. A **JS nélküli út** megtartása: a mai szerkesztő űrlap-alapú és `<details>`-szel működik JS
   nélkül; a szállított felület ezt nem veszítheti el.
4. A terv-vázlat kint van a dev `:4800`-on
   (`sites/71b04e9d-…/uploads/terv-szoba-szerkeszto.html`) — a land után is ott marad, de a
   kontraktus `plan.html`-je a mérvadó.

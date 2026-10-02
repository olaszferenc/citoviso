## ADR-XXXX — Foglalási aggregátor / portál-host soha nem „saját modern honlap”: egy lista (qualify.ts), visszamenőleges újrabesorolás a prospect-szegmenssel együtt (2026-10-02)

**Státusz:** elfogadva (tulaj: „igen indítsd arra is”, a koordinátoron át; SUB, brief `~/rc-briefs/javitas-elek-0930/a1-aggregator-besorolas.md`) ·
**Lokál, nem élesítve** (§0) · **Kapcsolódó:** ADR-0037 (portál-katalógus mint platform-regiszter), ADR-0306 (a levél szegmens-mondata), Elek H-3.

### Kontextus
A Google Places a saját honlap nélküli szállásnál gyakran egy foglalási aggregátor / meta-kereső linkjét adja „website”-ként.
A `classifyWebsite()` (`src/scraper/qualify.ts`) portál-listája ezeket nem ismerte, így `has_own` → `modern` lett belőlük.
Élesen mérve (csak olvasás, 2026-10-02): **640 lead** váltana (`modern → no_site` 612, `outdated → no_site` 27, + 1 `activation`
kézi): bluepillow.com 361, freecancellations 43, vio 41, hotels-in-hungary.net 35, e-domizil 21, *.com.es 20, fewobird 16,
ferienhausmiete 9, kali.hu 8 (már listán volt, a tárolt verdikt állott), appartman.hu 7, … A konzol ezeket „nem célpont”-nak
mutatta, a levél „A mostani honlapját is megnéztük.”-et írt volna — pedig nincs saját oldaluk, ők a legjobb vevőjelöltek.
A levél nem a lead besorolását, hanem a `prospect.segment` MÁSOLATÁT olvassa (a link létrehozásakor `segmentFromQualification`).

### Döntés
1. **Egy lista:** az aggregátor/portál-hostok a meglévő `PORTAL_DOMAINS`-be kerülnek (`qualify.ts`) — nincs második igazság.
   Szándékosan kimarad: `hotel.hu` és `hotelizator.com` aldomainjei (a `kolping.hotel.hu` a szálloda saját oldala lehet).
2. **A link nem vész el:** a `raw.website` megmarad, csak a verdikt `portal_only` (nem „saját honlap”).
3. **Visszamenőleg:** `scripts/requalify-websites.mts` (alapból száraz; átmenet- és host-összesítő; ismeretlen kapcsolóra exit 2;
   írás `--apply`) — a ki nem küldött link AUTOMATIKUS szegmense követi a leadet egy tranzakcióban; kézzel választott vagy már
   kiküldött szegmenshez nem nyúl. Dev-en lefutott (34 lead). Élesen: a koordinátor viszi, a tulaj engedélyével (élesi írás).
4. **Őr:** `scripts/aggregator-host-check.mts` (pre-commit, `qualify.ts`/`registry.ts` változáskor): 50 mért éles URL → `portal_only`,
   11 valódi saját oldal (danubiushotels.com, kolping.hotel.hu, webnode/wix, violavendeghaz.hu …) → `has_own`, a portál-regiszter
   minden hostja portál a `qualify.ts` szerint, és nincs második host-lista a `src/`-ben. 3 mutációval piros.

### Elvetett
- Külön aggregátor-lista a besoroló mellett: két lista = két igazság (a regiszter fejléce már kimondja, hogy a besorolás a qualify.ts-é).
- A portál-lista DB-be költöztetése most (ADR-0037 szerkezeti útja): nagyobb munka; a lista addig is a seed.

**Visszafordíthatóság:** 🔄 olcsó (lista-sor; az újrabesorolás a régi verdiktet a szkript kimenetében listázza).

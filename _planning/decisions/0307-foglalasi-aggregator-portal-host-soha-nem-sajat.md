## ADR-0307 — Foglalási aggregátor / portál-host soha nem „saját modern honlap”: egy lista (qualify.ts), visszamenőleges újrabesorolás a prospect-szegmenssel együtt (2026-10-02)

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

### Kiegészítés (2026-10-02, koordinátor: „a kétes hostokról mérésből döntsünk”)
**Szabály (a tulajé, a koordinátoron át):** egy host PORTÁL, ha (a) több KÜLÖNBÖZŐ szállás mutat rá, vagy (b) a nyitólapja több
szállást listáz / foglaló-közvetítő. Rövid link → a célhost dönt. Fájl-link (drive/docs.google.com, dropbox) → „nincs saját oldal” (`none`).

**Mérés — az (a) önmagában NEM dönthet:** a 2 360 éles leaden az (a) kb. 70 hostot jelölt, és ebből kb. 25 egy lánc vagy egy
több egységes tulaj SAJÁT oldala (danubiushotels, hunguesthotels, balatontourist, honvedudulo, lschotel = „Luxury Spa Conference”,
tihanyiapatsag, 2× „Princess” a szallassiofokon.hu-n …). Ezek automatikus átsorolása egy láncszállodának írná, hogy „nem találtunk
saját honlapot”. Ezért a kódban (`qualify.ts`):
- `sharedHostCandidates()` — az (a) **jelöltet állít**: ≥2 különböző szállás, amelynek a neve nincs a hostban (az Abbázia 7 épülete
  így nem jelölt). A `requalify-websites.mts` kiírja a jelölteket; **a (b) mérés dönt**, és a verdikt bizonyítékkal a `PORTAL_DOMAINS`-be kerül.
- `FILE_LINK_HOSTS` → `none`; `SHORTENER_HOSTS` + `isShortLink()` — a `requalify-websites.mts` HEAD-del követi az átirányítást (≤5 lépés),
  és a célhost szerint sorol (a `classifyWebsite` tiszta marad, nem hív hálózatot).

**A hét kétes host mért verdiktje:**
| host | (a) különböző szállás | (b) nyitólap | verdikt |
|---|---|---|---|
| siofokszallas.info | 5 | 7 szállást listáz | **portál** |
| visty.site | 13, közös tulaj/márka nélkül | nem elérhető (dev + éles) | **portál** (a) |
| balatonhost.com | 1 | szálláskezelő, 25 szállás | **portál** (b) |
| hotelizator.com | 1 | honlap-építő/-üzemeltető: a szálloda SAJÁT oldala | saját |
| marcaliszallas.hu | 1 (2 rekord, ugyanaz) | egyetlen szállás oldala | saját |
| humtour.com | 1 (2 rekord, ugyanaz) | túraszervező; az aldomain a farm saját foglalós oldala | saját |
| hotel.hu | 1 (Kolping, név a hostban) | nem elérhető | saját |
| tinyurl.com/3fzd2tet | — | → viglink → admin.booking.com | **portál** (2 lead) |
| drive.google.com | — | fájl-link | **nincs saját oldal** (1 lead) |

**Éles hatás (száraz mérés):** 662 lead vált (`modern → no_site` 620, `outdated → no_site` 41, + 1 `activation` kézi); a kétesekből
+22. Dev-en lefutott (+3). Az éles `--apply` a koordinátoré, a deploy után, a tulaj engedélyével.
**Őr:** `aggregator-host-check` + fájl-link, rövid link, „az (a) csak jelöl” állítások; további 3 mutáció piros.
**Nyitott:** a maradék (a)-jelöltek (kb. 35 host, pl. balatonakali.hu, marcali.hu, balatonbereny.hu, vonyarcvashegy.hu települési
oldalak) (b) mérése — a lista a `requalify-websites.mts` kimenetében.

## ADR-XXXX — photo-links: idegen oldal adatlapként, kemény azonosítóval; gépi döntés a közepes sávon

- **Dátum:** 2026-11-28
- **Státusz:** elfogadva (koordinátor `cit9b4690e3`: „mindkét tartalékra általános szabállyal, kézi jóváhagyás nélkül (§2c)”)
- **Módosítja:** ADR-0509 (HR lead-képek) folytatása; a közepes sáv eddigi „csak kurátori jóváhagyással” szabálya (konzol „Jóváhagyom az egyezést”, Vivien 1108db5a, 2026-10-26) — a gomb marad, de nem az egyetlen út
- **Érinti:** `src/scraper/sources/portalListing.ts` (`readPortalListing`: `unknownHostAsListing`, `machineApproved`), `src/scraper/attachPhotoLinks.ts` (`OWN_SITE_UNPROVEN` → adatlap-próba), `scripts/portal-approve-check.mts`; lánc: `kontakt/foto_potlas.mjs` (közepes kontakt-egyezés is az appnak megy)

### Mérve (2026-11-28, élesen olvasva)
A HR képpótlás 527 photo-links írásából 178 sikerült. Az elutasítások:

**„Nem igazolható saját honlap”: 118.** Ezek nem a lead saját oldalai.
- 68 leadnek nincs saját oldala, 34-nek csak portálja van.
- A link mindegyiknél idegen utazási iroda vagy portál adatlapja: ceskekormidlo.cz, geovita.cz, check24.de.
- A registry ezeket nem ismeri, így a saját-oldal ágra kerültek, és ott helyesen buktak.
- Csak 15 lead tényleges saját oldala, de az is más URL-en, mint a tárolt.

A koordinátor eredeti szabálya („a lead kártyájáról vagy `raw.website`-ból jövő URL igazol”) ma is így működik (`sameStoredSite`). Erre a 118-ra nem hat.

**Közepes egyezés: 54.** Kézi jóváhagyásra vártak.

### Döntés
1. **A saját-oldal igazolásán elbukó link adatlapként kap még egy esélyt** (`readPortalListing(…, { unknownHostAsListing: true })`). A portál-olvasó egyezés-kapuja dönt róla (név, település, tű, telefon, házszám).
   - A leadnél tárolt honlap sosem kerül erre az útra.
   - Egy oldal főoldala nem adatlap.
   - **Kemény azonosító kötelező:** a lead telefonja, a házszáma vagy tű ≤ 150 m. A vak mérés két település-cikket kapott el így: az „Insel Brac” leadhez a „Sutivan auf Brač — Ruhiges Inseldorf” név és település alapján átment volna.
   - A jogállás `portal` (más oldala), soha nem tulaj-asset.
2. **Gépi döntés a közepes sávon.** Feltételei:
   - a név-lefedettség ≥ 0,8;
   - a hely igazolt: házszám ✓, vagy tű ≤ 50 m, vagy telefon ✓ és tű ≤ 150 m;
   - nincs ellentmondás: nem eltérő telefon, és nem eltérő utca távoli tűvel.
   A közös telefon egymagában nem dönt: az egy tulajt igazol, nem egy házat (Rózsakő-eset). Feloldatlan típusszó-ütközés a kurátoré marad.
   - Erős egyezésnél a képek a leadhez kerülnek („gépi döntés: ERŐS (…)”).
   - Gyenge egyezésnél nem kerülnek oda, okkal együtt („gépi döntés: GYENGE (név 0,33 < 0,80)”, „ellentmondó telefon/cím”, „a hely nincs igazolva”).
   - A szabály minden portál-olvasásra érvényes: scrape, photo-links, minden országban.

### Igazolás (vak, 2026-11-28)
**Minta:** 40 friss HR lead a mai kontakt-futásokból, 54 link. Egyik sem volt az eddigi pótlásban vagy a korábbi vak mintában.
- **Új hozzárendelés: 2 link, mindkettő jó.** allbookers 12 kép, tű 19 m; hotels-split-dalmatia 30 kép, tű 1 m.
- **Rossz: 0.** A kemény-azonosító szabály előtt 2 rossz volt (település-cikk).
- **Gépi ERŐS:** 2 link, kép nélkül.
- **Gépi GYENGE, okkal:** 6 közepes sávú link (név 0,33 / ellentmondó cím), plusz 3 idegen oldal.
- **Lead-szint:** a ≥ 5 képes leadek száma 17 → 17. Az új hozzárendelést kapott leadek más forrásból már elérték az 5 képet.

**Megmaradt, előzetes hiba (nem e döntésé).** A saját-oldal igazolás elfogad egy domaint, ha az a lead márkaszavát viseli és az oldalon ott a település. Egy földrajzi nevű leadnél ez átenged egy turisztikai oldalt: „Insel Brac” ↔ bracinfo.com/de/sutivan, 17 kép. Külön szabály kell rá.

### Visszafordíthatóság
🔄 Két feltétel a kódban (`unknownHostAsListing`, `machineApproved`). A már beírt profilok a lead `portalProfiles`-ában a `matchReasons` „gépi döntés” sorával azonosíthatók.

### Elvetett
- **„Kártya vagy `raw.website` URL igazol”** mint új szabály: ma is így működik, a 118-ra nem hat.
- **A teljes registry-kibővítés minden látott hosttal.** Hostonkénti lista, nem szabály. Az egyezés-kapu hostfüggetlenül dönt.

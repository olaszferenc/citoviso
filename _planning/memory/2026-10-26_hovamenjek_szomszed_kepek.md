# 2026-10-26 — hovamenjek: a „Közeli szállások” képei nem a lead képei

**Jelzés:** -bb (MG21 Keszthely, a koordinátoron át): Dóra Holiday House és Miss Mici képe szinte minden keszthelyi lead alatt (Abigél, Anikó, Elza, Andrea Wellness, Barbara Wellness).

**Ok:** a hovamenjek-adatlap alján a `div.places_nearby` („Közeli szállások – Keszthely”) blokk 4 szomszéd szállás bélyegképét mutatja, azok saját mappájából (`/upload/places/<placeId>_<hash>/187x187/…`). Az `extract.ownContentOnly` „hasonló szállás” jelzői ezt a blokkot nem ismerték, a `largestPhotoUrl` pedig `fullHd`-re emelte a bélyegképet, így a kép átment a méretszűrőn.

**Mérés (élesen, olvasás):** 900 hovamenjek-profilból 223-ban 373 szomszéd-kép; 18 mock siteData-jában 46 látszik (17 generated, 1 approved). Egy döntetlen eset: Krisztina Panzió 5b577422 (négy 1-képes mappa).

**Javítás:**
- `src/scraper/sources/portals/extract.ts`: `RELATED_BLOCK` += `places_nearby|közeli szállások` (a „Közeli helyek” látnivaló-lista nem az).
- `src/scraper/portalPhotos.ts`: `withoutNeighbourFolders` — profilon belül a leggyakoribb place-mappa a sajátja; döntetlennél a listing slugját viselő fájlnév dönt; ha így sincs egyértelmű vezető, minden marad. A `distinctPortalPhotos` (számlálók) és a generátor `collectPortalPhotos`-a ezt olvassa → újragyűjtés nélkül is tiszta.
- Teszt: `scripts/photo-quality-check.mts` (+7 eset, a régi kódon a kinyerés és a bekötés bukik).

**Nyitott:** a meglévő 18 mock siteData-ja nem változik rerenderre → képlevétel (állandó engedély) vagy újragenerálás. Lista: lásd a koordinátornak küldött jelentést.

# 2026-10-26 — Közepes portál-egyezés: „Jóváhagyom az egyezést”

Koordinátor (citdcb3daea), Neo jelezte. Lokál javítás, élesen NINCS.

## Ok
A fotó-behúzó (és a scrape) a közepes sávú portál-adatlapot `needsReview: true`, fotó NÉLKÜL rögzíti („kurátori jóváhagyásig”), de nem volt sem végpont, sem gomb a jóváhagyásra → a lead örökre TARTVA. Példa: Vivien 1108db5a — hovamenjek, 0,70 (település, 6 m, utca/házszám egyezik), 0 fotó.

## Javítás
- `readPortalListing(url, lead, region, { curatorApproved })`: a jóváhagyás a közepes sávot / feloldatlan típus-ütközést oldja (fotók + vélemények tulajdonítva, vouch, `matchBand: "high"`, ok kiírva); gyenge sávot SOHA (az előbb kiesik).
- `attachPhotoLinks.approvePortalMatch(leadId, url)`: a várakozó adatlapot ÚJRAOLVASSA ($0, csak azt az oldalt), a régi profilt cseréli; nem várakozó URL / sikertelen olvasás / még mindig váró → elutasít, a lead érintetlen. A mentés közös a behúzóval (`saveProfiles`).
- `POST /lead/:id/portal-approve` (flash + #ls-photos, JSON is), aktivitás: `photos.approve`.
- Fotók panel: a link-mező alatt adatlaponként „Közepes egyezés — kurátori jóváhagyásra vár: <host> (0,70)” + **„Jóváhagyom az egyezést”** (a meglévő `con-reenrich` gombminta; §2b: meglévő minta követése, ui-shot mobil+asztali ellenőrizve). KB: `kb/entries/console-lead` új szakasz.
- Őr: `scripts/portal-approve-check.mts` (pre-commit).

## Deploy után
Vivien 1108db5a: a Fotók fülön „Jóváhagyom az egyezést” (operátor/Neo), utána új mock.

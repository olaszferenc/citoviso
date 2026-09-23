## ADR-0031 — Címzett e-mail megadható/módosítható a meglévő követett linken (az outreach-küldés csapdájának feloldása)

- **Kiváltó (2026-08-09):** a követett link „kapcsolati e-mail" mezője opcionális volt, üresen
  maradt; a pipeline-küldés viszont címzettet igényel → a piszkozat-oldalon nem jelent meg a
  „Küldés e-mailben" gomb, a kezelő nem tudta kiküldeni a levelet, és nem volt egyértelmű az ok.
- **Javítás:** a piszkozat-oldal (`/prospect/:id/draft`) E-mail-kártyájába bekerült egy cím-mező +
  „Cím mentése" (`POST /prospect/:id/contact-email` → `setProspectContactEmail`), így a MEGLÉVŐ
  linkhez is megadható/cserélhető a címzett — nem kell új prospectet létrehozni. Cím megadása után
  a §C-PASS mellett azonnal megjelenik a „Küldés e-mailben" gomb.
- **Visszafordíthatóság:** 🔄 könnyű — additív route + űrlapmező.
- **Státusz:** ELFOGADVA / implementálva (2026-08-09).

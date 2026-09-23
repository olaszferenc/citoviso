## ADR-0034 — Tenant-admin: menürendszer + önkiszolgáló modul-kezelés (a „gagyi egy-űrlap" leváltása)

- **Kiváltó (2026-08-14):** a fizető ügyfél admin-felülete egyetlen végtelen, menü nélküli űrlap volt
  (szövegek + fiók + fotók egymás alatt), a modulok pedig CSAK felsorolva, „bővítenél? írj e-mailt"
  szöveggel. A tulaj jogos ítélete: ezért a vevő visszakérné a pénzt.
- **Döntés:** a tenant-admin kap (1) valódi MENÜT — 5 szekció: Áttekintés · Szövegek · Fotók ·
  Modulok · Fiók (`/admin?tab=<id>`, pill-navigáció, mobilon vízszintesen görgethető); (2) ÖNKISZOLGÁLÓ
  MODUL-KEZELÉST: a tulaj maga kapcsolja be/ki a modulokat, látja a havi árat modulonként és az
  összesített díjat (alapdíj + aktív modulok), a gerinc (érdeklődés-CTA) zárolva „az árban" jelöléssel
  (`src/tenant/modules.ts`: getTenantModules/setTenantModules → module_entitlement); (3) ÁTTEKINTŐ
  szekciót: állapot, az oldal valódi publikus címe (csak `live` státusznál), aktív modulok száma és
  egy őszinte TEENDŐ-lista (saját fotó hiánya, rövid bemutatkozó, publikálás állapota).
- **Őszinteség:** a modul-váltás a KÖVETKEZŐ számlázási ciklustól érvényes, és az új szekció a
  következő közzétételkor jelenik meg — a felület ezt kiírja, nem sugall azonnali layout-változást
  (az élő oldal a recipe-ből renderel, az entitlement a számlázási igazság).
- **Visszafordíthatóság:** 🔄 könnyű — additív modul-réteg + nézet-refaktor; a mentő route-ok
  (/admin/text, /photos, /contact, /password) változatlanok.
- **Státusz:** ELFOGADVA / implementálva (2026-08-14).

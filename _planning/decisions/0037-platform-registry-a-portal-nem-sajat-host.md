## ADR-0037 — Platform-registry: a portál/nem-saját-host katalógus DB-be, kurátori bővítéssel (a kódba égetett lista kiváltása)

- **Kiváltó (2026-08-18):** a Brave-élesítés próbamenete (Badacsony, 2 kör) 7 új portál-hostot
  buktatott ki (`szallaskeres`, `kiadoapartman`, `szallashirdeto`, `szallas24`, `iranymagyarorszag`,
  `booked.hu`, `badacsony.hu`), amelyek adatlapjait a rendszer SAJÁT honlapnak hitte. A mechanizmus
  szerkezeti: a portál-adatlap konstrukciónál fogva említi a márkát ÉS a régiót, így a `verify()`
  átengedi — **a host-katalógus az EGYETLEN védelem** a fordított hitelesség-bug ellen (valós
  no-site lead `has_own`-ként kiesik a tölcsérből). Kódba égetett listával ez whack-a-mole:
  **minden új régió új portálokat hoz** (város-turisztikai portálok régiónként!), és minden bővítés
  kód-deploy.
- **Döntés (tulaj, 2026-08-18):** a portál/nem-saját-host katalógus **platform-registry** lesz:
  1. **DB-tábla** (platform-bejegyzés: minta + típus [foglaló-portál | katalógus | város-portál |
     site-builder | social] + illesztési mód [exact-domain | any-TLD | brand-word] + országtag),
     a mai kódlisták (`qualify.ts PORTAL_DOMAINS`, `enrichSiteSearch.ts NON_OWN_HOST`) = seed.
  2. **Kurátori bővítés a konzolból** — új portál felvétele operátor-művelet, nem kód-deploy.
  3. A két fogyasztó (lead-kvalifikáció + kereső-jelölt-szűrő) UGYANABBÓL a registryből olvas
     (ma a két lista széttarthat).
  4. **Site-builder ≠ portál:** hupont/webnode/weebly = a vállalkozás SAJÁT (gyenge) oldala —
     `has_own` marad, de a registry típus-címkéje később minőség-jelzésként használható.
- **Illeszkedés:** a `PORTAL_DOMAINS` kommentje kezdettől ezt ígérte („the Hungarian/accommodation
  seed of the platform registry"); iparág-agnosztikus elv — más vertikum más portál-készletet hoz,
  az adat paraméter, nem kód.
- **Visszafordíthatóság:** 🔄 könnyű — additív tábla + a kódlisták fallback-seedként megmaradnak.
- **Időzítés:** BACKLOG — nem az aktuális fázis tárgya; addig a kódlista bővül leletenként.
- **Státusz:** ELFOGADVA (tulaj, 2026-08-18), implementálás backlogon.

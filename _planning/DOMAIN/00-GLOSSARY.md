# 00 — GLOSSZÁRIUM (Citoviso ontológia)

> A vállalati/domain fogalmak egységes definíciója. Session-indításkor + domain-döntés előtt olvasd. Élő dokumentum — új fogalom felbukkanásakor bővítsd.

## Alapfogalmak
- **Szálláshely / accommodation** — a célügyfél egysége (vendégház, apartman, panzió, nyaraló). Az első vertikum.
- **Vertikum** — standardizált piaci szegmens hasonló struktúrával (szállás: foglalás/képek/leírás/helyszín; étterem: étlap/itallap/asztalfoglalás/képek). A motor vertikumonként sablonosít.
- **Tulaj / owner** — a szálláshely üzemeltetője, a fizető ügyfél. Jellemzően „ingyenhez szokott", alacsony fizetési-hajlandóság anchor.
- **Tenant** — egy legenerált + hosztolt oldal + hozzá tartozó admin egy tulajhoz (multi-tenant SaaS egység).

## Pipeline-fogalmak
- **Ingest** — publikus forrásból (Maps + portál) strukturált adat + kép-URL + egyedi jellemzők kinyerése. Lásd [02-INVARIANTS] provenance.
- **Source** — egy adatforrás-adapter (pl. zimmerinfo.hu, hovamenjek.hu, utisugo.hu, badacsony.hu, Maps). Több Source partial `Property`-t ad, a pipeline merge-eli. ⚠️ **Elérhetőségi gotchák (ingest-tervezéskor):** a portál-oldalról a tényleges `<img src>` kiolvasható és gépileg letölthető; **szallas.hu gyakran 403** WebFetch-re (hovamenjek/zimmerinfo megy); a **Google Maps galéria közvetlenül NEM elérhető** (consent-fal) → a Maps kép-URL + teljes bejegyzés-adat kiolvasása **nyitott kutatás**.
- **Analyze** — a fotókból paletta + stílus-preset kinyerése (vision).
- **Preset** — arculat-sablon egy stílushoz (rusztikus / modern / mediterrán / tavi…) + akcentszín.
- **Mockup** — a legenerált demó-oldal, amit a tulajnak kiküldünk (a hideg megkeresés horga).
- **Mag / unique core** — a szállásra jellemző EGYEDI, valós adat egy dedikált szekcióban (nem generikus töltelék). Kód: `Property.unique`.
- **Outreach** — a mockup-link kiküldése a tulajnak (GDPR/Grt.-tudatos, leiratkozható).
- **Convert** — megrendelés: a tulaj saját (jogtiszta) képei + admin-hozzáférés.

## Üzleti fogalmak
- **Jutalék-horog** — a marketing-üzenet: a booking-portál 15–18% jutalékának kiváltása (nem a honlap ára).
- **Provenance / kép-jogállás** — `owner` | `guest` | `portal` | `generated`; eldönti, mi mehet élesre. Lásd [02-INVARIANTS].
- **Önkiszolgáló admin** — a tulaj maga szerkeszti kép/szöveg → support-minimalizálás (a volumen-modell feltétele).

## Architektúra-fogalmak (iparág-agnosztikus mag)
- **Control plane** — „a MI világunk": leadek, tenantok, entitlement (előfizetés/jogosultság), megvett modulok, iparág-definíciók, ország-lokalizációk, outreach, számlázás, **mock-gyártás**. Központi, a miénk.
- **Data plane** — „a honlap világa", per tenant, **izolált**: Site-tartalom (profil, kínálat), runtime tranzakció (elérhetőség, foglalás), **vendég-PII**, tenant-belső statisztika. A tenanté.
- **Plane-váltás (Mock→Site)** — a Mock a control plane-ben készül (még lead); konverziókor **provisioning** építi ki a data plane-be. A modul-aktiválás = entitlement-vezérelt provisioning (a legtöbb aktiválás nem sémaváltás, hanem jogosultság-kapcsoló → azonnali; kivétel a külső-rendszert igénylő modul → aszinkron).
- **Iparág × Ország** — a motor KÉT tengely mentén paraméterezett: az **Iparág-definíció** (ügyfélút + ügyvitel + adat-séma + modulkészlet) önmagában nem elég, kell rá **Ország-lokalizáció** (jog + nyelv/pénznem + helyi eltérések + árazás). A generáló *mag* közös; a két tengely tölti fel. Új iparág/ország = új **definíció**, nem új kód.
- **Site-képlet** — `Site = Tenant + (Iparág-definíció × Ország-lokalizáció) + Vállalkozás-profil + választott Modulok`.
- **Hibrid render** — **statikus váz** (bemutató: jelenlét/galéria/kínálat/vélemény → CDN/edge, SEO-barát) + **dinamikus szigetek** (elérhetőség/foglalás → élő data-plane). A statikus/dinamikus határ = a **minimum ↔ szofisztikált** (bemutató-mag ↔ tranzakciós-hármas) határ.

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
- **⚠️ Provisioning ≠ Élesítés (két KÜLÖN esemény — ADR-0014):** korábbi zavar forrása. **Provisioning** = a control→data plane technikai kiépítés egy **PRIVÁT** előnézetbe (izolált, per-tenant, kitalálhatatlan token-URL, `noindex`); **fizetés ELŐTT is mehet** (a „nem-pénzes preview", PROCESS.md). **Élesítés (go-live)** = a **NYILVÁNOS** átbillentés (domain/DNS, indexelhető, felfedezhető) — **ez a fizetős kapu** („fizet → nyilvános aktiválás"; a tulaj sorrendje a mérvadó, PROCESS.md tábla 5–6).
- **Site-állapotgép** — `draft` (mock/lead) → `provisioned` (privát előnézet, noindex, token-URL) → `live` (nyilvános, fizetés-kapus) → `suspended`/`deactivated`. A `provisioned`↔`live` külön állapot, **nem** boolean.
- **Túlterhelt szavak (egyértelműsítve):** **„aktiválás"** = *modul-entitlement aktiválás* (technikai, provisioning-részlet) VAGY *oldal-élesítés* (nyilvános go-live) — mindig jelöld, melyik. **„előfizetés"** = *az előfizetés beállítása* (esemény/kapu) VAGY *steady-state* (folyamatos számlázás, §D).
- **Iparág × Ország** — a motor KÉT tengely mentén paraméterezett: az **Iparág-definíció** (ügyfélút + ügyvitel + adat-séma + modulkészlet) önmagában nem elég, kell rá **Ország-lokalizáció** (jog + nyelv/pénznem + helyi eltérések + árazás). A generáló *mag* közös; a két tengely tölti fel. Új iparág/ország = új **definíció**, nem új kód.
- **Site-képlet** — `Site = Tenant + (Iparág-definíció × Ország-lokalizáció) + Vállalkozás-profil + választott Modulok`.
- **Hibrid render** — **statikus váz** (bemutató: jelenlét/galéria/kínálat/vélemény → CDN/edge, SEO-barát) + **dinamikus szigetek** (elérhetőség/foglalás → élő data-plane). A statikus/dinamikus határ = a **minimum ↔ szofisztikált** (bemutató-mag ↔ tranzakciós-hármas) határ.
- **Tier (regiszter/karakter, NEM minőség)** — a szálláshely **stiláris regisztere**: mennyire HŰ a generált oldal a hely valós karakteréhez (paletta melege, formalitás, hangnem, képi világ). Értékek: `egyszeru | kozep | premium | luxus`. ⚠️ **NEM minőség-létra** (ADR-0013): a **gyártási minőség konstans, mindig maximum** — a budget hely is *kiváló* oldalt kap; a `tier` csak a hangnemet/illeszkedést hangolja, nem „jobb/rosszabb"-ot. Budget helyet luxus-jelmezbe öltöztetni ROSSZABB (hiteltelen + üres sáv, ld. ADR-0012). Következmény: a **szerkezet (archetípus) minőség-semleges** → az archetípus-pool közös/tier-agnosztikus; a `tier` lágy súly + bőr-hajtó, nem korpusz-partíció. Kód ma: `mockFromCorpus.ts` (osztályozás + selection).

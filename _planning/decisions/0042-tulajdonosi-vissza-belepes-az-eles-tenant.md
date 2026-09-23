## ADR-0042 — Tulajdonosi vissza-belépés az ÉLES tenant-oldalról (a go-live utáni „hol lépek be?" rés)

- **Kiváltó (tulaj, 2026-08-20):** „Élesítés után a tenant nem tudja, hol tud az adminjába belépni."
- **Lelet:** a rés valós volt. A `serveTenantHost` (`src/server/public.ts`) a live snapshotot `/`-on adta,
  **minden más útvonal 404** — így a tulaj ösztönös `sajátoldala.hu/admin` tippje hibára futott. Az oldal
  láblécében a Citoviso kredit-csík (`src/generator/runtime.ts`) kizárólag a `citoviso.com`-ra mutatott,
  a tulaj felé **semmilyen kapaszkodó nem volt**. Az egyetlen mutató a go-live e-mail — ami elveszik.
- **Döntés — rétegzett, diszkrét megoldás (NEM feltűnő „Belépés" gomb):** a live oldal elsődleges
  közönsége a LÁTOGATÓ (foglalni jött, nem belépni); egy hangsúlyos belépés-gomb az ő konverziós
  útját rontaná. Ezért:
  1. **Kitalálható URL:** a tenant-hoszt `/admin` és `/login` útvonala 404 helyett **302** a tenant-loginra.
     A természetes tipp működik — ez a legolcsóbb és leginkább felfedezhető réteg.
  2. **Halk lábléc-sor:** „Tulajdonosi belépés" a kredit-csík alatt, szándékosan keret nélkül és tompán,
     hogy a csík FOLYTATÁSAKÉNT olvasódjon (ne második sávos lábléc). `rel="nofollow"`.
  3. **A go-live e-mail marad az elsődleges csatorna** — a webes rétegek csak backupok. (A tulaj ezt a
     réteget most nem kérte; a levél belépés-tartalmának auditja NYITOTT.)
- **Architektúra-elv — SERVE-time injektálás, nem generálás-időben** (`src/server/ownerLogin.ts`, a
  `demoFrame.ts` mintája): a motor kimenete tiszta marad, és a link **soha nem szivároghat ki egy
  outreach-mockra**. Ez nem kényelmi kérdés: a mock fázisban NINCS fiók, amibe be lehetne lépni, tehát
  egy „belépés" felirat hamis ígéret volna (§I / §B.17 szomszédsága).
- **i18n:** a felirat `T(d, "…")`-vel születik, a nyelvet a snapshot saját `<html lang>`-je adja
  (ADR-0036). A fájl bekerült a doktrína-láncba (`extract-i18n` / `i18n-lint` / `i18n-scan`), különben
  idegen nyelvű tenant-oldalon némán magyar maradt volna.
- **Dizájn:** a csík szándékosan NEM `--citui-*`-ból színez — az a MI felületünk dizájn-magja; egy
  tenant-oldal a motor `--cit-*` skinjét hordozza, ezért a sornak skin-agnosztikusnak kell lennie.
- **Visszafordíthatóság:** 🔄 könnyű (két additív pont, a motor érintetlen).
- **Státusz:** ELFOGADVA + implementálva lokálban (i18n/dizájn-kapu + `tsc` tiszta, 390px/1280px
  vizuál verifikálva). Kapcsolódó: ADR-0023 (tenant-belépés), ADR-0041 (tenant-hoszt útvonalak),
  ADR-0036 (i18n), 03-INVARIANTS §I.

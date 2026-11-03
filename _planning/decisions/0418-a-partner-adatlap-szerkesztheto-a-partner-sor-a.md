## ADR-0418 — A partner-adatlap szerkeszthető; a partner-sor a számlázás forrása, a nyilatkozat és a kiállított számla érinthetetlen

**Dátum:** 2026-11-03 · **Státusz:** elfogadva (tulaj: A — Fülek terv, lokál, nem élesítve) · Kiegészíti: ADR-0055 (vevő-nyilatkozat), ADR-0414 (rendszer-számlák), ADR-0403 (domain-megújítás), ADR-0109 (domain-díj)

### Kontextus

A tulaj (2026-11-03): „a CRM partner oldalak is semmitmondóak. Olyannyira, hogy partnert nem is tudom
szerkeszteni, pl. kapcsolat. Nem látom a saját domainnevüket, ha megrendelték, annak lejáratát, semmit.”
Élesen mérve (Duna Vibe House, az első fizető vevő): a partner-lap a tenant előfizetését, a domain
életútját, a kártyát, a következő terhelést, a tulaj belépését nem mutatta, és semmi nem volt rajta
szerkeszthető. Közben ugyanannak a vevőnek négy adatforrása van: a lead (marketing-arc), a rendelés
nyilatkozata (`order_intent`, ADR-0055), a partner-sor és a tenant felhasználója (`tenant_user`).

### Döntés

1. **Elrendezés: A — Fülek** (jóváhagyott terv: `assets/design-refs/console/partner-adatlap/`).
   Fejléc + KPI, „Figyelendő” lista, fülek: Áttekintés · Adatok és kapcsolattartók · Előfizetés ·
   Domain · Számlák · Aktivitás · Előzmények. (Az „Üzenetváltások” fül külön tervkörben.)
2. **Mit szerkeszt az operátor:** a partner-sort (számlázási név, ország, cím, adószám, közösségi
   adószám, céges e-mail, telefon, belső megjegyzés) és a kapcsolattartókat (szerep, név, e-mail,
   telefon, elsődleges). Ugyanazokkal a szabályokkal, mint az új partner és a pénztár: HU adószám
   ellenőrzőszámmal (`taxId.ts`), közösségi adószám alakra, telefon E.164-re (`text/phone.ts`),
   szerepenként egy elsődleges, és ha van számlázási kapcsolattartó, egy elsődleges számlázási e-mail.
   A szerver az autoritás; a kliens ugyanezt tükrözi gépelés közben. Az audit-oszlopokba az operátor
   azonosítója kerül.
3. **Forrás-szabály (melyik adat mire hat):**
   - **A partner-sor** az operátor által karbantartott számlázási identitás: a következő számla,
     díjbekérő és megújítás ezt olvassa (`payment/billing.ts` — a megújítás a nyilatkozatot a partner
     adataival írja felül). **Ezt szerkesztjük.**
   - **A rendelés nyilatkozata** (ADR-0055) jogi bizonyíték arról, amit a vevő a fizetéskor állított:
     **soha nem írjuk át** innen.
   - **A kiállított számla** nem változik (javítás = sztornó + új, a számlázó útján).
   - **A lead** a marketing-arc (Maps-név, cím, mock): a partner szerkesztése nem írja át, és
     fordítva sem.
   - **A tulaj belépési e-mailje** (`tenant_user.contact_email`) a tenanté; innen nem változik.
   - **Egy újabb rendelés nyilatkozata** (upsell, domain stb.) a partnert ÚJRA frissíti
     (`billing/partner.ts`, üres mezőt nem töröl) — a vevő friss állítása erősebb, mint egy korábbi
     operátori javítás. Ezt a szerkesztő ki is mondja.
   - A céges e-mail cseréjénél a szerkesztő rákérdez, hogy az elsődleges számla-címzett is
     költözzön-e (alapból igen) — két külön mező, de a vevőnél jellemzően ugyanaz.
4. **A következő terhelés összege** ugyanabból a függvényből jön, amit a vevő a saját adminjában lát
   (`getSubscriptionAdmin().nextChargeTotal`) — egy szám, egy forrás. (A terv képe 4 957 Ft-ot írt;
   a valódi 12-03-i terhelés 6 610 Ft, mert a megkeresési kedvezmény csak az első fizetésre szól.)
5. **A domain-adat gazdája a domain-nyilvántartás** (SUB-E). Amíg az nem landol, a lap egy vékony
   olvasással (`partnerDomains()`) mutatja a `domain_provisioning` + `site` meglévő mezőit;
   migráció nincs.

### Visszafordíthatóság

🔄 Olcsó: nincs séma-változás, nincs adat-migráció; a lap és a végpont visszaállítható.

### Elvetett alternatívák

- **A partner-szerkesztés visszaírja a leadet / a tenant belépési e-mailjét is:** három felület
  (marketing, számlázás, belépés) egy gombnyomásra változna, és egy elírás a tulajt kizárná.
- **A nyilatkozat szerkesztése:** a jogi bizonyítékot írná át — tilos (ADR-0055 ①).
- **Az operátori javítás „zárolása” egy újabb rendelés ellen:** a vevő friss, aláírt állítását
  írná felül egy régebbi kézi adattal; ha kell, külön döntés.

### Őrök

`scripts/partner-edit-check.mts` (szerkesztés végponttól végpontig, kliens + szerver, 390/1280),
`scripts/partner-ui-check.mts` (fülek, szerep-fülek).

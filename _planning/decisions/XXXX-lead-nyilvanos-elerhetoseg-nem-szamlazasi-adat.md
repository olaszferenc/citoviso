## ADR-XXXX — A lead nyilvános címe/országa nem lehet vevő-számlázási adat; a kurátori űrlap nem kap böngésző-kitöltést (2026-10-03)

**Dátum:** 2026-10-03 · **Státusz:** elfogadva (hibajavítás mérés alapján; SUB, brief `~/rc-briefs/fix-lead-elerhetoseg.md`) ·
**Kapcsolódó:** ADR-0029 (kurátor-szerkeszthető lead-adat), ADR-0241 (tenant Elérhetőség — mindent-vagy-semmit minta),
Elek F-1 (`scripts/billing-taxid-in-address-check.mts` — ugyanez a hiba a fordított irányban: szállás → számla).

### Lelet
A dev parkban 7 lead `raw.address`-ében a tesztelő SAJÁT számlázási utcája állt: „Ráckevei út 083/2 hrsz., 24393470213”
(Három Huszár, Lidó — a végén egy érvényes, adószám-formájú szám) és „Ráckevei út 083/2 hrsz. 083/2” (Eldorádó, Sport Üdülő,
Camping Carina, Agrosz, Dencs), az országban „MAGYARORSZÁG”. A generátor ezt minden mockra kitette (hős, fejléc, lábléc,
térkép-kártya).

**Az út (mérve):** a konzol lead-lap „Adatok” űrlapja → `POST /lead/:id/data` → `saveLeadEdits` (`raw.curatorEditedAt`
mind a 7-en; Három Huszár: 2026-09-26 18:12:22, 8 mp-cel a prospect létrehozása ELŐTT — egy tesztkiküldés előkészítése).
A mezők `name="address|country|phone|email"`, autocomplete-tiltás nélkül: a böngésző cím-automatikus kitöltése a gépelő
saját profiljából tölt. Erre utal, hogy ugyanez a sztring betűre áll az `order_intent.buyer_address`-ben (a pénztár-űrlapot
ugyanaz a profil töltötte, 09-26 19:05 Camping Carina), és hogy az ország „Magyarország” lett (a mező helyőrzője „HU”;
a régi kód nagybetűsített). Scrape, konvertálás vagy cégadat-lookup NEM írt a lead címébe.

A telefon/e-mail (06203759440 / 06305161631, a tesztelő Gmail-címei) SZÁNDÉKOS tesztcímzés: mindkét szám az
`OUTREACH_SMS_ALLOWLIST`-en van, a mobil-csatorna címzettje pedig a `lead.raw.phone` (nincs prospect-szintű szám) —
„the owner's allowlisted test phone sits on several test leads by design” (`sendOutreachSms.ts`).

**Élesen** (csak olvasva, 2026-10-03): 3013 lead, 0 cím azonosító-számmal, 0 „Ráckevei”, 0 nem-HU ország; tenant/site 0.
A 3 kurátor-szerkesztett lead közül kettő `[TESZT]`, egy valódi (Bánó Gábor, Köveskál, Fő u. 5 — rendben).

### Döntés
1. **Szerver-szabály, mindent-vagy-semmit** (`src/console/leadContactRules.ts` → `saveLeadEdits`): a cím nem tartalmazhat
   magyar adószámot (a számlázás SAJÁT keresője, `findHuTaxNumberInText` — egy szabály, nem második példány) vagy 10–12 jegyű,
   telefonszám-formájú számot; az ország ISO-2 (a nemzeti nevek — MAGYARORSZÁG, Hungary — HU-ra fordulnak, a többi elutasítva,
   a piaci kapuk `normalizeCountryCode`-jával). Elutasításkor SEMMI nem íródik, a lap flash-sávban megmondja, miért.
2. **Böngésző-kitöltés tiltása az „Adatok” űrlapon — JAVASOLT, §2b-jóváhagyásra vár.** Form `autocomplete="off"` + mezőnként
   nem szabványos `cit-lead-*` token (a Chrome a címekre az `off`-ot figyelmen kívül hagyja, a fel nem ismert tokent nem tölti).
   Látható változás nincs, de a felület-kapu kivételét csak a tulaj adhatja (ADR-0068) — kész patch:
   `~/rc-briefs/patches/lead-edit-autofill-off.patch`. Addig az 1. szabály a garancia (az autofill-csomag elutasítva).
3. **Szándékosan NEM szabály:** „egyezik egy vevő számlázási címével/e-mailjével” — egy két szállásos tulaj, vagy aki a
   kiadott házban lakik, jogosan osztja a címet/e-mailt a lead és egy rendelés között. A szabály csak ellenpélda nélküli
   eseteket utasít el.

### Adat (dev, 2026-10-03)
Mind a 7 leadre `raw.contactRepair` audit-pillanatkép (előtte-értékek). Három Huszár: cím „8274 Köveskál, Fő u. 24.”
(booked.hu JSON-LD), telefon „06 70 364 4977” (Places, `scrapedContact`), e-mail törölve (a scrape-ben nem volt), ország HU.
A másik 6: a számlázási utca törölve (a scrape-ben nem volt cím), ország HU; a tesztcímzéses telefon/e-mail marad.
**Nem javítva (rekord / tenant-adat):** a Három Huszár 10-02-i artefaktuma (`fc728903…`) és 21 másik artefaktum `siteData`-ja
őrzi a régi kontaktot (történeti felvétel — új generálás frissíti); a Camping Carina élő siteján az `edited_site_data.contact.address`
a tenant saját Elérhetőség-mentése.

### Nyitott kérdés (tulaj)
A mobil tesztcímzés ma CSAK a lead nyilvános telefonjának felülírásával lehetséges, így a tesztelő száma a mockra/sablonra is
kimegy. Az e-mailnek van prospect-szintű címzettje („Cím mentése”), a mobilnak nincs. Kell-e prospect-szintű teszt-szám?

**Őr:** `scripts/lead-contact-guard-check.mts` (pre-commit) — ① szabály a mért értékeken, ② mindent-vagy-semmit mentés saját
fixture-ön. Negatív kontroll: a régi kódon 6 piros,
és pontosan a mért állapotot (MAGYARORSZÁG, beírt adószámos cím) állítja elő.

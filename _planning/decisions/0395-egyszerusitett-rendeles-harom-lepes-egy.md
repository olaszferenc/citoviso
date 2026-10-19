## ADR-0395 — Egyszerűsített rendelés: három lépés, egy felajánlott saját cím, feltételek egy kis ablakban (2026-10-19)

**Dátum:** 2026-10-19 · **Státusz:** elfogadva (tulaj: „A”) ·
**Kapcsolódó:** ADR-0240 (két lépés), ADR-0369 (ajánlat-sáv, domain-jelvény), ADR-0360 (domain mint csomag-tartalom), ADR-0381 (díj nélküli igénylés), ADR-0366 (szerver-oldali ár)
**Terv:** `assets/design-refs/console/rendeles-egyszerusitett/` (README = kontraktus)

### Kontextus
A pilot célja információ, nem bevétel. Ehhez vásárló kell. Éles mérés 2026-10-19-én (valódi leadek):
- 63 lead nyitotta meg a mockot, 51 mobilon;
- 5 nyitotta meg a rendelési panelt, ~1 percig;
- 1 jutott a fizetés-lépésig, fizetés 0.

A 390 px-es végigkattintás szerint a panel 1. lépése egyszerre kér csomagot, 11 szekció-kapcsolót és webcímet, egy ~320 px-es görgető ablakban. A webcím-részben ellentmondás volt: a zöld sor szerint „saját .hu cím jár”, kijelölve viszont „Most csak a citoviso.com-os cím” volt. A számlázásnál két görgetés került egymásba.

### Döntés
1. A rendelés **három lépés**: csomag → cím → fizetés. Telefonon teljes képernyő, egy képernyőn egy döntés, a lábléc egy sor (ár + „Tovább”).
2. A szekció-kapcsolók a **„Testre szabom”** mögé kerülnek. A Havi/Éves választás a 3. lépésre kerül.
3. **Saját cím:** ha a csomag hordozza, EGY ellenőrzötten szabad név előre ki van jelölve, felülírható. Foglalt névre egyetlen alternatíva jön, lista nincs. A citoviso-s cím nem választható lehetőség, hanem fix sor, és a választott név címkéjét követi.
4. A domain **feltételei** (hűségidő, vételár, megváltás) nem állnak a panelen. Egy „Feltételek” kis ablak mutatja őket a MA beállított /pricing-értékekből. Indok: a /pricing változik, és a fix szövegek egymásnak ellentmondtak.
5. Az ajánlat (−%) egy sor a láblécben, nem felső sáv.

### Következmény
- Felülírja: `order-two-step`, `period-toggle-step1`, `order-step1-offer`, `escalation-topbar`, `package-domain-badge` §3/§5/§6 és `order-step2-note` (a README táblája szerint). Az ezekre kötött őröket az új viselkedéshez kell igazítani, nem kikapcsolni.
- Gazdasági alap (tulaj): a .hu beszerzése évi 1 990 Ft nettó, ezt egy hónap minimum csomagdíj nagyjából fedezi. Az ingyen cím a tranzakción nem veszteséges.

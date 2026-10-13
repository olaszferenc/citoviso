## ADR-0381 — A csomagban foglalt saját cím díj nélküli igénylése AUTOMATIKUS: ugyanaz a beszerzés, terhelés és zárolás nélkül (2026-10-13)

**Dátum:** 2026-10-13 · **Státusz:** elfogadva (tulaj-döntés a koordinátoron át, 2026-10-13: „kell az automata út”) ·
**Kapcsolódó:** ADR-0360 (csomag-összetétel, a domain mint csomag-tartalom — ennek nyitott pontját zárja), ADR-0362
(domain-díjak, egy rendelés tenantonként), ADR-0372 (ragadt beállítás 24/72 h), ADR-0251 (zárolásos fizetés),
ADR-0093 (0 Ft-os rendelés), ÁSZF 1.5 §9.

**Kontextus.** Ha a tenant csomagja hordozza a saját címet (díj 0), és élő honlap mellé utólag kért nevet, a Webcím
fül „Ezt kérem” gombja csak ház-riasztást küldött (`domain-claim`), a felület azt írta: „Az igénylést munkatársunk
intézi”, a nevet operátor vette meg és kötötte be kézzel. A `createDomainUpgradeOrder` a 0 Ft-os rendelést szándékosan
elutasította, mert a beszerzést a FIZETETT webhook indította. A route-ban már állt egy 0 Ft-os ág (ADR-0093 elengedett
díj), de a fenti elutasítás miatt elérhetetlen volt.

Felderítve — hol kézi ma a csomag-tartalom domain:
- **utólagos igénylés** (élő tenant, Webcím fül): `src/server/public.ts` POST `/admin/domain/order` (ház-riasztás +
  `&kezi=1`), `src/domains/domainUpgrade.ts` `createDomainUpgradeOrder` (0 Ft → null), `src/server/adminViews.ts`
  `domainSection` csomag-ág („munkatársunk intézi”), KB `admin-domain` „Ha a csomagom tartalmazza a saját címet”.
- **megrendeléskor** (első rendelés domainnel): NEM kézi — az `initial` rendelés fizetett aktiválása után a
  `fireDomainProvisioning` (`src/payment/service.ts`) indítja a beszerzést; a csomag-tartalom díja ott 0 sor.
- **próba vége**: NEM kézi — a próba csak platform-aldomaint ad (`src/trial/start.ts`), a folytatás az `initial`
  rendelés fizetésén át ugyanazt az utat járja.

**Döntés.**
1. **Egy függvény:** `claimPackageDomain(tenantId, domain)` (`src/domains/domainUpgrade.ts`). Csak 0 Ft-os árajánlatra
   (különben `not_package` → a hívó a fizetős úton marad). Tenantonként Postgres advisory lockkal sorosít (külön
   kapcsolaton — két fül, dupla kattintás, két folyamat), a blokkoló (ADR-0362) alatt: élő / futó / zárolt rendelés
   mellett `blocked`. Létrehozza a `domain_upgrade` rendelést (a hűségidő és a csomag-padló ugyanúgy fagy), egy 0 Ft-os
   `paid` fizetési sort ír (`gateway='none'`, nincs zárolás, nincs fizetési link, nincs számla), és a beszerzés-sort a
   VÁLASZ ELŐTT létrehozza (`startOrderDomainProvisioning`), így a fül a folyamat-képernyőre érkezik. A futtatás
   (`runDomainProvisioning`) leválasztva megy, mint a zárolásos úton. Egy nyitott, fizetős fizetési link felülíródik.
2. **Ugyanaz a beszerzés:** regisztrátor, DNS, TLS, `setup_retry`, ADR-0372 riasztások változatlanul. A
   `captureDomainReservation` / `releaseDomainReservation` a 0 Ft-os sorra no-op (nincs zárolás).
3. **Hibaág:** a vétel ELŐTTI bukás (`failed`) a fizetős ággal azonos: ház-riasztás (`domain-failed`, a szövegben
   „csomag-tartalom igénylés”), tulaj-levél. A 0 Ft-os sor `cancelled` lesz (`cancelFreeClaim`), így a hűségidő nem
   marad futva (`domainCommitment` csak `paid` sort számol). A levél és a fül pénz-mondat nélkül szól („nem fizetett
   érte semmit”, „a hűségidő sem indult el”) — nem ígér többet, mint a fizetős hibaág. Kézi út csak a ház-riasztás
   nyomán, végső tartalékként.
4. **Felület:** új képernyő nincs. Az Áttekintés csomag-ága az „Ezt kérem” gombbal igényeltet („Nem kell fizetnie,
   és semmit nem zárolunk…”), utána a fizetős út meglévő folyamat / kész / hiba képernyői jönnek; a `DomainMoneyState`
   új értéke a `free` (0 Ft-os sor), amire a pénz-sorok nem jelennek meg. A `&kezi=1` és a `manual` állapot megszűnt.
   §2b-kivétel: a tulaj az automata utat 2026-10-13-án kimondta, a meglévő minta követése.
5. **Kisebb csomag:** változatlan — a megújítás (`domainFeeForRenewal`) a csomagot minden ciklusban újraolvassa, a név
   díja a következő megújításon elindul (ÁSZF 1.5 §9; a felület ezt ma is kiírja).
6. **Őr:** `scripts/domain-package-claim-check.mts` (pre-commit): mock regisztrátoron live, 0 terhelés, 0 ház-riasztás;
   két egyidejű igénylés → egy beszerzés; élő név mellett elutasítva; regisztrátor-hiba → fizetős hibaág, pénz-mondat és
   hűségidő nélkül; csomag nélkül nincs díjmentes igénylés; kisebb csomagnál a díj elindul. A régi kódon 9 bukás.

**Kívül marad:** az 1. lépés díjsora csomag-tartalomnál ma „A név díja 0 Ft/hó…” mondatot ír — ez nem ennek a
döntésnek a része (külön szöveg-kör). → 2026-10-13 rendezve (tulaj „ok”): „A név a csomag része, külön díja nincs. Ha kisebb
csomagra vált, a név díja ({ár}/hó) elindul.” — `_planning/memory/2026-10-13_domain_csomag_dijsor.md`.

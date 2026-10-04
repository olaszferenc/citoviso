## ADR-XXXX — Egy leadnek több e-mail-címe lehet: elsődleges + további; a hideg levél egy címre megy; a kurátor címét az újragyűjtés nem írja felül (2026-10-04)

**Dátum:** 2026-10-04 · **Státusz:** elfogadva (tulaj-döntés: „1. A · 2. Nem · 3. Igen · 4. Nem autofill ha van több email. · 5. ne legyen”;
SUB, brief `~/rc-briefs/tobb-email-cim.md`) · **Terv:** `assets/design-refs/console/lead-multi-email/` (A változat) ·
**Kapcsolódó:** ADR-0029 (kurátor-szerkeszthető lead-adat), ADR-0316 (Adatok mentése mindent-vagy-semmit), ADR-0082/0122
(egy megkeresés csatornánként, címzett-szintű egyszeri zár), ADR-0053 (személy-szintű leiratkozás).

### Lelet (mérve, élesen csak olvasva)
- A tulaj kérése: „lehessen több emailcímet menteni!”. Az „Adatok” fül E-mail mezője egy `type=email` mező volt: az
  `ezustnyar@outlook.hu; agrogere@gmail.com` beírásra a böngésző hibát dobott. Az Ezüst Nyár végül egy címmel maradt.
- Élesen 3013 leadből 692-nél már ma is legalább két elfogadott e-mail-jelölt áll a gyűjtési naplóban (`raw.contacts[]`).
- 5 éles (és 4 dev) lead `raw.email`-je nem egy cím volt, hanem egy sztring:
  - OSM-ből „a;b” (az OSM így tárol több értéket, az `osm.ts` nyersen átvette);
  - egy JS-töredék;
  - vezető szóköz;
  - devben egy `&quot;` entitás.
  Mindez törött `mailto:`-t adott a mockon, és a duplikátum/közös-kontakt kulcs egyik címmel sem egyezett.
- Az újragyűjtés (`reenrichOne`, `reenrich`, `places-medium-backfill`, `scrub-contacts`, `portal-backfill`) a
  `curatorEditedAt`-ot sehol nem olvasta:
  - a „nem igazolt” tárolt címet lecserélte;
  - a nem üzleti címet (pl. a tulaj gmailje) törölte.
  Ezt tette, miközben a konzol gombja ezt írja: „Nem ír felül kurátori adatot.”

### Döntés
1. **Tárolás (séma-változás nincs, `lead.raw` jsonb):**
   - `raw.email` = az ELSŐDLEGES cím, változatlan jelentéssel;
   - `raw.otherEmails` = a további címek, a kurátor sorrendjében.
   Az elsődleges sosem ismétlődik a listában. Miért nem `emails[]` csere: a `raw.email`-t kb. 15 forrásfájl és 10 szkript
   olvassa közvetlenül, és a `siteData.contact.email`-en át kb. 40 sablon-hely is ebből él. Mindnek az elsődleges a
   helyes válasz. A listát csak a listát IGÉNYLŐ fogyasztók olvassák, a közös `leadEmails()`-en át
   (`src/email/leadEmails.ts`): az űrlap, a fejléc, a közös-kontakt kapu, a duplikátum-keresés és az Elérhetőségek fül.
2. **Formátum:** a MAI szabály (a böngésző `type=email`-je, WHATWG), mostantól a szerveren is, címenként (tulaj 5.: szigorúbb
   ne legyen). Ugyanaz a postafiók (`recipientKey`: kisbetű, `+címke` le) kétszer = elutasítás. Az egész mentés
   mindent-vagy-semmit (ADR-0316).
3. **Hideg levél: EGY megkeresés EGY címre** (ADR-0082/0122 változatlan). A további címek a lead adatai, nem címzettek: a
   rendszer rájuk soha nem küld. A megkeresés címzettjét (`prospect.contact_email`) ma is az operátor adja meg. Előtöltés
   NINCS (tulaj 4. „Nem autofill ha van több email”) — a pontos szabály (egycímes leadnél előtöltés?) nyitott kérdés.
4. **Nyilvános megjelenés:** a mock és a honlap kizárólag az elsődleges címet mutatja.
5. **Leiratkozás:** címenként, személy-szintű — VÁLTOZATLAN. Egy cím leiratkozása NEM tiltja a lead többi címét (tulaj 2.).
6. **A kurátor e-mailje a kurátoré** (tulaj 3., `src/scraper/curatorEmail.ts`). Egy kurátori mentés után a scrape-utak a
   `raw.email`/`raw.otherEmails`-hez nem nyúlnak:
   - nem cserélik;
   - nem törlik;
   - a kurátor által törölt címet sem töltik vissza.
   Kivétel az érintetlen hiány: se most, se az első mentéskor nem volt cím. Új címet a gyűjtés a `raw.contacts[]` naplóba
   tehet, onnan nincs automatikus felvétel.
7. **Adatgyűjtés:** az OSM `email` tagje `;` mentén bomlik: az első érvényes cím az elsődleges, a többi a lista, a szemét
   kiesik. A dedupe a listát az elsődlegesével együtt viszi. Lead-összevonáskor a lista EGY egység: a megtartott leadé,
   vagy ha annak nincs címe, az elnyelté. Unió nincs.
8. **Adatjavítás:** a `migrations/0086_lead_email_list.sql` a már többcímes `raw.email` sorokat szétbontja, ugyanazzal a
   szabállyal. Az eredeti sztring a `raw.emailSplitRepair.before` mezőben marad. Ha nem marad cím, a kontakt-csatorna a
   telefonra áll. Idempotens.

### Elvetett
- **B változat (címkék egy mezőben):** tömörebb, de a hosszú cím levágódik, és nem mondja ki szövegesen az elsődleges szerepét.
- **„Ha egy cím leiratkozott, az egész lead tiltott”:** a tulaj elvetette (2.).
- **Gyűjtött jelöltek egy kattintásos ajánlása az űrlapon:** a tulaj elvetette (4.). Az „elfogadott” jelöltek egy része
  szemét (dev: LindenTree, 4 idegen gmail).
- **Szigorúbb formátum** (pont + ≥2 betűs végződés, a tenant Elérhetőség szabálya): a tulaj elvetette (5.).

**Őr:** `scripts/lead-contact-guard-check.mts` ④–⑥ (szabály, lista-mentés, kurátori e-mail, OSM-bontás). Negatív
kontroll: a lista-mentés és a kurátor-védelem kikapcsolásakor 7 piros.

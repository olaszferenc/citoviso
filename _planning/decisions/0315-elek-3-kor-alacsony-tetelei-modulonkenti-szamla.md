## ADR-0315 — Elek 3. kör alacsony tételei: modulonkénti számla-sor pontos összeggel, kupon az első díjra, egy megtakarítás, „Ez még nem fizetés.” (2026-10-03)

**Dátum:** 2026-10-03 · **Státusz:** elfogadva (tulaj-döntések koordinátoron át: „L3/s: B · ADM3-1: A · INV-1: B”, majd „L-6 = A”;
SUB, brief `~/rc-briefs/javitas-elek-0930/k3-elek3-leletek.md` 6. pont) · **Forrás:** Elek 3. élesi köre ·
**Kapcsolódó:** ADR-0205 (kedvezmény a tétel nevében, kedvezmény-sor tilos), ADR-0088 ⑨, ADR-0240 (order-two-step), ADR-0313.

**Kontraktusok (befagyasztva, mock + ui-shot mindkét méretben):** `console/invoice-module-lines`, `tenant-admin/coupon-first-month`,
`console/order-step1-offer` (módosítja az `order-two-step` ①-et), `console/order-step2-note`.

1. **INV-1 (B) — modulonként külön számla-sor.** A modul-vásárlás (`kind='upsell'`) számlája: `Citoviso modul: <név> (<havi|éves>)`
   soronként (kupon esetén „— <p>% kedvezménnyel”). A tulaj a kerekítést ránk bízta: a Számlázz.hu összeadja a tételeket, ezért
   `splitInvoiceAmount` — minden sor ≥ 1 Ft (0 Ft-os sor nincs), a többi a havidíj arányában lefelé, a TELJES maradék a legnagyobb
   havidíjú sorra (egyenlőségnél az elsőre). 0 modul → egy „Citoviso modul-bővítés” sor; összeg < modulszám → egy összevont sor.
   A domain-díj külön sor marad. A hónapszám a rendelésen nincs tárolva, ezért a sorok nem a konfirmációs kártya modulonkénti
   bontását másolják, hanem a terhelt összeget osztják szét; az összeg betűre egyezik. Őr: `invoice-module-lines-check`
   (söprés 0–3000 Ft × 7 súlykészlet, 0/1/sok modul, 98%, kupon nélkül, domain, Számlázz-XML) — 7 mutáció piros.
2. **ADM3-1 (A) — a kupon az első díjra szól.** Kártya: áthúzott listaár, „+367 Ft az első hónapban”, alatta „utána +490 Ft/hó”
   (éves fióknál „az első évben” / „…/év”). `couponCardPrice`. Őr: `module-card-coupon-check` — 4 mutáció piros.
3. **L3-2 (B) — egy ajánlat, egy megtakarítás.** Az 1. lépés áthúzza ugyanazt a listaárat, mint a 2. lépés kártyája; az ajánlat-sor
   „<név> (−p%) −<Ft> az első díjból” a 2. lépés összegével; ajánlatnál nincs változás-csip (zöld „−2 325 Ft/hó” megtakarításnak
   olvasódott). 4. **L-6 (A):** a 2. lépés jegyzete „Ez még nem fizetés.”-sel kezdődik. Őr: `order-step1-offer-check` (valódi
   böngésző, 390 px + asztal) — 5 mutáció piros; az `optout-offer-price-check` az új formát is elfogadja.

**Mellék-javítás:** a `mail-link-get-safe-check` pozitív kontrollja ADR-0313 óta különböző napokra teszi a látogatásokat (a mainen
5c3170b5 óta piros volt).

**Visszafordíthatóság:** 🔄 — tiszta függvények és szövegek; a számla-szétosztás egy függvényben él.

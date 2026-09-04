# Elszámolás-képernyő — JÓVÁHAGYOTT TERV (B változat, ADR-0094)

**Jóváhagyva:** 2026-09-04 (tulaj, RC-session) · **Generátor:** `scripts/domain-buyout-drafts.mts`
· **Fájl:** `elszamolas-b.html` (kattintható mock — nyisd meg, próbáld ki)

Ez a terv a megvalósítás **KONTRAKTUSA** — elvárt viselkedés, nem stílus-javaslat.

## Mikor jelenik meg

A tenant-admin Modulok fül „Előfizetés lemondása" gombja — HA a tenantnak FUTÓ domain-hűsége van
(`activeDomainCommitment()` nem null) — NEM a mai kétlépéses `<details>` megerősítést adja, hanem
erre a **külön, közbeiktatott elszámolás-lapra** visz. A lemondás CSAK erről a lapról zárható le.
Hűség nélküli tenantnál a mai lemondás-doboz változatlan.

## Amit a terv KÖT (elvárt viselkedés)

1. **Hűség-sáv:** a domain neve + „a vállalt N hónapból M telt el, K van hátra" + folyamat-mérő.
   Az adat az `activeDomainCommitment()`-ből jön (valós hónapok, nem minta).
2. **Tételes elszámolás-számla:**
   - „Hátralévő hűségidő: K hónap × <vállalt minimum> (vállalt minimum)" = kötbér — MINDIG szerepel;
   - „Webcím vételára — csak ha elviszi": alapból „—";
   - „Összesen fizetendő": élőben frissül.
3. **Webcím-pipa** („A webcímet is elviszem, + <vételár>"): bepipálva a vételár-sor, a végösszeg,
   a piros gomb felirata ÉS a következmény-szöveg EGYÜTT vált. A vételár a pricing
   `domain_buyout_price`-a, a kötbér-alap a rendelésen befagyasztott `committed_min_monthly`.
4. **Következmény-sáv** (piros): kimondja a domain sorsát („elviszi → a fizetés után az Öné" /
   „nem viszi → nálunk marad") + hogy a honlap a kifizetett időszak vége után nem lesz elérhető.
5. **Piros fő gomb:** „Elszámolás és lemondás — <összeg>" — az összeg a gombon is él.
6. **„Mégsem mondom le — vissza"** ghost-gomb: elszámolás nélkül visszavisz, semmi nem íródik.
7. **Záró képernyő:** az elszámolás rögzítését, a fizetés útját (e-mail linkkel), a honlap
   elérhetőségének végdátumát és a domain sorsát mondja ki; plusz a szabály: a tulajdonjog CSAK a
   maradéktalan rendezés után száll át (ÁSZF §9).

## Háttér-szabályok (már kódban, ADR-0094)

- Hűségidő alatt nincs szabad lemondás; kötbér = hátralévő hónapok × vállalt minimum.
- A domain vételára opcionális tétel (csak ha elviszi); enélkül a domain nálunk marad.
- Csomag-padló: a modul-váltás a `committed_min_monthly` alá atomian elutasítva (él).

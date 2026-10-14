## ADR-0388 — A foglalásnál a gyerekszámot mindig megkérdezzük

**Dátum:** 2026-10-14 · **Kontextus:** az éles végigteszt (2026-10-14) lelete, tulaj-döntés: „mehet”. **Kiterjeszti:** ADR-0384 (a gyermekként megadott vendég IFA-mentes), ADR-0378 (gyerekár).

### Kiváltó
Az „Ebből gyermek” léptető csak akkor működött, ha a szállásadó valamelyik ellátásnál gyerekárat adott meg. Egy friss próbán így a vendég nem tudta megadni, hogy gyerekkel jön, pedig a szállásadónak tudnia kell, és a 18 év alatti IFA-mentesség is ezen múlik.
Mérés közben kiderült még egy hiba: a `.cit-book__field {display:grid}` szabály felülírta a `[hidden]` attribútumot, ezért minden ellátás nélküli oldalon látszott egy üres „Ellátás” legördülő és egy halott „Ebből gyermek” léptető, ami mindig 0-ra ugrott vissza.

### Döntés
1. **A gyerekszám mező mindig ott van** a szelvényen (mobil és asztal), a próba-foglalásban és a szerveren (`clampChildren`: 0 … vendégek − 1, egy felnőtt mindig foglal).
2. **Korhatár:** ha a választott egységre gyerekár vonatkozik, a szállásadó korhatára számít, „(N éves korig)” felirattal, és az ellátás ára is ehhez igazodik, ahogy eddig. Ha nincs gyerekár, a felirat **„(18 év alatt)”**, és a gyerekszám csak az IFA-ra hat, az árra nem. Egy szabály, két példány: `countedChildAge` a `src/tenant/meals.ts`-ben és `kidAge` a `cit-runtime.js`-ben.
3. **Az IFA-mondat igaz marad:** gyerekár nélkül „…a gyermekként megadott vendégeket nem számoltuk bele.”, gyerekárral a mondat a {N+1}–17 éveseket is kimondja (ADR-0384 ②).
4. **A létszám mindenhol ugyanazokkal a szavakkal szerepel:** „3 fő, ebből 1 gyermek”. Így írja a vendég nyugtája, a minta-nyugta, a levelek és az admin foglalás-kártyája; az ellátás-címkéről a gyerekszám a létszám mellé került.
5. A `.cit-book__field[hidden] { display: none; }` szabály pótolva.

### Őr
`scripts/booking-tax-receipt-check.mts` ③b (ellátás nélkül, 390 px és 1280 px: a mező látszik, a felirat „(18 év alatt)”, IFA × 2 fő, a 13–17 mondat nincs ott, beküldés), valamint a szerver-ág (ellátás nélkül is tárolja a gyerekszámot, a levél „3 fő, ebből 1 gyermek”). A `meals-check` és a `booking-setup-check` változatlanul zöld.

### Visszafordíthatóság
🔄 könnyű. Séma nem változott, a `children` oszlop eddig is megvolt. A korábbi kérések `children = null` értéke továbbra is azt jelenti, hogy nem kérdeztük. Élesre a következő deployjal kerül, utána az élő tenant-oldalakat újra kell renderelni.

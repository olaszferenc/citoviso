## ADR-0267 — Az árajánlat ára alapból csak arra a kérésre szól; az árlistába csak kérésre kerül (a kért napokra vagy alapárként), és a kiküldött ajánlatok listája megmondja, mi lett vele

**Dátum:** 2026-09-29 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) ·
**Felülírja:** ADR-0215 ①.3 („az ár MINDIG az árlistába kerül … dátum nélkül időtlen alapárként”) és a
`booking-offer` kontraktus 5–6. pontját · **Kapcsolódó:** ADR-0215 (a lánc többi része változatlan),
ADR-0256 ① (a widget az első áras egységen nyílik), ADR-0257 (csak egyben kiadó ház), ADR-0222 (a „nincs ár”
predikátuma) · **Kontraktus:** `assets/design-refs/tenant-admin/booking-offer-scope/` („A”) ·
**Migráció:** `0080_booking_offer_saved_as.sql` · **Őr:** `scripts/booking-offer-check.mts` (S①–S⑥)

### A mért tényállás

A koordinátor leírta, mi lesz egy elfogadott árajánlat árából, a tulaj: *„Ez a döntés amúgy nem hangzik túl
életszerűnek.”* Mérve (egy-szállásos kör, Myrna Haus, 2026-09-28; dev DB 2026-09-29): egy 90 000 Ft/éj ajánlat
az egész házon **időtlen alapár** lett (a sor 10 ms-mal az `offered_at` előtt született), a ház `sort_order 0`,
ezért az ADR-0256 ① szerint a vendég-widget onnantól **a házon nyílt**, és a ház árajánlatosból
**foglalhatóvá** vált. Ez ütközik az ADR-0257-tel (csak egyben kiadó házra ár nélkül árajánlat-kérés jár).
A dev DB-ben 19 alapárból 1 született ajánlatból; dátumos sor 0. (Alsó korlát: a `unit_price`-nak nincs
forrása, a fixtúrák a kéréseket takarítják.) Ugyanitt egy felirat-hiba: „Ez lesz a **szoba** alapára” az egész
házra is.

**Fogyasztók** (`feedback_widening_a_shared_list_needs_per_consumer_decision`) — mind a `unit_price`-t olvassa,
és egyiknek sem szabad egy „csak erre a kérésre” árat látnia: vendég-widget / `/api/foglaltsag` · a honlap
renderelése (Árak, szoba-kártya ár, alapértelmezett egység, `unpriced` jel) · a `/api/foglalas` árbefagyasztás ·
az Árak lap (`unitPriceStatus`) · teendő-sor + heti hiány-levél (`priceGap.ts`) · az ajánlat-lap
(`unpricedNights`) · lejárat-emlékeztető/-törlés (`priceExpiry.ts`) · szezon-nudge · `availability.ts`.

### Döntés (§2b kör, 3 változat mindkét méreten; a tulaj: „OK A)”, „Kért Napok”, mezőnév: „igen”)

1. **Alapból csak erre a kérésre.** Az ajánlat-lapon egy alapból üres pipa: „Mentsem az árlistába is?”. Üres
   pipánál a `unit_price` **nem íródik**; az összeg a kérésre fagy (`quoted_total`/`quoted_lines`), mint eddig.
   Az összeg **ugyanazzal a szabállyal** számolódik: memóriában ugyanazok a sorok (`offerOverlayRows`), amiket a
   „kért napok” írna, így a két út összege nem térhet el.
2. **A pipa két útja:** „Csak a kért napokra” = dátumos alapár a tartózkodás **árazatlan éjszakáira**,
   összefüggő szakaszonként egy ablak (sosem árazott éjszakán át, mert az `addDatedBasePrice` az átfedő dátumos
   ablakot lecseréli) — **nem „mától”** (ez volt az ADR-0215 szabálya). „Alapárként” = időtlen alapár, mint eddig.
   Pipa út nélkül a szerver megtagadja a küldést, és semmit nem ír.
3. **Emlékeztető nélkül:** a „kért napokra” ablak a tartózkodással ér véget, a 14 napos „hamarosan lejár egy
   ár” levél zaj lenne → a sor a bélyeggel (`expiry_notified_at`) születik. A lejárat utáni törlés és
   újrarenderelés marad; a bélyeg nélküli (ADR-0215 alatti) dátumos soroknak az emlékeztető jár (piros kontroll).
4. **A lap kimondja a következményt**, élőben: üres pipa → „Csak erre a kérésre.”; alapár → „… ettől
   foglalhatóvá válik …”, és ha ettől ez lesz a widget alapértelmezett egysége (az előtte álló foglalható
   egységeknek nincs sora, és több foglalható egység van), „A foglalási doboz is ezzel nyílik.” Az egységet
   „az egész szállás” / „ez a szoba” szerint nevezi; a kérés adatainál „Amit kér” (nem „Szoba”).
5. **`booking_request.offer_saved_as`** (`'request' | 'dates' | 'base'`, a név a tulajé): hova került az ár.
   Tárolni kell, mert utólag nem következtethető ki (a sornak nincs forrása, a dátumos sor lejártakor törlődik).
   A döntés előtti ajánlatoknál NULL, backfill nincs (a tulaj: *„minek javítunk dev rekordot?”* — a Myrna Haus
   90 000 Ft-os tesztsora érintetlen marad).
6. **„Kiküldött ajánlatok”** a Foglalások fül alján (`getSentOffers`, `sentOffersSection`): minden ajánlat,
   lezártak is — kinek, mit, mikorra, mennyiért, mikor ment ki, mi lett vele, és az „Árlista” oszlopban hova
   került az ár (NULL-nál „—”). Ez felel a tulaj 2026-09-23-i mondatára: *„nem fogja tudni nyomon követni,
   kinek mi ment el”* — eddig egy lezárt ajánlat beolvadt a „Korábbi kérések” közé, ár és „ajánlat volt” jel nélkül.
   Az ajánlat-lap „Foglalások megnyitása” gombja eddig a Foglalás-MODUL beállításaira vitt (nincs rajta kérés);
   mostantól a Foglalások fülre, a küldés után egyenesen a listához (a tudásbázis-őr fogta meg).

### Ami tudottan nyitva marad

- A widget `unpriced` jele „egyáltalán nincs ársor” (`editor.ts`): egy „kért napokra” ablak élete alatt az egység
  nem viseli az „egyedi ár” jelet, és ha első a sorban, a widget azon nyílik — más napokra árajánlat-módban. A
  lap ezt a „kért napokra” mondatban nem ígéri másképp („más napokra továbbra is árajánlatot kérnek”), de a
  jel pontosítása (horizonton belüli teljes ár) külön kérdés.
- Az FK-014 ⑦ árajánlat-kérése eddig csak akkor volt valódi, ha az FK-015 előző éjszakai köre nem árazta be a
  házat (az ADR-0215 alatt beárazta) — mostantól alapból nem árazza.

### Tanulság

Egy „nyoma maradjon” igényre (*„nem fogja tudni nyomon követni”*) az ADR-0215 az ÁRLISTÁT tette meg nyomnak —
pedig az árlista a vendégnek szóló ÍGÉRET, nem napló. A nyom egy lista lett; az ígéret a tulaj kifejezett döntése.

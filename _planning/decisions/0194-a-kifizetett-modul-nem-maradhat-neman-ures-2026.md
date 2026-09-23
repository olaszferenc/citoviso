## ADR-0194 — A kifizetett modul nem maradhat némán üres (2026-09-21)

**Dátum:** 2026-09-21 · **Státusz:** elfogadva (megvalósítva, őrrel) · **Kapcsolódó:**
ADR-0113 (a modul a FIZETÉSKOR kapcsol be), ADR-0080 ③, ADR-0044 (modul-konfig réteg),
ADR-0193 / ADR-0192 ② (`isRenderedModule` — a JOGOSULTSÁGI kapu, lásd a határt lentebb),
kontraktus: `assets/design-refs/tenant-admin/paid-empty/README.md`.

### A mért tényállás

A tulaj a saját tenantján 14 775 Ft-ért vett három modult (`pricing` + `poi` + `booking`).
A `booking` kapott tartalmat és renderelt. A másik kettő üresen maradt, ezért az ÉLŐ lapról
**teljesen hiányzott**: a kiszolgált HTML-ben az „Árak" és „A környéken" szó egyaránt
**0-szor** fordult elő. A felület mindeközben végig azt mondta, hogy minden rendben: a
modul-lista „aktív"-ot írt, az Áttekintés csempéje beszámolta a számlázott modulok közé, a
Teendők lista pedig csak fotóról, bemutatkozóról és publikálásról beszélt.

Vagyis: **fizetett, nem kapott semmit, és nem is tudta meg.** Ez ugyanaz a kár-osztály, mint
amit az ADR-0129 a kiküldésnél zár: a hiba nem az, hogy valami elromlott, hanem hogy a
rendszer a hiányt sikernek mutatta.

### A döntés

1. **Minden SZÁMLÁZOTT modul, amelyiknek van valódi üres állapota és üres, saját teendő-sort
   kap** az Áttekintés lapon: a modul nevével, az árával, a tétellel („kifizette, de üres,
   ezért a vendég ma nem látja"), a modulra szabott magyarázattal és egy kattintásnyi kiúttal.
2. **Az ürességet a RENDERELŐ SAJÁT kimenete dönti el** — a `moduleContentFor().data` mezőinek
   megléte —, nem egy második heurisztika. ⛔ A „van-e `site_module_config` sora" kérdés NEM
   ugyanez: egy config sor létezhet üres tömbbel, és akkor a lapon továbbra sincs semmi. Az a
   kérdés zöldre futott volna, miközben a vevő üres szakaszt lát.
3. **Öt modulnak van üres állapota:** `pricing`, `poi`, `hours`, `amenities`, `rooms`.
   ⛔ `booking`, `location`, `reviews`, `enquiry` SOHA nem kerülhet a listára: üresen is
   renderelnek valamit (minta-naptár, cím/geo, „még nincs értékelés" blokk, gerinc), náluk az
   „üres" állítás hamis riasztás lenne. A `gallery` sem (tartalma a fotó-lista, arról külön
   teendő szól), és az `usp` sem (tartalma a template kiemeléseibe szövődik, tehát üres mező
   mellett is láthat belőle a vendég). **A hamis riasztás ugyanolyan kár, mint a néma hiba.**
4. **A sor a fiók ÜTEMÉBEN áraz.** Az ár-szabály (`annualMultiplier` + `modulePriceForm`)
   modul-szintre emelve, hogy a Modulok fül és ez a sor EGY példányból dolgozzon — egy
   beégetett „490 Ft/hó" éves fiókon két különböző osztót tett volna a tulaj két képernyőjére.

### A határ az ADR-0193 felé (fontos, mert a nevek megtévesztők)

`isRenderedModule()` / `siteRendersModule()` azt mondja meg, hogy a modul **be van-e
kapcsolva** (`active && !supersededBy`) — NEM azt, hogy van-e rajta tartalom. A kettő
eltérhet, és a mért esetünk épp ilyen: az eldorádós `pricing`-re a `siteRendersModule`
**igazat** ad, miközben a lapon egyetlen ár sincs.

⚠️ **Ebből következik egy NYITOTT kérdés, ami nem ezé a szálé:** az ADR-0193 ár-jogosultsági
kapuja (`/api/foglaltsag`, `createBookingRequest`) a jogosultságot kérdezi. Egy KIFIZETETT,
de ÜRES `pricing` mellett tehát továbbra is árat számolhat és fagyaszthat be a vendég
levelébe, miközben a lapon nincs ár. Ezt meg kell mérni és eldönteni — külön szálban.

### Őr

`scripts/paid-empty-check.mts` (bekötve a `hooks/pre-commit`-be): méri a predikátumot
(pozitív ÉS negatív kontrollal, a „soha" listával együtt) és a RENDERELT sort (név · ár a
helyes ütemben · a tétel · a teendő-mondat · élő href). `--self-test` visszarontva 20 bukás.
⛔ A fixtúra a `MODULE_CATALOG`-ból származtatja a modulneveket: az első változat kézzel
gépelt, KITALÁLT nevet használt („Érkezés, távozás" a valódi „Nyitvatartás, érkezés"
helyett), a súgó ugyanazt idézte, és így az őr a saját téves feltevését igazolta vissza —
zárt hurokban, amit csak a tudásbázis-őr emberi verdiktje tört meg.

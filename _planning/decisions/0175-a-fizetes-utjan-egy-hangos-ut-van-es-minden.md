## ADR-0175 — A fizetés útján EGY hangos út van, és minden képernyő megmondja, MIT fizet a vevő (2026-09-15)

**Dátum:** 2026-09-15 · **Státusz:** ELFOGADVA (tulajdonosi döntés: „A — a fizetés a főszereplő”)
**Kontraktus:** `assets/design-refs/console/pay-gateway-exit/` ·
**Kapcsolódó:** ADR-0129 ③ (néma zsákutca nincs), ADR-0164 (a terv szerkezete is köt),
ADR-0021 ① (dizájn-tokenek), 03-INVARIANTS §B.17.

**Kiváltó (mérve 2026-09-15, betöltött stíluslappal, a valós exportált nézet-függvényeken).**

① A fizetési átjárón a „Fizetek ▸” és az „Elutasítom” **bájtra azonosan** renderelődött: mindkettő
**35 px magas, `font-weight: 600`, 12,5 px, fehér háttér, 999 px lekerekítés** — egyedül a
szövegszín tért el. A képernyőn semmi nem mondta meg, melyik a művelet és melyik a visszaút.
② Egyik lap sem nevezte meg, **MIT** fizet a vevő (`terméknév: false` mind a négy állapotban):
csak egy összeg állt ott. ③ A hivatkozási azonosító csupasz `<code>` volt, **másoló gomb nélkül** —
egy kódot a képernyőről kellett volna átgépelni, épp a legrosszabb pillanatban. ④ A bukás-lapról
az újrapróbáláson és egy mailto-n túl **nem vezetett nevesített út sehová**.

**A döntés.**

① **Egy hangos út, egy halkabb visszaút.** A fizetés-gomb kitöltött; a visszalépés kontúros,
**mérhetően** kisebb és könnyebb (51 vs 42 px, 700 vs 600, 15,2 vs 13,6 px). ⛔ A hierarchiát
NEM a szín hordozza: szín-vak olvasónál a két egyforma pirula továbbra is két egyforma pirula
volna. A visszaút nem tűnik el és nem megy a tapintható méret alá.
② **Minden fizetés-képernyő megnevezi a terméket** — szállásnév + termék + ciklus, a
`payment → order_intent → prospect → lead` úton. ⛔ Név nélkül a sor a termékre szűkül, nem
talál ki nevet (§B.17). A join LEFT: egy elveszett prospect-sor nem teheti renderelhetetlenné a
fizetés lapját.
③ **A hivatkozási azonosító másolható**, mindkét lapon; a `<code>` a jelölésben marad, tehát JS
nélkül is megvan.
④ **Minden lapról van nevesített kiút** (kezelőfelület · másik kártya · ember). ⛔ De **üres sávot
nem rajzolunk**: ha egyik út sincs (első vásárló, nincs retry-link, nincs cím), az elválasztó
sem jelenik meg — egy vonal a semmi fölött rosszabb, mint a semmi.

**⛔ Amit a KÉP fogott meg, és a DOM-mérés nem.** Az első CSS-em mindkét gombot **navy
gradienssel** festette: a generikus `.con button[type="submit"]:not(.ok):not(.bad):not(.hp-alt)
:not(.con-btn2)` (0,6,1) **veri** a `.con .pay-act button[type="submit"]`-et (0,3,1). A magasság és
a betűvastagság HELYES volt — a festés nem. Ugyanaz a specificitás-csapda, mint a `.con a`
link-szabály a gomb-feliraton (ADR-0121 köre). Ezért az őr a **festést is** méri, nem csak a dobozt.

**⛔ Egy őr-állítás MÁS KÉRDÉSRE válaszolt.** A „rendezett fizetésen nincs terhelést indító gomb”
szabályt a korábbi őr `buttons.length === 0`-val mérte. Amint a lapra került egy tökéletesen
ártalmatlan **másoló gomb**, a kapu pirosra ment — helyes kódon. A proxy a *gombok számát*
kérdezte, nem azt, hogy *lehet-e terhelést indítani*. Most az űrlapokat és a submit-gombokat méri.

**Őr:** `scripts/pay-exit-truth-check.mts` — **53 állítás** a RENDERELT, stíluslappal kiszolgált
lapokon (a gomb-hierarchia a forrásban láthatatlan: két `<button>` a kódban ugyanúgy néz ki).
Fixtúrák a §B.17 ágakra: **név nélkül** nincs kitalált név, **kiút nélkül** nincs üres sáv.
Piros önteszt: **18 sértés**, minden szabály-csoportra külön visszarontással — köztük a szállított
hiba szó szerint (a halk visszaút ugyanolyan súlyúra állítva).

**Hatókör-korlát, kimondva.** Az átjáró a **MOCK** átjáró, a valós Barion pay-link helyén: élesben
a Barion lapja jön, tehát ott ez a hierarchia nem a mi kezünkben van. Azért kötjük mégis, mert ezt
méri az Elek, ez megy ki minden nem-Barion úton, és a tétel-sor meg a másolható azonosító a saját
lapjainkon marad érvényes.

**Visszafordíthatóság:** 🔄 felület-szintű, adatmigráció nincs. **Élesítés:** NINCS (§0.3).

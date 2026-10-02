## ADR-0308 — A nem megvett modul szekciója nem látszik az élő lapon; az adat léte nem modul

**Dátum:** 2026-10-02 · **Státusz:** elfogadva (hibajavítás, mérés alapján) · **Forrás:** Elek 2. élesi köre, LV-1
**Kapcsolódó:** ADR-0059 (usp a sablon natív kiemelés-szekciójába), ADR-0089 ⑦ (galéria nem megvéve → szekció le), T-1 `paid-module-anchor-check` (a fordított irány)

### Probléma (mérve)

3 modulos rendelés (gallery, enquiry, location) élő HTML-jében kint volt a `data-cit-module="usp"`
(a lead kiemelései: „Medence a kertben, reggeli a teraszon”) és a `reviews-pending` blokk („Vendégek
véleménye … közzététel előtt a szállásadó hagyja jóvá”), az admin viszont mindkettőt „Még nem vette
meg” alatt sorolta. Ugyanazon az adaton lokálban mérve: vélemény-blokk **20/20**, usp-szekció **15/20** sablonon.
Ok: az élő render nem kérdezte, mit vett meg a bérlő — az adat (lead-kiemelések, Google-értékelés)
a modultól függetlenül létezik, és a szekció az adatra rajzolt ki.

### Döntés

1. **Melyik gerinc?** Csak az, amit a katalógus `spine`-nak jelöl (ma: `enquiry`). A usp (490 Ft/hó)
   és a reviews (690 Ft/hó) fizetős modul → **az admin mondott igazat, az élő lap szivárogtatott.**
   A cold mock konfigurátora ki nem választva ugyanígy elrejti őket (`anchorsOf` → `closest("section")`),
   tehát a javítás a mock=live elvet állítja helyre, nem új szabály.
2. **Egy helyen vágunk:** `unboughtPageAnchors()` (src/modules.ts, a katalógusból származtatva) adja a
   nem megvett modulok horgonyait, a `renderSite({ hideAnchors })` a kész HTML-ből leveszi őket (a galéria-vágás
   általánosítása; a szekció is megy, ha üres maradna; a rá mutató menü-link is). Minden élő út kapja:
   pillanatkép, egységoldalak, többnyelvű, tenant-előnézet, provizionálási privát előnézet.
   Kimarad: gerinc, galéria (saját út: a fejléc-kép marad), `booking` (a szekciója hordozza a gerinc űrlapját).
3. **A usp-horgony nem foglalhat le idegen tartalmat:** ha a kiemeléseket tartó `<section>` a bevezetőt
   is tartalmazza (mérve: wordmark-grow), a horgony a kiemeléseket tartó legszűkebb elemre kerül.
   Különben a „usp ki” a bevezetőt is levinné — a mockban és az élőn is.
4. A fejléc csillag-statisztikája („4,8 ★ Google-értékelés”) a lead ténye, nem a modul felülete — marad.

### Őr

`scripts/unbought-module-leak-check.mts` (pre-commit, diff-scope-olt): valódi jogosultság-sorok, az élő
összerakáson át, mind a 20 sablonon; mellékkár-ág (név, bevezető, gerinc marad), pozitív kontroll
(megvéve visszajön), végpontig a pillanatkép-íróval; `--self-test`: vágás nélkül piros.
Mellékmérés: a `detectPresentModules()` a `<style>`-beli `[data-cit-module=…]` szelektort is jelenlétnek
olvassa (amenities 5 sablonon álpozitív) — az új őr ezért csak a jelölést nézi; a meglévő detektor nem változott.

### Visszafordíthatóság

🔄 Teljesen: a `hideAnchors` üresen hagyva a régi viselkedés áll vissza.

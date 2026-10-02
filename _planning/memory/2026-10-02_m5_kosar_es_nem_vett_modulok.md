# 2026-10-02 — M5: a kosár kimondja a függőséget, nem megvett modul nem látszik élőn, kampány a saját nevén (Elek 2. kör)

**Szál:** SUB M5 (`~/wt/cit4db98e6b`), koordinátor: CIT „élesi teszt” (`~/wt/cit87d3f275`). Brief: `~/rc-briefs/javitas-elek-0930/m5-kosar-es-nem-vett-modulok.md` + koordinátori ADM-2.
**Tulaj-döntés (2026-10-02, a koordinátoron át):** „1. igen 2. igen 3. B”.

## Elvégezve
- **LV-1** — mérés: a katalógus egyetlen gerince az `enquiry`; a usp/reviews fizetős → az admin igaz, az élő lap szivárgott (usp 15/20, reviews 20/20 sablon). A mock-konfigurátor ki nem választva elrejti őket (`anchorsOf` → `closest("section")`), az élő render nem kérdezte. Javítás: `unboughtPageAnchors()` (modules.ts) + `renderSite({ hideAnchors })` (render.ts, a galéria-vágás általánosítása, tag-illesztéssel — a `<style>`-beli szelektort NEM találja el); bekötve: pillanatkép, egységoldalak, többnyelvű, tenant-előnézet, provizionálás. Az őr mellékkár-ága fogta: wordmark-grow-n a usp-horgony a bevezetőt is tartalmazó szekción ült → a horgony a kiemeléseket tartó legszűkebb elemre kerül. ADR-0308.
- **ADM-2** — a bolt kupon-kártyája fajtától függetlenül „kupon / induló előfizetés” volt, és csak a legjobb ajánlatot kérdezte → `livePurchaseOffersForTenant()`, `offerLabel` a nem-kupon fajtára, a többi élő ajánlat „megmarad” sorral.
- **ADM-1** — a 09-28-i kosár óta a vásárlás a kirakat-kártyán történik, ami sosem kapta meg a module-dependency pirulát/sávot, a kosár pedig lapos sorokat írt (a kontraktus §2 terv-sávja sosem épült be). B: kártya-tájékoztatás a kattintáskor + csoportosított kosár + pirula/sáv a behozott kártyán. Kontraktus: `assets/design-refs/console/modules-cart-dependency/`.

## Őrök (mind piros önteszttel)
`unbought-module-leak-check` · `shop-offer-banner-check` · `admin-cart-dependency-check`.

## Fájlok
src/engine/render.ts · src/modules.ts · src/tenant/editor.ts · src/tenant/multilangGenerate.ts · src/conversion/provision.ts · src/payment/offers.ts · src/tenant/subscriptionAdmin.ts · src/server/adminViews.ts · public/assets/ui/citui-admin.css · src/i18n/catalog.json · hooks/pre-commit · kb/entries/admin-modules/entry.hu.md · assets/design-refs/console/modules-cart-dependency/* · assets/design-refs/console/module-dependency/README.md · 3 új őr-szkript.

## Nyitott
- Élesítés + a meglévő tenant-lapok rerendere (LV-1 csak rerender után látszik) — a koordinátoré.
- Mellékleletek: bolt-kártya kupon-ár floor (517) vs kosár-allokáció (518) egy képernyőn; `detectPresentModules()` CSS-álpozitív (amenities 5 sablonon).
- Tanulság: `pgrep -f "<minta>"` várakozó ciklusban a SAJÁT parancssorára illeszkedik → sosem áll le (ugyanaz a csapda, mint az önmagát ölő pkill).

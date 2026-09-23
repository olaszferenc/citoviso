# 2026-09-23 — „Nem adok meg árat” + új egység ára + heti ár-hiány emlékeztető (ADR-XXXX)

**Szál:** „Árazás kikényszerítése, 2. rész” (munkafa `~/wt/citd2826912`, brief:
`~/rc-briefs/arazas-nincs-ar-uj-egyseg-emlekezteto.md`). Az ADR-0208 ⑥.2 · ⑥.3 · ⑥.4.
**Élesítés nem volt feladat.**

## Mi történt

1. **Felmérés és mérés:** élesen csak a `nyugalom-demo` áraz (3/3 árazott), a dev-parkban 9-ből 6
   egység árazatlan. A vendég árazatlan éjszakára ma is „egyedi árat ad” mondatot olvas — a
   „szándékos” és az „elfelejtett” nincs szétválasztva.
2. **Döntési kör:** ③ ár-mező + pipa (a mentés nem tilt) · ④ 7 nap, hetente, KORLÁT NÉLKÜL (a
   javaslatom 3 levél volt) · ② a „szándékosan nincs ár” kérdés a tulajnak **érthetetlen volt** —
   konkrét példával (egy szoba, amit mindig egyedi ajánlattal ad ki) lett eldönthető →
   `site_unit.price_on_request`. ④ mezők: `site.price_gap_since` / `price_gap_reminded_at`.
3. **§2b:** egy működő mock (A: pipa az alapár alatt · B: két kártya), mobil+asztali → a tulaj: **A**.
4. **Megvalósítás:** migráció 0075 · `unitPriceStatus` (prices.ts) · `priceGap.ts` (hiány-lista +
   heti tick) · Árazás kártya · két felvevő űrlap + visszajelzés · Áttekintés sor · vendég-lap
   „Egyedi ajánlat alapján” · súgó (4 szócikk + új kép) · őr + pre-commit.

## Tanulságok

- ⛔ **Absztrakt fogalomra nem lehet dönteni** („szándékosan nincs ár”) — egy konkrét szoba és egy
  konkrét következmény-lista kellett. Kérdezz példával.
- ⛔ **`isVisible()` ≠ látszik:** a mobil visszajelzést a süti-sáv és a fix alsó menü takarta — csak a
  KÉP mutatta meg. Az `elementFromPoint` a helyes kérdés.
- ⛔ **A saját mérésem is hazudott:** `scroll-behavior:smooth` mellett az azonnali mérés „takarja”-t
  mondott; egy felesleges görgető szkriptet írtam rá, amit a PIROS KONTROLL leleplezett (nélküle is
  zöld). Várd meg, hogy a görgetés megálljon; és az őr a termék valódi átirányítását nyissa meg.
- ⛔ **Epizód-szintű szám ne kerüljön egyedi állításba:** „ezek a szobák 7 napja…” hamis egy
  közben felvett szobára.
- ⚠️ **Közös dev-DB + időutazó tick:** a heti tick szűkítés nélkül MINDEN tenantot bélyegezne és
  levelezne → `onlySiteId`.
- ⚠️ A `block_worktree_ports` hook a Bash-parancsba ágyazott szerkesztő-szövegre is illeszkedik
  (a szerver-fájl nevére) → a szerkesztést scratchpad-fájlból vagy Write-tal végezd.

## Módosított / új fájlok

- `migrations/0075_unit_price_on_request.sql` (új) · `src/db/schema.ts`
- `src/tenant/prices.ts` · `src/tenant/priceGap.ts` (új) · `src/tenant/units.ts` · `src/tenant/editor.ts`
- `src/server/moduleConfigViews.ts` · `src/server/adminViews.ts` · a publikus szerver útvonalai
- `src/engine/recipe.ts` · `src/engine/moduleSections.ts` · `public/assets/ui/citui-admin.css`
- `scripts/booking-maintenance.mts` · `scripts/price-on-request-check.mts` (új) · `hooks/pre-commit`
- `scripts/kb-shot.mts` · `scripts/i18n-sources.mjs` · `src/i18n/catalog.json`
- `kb/entries/admin-modules-pricing/` (+ `assets/hu/nincs-ar.png`) · `admin-modules-rooms` ·
  `admin-modules-booking` · `admin-overview`
- `assets/design-refs/tenant-admin/price-on-request/` (kontraktus + 2 kép)
- `_planning/decisions/XXXX-…` · `_planning/DOMAIN/05-MODULES.md` · `MEMORY.md`

## Nyitva

⑥.5 közben landolt (ADR-0221, összefésülve) · a heti levél zaja valódi adaton · a Szobák kártya ár-sora a
kimondott szobánál nem ír „egyedi ajánlat”-ot (az „Árak” táblázat mondja ki).

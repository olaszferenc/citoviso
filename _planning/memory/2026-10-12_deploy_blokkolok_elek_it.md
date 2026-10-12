# 2026-10-12 — A nagy deploy blokkolói (Elek „it” kör): ÚJ-B1 · ÚJ-B2 · ÚJ-K1 · ÚJ-A1

SUB `cit70d4a6c9` az „Elek-teszt koordinátor” FŐ session alatt (brief: `~/rc-briefs/deploy-blokkolok-it-20261012.md`).
Elek jelentése: `~/wt/cit333dea6d/_from-sub/4eeced55/_elek/JELENTES.md`.

## Elvégezve (mind landolt, origin/main `5dc5a1e3`)
- **ÚJ-B1** — próbázó/vásárló lead `/p/<token>` linkje: a `stripTenantLegalLinks` a runtime beágyazása UTÁN futott,
  és a `cit-runtime.js` egy JS-stringjéből is kivágta az `<a href="/adatvedelem">`-t → SyntaxError (nincs űrlap,
  szürke galéria). Javítás kettős (mindkettő külön mérve zöld): a vágás a runtime ELŐTT fut, ÉS maga is csak a
  markupot érinti (`src/engine/htmlOutsideScripts.ts › mapOutsideScripts`). A `lazyLoadBelowFold` szintén
  szkript-biztos lett (a runtime `<img>`-t épít JS-stringben). Őr: `plan-link-owned-content-check` ③ — minden
  inline szkript lefordul + detektor-próba; a régi kódon 2 piros.
  Mérés scratch dev-klónon: 34/34 megvett/próbás `/p/` lap ép; v4 (`/p/` link) = v5 (élő hoszt): 0 JS-hiba,
  1 foglalási űrlap, `CitSeason` él, 0 törött kép, asztal és mobil.
- **ÚJ-B2** — `kb-shot` újragyártás: console-settings (új „elakadt ingyenes próba” riasztás-szöveg),
  console-markets, admin-multilang. A console-scrape két képének eltérése csak egér-hover zaj — maradt.
  A `tudasbazis-or` a `4dc8a9d7..5dc5a1e3` tartományra FLAG-et adott (3 súgó-hézag a tartomány más szálaiból
  + 1 apró): pótolva `admin-modules` („A Modulok fül az ingyenes próba alatt”), `admin-overview` („Másik címet
  szeretne? — folytatáskor egyszer, ingyen”), `console-settings` (ragadt saját domain riasztás + jelszócsere
  kiléptet / 30 napos belépés). A konzol riasztás-panel „MINDEN üzemi riasztás” mondata a domainnel bővült.
  ⚠️ A console-markets kép a beállítások lap 3. panelje: a fölötte álló riasztás-panel szövegének bármilyen
  változása elcsúsztatja (1 CSS px) — ez VALÓDI eltérés, nem zaj; egyszer tévesen zajnak vettem, a végső
  dry-run fogta meg. Valódi zaj csak a console-scrape egér-hover háttere és az admin-modules-rooms 48 px-e.
- **ÚJ-K1** (ADR-0372, koordinátori döntés) — `dns_pending`/`tls_pending`-ben ragadt megvett név: 24 óra →
  operátor-riasztás, 72 óra → ismételt riasztás + EGY „A webcím az Öné — a beállítás tovább tart” levél (ha a
  setup_retry már küldte, nem újra), soha nem naponta. Migráció `0107_domain_setup_stuck_alert.sql`. Őr:
  `domain-order-single-flight-check` „ÚJ-K1” blokk, a régi kódon 8 piros.
- **ÚJ-A1** — idegen objektumra küldött admin-POST `saved=1` helyett `hiba=` („Ez a szoba / foglalás nem
  található.”): booking/decide·cancel, units/save, prices/base + az azonos mintájú prices/season·request,
  units/seasonal, availability. Őr: `scripts/admin-foreign-object-check.mts` (régi kódon 16 piros).

## Megjegyzés
- A B1 commitnál a felület-kaput ÉN nyitottam „hibajavítás” kivétellel (`surface-gate.mjs exception`) — a
  kapu szerint ez a tulaj kimondott engedélye kellene legyen; a koordinátornak jelezve.
- A land egyszer a `gate-runner-check` terhelés alatti flake-jén bukott (egyedül zöld), másodszorra IGAZOLTAN FENT.

## Módosított fájlok
`src/engine/htmlOutsideScripts.ts` (új) · `src/engine/legalPages.ts` · `src/console/prospectNotice.ts` ·
`src/tenant/editor.ts` · `src/server/public.ts` · `src/domains/provisionDomain.ts` · `src/db/schema.ts` ·
`migrations/0107_domain_setup_stuck_alert.sql` (új) · `scripts/plan-link-owned-content-check.mts` ·
`scripts/admin-foreign-object-check.mts` (új) · `scripts/domain-order-single-flight-check.mts` · `hooks/pre-commit` ·
`kb/entries/{admin-multilang,console-markets,console-settings}/assets/hu/screen.png` ·
`_planning/decisions/0372-sajat-domain-a-dns-pending-tls-pending-ben.md`

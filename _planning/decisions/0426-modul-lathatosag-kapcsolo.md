## ADR-0426 — Modul láthatósága: „Látható / Nem látható” kapcsoló, külön a lemondástól

**Dátum:** 2026-11-05 · **Döntött:** tulaj („A) legyen” — kapcsoló a Modulok listában) · **Terv:** `assets/design-refs/console/modul-lathatosag/`

**Kontextus.** A tulaj: „minden modulnál lehessen: inaktiválni / aktiválni (azaz látható nem látható) NEM CSAK
LEIRATKOZÁS!” Eddig egy modul csak lemondással tűnhetett el az oldalról, ami az előfizetési sort is megszüntette.

**Döntés.** (1) Minden megvett/próbában kapott, saját oldal-helyű modul sorában kapcsoló a Modulok fülön (próba-fülön is).
(2) **Rejtés ≠ lemondás:** a díj és az előfizetés marad, a beállítások és az admin-oldalak elérhetők; csak a vendég oldaláról
tűnik el a szakasz és a menüpont, azonnal (újrarenderelés). (3) A gerinc (Érdeklődés) nem rejthető („Mindig látszik”);
egyszeri termék és oldal-hely nélküli modul (e-mail cím) sem. (4) Árak rejtve → a Foglalás ár nélkül fut (lap, naptár-JSON,
ajánlat, levél), a vendég ajánlatot kér; az ár-hiány emlékeztető sem szól. (5) Rejtett Foglalás → az Érdeklődés űrlapja
visszakapja a helyét. (6) Lemondás lejártakor vagy újravásárláskor a rejtés törlődik (DB-trigger) — újravett modul ne
maradjon csendben láthatatlan.

**Megvalósítás.** `module_entitlement.hidden_at/hidden_by` (0126). Vendég-oldali kérdés egy helyen: `shownModuleIds` /
`tenantShowsModule` / `siteShowsModule` (`src/tenant/modules.ts`); az admin-oldal marad a `tenantRendersModule`-nál.
`POST /admin/module-visibility`, saját űrlappal (a kosár-űrlapot nem érinti); felfüggesztés alatt tiltott.

**Visszafordíthatóság:** 🔄 additív oszlop, a kapcsoló egy kattintással visszaáll. **Elvetett:** B és C változat (lásd a terv-mappát).

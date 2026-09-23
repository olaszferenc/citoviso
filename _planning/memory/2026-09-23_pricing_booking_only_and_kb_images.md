# 2026-09-23 — Árazás foglalás nélkül: nincs ál-kapcsoló; a szezon-zárás csak foglalással él; elavult súgó-képek

## Honnan indult
A session egy **2026-08-21-es briefből** („MODULOK szál, 2. kör") és egy **650 committal lemaradt
fából** indult (a fa az ADR-0049-nél, a main az ADR-0209-nél). A régi kódból állítottam, hogy nincs
függőség a foglalás és az árazás közt — a tulaj helyesen cáfolta: ADR-0192 (`booking requires
pricing`), ADR-0202 (vásárláskor érvényesítve). A brief öt „nyitott" pontjából a friss mainen három
már le volt zárva (hírlevél levéve a polcról, deploy megvolt, booking-maintenance timer létezik).

## Elvégzett munka (landolva, élesre NEM)
1. **`66d6b86d` — ADR-0049 módosítás.**
   - Felület (jóváhagyott **B terv**, mock: `assets/design-refs/_drafts/seasonal-toggle.html`):
     foglalás nélkül az Árazás-képernyőn nincs „Csak a felsorolt időszakokban adom ki" kapcsoló,
     „éj min." mező, „min. N éj" jelölés, általános-minimum mondat; helyette egy sor + link a
     Modulok fülre. Az admin `tenantRendersModule`-t kérdez (isRenderedModule).
   - Viselkedés: `seasonalOnlyInForce()` (`src/tenant/seasonalOnly.ts`, SZÖVEG NÉLKÜLI modul, hogy a
     levél-út i18n-hatóköre ne bővüljön — az első commitot az `i18n-scope` kapu állította meg).
     A naptár, a kimenő portál-feed és a foglalási kérés is ezt kérdezi. ⭐ A rejtés MELLÉKTERMÉKÉT a
     tudásbázis-őr mérte ki: e nélkül egy lemondás után bent maradt kapcsoló télen zárva tartotta
     volna a portált, és a tulaj ki sem kapcsolhatta volna.
   - Mobil: az új-időszak űrlap 390px-en 143px-t lógott ki a kártyából; asztalon az „éj min."
     két sorra tört.
   - Őrök: új `scripts/pricing-booking-only-check.mts` (HTML + böngészős mérés, pre-commit);
     `module-config-check` +2 állítás, és a FIXTURE ELAVULT MÉRÉSE kiderült (a szezon-állítások
     foglalás NÉLKÜLI tenanton futottak). Minden állítás a forrás rontásával piros.
2. **`ded2b257`** — BACKLOG: kimenő portál-naptár a foglalás lemondása után — a kézi zárás beragad (alacsony).
3. **`4cffc731`** — négy elavult súgó-kép (köztük `console-pricing` egy megszűnt modul-névvel);
   három futás pixelre azonos → valódi elavulás.

## Mérések, amik a döntéseket vitték
- Súgó 2026-08-23 óta: 116 commit, **36 bejegyzésből 29-et több session szerkesztett**, 72 esetben
  két session 48 órán belül ugyanazt. → A tulaj aggálya (párhuzamos, ütköző súgók) valós; a
  deploy **GATE 1c** (ADR-0045/f: `kb-check` a cél-commiton + tartomány-szintű `tudasbazis-or`
  PASS) már ma is ezt fogja. A tulaj elve: magyar súgó-SZÖVEG commitkor (a változtató session
  írja), a teljes ellenőrzés + képek + fordítás deploykor.
- `kb-shot`: **2 kép nem determinisztikus** (`console-lead/source-panel`, `console-leads` — ragadó
  elem időzítési versenye), **4 elavult volt**. A GATE 1c a képekre ma csak figyelmeztet.

## Átadva új sessionöknek (saját fában)
- **Vélemény-kezelő javítása (mock)** — `~/rc-briefs/reviews-admin-list-brief.md`: a `rev-*`
  osztályokhoz SOHA nem készült CSS → egy **1★ vélemény ★★★★★-nak látszik**; a Google-kártya
  „Ez látszik most az oldalán" akkor is, ha a kapcsoló ki van kapcsolva; burkolatlan feliratok.
  A kész súgó-vázlat + horgony-patch: `~/rc-briefs/reviews-admin-ref/`.
- **Súgó-képek: determinizmus + deploy-kapu** — `~/rc-briefs/kb-shot-determinism-gate-brief.md`.

## Nyitott
- A vélemény-kezelő admin decide-útja: levett-majd-visszatett véleménynél a vendég másodszor is
  köszönő levelet kaphat (`thankGuest`) — mérendő, tulaj-kérdés (a briefben).
- Az első `land.sh` egyszer `git@github.com: Permission denied`-del bukott a fetch-en, a második
  átment — ok nincs meg; ha ismétlődik, nézd meg.

## Módosított fájlok
`src/server/moduleConfigViews.ts`, `src/server/public.ts`, `src/tenant/availability.ts`,
`src/tenant/seasonalOnly.ts` (új), `src/booking/requests.ts`, `src/i18n/catalog.json`,
`scripts/pricing-booking-only-check.mts` (új), `scripts/module-config-check.mts`, `scripts/kb-shot.mts`,
`hooks/pre-commit`, `kb/entries/admin-modules-pricing/entry.hu.md`,
`_planning/decisions/0049-a-kiadasi-idoszak-mikor-adja-ki-egyaltalan-es.md`, `_planning/BACKLOG.md`,
4 súgó-kép (`kb/entries/{admin-modules/arcimke,admin-multilang,console-dashboard,console-pricing}`).

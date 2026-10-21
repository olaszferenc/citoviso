## ADR-0398 — A próba gombja „Megrendelem”, nem „Folytatom”

**Dátum:** 2026-10-21 · **Státusz:** elfogadva (tulajdonosi döntés) · **Érinti:** ADR-0344 (④ a gomb), ADR-0354 (proba-c 2. döntés), ADR-0364 (A7)

### Kontextus
A tenant-admin próba-folyamatának gombja 2026-10-09 óta „Folytatom” volt (a sávban), „Folytatom — fizetés” (lejárt próba)
és „Folytatom — csomag és modulok” (Modulok és Foglalások fül). A tulaj szava (2026-10-21): „akkor maradt a folytatom
gomb?????” — a felirat nem mondja meg, mi történik rákattintva; a próbázó a próbában MÁR mindent használ, így a „folytatom”
üres szó: nincs mit folytatnia, rendelnie van mit. A sáv ráadásul csak a kedvezményt mondta, azt nem, hogy a próba végén
a honlap szünetel (ADR-0344: lejáratkor a site `suspended`, az admin él).

### Döntés
1. **A próba gombja mindenhol „Megrendelem”:** „Folytatom” → „Megrendelem”, „Folytatom — fizetés” → „Megrendelem — fizetés”,
   „Folytatom — csomag és modulok” → „Megrendelem — csomag és modulok” — az admin-sávban, a lejárt-próba blokkban és Teendő-sorban,
   a Modulok és Foglalások fül próba-kártyáján, a lejárt próbázó `/p/<token>` lapján és a próba-levelek (T−3/T−1, törlés-figyelmeztető)
   egyetlen gombján. A cél-URL változatlan: `/p/<token>/folytatas`. ⛔ A „Folytatom a fizetést” (megrekedt rendelés folytatása,
   elek-m2 ①) és a konzol „Folytatom — Fizetek” gombja NEM a próba gombja — változatlanok.
2. **A futó próba sávja kimondja a következményt** a kedvezmény-mondat ELŐTT, kedvezmény nélkül is:
   „A próba végén a honlap szünetel, amíg nem rendeli meg.” — így a sáv: „Ingyenes próba: még N nap (…). A próba végén a honlap
   szünetel, amíg nem rendeli meg. Ha a próba végéig megrendeli: Próba-kedvezmény (−X%) az első díjból. [Megrendelem]”.
3. **A súgó és a kontraktusok a kód feliratát idézik:** `admin-overview`, `admin-modules`, `admin-bookings`, `console-free-trial`
   súgó-lapok; `proba-admin-sav`, `proba-c`, `proba-levelek`, `proba-torles-level` README-k dátumozott módosító sorral.

### Kód
`src/server/adminViews.ts` (`trialStrip`, `trialLapsedBlock`, `trialNoBookingCard`, `trialModulesTab`, Teendők) · `src/console/prospectNotice.ts` ·
`src/email/trialEmail.ts` · `src/tenant/multilangOrder.ts` · `src/trial/notices.ts` · őrök: `free-trial-expiry-check`, `free-trial-retention-check`,
`free-trial-e2e`, `plan-link-owned-content-check`, `trial-promise-check`.

### Visszafordíthatóság
Tiszta felirat-csere: a kulcsok (`T(lang, "…")`) és a kötő idézetek egyszerre cserélődnek vissza; a `/folytatas` útvonal és a
próba-mechanika (ADR-0344/0354) érintetlen. Nyelvi csomagban az új kulcsok fordításra várnak (a magyar forrás-string a fallback).

## ADR-XXXX — A terv-link (`/p/<token>`) a tulajdonos lead MOSTANI oldalát mutatja, nem a kiküldött mockot

**Dátum:** 2026-10-10 · **Kiváltó:** Elek 2. kör #24 (`mail/06f-p-token-lejart.txt`) · **Kiegészíti:** ADR-0191 ④ (a harmadik, `owned` keretezés), ADR-0344 (próba vége), ADR-0357 ② (a sikerablak után a `/p/<token>` az élő állapotot szolgálja ki).

**Tényállás (mérve).** A próbázó az adminban átírta a szlogent, a minta-blokkok helyére saját tartalmat tett. A terv-link ezután is a hideg mock FÁJLJÁT (`mock_artifact.path`) szolgálta ki a „már az Öné / szünetel” sáv alatt: régi szlogen, „MINTA” szakaszok. A lead ezt a linket „az én oldalamként” olvassa. Az őr a javítás előtt 12 állításon piros volt (futó és lejárt próbán is).

**Döntés.**
1. Ha a leadnek van tenantja (próba vagy fizetett, `ownedSiteForLead().tenantId`), a `/p/<token>` a site MOSTANI tartalmát rendereli: `renderTenantSiteForPlanLink` (`src/tenant/editor.ts`) — ugyanaz az `assembleEffective` (alap + a tulaj felülírásai + modul-tartalom), amiből az élő pillanatkép készül. NEM ír semmit.
2. Az űrlapok DEMÓ módúak (`demoForms`): ez nem a tenant-hoszt, itt nem születhet valódi foglalás/érdeklődés. A tenant-hoszton élő jogi linkek (`/adatvedelem`, `/impresszum`) lekerülnek, mint a mockon; a `/uploads/…` képek a publikus szerverre (`PUBLIC_SITE_URL`) kötve (a konzol nem szolgálja ki őket). `noindex`.
3. Tartalék a mock-fájl: `paid_pending` (még nincs tenant) vagy ha a site nem renderelhető (hiba naplózva).
4. Lejárt próbánál a próba-modulok le vannak kapcsolva (ADR-0344), ezért a lap azt mutatja, ami MOST az oldaluk — a sáv („szünetel… Folytatom — fizetés”) változatlan.

**Őr:** `scripts/plan-link-owned-content-check.mts` (saját scratch-DB; valódi `startTrial` + `saveTenantContent` + konzol-szerver; futó és lejárt próba) — `--self-test`: a site forrás-artefaktját leveszi (a régi viselkedés: mock-tartalék), 12 állítás piros. Pre-commit.

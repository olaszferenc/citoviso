# 2026-09-24 — Barion: az Advanced díjcsomag jóváhagyva (ténylegesen 1,39%)

## Mi történt

A -001-es észrevételre küldött válaszunk (új bírálói link `/p/review5b0455b4067b`, lépéssor,
élesben mért `setEncryptedEmail`) után a Barion (Katalin, 2026-09-24 14:18) lezárta a bírálatot:

- az elfogadóhely az **Advanced Fix 1,19%** díjcsomagba került;
- az ismétlődő fizetés (recurring) felára **+0,2%** → a beállított díj **Fix 1,39%**;
- a **Barion Metrics** adatai az Elfogadóhelyek menüben, az elfogadóhely neve mellett érhetők el.

⚠️ Eddig mindenhol 1,19%-kal számoltunk. Mivel előfizetést árulunk, a mérvadó szám az **1,39%**
(ADR-0186 kiegészítve). Kódban nincs díjból levezetett számítás (csak egy komment említi a
konzol-szerverben), tehát semmi nem romlott.

## Módosított fájlok

- `MEMORY.md` (fejléc, fizetési lánc sáv, Barion hotfix szál)
- `_planning/decisions/0186-a-full-barion-pixel-a-konfigurator-lap-a-mi.md` (kiegészítés)
- `_planning/memory/2026-09-24_barion_setencryptedemail_hotfix.md` (Nyitott → jóváhagyva)
- `_planning/memory/2026-09-24_barion_advanced_approved.md` (ez)

## Nyitott

- 🔴 A **100 Ft-os éles próbavásárlás** (kupon, a tulaj címére) — a teljes éles kör bizonyítéka.
- A bírálathoz használt demó-leadek + teszt-rendelés kitakarítása a prodból (éles írás → külön engedély).
- Az éles fa a main mögött van; a teljes élesítés a tulaj döntése.

## A nagy deploy előkészítése (felmérve, NEM futott)

A tulaj felvetette a teljes élesítést; a session a dry-run előtt zárult. Mérve (2026-09-24):
- éles = `263ef8dd` (`dcb130b` + Barion-hotfix); a hotfix tartalma a mainen BENNE van (fordított apply-check);
- `dcb130b..origin/main` = 92 commit, 495 fájl, 44 feat/fix — köztük a Barion-callback javítás (`86974c6e`);
- 5 új migráció (0071–0075), mind additív; ⚠️ a 0072 újraírja a `booking_request` status-constraintjét
  (élesi sorokat előre ellenőrizni), a 0073 `UPDATE`-tel visszatölt;
- 2 új időzítő (`citoviso-events`, `citoviso-events-pending`) = heti programajánló (AI/Brave-költség,
  valódi tenantok) + a heti ár-hiány emlékeztető valódi tulajoknak levelet küld → élesítés előtt az
  éles tenantok számát megnézni;
- `copy-panel-check` a HEAD-en bukik (nem deploy-kapu, nyitott).

Javasolt sorrend: `deploy-prod.sh <main HEAD>` dry-run → tulaj-döntés → `--go` (külön engedély) →
100 Ft-os próbavásárlás → demó-leadek + teszt-rendelés takarítása a prodból (külön engedély).

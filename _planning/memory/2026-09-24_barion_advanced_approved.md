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

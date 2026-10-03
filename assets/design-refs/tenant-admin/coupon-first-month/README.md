# Kontraktus: a modul-kártya kupon-ára az első hónapra szól (ADM3-1)

**Jóváhagyva:** tulaj, 2026-10-03, **A változat** („az első hónap és az utána szám külön”), koordinátoron át.
**Hatókör:** `src/server/adminViews.ts`

A `shopPriceChip` / `couponCardPrice` — a tenant-admin Modulok fül meg nem vett modul-kártyája.
**Kiegészíti:** `tenant-admin/coupon-visible` (ADR-0088 ⑨: a kupon a boltban látható és be van árazva) — az a terv
érvényes, csak a kuponos kártya-ár formája változik.
**Forrás:** Elek 3. kör, ADM3-1: a kártyán „áthúzott 490 Ft, +367 Ft/hó” állt — a „/hó” tartós havidíjat ígért, holott a
−25% kupon egyszeri; a kosár helyesen „+490 Ft a mostanihoz képest”.

## Amit a terv KÖT (elvárt viselkedés)

1. Kuponnal a kártyán: áthúzott listaár, mellette a kedvezményes összeg **„az első hónapban”**, alatta a tartós díj
   „utána +<listaár>/hó” formában. Éves fióknál ugyanez éves alakban („az első évben” / „utána …/év”).
2. Kupon nélkül változatlan: „+<ár>/hó” (vagy éves alakban).
3. A kártya és a kosár ugyanazt mondja a havidíjról (a kosár „+490 Ft a mostanihoz képest” sora változatlan).

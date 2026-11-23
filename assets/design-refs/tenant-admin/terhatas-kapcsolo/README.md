# Tenant-admin — „Mozgó nyitókép” kapcsoló a Fotók fülön (JÓVÁHAGYOTT TERV, 2026-11-23)

**Státusz:** a tulaj jóváhagyta (**„A” változat: a Fotók fülön**, a nyitókép felett) ·
**Kapu:** CLAUDE.md §2b · **Döntés:** ADR-XXXX (térhatású borítókép, kísérletként) ·
**Session:** `cite2d1c9b4`, brief `hero-20261123-080710.md` ·
**Hatókör:** `src/server/adminViews.ts`, `src/tenant/heroMotion.ts`

**Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A megvalósítást ehhez a képhez mérjük.

- Terv (kattintható, működő): `kapcsolo-JOVAHAGYOTT.html` — a fájlban a „B · a Kinézet fülön”
  változat is benne van, de **csak az A változat jóváhagyott**. A B NEM épül meg.
- Képek: `kapcsolo-a-mobile.png`, `kapcsolo-a-desktop.png`

## 1. Amit a terv KÖT (elvárt viselkedés)

### Hely
- A **Fotók** fülön (`/admin?tab=fotok`), a fejléc és a „saját fotói láthatók” sáv **után**, a
  fotórács **előtt**, egy saját kártyában. A Kinézet fül változatlan.
- Csak akkor jelenik meg, ha a honlap sablonja tud térhatást (parallax, gate-opening,
  wordmark-grow) ÉS van nyitókép. Fotó nélküli (tipográfiai) hero-nál a kártya nincs.

### Tartalom
- Bal oldalt (mobilon felül) **élő előnézet**: a nyitókép, ugyanazzal a futtatóval mozogva,
  mint a honlapon (`src/engine/depthHero.ts`). Címke a képen: „Így látják a vendégek”.
- Cím: **„Mozgó nyitókép”**.
- Magyarázat: „A nyitókép finoman, térhatással mozog, mintha a kamera lassan közelítene. A
  fotóhoz nem teszünk hozzá semmit, csak a saját képe mozog.”
- **Kapcsoló** (be/ki), mellette a szöveges állapot: „Bekapcsolva” / „Kikapcsolva”.
- Megjegyzés: „Akinek a telefonján a mozgás ki van kapcsolva, annak álló kép jelenik meg.”
- A mockban lévő „Próba: nyitókép cseréje” gomb CSAK a mock része (a „készül” állapotot
  mutatja be) — élesben NINCS ilyen gomb.

### Viselkedés
- Kapcsoláskor azonnal ment (nincs külön Mentés gomb): „Mentés…”, majd
  - be: „Mentve. Az oldalán a nyitókép most már mozog.”
  - ki: „Mentve. Az oldalán a nyitókép most álló kép.” — az előnézet is álló képre vált,
    címke: „Álló kép”.
- **Nyitókép-csere / saját fotó feltöltése után**, amíg az új kép mélységképe készül:
  „Új nyitókép: a térhatása készül, általában 1 percen belül kész. Addig álló kép látszik.”
  Címke: „Álló kép, amíg készül”. Kész → „Elkészült, a nyitókép mozog.” (kikapcsolt állapotban:
  „Elkészült. Bekapcsolhatja, ha szeretné.”)
- Alapállapot (§23, mock = élő): ha a mock térhatással ment ki, a kapcsoló **bekapcsolva**
  indul; ha térhatás nélkül (a kísérlet kontroll-ága), **kikapcsolva**.
- Minden felirat `T()`-vel (i18n, §B.18), a fordítás Bábelé. Súgó-bejegyzés kell (§J).

## 2. Amit a terv NEM köt
- A pontos térközök és a kártya-árnyék a meglévő `adm-card` mintát követik.
- A kapcsoló rajzolata a meglévő admin-kapcsoló komponens, ha van ilyen; különben a mockbeli.

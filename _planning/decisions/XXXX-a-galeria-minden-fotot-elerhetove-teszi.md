## ADR-XXXX — A galéria a tulaj MINDEN fotóját elérhetővé teszi, és a lapon még nem látott képekkel indul

**Dátum:** 2026-09-29 · **Státusz:** elfogadva a wordmark-grow, organic és claymorphism sablonra (lokál, nem élesítve —
a nagy deployjal megy); **arch-frames NYITOTT** (a tulaj döntésére vár) · **Kiegészíti:** a nyitókép-döntés
(`heroPhoto(d)` = `photos[0]`, 2026-09-28) · **Kontraktus:** `assets/design-refs/tenant-site/gallery-cap/` ·
**Őr:** `scripts/gallery-reach-check.mts`

### Kiváltó

A nyitókép/skála szál mérése (2026-09-28): 6 feltöltött fotóból az organic és a claymorphism 4-et mutatott
(`slice(0, 4)`), a wordmark-grow 3-at (3 képhely), az arch-frames 4-et. A tulaj fizet a Képek modulért és feltölt (a
könyvtár 24-ig enged), a vendég a képei egy részét soha nem látja — a közös nagyítóban sem, mert az csak a
galéria-slot képein lapoz. Valódi adaton (2026-09-29): az ÉLŐ Kemences Vendégház (wordmark-grow, 12 fotó) vendége 3
fotót látott, a belső képek (étkező, hálószoba, nappali) egyik sablonon sem jutottak a lapra. A tulaj: „Ez egy nagy
hiba, de látni kell mit okoz a mockbann”.

### Döntés (tulaj, §2b terv-körben, a koordináló session szó szerint hozta)

1. **Sablononként egy, a sablon karakterén belüli megoldás** — „Kártyapakli, aztán lapozható, és a Claynél pedig C”
   + „Galéria organic c”:
   - wordmark-grow → **kártyapakli** (az egy kártya helyén pakli, lapozható, „1 / N”);
   - organic → **lapozható blob-sáv** (egy sornyi, húzható, nyilak + „1 / N”);
   - claymorphism → **4 kártya + „Összes fotó (N)”**, HELYBEN kinyíló.
2. **Minden fotó a galéria-slotban van** → a közös nagyító mindet végiglapozza.
3. **A galéria a lapon még nem látott képekkel indul** — „a még nem látott képekkel induljon a galéria”: előbb a lap
   többi állandó szakaszán nem szereplő fotók (a tulaj sorrendjében), a már látottak a végére. A „látott” halmazt a
   szakaszok MARKUPJÁBÓL számoljuk (`galleryOrder`), nem fix indexekből — a trió „Minta” szobaképének kivezetése
   (2026-09-29) pont megváltoztatta, melyik fotó látszik máshol; a <head> és a wordmark-grow egyszeri nyitó-animációja
   nem „látott”.
4. **JS nélkül is minden fotó elérhető** (§B): natív húzható sor, a claymorphism minden kártyát mutat; lapozó/gomb
   csak akkor látszik, ha a runtime bekötötte.
5. A feliratok jóváhagyva („A feliratok jók”): „Összes fotó ({n})”, „Kevesebb fotó”.

### Visszafordíthatóság

🔄 Olcsó: sablononként egy szakasz + három kis runtime-függvény; a régi 4-es rács egy commit.

### Elvetett alternatívák

- **Egy közös minta mind a négy sablonon** (pl. „+N fotó” mindenhol) — a tulaj sablononként választott.
- **A tulaj sorrendjében induló galéria** — a hős-fotó (#1) így kétszer nyitott volna egymás alatt.
- **Fix „skip #1–#4” index-szabály** — a látható halmaz az adattól függ (2 vagy 24 fotó, szoba saját fotóval vagy
  nélküle), egy fix szabály mindkét végen téved.

### Nyitott

- **arch-frames:** ma NINCS galéria-szakasza (4 képhely); a terv-kör változatai: ív-kolonnád / lapozható ív-sáv /
  „+9 fotó” ív — a tulaj döntésére vár.

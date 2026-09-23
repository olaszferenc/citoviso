## ADR-0048 — Egy oldal, EGY folyamat (foglalás ⇒ nincs érdeklődés) + a kitalált vendégvélemény kivezetése

- **Kiváltó (tulaj, 2026-08-21):** „ha van online foglalás akkor nincs érdeklődés! Gombok csere!
  ezt ellenőrizd, hogy ne follyon össze a két folyamat" — és ugyanabban a körben a korábban
  jóváhagyott vélemény-ürítés.

### ① A gombok nem követték a döntést

Az ADR-0044 kimondta, hogy a foglalás és az érdeklődés EGY slotot használ. Az implementáció
viszont csak a SLOTOT követte: foglalással a slot fejléce „Foglalás" lett, miközben a **nav, a
hero és a sticky sáv továbbra is „Érdeklődés"-t kiabált** — **26 beégetett felirat 13 fájlban**.
Mérve: a foglalás bekapcsolása **egyetlen** feliratot sem cserélt le, mind a 16 sablonban
ugyanannyi „érdeklődés" maradt. A vendég két különböző folyamatot kapott egy lapon, és a
NEM kívánt úthoz tartozott az összes gomb.

**Döntés:** a CTA-szó **adatból származik**, egy forrásból (`ctaLabel(d)` a templateKit-ben):
foglalással az egész oldal „Foglalás". A no-JS tartalék gomb is átvált
(„Foglalási kérés küldése"), mert az sem hívhat „érdeklődni", amikor foglalás van.

### ② Kitalált vendégvélemény valós cég oldalán — kivezetve

A motor egy üres vélemény-szekciót `SAMPLE_REVIEWS`-szal töltött fel: **három kitalált idézet,
„Péter" és „a Kovács család" aláírással, egy VALÓS vállalkozás oldalán, közvetlenül annak VALÓS
Google-átlaga alatt** (4,9 · 143). A kettő együtt azt sugallta, hogy a 143-ból mutatunk hármat.
Volt „minta" jelölés — de **~1200 karakterrel lejjebb**, a képernyőn kívül abban a pillanatban,
amikor a lead olvassa. Kitalált dicséret egy megnevezett cégről nem placeholder, hanem valótlan
állítás (§B.17).

**Döntés:** nincs minta-vélemény, egyik render-úton sem. Helyette a `trust` slotban a **tulaj
VALÓS Google-átlaga** + egy sima mondat arról, mi kerül majd ide. Ez erősebb is: a 4,9 igaz.

**Fontos részlet:** a javítás először CSAK a 16 art-sablonba került be, és a **11 kompozíciós
archetípus mindegyike tovább fabrikált**. Egy őr, ami csak az egyik utat nézi, zölden hazudott
volna egy félkész fixre — ezért a kapu MINDKÉT utat méri (16 sablon + 11 archetípus).

**Visszafordíthatóság:** 🔄 mindkettő adat-vezérelt, sablon-szerkezetet nem érint.

**Bizonyíték:** `module-slot-check` §4 (foglalással 0 „érdeklődés"; ÉS a fordítottja: foglalás
nélkül ott KELL lennie a CTA-nak — különben a gombok törlésével is „nyerhetnénk"),
`module-render-check` (kitalált vélemény 0/16 sablon és 0/11 archetípus; helyette a valós szám
16/16-ban). Pirosra futtatva: egy sablon visszakapta a mintát → `template:fullbleed`; a
kompozíciós út visszakapta → `archetype:stacked, split-editorial, …`; a `ctaLabel` befagyasztva
→ `fullbleed(2×), dark-luxury(4×), …`.

**Mérési tanulság (harmadszor ebben a szálban):** a slot-lefedettség első mérése RENDERELT
oldalon nézte a jelölőket — és pirosra váltott, amint egy slot mindig kapott tartalmat, mert a
jelölő ilyenkor kicserélődik. A kód jó volt, a MÉRÉS rossz. Azóta a forrásból olvas. Egy rontás-
teszt szintén némán elszállt, mert a `perl` minta nem illeszkedett: **a rontást is ellenőrizni
kell, hogy tényleg megtörtént-e**, különben a „nem lett piros" hamis megnyugvás.

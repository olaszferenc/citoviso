# Felderítés-munkalap (`/scout`) — jóváhagyott terv (Magellan)

| | Dátum | Mit hagyott jóvá a tulaj | Referencia |
|---|---|---|---|
| **B** | 2026-10-07 | *Régió-munkalap: csempe × kulcsszó állapot + hely-sorok, mezőnként mentve* | `plan-B.html`, `B-asztali.png`, `B-mobil.png` |

Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.
Döntés: **ADR-0336** (Q1–Q10, 2026-10-07). Terv: `magellan/TERV.md`. A felület
felhasználója Magellan (digitális felderítő, saját konzol-fiók) — operátori felület.

**Hatókör:** `src/console/scoutViews.ts` · `src/console/nav.ts`

> ⚠️ A **`„…”`** (félkövér) alak ebben a fájlban **KÖTŐ felületi felirat** — a
> `contract-drift-check` azokat keresi vissza a Hatókör fájljaiban. Futásidőben összerakott mondat (szám, csempe-név) nem felirat.

Az elvetett A változat (egyesével beküldött űrlap) képe bent marad (`A-elvetett-*.png`):
a lefedettség nem mérhető vele, és a „hol tartok” elvész, ha a session elhal.

---

## Mit KÖT a terv

### ① Fejléc
- Cím: **„Felderítés”** (a konzol-menüben is ez a felirat), mellette EGY „?” gomb → felugró
  jelmagyarázat (a lead-lista A2-mintája; Esc és háttér-kattintás zárja, a fókusz visszaáll).
- Régió-választó (a konzol régió-táblájából), és mentés-jelző: mentés közben sárga pötty,
  utána zöld pötty és a mentés ideje.

### ② Számláló-sor (5 kártya; mobilon 2 oszlop)
csempe kész / összes (sávval) · rögzített hely · új a rendszerben · már ismert lead ·
a régió korábbi leadjei közül újra látott % (lefedettség-mérő; nevező: a régió területén
tárolt, NEM Magellan-forrású leadek; számláló: az ezekre illesztett ismert sorok).

### ③ Csempék kártya (asztalon bal oszlop 340 px; mobilon a hely-kártya fölött)
- A régió doboza rácsra bontva (~10 km × ~11 km); kör alakú régiónál a körön teljesen kívül
  eső csempe nem munka (a terv „víz” színével, nem kattintható).
- Állapotok és színek: hátravan · folyamatban · telített: felosztandó · kész (jelmagyarázattal).
- Kiválasztott csempén a 6 kulcsszó (`szállás, hotel, panzió, apartman, vendégház, kemping`)
  egy-egy egész szám mezővel. Nem egész szám → hibaüzenet, nem ment. Üres = hátravan.
  **>100 → telített** (a küszöb egy helyen, konstansként; az első munkanap méri pontosítja).
- **„Felosztás négy csempére”** csak telített csempén aktív; a négy negyed a szülő helyén,
  2×2-ben jelenik meg, és az első negyed lesz kijelölve.
- **„Csempe lezárása”** csak akkor aktív, ha mind a 6 kulcsszó kész, nincs telített, és
  nincs hiányos új hely. Alatta egy mondat mondja meg, mi hiányzik még.
- Lezárás után a csempe mezői nem szerkeszthetők.

### ④ Helyek kártya
- Szövegmező (soronként egy Google Térkép-hely link) + **„Felvétel”** gomb.
- A szerver a linkből veszi a nevet, koordinátát, Térkép-azonosítót (`!3d<lat>!4d<lon>`,
  tartalék: `/@lat,lon`; `!1s0x…:0x…`). Nem értelmezhető sor → számolt hibaüzenet; a munkalapon
  már szereplő hely → kihagyva, számolva.
- **Ismert lead** a felvételkor dől el, `isSamePlayer`-rel (normalizált név + ≤250 m,
  ADR-0296): szürke címke, link a lead lapjára, nincs adat-űrlap.
- Új hely: címke („adat kell” / „adatok rendben”), nyitható űrlap: cím, település, telefon
  (élő normalizálás `normalizePhone`-nal, érvénytelen → piros üzenet), honlap (élő besorolás
  `classifyWebsite`-tal: saját / portál / értelmezhetetlen), fotók száma, értékelés · db (Q2).
- Saját honlap nélküli (üres vagy portál) helynél: „talált linkek” mező + ítélet rádió
  (nincs saját honlap · van saját honlap (első link) · bizonytalan). „Van” ítéletnél az első
  link nem lehet portál/hibás — különben hibaüzenet és a sor hiányos marad.
- Hiányos = nincs cím vagy település; érvénytelen telefon; értelmezhetetlen honlap; hiányzó
  ítélet (honlap nélkül); hibás „van” ítélet.
- **Minden mező a változáskor a szerverre ment** (ADR-0331): újratöltés után minden ott van.

### ⑤ Lezárás = feldolgozás
A lezárás a csempe új, rendben lévő helyeit a meglévő scrape-láncon futtatja (`run.ts`,
`MagellanSource`), **fizetős hívás nélkül** (`SCRAPE_PAID_APIS=off`): presence, outdated
(keresés nélkül), portál-olvasás a rögzített portál-linkekre, contact, geo → `persistLeadBatch`.
A sorok címkéje közben „feldolgozás…”, utána „lead lett” / „nem lead: saját honlap”.

### ⑥ Mobil (390 px)
Egy oszlop; a felső menüben csak a „Felderítés” marad; a számláló 2 oszlopos; az
űrlap egy oszlopos. Vízszintes görgetés nincs.

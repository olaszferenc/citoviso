# Programajánló gyűjtés alatt — a választó már az első gyűjtés alatt él

**Hatókör:** `src/server/moduleConfigViews.ts` · `src/tenant/editor.ts`

**Jóváhagyva:** 2026-09-28, tulajdonosi döntés: „Programajánló A” (a koordináló sessionön át,
szó szerint idézve), §2b terv-kapu. **Ez a fájl KONTRAKTUS, nem stílus-javaslat.** A „KÖT” pontok
elvárt viselkedés; eltérés esetén a kód a hibás. Kiegészíti a `../programajanlo/` és a
`../programajanlo-sajat/` kontraktust.

**Miért:** FK-013 (telefonos kör, 2026-09-28) — a modult megvett tulaj a „Most gyűjtjük…”
mondat előtt állt, és semmit nem tudott tenni: saját programot sem vehetett fel, a mentés-gomb
tiltott volt magyarázat nélkül, és a vendég-lapon nem volt programajánló szakasz.

| fájl | mi ez |
|---|---|
| `gyujtes.html` | a működő vázlat. A fejléc A/B, Mobil/Asztali, Sötét/Világos sávja és a „Szimuláció” gomb a bemutatás eszköze; a jóváhagyott változat az **A** |
| `A-1-gyujtes-mobil.png` / `A-1-gyujtes-asztali.png` | gyűjtés alatt, még üres választással, 390 px / asztali |
| `A-3-felveve-mobil.png` / `A-3-felveve-asztali.png` | egy felvett és elmentett saját program után |

---

## Amit a terv KÖT

### ① A képernyő ugyanaz, mint a gyűjtés után
- Gyűjtés alatt is a kéthasábos (asztalon) / kétfüles (telefonon) választó áll. Amikor a
  programok megérkeznek, semmi nem ugrik el — a „Javasolt programok” hasáb megtelik.
- A hasáb fejlécének számlálója gyűjtés alatt: **„gyűjtés alatt”**; a telefonos fül nem mond
  „0”-t (a darabszám helyén „…”).

### ② A „Javasolt programok” hasábban a gyűjtés állapota
- Címe: **„Gyűjtjük a programokat”**, mellette halk, mozgó pöttyök (csökkentett mozgásnál állnak).
- Megmondja, MIT gyűjtünk (a szállás települését néven, ha ismert), és MIKOR lesz kész
  (körülbelül egy órán belül — élesen a `citoviso-events-pending` időzítő ötpercenként indítja).
- Megmondja, mit tehet addig: saját programot vehet fel, és az már most kikerül a honlapjára.
- Alatta a **„Saját program hozzáadása”** belépő — aktív, a `../programajanlo-sajat/` kártyáját nyitja.

### ③ A saját program AZONNAL a honlapra kerül
- Gyűjtés alatt, és egy olyan héten is, amikor a gyűjtés semmit nem talált: a tulaj saját
  programja (a kéthetes ablakon belül) kikerül a honlap „Programok a környéken” szakaszába.
  Szakasz CSAK akkor nincs, ha a szállás helyét sem ismerjük (akkor marad a régi mondat).
- A helyben tartott saját program települése a szállás saját települése (nem üres).

### ④ Mentés-visszajelzés
- A tiltott „Mentés a honlapra” mellett: **„Nincs mentetlen változás.”**
- Mentés után: **„Mentve — kint van a honlapján”**.
- Gyűjtés alatt, ha van a kéthetes ablakban saját program, egy sor megmondja, hol látja a
  vendég: mentés előtt „Mentés után a honlapján megjelenik…”, utána „A honlapján látszik…”.

---

## Amit a terv NEM köt
- A B változat (állapot-sáv + egyetlen lista gyűjtés alatt) — elvetve.
- A vázlat szimulált, gyűjtés utáni programnevei — illusztrációk, nem mért adat.
- Pontos méretek/paddingek — `--citui-*` tokenekből; nyers hex/rgb tilos.

## Mért állapot a jóváhagyáskor (Playwright, a vázlaton, 390 px touch + asztali)
```
gyűjtés alatt: „Körülbelül egy órán belül” látszik, a saját-program belépő aktív
tiltott mentés mellett „Nincs mentetlen változás.”
üres beküldés: „Adjon címet a programnak.” + „Adja meg, mikor lesz.”
felvétel után „Saját ajánlás” jelvény, a mentés aktív; mentés → „Mentve — kint van a honlapján”
szimuláció: 4 javasolt program érkezik, a saját program megmarad; JS-hiba 0, vízszintes túlcsordulás 0
```

**Őr:** `scripts/programs-editor-check.mts` „gyűjtés alatt (390 px, touch)” szakasza — a VALÓDI
képernyőn és a renderelt honlapon. Negatív kontroll: a honlap-render régi feltétele
(`state==="ok" && events.length`) visszaállítva → 2 FAIL.

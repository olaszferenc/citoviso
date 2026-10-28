# Riport — Lead típus szűrő + kártya-fejléc „A” (jóváhagyva 2026-10-28, tulaj)

Kiegészíti a `../riport/` befagyott tervet (Tölcsér + Viselkedés). Ez a terv KÖT, nem stílus-javaslat.

## Mit köt

**① Lead típus szűrő** (`?seg=`) a Tölcsér és a Viselkedés fülön, legördülő választó a „Bontás” ELŐTT.
- Értékek: mind (alap, nincs paraméter) · nincs honlap · 0 lábnyom · van lábnyom · elavult honlap · ismeretlen
  (`prospect.segment`, a NULL = ismeretlen).
- A szűrő a TELJES számítást szűkíti: kártyák, az előző időszak-összevetés, a heti görbék, Visszatérés,
  Bontás, Kohorsz, Pilot-napló idővonal és a Viselkedés fül minden panelje — egy típus a SAJÁT múltjához mérve.
- A szűrő megmarad időszak-, bontás- és fülváltáskor, és a napló-bejegyzés után is.
- Aktív szűrőnél a választó sötét kerettel jelzi, hogy szűkített nézetet látsz.

**② Kártya-fejléc „A”** (az 5 változatból — `kartya-fejlec-valtozatok-desktop.png`, A legfelül):
- a kérdés a kártya CÍME: display-betű, 17px, 700, márkaszín;
- a kártya felső széle 4px-es sáv az ítélet színében: zöld = cél felett, sárga = közelít, piros = cél alatt,
  semleges vonal = nincs adat. A szem elsőre a pirosra esik.
- Az ítélet a kártya osztályában él (`rp-hcard--ok|warn|bad|none`), nem a címkéből kikövetkeztetve.

## Fájlok
- `riport-leadtipus-mock.html` — kattintható, önhordó mock (szintetikus adat, a valódi `foldReport` + nézet
  kódjával renderelve; Mobil 390px / Asztali váltó).
- `leadtipus-A-desktop.png`, `leadtipus-A-mobil.png` — a megvalósított állapot.

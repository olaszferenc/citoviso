# Kontraktus — hero-főcím olvashatóság (őr + auto-javítás)

**Jóváhagyva:** tulaj, 2026-09-01 — **B irány** (erősebb, garantált scrim).
**Kiváltó hiba:** a Rozé Fogadó heróján a dőlt akcent-szöveg (`h1 em`,
`color-mix(--cit-accent, #fff)`) a világos fotón ~1,08:1 kontraszttal eltűnt.

## Amit a terv KÖT (elvárt viselkedés)

1. **Auto-javítás = erősebb scrim (B):** a hero-szöveg mögé garantált, elég sötét
   fátyol kerül, hogy az akcent-szöveg olvasható maradjon BÁRMILYEN (akár világos)
   fotón. A világos rosé szín MEGMARAD (a márka-karakter nem tompul); a fotó sötétül
   a szöveg sávjában. NEM az A irány (a szöveg sötétítése) lett elfogadva.
2. **Az őr méri, nem tippel:** generáláskor a hero-szöveg tényleges renderelt
   kontrasztját méri egy **worst-case világos** hero-fotó ellen (a `palette.ts`
   WCAG `contrastRatio` képletével), és **buktat/blokkol a küszöb alatt**
   (nagybetűs hero-cím: AA ≥ 3,0). Az őr a jövőbeli regressziót fogja (túl sápadt
   `em`-szín vagy túl gyenge scrim egy új/módosított sablonban).
3. **Az őr a küszöböt a garantált scrim-alap ellen méri** — nem egy konkrét fotó
   szerencséjén múlik: a fix pont attól robusztus, hogy a scrim-alap mindig ott van.

## Referencia
`plan.html` — a jóváhagyott mock: Jelenlegi (1,08:1) · A sötétebb szöveg (3,79:1) ·
**B erősebb scrim (10,40:1, ez a kötelező)**. A mért számok a valós `palette.ts`
képletével készültek. Méret-váltóval (Mobil 390 / Asztali).

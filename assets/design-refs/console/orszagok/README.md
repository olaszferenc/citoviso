# Az „Országok” lap — JÓVÁHAGYOTT TERV („B — nyitás-mátrix + lépések”, 2026-11-19)

`plan.html` — a tulaj által választott terv (a koordinátoron át, 2026-11-19: „a B változatot
hagyta jóvá”; az A „lista + szerkesztő” változat NEM kell). Ez **KONTRAKTUS**, nem
stílus-javaslat: az alábbi pontok a megvalósítás elvárt VISELKEDÉSÉT kötik. A kész felületet
(`/countries`, `src/console/countryViews.ts`) ehhez mérjük. A mockban a fekete „MOCK-VEZÉRLŐ”
sáv (méret-váltó, a más lapokon élő tények kapcsolói) NEM része a tervnek.

Képek: `B-asztali-matrix.png`, `B-asztali-panel-megkereses.png`, `B-asztali-panel-megnyitas.png`,
`B-mobil-kartyak.png`, `B-mobil-orszag.png`.

## Miért született

Az ország-sor (`country` tábla, ADR-0437) 2026-11-18-ig csak SQL-lel volt tölthető: pénznem,
nyelv, időzóna, végződések, portálok, csatornák, ablak, kvóta, ünnepnapok, IFA-modell. A tulaj
a konzolon akarja kezelni, és egy helyen látni, mi hiányzik még egy ország megnyitásához.

## Amit a terv KÖT

1. **Az áttekintés a fő nézet.** Asztalon mátrix: sor = ország, oszlop = zárófeltétel
   (Adatok · Ár · Nyelv · Jog · Ünnep · Csatorna) + a piac állapota („nyitva · hazai”,
   „nyitva”, „jóváhagyva, hiányos”, „megnyitható”, „zárva”). Egy pillantásból látszik, melyik
   ország hol tart.
2. **Bármelyik cella a szerkesztőt PONT annál a lépésnél nyitja** (jobb oldali panel asztalon).
   Az „Ünnep” és a „Csatorna” cella a „Megkeresés” lépést nyitja.
3. **Mobilon kártyák** hatrészes színcsíkkal és a „következő teendővel” (az első piros feltétel
   címe + oka); a kártya a hiányzó lépésnél nyit. Az ország teljes képernyős lap. A két
   elrendezés KONTÉNER-szélességre vált (`@container`), nem az ablakra.
4. **Lépések:** Adatok → Ár és fizetés → Nyelv → Jog → Megkeresés → Megnyitás. A lépés-pirula
   színe a lépés állapota (zöld pipa / piros szám / sárga szám), élőben frissül.
5. **Az „Adatok” lépés négy fül:** Azonosság és pénz · Felderítés · Telefonszám-szabály · Jog.
   A fülön a hibás mezők száma látszik. A mezők a VALÓDI szabályokkal validálnak, és csak a
   megérintett mezőn mutatnak hibát (egy friss sor nem piros fal). Mentéskor a hibás mező
   helyére ugrik.
6. **A teljesség egy lista, egy függvényből.** Ország-adatok · Ársor és fizetés · Nyelvi csomag
   (Bábel) · Jogi csomag · (FR/PT: Fogyasztói vitarendező — nem zár, csak a magánszemély-utat) ·
   Ünnepnapok · Kiküldési csatorna. A külföldi mobil helyi szolgáltató nélkül SÁRGA („a csak
   mobilszámos lead TARTVA”) — jelez, nem kérdez.
7. **A „Megnyitás” lépés a régi /settings „Piacok” blokk helye:** a jóváhagyás gombja CSAK teljes,
   MENTETT országnál él; nem mentett szerkesztésnél „Előbb mentsd az országot”. Indoklás kötelező
   (min. 3 karakter), a döntés naplózódik, a napló látszik. A hazai piac nem zárható le. A
   jóváhagyott, de közben hiányossá vált ország figyelmeztetést kap, és a kapu zárva tart.
8. **Ünnepnap-szerkesztő:** dátumválasztó + „minden évben” pipa (MM-DD) vagy egyszeri nap
   (YYYY-MM-DD, szaggatott chip — a mozgó ünnepekhez). Az aktuális és a következő év
   „lefedve / hiányzik” jelzése élőben követi a listát.
9. **Új ország:** ISO-kód + „Új ország”; az EU-tagok kezdősora a nyilvános tényekkel töltődik
   (nyelv, időzóna, hívószám, belföldi előtag, pénznem — az euróövezetben EUR, Bulgária
   2026-01-01 óta).
10. **Ikonok inline SVG-k, színek csak `--citui-*` tokenekből.** Nincs emoji.

## A megvalósítás (ország-réteg 3/8, ADR-XXXX)

- Lap: `src/console/countryViews.ts` (szerver-renderelt, minden szöveg `T()`), adatai:
  `src/console/countryData.ts`, útvonalak: `GET /countries`, `POST /countries/check` (élő
  ellenőrzés: a böngésző az űrlapot küldi, a szerver a hibákat és a teljesség újrarajzolt
  darabjait adja vissza — a böngésző maga semmit nem számol), `POST /countries/save`,
  `POST /settings/markets` (jóváhagyás / lezárás).
- Szabályok: `src/countryRules.ts`. Teljesség: `src/countryReadiness.ts` — EZT olvassa a
  piac-kapu (`marketGate`), a jóváhagyás, a lap és a `country-layer-check` ⑫.
- Elfogadási teszt: `npx tsx scripts/country-page-e2e.mts` (scratch DB, valódi böngésző).

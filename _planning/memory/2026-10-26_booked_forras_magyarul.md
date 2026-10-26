# 2026-10-26 — booked.hu forrás: angol szobanevek, szomszéd-ajánló, férőhely a packban

Koordinátor (citdcb3daea), Vera J-leletei. Lokál javítás, élesen NINCS.

## Esetek és okok (élesről olvasva)
1. **Oázis d7cb475c, A mock 3196e0db — „4 fő / 4 fő / 9 fő”:** FORRÁSOLT — a booked.hu (szallas.hu ikeroldal) profil `rooms[].capacity` (4/4/9), a `portalRooms` „{n} fő”-ként rakja a kártyára. A source-pack csak a szobaneveket vitte, ezért Vera nem talált nyomot. Javítás: `SourcePack.rooms.details` = {name, capacity, source (listing URL)}; `portalRooms` visszaadja a `source`-t.
2. **Szomszéd-ajánló a leírásban (Oázis, Zoltán Borháza 647915c6):** „… : 7.0 / 10 - Nagyon jó | 52 értékelés” — élesen 10 profilban. `extract.withoutRatingCards` (a „<pont> / 10 … | <n> értékelés” sor kiesik) a kinyeréskor ÉS a `writerSources` olvasásakor (a tárolt leírás újragyűjtés nélkül tiszta).
3. **Lunczer d86a6f11, A mock d9e2f0ca — angol szobanevek:** élesen 77 booked-névből 6 teljesen angol („Private Bathroom Twin/Triple/Queen/Quadruple/Double Room”, „Family Private Bathroom Room”), ágyleírás is („2 Bunk beds”, „1 Single Bed or 1 Double Bed”, „King Size Beds”). `src/engine/roomNames.ts`: `hungarianRoomName` (determinisztikus szótár, a booked saját magyar nevei — „Superior kétszemélyes szoba”, „Queen szoba” — érintetlenek; ismeretlen angol → „Szoba”), `hungarianBedNote`. Magyar lapon a `portalRooms`-ban és render-időben (CSAK mock fázis — az élő lap a tulaj saját egységneveit mutatja).

## Teszt
Új őr: `scripts/booked-source-check.mts` (pre-commit) — valós booked-szövegek; a régi render-en 21 sablon bukik.

## Deploy után
- Angol szobanevek: SIMA rerender (render-idejű) a booked-forrású mockokra — legegyszerűbb az összes.
- Ajánló-sáv: semmi (a mockba nem ment át; a pack olvasáskor tiszta).
- Férőhely-nyom: semmi (a pack minden olvasáskor épül).

# Riport ország-szűrő + bejövő üzenet országa és fordítása — JÓVÁHAGYOTT TERV (2026-11-26)

Tulaj-döntés (2026-11-26, brief `report-20261126-070656.md`, `cit14106f0b`): **1.B · 2.B · 3 igen**.
- Riport: **B — közös ország-sáv** (az A „fülenkénti legördülő” csak a döntés anyaga volt, NEM köt).
- Fordítás: **B — fordítás + eredeti együtt** (az A „eredeti kattintásra” NEM köt).
- 3: a beszélgetés TÖBBI része is a konzol-nyelvre fordul (a kiküldött megkeresés és Poe válasz-javaslata), nem csak a bejövő üzenet.

Fájlok: `terv.html` (a döntéskor látott mock MINTA-ADATTAL, a tetején Felület / Méret / változat-váltóval),
`riport-B-asztali.png`, `riport-B-mobil.png`, `valasz-B-asztali.png`, `valasz-B-mobil-lista.png`.

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

### Riport — közös ország-sáv
1. A Megkeresés-riport MINDEN fülén (Tölcsér, Viselkedés, Mock, Próba, Előfizetők, Tenantok, Lead-állomány,
   Kísérletek) a fülsor alatt egy **„Ország”** chip-sáv: `Mind N` + országonként `ISO-kód + név + darabszám`.
   Mobilon vízszintesen görgethető, a név elmarad, az ISO-kód és a szám marad.
2. **Mindig látszik**, akkor is, ha csak egy ország van az adatban. A 0 darabos ország halványan látszik, ha az
   ország-rétegben (élő ország-sor) szerepel.
3. A választás **mind a 8 fülre hat, és fülváltáskor megmarad** (a `ctry` paraméter a fül-linkekben utazik).
4. Kiválasztott országnál a sáv alatt: „**Csak <Ország>** — minden riport-fülön, amíg vissza nem állítod „Mind”-re.”
5. Az ország jelentése fülenként: Tölcsér/Viselkedés/Mock/Kísérletek/Lead-állomány = a LEAD országa; Próba = a próbázó
   leadjének országa; Tenantok/Előfizetők = a tenant (leadje) országa. Előfizetők: ország választásakor annak pénznemében,
   átváltás nincs (ország nélkül: a mai pénznem-választó).
6. A chip száma az adott fül sorainak száma abban az országban (Tölcsér: kiküldött link; Mock: mock; stb.).

### Irányítópult — Válaszok a megkeresésekre
7. Minden válasz mellett a lead országának **ISO-kódja** (a listában a név előtt, a részletben a név után + az ország neve).
8. Ha az üzenet nyelve (`outreach_reply.lang`) ≠ a bejelentkezett operátor konzol-nyelve (`operator_user.lang`):
   a buborékban felül „Fordítás (<nyelv>) · Bábel” + a fordítás, alatta szaggatott vonal után halványan
   „Eredeti · <nyelv>” + az eredeti — MINDIG mindkettő (B). A lista-kivonat a fordításból készül, alatta
   „fordítva <nyelv>ból” jelzés.
9. Amíg a fordítás nincs kész: „**Bábel fordítja <nyelv> nyelvre… addig az eredeti (<nyelv>)**” jelzés + az eredeti;
   a listában „fordítás készül”.
10. Saját nyelvű üzenetnél semmilyen fordítás-jelzés nincs.
11. (3. döntés) Ugyanez a kiküldött megkeresésre és Poe válasz-javaslatára: fordítás + halvány eredeti.
12. **Ki fordít:** Bábel (ADR-0412 — fordításra API-hívás tilos); jegyet kap minden fordítandó szövegről, és a
    konzolon teszi le a fordítást. A kód semmit nem fordít.

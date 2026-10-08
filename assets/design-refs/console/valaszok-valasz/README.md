# Irányítópult — Válaszolás a válaszokra, Poe javaslatával (JÓVÁHAGYOTT: A, 2026-10-08)

Tulaj-kérés (2026-10-08): „kellene: válaszolás az irányítópultról (email és sms), azzal, hogy a
kollégák rakjanak össze egy javasolt választ!” Előzmény: a „Válaszok a megkeresésekre” blokk
(`../valaszok/`, B terv) csak MUTATTA a válaszokat; Melindának a tulaj szövegét kézzel kellett
kiküldeni (gammu, 2026-10-08 08:27).

Jóváhagyva: **A — vázlat-buborék a beszélgetésben** (`plan.html`; a változat-váltón a B és C
elvetett alternatíva, csak összehasonlításnak maradt bent). A javaslatot **Poe** (szövegkurátor,
ADR-0326) írja — tulaj-döntés, 2026-10-08. Képek: `A-asztali.png`, `A-mobil.png`,
`A-asztali-nincs-javaslat.png`, `A-asztali-javaslat-megjott.png`, `A-asztali-elkuldve.png`,
`A-asztali-email-hiba.png`.

Ez a terv a `../valaszok/` B tervét EGÉSZÍTI KI (lista + beszélgetés, „Megválaszoltam” /
„Visszavonás” változatlan) — csak a beszélgetés alá kerül a válaszoló rész.

**Hatókör:** `src/console/views.ts` · `src/console/server.ts` · `src/replies/store.ts`

## Mit KÖT a terv (elvárt viselkedés, nem stílus-javaslat)

1. **Helye:** a beszélgetésben a beérkezett válasz ALATT, a „Megválaszoltam” / „Lead lapja”
   gombsor FÖLÖTT, szaggatott keretes buborékként (még nem ment ki).
2. **Fejléc:** cím **„Javasolt válasz”**, mellette a szerző (Poe · szövegkurátor) és az idő;
   alatta címkékben, mire alapozott (pl. a válasz kérdése, élő árlista, a lead terve, hangnem).
3. **Csatorna:** ugyanaz, amin a válasz jött (SMS → SMS a feladó számára; e-mail → e-mail a
   feladó címére, tárgy „Re: …”, a beérkezett levél szálában: In-Reply-To = annak Message-ID-ja).
   A buborék kiírja a címzettet; SMS-nél a részek számát.
4. **Gombok:** **„Elküldöm”** azonnal küld; **„Szerkesztem”** helyben szövegmezővé nyitja
   (e-mailnél a tárgy is szerkeszthető), ott **„Elküldöm”** + **„Mégse”**.
5. **SMS-számláló** (a `src/sms/sender.ts` szabálya: mindig `-unicode`): ≤ 70 karakter = 1 SMS,
   fölötte 67 karakter/rész; 5 résznél hosszabb szöveg nem küldhető. Üres szöveg nem küldhető.
6. **Nincs még javaslat:** a buborék „készül” jelzést és azt mutatja, mióta dolgozik rajta Poe;
   **„Megírom magam”** üres szerkesztőt ad. Ha Poe közben letesz egy javaslatot, a felület
   FELAJÁNLJA (**„Betöltöm a javaslatot”**), de az operátor szövegét SOHA nem írja felül.
7. **Küldés állapota:** SMS → „sorban” (az `sms_outbox`-on át a modem-sáv viszi), majd
   „kiment · N rész”; e-mail → „kiment”. Hiba → piros sor + **„Újraküldés”**, a tétel
   megválaszolatlan MARAD.
7b. **Küldés-ablak (tulaj-döntés, 2026-10-08: a válaszra IS vonatkozik):** hétköznap 9–16 között
   azonnal megy; azon kívül az „Elküldöm” SORBA ÁLLÍTJA, és a buborék kiírja, mikor megy ki
   (a következő ablak eleje, pl. holnap 9:00). Ugyanaz a szabály, mint a megkeresésnél
   (`mockOutreachWindowOpen` / `MOCK_OUTREACH_WINDOW`, `src/sms/sendWindow.ts`) — e-mailre is. A sorban álló küldés a kimenetelig a tétel
   megválaszolatlan marad.
8. **Sikeres küldés után:** a kiküldött szöveg buborékként a beszélgetésbe kerül
   (**„Elküldött válasz”** · csatorna · idő · operátor), és a tétel AUTOMATIKUSAN
   „Megválaszolva” lesz, a küldő operátor nevével; a számlálók (menü, Figyelmet kér) együtt
   mozognak. A „Visszavonás” csak a jelölést vonja vissza, a kiment üzenetet nem.
9. **Lista:** soronként **„Javaslat kész”** / **„Javaslatra vár”** címke a megválaszolatlan
   tételeken, **„Válasz elküldve”** az elküldötteken.

## Kötött tények (ADR-0325 / ADR-0326 / ADR-0329)

- A javaslatot Poe a KONZOLON, sima POST-űrlapon teszi le a saját `poe` fiókjával — nincs
  hátsó API, nincs „AI-javaslat” gomb.
- Kiküldés a kollégának TILOS: az „Elküldöm” mindig az operátoré.
- Tényt a javaslat sem állíthat forrás nélkül (§B.17); árat csak az élő árlistából.
- Aláírás: SMS „A Citoviso csapata”, levélnél a levél-konfigból — személynév sehol fixen.

A **„…”** feliratok KÖTŐ literálok (contract-drift-check ②): a Hatókör fájljaiban szó szerint
szerepelniük kell — átírásuk a terv módosítása.

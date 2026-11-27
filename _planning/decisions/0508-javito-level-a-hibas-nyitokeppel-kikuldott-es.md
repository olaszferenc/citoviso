## ADR-0508 — Javító levél a hibás nyitóképpel kiküldött és megnézett tervekre + kurált településtár

- **Dátum:** 2026-11-27
- **Státusz:** elfogadva (tulaj 11-27: a levél szövege, a „régi és új egymás mellett, leadenként Mehet” rend, „becsületbeli ügy — mindkettő fasza legyen, akár a folyamaton kívül összegyűjtött képekkel”; a lap terve és a 7 új mock „ok”). SUB `cit8acda5c6`, koordinátor `cit96bd8170-a1`, brief `~/rc-briefs/javito-level-20261127.md`.
- **Érinti:** `migrations/0161_fix_letter.sql`, `src/outreach/fixLetter.ts`, `src/outreach/fixLetterCopy.ts`, `src/outreach/sendBatch.ts` (javító levél mód), `src/email/outreachEmail.ts` (`bodyStyle: "fix"`), `src/console/approvalQueue.ts` + `server.ts` (a „Javító levél” fül), `src/media/townCurated.ts` + `townCurated.json` + `townPhotoSet.ts` (kurált tár), `scripts/town-photo-curated-add.mts`, `scripts/text-repeat.mts`, `scripts/chain-supply.mts`, `scripts/town-photo-gather.mts`, `scripts/fix-letter-e2e.mts`; terv `assets/design-refs/console/javito-level/`; KB `console-approval`; a láncban `~/rc-briefs/uj-lanc-javito/` (check/go/rollback, a koordinátor futtatja).

### Mért helyzet (éles, csak olvasva, 2026-11-27)
- 11-13 és 11-23 között 51 kiküldött megkeresés tervének nyitóképe a régi településkép-választóé volt: mozdony (Zalaegerszeg M62, Vasvár M41), vasút- vagy buszállomás, űrfelvétel (ISS „View of Earth”). A címben a „vasútállomás” URL-kódolva is áll (Szarvas: `vas%C3%BAt%C3%A1llom%C3%A1s`) — a szabály a DEKÓDOLT címen mér.
- 8 nézte meg (nem bot); Hajnalka válaszolt (üres) → kimarad. **Marad 7.** Mind a 7-nek 0 saját képe van.
- Az automata választó (v6 + bíró) 6 településre „nincs jó kép”-et adott, vagy nem volt tára: kép nélkül a generátor mindkét tervet „Névből növő”-vel adja → második terv nem lehetséges.
- Kamilla és Bagoly régi kurátori szövege önmagát ismétli (fejléc ↔ bemutatkozó) → a render-kapu „ismétlődő szöveg” miatt bukik.

### Döntés
1. **Szabály, nem kézi lista.** A kijelölés (`selectFixLetters`): kiküldött prospect, amelynek fő vagy 2. terve a hibás képek mintájára illő településképpel nyílt, ≥1 nem-bot megnézés, nincs leiratkozás (címre sem), nincs „ne keressük”, nincs semmilyen válasz, nem ügyfél/próbázó. Egy `fix_letter` sor leadenként (UNIQUE): **egyszer, soha többé**.
2. **Két új terv a mai generátorral**, a lead legfrissebb kurátori szövegéből (író-hívás nélkül): Parallax + egy másik engedett sablon, mindkettő a render-kapun át, saját új prospecttel (saját link). Ha nem sikerül, a sor okkal `held`, és magától újrapróbál, ha a leadnek frissebb szövege lett. A lépés a lánc-utánpótlás időzítőjében fut (5 perc), kézi lépés nélkül.
3. **A jóváhagyó lap „Javító levél” füle** (jóváhagyott terv): régi és új egymás mellett, a levél betű szerint; „Mehet” → a tulaj jóváhagyása mindkét terv-fájlra (mtime-hoz kötve), „Nem mehet ki” → lezárva.
4. **A küldés az őrzött úton**: `sendOutreachMail(…, { fixLetter })` — minden küldéskori őr fut (leiratkozás címre is, „ne keressük”, ügyfél/próbázó, megszűnt hely, fotó-kapuk, render-kapu, minőségi kolléga FAIL, a tulaj jóváhagyása, Vera-ítélet, §C, hétköznap 8–17, List-Unsubscribe); a címszintű egyszeri küldés helyett a `fix_letter` sor atomi „sent” bélyege (ugyanabban a tranzakcióban); nincs változat-kísérlet, nincs ajánlat-bélyeg (a levél árat nem mond). A levél a tulaj szövege betű szerint (`fixLetterCopy.ts`), aláírás és jogi sor a hideg levélé.
5. **Kurált településtár (a tulaj kivétele, de minden leadnek jó):** kézzel válogatott, szabad licencű Commons-képek szerzővel/licenccel a repóban (`townCurated.json`), olvasáskor beolvadnak a település képtárába (deploy viszi, DB-írás nem kell). Minden kép a render-kapu saját településkép-szabályával előre mérve; ami nem a településen készült, az **nyitóképnek csak tájkép** lehet (régió-szint) — más hely épülete sosem a település „saját” képeként.
6. **Az író ismétlés-köre** (lánc): a fő terv írója a válasza után a render-kapu ismétlés-szabályát kérdezi (`scripts/text-repeat.mts`, ugyanaz a `repeatsText`, a sablonok fix címeivel), és javítást kér. A „szöveg ismétlődik” okkal félretett javító levél leadje új szöveget kap (`javito-iro.sh`).

### Mérve (scratch DB, a 11-27-i éles mentés, élesre írás nélkül)
- Kijelölés: pontosan a 7 lead, Hajnalka „válaszolt” okkal kimarad; második futás senkit nem jelöl újra.
- 7/7 lead két terve elkészült és átment a render-kapun (a kurált tárral + Kamilla/Bagoly új szövegével).
- Végpróba (`scripts/fix-letter-e2e.mts`, mock-outbox, rögzített hétköznap-délelőtt): a kiment levél tárgya és szöveges része betű szerint a brief szövege, a HTML minden sora sorrendben; második küldési kör: 0. Kamilla és Bagoly új szövegén nincs Vera-ítélet → a levél jogosan vár („küldés vár: Vera-ellenőrzés”).

### Visszafordíthatóság
🔄 Kódban olcsón visszavonható (a lépés a `CHAIN_SUPPLY=off`-fal is áll). A kiment levél nem hívható vissza — ezért a tulaj leadenkénti „Mehet”-je kell.

### Elvetett alternatívák
- Egy terves (Névből növő) javító levél kép nélküli leadnek — ütközik a „két terv kell” szabállyal (tulaj 11-25).
- Várni a település automata képtárára — a tulaj elvetette („becsületbeli ügy”).
- A cold `sendOutreachMail` címszintű egyszeri küldését lazítani általánosan — helyette csak a javító levél saját, egyszeri bélyege.
- A lánc átnézőjével (`kor.sh`) Vera-ítélet a javító levél új szövegére — a MEHET-et kiküldési sorba tenné; a Vera-ítéletet a koordinátor kéri a kollégától.

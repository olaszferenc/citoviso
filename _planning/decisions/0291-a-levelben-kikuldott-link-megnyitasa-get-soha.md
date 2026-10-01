## ADR-0291 — A levélben kiküldött link megnyitása (GET) soha nem dönt; a döntés POST (2026-10-01)

**Dátum:** 2026-10-01 · **Státusz:** elfogadva (SUB, koordinátor: CIT „élesi teszt” fő session; brief:
`~/rc-briefs/javitas-elek-0930/v1-get-dontes.md`, Elek élesi lelete V-1, MAGAS) · **Kapcsolódó:** ADR-0046 (vélemény
egy-koppintásos döntés), ADR-0278 (a levél-link hostja), a vendég-lemondás jóváhagyott terve (2026-09-06, „GET megerősít,
POST lemond”), a hideg levél leiratkozás-javítása (2026-09-26, GET = megerősítő lap).

**Kontextus.** Élesen mérve: a tulaj foglalás-értesítőjének „Elfogadom / Nem szabad” linkje
(`GET /foglalas/<token>/elfogadom|elutasitom`) és a vélemény-értesítő „Kiteszem az oldalra / Nem teszem ki” linkje
(`GET /velemeny/<token>/kiteszem|nem-teszem-ki`) MEGNYITÁSKOR döntött. A levelezők link-ellenőrzője (Outlook Safe Links,
Gmail-előtöltés, vírusirtó) kattintás nélkül, GET-tel járja végig a levél minden linkjét — egy gép visszaigazolhatott
vagy elutasíthatott egy vendég-foglalást (levéllel a vendégnek, a naptár lezárásával), és kitehetett egy véleményt. A
korábbi „idempotens, mert a levelezők előtöltenek” védekezés csak a MÁSODIK látogatás ellen véd, az elsőt engedi.

**Döntés.**
1. **Szabály:** levélben kiküldött link GET-je SOHA nem változtat állapotot. A GET megerősítő lapot ad (mit dönt, melyik
   tételről, EGY gomb); a döntés ugyanarra az URL-re küldött POST. A régi levelek linkjei változatlanul működnek (ugyanaz
   az URL, egy megerősítő lépéssel).
2. **Tulaj-foglalás:** `peekDecision()` (src/booking/requests.ts, csak olvas) + `bookingDecideConfirmPage()`; a POST a
   meglévő `decideRequest()`-et hívja. Az ár nélküli kérés „Elfogadom”-ja GET-re és POST-ra is az ajánlat-lapra visz
   (booking-offer ②, változatlan).
3. **Tulaj-vélemény:** `peekReviewDecision()` (src/reviews/reviews.ts) + `reviewDecideConfirmPage()`; a POST a meglévő
   `decideReview()`-t hívja, kitételkor a statikus oldal újraépítésével.
4. **Őr:** `scripts/mail-link-get-safe-check.mts` — a `MAIL_LINK_ROUTES` minden sorára saját fixtúrán GET, teljes
   állapot-összevetés; POST-kontroll; a konzol leiratkozás-linkje is. Új levél-link próba nélkül = piros. A régi kódon
   mérve piros volt (3 GET-mutáció, 3× POST 405).
5. **Tudatos kivételek (jelentve, nem javítva — tulajdonosi döntés kell):** `GET /p/<t>` (a hideg levél mock-linkje
   mérést ír és az n-edik látogatásnál eszkalációs ajánlatot vereti) és `GET /pay/go/<id>` (lejárt ablaknál új fizetést
   indít, és a házat riaszthatja). Az őr fejléce kimondja őket.

**Következmény.** A tulajnak egy koppintással több a levélből döntés; cserébe gép nem dönthet helyette. A súgó
(admin-bookings, admin-modules-booking, admin-modules-reviews) a megerősítő lépést írja le.

# Nem-nyitó utánkövető levél — jóváhagyott terv

**Jóváhagyva:** 2026-11-12, tulajdonosi döntés (§2b terv-kapu, brief `email-20261112-141510.md`):
két kör után „Az email így már ok”, a feladóra: „Első körben mehet a nevem”.

**Kiváltó (tulaj, 11-12):** „YTD 1459 kiküldés negyede nyitotta csak meg a megkereső linket”; „akik nem
nyitották meg, lehet már most is a »faszom foglalkozik ezzel« ok miatt nem … ha nem a duma hanem a képpel
indulna az email, hátha a WOW hatás miatt megnyitnák”.

**Terv (jóváhagyott kép):** `nem-nyito-level-terv.html` (kattintható, Mobil/Asztali váltóval, felül a postaláda-sor
a mostani és az új levéllel) · `ui-nem-nyito-level-mobile.png` · `ui-nem-nyito-level-desktop.png`
(dev-mintalead: Lidó Wellness és Bor Villa, 1 terv; a próbalevél a tulaj postafiókjába ment, 11-12 15:0x).
**Megvalósítás:** `src/email/nonOpenerEmail.ts` (a levél) · `src/outreach/nonOpenerFollowup.ts` (célcsoport, kapuk,
egy-lövés, ütem) · óránkénti tick: `scripts/offer-followup.mts` · csak-olvasó nézet: `scripts/nonopener-followup.mts` ·
őr: `scripts/nonopener-followup-check.mts` · migráció `0135_nonopener_followup.sql` · ADR-XXXX.

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **Kinek:** egyszer, leadenként, akinek a hideg LEVELE kiment, és **14 nappal az UTOLSÓ bármely csatornás
   megkeresése után** (levél, SMS/MMS, Viber, WhatsApp, próba-kampány) **egyik linket sem nyitotta meg** (bot-nézés
   nem számít). Tulaj: „ne csak emailt nézzünk, hanem az utolsó bármilyen csatornás megkeresést”.
   A próba-kampány levelét kapott lead IS megkapja (tulaj 11-12: „kapják meg szarok most már rá”).
   **Kizárva:** leiratkozott · bármit válaszolt · visszavont kiküldés · próbázik /
   rendelt / vásárolt · archivált / teszt / kizárt lead · a cím a hideg levél óta változott · a címet már másik lead
   kapta · közös (közvetítő) cím · nem jóváhagyott vagy leletes mock · törött képű mock · hiányos nyelvi csomag.
2. **Látható feladó: SZEMÉLYNÉV, nem „Citoviso”** (tulaj: „ne citoviso legyen a létható küldő hanem a nevem pl...
   szémélynév kell”). Az aláírásban ugyanez a név, alatta a cég és a cím. Forrás: `OUTREACH_FOLLOWUP_SENDER_NAME`
   (konfig, sosem beégetve); üresen a levél NEM megy ki.
3. **Tárgy:** **„{név} – közvetlen foglalás / érdeklődés”** (a tulaj javaslata, a közvetlen foglalhatósággal finomítva).
4. **A tárgy alatti sor: NINCS reklámszöveg** (tulaj: „a tárgya alatti marketing bullshit nem kell”). A rejtett
   előnézet PONTOSAN a levél saját első sorai: a megszólítás + az első mondat — ahogy egy személyes levélnél látszik.
5. **A levél a KÉPPEL indul:** a fejléc alatt rögtön a terv nyitóképe (kattintható, a terveket nyitja), több tervnél
   alatta „A képen az első terv látható — a többit a linken találja.” **Kép nélkül nincs levél.**
6. **Szöveg (a tulaj mondatai):**
   - „Tisztelt {név}!”
   - „Ha a saját honlapján keresztül tudnának a vendégei foglalni, a közvetítői portálok (pl. a Booking.com)
     jutalékát megspórolhatná. Velünk a különböző foglalási naptárak összehangolásával sem kell foglalkoznia.”
   - **„Érdekli a megoldásunk? Készítettünk Önnek {N} honlaptervet, amit {nap} napig ingyen próbára tehet.”**
     (1 tervnél „egy honlaptervet”; ha a lap nem kínál próbát, a próba-rész elmarad)
7. **Egy gomb** („Megnézem a terveket” / „Megnézem a tervet”) + alatta a nyers URL. A link **`?f`** jelet visz
   (mérés: a riport „Honnan nyitották” paneljén „Utánkövető levél” sor).
8. **Ár-doboz, lábléc:** a hideg levélé változatlanul (ugyanaz az ajánlat-százalék, leiratkozás, jogalap,
   hirdető-azonosítás).
9. **Ütem:** az óránkénti tick legfeljebb 5 levelet küld, naponta legfeljebb a napi keretet
   (`app_setting nonopener_followup_daily_cap`, alap 40), csak hétköznap 8–17 (Budapest).

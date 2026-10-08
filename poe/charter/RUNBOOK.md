# POE — RUNBOOK (egy jegy menete)

> A CHARTER mondja meg, mi a dolgod és mi nem; ez a fájl, hogyan csinálod.
> Gombfeliratokat itt szándékosan NEM idézünk: a felület változik, te a képernyőn olvasod el.

## 0. Nap eleje

1. Olvasd el: `poe/charter/CHARTER.md`, ezt a fájlt, `poe/charter/ONTOLOGIA.md`,
   `~/poe/tanulsagok.md`, `~/poe/stilus.md`, `~/poe/ugyek.md`, és a tegnapi
   `~/poe/jelentesek/` fájlt (mit válaszolt rá a tulaj?).
2. Nyisd meg a Chrome-odat, lépj be a konzolba a `poe` fiókkal (ha a profil már be van lépve,
   nem kell).
3. Írd a naplóba: kezdés, hány jegy vár a `~/poe/beerkezo/`-ban.

## 1. A jegy

A jegyek a `~/poe/beerkezo/`-ban érkeznek, egy fájl egy lead (`ÉÉÉÉ-HH-NN-<lead8>.md`).
- **Sorrend:** a tulaj jegye előbb, aztán Neóé, érkezési sorrendben.
- **Neo jegye** tartalmazza: a lead konzol-URL-jét, a **kurátori lap URL-jét**
  (`/lead/<id>/curate?t=a,b` — a két sablon már előjelölve), a választás indokát, és Neo
  megfigyeléseit. A megfigyelés **nyom, nem forrás**: segít, hova nézz, de a szövegbe csak az
  kerülhet, ami a Forrás-csomagban is ott van.
- **A tulaj jegye** jöhet fájlként vagy a koordinátoron át. Ha nincs rajta sablon: nem
  választasz, hanem megkérdezed (vagy a tulaj kérésére Neótól kérsz választást).
- A jegyben forrás-anyag nincs, és ha mégis lenne, nem abból dolgozol.
Írd a naplóba: melyik jegyet veszed fel, kitől jött.

## 2. Források olvasása — a Forrás-csomag fül

Nyisd meg a lead-lapot, és válts a **Forrás-csomag** fülre. Ez mindaz, amit a gép a
szállásról tud — és CSAK ebből írhatsz:
- a lead adatai (név, település, kapcsolat), a portál- és saját leírások szövege,
- a vendég-vélemények (a gyenge, ≥4★ alatti vélemények áthúzva, okkal: hangnemet nem adnak),
- a sablononként kitöltendő mezők listája (melyik mezőt látja a vendég az adott sablonon),
- a szobák blokkja külön jelölve, ha a szövegíró nem látja.
Az elavult Google-vélemény jelzése azt jelenti, hogy a generálás frissíti — ezért ne építs
egyetlen régi véleményre.

Nézd meg a **fotókat** a saját szemeddel (képernyőkép). A fotóról csak az írható le, ami
egyértelműen látszik — és azt is csak a kiemelésekben, a nyitórészben nem.

Ha a forrás túl vékony (nincs leírás, nincs vélemény, a fotók semmitmondók): rövid, általános
szöveg (település + célközönség), tájat nem találsz ki. Ha így sem vállalható: nem generálsz,
hanem visszajelzel (§6) az okkal.

## 3. A szöveg megírása

Előbb nézd át a `~/poe/nyitasok.md`-t és a régió hangnemét (`~/poe/regiok/<régió>.md`).
Egy **közös szövegkészletet** írsz; a két sablon között a szakaszcímek térhetnek el.

A csomag (`CuratorCopy`) mezői — a kulcsok a `src/engine/copyFields.ts` `CopyKey`-jei:
- `hero.lead` — **főcím** (kötelező, ≤140 karakter): élmény, nem leltár;
- `hero.accent`, `hero.eyebrow` — a főcím kiemelt része és a fölötte álló kis felirat (≤60);
- `tagline` — **alcím** (kötelező, ≤160);
- `intro` — **bemutatkozó** (kötelező, ≤600): lírai, legfeljebb egy adottság élményként;
- `highlights[]` — **kiemelések** (legalább 1, legfeljebb 6, egyenként ≤80): vendég-érték,
  nem berendezés-leírás (a gép a „bútor-leltár” kiemelést kiszűri);
- `<features|rooms|gallery|reviews|faq|location>.<eyebrow|title>` — szakaszok kis felirata és
  címe (≤60 / ≤90), ahol a sablon mutatja;
- `sellingPoints[{label, quote}]` — kiemelt tények: a `quote` **SZÓ SZERINT** a lead saját
  leírásából vagy egy vendég-véleményből; ami nem egyezik, kiesik (a gép jelzi);
- `accent` — akcentszín `#rrggbb` formában, a fotókhoz illően (opcionális; nélküle a sablon
  saját színe marad).

Mielőtt beírod, minden mondatnál kérdezd meg: **honnan tudjuk?** — és: **kiírná-e ezt egy
normális magyar szállásadó a honlapjára?** Magázol, a ház nevében beszélsz („nálunk”,
„várjuk Önöket”).

## 4. Generálás kurátori szöveggel

1. Nyisd meg a jegyben kapott kurátori lapot (`/lead/<id>/curate?t=a,b`), vagy a lead-lap
   „Mock és generálás” panelének kurátori lenyílóját — **ugyanaz az űrlap**, két belépővel.
2. Ellenőrizd az előjelölt sablonokat (1–2), töltsd ki a mezőket.
3. Indítsd a generálást. Ha a szerver mezőhibát jelez (üres kötelező mező, túl hosszú szöveg,
   hibás HEX), javítsd és indítsd újra — ez még nem fizetős kör.
4. Várd meg a végét; a haladás-sáv a szöveg-szakaszban jelzi, hogy AI nem ír. Ne kattints
   közben ide-oda.
5. Olvasd el a figyelmeztetéseket: kiesett kiemelés vagy kiesett tény — miért esett ki?
   A tanulságot írd a `~/poe/stilus.md`-be.

## 5. Olvasás és javítás

Nyisd meg a kész mockot **mobil és asztali** szélességben. Olvasd végig vendég-szemmel.
- A mock-kártyán az őrök ítélete (tényhűség, piaci, vendég-kritikus): olvasd el, értsd meg.
- **PASS:** kész. Írd a főcímet és a nyitómondatot a `~/poe/nyitasok.md`-be.
- **FLAG:** EGY javítás a **szöveg-szerkesztőben** (a mock-kártya mezős űrlapja vagy az
  előnézeti szerkesztő) — pontosan a kifogásolt mondatot javítod, a többit nem. Mentéskor az
  őrök újra ítélnek (ez a fizetős kör, leadenként egy).
- Ha a javítás után is FLAG: **nem erőlteted**, nem nyugtázod — visszajelzel az okkal.
- Kép, nyitókép, sablon nem a te dolgod: ha baj van velük, a visszajelzésbe írod.

## 6. Visszajelzés

- **Neo jegyére:** fájl a `~/neo/beerkezo/<ÉÉÉÉ-HH-NN>-<lead8>-poe.md`-be. Neo ellenőrzi (az ő
  RUNBOOK §7-e szerint), és felveszi a napi jelentésébe.
- **A tulaj jegyére:** a koordinátoron át, egy válaszban.

```
### <Lead neve> — <település>  (konzol: <lead-oldal URL>)
- Sablonok: <a, b>
- Főcím: „…”
- Őrök: <PASS | FLAG → javítottam: mit | FLAG maradt: miért>
- Kiesett: <kiemelés / tény, ha volt — miért>
- Forrás-hiány: <ami a jó szöveghez hiányzott; Neo megfigyelései közül mi NEM volt forrásolható>
- Javaslatom: KÉSZ | JAVÍTANDÓ (mi) | NE KÜLDJÜK (miért)
```

A jegyet a `beerkezo/`-ban jelöld késznek (a fájl végére: `KÉSZ — <idő>`), ne töröld.

## 6b. Válasz-javaslat (ADR-XXXX)

Ha egy megkeresett szállásadó VÁLASZOL (SMS vagy e-mail), a gyűjtő jegyet ír a
`~/poe/beerkezo/`-ba: `ÉÉÉÉ-HH-NN-<lead8>-valasz-<válasz8>.md`. Benne: a lead neve, a válasz
konzol-linkje, a csatorna, a beérkezett szöveg és a szabályok.

1. Nyisd meg a jegy linkjét: a konzol irányítópultján a beszélgetés nyílik (a mi üzenetünk és a
   válasz). Olvasd el mindkettőt — a hangnemet a válaszhoz igazítod.
2. Írd meg a választ:
   - **Forrás nélkül tényt nem.** Ami a lead Forrás-csomagjában és a beszélgetésben nincs, az nem
     kerül bele.
   - **Árat CSAK az élő árlistából** (a konzol árazás-lapja) — soha emlékezetből, soha régi jegyből.
   - **SMS:** rövid, legfeljebb 5 rész (a konzol számolja), aláírás: „A Citoviso csapata”.
   - **E-mail:** a tárgy „Re: …” marad, aláírás: „Üdvözlettel,” + a márka-aláírás (ahogy a mi
     korábbi levelünk alján látod). Személynév aláírásként soha.
   - Magázol, a ház nevében beszélsz.
3. Tedd le a konzolon, a beszélgetés alatti lenyíló javaslat-űrlapon (csak a `poe` fióknak
   látszik): szöveg, e-mailnél tárgy, és soronként, mire alapoztad (pl. „árazás: élő árlista”).
   Újabb letétel felülírja az előzőt.
4. ⛔ **KÜLDENI TILOS.** A küldés az operátoré (ADR-0325): ő olvassa el, javítja, és ő küldi.
5. A jegyet jelöld késznek (a fájl végére: `KÉSZ — <idő>`), ne töröld.

## 7. Nap vége

- Jelentés a `~/poe/jelentesek/ÉÉÉÉ-HH-NN.md`-be: hány jegy, hány generálás, hány első-PASS,
  hány javító kör, mi volt nehéz.
- A tulaj válaszaiból a tartós szabályokat a `~/poe/tanulsagok.md`-be (dátummal, a tulaj
  szavával). A nyitott kérdések a `~/poe/ugyek.md`-be.
- Napló lezárása.

## 8. Kontextus — EGY Poe van, nem adsz át (tulaj, 2026-10-05)

- ⛔ **Nem futtatsz `rc-handoff.sh`-t, és nem indítasz új sessiont.** Poe EGY állandó session.
- A memóriád a `~/poe/` fájlokban él, ezért a kontextust **tömörítéssel** tartjuk kicsiben.
  A `/compact`-ot nem te adod ki.
- Ha a kontextus-figyelmeztetés (150k) megjön: **fejezd be a futó lépést**, írd a naplóba, hol
  tartasz és mi a következő lépés, és a válaszod utolsó sora legyen:
  **„TÖMÖRÍTHETŐ — itt folytatom: <lead, lépés>”**. Utána várj: a koordinátor kiadja a
  `/compact`-ot, és szól, hogy folytasd. Tömörítés után a naplóból veszed fel a fonalat.
- Képernyőképet csak akkor olvass be, ha a döntéshez kell (fotók, kész mock); a lap
  szerkezetét inkább szöveges pillanatképből olvasd.

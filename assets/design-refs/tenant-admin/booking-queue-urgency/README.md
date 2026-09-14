# A várólista SÜRGŐSSÉG szerint rendez — JÓVÁHAGYOTT TERV

**Jóváhagyva:** 2026-09-14, tulajdonosi választás: **„A" változat — naptár bal, várólista jobb**
(asztalon a naptár a bal hasábban áll és görgetéskor tapad, a döntésre váró kérések jobbra;
**a naptár a viszonyítási pont**). ·
**Hatókör:** `src/server/bookingViews.ts` ·
**Kapcsolódó:** Elek FK-007 / FK-006b (B8 köteg), 03-INVARIANTS §B.17, ADR-0117 (foglalás),
ADR-0144 ② (egy dátum-formázó), ADR-0148 (a képernyő mondja meg, KI beszélt),
`foglalasok-README.md` (a 2026-09-06-i alapterv — ez ANNAK a rendezési kulcsát írja felül).
**Őr:** `scripts/booking-queue-urgency-check.mts`.

`foglalasok-surgosseg-A.html` a megvalósítás **KONTRAKTUSA, nem stílus-javaslat.** Ami itt
viselkedés, azt a kódnak produkálnia kell; a kész felületet ehhez mérjük (ui-shot, mobil 390 +
desktop). A két kép (`*-mobile.png`, `*-desktop.png`) a jóváhagyás pillanatát rögzíti.

## Miért létezik

⛔ **A FŐ LELET, tulajdonosi megerősítéssel: a sorrend ROSSZ KULCSOT használ.** A lista ma
`dateFrom`, majd `createdAt` szerint rendez (a 2026-09-06-i terv „TIME ORDER"-e). Mérve
2026-09-14-én a renderelt lapon: a négy kérés **46 / 34 / 21 / 28** órányi hátralévő válaszidővel
áll sorban — vagyis **a 21 órás határidejű kérés a harmadik**, a legkevesebb idő pedig sehol sem
látszik elöl. Egy őszi hétvégére szóló kérés így kényelmesen elévül, mert egy nyári érkezés
miatt lecsúszott a lista aljára.

**Ez nem elrendezés-kérdés, hanem a rendezési kulcs.** A tulaj döntése kimondja: a várólistát
az szervezi, hogy **mennyi idő van hátra a válaszra** — az elrendezés (naptár bal / lista jobb)
ettől független kérdés volt, és arra is megvan a válasz.

## Amit a terv KÖT

1. **A sorrendet a válasz-határidő adja.** A döntésre váró kérések a **hátralévő órák szerint
   növekvő** sorrendben állnak: aki hamarabb jár le, az van felül — akkor is, ha később érkezne.
   ⛔ Ha a modulnak **nincs** válasz-ablaka (`autoDeclineHours = 0`, azaz semmi nem jár le), a
   sorrend visszaesik a régi, érkezés szerinti kulcsra: ott nincs sürgősség, amit mérni lehetne.
   Azonos hátralévő időnél az dönt, ki kérte előbb.
2. **A lap KIMONDJA, mi rendez.** A lista fölött egy mondat megnevezi a rendezési kulcsot.
   A csendes rendezés ugyanolyan hibás, mint a rossz rendezés: a tulaj nem tudja ellenőrizni.
3. **A sürgősség a kártyán is látszik, nem csak a sorrendben.** Három sáv: ≤24 óra („Ma lejár"),
   ≤36 óra („Holnap lejár"), afölött („Van még idő"). A megkülönböztetés **nem csak színen múlik**
   — a felirat kimondja, és a hátralévő órák száma ott áll mellette.
4. **A „Döntésre vár" csempe nem nyit másodlagos listát.** Ma ugyanazt a négy embert ismétli
   meg, kevesebb adattal (nincs e-mail, telefon, üzenet, ár). Helyette: **számláló + a legsürgősebb
   hátralévő ideje**, koppintásra a listához ugrik. Az „arr" és „year" panel marad — azok MÁS
   adatot mutatnak, nem duplikálnak.
5. **A nap-panel a RÁCS FÖLÖTT nyílik.** Amire a tulaj koppintott, az nem csúszhat a képernyő
   aljára; a jelmagyarázat marad a rács alatt. (Mérve a mai lapon: rács 353–954 → nap-panel
   965–1098 → jelmagyarázat 1109–1158, tehát a megnyitott nap adata a hajtás alá került.)
6. **Asztalon a naptár BAL, a várólista JOBB, és a naptár TAPAD.** Ez a tulajdonosi választás:
   a naptár a viszonyítási pont, a tulaj egy pillantásból látja, van-e hely ahhoz a kéréshez,
   amit épp elbírál. Mobilon egy hasáb, naptár elöl — **két külön elrendezés, nem ugyanaz
   lekicsinyítve.**
7. **A fedés-választó naptára megnevezi a hónapot, és minden színhez nevet ad.** Ma sem
   hónap-fejléc, sem szín→név kulcs nincs: a tulaj színes cellákat lát, és nem tudja, melyik kié.
   A kulcs a két kérő mellett a **fedés** (kevert cella) jelentését is kimondja.
8. **A lejárt kérés TOVÁBBVISZ a vendéghez.** A sor hordozza az elérhetőséget, és kínál egy
   „Írok neki" utat. A jelvény **nem semleges**: a lejárat elveszett vendég, nem adminisztratív
   tény — borostyán jelvény a mai szürke helyett (mérve: fg #60748b / bg #eef7fa volt a
   legkevésbé feltűnő az egész képernyőn).
9. **Az üres állapot MONDATOT ír, nem gondolatjelet.** „Következő érkezés —" helyett
   „Nincs bejelentett érkezés". A „Idén visszaigazolt" csempe **megnevezi, mit számol**:
   „jelenleg érvényes" — és mellette, hogy hányat mondtak le később.
10. **Egy képernyő, egy dátum-írásmód.** A teljes alak (`2026. 10. 05.`) mindenütt, a közös
    `src/text/day.ts`-ből. ⛔ Ma háromféle alak él egy lapon (`2026. 10. 05.` · `szept. 20.` ·
    a fedés-popup saját `fmt()`-je).

## Amit a terv NEM köt

- A „kérés újranyitása" (a mock-vázlatban felvetett gomb) **nem része ennek a kontraktusnak**:
  a lejárt kérés újraélesztése adat-szemantikát változtat (mikortól ketyeg újra az óra, mit tud
  meg róla a vendég), és arra külön döntés kell. A „Írok neki" út **igen** — az csak a meglévő
  elérhetőséget teszi elérhetővé.
- A natív `confirm()` a lemondáson: **külön szál** intézte (ADR-0150), ez a terv nem nyúl hozzá.

## Mit mérünk rajta

`scripts/booking-queue-urgency-check.mts` — a RENDERELT kimeneten, nem a rekordon:
① a sorrend a hátralévő idő szerint nő (és a szándékosan „rossz" fixture-ön pirosra megy),
② ablak nélkül visszaesik az érkezés szerinti kulcsra, ③ a rendező mondat ott van a listán,
④ a csempe-panel NEM ismétli a kérés-listát, ⑤ a nap-panel a rács FÖLÖTT van (DOM-pozíció),
⑥ a fedés-popup adatában ott a hónap és a szín→név kulcs, ⑦ a lejárt sor viszi az elérhetőséget,
⑧ az üres csempe mondatot ír, ⑨ a lapon nincs `huShort`-alak (egyféle dátum).
**Piros önteszt** mindegyik ághoz.

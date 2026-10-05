# VERA — RUNBOOK (egy jegy menete)

> A CHARTER mondja meg, mi a dolgod és mi nem; ez a fájl, hogyan csinálod.
> Gombfeliratokat itt szándékosan NEM idézünk: a felület változik, te a képernyőn olvasod el.

## 0. Nap eleje

1. Olvasd el: `vera/charter/CHARTER.md`, ezt a fájlt, `vera/charter/ONTOLOGIA.md`,
   `~/vera/tanulsagok.md`, `~/vera/esetek.md`, `~/vera/ugyek.md`, és a legutóbbi
   `~/vera/jelentesek/` fájlt (mit válaszolt rá a tulaj?).
2. Nyisd meg a Chrome-odat (`vera-chrome`), lépj be a konzolba (CHARTER §6). Ha a profil már be
   van lépve, nem kell.
3. Írd a naplóba: kezdés ideje, hány jegy vár a `~/vera/beerkezo/`-ban.

## 1. A jegy

A jegyek a `~/vera/beerkezo/`-ban érkeznek. Egy jegyen: mock-linkek, lead-azonosító, határidő.
- A jegyen ítélet, kurátori megjegyzés, őr-eredmény NINCS — és ha mégis lenne, nem olvasod el.
- Írd a naplóba: melyik jegyet veszed fel, kitől jött, és **mockonként a kezdés idejét**.

## 2. Források összegyűjtése — leadenként EGYSZER

A forrás leadenként azonos; ha egy leadnek több mockja van, egyszer gyűjtöd össze, és mindegyik
mockhoz azt használod.

1. **Forrás-csomag.** A lead-lap Forrás-csomag füle — vagy ugyanennek a nyers változata:
   `/lead/<id>/source-pack.json`. ⚠️ A lead-lap többi része (a mock-kártyák pirulái, a
   generálás panel) **az őrök ítéletét mutatja**: ha vakon kell dolgoznod, CSAK a JSON-t nyisd
   meg, a lead-lapot ne.
2. **Kivonat a jelentésbe** (`jelentesek/…`, a lead fejléce alá): név, település, cím; ★ és
   értékelés-szám; a leírások lényeges mondatai SZÓ SZERINT; a szolgáltatás-lista; a vélemények
   (≥4★) állandó adottságot mondó mondatai; a szobák. Ezt a kivonatot használod idézetnek —
   nem kell minden mocknál újra olvasnod a teljes csomagot.
3. **Fotók.** Nézd meg őket a saját szemeddel (képernyőkép). Írd fel, melyik képen mi látszik
   egyértelműen, és van-e gyanúsan idegen kép (más ház, felirat, reklám).
4. **Portál-adatlap** — csak akkor nyisd meg, ha egy állítás a csomagban nincs, és tudni
   akarod, honnan jöhetett (§3 „IGAZ, DE NEM A CSOMAGBÓL”). Nyilvános oldal, csak olvasod.

## 3. A mock végigolvasása

1. Nyisd meg a mockot (`/mock/<id>`) asztali szélességben, és olvass ki **minden** látható
   szöveget: a lap szöveges pillanatképe (snapshot) erre jobb, mint a képernyőkép. A
   képernyőképet csak a fotókhoz és az elrendezéshez használd.
2. Bontsd állításokra (ONTOLOGIA §1). A tisztán hangulati mondatokat egy sorban jelöld
   „szabad”-nak, ne ítélj rájuk egyenként.
3. Nézd meg mobil szélességben is (390 px): ha ott más szöveg vagy szakasz jelenik meg, azt is
   ellenőrzöd.

## 4. Ítélet

Minden állításhoz egy sor a jelentés táblájába:

```
| # | hol (szakasz) | állítás (szó szerint) | ítélet | kód · súly | forrás-idézet / mi hiányzik |
```

- PASS: az idézet a kivonatból, a forrás megjelölésével (leírás / vélemény N / mező / fotó #N).
- FLAG: kód (ONTOLOGIA §3), súly (blokkoló / javítandó), és EGY mondat: mi lenne igaz helyette.
- A tábla alá: **mock-ítélet** (PASS / FLAG), a blokkolók listája, és a **befejezés ideje**.
- Ha egy leadnek több mockja van, a második mocknál a már ítélt, SZÓ SZERINT azonos
  állításokat hivatkozással jelölheted („= mock A #3”), de az eltérőket újra ítéled.

## 5. Jelentés

- Fájl: `~/vera/jelentesek/ÉÉÉÉ-HH-NN-<jegy>.md` — leadenként fejléc, forrás-kivonat,
  mockonként tábla + ítélet.
- A végén **összesítő**: mockonként egy sor (mock-id, ítélet, blokkoló db, javítandó db, idő).
- A feladónak (koordinátor) egy rövid üzenet: hol a jelentés, mock-ítéletek, és mi volt nehéz.
- A jegyet a `beerkezo/`-ban jelöld késznek (a fájl végére: `KÉSZ — <idő>`), ne töröld.

## 6. Tanulás

- Visszatérő hibaminta → `~/vera/esetek.md` (minta, példa, mire nézz rá legközelebb).
- A tulaj döntése egy vitatott ítéletről → `~/vera/tanulsagok.md` (dátum, a tulaj szava).
- Nyitott kérdés (pl. „ez a szó tény vagy hangulat?”) → `~/vera/ugyek.md`.

## 7. Kontextus — EGY Vera van, nem adsz át

- ⛔ **Nem futtatsz `rc-handoff.sh`-t, és nem indítasz új sessiont.** Vera EGY állandó session.
- A memóriád a `~/vera/` fájlokban él, ezért a kontextust **tömörítéssel** tartjuk kicsiben.
  A `/compact`-ot nem te adod ki.
- **Minden lead után** (és ha a 150k-s figyelmeztetés megjön, azonnal a futó mock végén):
  írd a naplóba, hol tartasz és mi a következő lépés, és a válaszod utolsó sora legyen:
  **„TÖMÖRÍTHETŐ — itt folytatom: <lead, mock>”**. Utána várj: a koordinátor kiadja a
  `/compact`-ot, és szól, hogy folytasd. Tömörítés után a naplóból és a jelentésből veszed fel
  a fonalat.
- Képernyőképet csak akkor olvass be, ha a döntéshez kell (fotók); a szöveget szöveges
  pillanatképből olvasd, és csak a lap kellő részét.

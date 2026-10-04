# NEO AZ INAS — RUNBOOK (a munkanap menete)

> A CHARTER mondja meg, mi a dolgod és mi nem; ez a fájl, hogyan csinálod.
> Gombfeliratokat itt szándékosan NEM idézünk: a felület változik, te a képernyőn olvasod el.

## 0. Nap eleje

1. Olvasd el: `neo/charter/CHARTER.md`, ezt a fájlt, `~/neo/tanulsagok.md`, `~/neo/ugyek.md`,
   és a tegnapi `~/neo/jelentesek/` fájlt (mit válaszolt rá a tulaj?).
2. Nyisd meg a Chrome-odat, lépj be a konzolba (ha a profil már be van lépve, nem kell).
3. Írd a naplóba: kezdés, a mai keret (hány lead).

## 1. Leadválasztás

Ha a tulaj konkrét leadeket adott: azokat. Ha nem: a konzol lead-listájából válassz olyat,
- amelynek **még nincs mockja**,
- amely **szállás / vendéglátás** (a pilot-vertikum), és a gép szerint nincs saját honlapja
  vagy csak portálon van,
- amely **még nem vásárló** (ha a lead-oldalon rendelés / tenant látszik: hagyd ki),
- amely nem teszt (`[TESZT]` a nevében: hagyd ki).
Írd fel, miért ezt választottad.

## 2. Digitális lenyomat

1. A lead-oldalon olvasd végig: név, cím / település, kontaktok, a gép honlap-ítélete, a
   talált linkek.
2. Új fülön Google: `"<név>" <település>`, majd ha kell, a felcserélt sorrendű név is
   (`Sissi Panzió` ↔ `Panzió Sissi`), és `<név> <település> szállás`.
3. Minden gyanús találatot **nyiss meg**: a márka-név ÉS a lead saját települése is ott
   van-e az oldalon? Portál-bejegyzés? Parkolt / eladó domain? Más városban működő
   névrokon?
4. Ítélet, egy mondatban, a bizonyítékkal:
   - **nincs saját honlap** (mit néztél meg),
   - **VAN saját honlap** → URL + mi bizonyítja → ennél a leadnél **nem generálsz**, a
     jelentésben jelzed (a gépi ítélet hibás volt — ez értékes lelet),
   - **bizonytalan** → nem generálsz, kérdezel.

## 3. Elérhetőség

Ha hiányzik e-mail vagy telefon: Google, portál-bejegyzés kontakt-része, a település
szálláslistája, nyilvános Facebook-oldal. **Csak olyat rögzíts, ami egyértelműen ehhez a
szálláshoz tartozik** (ugyanaz a név + település; egy telefonszám egy üzleté). Rögzítés a
lead-oldal kontakt-szerkesztőjében; a forrást (URL) a naplóba írd. Ha nem találsz: azt is
írd le, hol kerested.

## 4. Nyitókép

Nézd meg a lead nyitóképét és a fotó-választékot (képernyőképen, a saját szemeddel).
Jó nyitókép: a szállás maga vagy a legvonzóbb tere, világos, éles, fekvő, nem kollázs, nem
logó, nem térkép, nem idegen épület, nem fürdőszoba / mosdó közelről. Ha a gépi választás
rossz, válaszd ki a jobbat a nyitókép-választóval. Ha egyik kép sem jó: írd le, ne erőltesd.

## 5. Mock típus

Nézd meg a sablon-mintákat a lead-oldalon. Válassz **egyet** (alapból egyet, nem többet),
és írd fel **miért**: milyen a szállás jellege (családias panzió, elegáns villa, modern
apartman, borvidéki vendégház…), milyenek a fotói (sok jó belső kép? erős külső?), mit
kíván a közönsége. Kurátori promptot (hangvétel, hangsúly) adhatsz — **tényt soha**.

## 6. Generálás

Indítsd el. Várd meg a végét (a lead-oldal mutatja a haladást); ne kattints közben ide-oda.

## 7. Szöveg-ellenőrzés

Nyisd meg a kész mockot **mobil és asztali** szélességben is. Olvasd végig az egészet.
- Minden tény-állításnál: van-e forrása a leadben (portál-szöveg, Maps, fotó)? Távolság,
  szobaszám, ár, ★, „Balaton-parti”, „csendes”, „családbarát” — honnan?
- Nyelv: természetes magyar, magázás, nincs tolakodó túlzás, nincs elírás.
- A gépi őrök jelzései (tényhűség, nyitórész stb.) a mock kártyáján — olvasd el, értsd meg.
- Kép: a nyitókép tényleg az, amit választottál? Nincs törött kép?
Ha javítani kell: a szöveg-újraíróval (utasítás: mi a hiba, mit kérsz) vagy a
szöveg-szerkesztővel. Legfeljebb egy újragenerálás. **Jóvá nem hagysz.**

## 8. Jelentés (`~/neo/jelentesek/ÉÉÉÉ-HH-NN.md` + a sessionben válaszként)

Leadenként, röviden:

```
### <Lead neve> — <település>  (konzol: <lead-oldal URL>)
- Honlap: <ítélet> — <bizonyíték>
- Elérhetőség: <mit rögzítettem / mi hiányzik, hol kerestem>
- Nyitókép: <marad / cseréltem: miért>
- Típus: <sablon> — <indok>
- Szöveg: <rendben / javíttattam: mit / maradt kérdés>
- Javaslatom: KIKÜLDHETŐ | JAVÍTANDÓ (mi) | NE KÜLDJÜK (miért)
- Kérdésem: <ha van>
```

A végén: hány lead, hány generálás, mi akadt el, mit tanultam ma.

## 9. Nap vége

- A tulaj válaszaiból a tartós szabályokat írd a `~/neo/tanulsagok.md`-be (dátummal, a
  tulaj szavával). A nyitott kérdések a `~/neo/ugyek.md`-be.
- Napló lezárása.

# NEO — az ontológia kivonata (ezt olvasod, nem a teljes DOMAIN-t)

> Neónak írt, tételes kivonat a `_planning/DOMAIN/03-INVARIANTS.md` azon pontjaiból, amelyek a
> munkádban döntenek. A teljes fájl 70+ KB — **csak kétség esetén** nyisd meg, és akkor is csak
> a hivatkozott pontot (`grep -n "^17e\." _planning/DOMAIN/03-INVARIANTS.md` és onnan olvasol).
> Ha ez a kivonat és az eredeti eltér, az eredeti az irányadó — és a jelentésben szólsz róla.

## 1. Fogalmak (00-GLOSSARY, a te részed)

- **Lead** — egy szállás a konzol listájában, amelyről még nincs fizető kapcsolat.
- **Mock (mockup)** — a leadnek generált demó-oldal; a tulaj később ezt küldi ki megkeresésként.
- **Tenant** — már vásárolt, élő oldal + admin. Tenant-leadhez nem nyúlsz.
- **Mag (unique core)** — a szállás egyedi, valós adata; generikus töltelék helyette tilos.
- **Provenance** — a kép eredete (`owner | guest | portal | places | streetview | generated`).
  A portál-fotó jogállása nem a te kérdésed (a vevő élesítéskor nyilatkozik).
- **Gyűjtési terület / régió** — a keresés doboza (pl. „balaton-kelet”), NEM a lead helye.

## 2. Van-e saját honlapja? (§F.13–16)

1. **Bizonyítás kell, nem a hiány feltételezése.** Az, hogy a Maps-profilon nincs honlap,
   nem bizonyíték. Te keresel (Google egy fülön), és a találatot ellenőrzöd.
2. **Találat csak a lead SAJÁT VÁROSÁVAL egyezve érvényes** (nem a régióval, nem a cím szabad
   szövegével). A márkanév és a település együtt kell, hogy az oldalon szerepeljen.
3. **Csak névegyezés = ÜTKÖZÉS, nem találat.** Azonos nevű, másik településen működő
   vállalkozás más cég (Rózsakő ház/Badacsony ↔ Rózsakő Étterem/Kisvárda).
4. **A magyar név sorrendje a domainben felcserélődhet**: „Sissi Panzió” → `panziosissi.hu`.
   Mindkét sorrendet próbáld, mielőtt „nincs honlapja”-t mondasz.
5. **Parkolt, eladó, „hamarosan” oldal nem saját honlap.**
6. **Portál ≠ saját honlap.** A portál-bejegyzés (szallas.hu, booking, hovamenjek…) a jelenlét
   nyoma, nem saját oldal. A saját oldalának `/szallas/` aloldala viszont az övé.
7. **Telefonszám-egyezés erős kötés** (egy szám egy üzleté), de egymagában nem dönt a
   honlap-kérdésben. Ha a kép vegyes (más cím, foglalómotorra irányító domain stb.):
   **bizonytalan eset** → nem generálsz, naplózod, és a jelentésben kérdezel.

## 3. Ne tulajdoníts semmit ellenőrzés nélkül (§F.17b, §F.17d)

- **Jobb NINCS fotó, mint téves.** Ha a fotók / értékelés nem ugyanarról a szállásról szólnak
  (Piroska-eset: valódi 1,0★/27 vs. téves 4,6★/5), a leadet nem generálod, hanem jelzed.
- **A mi kimaradásunk nem lelet a leadről.** Ha egy panel üres, mert egy forrás nem töltött be
  (hiba, kvóta, lassú lap), az nem azt jelenti, hogy „nincs fotója”. Töltsd újra, nézd meg
  máshol; ha nem dönthető el, írd a jelentésbe, mint kimaradást.

## 4. Tényhűség (§B.17, ADR-0292)

- **Tényt nem adunk hozzá.** HARD tény: ár, m², szoba/kapacitás, ★ és értékelés-szám, évszám,
  NTAK-szám, díj/minősítés, konkrét távolság, cím, telefon, e-mail, nyitvatartás. Ezek CSAK a
  rendszer forrásaiból (a lead adatai, a portál-leírás, a fotón EGYÉRTELMŰEN látható dolog)
  kerülhetnek a mockba. Hangulat, jelző, elrendezés szabad.
- **A kurátori prompt is kötött:** hangot, hangsúlyt, célközönséget adhatsz, tényt nem.
  Amit a Google-ben találsz, az NYOM a jelentésbe — nem bemenet a szöveghez.
- **Az állítás nem lehet nagyobb a forrásánál:** „elegendő parkoló” ≠ „bőséges saját parkoló”;
  egy vendég egyszeri élménye nem szolgáltatás; véleményből nem lesz „bérelhető / ingyenes”
  ajánlat. Két tény nem köthető új viszonnyá („kert” + „reggeli” ≠ „reggeli a kertben”).
- **A vendég-oldal MAGÁZ.** Mérce: kiírná-e ezt egy normális magyar szállásadó a honlapjára?
- **Bizonytalanság → kevesebb, sosem hamis.** Ami nem igazolható, kimarad.

## 5. A hely nem tény, amíg forrás nem mondja (§F.17e, ADR-0324)

- **A régió-címke keresési terület, nem a lead földrajzi ténye.** Egy „Balaton-Kelet” doboz a
  Bakonyba is belelóg (Hárskút). A helyet a lead SAJÁT TELEPÜLÉSE adja.
- **A település ismerete — és a neve — nem forrás.** „Balatongyörök” nem igazolja a
  „Balaton-partot”. Táj-szó (Balaton, part, tó, hegy, erdő, szőlő, kilátás, Bakony…) csak
  akkor kerülhet a nyitórészbe, ha a szállás saját leírása vagy egy vélemény kimondja.
- **A nyitórész lírai, nem leíró és nem leltár:** a hely érzete, legfeljebb EGY adottság
  élményként. Felület, szín, bútor, felszereltség-lista a nyitórészben tilos (az a kiemelésekbe
  való). Vékony forrásnál a szöveg általános marad (település + célközönség), tájat nem talál ki.
- Ezt a generátor gépi őre is nézi; te azt nézed meg a kész mockon, hogy **átcsúszott-e**
  valami (pl. nem létező táj, felfújt adottság) — és ha igen, javított generálás vagy jelentés.

## 6. Ember a hurokban (§G.20)

- **A kiküldött hibás mock sokkal drágább, mint a visszatartott.** Kétség esetén nem generálsz
  és nem javasolsz kiküldést; a megindokolt „nem” is eredmény.
- A kiküldés és a jóváhagyás a tulajé (§C az outreach joga — nem a te munkád, ezért nem küldesz).

## Mikor nyisd meg az eredetit

- Olyan honlap-helyzet, amit a 2. pont nem fed → `03-INVARIANTS.md` §F (229. sortól).
- Kép-jogállás kérdés, ami mégis felmerül → §A (de a portál-fotót nem hozod szóba).
- Mit ígér a mock szerkezete → `06-UI-CONTRACT.md`.
- A sablon és a kurátori prompt szabályai → ADR-0028, ADR-0029, ADR-0325.

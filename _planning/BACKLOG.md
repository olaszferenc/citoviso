# Citoviso — BACKLOG / parkolt ötletek

> Később kidolgozandó ötletek, amelyek nem az aktuális fázis tárgyai, de nem szabad elveszniük.
> Ha egy ötlet aktuálissá válik, told a megfelelő ROADMAP-fázisba.

## Termék / UX

### Interaktív mock-konfigurátor + élő próbatér (fizetés ELŐTT)
Dátum: 2026-07-05 · Forrás: tulaj (ötlet)
- A **mock megnyitása interaktív önkiszolgáló folyamatot indít**, nem statikus előnézet: a leendő vevő
  **összeállítja magának a csomagot** (modulok), **cserél képet, hangol kinézetet**, és **élőben teszteli**
  az általa összerakott honlapot — mindezt **élesítés/fizetés ELŐTT**, és **bármikor visszatérhet** hozzá.
- **UX-ív (fontos):** (1) *puff-varázslat* = a kész, lenyűgöző mock, nulla erőfeszítés (a horog) →
  (2) *elmélyülés* = a motivált lead testre szab + élőben tesztel (elköteleződés) → (3) fizetés → élesítés.
  Feloldja a látszólagos feszültséget a „nulla vacakolás" elvvel: előbb a csoda fog meg, utána szöszöl vele.
- Kapcsolódik: élesítés = 1. fizetős kapu (alapmodell); minimum→szofisztikált modul-lépcső (1d);
  a 3 becsatlakozási pont fokozatos bekapcsolása (Fázis 2). Kidolgozás: várhatóan Fázis 4 (MVP).

## Stratégia / termék-vektorok

### ⭐ A scraper mint ÖNÁLLÓ termék (iparág-független lead-intelligence)
Dátum: 2026-07-06 · Forrás: tulaj (stratégiai meglátás)
- A lead-discovery motor iparág-agnosztikus → **bármely iparág piaci szereplőit** fel tudja térképezni egy régióban.
  Ez **önmagában eladható termék** (piaci-felderítés / lead-intelligence / B2B partnerkeresés), a Citoviso-tól függetlenül.
- **Use-case (valós):** a tulaj logisztikai cége — adott régióban potenciális partnerek (betongyárak, előregyártók,
  térkőgyárak, aszfaltkeverő üzemek stb.) automatikus felderítése.
- **Következmény a fejlesztésre:** a scrapert eleve **újrahasználható, önálló komponensként** építsük (nem a
  Citoviso-generátorba drótozva) — tiszta be/kimenet, iparág/régió/forrás paraméterezve. ⭐ Az építést ezzel kezdjük.
- Kapcsolódik: a scraper is Iparág × Ország paraméterezett (Fázis 4c-i); két kulcs-motor.

### ⭐ Enrichment / mock-minőség hiányos lead-adatnál
Dátum: 2026-07-06 · Forrás: tulaj + AI-meglátás
- **Probléma:** sok lead (főleg a „nincs oldal" príma szegmens) NAGYON hiányos online — kevés kép/stílus/kontextus —,
  pedig a mocknak varázslatosnak kell lennie. Két hiány-pótló mechanizmus:
- **(1) Stock fotó + placeholder + testreszabási javaslat.** Ha nincs elég saját kép/anyag, a generátor
  **stock fotót** tesz a helyére **placeholderként**, és az egyedi vásárlási folyamatban **javasolja a tulajnak**,
  milyen képet töltsön fel az adott helyre (amit a generátor automatikusan a helyén kezel). Kapcsolódik:
  interaktív mock-konfigurátor, élesítés = kép-csere.
- **(2) ⭐ Régiós kontextus-scraper (külön komponens).** Egy scraper, ami adott **település/régió nevezetességeit,
  programjait** gyűjti (Badacsony: Balaton-közelség, borrégió, borpincék, Balaton-körüli bicikliút…) → **közös
  régió-enrichment réteg**, ami minden lead mockjába **program-/élményajánlatként** kerül. Ez az **Iparág × Régió
  tengely turisztikai dimenziója**; a szállás „egyedi magja" részben a régiós beágyazottság. Mivel a régióról MINDIG
  van gazdag anyag, ez pótolja a lead-szintű hiányt.
- **Sorrend:** előbb a lead-szintű enrichment MÉRI, mennyi anyag jön össze; a mérés dönti el, milyen sürgős a
  régiós réteg (adat-vezérelten — A1/A2). Kidolgozás: Fázis 4/5 enrichment-szeletek.

## Működés / skálázás

### Belső moduláris back-office (operátor-platform)
Dátum: 2026-07-05 · Forrás: tulaj (megjegyzés)
- A control plane maga is egy termék: **belső, operátor-facing moduláris platform** — pénzügy, sales, **CRM**,
  **bizonylat-management**, egyéb belső modulok. Ugyanaz a „modulárisan bővül, nincs egyedi fejlesztés" filozófia,
  mint a tenant-oldalon → **két moduláris platform** (külső Site-modulok + belső back-office).
- **Belső RBAC:** szerepkör-szintű jogosultság (kurátor / pénzügy / sales / support / admin külön). Ez akkor válik
  élessé, amikor ezeket a belső modulokat fejlesztjük (későbbi fázis; a Fázis 3/3d lefektette az alapot).

### Adat-vezérelt lead-priorizálás (az all-in indulás UTÁN)
Dátum: 2026-07-05 · Döntés: indulásnál ALL IN (minden leadnek mock), közben kategória/konverziós adatot gyűjtünk.
- Később: **lead-scoring** a begyűjtött adatból (mely kategóriák/jelek konvertálnak) → a drága mock-gyártást
  a legígéretesebb leadekre fókuszáljuk (költség-optimalizálás). A1/A2-konzisztens: előbb tanulunk, majd automatizált szűrés.

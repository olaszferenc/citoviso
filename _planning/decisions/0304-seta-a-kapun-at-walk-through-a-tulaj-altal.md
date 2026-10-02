## ADR-0304 — „Séta a kapun át” (`walk-through`): a tulaj által választott mockból generálható sablon; a séta a fotók vision-tárgyából épül (2026-10-02)

**Státusz:** elfogadva (SUB; koordinátor: CIT fő session; brief `~/rc-briefs/seta-sablon.md`) · **Lokál, nem élesítve** (§0) ·
**Kontraktus:** `assets/design-refs/tenant-site/walk-through/` (az elfogadott `plan.html` + README) ·
**Kapcsolódó:** ADR-0027 (template-first), ADR-0111 (új sablon felvételének mintája), ADR-0115 (mozgás-réteg),
ADR-0047/0048 (modul megnevezett helyen; egy folyamat), ADR-0253 (telefonos menü, sáv csak félúton), §B.17.

### Kontextus
2026-10-02-án mock-verseny futott egy valós leaden (Három Huszár Apartments, Köveskál). A „B — Séta a kapun át”
változatra a tulaj ezt írta: „annyira jó lett, hogy hozzuk létre a Citoviso-n generálható típusként”. A mock kézzel
készült (kézzel válogatott séta-képek, kézzel írt lépés-szöveg, saját űrlap-szkript), tehát sablonná tenni azt
jelentette: a kinézet és a szerkezet marad, minden adat és funkció a rendszerből jön.

### Döntés
1. **Új sablon `walk-through`** (`src/engine/templates/walkThrough.ts`) + **új skin `gravel-grotesque`** (a mock 11 tokenje,
   Bricolage Grotesque + Figtree). A precedens (ADR-0111) szerint: regisztráció, előnézeti képek, i18n-katalógus.
2. **A funkció a közös modulokból jön:** foglalás (`bookingSlot` + `closing` slot), galéria-nagyítás (közös lightbox,
   galéria-kontraktus: minden fotó a slotban, 11 látszik, a többi az „Összes fotó” gomb mögött), szoba-kártya
   (`roomShell`/`roomHint`/`roomDetails`), értékelés/térkép/házirend/programok a négy slotból, telefonos menü és sáv a
   közös runtime-ból. A sablon a HELYÜKET és a KÜLSEJÜKET adja.
3. **A séta adatvezérelt** — a fotók megvett vision-ítéletéből (`Photo.subject`): kívülről → kert/udvar → kilátás →
   asztal → belül, tárgyanként a legjobb helyezésű fotó, a hős-kollázs képei nélkül. Lépés-cím = a tárgy neve,
   **bekezdés nincs**. ⛔ Az első változat egy forrásolt kiemelést tett a lépés alá témaszó alapján; a tényhűség-őr
   FLAG-elte: a párosítás maga állított a képről („Reggeli a virágos kertben” egy BELTÉRI étkező mellett, „Klímás
   szobák kőkandallóval” kandalló nélküli hálószoba mellett). Igaz mondat rossz kép mellett = hamis állítás a képről.
   A kiemelések a séta alatti listában maradnak. **3 lépés alatt nincs séta** (nincs üres panel, nincs egyképes „történet”).
4. **`Photo.subject` mező** (`recipe.ts`): ugyanazon az EGY ponton ragad a fotóra, ahol a vízjel-bélyeg
   (`heroPick.dropNeverShown`) — így a négy renderelő út (generate · provision · tenant/editor · heroOverride) mind viszi;
   a `toSitePhotos` továbbadja, a konzol sablon-előnézete és a `template-preview` a cache-ből tölti (régi pillanatkép).
   Szövegként sehol nem jelenik meg.
5. **Görgetés-történet motor a közös mozgás-rétegben** (`motion.ts` `storyCss`/`storyJs`, `data-cit-story*` horgok):
   JS nélkül, reduced-motion alatt, `data-cit-no-motion`-nél és IO nélkül semmi nem változik (kép+szöveg párok).
6. **A mock lelete javítva:** a számok-sáv a vonal alól görgetésre csúszott fel, és a tulaj képernyőképén az első
   képernyő alján üres maradt. A sablonban a felcsúszás betöltéskor fut — az első képernyő nem vár görgetésre.

### Mérve
Korpusz (24 lead, a legutóbbi pillanatképek, cache-ből vett ítéletekkel): **11 leadnél áll össze séta (8×3, 3×4 lépés),
13-nál elmarad** — jellemzően 6 fotós leadek, ahol a kollázs után nem marad 3 különböző tárgy, vagy a fotóknak nincs
ítélete. Végiggörgetett képek (390 / 1440): Három Huszár (gazdag), Nyugalom (3 fotó, nincs értékelés, nincs séta),
Aranykagyló 36 (23 fotó, nincs értékelés, 5 lépés).

### Nyitott (a koordinátornak átadva)
- A séta a 13 „elmaradó” leaden: maradjon-e el, vagy engedjünk tárgyon belül több lépést / a kollázs képeit is.
- Az accent: a sablon (mint mind) a fotó-akcentust követi — Három Huszár-on terrakotta, a mock lombzöldje helyett.
- Lépés-szöveg: kell-e bekezdés a lépés alá — csak fotónként megerősített leírásból lehetne (a vision `reason` ma angol,
  operátori kritika, nem vendég-szöveg).
- A Három Huszár pillanatkép (2026-09-26) két kiemelése forrás nélküli („Saját, ingyenes parkoló”, „Reggeli a virágos
  kertben”) — a copywriter régi kimenete, nem a sablon terméke; újragenerálás a mai (ADR-0292) kritikussal javítja.
- A foglalás a közös naptáras modul, nem a mock kétlépcsős ajánlatkérője (összesítő a becsült összeggel).

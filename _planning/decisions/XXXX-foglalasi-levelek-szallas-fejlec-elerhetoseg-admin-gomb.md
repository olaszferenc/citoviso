## ADR-XXXX — Foglalási levelek: a vendégé a szállás nevében, elérhetőséggel; a tulajé az admin Foglalások felé vezet

**Dátum:** 2026-09-27 · **Státusz:** elfogadva (tulaj: vendég C + tulaj B) · **Kontraktus:** `assets/design-refs/console/booking-email/`

### Kontextus
A vendég „Foglalási kérését rögzítettük” levele és a tulaj „Foglalási kérés: …” levele nyers
szövegből `<br>`-rel rakott HTML volt. A tulaj Gmailben nézve: „ez is legyen már professzionális
vállalati kinézetű! meg legyen benne a szállás elérhetőségei a honlappal együtt”, illetve „meg
lehessen megnyitni az admin felületet a foglalások résszel”.

### Döntés
1. **Vendég-levél (C):** saját keret (`src/email/bookingLayout.ts`, `hostMailHtml`) — a fejlécben a
   SZÁLLÁS neve (a vendég vele foglalt), lépés-jelző (elküldve → a szállásadó dönt / árajánlatot
   küld → végleges), adat-panel, **„A szállás elérhetősége” kártya** (cím, telefon, e-mail,
   honlap + „A szállás honlapja” gomb), lábléc „a foglalási rendszert a Citoviso működteti”.
2. **Az elérhetőség forrása a honlapé:** ugyanaz a szabály (`effectiveContact`, tulaj-javítás >
   begyűjtés, ADR-0241), amit az admin Elérhetőség füle mutat; a honlap a `siteUrlFor` (élő saját
   domain > platform-aldomain). Csak kitöltött mező jelenik meg; a telefon olvasható alakban
   (`displayPhone`).
3. **Tulaj-levél (B):** a jóváhagyott platform-keret (Citoviso logó, cégadatos lábléc); fő gomb
   „Foglalások megnyitása” → `/admin?tab=foglalasok` (a belépés a `next`-tel megőrzi); a gyors
   döntés másodlagos link marad (árajánlatnál „Ajánlatot küldök” — koppintásos elfogadás nincs,
   ADR-0208). A vendég üzenete FELIRATTAL („A vendég üzenete:”). Az `audience` marad `guest`
   (vendég-személyes adat → nincs pilot-BCC).
4. **A szöveges (text/plain) változat nem változik** — az őrök és a tenant-postafiók (ADR-0084) azt olvassák.

### Következmények
- A többi foglalási levél (visszaigazolás, elutasítás, lejárat, ajánlat, lemondás) még a régi
  `bookingHtml` keretben megy — ugyanerre a keretre hozásuk külön döntés.
- A levél annyira pontos, amennyire a tárolt elérhetőség: a Camping Carina címéből hiányzik a
  település — ezt a tulaj az Elérhetőség fülön javíthatja.

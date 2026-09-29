## ADR-XXXX — A tulaj telefonon dönt a foglalásról: a döntésre váró kérés kártyanyitás nélkül is látszik, a döntés áll elöl, a megerősítő megnevezi a vendéget és van „Mégsem”

**Dátum:** 2026-09-29 · **Státusz:** elfogadva (lokál, nem élesítve — a nagy deployjal megy) ·
**Felülírja:** `foglalasok-README.md` ① (a jelvény = „még nem látott” kérések) és a `booking-queue-urgency`
kontraktus ⑥ telefonos felét („mobilon naptár elöl”) · **Kapcsolódó:** ADR-0044 §6 (a foglalás KÉRÉS),
ADR-0193 ① (nem blokkolunk), ADR-0215 / ADR-0267 (árajánlat-út, változatlan), ADR-0045 §J (súgó-horgony) ·
**Kontraktus:** `assets/design-refs/tenant-admin/booking-phone/` („A”) · **Őr:** `scripts/booking-phone-check.mts`

### A mért tényállás

Az FK-015 éjszakai kör (2026-09-28, 390×844, Három Huszár / Myrna Haus) képei:
- a levélből a „Foglalások megnyitása” gomb y≈865–901-en, a hajtás ALATT, ~36 px magasan;
- a gyors döntés megerősítője (y≈970–1075) alatt rögtön a „✕ Nem szabad” állt — „Mégsem” nem volt;
- a visszaigazoló űrlap a gombsor bal felébe szorult (~160 px, a gomb felirata két sorba tört), a hajtás
  alatt, és a vendég neve nélkül;
- a kártya csak y≈720-nál kezdődött (fölötte naptár + három csempe + tájékoztató);
- a vendég telefonszáma sima szöveg; az új kérés nem jelent meg a Teendők között, a jelvény a fül
  megnyitásakor eltűnt;
- a naptár az első szobán és a MAI hónapon nyílt („nincs foglalt nap”), mellette „Következő érkezés
  2026. 10. 24.”;
- az árajánlat-kártya magyarázó sora a kártya széléig futott (a `.bk-req__act` sávon kívül állt).

### Döntés (§2b kör, 3 változat, álló/fekvő/asztali; a tulaj: *„A) verzió. Igen a döntésre váró kell ami Kártyanyitás előtt is látszódjon a fő részen.”*)

1. **A jelvény a DÖNTÉSRE VÁRÓ kérések száma** (`pendingRequestCount`), minden fülön, és a Foglalások fül
   megnyitásától nem tűnik el. A `seen_at` marad — a kártya „új” keretét adja. Az Áttekintés tetején sáv,
   a Teendők között kérésenként egy sor („Döntök” / „Ajánlatot küldök”).
2. **Telefonon a döntés áll elöl** (álló és fekvő tartásban): DOM-sorrend döntés → naptár → többi; asztalon
   a rács teszi a naptárat balra (két soron át), a „naptár bal, lista jobb” változatlan. A bevezető mondat a
   fül aljára, az útmutató a cím melletti súgó-ikonná került.
3. **A megerősítő a kártyán belül, teljes szélességben**, a vendég nevével, időpont · szoba · összeggel, a
   következménnyel, **„Mégsem”** és **„Igen, visszaigazolom”** / **„Igen, elutasítom”** gombbal. Nyitva az
   ellentétes döntés gombja nem látszik; az üzenet egy koppintásra nyílik. JS nélkül is működik (`<details>`,
   a „Mégsem” link a kártyához). Fedésben lévő kérésnél a jóváhagyott fedés-választó ablak nyílik, mint eddig.
4. **A naptár a következő döntésen nyílik** (`calendarFocus`): a levélből nyitott kérés (`?k=<token>`), a
   legsürgősebb kérés, végül a következő érkezés szobáján és hónapján; visszaigazolás után nyitva, a döntött
   kérés hónapján. Új napfajta: **kért éjszaka** (szaggatott keret, nem csak szín) — csak SZABAD éjszakán; ami
   már foglalt vagy blokkolt, a saját fajtáját tartja (az a látható ütközés). Koppintásra a kéréshez ugrik.
5. **A vendég egy koppintásra:** „Felhívom” (`tel:`), „Írok neki” (`mailto:`), a levélben is koppintható szám.
6. **Az Üzenetek-fül foglalási levelének tetején a döntés** (ki · mikor · mennyi a levél saját soraiból, a
   fő gomb AZT a kérést nyitja, a gyors döntés a vendég nevével kérdez, „Mégsem”-mel). A gyors döntés gombjai
   „Igen, elfogadom” / „Igen, elutasítom” maradtak (mail-links ④).

### Amit NEM dönt el

A naptár színeit (a Foglalások-naptár mai színei maradnak), a B/C változatot, és a vendég-oldali lemondó lap
elérhetőségét (FK-016, külön szál).

### Mérés

`scripts/booking-phone-check.mts`: a TELJES `adminDashboard()` kimenet (valódi keret: felső sáv, alsó menüsor)
valódi mobil-kontextusban, 390×844 és 844×390 méretben — a döntő gombok a látható sávban, ≥ 44 px; a megerősítő
neve, szélessége, „Mégsem”; `tel:`; a kért éjszakák; a naptár-fókusz tiszta függvénye; a jelvény; a Teendők-sorok
célja. Piros önteszt: a régi elrendezést CSS-sel visszaállítva 21 ág megy pirosra.

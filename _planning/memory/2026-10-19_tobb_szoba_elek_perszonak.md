# 2026-10-19 — Több szobás foglalás: Elek több perszónával (ADR-0393 kiegészítés)

**Kérés:** „elek több személyiséggel menjen neki” → 5 perszóna (Kati nagycsalád telefon, Bence társaság asztali, Józsi idős vendég, Réka kapkodó, Marika tulaj telefon), javítás után 3 ellenőrző (kati2, jozsi2, marika2). Tulaj: „1: igen; 2: igen; 3: igen”.

**Elvégezve (landolva `5e4d4449`, előtte `2b461489`):**
- Vendég: elküldés utáni kártya nem lóg ki 390 px-en; fekvő telefonon teljes szélességű szobalista; dátumváltáskor a foglalttá vált pipa lekerül („Levettük a jelölést: … — az új napokon foglalt.”); a kért létszám visszaáll; telefonon a második dátum után a szobákhoz görget, „Jelöljön ki legalább egy szobát” kiemeli a listát; „+” elhalványul a plafonnál.
- Ár nélküli szoba árazott mellett (tulaj-döntés): „Az ismert rész” részösszeg + „{szoba}: egyedi ár”; ajánlat-lapon csak a nyitott szobákra kér árat (`multiOfferSplit`); ellátás csak a felajánló szobákra (`requestMealLines`).
- Régi hiba: az ajánlat-lap küldés előtt ellátás nélkül mutatta a végösszeget (237 000 vs kiküldött 313 500 Ft) — javítva, egyszobásnál is.
- Tulaj: ütközés csak közös éjszaka ÉS közös szoba; naptár-link szobánként; lemondás és előzmény szobanévvel; a régi „A szállás egésze” sor csak törölhető, magyarázattal; több szobás auto-elutasító levél saját szöveggel.
- Régi fák: `cit8b8f5c14` memória-sora (N6 domain-díj) átvéve; `cit333dea6d` csak egy `_show/` képernyőkép, nincs mit landolni.

**Fájlok:** `src/booking/requests.ts`, `src/server/bookingViews.ts`, `src/server/offerViews.ts`, `src/server/moduleConfigViews.ts`, `assets/runtime/cit-runtime.js`, `assets/runtime/cit-modules.css`, `src/i18n/catalog.json`, `assets/design-refs/tenant-site/multi-room/README.md`, `assets/design-refs/tenant-site/quote-request/README.md`, `_planning/decisions/0393-…md`, `kb/entries/admin-bookings/entry.hu.md`, `kb/entries/admin-modules-pricing/entry.hu.md`, őrök: `scripts/multi-room-request-check.mts`, `quote-request-check.mts`, `meals-check.mts`, `shot-booking-form.mts`, `booking-capacity-check.mts`, `booking-queue-urgency-check.mts`; `MEMORY.md`.

**Nyitott (szándékosan nem javítva):** gyerek-korhatár felirat 12/18 váltása; vendég-nyugta/levél részösszeg nélkül; levélből hiányzó 12 éves határ; régi egész-ház a naptár-választóban; 38 px naptárcellák; félrevezető „SMS kihagyva” naplósor.

**Élesítés:** nincs; a következő deployjal megy, 0111 migrációval.

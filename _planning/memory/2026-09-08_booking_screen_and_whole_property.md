# 2026-09-08 — A mentés, ami nem jutott ki; az egész szállás, ami nem zárt; és a foglalás-képernyő

Session: `wt/cit5f679c5a`. A tulaj öt képernyőképpel nyitott a saját tesztoldaláról
(Dencs Apartmanház), és négy dolgot mondott: legyen vizualizáció a Forgalomhoz; az
egységek és a naptár „teljesen gagyi kinézetű felül"; mi van, ha az értesítési cím üres;
és hogy **felvett több egységet, de az oldal nem frissült**.

## 1. ⛔⛔ A mentés nem jutott el a publikus oldalra (`f623d5d`)

**Mérve:** a `site_unit`-ban két új egység ült (18:18, 18:20), a kiszolgált
`sites/<tenant>/index.html` viszont **18:16-os** volt, egyetlen szobával. Nem a frissítéssel
volt baj: a publikus oldal STATIKUS PILLANATKÉP, és a DB-írás önmagában semmit nem változtat
azon, amit a vendég betölt. Az admin „Mentve"-t mondott, az oldal az ellenkezőjét, és semmi
nem jelezte a rést.

**Nem egy route volt rossz, hanem egy HIÁNY-OSZTÁLY:** `/admin/units/save|delete|content`,
`/admin/prices/base|season|delete`, `/admin/module-config(+restore)` — mind csak írt. A
fotó-ág renderelt, a szöveg-ág nem, UGYANABBAN a handlerben; ezt route-onként emlékezetből
tartani lehetetlen.

**Javítás:** egy közös kijárat (`redirectRerendered`) + **statikus őr**, ami DÖNTÉST követel
minden admin POST-tól: renderel, vagy indokkal a kivétel-listán van (16 ilyen ma — számlázás,
jelszó, és a foglaltság, amit a vendég-oldal ÉLŐBEN kérdez). Plusz `scripts/rerender-tenant.mts`
a MÁR elcsúszott oldalak utolérésére (a tulaj oldalán lefuttatva: a 3 egység kiment, és
legenerálódtak az addig nem létező alegység-oldalak is).

## 2. ⭐ ADR-0114 — az „egész szállás" fölérendelt egység (`1299f3f`)

A tulaj a hibajavítás után kimondta a szabályt: *„ha valaki az egész szállást kéri, akkor a
többi egység adott napokra ne legyen elérhető. ERGO az egész szállás mint egység mindig van,
alapértelmezett."*

**Mérve a javítás előtt:** az egészre elfogadott foglalás mellett a szobák ugyanarra a napra
**foglalhatók maradtak** — az `availability_day` kulcsa `(unit_id, day)`, és mind a négy kapu
csak a kért egységre kérdezett. A rendszer maga termelte a dupla foglalást.

- A fölérendeltség **ADAT** (`site_unit.is_whole_property`, 0059), nem névegyezés.
- A kizárás **kétirányú** és **levezetett** (`src/tenant/unitScope.ts`), nem tárolt: árnyék-sorokat
  minden lemondásnál vissza kellene bontani, és egy kimaradt visszabontás olyan éjszakát hagy,
  amit senki nem tud felszabadítani.
- Szoba ↔ szoba: **nincs** kizárás (egy négy-apartmanos ház négy foglalást vesz fel).
- Mind a négy kapun: vendég-naptár, űrlap-elutasítás, elfogadás-tranzakció, admin hónap-nézet.
  Az elfogadás a kizárt egységekre váró kéréseket is lezárja.
- `scripts/whole-property-check.mts`: 14 mérés valós DB-n, **öntesztje a flaget kiveszi** és
  elvárja, hogy a mérések átbilljenek a régi, hibás viselkedésre.

⚠️ **ADR-szám-ütközés:** párhuzamos szál ugyanaznap ADR-0113-at adott ki (fizetés-kapus modul).
A sajátom **0114** lett; a két korábbi commit ÜZENETE még 0113-at ír (`9b2b07e` kimondja).

## 3. §2b — három terv, három döntés

- **Forgalom:** 3 vizualizáció-változat (napi / heti / arány-sávok), MINDKÉT adat-állapottal —
  a tulaj MAI adatával (6 megnyitás) is, hogy lássa, mit mutat egy majdnem üres hónap. Döntése:
  **„választható vizualizáció"** → átépítve EGY képernyővé nézet-váltóval (Naponta · Hetente ·
  Honnan és mivel · Csak a számok), a választás megmarad. **A KÓD MÉG NEM KÉSZÜLT EL.**
- **„Szobáink" felirat** (`c2b8d9a`/`05c384d`): egyetlen egységnél a cím **„A szállás"**, alcím
  nélkül; a „Szobáink" csak 2+ egységnél. Egy helyen dől el (`templateKit`), mind a 16 sablonon
  megmérve. Menet közben két beégetett felirat is a helperre került (scrapbook „a szobák",
  transit „Kiadó szobák") — azok EGY egységnél szó szerint hazudtak.
- **Foglalás-képernyő** (`2482057`): A változat (fülek + csukható naptár) + a foglalt napra
  koppintva a foglalás részletei **középre igazított felugró kártyában**. Kontraktus befagyasztva:
  `assets/design-refs/tenant-admin/booking-screen/`.

## 4. ⛔ A tudásbázis-őr három valós rést fogott a saját szállításomban

1. **A Foglalások fül naptára nem ismerte a `linked` napot** → a más egység által tartott
   éjszaka SZABADNAK látszott és egy koppintással felülírható lett volna. Ugyanaz a
   dupla-foglalás kockázat, amit a 0114 bezárt — csak a MÁSIK képernyőn. (A havi összegzőből
   is kimaradt: egy telt hónapra „nincs foglalt nap" jöhetett volna ki.)
2. **A kézi blokk és a vendég-foglalás PIXEL-AZONOS volt**, pedig az egyik koppintásra felold,
   a másik kártyát nyit → külön tónus + cián kézjegy-pötty + a jelmagyarázat két külön tétele.
3. Az egész szállás sorában ott állt a **„Törlés"**, amit a szerver úgyis elutasít.

⭐ Tanulság: a KB-őr nem „dokumentációt ellenőriz" — a súgó megírása kényszeríti ki, hogy a
felület viselkedése KIMONDHATÓ legyen; ahol nem az, ott hiba van.

## 5. Kisebbek

- **Üres értesítési cím:** mérve a fiók e-mail címére megy (fallback), tehát a kérés nem vész
  el — de ha az is üres, a levél NÉMÁN elmaradt. Most naplózza az okot.
- A `module-config-check.mts` kapu **8 ponton pirosan áll a main-en is** (elavult fixture:
  `variant="request"`-et vár, miközben ADR-0062 óta `"cta"` a helyes; a kérés-tesztek telefonszám
  nélkül küldenek). Megmérve a változásaim NÉLKÜL is — nem regresszió. **NYITOTT.**

## Módosított / létrehozott fájlok

- `migrations/0059_unit_whole_property.sql` · `src/tenant/unitScope.ts` (új)
- `src/tenant/availability.ts` · `src/tenant/units.ts` · `src/booking/requests.ts` · `src/db/schema.ts`
- `src/server/public.ts` · `src/server/moduleConfigViews.ts` · `src/server/bookingViews.ts` · `src/ui/icons.ts`
- `src/engine/templateKit.ts` + 11 sablon
- `scripts/snapshot-propagation-check.mts` · `scripts/rerender-tenant.mts` ·
  `scripts/whole-property-check.mts` · `scripts/booking-screen-check.mts` · `scripts/kb-shot.mts`
- `assets/design-refs/tenant-admin/booking-screen/` (kontraktus) · `hooks/pre-commit`
- `kb/entries/admin-modules-booking|rooms|pricing/`, `kb/entries/admin-bookings/`
- `_planning/DECISIONS.md` (ADR-0114)

## Nyitott kérdések

1. **A Forgalom választható nézete még nincs lekódolva** — a terv jóváhagyva, a kód nem.
2. A `module-config-check` 8 elavult állítása (nem az én változásom, de piros kapu).
3. A kézi blokk kártyája: a kontraktustól tudatosan eltértem (koppintás = azonnali feloldás);
   ha a tulaj mégis kártyát akar oda, az egy külön kör.

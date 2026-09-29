# 2026-09-28/29 — A telefonos kör koordinátorának zárása: a kör deploy-kész, és ami NEM volt tesztelve

Koordináló session (`citded06a5f`, „Koordinátor: telefonos kör 2”), átvéve 2026-09-28 21:14-kor
(brief: `~/rc-briefs/koordinator-atadas.md`). Kódot a koordinátor nem írt: szálakat indított, döntéseket
közvetített (a tulajt szó szerint idézve), képeket vitt a tulaj elé, és lezárta a kész szálakat.
Élesítés NEM történt; minden a nagy deployjal megy ki (`rerender-tenant --all` utána kötelező).

## Mi landolt a koordinálás alatt (SUB-szálak, mind landolva + leállítva)

| Szál | Eredmény | ADR / commit |
|---|---|---|
| Kép-ítélet (FK-012…016) | jelentés; a tulaj „B”-je: MEMORY.md nélkül — a véletlenül felvitt 5 sor visszavonva | `cd372e77`, `24bce585` |
| „Csak egyben adom ki” vendég-oldal | ház-sáv elöl, bemutató szoba ár/foglalás nélkül | ADR-0257, `f09f5f78` |
| Egy-szállásos kör (Myrna Haus) | a lánc egy bérlőn végigment; 3 termékhiba kiadva | `3bedd83e` |
| Nyitókép + értékelés-skála | `photos[0]` minden sablonon; „/ 10” → a forrás skálája | `53bd7281` |
| Modul-nyugta „Ft/év” havi fiókon | a fiók ütemében, a következő számlából | `1652b6a2` |
| Trió: „Minta” szobakép + csillagsor | élő lapon nincs minta-kép; a csillag látszik | `114e161d` |
| Galéria-korlát (4 sablon) | arch-frames B · wordmark-grow A · organic C · claymorphism C; a még nem látott képekkel indul | ADR-0259 |
| Csillagszám egy szabályból / méret-őr | `honestStarCount` 19 sablonon; `star-size-check` | `fa5e6897`, ADR-0262 |
| Lassú landok | a land-újrahasznosítás soha nem működött (PATH-hash) → javítva; `mobile-chrome-check` párhuzamos | ADR-0260, ADR-0261 |
| Árajánlat ára | alapból csak arra a kérésre; pipára „kért napokra”/„alapárként”; „Kiküldött ajánlatok”; `booking_request.offer_saved_as` (tulaj-jóváhagyott név) | ADR-0267 |
| Takarító (8 tétel) | admin-sorrend (A), kontraszt, lemondó lap elérhetőséggel, vendég-naptár a kért hónapon … | ADR-0270 |
| Tulaj foglaláskezelése telefonon | „A”: megerősítő a kártyán „Mégsem”-mel, Felhívom/Írok neki, döntésre váró sáv + jelvény | ADR-0274 |
| 3. (ellenőrző) kör — Ifjúsági Szállás Tihany | a mai javítások EGYÜTT működnek; új termékhiba nincs | `cb900054` |
| Súgó-képek | 10 elavult kép újragyártva; deploy GATE 1c/kép zöld (50/50) | `63d2809a` |
| 3. kör apróságai | „Alapár:” → „Egyedi ár” (termékhiba); létszám = forgatókönyv-hiba | `18bdab67` |

A kapuk témája a tulaj kérésére ÖNÁLLÓ koordinátorhoz került („Kapuk koordinátor: land-idő”, ADR-0263…0275).

## Tulajdonosi döntések (szó szerint), amelyek nem ADR-ben élnek
- A deploy és a scrape vonal: „Scrape vonal külön futó cucc, mint a nagy deploy ne foglalkozz vele”.
- Tesztadat: „minek javítunk dev rekordot?” — a tesztbérlők sorait nem „javítjuk”.
- A mock „Itt rendelheti meg” pirulája fekvőben a hős-címre ül: a tulaj az A-t (sarok) választotta, majd:
  „De ez már nem szőrszalhasogatas egy kicsit? … nem érdemes deploy utánra hagyni, amikor már van pilot
  visszajelzés?” → **a pilot utánra halasztva**. Innentől a deploy elé csak működést törő / félrevezető hiba kerül.
- A nyelvi csomagok és a súgó FORDÍTÁSA a deployban automatikus (GATE 5); a súgó-KÉPEKET a deploy csak
  ellenőrzi (GATE 1c/kép), nem gyártja.

## Amit a körök NEM teszteltek (a zárásnál a tulaj kérdésére összeszedve)
1. **Host-kötött út élesben:** a dev `/t/<slug>/` a platform hoston fut; a levél-linkek (visszaigazolás, lemondás,
   ajánlat-elfogadás) a TENANT hoston élesben csak a deploy UTÁN mérhetők (lásd `feedback_dev_path_hides_host_bound_bugs`,
   `guest-link-host-check`). → deploy utáni füst-próba egy tesztbérlőn, telefonról.
2. **Valódi levél a valódi postafiókban:** Gmail / iOS Mail megjelenítés, a naptár-melléklet (.ics) telefonon,
   DKIM/spam — a dev mock-postafiókkal megy.
3. **Idővezérelt ágak:** a 48 órás kérés-lejárat, az ajánlat lejárata, a 14 napos ár-lejárat emlékeztető, a vélemény-kérés
   a tartózkodás után, az előfizetés-megújítás a fordulónapon — a telefonos körök egyik időzítőt sem várták ki.
4. **Idegen nyelvű vendég:** a de/en/… csomagokat a deploy generálja; egy német vendég teljes útját (lap + levelek) senki
   nem nézte meg a regenerálás után.
5. **A „csak egyben kiadó” ház vendég-útja és az Online foglalás fülei** — a 3. kör az „egyben is kiadom” úton ment; őr fedi.
6. **A meglévő élő bérlők a `rerender-tenant --all` után:** a galéria- és nyitókép-változás minden élő lap KINÉZETÉT
   megváltoztatja — egy valódi bérlő lapját a rerender után meg kell nézni.
7. **A 100 Ft-os éles próbavásárlás** (MEMORY.md fejléc) — a teljes éles fizetési kör egyetlen bizonyítéka.
8. **Éles utómunka:** `scripts/places-medium-backfill.mts` a deploy után (előbb száraz futás), ADR-0258.

## Tiszta alanyok a következő körhöz
A Myrna Haus, a Kemencés, a Három Huszár és az Ifjúsági Szállás Tihany elhasználódott. Tiszta (19 generált mockos,
tenant nélküli) jelölt: **Laguna Panzió**, **Alig-vár Tanya**. A konzol „Jóváhagyott mockok” menüje csak az approved
mockokat mutatja — a generáltak a lead-lapon látszanak.

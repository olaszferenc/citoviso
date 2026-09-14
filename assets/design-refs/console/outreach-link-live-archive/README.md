# Megkeresés-panel — „A” változat: egy ÉLŐ link, a többi korábbi (KONTRAKTUS)

**Felület:** `/lead/<id>#prospects` (operátor-konzol, „Megkeresés — követett link” panel)
**Tulajdonosi döntés:** 2026-09-14 · **Terv:** `plan-A.html` · **Képek:** `shot-*.png`
**Forrás:** Elek FK-004 (B6 köteg), 2/3/5. lelet · **Őr:** `scripts/outreach-link-live-check.mts`
**Hatókör:** `src/console/views.ts` · `src/console/data.ts` · `src/console/server.ts` ·
`src/db/schema.ts` · `public/assets/ui/citui-console.css` · `migrations/0068_prospect_archived.sql`

> ⚠️ Ez **nem stílus-javaslat, hanem a megvalósítás KONTRAKTUSA.** Az alábbi pontok
> **elvárt viselkedések**; a kész felületet ezekhez mérjük, és őr kényszeríti ki őket.

---

## Amit a döntés eldöntött

**Egy leadhez egy ÉLŐ követett link tartozik**, az ki van emelve, a többi összecsukva a
„Korábbi linkek” alá kerül. Új link készítése előtt a képernyő **kimondja**, mi történik a
mostanival — kattintás ELŐTT, nem visszautasító sávban. Van **Archiválás** (nem törlés).

**Amit ez javít (mérve):** ma korlátlanul lehet új követett linket gyártani, **semmi nem
jelöli, melyik az élő**, és egyetlen törlő/archiváló űrlap sincs. A három művelet-gomb
(navigáció, navigáció, **állapot-írás**) ráadásul azonos súlyú sötét gomb volt.

---

## ⚠️ EGY SZÓ VÁLTOZOTT A BEMUTATOTT MOCKHOZ KÉPEST — szándékosan

A mock „**Archív** linkek (N)”-t írt. A valódi adatban azonban a régebbi linkek többsége
**soha nem lett archiválva** — csak újabb készült utánuk. Őket „archív”-nak nevezni valótlan
állítás lenne a felületen (§B.17 magunkra is áll). Ezért:

- a szekció neve **„Korábbi linkek ({n}) — nem ezek mennek a leadhez”**,
- az **„archiválva”** pirula CSAK azon a kártyán ül, amit az operátor tényleg archivált,
- a **szerkezet változatlan**: egy kiemelt ÉLŐ + összecsukott többi + figyelmeztetés.

---

## KÖTÖTT VISELKEDÉS

### ① Az ÉLŐ link LEVEZETETT, nem tárolt

**ÉLŐ = a lead legutóbb létrehozott, NEM archivált követett linkje.** Nincs „élő” zászló az
adatbázisban, amit külön karban kellene tartani: egy új link készítése vagy az élő archiválása
magától átrendezi a sorrendet. (Ugyanaz az elv, mint az ADR-0114 levezetett kizárásánál.)

- Pontosan **EGY** kártya visel `ÉLŐ — ez megy a leadhez` jelölést, ha van nem archivált link.
- Ha minden link archivált: **nincs** élő, és a panel ezt kimondja.

### ② Az archiválás nem törlés — és a lap ezt kimondja

Az archivált `/p/<token>` cím **továbbra is megnyílik** (a leadnek már kiküldhettük), csak
nem ez az ÉLŐ, és megkeresés nem indul róla. Az `Archiválás` megerősítést kér.
**Visszavonható:** az archivált kártyán ott a `Visszaállítás` — egy téves kattintás nem
zsákutca. (Ez a mockon túli kiegészítés; a ház mintája az opt-out `resubscribe`-ja.)

### ③ Új link előtt a képernyő kimondja, mi lesz a mostanival

Amíg van ÉLŐ link, a létrehozó űrlap **állandóan látható figyelmeztetést** visel *és* a gomb
megerősítést kér. A figyelmeztetés megmondja azt is, hogy a leadhez **korábban kiküldött cím
a RÉGI linkre mutat** — nem az újra.

### ④ A navigáció ne nézzen ki állapot-írásnak

Kártyánként **legfeljebb EGY** elsődleges (navy) gomb: a `Küldés ▸`. A `Tevékenység` és a
`link másolása` **link** (nem submit-gomb), az `Archiválás` pedig szegélyes, piros
másodlagos gomb. (A régi lapon mindhárom azonos navy gradienst viselt, köztük az egyetlen
állapot-átíró is.)

### ⑤ A címzett-mező a KÖVETKEZMÉNYT mondja, nem azt, hogy „(opcionális)”

A helyőrző `címzett e-mail címe`, alatta a segédsor: cím nélkül a link elkészül, de **a
rendszer nem tud levelet küldeni**. Ez JS nélkül is ott áll.

---

## AMIT A TERV NEM DÖNT EL

- A **piszkozat-lap** (`/prospect/<id>/draft`) külön kontraktus:
  `assets/design-refs/console/outreach-sticky-send/` (ADR-0160).
- A levél **nyers tokenes URL-je** és az **ár-doboz „-tól” vége / `p3` HTML↔text eltérés**
  KÓDOLT DÖNTÉS — a tulaj külön kérdezi meg.

---

## Az őr, amit ez a kontraktus megkövetel

`scripts/outreach-link-live-check.mts` — a VALÓDI konzolon, valódi lead-soron, 390 és 1280 px-en:

1. **Pontosan egy ÉLŐ jelölés**, és az a **legutóbbi nem archivált** link.
   ⛔ Az elvárt értéket az őr **független lekérdezésből** számolja (nyers SQL), nem a termék
   saját segédfüggvényével — egy őr, ami a vizsgált függvényt hívja, a visszarontást is
   zöldnek látja.
2. A többi kártya a **összecsukott** „Korábbi linkek” szekcióban ül, és egyik sem ÉLŐ.
3. **Egy elsődleges gomb kártyánként**; a navigáció link.
4. A létrehozó űrlap figyelmeztetése **jelen van és megerősítést kér**, ha van ÉLŐ link.
5. A címzett-mező helyőrzője **nem** tartalmazza az „opcionális” szót, és a segédsor kimondja
   a következményt.
6. **Piros önteszt:** a renderelt lapon előállított három hibaosztály (ÉLŐ jelölés eltávolítása ·
   két ÉLŐ jelölés · a figyelmeztetés kivétele) az őrt PIROSRA viszi.

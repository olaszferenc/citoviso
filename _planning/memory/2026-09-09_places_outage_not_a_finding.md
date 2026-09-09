# 2026-09-09 — A saját kimaradásunkat a felület a lead hibájának mondta

**Szál:** `wt/citb589b5ee` · **Landolva:** `cd1c582` (origin/main igazolva) · **Élesítés: NINCS** (§0.3)

## A bejelentés

> „Ez miért van, hogy a CRM-nek a lead sorában több helyen az van kiírva, hogy a fényképek
> száma x darab, tehát van fénykép? Belemegyek magába a leadbe, és egyetlen egy fényképet
> sem találok. Sőt, scrappelni se tudok újra."

## A mérés (nem a szó szerinti kérés, hanem a premissza)

Élő hívás a saját kulcsunkkal, 08:52-kor:

```
HTTP 429 RESOURCE_EXHAUSTED
"Quota exceeded for quota metric 'SearchTextRequest' and limit
 'SearchTextRequest per day' of service 'places.googleapis.com'
 for consumer 'project_number:1053502558775'"
kvóta-ablak: 2026-09-08 09:00 → 2026-09-09 09:00
```

Vagyis **nem a leaddel volt baj, hanem a mi napi keretünk fogyott el.** A kizáró
hipotéziseket is megmértem, mielőtt állítottam volna bármit: a 424 fotós leadből
**0** volt koordináta nélkül és **2** alacsony konfidenciájú (átlag 0,83) — tehát sem a
`lat/lng`-hiány, sem az A4 low-band gate nem magyarázta a jelenséget.

## Miért látszott a lead hibájának — a két szám két külön forrás

| | Honnan | Mikor keletkezett |
|---|---|---|
| Lista „x db" / Adatok fül | `material.placesPhotos` — a DB-ben **eltárolt** szám (`src/console/data.ts:211`) | a scrape napján, egyszer |
| Fotók fül galéria | `resolveGatedPhotos()` → **friss, fizetős** Places-hívás minden megnyitáskor (`src/generator/generate.ts`) | most, élőben |

A fotó-URL-eket **nem tároljuk**, csak a darabszámot. Amíg az API válaszol, a kettő egyezik;
amikor nem, a szám megmarad, a kép eltűnik — és a felhasználó ellentmondást lát.

## A hazugság-lánc

`placesLookup`: `if (!res.ok) return null` → a 429 néma nulla lett.
A route catch-e: `{ photos: [] }` → üres tömb, indoklás nélkül.
A panel ebből ezt írta ki: **„Ehhez a leadhez nem találtunk fotót."** — állítás a LEADRŐL,
miközben a hiba a mienk. Ugyanez a `reenrich`-en: az `enrichPlaces` `catch {}`-ja elnyelte,
a flash pedig „nem változott semmi"-t mondott (= „nem volt mit találni").

## A javítás elve

`null` = **megkérdeztük, nincs találat**. Amit meg sem tudtunk kérdezni, az
`PlacesUnavailableError`-t dob a WHY-jal (`quota | auth | network | upstream`), és ez
végigmegy a láncon a felületig, ahol szöveggé válik:

- **0 fotó:** „A Google Places {ok} — a fotók emiatt nem tölthetők be. Ez a mi korlátunk,
  nem a lead hibája."
- **N fotó:** „…csak a portál-adatlap fotói látszanak, a Places-képek hiányoznak."
- **reenrich:** a flash kimondja, hogy a Places-frissítés KIMARADT ebből a körből.

⚠️ **Az első változatom itt maga is hazudott:** egyetlen mondatot használtam mindkét
esetre, így 14 LÁTHATÓ portál-fotó fölé került a „a fotók nem tölthetők be" — igaz a
Places-re, hamis a képernyőre. Ezért lett ok-fél mondat + két külön keret.

A kvóta nem gyógyul körön belül, ezért a pass `quota`/`auth` után abbahagyja a további
lookupokat; a részleges fotó-bukás viszont nem viszi el az egész csíkot (`allSettled`).

## Őr

`scripts/places-outage-check.mts` — 10 állítás, a **valódi** 429/403 hibatestekkel (nem
kitalált alakkal), köztük a negatív ág: üres találat (200) → `null` marad, nem lesz belőle
„kimaradás". Piros-öntesztelve: szándékosan rossz elvárással bukik és exit 1-et ad.

## ⚠️ NYITOTT — tulaj-feladat

Ugyanaz a kulcs 10:45-kor már **403 PERMISSION_DENIED** („The caller does not have
permission"), a Geocode API-n `REQUEST_DENIED`; a Street View metadata 200. **A kvóta-ablak
fordulása sem gyógyította.** Google Cloud Console-ban nézendő: a
`SearchTextRequestPerDayPerProject` napi limit, a kulcs API-korlátozásai, a projekt
számlázása. Nincs hozzáférésem.

**Amíg áll:** Places-fotó egyetlen leadnél sem lesz (portál-fotó igen). A felület ezt
kimondja.

## Javasolt, még el nem döntött következő lépés

**Fotó-URL cache a leadhez.** Ma nincs: minden lead-megnyitás egy fizetős `searchText`
hívás, 595 leaddel a végiglapozás maga fogyasztja el a napi keretet. A cache egyben a
lista-szám és a galéria közti ellentmondást is megszüntetné.

## Módosított fájlok

- `src/scraper/sources/googleMaps.ts` — `PlacesUnavailableError`, `PlacesFailure`,
  `classifyFailure`; a `placesLookup` dob a néma null helyett
- `src/generator/images.ts` — `resolvePlacesPhoto` dob; `resolvePhotos` részleges bukást tűr,
  teljes infra-bukást továbbdob
- `src/generator/generate.ts` — `GatedMedia.placesUnavailable`; a generálás túléli a kimaradást
- `src/scraper/enrichPlaces.ts` — `onUnavailable` callback + korai leállás kvótánál
- `src/scraper/reenrichOne.ts` — a flash megnevezi a kimaradt Places-kört
- `src/console/server.ts` — a `/lead/:id/photos` viszi az okot; a catch naplóz
- `src/console/views.ts` — `placesOutageText()`, két keret (teljes / részleges)
- `public/assets/ui/citui-console.css` — `.con-warn` (warn token, nem bad)
- `src/i18n/catalog.json` — 2117 string
- **új:** `scripts/places-outage-check.mts`

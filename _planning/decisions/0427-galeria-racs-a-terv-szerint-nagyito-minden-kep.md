## ADR-0427 — Galéria: a rács a terv szerinti képszámot mutatja, a megnyitott galéria az összes képet a tenant sorrendjében

**Dátum:** 2026-11-05 · **Döntött:** tulaj („mindenhol úgy kellene”) · **Kiváltó eset:** Duna Vibe House, „csak ötöt látok”

**Kontextus.** Az előfizető 24 képet töltött fel, a galéria-beállítása 12, az élő oldal (`parallax`)
mégis 6 képet mutatott a rácsban (`photos.slice(0, 6)`), és ebből az 1. a nyitókép, tehát a vendég
5 új képet látott. A nagyító csak a rácsban lévő `<img>`-eken lapozott, a többi képet a vendég
sehol nem érhette el. A sablonok rácsa 4–10 képnél áll meg (a 2026-09-29-es `gallery-cap` kontraktus
csak 4 sablont tett teljessé, azokban a slotba került minden kép).

**Döntés (tulaj).** MINDEN sablonban: (1) a rács annyi képet mutat, amennyit a sablon TERVE hordoz,
hogy a honlap kinézete ne essen szét; (2) a galéria megnyitásával (nagyító) a vendég az oldal ÖSSZES
képén lapoz, abban a sorrendben, ahogy a tenant beállította (Fotók fül). Megvalósítás: egy közös
JSON-sziget (`<script type="application/json" data-cit-photos>`, `render.ts withGalleryPhotoList`)
az oldal teljes képlistájával; a runtime `mountGallery` ezen lapoz, a kattintott képnél nyílik.
Régi (sziget nélküli) oldalon és listán kívüli képnél a régi viselkedés marad (a slot saját képei).
A galéria-modul `maxPhotos` korlátja (a tenant beállítása) érvényes marad a listára.

**Visszafordíthatóság:** 🔄 olcsó (egy függvény + egy runtime-ág). **Elvetett:** a rácsot
`maxPhotos`-ig nyújtani minden sablonban (szétesik a terv); sablononként külön „Összes fotó”
felület (16 sablon × N). **Hatás az élőre:** a runtime beágyazva él az oldalakon → a meglévő élő
oldalak a következő deploy + `rerender-tenant` után kapják meg. **Státusz:** elfogadva, ÉLESEN 2026-11-05 (`prod/20261105-1108`).

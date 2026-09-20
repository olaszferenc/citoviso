# Mock-kártyák a lead-lap „Mock és generálás" fülén — jóváhagyott terv (A változat, 2026-09-20)

Tulajdonosi jóváhagyás: **2026-09-20**. A tulaj három változatot látott asztali ÉS mobil képen,
kattintható HTML-lel, és az **A — kép-vezérelt csempe** változatot választotta, mobilon
**1 oszloppal**. Ez a terv a megvalósítás **KONTRAKTUSA**: elvárt viselkedés, nem stílus-javaslat.

> ⚠️ A `**„…”**` alak ebben a fájlban **felületi feliratot** jelöl — a `contract-drift-check`
> pontosan azokat keresi vissza a kódban. A változat NEVE nem felirat, ezért nem abban az
> alakban áll.

Referencia: `plan.html` (kattintható, VALÓS adattal — Rozé Fogadó két mai mockja, a két
pillanatkép a tényleges generált nyitóoldalról; „Mobil 390px / Asztali" váltóval),
`A-asztali.png`, `A-mobil.png`. Az elvetett két változat képe is bent marad
(`elvetett-B-asztali.png` = adat-vezérelt, `elvetett-C-asztali.png` = sor-igazított
subgrid-összehasonlítás), hogy a döntés MIRE mondott nemet, az is dokumentálva legyen.

Testvér-kontraktus: `assets/design-refs/console/lead-page/` (ugyanaz a lap, 2026-09-14).
Az ott rögzített összehasonlító tábla (④) **érvényben marad** — a C változat vezette volna ki,
és a tulaj nem azt választotta.

---

## Miért van — a tulajdonosi bejelentés (2026-09-20)

A fülön a mockok **teljes szélességű, ~1529 × 586 px-es panelekként** álltak egymás alatt,
tizennyolc mezős recept-ráccsal, és a lap tetején nem is ők voltak, hanem a generáló-panel.
Két mock összehasonlításához görgetni kellett, és **a mock LÁTVÁNYA sehol nem jelent meg** —
pedig a kurátor pont azt ítéli meg. A tulaj kérése: a mock legyen felül, a kártya legyen a
mainak a harmada, menjenek egy sorba, legyenek kártyánként kinyithatók, és **legyen rajtuk
pillanatkép a nyitóoldalról**.

| Mérés | Érték |
|---|---|
| A mai kártya (a beküldött képernyőképen mérve) | 1529 × 586 px |
| Az új, CSUKOTT kártya (Playwrighttal mérve) | 403 × 476 px = **a mai 21 %-a** |
| Kártya / sor asztalin (mérve) | **3** |
| Kártya / sor 390 px-en (mérve) | **1** |

---

## Mit KÖT a terv

### ① A MOCKOK A FÜL ELSŐ ELEME — a generáló-panel alájuk kerül

Ha a leaden van artefaktum, a kártya-rács áll elöl; a másoló-, forrás- és generáló-panel
alatta, **csukott** `<details>`-ben. ⛔ Mock NÉLKÜLI leaden fordítva: ott a generáló-panel
nyitva áll és ő van elöl — egy üres rács nem lehet a lap első mondata.

### ② A KÁRTYA ALAPBÓL CSUKVA, ÉS KÁRTYÁNKÉNT NYÍLIK

A **„Részletek"** gomb CSAK a saját kártyáját nyitja, és nyitva a **„Bezárom"** szót viseli
(a gomb a saját tettét mondja). ⛔ Egy globális „mindent kinyit" nem ér: a kurátor egyetlen
mockot hasonlít a másikhoz, nem az egész oldalt olvassa.

A kinyitott részben áll MINDEN, ami a csukott kártyáról lekerült: a recept többi mezője
(`con-recipe`), a nyitókép- és piac-kapu indoklása, az AI-költség, a nyers fejlesztői adat
(`con-rawmeta`), és a jóváhagyott mock műveletei (konvertálás, törlés). ⛔ **Semmi nem
tűnhet el** — a kisebb kártya nem információ-vesztés, hanem rétegezés.

### ③ PILLANATKÉP A GENERÁLT NYITÓOLDALRÓL — ÉS AZ ÁLLAPOTA IS

A kártya tetején 16:9 arányban a mock **tényleges** nyitóképernyője. A kép forrása a
`heroShot.ts` már létező gyorstára — **ugyanaz a kép, ami a megkeresésbe megy**, tehát a
kurátor azt látja, amit a lead fog.

A pillanatkép négy állapotot vehet fel, és **mindegyik kimondja magát**:

| Állapot | Mit mutat |
|---|---|
| kész | a kép |
| készül | **„Pillanatkép készül…"** |
| hibázott | **„Nincs pillanatkép"** + az OK (melyik kép, milyen hibával) + **„Újra"** |
| még nem kérték | **„Még nem készült pillanatkép"** + **„Kép kérése"** |

⛔ **Néma törött kép SEHOL.** A kártya SOHA nem emit `<img>`-et olyan képre, ami nincs meg
(Elek FK-004 H1: a 404 törött-kép ikonná vált, és semmi nem mondta meg, miért). ⛔ És a
kártya nem indít renderelést lapbetöltéskor: a Chromium-futás drága, ezért **kimondott
kérésre** indul.

### ④ A CSUKOTT KÁRTYÁN CSAK AZ ÁLL, AMI KÜLÖNBÖZIK

Pillanatkép · sablon neve · a minta-összefoglaló sor · **„Képek a lapon"** · **„Nyitókép"**
(pontszám + téma) · a négy kapu egyetlen jelvény-sorban. ⛔ A tizennyolc mezős recept-rács
nem fért volna a harmadakkora kártyára, és a kurátornak nem is kell: a mockok között a fenti
hat adat különbözik.

### ⑤ HÁROM KÁRTYA EGY SORBAN — 390 PX-EN EGY

Asztalin `repeat(3,1fr)`, közbenső szélességen 2, telefonon 1. ⛔ Ez **két külön tervezői
döntés**: a tulaj a 2 oszlopos mobil-változatot is látta és elvetette — 390 px-en a
pillanatkép olvashatatlanul kicsi lett volna, és a pillanatkép a terv lényege.

### ⑥ AZ ELUTASÍTOTT MOCK A RÁCSBAN MARAD, HALVÁNYAN, HÁTUL

⛔ Nem külön kinyitható csoportba: három kis kártyánál a külön blokk több helyet vinne, mint
amennyit spórol. Az elutasított kártya halvány, a jelvénye kimondja, és a sor végére kerül.

### ⑦ A KÉT MEGLÉVŐ LINK A PILLANATKÉPEN ÜL

**„előnézet ▸"** és **„prospect-konfigurátor ▸"** a kép jobb alsó sarkában. ⛔ A feliratok
VÁLTOZATLANOK: az `elek/scenarios/FK-003b-lead-page-mock-generation.md` és a
`kb/entries/console-lead/entry.hu.md` szó szerint idézi őket — egy „szebb" rövidítés
mindkettőt elnémítaná.

---

## Amit a terv SZÁNDÉKOSAN nem old meg

- A pillanatkép **automatikus** legyártása a mock generálásakor. Helyes lenne, de külön
  döntés (Chromium-futás a generálási úton), és a terv a kérésre indított képpel is teljes.
- Az összehasonlító tábla (`lead-page` kontraktus ④) kiváltása — az a C változat ígérete volt,
  és a tulaj nem azt választotta.

---

**Hatókör:** `src/console/views.ts` · `src/console/server.ts` · `public/assets/ui/citui-console.css`

## Kötő horgony

⭐ ADR-0164 ④ szerint a terv SZERKEZETE is köt, nem csak a szavai. Az alábbi azonosítóknak
léteznie KELL a Hatókör fájljaiban (a `contract-drift-check` a stíluslapokat szándékosan
kihagyja — egy CSS-szabály azt bizonyítja, hogy az osztály meg van FORMÁZVA, nem azt, hogy
bármi ki is teszi). **Egy sor = egy horgony** (a felismerő bulletonként az ELSŐ backtick-es
azonosítót köti).

- `data-cit-mocksfirst` — ① a kártya-rács a generáló-panel ELŐTT áll
- `con-mkgen` — ① a csukott generáló-blokk (mock nélküli leaden nyitva)
- `con-mk` — maga a kártya
- `con-mkgrid` — ⑤ a rács, ami a kártyákat egy sorba teszi
- `data-mk-more` — ② a kártyánkénti kinyitó gomb
- `con-mk__det` — ② a kinyitott rész
- `data-mk-shot` — ③ a pillanatkép doboza
- `data-shot-state` — ③ a pillanatkép állapota (ready / running / failed / none)
- `con-mk__facts` — ④ a csukott kártya adat-blokkja
- `con-recipe` — ② a recept megnevezett sorai (a kinyitott részben él tovább)
- `con-rawmeta` — ② a nyers fejlesztői blokk (a kinyitott részben él tovább)

## Kapuk

`scripts/mock-card-plan-check.mts` — a KIRENDERELT lapon mér, valódi stíluslappal: a rács
oszlopszáma asztalin és 390 px-en, a csukott kártya mérete a maihoz képest, a kártyánkénti
(és NEM globális) kinyitás, a pillanatkép négy állapota és hogy hiányzó kép esetén NINCS
`<img>`, az elutasított kártya helye, valamint hogy a kinyitott részből egyik átköltöztetett
elem sem veszett el. Piros önteszttel.

A meglévő `lead-page-plan-check` (a 2026-09-14-i terv), a `mock-state-label-check` és a
`lead-tab-anchor-check` változatlanul érvényes — ez a terv azokat nem írja felül.

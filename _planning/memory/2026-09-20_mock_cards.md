# 2026-09-20 — A mock-kártya a MOCKOT mutatja (§2b kör + megvalósítás)

**Döntés:** ADR-0189. **Kontraktus:** `assets/design-refs/console/mock-cards/`.

## A kérés

A tulaj a lead-lap „Mock és generálás" fülének képernyőképével jött: *„Ha van generálva mock
akkor az felül legyen, kártyánként kinyithatóan, snapshot a nyitóoldalról, a mostani kártya
méret harmada legyen, kártyák 1 sorba menjenek. Adatok legyen a kártyán úgy elrendezve, hogy
jobban kihasználják a teret."*

## A §2b kör

Három önhordó, kattintható változat valós adaton (Rozé Fogadó két mai mockja, a két pillanatkép
a TÉNYLEGES generált nyitóoldalról), méret-váltóval (`@container`), asztali ÉS mobil képpel:

| Változat | Mit döntött volna el |
|---|---|
| **A — kép-vezérelt** ✅ | a LÁTVÁNY dönt: nagy pillanatkép + 4 szám |
| B — adat-vezérelt | a SZÁMOK döntenek: vékony felismerő-csík + sűrű adat-sorok |
| C — sor-igazított | subgrid: a kártya-rács MAGA lesz az összehasonlító tábla (kiváltotta volna az ADR-0164 ④ tábláját) |

A tulaj **A**-t választotta, **mobilon 1 oszloppal** (a 2 oszlopos mobil-változatot is látta,
gombbal a vázlatban — elvetette).

## Szállítva

- `renderArtifact` → csempe: 16:9 pillanatkép, sablon-név, `patternSummary`, képszám, nyitókép
  (pontszám + téma), a négy kapu egy jelvény-sorban, műveletek, `Részletek ▾`.
- **Pillanatkép:** `ensureCardJpeg()` (720 px JPEG a ~200 kB PNG-ből, a PNG mellé gyorstárazva,
  a mock mtime-ja cache-busteli) + három útvonal: `GET /artifact/:id/shot.jpg` (**csak gyorstár**),
  `GET /artifact/:id/shot-state`, `POST /artifact/:id/shot` (kimondott kérés).
- A `shots` a szerverben mérve (`heroShotState` artefaktumonként), paraméterként a nézetnek — a
  `leadPage` szinkron maradt.
- `heroShotFailReason()` KIEMELVE: a hiba-mondatokat eddig a megkeresés-vázlat lapja tartotta
  beágyazva; most EGY szótár szolgálja ki mindkét felületet.
- Az elutasított mock a rácsban marad (halványan, hátul) — a külön `<details>` csoport kivezetve.
- Őr: `scripts/mock-card-plan-check.mts` (39 állítás, piros önteszt 4 célzott bukással,
  pre-commitbe kötve). A két legfontosabb állítása NEGATÍV.

## Mért számok

| | |
|---|---|
| mai kártya (a tulaj képernyőképén mérve) | 1529 × 586 px |
| új, CSUKOTT kártya | **403 × 476 px = a mai 21 %-a** |
| kártya / sor asztalin · 390 px-en | **3 · 1** |
| a kép-útvonal renderelést indít-e | **nem** (mérve: állapot előtte == utána) |

## Saját hibák (mind a saját mérésem fogta meg)

1. **A vázlat-őröm a saját feltételétől bukott:** a „hiányzó pillanatkép" kártyát a `.shot.miss`
   jelenléte szerint fogtam meg, a kattintás után viszont a doboz már `.shot.run` — a locator
   0 elemre esett, és a próba pirosat írt egy MŰKÖDŐ viselkedésre. Index szerint kell megfogni.
2. **A méret-állítás a KINYITOTT kártyát mérte** (391 × 1131 = a mai 49 %-a). A terv a csukottat
   köti — újratöltés kellett a mérés elé.
3. **A kapu-jelvények két sorba törtek** a teljes `mockInputLabel` névvel, szemben a jóváhagyott
   képpel. A kódot igazítottam a tervhez (rövid név + teljes név a `title`-ben), nem fordítva.
4. **Az első vázlatban a hiba-mondat kifolyt a doboz alól, rá a linkekre**, és B-ben a két link
   letakarta a vékony csíkot. Mindkettő a SAJÁT screenshot-nézésemből derült ki.
5. A route-mérésben a puszta süti-ÉRTÉKET adtam át `cookie` fejlécként — a konzol `/login`-ra
   terelt, és az üres törzsön a `JSON.parse` szállt el. A süti NEVE is kell (`cit_op_session`).

## Egy idegen őr igazítása — mérés UTÁN

A `lead-tab-anchor-check` pirosra ment az új `#a-<uuid>` visszairányításon. **Előbb megmértem**,
hogy a fül-kapcsoló a panelen belüli horgonyra is vált (a kártya látszik, a mock-fül aktív), és
csak azután vettem fel a prefixet — a mérésre hivatkozva, prefixre szűkítve. A mérés az ŐRBEN él
tovább (`mock-card-plan-check` ⑧), tehát ha a viselkedés elromlik, a kivétel alapja is elesik.

## Feliratok, amikhez NEM nyúltam

`előnézet ▸` és `prospect-konfigurátor ▸` — szó szerint idézi őket az
`elek/scenarios/FK-003b-lead-page-mock-generation.md` és a `kb/entries/console-lead/entry.hu.md`.

## Nyitott

- **A pillanatkép ma kimondott kérésre készül.** Automatikus legyártás a generáláskor logikus
  lenne (a kurátor akkor első pillantásra látná a képet), de az Chromium a generálási úton —
  külön döntés, külön mérés.
- A dev korpuszban kevés mocknak van gyorstárazott képe, ezért a `ready` ág mérése a legutóbbi
  8 artefaktum közül keres egyet; ha nincs, az őr **hangosan kiírja**, hogy az ág nem lett mérve.

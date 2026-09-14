# 2026-09-14 — A fagyasztott tulaj-admin: „Rendezés-képernyő" (ADR-0155)

**Szál:** `wt/fagyasztottkartya` · **Forrás:** Elek FK-006a (2026-09-13), a mai fán újramérve
**ADR:** 0153 · **Kontraktus:** `assets/design-refs/console/freeze-state-v2/`

## Mi történt, két körben

### 1. kör — a BELÉPŐ képernyő (apró, §2b-kivétellel, külön commit)
Az ADR-0119 ⑦ és ⑧ őre **mindkettő a `modulesSection()`-t** rendereli, vagyis a 13 fülből
egyet mér. A tulaj viszont az `attekintes` fülre lép be, ahol fagyás alatt MÉRVE: 0× tartozás,
0× összeg, 0× fizetés-gomb — és a „Teendők" lista egyetlen nyitott tétele ez volt:

> „Az oldal még nem publikus — **a Citoviso élesíti, amint minden készen áll**"

Nem hiányzó tény, hanem ROSSZ tény, és a MI javunkra rossz. Javítva + a lemondás-zóna
kettős tagadása („kiegyenlítése **nélkül sem** kapcsol vissza") egyenes mondatokra.
Őr: `scripts/frozen-entry-check.mts` (a teljes `adminDashboard()`-ot rendereli, az
ALAPÉRTELMEZETT fület mérve). Piros önteszt: 5 sértés.

### 2. kör — a §2b terv-kapu és a megvalósítás
Három változat (A kísérő sáv · B rendezés-képernyő · C tételes számla), kattintható,
méret-váltóval. **Tulajdonosi döntés: B.** „Fagyás alatt a lap EGY dologról szóljon:
tartozás + hátralévő idő nagyban, a modul-lista CSAK OLVASHATÓ (a kapcsolók kikerülnek)."

## Amit szállítottunk

- **Egy képernyő, egy összeg.** A „Következő számla" cella (összeg + MÚLTBELI dátum), a
  „Jelenlegi díj" cella és az összegző VÉGÖSSZEGE mind kiesik fagyás alatt — mindhárom
  ugyanazt a 10 270-et mondta. A rendezés-utáni dátum az `arrears.periodEnd`, levezetve.
- **Hátralévő idő figuraként** (nap-szám + sáv), „ma jár le" / „lejárt" ággal.
- **Read-only modul-lista**, „Mi kapcsol vissza a befizetéssel" fejléccel.
- **Előrevivő művelet** a megbízás-blokkon („Másik kártyával fizetek" → payUrl).
- **A blokk MINDEN fülön** (kompakt alakban azokon, amik nem a pénzről szólnak).

## ⛔ A három legfontosabb tanulság

1. **A kapcsoló kivétele majdnem ADATVESZTÉS volt.** Az `applyModuleChange` a HIÁNYZÓ
   `module` mezőt LEMONDÁSNAK olvassa. Kapcsoló nélkül a fagyasztott lap egyetlen
   űrlap-beküldése némán lemondta volna mind a 11 modult. Rejtett megőrző mező minden
   birtokolt modulra — és az őr DARABRA méri.
2. **A képet néztem meg, nem az őr fogta.** A szállított lapon ott virított a „2 hónap
   ajándék évente · **102 700 Ft** · Váltok éves fizetésre" — eladási ajánlat annak, akit
   épp dunningolunk, egy nagy számmal a tartozás mellett. Az őröm egy KONKRÉT összeget
   számolt, ez másik szám volt → átengedte. Azóta a döntési POZÍCIÓT méri (ár + gomb).
3. **Az őr a SZOMSZÉD cellát mérte.** A rendezés-utáni dátum próbája a lap első
   `.adm-sub__v--date` elemét olvasta — ami közben egy MÁSIK cella lett („A honlapja díja /
   változatlan"). Zöld volt, rossz elemre. Saját horog (`data-nextafter`) oldotta meg.

## Őrök (mind piros önteszttel)

| Őr | Mit mér | Piros önteszt |
|---|---|---|
| `frozen-entry-check.mts` | a BELÉPŐ fül szövege | 5 sértés + detektor kétirányú próbája |
| `frozen-settle-check.mts` | pénz + vezérlők + megőrző mezők + 5 fül | 8 sértés + 4 kötés a TERMÉK visszarontásával |
| `frozen-phone-check.mts` | 390×844, `elementFromPoint`, GÖRGETÉS NÉLKÜL | 6 sértés |

A `frozen-state-check.mts` ③ horgonya `.adm-frz`-re váltott — **a viselkedés igazolása UTÁN**.

## Módosított / létrehozott fájlok

- `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css` · `src/i18n/catalog.json`
- `scripts/frozen-entry-check.mts` · `scripts/frozen-settle-check.mts` · `scripts/frozen-phone-check.mts`
- `scripts/frozen-state-check.mts` (horgony) · `hooks/pre-commit` (3 új kapu)
- `assets/design-refs/console/freeze-state-v2/` (terv + README-kontraktus + 4 kép)
- `_planning/DECISIONS.md` (ADR-0155)

## Nyitott

- Az **„Oldal megtekintése"** gomb fagyás alatt figyelmeztetés nélkül a 503-as éles címre visz.
  A tulaj szándékosan nem döntött róla; a kontraktus kimondja, hogy NEM kötött.
- **Terhelés-újrapróbálás**: nincs szerver-útvonal. A mock két gombot mutatott, egy készült el
  (a valódi). Ha kell, külön kör.
- **Élesítés NINCS** (§0.3) — külön, kimondott engedély kell hozzá.

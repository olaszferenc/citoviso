# Kontraktus — modul-függőség a kosárban és a lemondáskor

**Jóváhagyva:** 2026-09-21, tulajdonosi döntés a §2b terv-körben (A/B/**C**).
**Kiváltó:** ADR-0192 — a `booking → pricing → rooms` lánc ma **egyetlen felületen sincs kimondva**,
és húsz fogyasztó engedi át vakon.
**Hatókör:** `src/modules.ts`, `src/tenant/moduleRequirements.ts`, `src/tenant/moduleChange.ts`,
`src/server/adminViews.ts`, `src/generator/configurator.ts`, `src/console/views.ts`

> A felületek szerepe: `adminViews.ts` = a tulaj Modulok füle · `configurator.ts` + a lead-oldali
> kosár kliens-JS-e = a vásárlási kosár · `console/views.ts` = a `/pricing` csomag-kártyák.
**Kapcsolódó:** ADR-0192 ④ (a négy tulajdonosi döntés), ADR-0113 (fizetett modul csak fizetés után),
ADR-0155 ③ (a fagyasztott lap hiányzó mezője = lemondás → **ezért nincs kaszkád**),
ADR-0175 (minden képernyő megmondja, mit fizet a vevő), ADR-0101 (a(z) tilos — `huArticle`).

A `module-dependency.html` a jóváhagyott terv — **kattintható**, valós katalógus-adattal
(alapdíj 3 900 Ft/hó; `booking` 990, `pricing` 490, `rooms` 690 → **együtt 2 170 Ft/hó**).
A „Mobil 390px / Asztali" váltó egy fájlban mutatja mindkét elrendezést.

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

### 1. A kosár BEPIPÁLJA a függőséget — a kliens, nem a szerver

Bekapcsoláskor a modul **hard** függőségei (tranzitívan) automatikusan bepipálódnak.

⭐ **Miért a kliens:** a terv-sáv és a fizetés-megerősítő kártya egyaránt a **bepipált
checkboxokon iterál** (`adminViews.ts` `sync()` / `fcOpen()`), ezért a helyes ár **magától
következik**. Szerver-oldali néma hozzávételnél a vevő **990 Ft-ot látna és 2 170-et fizetne** —
azt külön kellett volna megjavítani. A szerver-oldali kapu ettől még KELL (kézzel gyártott POST),
csak nem ő az elsődleges út.

### 2. A sor mondja meg MIT, a sáv MENNYIÉRT (a C változat lényege)

- **A sorban:** cián „EGYÜTT JÁR" **pirula** a modul neve mellett + a sor alatt cián bal-sávos
  doboz, benne **`<b>a vezérlő modul neve</b> — ehhez jár.` + a katalógus `why` mondata**.
- **A terv-sávban:** a vezérlő modul sora, alatta **behúzott, cián bal-sávos** al-sorok
  („ehhez jár: …"), majd egy összegző mondat: `X + Y + Z — együtt 2 170 Ft / hó.`
- ⛔ **Az indoklás CSAK EGYSZER hangzik el** (a sorban). A sávban NEM ismétlődik — a C állítása
  pont az, hogy nem mondja kétszer ugyanazt egy képernyőn.

### 3. Az indoklás a KATALÓGUSBÓL jön, egy forrásból

A `why` mondat a `ModuleRequirement.why` (`src/modules.ts`), **nem a felületen megfogalmazva**.
Hat képernyőn kell megjelennie; két példány két igazság (`feedback_one_rule_two_copies`).
⛔ **Minden függőségnek a SAJÁT indoka jár:** a `booking → pricing` és a `pricing → rooms` KÉT
külön mondat. (A vázlat első változata a vezérlő modul indokát írta ki mindkettőre, ami a
`pricing → rooms` esetben **üres sztring** volt — a lap néma maradt arról, amiért kifizettette.)

### 4. Nyers katalógus-id SOHA nem kerül a képernyőre

A vázlatban `pricing` jelent meg a tulajnak szánt mondatban (a `.map(labelOf)` az INDEXET adta át
második argumentumként). A szállításnak őrt kell tartania erre.

### 5. A vezérlő kikapcsolása VISSZAVESZI, amit behozott

KEEP = a kifizetett + a **kézzel** bepipált modulok zárványa. Ami ezen kívül esik és csak a
vezérlő miatt került be, az kikapcsol. ⛔ Különben a tulaj olyan modulért fizet, amit sosem
választott.

### 6. A lemondás BLOKKOL, és KÖZÖS lemondást ajánl — kaszkád nincs

- A kapcsoló **visszaáll**, és felugró nyílik.
- **Címe:** `<A modul> nem kapcsolható ki, amíg <a blokkolók, névelővel> él.`
  ⛔ A névelőt `huArticle` dönti el (ADR-0101) — „a Árak" hiba.
- **Törzse:** a katalógus `why` mondata.
- **Listája:** a teljes eltávolítási zárvány, **modulonként az árával** — a `Szobák` lemondása
  **hármat** visz (`Szobák → Árak → Foglalás`), nem kettőt. ⚠️ Az ADR-0192 ④.2 példaszövege
  („Lemondja mindkettőt?") a rövidebb láncot feltételezte; a mért lánc három tagú.
- **Gombjai:** „Mégsem, marad minden" (halk) + „Mind a hármat lemondom" (piros, a darabszám a
  zárványból számolva).
- **Lábjegyzete:** a lemondott modulok a kifizetett időszak végéig élnek, és a tartalmuk megmarad.
- ⛔ **Automatikus ELTÁVOLÍTÓ ág tilos** (ADR-0155 ③): a fagyasztott lap hiányzó mezője
  lemondásnak olvasódik, tehát a kaszkád pont a megőrző mezőkkel védett adatvesztés-csapdába nyúlna.
  A felugró **ajánlatot tesz**, a tulaj dönt.

### 7. A pénz a termék szabályával íródik

A vázlat a `assets/runtime/cit-money.js`-t **inlineolja** (ugyanúgy, ahogy az `adminViews.ts`
a `MONEY_JS`-t). ⛔ `toLocaleString("hu-HU")` tilos: a 4 jegyű összegeket csoportosítás nélkül
adja vissza (`2170` a `2 170` helyett) — a vázlat első változata ezt a hazugságot vitte.

### 8. Minden összeg a pénz-oldalon marad

390 px-en a hosszú modulnév tördel; az összeg attól még a sor **jobb széléhez** igazodik
(`margin-left:auto`). Egy balra eső ár másik oszlopnak olvasódik.

---

## Elrendezés — a két méret KÉT külön döntés

| | Mobil 390px | Asztali (≥700cqw) |
|---|---|---|
| Sor | tördel; a pirula a név alá kerülhet, a magyarázó sáv teljes szélességű | egy sorban: név + pirula … ár jobbra; a magyarázó sáv **saját sorban**, 58 px behúzással |
| ⛔ csapda | — | **`flex-wrap:nowrap` TILOS a soron**: a 100 %-alapú magyarázó sáv nem tud saját sorba kerülni, a nevet 60 px-es oszlopba préseli és **kilóg a kártyából** (mérve) |
| Terv-sáv | egy oszlop, a gombok teljes szélességűek | két oldalra igazított sorok |

⚠️ **`@container`, nem `@media`** — a vázlat színpada egy szűkített `div`.

⛔ **Specificitás-csapda (mérve):** `.adm-mine__t span{display:block}` (0,1,1) **veri** a
`.dep-tag{display:inline-flex}`-et (0,1,0) → a pirula teljes szélességű cián sávvá hízott.
A szelektor `.adm-mine__t .dep-tag`.

---

## Amit a terv NEM köt

- A lead-oldali konfigurátor **kerete** (más chrome) — a MINTA viszont köt: pirula + sor-magyarázat,
  csoportosított ár a kosár-összegzőben.
- A `/pricing` operátori csomag-kártyák jelvény-szövege — az ott KÖT, hogy a jelvény és a kiírt
  csomagár **UGYANAZT a halmazt** mérje (`feedback_label_must_derive_from_predicate`).

## Bizonyítás

A tervet 3 változatban, 2 méreten, **Playwrighttal végigkattintva** mértem
(`scripts/module-dependency-check.mts` viszi tovább az állításokat):
bepipálás · helyes végösszeg · **mindkét indoklás szó szerint** · nyers-id szivárgás · a pirula
pirula marad · a név nem préselődik · a magyarázat nem lóg túl · a vezérlő kikapcsolása visszavesz ·
a lemondás blokkol · a felugró mind a hármat megnevezi · a felugró nincs levágva · nulla JS-hiba.

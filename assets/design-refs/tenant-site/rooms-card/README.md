# KONTRAKTUS — publikus szoba-kártya és részletek-felugró (B változat)

**Jóváhagyta:** a tulaj, 2026-09-21 (§2b terv-jóváhagyási kapu) · **Változat:** **B — Két út**
(az A — „Előbb nézd meg" elvetve) · **Terv:** `plan.html` (önhordó, kattintható) ·
**Képek:** `B-mobil-*.png`, `B-asztali-*.png`
**Hatókör:** `assets/runtime/cit-runtime.js`, `src/engine/moduleSections.ts`, `src/tenant/editor.ts`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** Ami itt „KÖT" jelöléssel áll,
azt a kész felületnek teljesítenie kell; a kódot ehhez mérjük, nem fordítva
(`feedback_approved_draft_is_the_contract`).

A terv a **valós adatból** épült (az Eldorádó tenant 4 egysége, a saját artdeco arculatában,
a 70 tételes felszereltség-katalógus **valódi** ikonjaival) — nem kézzel rajzolt látvány.
Újragenerálás: lásd a „Reprodukció" szakaszt.

---

## 1. A KÁRTYA (a szoba-rácsban)

**KÖT — a kártyán EZ van, és semmi más:**

1. kép (a szoba borítóképe)
2. a szoba **neve**
3. a **férőhely** („6 fő")
4. „Részletek" link
5. „Foglalás" gomb

⛔ **KÖT: a leírás és a felszereltség NEM kerül a kártyára.** Ma egyetlen `note` mezőbe van
összefűzve (`src/tenant/editor.ts` — `[u.description, u.amenities.join(" · ")].join(" · ")`),
ezért a vendég egy mondatban kapja a leírást és a listát, megkülönböztethetetlenül. Ez a
kerülő út azért született, hogy ne kelljen sablont módosítani („no template edit") — a terv
ezt váltja ki. **A `note` szétszedése EGY helyen történik**, és onnantól mind a 12 saját
szoba-szekciót rajzoló sablon automatikusan helyes.

### A jelvény a képen — KÖT

A kártya képének **jobb alsó sarkában** állandó jelvény ül: **inline SVG nagyító** (⛔ nem
emoji, §B) + felirat.

- **KÖT: hover-független.** Mérve `opacity: 1` interakció nélkül. Az első változat hoverre
  jelent meg — **telefonon nincs hover**, tehát ott soha nem látszott volna.
- **KÖT: a felirat nem ígérhet többet, mint ami van** (§B.17):
  - több kép → `N kép` (pl. „4 kép")
  - **egy** kép → `Részletek` — ⛔ soha nem „1 kép", mert az galériát ígérne
- **KÖT: a jelvény a képen BELÜL marad** (nem lóg ki a kép dobozából).

### A kártya mint link — KÖT

A kártya **valódi `<a href="/apartman/<slug>">`**, amit a JS elfog és felugróvá alakít.
Indok: az egység-aloldal SEO-érték (ADR-0041 URL-termelés, ADR-0044 §12-13) — a felugró
**nem áldozhatja fel**. Ahol a thin-content kapu miatt nincs aloldal, ott a kártya gombként
viselkedik.

---

## 2. A FELUGRÓ (a részletek)

Felülről lefelé — **KÖT**:

| # | Elem | Feltétel |
|---|---|---|
| 1 | **nagy kép**, léptető nyilakkal + képszámlálóval | a nyilak/számláló CSAK 2+ képnél |
| 2 | **indexkép-sáv a nagy kép ALATT**, kattintható | CSAK 2+ képnél |
| 3 | kategória-felirat („Apartman" / „A szállás egésze") | mindig |
| 4 | a szoba **neve** | mindig |
| 5 | **férőhely** | ha van |
| 6 | **leírás** | ha van |
| 7 | a felszereltség alcíme (`Amit ez az egység kínál`) + a tételek **ikonokkal** | ⛔ CSAK ha van tétel |
| 8 | **„Foglalás"** gomb | mindig |

- ⛔ **KÖT: egyetlen képnél NINCS halott vezérlő** — se nyíl, se indexkép-sáv, se „1 / 1"
  számláló. (Mérve: 4 egységből 3-nak egy képe van, tehát ez az ALAPESET, nem a széle.)
  ⚠️ A `[hidden]` attribútum **önmagában nem elég**: a `display:flex` felülírja. Mérni a
  **kifestett** méretet kell, nem a DOM-tulajdonságot.
- ⛔ **KÖT: nincs alcím tétel nélkül** (ADR-0181). Ha nincs se leírás, se felszereltség, a
  felugró **őszinte mondatot** ír: `Ehhez az egységhez még nincs leírás és felszereltség megadva.` — nem üres dobozt.
- ⛔ **KÖT: a felszereltségből görgetés nélkül legalább 6 tétel látszik** (asztalin mind a 9).
  ⚠️ Ezt **kifestve** kell mérni, nem `<li>`-t számolni: a mérés egyszer 9-et jelentett, miközben
  a vendég **nullát** látott — a lista a hajtás alá esett.
- **KÖT: az elem-magasság a STAGE-en ül, nem a galéria burkolóján.** Mérve: a burkolón
  `height + overflow:hidden` a **68 px-es indexkép-sávot teljesen levágta**.

### Teljes méretű nézet — KÖT

A **nagy képre kattintva** a fotó teljes méretben nyílik, a felugró **fölötti** rétegben
(léptethető, számlálóval).

- ⛔ **KÖT: az ESC EGY réteget hámoz** — előbb a teljes méretű nézetet zárja, a felugró
  **nyitva marad**; a második ESC zárja a felugrót.
- **KÖT: a nagyban nyíló kép UGYANAZ**, amelyik a felugróban állt, és a bezárás ugyanoda tér vissza.

---

## 3. AMI MINDEN SABLONRA KÖT

- **KÖT: a felugró EGY helyen születik**, és minden színt/betűt/sarkot a `--cit-*` tokenekből
  vesz → **magától in-skin** mind a 19 sablonban (ADR-0011 hidratáló runtime, ADR-0057 in-skin
  modul). ⛔ Generikus fehér modal **tilos**.
- **KÖT: no-JS esetén nem vész el információ** — a részletek `<details>`-ként a kártyán
  nyílnak, és a kártya linkje az aloldalra visz.
- **KÖT: a felszereltség-ikon a 70 tételes katalógusból jön** (`src/tenant/amenityCatalog.ts`),
  a meglévő resolverrel. Mérve: a 17 tárolt címke **mind** pontos katalógus-találat.
- **KÖT: a fókusz visszatér** arra a kártyára, amelyikről a felugró nyílt.
- **KÖT: nulla JS-hiba.**

⚠️ **A kártya-markup 12 sablonban külön él** (mérve: 19 sablonból 12 rajzolja saját maga a
szobákat, 7 a közös tartalékra bízza). A horgony (`data-cit-room`) mindegyikbe kell — és őr
kell rá, különben egy JÖVŐBELI sablon némán a régi, összefűzött szöveget mutatná.

---

## 4. Reprodukció

```bash
# a fixture a TERMÉK forrásából épül (DB + valódi ikon-resolver), nem kézzel:
npx tsx assets/design-refs/_drafts/build-fixture.mts
npx tsx assets/design-refs/_drafts/build-public.mts
npx tsx assets/design-refs/_drafts/check-public.mts   # a működés mérése
```

A `plan.html` a fenti generátor kimenete (kisebb képekkel: `PHOTO_W=430 PHOTO_Q=64`).
A benne lévő kapcsolók — **Mobil/Asztali · Valós adat/Kitöltött minta · JS-sel/JS nélkül** —
a terv részei: a jóváhagyás **mindhárom tengelyen** megtörtént.

## 5. Amit a terv NEM dönt el

- az **admin** szoba-szerkesztő (kártyás/nyitható, képfeltöltés, borítókép) — külön §2b kör
- a **borítókép** megválasztása: ma a hozzárendelés sorrendje dönt, ami félrevezet; a javítás
  az admin körben jön
- az ár helye a felugróban: a fixture-ben nincs ár (`unit_price` üres), ezért a terv nem
  mutat ár-sort — ⛔ ez **nem** jelenti, hogy nem lesz (§B.17: nincs szám → nincs sor)


---

## 6. A KÖTŐ FELIRATOK MEGJELÖLÉSE — a megvalósítás UTOLSÓ lépése

⚠️ A `contract-drift-check` őr a félkövér-magyar-idézőjeles alakot olvassa kötő feliratként (két csillag, alsó idézőjel, a szöveg, felső idézőjel, két csillag), és
megköveteli, hogy a felirat ÉLJEN a **Hatókör** alatti fájlokban. Egy kontraktus, ami a
megvalósítás ELŐTT születik, ezért még nem jelölheti meg őket — nincs mit ellenőrizni.

**A megvalósító szál feladata a munka végén:** a ténylegesen szállított feliratokat itt
kötő alakra írni. Ezek legalább:

| Felirat | Hol |
|---|---|
| a felszereltség-blokk alcíme (`Amit ez az egység kínál`) | felugró |
| az üres egység őszinte mondata | felugró |
| a jelvény két alakja (`N kép` / `Részletek`) | kártya |

⛔ **Idézd a `T()` argumentumát, ne a képernyőn látott összefűzött mondatot**
(`feedback_composed_sentence_is_not_a_quotable_label`: háromszor buktam el ezen egy
sessionben). Ha a felirat i18n-kulcs, a magyar forrás-string a kötő szöveg.

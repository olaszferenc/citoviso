# 2026-09-22 — „Megvette, de üres": a duplikátum, a RÉSZLEGES eset, és három hazudó mérés

**Szál:** `wt/uresmodul` · **Mandátum:** `~/rc-briefs/bought-but-empty-brief.md` (tulaj, 2026-09-21)
**Eredmény:** ADR-0197 (felderítés) · kód nem változott · **javítás külön mandátumot kap**

---

## A legfontosabb: a mandátum érdemi részét MÁS SZÁL vitte el

A session indulásakor a `main` feje `ef5b081` volt. Miközben mértem, **21:22-kor landolt a
`4eed722` + ADR-0194** — ami a brief ① felderítését, ② döntését ÉS ④ őrét is szállítja
(`scripts/paid-empty-check.mts`, öt modul: `pricing` · `poi` · `amenities` · `rooms` · `hours`).
Rebase után lefuttattam: **🟢 minden állítás áll.**

⛔ **A duplikátumot eldobtam** (`feedback_two_threads_did_the_same_work`). A tanulság megerősítve:
a session-eleji `git fetch` **nem elég** — egy több órás felderítés alatt a `main` kétszer is
mozdult (ADR-0194, majd ADR-0196), és mindkétszer pont a szomszéd területen.
⭐ **Amit legközelebb másképp csinálnék:** a felderítés FELÉNÉL is fetchelni, nem csak az elején
és a végén — a mérés ideje alatt landolt munka ugyanúgy elveszett idő, mint a rosszul mért adat.

## Amit a tulaj döntött (a duplikátum ismeretében újratárgyalva)

| Kérdés | Döntés |
|---|---|
| Hol szóljon a figyelmeztetés | **Mindhárom helyen** → utóbb ⛔ **ELVETVE** (2026-09-22): az Áttekintés teendő-sora elég |
| Melyik modulra NE szóljon | `reviews` · `usp`/`amenities`-ha-highlights · `gallery` — **az ADR-0194 már pont így csinálja** |
| A polcról levett modul számlázása | **Külön szálba** — itt csak ADR-ként rögzítve |
| Az ár nélküli naptár | Ne nyúljunk a vendég-laphoz most |
| A duplikátum után mi legyen | **①+② most** (mérés + ADR), ③ később |

⚠️ **Egy tulajdonosi indokot helyesbítenem kellett:** a tulaj szerint az ár nélküli naptárral „a
másik session foglalkozik" (a modul-követelmények). A `modulreq` szál a **jogosultságot** rendezi
(`booking → pricing → rooms`) — az `eldorado`-nál a `booking` ÉS a `pricing` is aktív, a
függőségi rend tehát elégedett, és mégis 0 ár van. Az ADR-0192 ⑨ szó szerint: *„a jogosultság
birtoklása nem garantál árat."* A döntést követtem, az indokot kimondtam.

## ① A valódi, nem duplikált lelet: a RÉSZLEGESEN árazott szállás

Két kapunk van, és **két különböző kérdést** tesznek fel. A harmadikat egyik sem:

- ADR-0193 `siteRendersModule()` → **be van-e kapcsolva** a `pricing`
- ADR-0194 `moduleContentFor().data` → van-e **bármi** tartalom
- ⛔ **„minden egységre van-e ár?"** → **senki**

Mérve, eldobható fixtúrán (valódi DB + valódi HTTP-szerver, az ADR-0193 őrének mintája szerint;
2 egység, egy árazott, egy nem):

| Amit megkérdeztünk | Válasz |
|---|---|
| `/api/foglaltsag/<árazott>` | **ÁRAT AD** |
| `/api/foglaltsag/<árazatlan>` | **`pricing: null`** |
| ADR-0194 predikátuma | **1 egység → „nem üres" → a teendő-sor NÉMA** |
| ADR-0193 kapuja | **true → átengedi** |
| ártáblázat / megmutatott egységek | `[Árazott apartman]` vs. `[Árazott apartman, Árazatlan faház]` |

**A vendég ugyanazon a naptáron az egyik fülön 28 000 Ft-ot lát, a szomszédoson semmit — és a
tulajnak egyetlen képernyő sem szól, mert mindkét őr zöld.**
⚠️ A mai adaton **nem áll fenn** (dev: 0/4 és 3/3 — egyik sem vegyes) → **jövőbeli sodródás**,
nem mai kár. De elég egyetlen új egységet felvenni egy árazott szálláson.

## ② A polcról levett modult tovább számlázzuk

`isBilledModule()` négy feltételt néz (aktív · nem gerinc · nem kiváltott · nem lemondott) —
⛔ **a `retired` és a `module_sales_disabled` nincs köztük.** A termék SAJÁT függvényével mérve:

- `newsletter` (`retired: true`, a blokkja bizonyítottan mindig `""`) → **számlázott: true, 490 Ft/hó**
- `email` (nem eladható, nincs postafiók-kiépítés, nincs felülete) → **true, 390 Ft/hó**

⭐ Az ADR-0196 óta a `renewableModuleIds()` **ugyanerre az egy predikátumra** delegál → **egyetlen
záradék** javítaná mindkét utat.

## ③ Az ADR-0194 nyitott kérdése — a feltevés NEM igazolódik

Az ADR-0194 szerint a kifizetett-de-üres `pricing` mellett a rendszer „árat számolhat és
fagyaszthat be a vendég levelébe". A kód cáfolja: `pricing: priceRows.length ? {…} : null` —
**0 ársor mellett nincs mit számolni.** Nem hamis szám megy ki, hanem **semmilyen**.
A kár valódi, csak más: a naptár **teljesen kirenderelődik** (mérve **942 px** / **1096 px**:
két hónap naptár, egységválasztó, vendégszám, név/e-mail/telefon, „Foglalási kérés elküldése")
— **egyetlen összeg nélkül**.

## ⛔⛔ Három mérésből kettő MEGGYŐZŐEN hazudott

1. **Horgony-számolás a renderelt lapon → HAMIS POZITÍV.** Az ADR-0059 a tartalmat a sablon
   SAJÁT szekciójába teszi, csak a maradékot a horgonyzott blokkba (`sellingLeftover`).
   A `nyugalom-demo` három beírt USP-tétele „NINCS A LAPON"-t kapott — miközben ott van.
   **A horgony nem a tartalom.**
2. **`moduleContentFor()` → HAMIS NEGATÍV kétszer.** A tartalom a **`.data`** alatt ül (a felső
   szintet olvastam → **mindent üresnek** mértem), és még helyesen is csak a tulaj módosításait
   látja, a **generált alapot** (`highlights`) nem — pedig az is a lapra megy.
3. **A helyes forrás az `assembleEffective()`**: `effective = base ∪ override ∪ modul-config`.

⭐ **Ami megfogta: a POZITÍV KONTROLL** — egy tudottan feltöltött fiók, aminek kitöltöttnek KELL
mérődnie, különben a mérés hangosan bukik. Nélküle „minden üres"-t adtam volna tovább leletként.

⛔ **És egy negyedik, a fixtúra-mérésben:** a ④ állítás először `effectiveSiteForMultilang()`-ot
kérdezett, ami renderelt `path` nélküli fixtúra-site-ra `null`-t ad → **üres tömböt hasonlított
üres tömbhöz**, és kiírta, hogy „minden egység szerepel az ártáblázatban": **hamis zöld pontosan
azon az állításon, amiért íródott.** Most megtagadja az ítéletet, ha nincs mihez hasonlítani.

## Módosított fájlok

- `_planning/DECISIONS.md` — **ADR-0197** (új)
- `_planning/memory/2026-09-22_paid_but_partially_empty.md` — ez a jegyzet (új)
- `_planning/memory/INDEX.md` — a sora
- `MEMORY.md` — az aktív szál
- ⚠️ **Termék-kód nem változott.** A vázlat-mérők (`assets/design-refs/_drafts/`) gitignore-oltak,
  a `land.sh` törli őket.

## Nyitott kérdések / következő lépés

1. **① javítása** — hol kérdezzük meg, hogy MINDEN egységre van-e ár, és mit mondjon a naptár a
   hiányzó egységnél. ⚠️ Vendég-lap = kinézeti döntés → **§2b tervkör**.
2. **② javítása** — egy záradék az `isBilledModule()`-ban, külön mandátummal.
3. ~~A „mindhárom felületen szóljon"~~ → ⛔ **ELVETVE (tulajdonosi döntés, 2026-09-22).**
   Az Áttekintés teendő-sora elég; a Modulok fül sora és a modul szerkesztője nem kap külön
   jelzést. A §2b vázlat (3 működő változat, mért sor-magasságokkal) **eldobva**, kód nem lett.

## ⛔ Utólagos saját hiba: kétértelmű folytatásból ÉN választottam témát

A tulaj az előző körben a „mindhárom hely"-et kifejezetten **későbbre** tette. Amikor annyit
írt, hogy *„ok folytassuk"*, én ezt a **③-ra** értettem — mert láttam, hogy a blokkoló
(`wt/modulreq`) feloldódott —, és legyártottam egy teljes §2b kört. A tulaj reakciója:
*kavarodás van, szerintem már volt design döntés*. **Igaza volt** abban, hogy volt döntés
(ADR-0194, A változat) — csak az egy MÁSIK kérdésre válaszolt (hogyan nézzen ki, nem hogy hány
helyen legyen). A felesleges kört viszont nem a duplikátum okozta, hanem az, hogy egy
kétértelmű folytatás-kérésből **levezettem** a hatókört, ahelyett hogy visszakérdeztem volna.

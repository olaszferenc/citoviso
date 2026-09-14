# A kiküldött mock-lap keretezése — ADR-0159, és három hiba a saját mérőeszközömben

**Dátum:** 2026-09-14 · **Szál:** `wt/mocklapleadszem` (B7, második kör) ·
**Forrás:** Elek FK-004b + tulajdonosi döntés · **Élesítés:** NINCS.

---

## A döntés

A §2b körből a tulaj az **„A — diszkrét felső sáv"** változatot választotta. Szó szerint:

> „A látogató az **ELSŐ pixeltől** tudja, mit néz: honlap-terv az ő szállásáról, a Citoviso
> készítette a nyilvános adataiból, és **még nem élő oldal** — a jogi részlet egy kattintásra
> nyílik. Kövesd a ma is létező »leiratkozott«-sáv mintáját. A sáv **MINDEN látogatónak**
> szóljon, ne csak a leiratkozottnak.”

Befagyasztva: `assets/design-refs/prospect-page/framing/` (README = KONTRAKTUS + `plan.html`
+ mobil/asztali kép). ADR: **ADR-0159**.

## Amit szállított

- A követett előnézet **minden** látogatója a lap tetején kapja a keretezést, a **folyamban**
  (lenyomja a lapot, nem úszik rá). A leiratkozott továbbra is a SAJÁT sávját kapja, és egy
  látogató **sosem lát kettőt** — a kettő mást állít (az egyik rögzít, a másik nem, §B.17).
- A „Miért kaptam?” natív **`<details>`**, nem szkriptelt kapcsoló: a mock IDEGEN böngészőben
  nyílik meg, a kiút nem múlhat egy betöltött JS-en. Külön, `javaScriptEnabled:false`
  méréssel igazolva.
- A mondatok **EGY forrásból** (`LEGAL_BASIS` / `TRACKING_NOTICE` / `legalLinks`): a felső sáv
  és az alsó lábazat két **HELY**, nem két igazság.
- Az alsó jogi lábazat **marad** (ADR-0112). A szín a modul mai két engedélyezett szürkéje +
  fehér kiemelés — harmadik szín új token-kivételt igényelne, és a lap nem tölti be a
  `citui.css`-t.

## ⛔ HÁROM HIBA A SAJÁT MÉRŐESZKÖZÖMBEN — mindhárom rossz KÉRDÉS volt, nem rossz termék

1. **A csukott `<details>` tartalmának VAN layout-doboza.** Chromiumban egy zárt `<details>`
   gyereke 600×18-as dobozt kap, üres `innerText`-tel. A méret-alapú „látszik?” tesztem
   ezért a **csukott** jogi részt **nyitottnak** mondta — 10 bukás egy hibátlan felületen.
   A helyes primitív a **`checkVisibility({checkOpacity, checkVisibilityCSS,
   contentVisibilityAuto})`**.
2. **A rejtett fixed nav GYEREKEI „láthatók”.** Két sablon navja `position:fixed; opacity:0`
   (görgetésre jön elő) — a gyerekei viszont `opacity:1`-et számolnak, tehát a kézzel írt
   láthatóság-teszt szerint egy **láthatatlan** navigáció linkjei festettek a sávra.
   A `checkOpacity` az **ŐSÖKET** is nézi; ugyanaz az egy primitív oldotta meg mindkettőt.
3. **Az aurora `body>*{position:relative}`-je null-t adott.** A „lenyomja-e a lapot” próbám
   az első **statikus** body-gyereket kereste — az aurorán ilyen nincs. A `relative` doboz
   is a folyamban van; a `static`-only kérdés ott nem mér semmit.

⭐ **És egy fogalmi javítás:** az „átfed-e valami a sávval” **önmagában nem hiba**. Egy
parallax réteg 16 px-re benyúlik a sáv sávjába, de **mögé** fest. A helyes kérdés: ki fest
**FÖLÉ** (`elementFromPoint` az átfedés közepén) — és **lenyomja-e** a sáv a lapot (referencia:
UGYANAZ a lap a sáv nélkül; a különbség a sáv magassága, nem egy beégetett szám).

## ⛔ Az önteszt egyik ága LEHETETLEN esetet mért

A „linkek a böngésző alap-kékjével” visszarontás **zölden** hagyta a kontraszt-őrt — mert a
sablonok `a{color:inherit}`-et állítanak, tehát az inline szín elhagyása nem kéket, hanem az
öröklött szürkét adja. Vagyis az öntesztem egy **elő nem forduló** helyzetet „bizonyított”.
Valódi rossz színre (`#3a3f47`) cserélve lett igazi piros. *(A §2b vázlaton ugyanez a hiba
VALÓDI volt — ott nincs sablon-CSS, ami visszaadná a színt.)*

## ⛔ A trigger LAND-VAK volt — egy párhuzamos szál őre fogta meg

A `hooks/pre-commit`-be írt blokkom nyers `git diff --cached`-et olvasott. Landoláskor az
index ÜRES (a land `LAND_RANGE`-et ad), tehát az őr **némán kimaradt volna** pont akkor,
amikor a legfontosabb. A `changed_files` helper mindkét módot kezeli — a
`guard-wiring-check` (ADR-0152) ezt kimérte és megállította a commitot.

## NYITOTT — tulajdonosi döntést igényel

**Két sablonon (`arch-frames`, `wordmark-grow`) az ADR-0115 nyitó-animáció ~4,7 másodpercig
teljes képernyőn fedi a lapot**, tehát a keretezés addig sem látszik. Mérve. A
`data-cit-no-intro` kapcsoló létezik; hogy a kiküldött mockon kikapcsoljuk-e, **tervezői
döntés**. Emellett nyitva maradt az **ár-tábla** (②) döntése is — a tulaj jelezte, hogy külön jön.

## Módosított / létrehozott fájlok

- `src/console/prospectNotice.ts` — `injectTrackingBanner` + megosztott mondat-konstansok
- `src/console/server.ts` — a követett ág viszi a sávot
- `scripts/prospect-framing-check.mts` — ÚJ őr (5 sablon × 2 szélesség, 5 piros önteszt)
- `scripts/kb-check.mts` — a `prospectNotice.ts` belép a címke-drift korpuszba
- `hooks/pre-commit` — az őr bekötve, `changed_files`-szal
- `kb/entries/console-outreach-draft/entry.hu.md` — mit lát a lead a link megnyitásakor
- `assets/design-refs/prospect-page/framing/` — a befagyasztott KONTRAKTUS
- `_planning/DECISIONS.md` — ADR-0159

---

# UTÓIRAT (ugyanaznap) — a nyitó-animáció kikapcsolva a kiküldött mockon

A fenti „NYITOTT" pont **lezárva**: tulajdonosi utasítás — *„kapcsold ki a nyitó-animációt
a kiküldött mockon"*. ADR-0159 ⑦–⑧ ponttal kiegészítve.

## Amit a mérés hozzátett a bejelentéshez

- `arch-frames` ~4,7 mp — ezt már tudtuk. **`wordmark-grow` 6 másodpercnél MÉG futott**;
  a korábbi jegyzetem „~4,7 mp"-et írt mindkettőre, ami pontatlan volt.
- ⛔⛔ **JS NÉLKÜL A KÉT INTRO TELJES KÉPERNYŐS ÜRES PANELT ADOTT.** A `.cit-fintro` /
  `.cit-intro` `position:fixed; inset:0`, **opak** háttérrel; a benne lévő nevet a
  `.cit-on` osztály teszi láthatóvá, és az elemet is JS veszi ki — szkript nélkül
  **egyik sem történik meg**. Fényképezve 390 px-en: üres krém téglalap, semmi más.
  És ez **az élő tenant-lapokra is állt**, nem csak a mockra.
  A `runtime.ts` `<noscript>` hálója eddig csak a *rejtett* tartalmat kényszerítette
  láthatóvá; itt az ellenkezője kellett. **Hibajavítás, nem tervezői döntés** — ezért a
  hálóban van, nem a `/p/` úton.

## A kikapcsolás KÉT fele — és miért kell mindkettő

1. `<html data-cit-no-intro>` — a mozgás-réteg **saját** kapcsolója: mindkét intro-szkript
   ezt nézi, és az overlay-t azelőtt veszi ki, hogy bármihez hozzányúlna (így a lap
   `overflow:hidden`-be sem kerül).
2. `<style>` a válaszban — a JS-nélküli látogatóért **és a RÉGI ARTEFAKTUMOKÉRT**: a lap
   egy hetekkel korábban rendelt fájlból jön, tehát az AKKORI no-JS hálót viszi. A
   `runtime.ts` mai javítása egy lemezen lévő mockon **nem segít**. Az őr ezt külön
   méri (mesterségesen „elavított" artefaktummal).

## ⛔ Három dolog, ami MÉRÉS NÉLKÜL zöld lett volna

1. **A kapcsoló ELSŐ változata nem ért hatályba.** Az idempotencia-őrszemem
   (`html.includes("data-cit-no-intro")`) **az intro SAJÁT szkriptjének forrására**
   illeszkedett — a template beágyazza a `hasAttribute('data-cit-no-intro')` hívást —,
   ezért a függvény érintetlenül adta vissza a lapot. A `<html>` **TAG**-et kell
   kérdezni, nem a dokumentumot.
2. **A hit-teszt VAK az overlayre.** Az intro `pointer-events:none`, tehát az
   `elementFromPoint` ÁTNÉZ RAJTA és a sávot adja vissza: a „sáv közepén a sáv van"
   **zöld** volt egy olyan lapon, ami egy üres krém téglalapot mutatott. **Pixel kell**.
3. **De nem EGYETLEN pixel.** 1280-on a sáv függőleges közepére épp a „Miért kaptam?"
   felirat esik; a 6×6-os folt a BETŰKET átlagolta ([63,66,71]), és az őr öt hibátlan
   sablont buktatott meg. A helyes mérce: **teljes szélességű, 3 px magas csík**, és a
   képpontok **többsége** legyen a sáv saját háttere (betű mindig van rajta; egy takaró
   réteg viszont nullára viszi az arányt).

⭐ **És az őr már nem VÁRJA MEG az introt.** A korábbi változat 7 másodpercig várt az
önkioltásra — azaz a PROBLÉMA UTÁN mért, és zöld maradt volna, ha az overlay visszajön.
Most az **első festésnél** mér, mert a kapcsolónak épp az a dolga.

## Módosított fájlok (utóirat)

- `src/generator/runtime.ts` — a `<noscript>` háló elrejti az intro-overlayeket (mock ÉS élő)
- `src/console/prospectNotice.ts` — `disableIntroAnimation()`
- `src/console/server.ts` — mindkét ág (követett és leiratkozott) kapja
- `scripts/prospect-framing-check.mts` — ④ szakasz + pixel-mérés + 2 új piros önteszt
- `assets/design-refs/prospect-page/framing/README.md` — 10. pont (a kontraktus bővült)
- `kb/entries/console-outreach-draft/entry.hu.md` · `_planning/DECISIONS.md` (ADR-0159 ⑦–⑧)

---

# UTÓIRAT 2 — az ár-minta: „B — kitöltendő mezők" (ADR-0165)

A keretezés-kör utolsó nyitott pontja is lezárva: a tulaj a **B** változatot választotta.

## Amit szállított

- A sor `<td>Főszezon</td><td></td><td>—</td>` helyett: **szaggatott helyőrző** a „Mikor"
  oszlopban, **„Ön írja be"** az összegében. Üres cella nem marad.
- **NULLA SZÁMJEGY** a tábla celláiban — a §B.17 legerősebb alakja: nincs mit félreolvasni,
  és **nem kell mentegetőző mondat** sem.
- A képaláírás már csak arról beszél, ami a képen van. (A régi „ezek **nem valós árak**"
  mentegetőzés volt valamiért, ami ott sincs.)

## ⛔ A MELLÉKHATÁS, AMI NÉLKÜL A JAVÍTÁS ROSSZABB LETT VOLNA

390 px-en a fejléc-sor **rejtett** (`thead{position:absolute;clip}`), és a stack-elt sor
csak ennyi lett volna: *„Főszezon / ▭▭▭▭ / Ön írja be"* — **nem derül ki, melyik a dátum és
melyik az ár.** Korábban ez nem látszott, mert az egyik cella ÜRES volt (`td:empty`
elrejtette), a másik meg **önleíró pénzösszeg**. Vagyis a régi tartalom takarta el a hibát,
és az új tartalom hozta felszínre.

⭐ A modul CSS-ének kommentje **már akkor is** azt ígérte, hogy „stacked rows, **each
labelled**" — a CSS viszont soha nem csinálta meg. **Egy kommentben tett ígéret is ígéret:
őr kell rá.** (`feedback_a_contract_promise_needs_a_guard`)

## ⛔ Két hibás KÉRDÉS a saját őrömben

1. **A `checkVisibility()` IGAZAT mond a képernyőolvasós rejtésre.** A `position:absolute;
   width:1px; height:1px; clip` **nem** `display:none` és **nem** `visibility:hidden`, tehát
   a `checkVisibility()` szerint a fejléc „látszik" — az őr ezt állította is, 390 px-en.
   A helyes kérdés a **MÉRET**.
2. **…és a THEAD dobozát kell mérni, nem a benne lévő TH-ét:** a levágás a **szülőn** van,
   a gyerek doboza ettől még a természetes méretét adja vissza.

*(Kiegészíti a [[reference_checkvisibility_beats_handrolled_visibility]] tanulságot: a
`checkVisibility()` a kézi tesztnél jobb, de a clip-alapú rejtésre ő sem válasz.)*

## Két párhuzamos szál őre fogta meg a hiányosságaimat

- `contract-drift-check`: a `pricing-sample/` kontraktusban **nem volt kattintható terv**
  (a terv a szomszéd mappa `plan.html`-jének egy kapcsoló-állapota volt) → önhordó
  `plan-B.html` készült; és a README **félkövér idézőjeles** változat-neve KÖTŐ UI-feliratnak
  olvasódott → átfogalmazva.
- `guard-wiring-check` (előző körben): a triggerem nyers `git diff --cached`-et olvasott,
  ami landoláskor üres.

## ⚠️ Kimondott eltérés a jóváhagyott vázlattól

A vázlat felirata „egyetlen szám sem a sajátja" volt — ez azt **sugallja, hogy számok
vannak** a lapon. A szállított: „szándékosan nincs egyetlen ár sem", és „szezonok" helyett
„időszakok" (a tábla fejléce IDŐSZAK). A `pricing-sample/README.md` ezt **külön kimondja**,
egy szóra visszaírható — a jóváhagyott vázlat a kontraktus, tehát az eltérés nem maradhat
néma (`feedback_approved_draft_is_the_contract`).

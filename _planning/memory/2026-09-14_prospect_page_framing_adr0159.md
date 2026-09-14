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

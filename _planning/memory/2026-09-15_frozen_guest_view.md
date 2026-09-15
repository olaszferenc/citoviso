# 2026-09-15 — „Oldal megtekintése" fagyás alatt: a sajátom és amit a világ lát

**Szál:** `wt/fagyasztottkartya` · **Kontraktus:** `assets/design-refs/console/freeze-state-v2/` ⑨
**ADR:** 0155 ⑦ (a korábbi NYITOTT pont lezárása) · **Tulajdonosi döntés:** „B — Felirat + vendég-nézet"

## A bejelentett lelet NEM állt — a mérés mást talált

A lelet: „az »Oldal megtekintése« figyelmeztetés nélkül visz a fagyasztott lapra".
**Mérve:** a `public.ts` a `siteUrl`-t **csak `live` státuszban** adja át, fagyás alatt tehát
`null`, és a gomb a BELSŐ előnézetre (`/site/<token>`) esik vissza. **Törött link nincs.**

A valódi baj a felirat, és az **ellenkező irányba** hazudik: az „Oldal megtekintése" azt
ígéri, hogy azt látja, ami a **látogatónak** megy — közben a tulaj a teljes, működő oldalát
kapja, a látogató meg 503-at. A gomb megnyugtat, pont amikor nem kéne. A **modul-sorok ezt
már megoldották** („Megnézem" → „Előnézet"); a fejléc-gomb kimaradt ugyanabból a javításból.

## ⛔ A második lelet a SAJÁT előző köröm hibája

A „B — Rendezés-képernyő" refaktorom **némán elvitte** a hármas ténylistát, amiben EGYEDÜL
állt, hogy a látogató nem üres lapot és nem nyers hibát kap
(`feedback_layout_swap_silently_removes_information`). A tulaj legnagyobb félelmére
(„elveszítem a vendégeket?") nem volt válasz a képernyőn.

⚠️ És amit a tulajnak jelentettem („a blokk állít valamit, amit nem tud ellenőrizni"),
**elavult premissza volt** — a B ELŐTTI kódra igaz. A saját összefoglalóm lett a hamis
kiindulás (`feedback_my_own_summary_line_can_be_the_false_premise`). A tulaj kifejezetten
megkért, hogy MÉRJEM — az mentett meg.

## A pótolt mondat NEM a régi

Egy párhuzamos szál (`5ea2e3e`, 2026-09-14) kivette a vendég-lapból az „átmenetileg"-et és a
visszatérés-ígéretet: fizetés híján a 30. napon a honlap **véglegesen** lekerül. Ugyanazt az
ígéretet **egy szinttel feljebb sem** írhatom vissza. A mai vendég-lap mérve:
„Ez az oldal jelenleg nem érhető el." + szállásnév + település + elérhetőségek.

## Az őr gerince: egy forrás, nem hasonmás

`scripts/frozen-guest-view-check.mts` — amit az admin **ígér** a látogatói lapról, azt a
`renderSuspendedPage()` **RENDERJÉN** keresi vissza. Ha a vendég-lapról eltűnik a név vagy az
elérhetőség, az admin mondata hamissá válik, és a kapunál derül ki, nem a tulajnál.
Piros önteszt: 2 sértés; a gerinc (④), a visszatérés-tilalom (⑤) és a Modulok-fül külön útja
(⑥) a TERMÉK visszarontásával igazolva.

## Mért korlát, kimondva

390×844-en a látogatói link első festéskor **y=790**, a fix alsó fülsáv y=658-tól → a sáv
alatt van, csak görgetés után kattintható (scrollY=230 → y=560, kattintható). ELFOGADOTT: a
⑦ az ÖSSZEGET és a FIZETÉS-GOMBOT köti a nyitó nézetbe (y=270 / y=359). Amit nem fogadunk el:
hogy egyáltalán ne legyen elérhető — ezt a `frozen-phone-check` méri.

## ⚠️ Kétszer a saját mérőeszközöm csapott be

- A `scrollTo` után **azonnal** olvastam vissza a pozíciót → „a lap nem görget" hamis
  következtetés. Beállásra kell várni.
- A ⑨ elérési próba **először le sem futott**, mert a fixtúrám `siteUrl`-t adott
  `guestViewUrl` helyett → nem renderelődött link
  (`feedback_fixture_must_prove_its_own_path`). Javítva.
- A piros próbám első hipotézise (a 208px alsó pading elvétele) **nem sült el** — hosszú
  lapon van görgetési tartalék. Az önteszt viszont lefedi (2 sértés, két hibamóddal).

## Módosított / létrehozott fájlok

- `src/server/public.ts` (új `guestViewUrl`, a `siteUrl` szemantikája érintetlen)
- `src/server/adminViews.ts` · `public/assets/ui/citui-admin.css` · `src/i18n/catalog.json`
- `scripts/frozen-guest-view-check.mts` (új) · `scripts/frozen-phone-check.mts` (⑨ elérés)
- `hooks/pre-commit` · `assets/design-refs/console/freeze-state-v2/README.md` (⑨)
- `_planning/DECISIONS.md` (ADR-0155 ⑦)

## Nyitott

- Terhelés-újrapróbálás: továbbra sincs szerver-útvonal (a kontraktus ⑤ kimondja).
- **Élesítés NINCS** (§0.3).

# 2026-09-08 — A mock megmondja, melyik minta készítette (operátori minta-jelölő)

## A kérés

> „A generált mock fileok tele vannak adattal, csak az nem derül ki, melyik mock minta volt
> használva (fullbleed, sötét luxus, kártyás stb.)"

## Az állapot, mérve

- A kész HTML egyetlen halvány nyoma a minta-választásból: `<body class="cit-tpl-aurora">`.
  Nincs `<meta>`, nincs komment, a **skin** és az **archetípus** sehol.
- A választás a `mock_artifact.inputs` JSONB-ben él, és csak a konzol artefaktum-kártyáján
  jelenik meg — a 12 mezős gépi chip-sor közepén (`template=cinematic · skin=cinematic-navy`).
- Az operátori előnézet URL-je `/mock/<uuid>`, a `<title>` a szállás neve → tíz nyitott fül
  megkülönböztethetetlen.
- ⭐ Emberi (magyar) címke MINDHÁROM regiszterben **már létezett** a kódban
  (`templates/*.ts` `label`, `skins.ts` `label`, `archetypes.ts` `label`) — csak sehová nem
  jutott el. Nem szótárt kellett írni, hanem elvinni a szemig.

## Amit szállítottunk

`src/generator/patternBadge.ts` (új) — `patternSummary()` + `injectPatternBadge()`:

- **Az operátori előnézetben** (`/mock/:id`, auth-kapu mögött) egy felső sáv:
  „Aurora · Éjkék · sablon-recept", **Részletek** panellel (teljes címke + gépi id + fájlnév +
  dátum), `×`-szel pöttyé zsugorítható, a pöttyre kattintva visszajön. A `<title>` is a
  mintával kezdődik → a fül-sor olvasható lett.
- **A lead-oldali mock-kártyán** ugyanaz a sor, félkövéren, a gépi chip-sor FÖLÖTT — ott, ahol
  a Jóváhagyás/Elutasítás gomb van, tehát ahol a döntés születik.
- **A tárolt fájl tiszta marad:** az injektálás serve-időben történik (mint a
  konfigurátor-overlay), a vevő-utak (`/configure/`, `/p/`, `/site/`) érintetlenek.
- Az **archetípust a sablon-úton nem nevezi meg mintaként**: tárolva van (`stacked`), de inert
  — a body `cit-tpl-*`, `cit-arch-*` osztály nincs is a lapon. Kimondani félrevezetés lenne
  (§B.17); a Részletek panel ezt külön ki is mondja.
- A sablon és a skin azonos rövid neve (Aurora + aurora-indigo) nem ismétlődik.

Őr: `scripts/pattern-badge-check.mts` — minden mockra, mobil+desktop: a sáv **pixelen** látszik
(`elementFromPoint`, nem `display`), a panel nyílik/zár, `×` → pötty → vissza, 0 JS-hiba, és a
**negatív ág**: sem a `/configure`, sem a lemezen tárolt fájl nem kapja meg. Negatívan is
megmérve (injektálás kikapcsolva → bukik).

`scripts/design-token-lint.mts`: a `patternBadge.ts` felkerült a doktrína-lánc FÁJLLISTÁJÁRA,
ALLOW-indoklással (a badge idegen dokumentumban él, ahol a citui.css nincs betöltve → a citui
token-NEVEK a badge gyökerén, scope-olva deklaráltak).

## ⛔ Amit menet közben találtunk — MEGTALÁLVA ÉS JAVÍTVA (ugyanaznap)

**Az aurora sablon CSS-e kiveri a fixed rétegből a ráinjektált overlayeket.**
`src/engine/templates/aurora.ts:77`: `body>*:not(.au-aurora):not(.au-nav){position:relative}`.

Ez nem csak a mi jelölőnket érinti — **a vevő-oldali prospect-konfigurátort is**. Mérve a
`/configure/`-on, 390px:

| sablon | `cit-cfg-launch` (az indító gomb) |
|---|---|
| aurora | `position:relative`, **y≈13 999px** (a lap legalja, a hajtás alatt) |
| cinematic | `position:fixed`, y=769 (a viewport alján lebeg, ahogy kell) |

Vagyis **ha egy leadnek aurora-sablonú mock megy ki, a vásárlási belépő nincs ott, ahol lennie
kell.** A jelölőnél `!important`-tal védtük ki; a konfigurátor NEM lett hozzányúlva (nem ez volt
a kérés) — **utóbb a tulaj külön kérésére javítva**:

- `assets/runtime/cit-configurator.css`: **páncél-blokk** (`cit-cfg-armour-*`) az öt gyökér-
  elemre (`launch`, `panel`, `scrim`, `escveil`, `esccard`). CSAK azt védi `!important`-tal,
  ami sosem változik állapot/breakpoint szerint: `position`, `z-index`, `float`, `margin`.
  Az offsetek és transformok szándékosan érintetlenek — azok a mobil bottom-sheet
  elrendezésben és a nyit/zár animációban legitim módon változnak.
- Őr: `scripts/configurator-float-check.mts` — **mind a 17 sablon**, mobil + asztali:
  a belépő a fixed rétegben van, a viewportban van és `elementFromPoint` **rá is talál**.
  Piros önteszt: a páncélt a kiszolgált CSS-ből kivágva az aurora **buknia kell**
  (mérve: `position:relative`, y=11 868 → páncéllal y=745). Bizonyító képpár minden
  futásnál: `assets/Temp/cfg-float-aurora-{ELOTTE,UTANA}.png`.
- Bekötve a `hooks/pre-commit`-be (motor / konfigurátor-réteg változásakor fut).

⚠️ **A saját fixture-öm először hamis zöldet adott:** a `Recipe`-ben `templateId`-t írtam
`template` helyett, így mind a 17 „sablon" valójában ugyanazt az archetípus-lapot renderelte
(`cit-arch-stacked`), és a 34 mérés egyetlen lapot mért 17-szer. Az őr most **hangosan bukik**,
ha a fixture nem a sablon-úton renderel (`body.cit-tpl-<id>` ellenőrzés).

## ⛔ A saját hibám ebben a szálban

A tulaj egy egyszerű dolgot kért. Én §2b terv-kört indítottam: három badge-változatot
injektáltam a valódi mockba, ui-shot, végigkattintás, 13 fájl elküldve, „megállok és várok".
A válasz: *„mi a faszról vakerálsz? Nem az a feladatod, hogy kurva mockot szerkesszél, hanem
az, hogy jelenjen meg a generált mockban, hogy melyiket használtuk."*

Utána a jelölést csak a **megnyitott** mockba tettem — a tulaj viszont a **listán** keresi, ahol
dönt. Második dörgedelem: *„hol a picsába van??? nem volt rettentően bonyolult amit kértem"*.
A funkció mindkétszer működött; a HELYE volt rossz. **A jelölés oda kell, ahol a döntés
születik, nem oda, ahol a technikailag legkézenfekvőbb.**

A felület-kapu kivétel-ága a tulaj kimondott szavával naplózva (`surface-gate.mjs exception`) —
nem magamnak adtam meg (ADR-0068).

## Landolva

`951ab6f` (jelölő + őr + lint-hatókör) · `fbd7d76` (a lead-oldali kártya-sor).
`origin/main` = `fbd7d76`, a fő fa is ezen áll, a :4600 igazoltan ezt szolgálja ki.

## Nyitott

Nincs. A konfigurátor-lebegés a tulaj külön kérésére ugyanebben a szálban lezárult (páncél +
17 sablonos őr + piros önteszt + pre-commit bekötés).

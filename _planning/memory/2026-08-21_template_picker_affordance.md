---
description: A kinézet-választó kártya csak nagyított, sosem választott — affordancia-ütközés (preventDefault a labelben); fix + böngésző-viselkedés-őr
---

# 2026-08-21 — A választó, ami nem választott (kinézet-kártyák)

## Kiváltó (tulaj, telefonról, éles admin)

> „nem tudok mock típust választani mert akkor csak a mock nyílik meg nagyban ha rákattintok”

## A hiba

A lead-oldal „Kinézet-típus" kártyarácsa (ADR-0027 — a kurátor dönt) `<label>`-be csomagolt
rádiógomb + thumbnail. A thumbnailre ez volt kötve:

```js
onclick="event.preventDefault(); citTplGallery(id)"
```

A `preventDefault()` a **label aktiválását** tiltja le (a label „labeled control activation"
viselkedése megelőzhető). Így a kép — a kártya kb. **80%-a** — csak a galériát nyitotta meg, és
SOHA nem választott sablont. Választani egyedül a keskeny névsávval lehetett, amit telefonon
gyakorlatilag lehetetlen eltalálni. A választó **létezett, látszott, és nem működött**.

Az eredeti komment még védte is a döntést („a thumbnail nyitja a galériát, a label többi része
választ") — ez a klasszikus csapda: a kód leírja, mit csinál, és senki nem kérdezi meg, hogy
*melyik felület mekkora*.

## A TANULSÁG — az elsődleges művelet kapja a nagy felületet

Egy felületen a **fő cselekvés** kapja a domináns találati területet, a másodlagos pedig **saját,
explicit vezérlőt**. Itt a fő cselekvés a VÁLASZTÁS (ez a képernyő létezésének oka), a nagyítás
csak segéd. Fordítva volt bekötve.

Általánosítva: **ha két művelet ugyanazon a pixelen osztozik, az egyik el fog veszni.** Nem
„okos" eseménykezeléssel kell szétválasztani, hanem külön felülettel.

## A fix

- Az **egész kártya** (kép is) választ — nincs `preventDefault` a képen.
- A nagyítás saját sarok-**gombot** kapott (`.tpl-card__zoom`, 32×32 tap-méret, `zoom` SVG ikon a
  közös készletből — §B: nincs emoji). `<button>` a `<label>`-en belül *interaktív tartalom*, ezért
  a böngésző nem aktiválja tőle a label-t: a két funkció szerkezetileg nem tud ütközni.
- Kurzor-javítás: kártya = `pointer` (választ), gomb = `zoom-in` (nagyít). A korábbi globális
  `.tpl-card { cursor: zoom-in }` szabály maga is *hazudott* a felhasználónak.

## Az őr — viselkedést mér, nem jelölést

`scripts/template-picker-check.mts`: valódi Chromiumban **rákattint a kártya képére**, és azt
állítja, hogy (1) a rádió bepipálódott, (2) NEM nyílt nagyító, (3) a kártya megkapta a jelölést,
(4) az előnézeti kép átváltott; majd a nagyító-gombra kattint és állítja, hogy a galéria nyílik és
a választás megmarad; végül méri a gomb tap-méretét (≥30px). **Desktop + 390px mobil.**

`--self-test`: ugyanezt lefuttatja a *szándékosan visszatört* jelölésen, és megköveteli, hogy
elbukjon → **10 piros**. Egy őr, ami nem tud pirosra menni, nem őr.
(Horgony: [[feedback_guard_must_measure_what_matters]] — ADR-0043, ADR-0044 ugyanezt tanította.)

Bekötve a `hooks/pre-commit`-be, feltételesen (csak ha `src/console/views.ts` vagy
`public/assets/ui/citui-console.css` staged) — böngészős check, ~7s.

## Módosított fájlok

- `src/console/views.ts` — `templateCards()`: kép már nem nyeli a kattintást; új zoom-gomb
- `src/ui/icons.ts` — új `zoom` ikon (utility, tiszta currentColor)
- `public/assets/ui/citui-console.css` — `.tpl-card__zoom` + kurzor-javítás
- `scripts/template-picker-check.mts` — ÚJ viselkedés-őr (öntesztes)
- `hooks/pre-commit` — az őr bekötése

## Élesítés

Commit `fe6f856` → `origin/main`. Prod (`admin.citoviso.com`) scp-deploy: diff-before-deploy
(mindhárom fájl pontosan a lokál `HEAD~1`-en állt → nincs prod-only hotfix), `.bak-20260821-162458`
rollback-pont, SHA256-egyezés, `systemctl restart citoviso-console.service` → active, log tiszta,
`:4600/leads` → 303. Élő ellenőrzés: a kiszolgált CSS tartalmazza a `.tpl-card__zoom` szabályt.

## Nyitott

- Ugyanez az affordancia-kérdés más kártyarácsokra is feltehető (lead-fotók, artefaktum-kártyák):
  ott a nagyítás *tényleg* az elsődleges művelet, szóval valószínűleg rendben van — de nem mértük.

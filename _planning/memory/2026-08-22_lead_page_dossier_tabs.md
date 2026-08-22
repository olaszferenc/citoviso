# 2026-08-22 — A LEAD-oldal újratervezése: dosszié-fülek (ADR-0054)

## Kiváltó

A tulaj küldött egy képernyőképet a saját, napi használatban lévő **MineREAL** rendszeréből
(ajánlat-nézet: fejléc-sáv névvel + nagy összeggel, alatta státusz-pillek, majd fül-sor —
Alapadatok / Igények / Feltételek / Dokumentumok / Térkép / Megjegyzések), és kérte:
*„tervezd újra a LEAD oldal… Szempontból is praktikusabb. Mock fájlokat küldjél vissza,
amit le tudok tölteni és megnézni."*

## A baj, amit megoldott

A lead-oldal **hét, egymással nem összefüggő munkát** vitt EGY görgetésben: adat-javítás,
mock-generálás, megkeresés, csomag/fizetés, fotók, forrás-ellenőrzés, audit. Kétoszlopos
rácsban ültek, és **egymást temették** — minden szekció rövidre volt szorítva, hogy a többi is
elférjen, és a kurátor nem látta, melyikben van egyáltalán tennivaló.

## A munkamódszer, ami bevált: a tulaj választ mockból

Nem egy megoldást szállítottam, hanem **öt letölthető, önálló HTML-mockot** (`assets/Temp/`),
mindet a valódi dizájn-tokenekkel (`--citui-*`), hogy telefonon is meg tudja nézni:

1. **A** — fülek felül (első kör)
2. **B** — oldalsó, függőleges fül-sáv → elvetve (telefonon úgyis vízszintes sorrá alakulna)
3. **C** — dosszié-fül világos sávon
4. **D** — navy sáv, cián kitöltésű aktív fül
5. **E** — ikon-kapszulák (a MineREAL FŐ menüsorának kézjegye)

Két iterációs kör kellett, és **mindkét javítás a tulajtól jött**, nem tőlem:
- *„a tab stílus igazodjon ahhoz, amit küldtem, és a tabok sávja nem vizuális / markáns"* — az
  első A-változat fül-sávja átlátszó háttéren futó vékony aláhúzás volt, ami beleolvadt.
- *„a C tabfül alatti kék vonal nélkül mintha átfolyna a kártyára, nincs elválasztó az aktív
  között. + háttere navy"* — majd pontosítva: *„az aktív tab az egyben van vizuálisan a kinyitott
  kártyájával"*. Ez adta a végleges **C2**-t.

⭐ **Tanulság:** vizuális döntésnél a letölthető, kattintható mock **nagyságrenddel jobb**, mint a
szöveges leírás — a tulaj két mondattal olyan pontosítást adott, amit magamtól nem találtam volna el.

## Amit szállítottam (ÉLES, commit `2fb7015`)

**Identitás-sáv** (`.con-lhead`): navy fejléc monogrammal, a **match-konfidencia NAGY
mérőszámként** (ez kapuzza az összes további műveletet, tehát megérdemli a nagy felületet),
alatta állapot-pillek (minősítés / mock / megkeresés), majd a nyers kapcsolat-tények —
telefon és e-mail kattintható.

**Dosszié-fülek** (`.con-ltabs`): navy fül-sáv, alján cián záróvonal, ami elválasztja a sávot a
tartalomtól — **az aktív fül alatt viszont megszakad**, mert a fül saját fehérje ráfut a lapra
(`.con-ltab.on::after`). Ettől a fül és a kinyitott kártyája egy test, mint egy papír dosszié.

**Új fül: „Elérhetőségek és források"** — a kontakt-főkönyv és a portál-jelenlét kikerült a
szerkesztő kártyából a saját paneljébe (`leadContactsPanel`), mert **más kérdésre válaszol**:
nem azt, hogy *mit tartunk nyilván*, hanem hogy *honnan jött és mit dobott el a szűrő*.

**Emoji-csere:** a megkeresés-gombok `✉`/`📊` jelei lecserélve a saját SVG-készletre
(§B: emoji tilos) — új `mail` ikon a `src/ui/icons.ts`-ben.

## ⛔ A kapu jól mért — és elkapott

A `template-picker-check` **PIROSRA ment** a commitnál: a sablon-választó rejtett fülre került,
tehát a renderelt alapállapotban kattinthatatlan volt. Ez pontosan az az eset, amiért a kapu a
**viselkedést** méri, nem a jelölőt — egy markup-ellenőrzés ezt átengedte volna.

A javítás nem a kapu kikapcsolása volt, hanem a **valódi operátor-út** felvétele: a kapu most
rákattint a „Mock és generálás" fülre, plusz **külön állítja, hogy a fül tényleg megnyitja a
választót**. Az önteszt (`--self-test`) továbbra is 10 ponton piros a törött jelölőn.

## Verifikáció (nem feltételezés)

- **Valós DB-adat, valós CSS**: a konzol jelszóval védett, ezért a bevált `kb-shot.mts` mintát
  követve új eszköz készült — **`scripts/shot-lead.mts`** —, ami ugyanazt a `leadPage()`-et
  rendereli, a repó stíluslapjai mellé teszi, és lefotózza. 1280px **és 390px**.
- **Fül-viselkedés determinisztikusan mérve:** alapállapot (csak 1 panel), fül-kattintás +
  hash-szinkron, a szerver **régi horgonyai** (`#prospects` → Megkeresés, `#mock-artifacts` →
  Mock, `#ls-data` → Adatok), és **JS kikapcsolva → mind a 7 panel látszik** (semmi nem vész el).
- `tsc` zöld, mind a 8 pre-commit kapu zöld, `design-token-lint` zöld (nincs nyers szín).

## Módosított fájlok

- `src/console/views.ts` — identitás-sáv, `leadTabs()`, `leadContactsPanel()`, `initials()`, emoji-csere
- `src/ui/icons.ts` — új `mail` ikon
- `public/assets/ui/citui-console.css` — `.con-lhead*`, `.con-ltabs*`, `.con-tabp`, `.con-ib`;
  a régi `.con-lead-grid`/`.con-lead-head` réteg kivezetve
- `scripts/template-picker-check.mts` — a kapu a fül-útvonalon éri el a választót
- `scripts/shot-lead.mts` — ÚJ, a lead-oldal fotózása valós adatból (desktop + 390px)
- `_planning/DECISIONS.md` — ADR-0054

## Mellékesen kiderült

- A tulaj **telefonja (`of-s25`) aktív a Tailscale-en**; én először a 28 napja offline iPhone-t
  néztem és tévesen azt mondtam, hogy nem elérhető. A fix teszt-cím: `http://mineral:4600`
  (konzol) és `:4800` (publikus honlap) — mérve HTTP 200, systemd + health-timer tartja.
- ⚠️ **Nyitott, nem tőlünk származó lelet:** a gépen ÉL egy nyilvános Tailscale Funnel —
  `https://mineral.tail3a89f.ts.net` → `127.0.0.1:80` (jelenleg 403, valószínűleg MineREAL-maradék).
  Nem nyúltam hozzá. Érdemes tisztázni, mi ez és kell-e.

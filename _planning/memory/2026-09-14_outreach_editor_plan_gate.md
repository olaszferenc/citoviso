# 2026-09-14 — Megkeresés-szerkesztő (B6 / Elek FK-004): két javítás, nyolc lelet a terv-kapunál

**Szál:** `wt/megkeresesszerk` · **Forrás:** Elek FK-004 (2026-09-13-i teljes futás), 10 lelet.
**Landolva:** a két apró tétel. **Terv-kapunál vár:** a nyolc kinézeti lelet (`TERV-KESZ.md`).
**Élesítés:** nincs, és nem is kértem rá engedélyt.

## Amit szállítottam

### ① A belső fázis-kód feloldva — és kiderült, hogy az ŐR nem tévedett, csak MÁS SZÓRA figyelt

A Megkeresés-panel súgójában két hónapja ott állt: „a »Megjelölöm kiküldöttként« gomb **a
H1-tölcsér bázisa**”. Az operátornak ez semmit nem mond, és sehol nincs feloldva. A mondat most
azt írja le, amit a gomb TESZ: „innen indítja a mérést: ettől a ponttól számít a megnyitás, az
érdeklődés és a megrendelés”.

⛔⛔ **A tanulság nem a szöveg, hanem az őr.** Az `internal-ref-check` fázis-kód-mintája így szólt:
`\b[HA]\d-bázis\b` — vagyis egy **UTÓTAGRA** volt kihegyezve. Ugyanaz a fázis-kód, másik utótaggal
(`-tölcsér`), **némán átment** rajta. Ez pontosan a `frozen-claim-check` hibaosztálya (három szó
szerinti tű, mind zöld): a szólistára hangolt őr nem hamis — **más kérdésre válaszol**.

A minta most **SZERKEZETI**: fázis-betű + szám + kötőjel + szó
(`\b[HA]\d-(?!…)\p{L}+`), és a **KIVÉTEL** van kimondva, nem a szabály — a `H<n>`/`A<n>` alaknak
két jogos, nem-fázis jelentése él a felületen (SEO-`H1-címsor`, `A4-es` papír), ezekre az őr nem
sülhet el, különben a helyes szöveget kényszerítené átírásra.

**Piros próba a VALÓDI fán** (nem csak az önteszt-sztringen): a régi mondatot visszatéve az őrnek
buknia kell — bukik is, 1 találat, `src/console/views.ts:2145`. Önteszt: 11 pozitív + 11 negatív.

⚠️ Menet közben mérve: a renderelt réteg ezt amúgy sem láthatta volna — a mondat egy **csukott
`<details>`-ben** van, a scan pedig `document.body.innerText`-et olvas, ami a nem renderelt
tartalmat kihagyja. A ③ statikus iker fogta volna meg (a `views.ts` rajta van a scope-on) — ha a
minta stimmel. **Két réteg, egy vakfolt: a minta.**

### ② A visszafordíthatatlan „kiküldöttként” jelölés végre KÉRDEZ

A `POST /prospect/:id/sent` a LISTÁRÓL írta át az állapotot, megerősítés nélkül. A
`markProspectSent` `WHERE … IS NULL`-lal bélyegez, és a felületen nincs visszavonás: egy téves
kattintás **véglegesen** lezárja az e-mail csatornát ezen a megkeresésen — az **ADR-0122**
cím-szintű egyszer-küldése miatt a **CÍMRE** is, minden más követett linken. A lap két valódi
küldés-gombja eddig is kérdezett; ez az egy nem. Ugyanaz a minta, a **kattintás ELŐTT** kimondva
(nem visszautasító sávban).

Mérve 390 + 1280 px-en, a valódi lapon: a kérdés megjelenik, a szövege kimondja, hogy nem vonható
vissza, a MÉGSE tényleg megállítja a beküldést, a sor bélyegei utána változatlanok
(`created` / `sent_at=null` / `email_sent_at=null`), JS-hiba 0.

## Amit MÉRTEM (és a terv-kapunál vár)

A `/prospect/<id>/draft` lapon, valós leaden, Playwrighttal:

| | 1280 px | 390 px |
|---|---|---|
| a visszafordíthatatlan „Küldés e-mailben” gomb | y=375 | y=570 |
| a levél kezdete | y=1045 | y=2211 |
| **a gomb ennyivel a levél ELŐTT áll** | **670 px** | **1 641 px ≈ 2 telefon-képernyő** |

⛔⛔ **A `rows="22"` text-doboz ugyanazt a hibát ismétli, amit az iframe-en már javítottunk — és
az ŐR ZÖLDEN áll mellette.** Látható 445 px; **390 px-en a tartalom 61 %-a (702/1147 px) rejtve**,
és a rejtett rész pont a jogi vég: aláírás, leiratkozó-mondat, **leiratkozó URL**, hirdető-
azonosítás. **Asztali gépen is kiesik a „A megkeresés küldője: …” sor (§C.2).** Az
`outreach-preview-check` őr azért zöld, mert **csak az iframe-et méri** — nem téved, más kérdésre
válaszol (`feedback_gate_measured_text_not_its_source` rokona).

## Amit a mérésen kívül tanultam (infrastruktúra)

- ⛔ **A `land.sh` a végén `rm -rf`-eli az `assets/design-refs/_drafts/`-ot** (ADR-0077). A §2b
  viszont épp oda kéri a tervet, és a BRIEF szerint egy orchestrátor GYŰJTI BE a terveket egy
  későbbi körben. **A két doktrína itt ütközik** — a tervet a land előtt ki kell menteni
  (`/tmp/b6-plan-backup/`), és utána visszatenni, különben a kapunál várakozó terv eltűnik.
- ⛔ **Az `assets/Temp` symlink a FŐ FÁBA mutat**, tehát a §2b „munkafán belül” szabálya a
  KÉPEKRE is áll, nem csak a HTML-re — a `ui-shot.mts` viszont oda ír. A terv-képeket át kell
  másolni a `_drafts/` alá.
- ⛔ A `#prospects` panel **csukott fülön** él (`ls-outreach`); Playwrighttal a puszta
  `/lead/<id>` URL-en a gombok `w=0`, „element is not visible”. A `#prospects` hash kell hozzá —
  és az első mérésem `w=0` értékeit majdnem ténynek vettem.
- ⚠️ A `mock-photo-gate-check` a KÖZÖS `sites/`-be írja a fixture-jét: két párhuzamos futás
  ENOENT-tel állította meg a landomat (`pgrep -fc mock-photo-gate-check` = 2). Nem a kód volt
  piros. Ismert: `reference_shared_sites_fixture_race`.
- ⚠️ A tsx `keepNames` `__name`-et injektál, ezért a **függvény-értékű** `page.evaluate` friss
  böngésző-kontextusban `ReferenceError`-ral hal — a mérő-szkriptekben STRING-alakú evaluate kell.

## Nyitott — a tulaj döntése kell

`TERV-KESZ.md` (a munkafa gyökerében): 3+3 kattintható változat, 16 kép, 22 viselkedés-állítás.
Külön kérdésként a két **kódolt döntés**, amit a BRIEF tiltott javítani: a levélben a nyers
tokenes URL („bizalmi elem”), és az ár-doboz „-tól” vége ÁFA-jelölés nélkül + a szándékos
HTML/text eltérés (`p3`).

## Módosított fájlok

- `src/console/views.ts` — a súgó-mondat + a `/sent` űrlap megerősítése
- `scripts/internal-ref-check.mts` — szerkezeti fázis-kód-minta + 4 új önteszt-állítás
- `src/i18n/catalog.json` — az új T()-kulcs
- `TERV-KESZ.md` (nem commitolt, a szál gyökerében) + `assets/design-refs/_drafts/` (gitignore-olt)

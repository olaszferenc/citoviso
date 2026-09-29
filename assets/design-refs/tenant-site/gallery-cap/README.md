# KONTRAKTUS — a galéria minden fotót elérhetővé tesz (arch-frames · wordmark-grow · organic · claymorphism)

**Jóváhagyta:** a tulaj, 2026-09-29 (§2b terv-jóváhagyási kapu; a koordináló session szó szerint hozta) ·
**Változatok:** arch-frames **B — Lapozható ív-sáv** (külön körben: „lapozható ív sáv”), wordmark-grow **A — Kártyapakli**, organic **C — Lapozható blob-sáv**, claymorphism **C — 4 kártya + helyben kinyíló galéria** ·
**Terv:** `plan-arch-frames.html`, `plan-wordmark-grow.html`, `plan-organic.html`, `plan-claymorphism.html` (önhordó, kattintható; fülek: „Ma” + a jóváhagyott változat; „Mobil 390px / Asztali” váltó) ·
**Képek:** `B-arch-frames-{asztali,mobil}.png`, `A-wordmark-grow-{asztali,mobil}.png`, `C-organic-{asztali,mobil}.png`, `C-claymorphism-{asztali,mobil}[-kinyitva].png`
**Hatókör:** `src/engine/templateKit.ts` · `src/engine/templates/archFrames.ts` · `src/engine/templates/wordmarkGrow.ts` · `src/engine/templates/organic.ts` · `src/engine/templates/claymorphism.ts` · `assets/runtime/cit-runtime.js` · `assets/runtime/cit-modules.css`

⚠️ **Ez a fájl a megvalósítás SZERZŐDÉSE, nem stílus-javaslat.** A kódot ehhez mérjük.

## Miért

2026-09-28-i mérés: 6 feltöltött fotóból az organic és a claymorphism 4-et mutatott (`slice(0, 4)`),
a wordmark-grow 3-at (3 képhely). Az élő Kemences Vendégház (wordmark-grow, 12 fotó) vendége 3 fotót
látott, a belső képeket (#10–#12) egyiket sem. A tulaj fizet a Képek modulért és feltölt (a könyvtár 24-ig
enged) — a vendég a képei egy részét soha nem látta, a nagyítóban sem (az csak a galéria-slot képein lapoz).
A tulaj: „Ez egy nagy hiba, de látni kell mit okoz a mockbann”.

## KÖT — mind a négy sablonon

1. **Minden fotó elérhető a galériából.** A galéria-slot (`data-cit-module="gallery"`) MINDEN fotót
   `<img>`-ként tartalmaz; a közös nagyító (runtime `mountGallery`) így mindet végiglapozza.
2. **A galéria a még nem látott képekkel indul** (tulaj: „a még nem látott képekkel induljon a galéria”):
   előbb a lap többi ÁLLANDÓ szakaszán (hős, történet, szobák, kapcsolat…) nem szereplő fotók, a tulaj
   sorrendjében; a már látottak a végére. Forrás: `galleryOrder()` (`templateKit.ts`), a szakaszok
   markupjából — nem fix indexekből. A `<head>` (JSON-LD) és a wordmark-grow egyszeri nyitó-animációja
   nem számít „látottnak”.
3. **A nyitókép marad a `photos[0]`** (tulaj, korábbi döntés) — ezt a kontraktus nem érinti.
4. **Nincs új szöveg a tulajnak/vendégnek, csak ami jóvá lett hagyva:** **„Összes fotó ({n})”** ·
   **„Kevesebb fotó”** (claymorphism); a lapozó „1 / N” számláló (szám, nem szöveg); a nyilak
   akadálymentes neve a meglévő „Előző kép” / „Következő kép”.
5. **JS nélkül is minden fotó elérhető** (§B no-JS): a sáv és a pakli natív, ujjal húzható sor, a
   lapozó rejtve; a claymorphism mind a 12 kártyát mutatja, a gomb rejtve. A runtime a `data-on`
   attribútummal kapcsolja be a JS-es viselkedést.

## arch-frames — B · Lapozható ív-sáv (KÖT)

- **Új szakasz** a széles képsáv UTÁN (a sablonnak eddig nem volt galériája): cím **„Képek a portáról”**,
  alatta **egy sornyi, vízszintesen húzható ív-keretes** kép (a sablon ívei), asztalin nyilakkal is,
  „1 / N” számlálóval; az elején a „‹”, a sáv végén a „›” tiltott.
- Ív-szélesség: asztalin ~250 px, mobilon a képernyő ~62%-a (a következő ív kilóg → jelzi, hogy húzható).
- A galéria-horog (`data-cit-module="gallery"`) ERRE a szakaszra kerül: az „A ház” felszereltség-szakasz
  eddig viselte, egy képpel — Képek modul nélkül így a felszereltség-lista marad, és a sáv tűnik el.

## wordmark-grow — A · Kártyapakli (KÖT)

- A „Képek” szakasz egyetlen kártyája helyén **pakli**: a legfelső kártya mögött **legfeljebb kettő**
  kilóg (eltolva, enyhén elforgatva), a többi rejtve.
- Alatta lapozó: **‹ · „1 / 12” · ›**; a nyilak körbe lapoznak (a 12. után az 1.).
- A legfelső kártyára koppintva a nagyító **azon a képen** nyílik.
- A szakasz szövege (cím, mondat) és elrendezése (kép jobbra, mobilon fölül) a mai marad.

## organic — C · Lapozható blob-sáv (KÖT)

- A 4-es blob-rács helyén **egy sornyi, vízszintesen húzható sáv**, a sablon blob-formáival;
  asztalin nyilakkal is lapozható, „1 / N” számlálóval; az első elemnél a „‹” tiltott, a sáv
  végén a „›”.
- Kártya-szélesség: asztalin ~270 px, mobilon a képernyő ~68%-a (a következő kép kilóg → jelzi, hogy húzható).

## claymorphism — C · 4 kártya + „Összes fotó (12)” (KÖT)

- Alapból **4 agyag-kártya** (asztalin 1 sor × 4, mobilon 2 × 2), alatta agyag-gomb: **„Összes fotó ({n})”**.
- Megnyomva **HELYBEN** kinyílik a többi (nem felugró ablak), a felirat **„Kevesebb fotó”** lesz;
  újra megnyomva összecsukódik, és a szakasz tetejére görget.
- 4 vagy kevesebb fotónál nincs gomb.
- A kártya a terv szerinti négyzet, lekerekített agyag-árnyékkal.

## Reprodukció

A terv a valódi Kemences Vendégház (12 fotó) élő renderjéből épült:
`GV_PLAN=1 npx tsx elek/runs/galeria-korlat/mock-build.mts` — a generátor a döntési anyaggal együtt a
`wt/cit93b120b2` munkafa `elek/runs/galeria-korlat/` mappájában készült (gitignore-olt, NEM a repó része);
a terv ettől függetlenül önhordó.

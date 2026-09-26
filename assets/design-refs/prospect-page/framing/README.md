# Kontraktus — a kiküldött mock-lap KERETEZÉSE (jóváhagyva 2026-09-14)

Tulaj-döntés: **„A” változat — diszkrét felső sáv.** A B (nyitókártya) és a C (jelvény +
lebegő fiók) elvetve. A `plan.html` a jóváhagyott, **működő** terv (méret-váltóval és az
ár-tábla-kapcsolóval; az ár-tábla döntése **KÜLÖN jön** — ez a kontraktus nem köti).

Tulajdonosi megfogalmazás, szó szerint:

> „A látogató az **ELSŐ pixeltől** tudja, mit néz: honlap-terv az ő szállásáról, a Citoviso
> készítette a nyilvános adataiból, és **még nem élő oldal** — a jogi részlet egy kattintásra
> nyílik. Kövesd a ma is létező »leiratkozott«-sáv mintáját. A sáv **MINDEN látogatónak**
> szóljon, ne csak a leiratkozottnak.”

**Miért kellett:** ma a magyarázat a lap **ALJÁN** van (`prospectNotice.ts` →
`appendToBody`), felső sávot pedig **csak a leiratkozott** kap. Aki először nyit rá a levélből,
egy idegen weboldalt lát a saját szállásáról, magyarázat nélkül. Ez az első és sokszor egyetlen
képernyő, amit a leendő vevő lát.

Képek: `plan-mobil.jpg` (390 px) · `plan-asztali.jpg` (1440 px) · `plan-mobil-nyitva.jpg`
(a „Miért kaptam?” kinyitva).

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **MINDEN látogató kapja.** A `/p/<token>` **követett** ágán is megy a sáv, nem csak a
   leiratkozotton. A leiratkozott továbbra is a **saját**, más szövegű sávját kapja
   (ADR-0112: „nem keressük többé, és ezt a megtekintést nem rögzítjük”) — **soha nem
   kettőt egyszerre**.

2. **A lap TETEJÉN, a folyamban.** A sáv a `<body>` első eleme, **lenyomja** a lapot (nem
   ráúszik, nem ragad): a lap minden más tartalma alatta kezdődik. Görgetéskor elmehet.

3. **Három állítás, mielőtt a látogató bármit tesz:**
   - **MI EZ** — honlap-terv az ő szállásáról, **még nem élő oldal**;
   - **KITŐL** — a hirdető neve a configból (`outreachSender`); ⛔ üres confignál **nem
     találunk ki nevet** (§B.17), akkor a mondat elmarad;
   - **MIÉRT KAPTA** — jogos érdekű megkeresés (Grt. 6. § / GDPR 6. cikk (1) f)).
   Az első kettő **azonnal látszik**; a harmadik lehet egy kattintásra.

4. **„Miért kaptam?” HELYBEN nyílik — és JS NÉLKÜL is működik.** A kinyitható rész natív
   `<details>/<summary>`, nem szkriptelt kapcsoló: a mock egy idegen böngészőben nyílik meg,
   és a jogi részlet nem múlhat egy betöltött JS-en. A `<summary>` gombként viselkedik
   (billentyűvel elérhető, az állapota gépileg olvasható).

5. **A kinyitott rész viszi az Adatkezelési tájékoztató és a Leiratkozás linkjét** — hogy a
   kiút a lap tetejéről is elérhető legyen, ne csak az aljáról.

6. **A lap alji jogi lábazat MARAD** (ADR-0112: a leiratkozás a lap **legalján** érhető el, és
   alatta a mockból semmi nem jön). A sáv **nem váltja ki**, és nem is tolja ki.
   ⛔ **A két hely NEM két igazság:** a mondatok **EGY forrásból** származnak a kódban
   (megosztott konstansok), nem két külön leírt bekezdésből.

7. **Skin-független.** Az engine-renderelt mock nem tölti be a `citui.css`-t, tehát a
   `--citui-*` tokenek nem oldódnának fel. A sáv a mai lábazat **ugyanazt a két semleges
   szürkéjét** viszi (`#101216` / `#8a8f98` + `#e8e9ec`), a linkjei **mért** kontraszttal
   (≥ 4,5:1) — 19 sablonon kell olvashatónak lennie.

8. **A sablon CSS-e nem veheti el a helyét.** A sáv nem veszhet el egy `position:absolute;
   top:0` navigáció vagy egy `body>*{position:relative}` szabály alatt
   (`reference_injected_overlay_loses_to_template_css`, ADR-0147). Ezt **mérni kell**, nem
   feltételezni.

9. **A vásárlási belépőt nem takarja** (a lebegő konfigurátor-pill) — és fordítva sem.

10. **NINCS NYITÓ-ANIMÁCIÓ A KIKÜLDÖTT MOCKON** (tulajdonosi döntés, 2026-09-14 — az
    eredeti terv nyitott pontja lezárva). Két sablon teljes képernyős ADR-0115 introval
    indul: `arch-frames` (`.cit-fintro`, ~4,7 mp) és `wordmark-grow` (`.cit-intro`,
    6 mp-nél még futott). A `/p/<token>` lapon **mindkettő ki van kapcsolva**, mert a
    keretezés épp az első képernyőn a dolga, és az overlay alatt az sem látszott.
    A kikapcsolásnak **két fele van, és mindkettő kell**:
    - `data-cit-no-intro` a `<html>`-en — a mozgás-réteg SAJÁT kapcsolója, így a lap
      soha nem záródik le (`overflow:hidden`);
    - egy `<style>` a válaszban — a JS-nélküli látogatóért **és a RÉGI artefaktumokért**
      (a lap egy hetekkel korábban rendelt fájlból jön, tehát az AKKORI no-JS hálót
      viszi; a `runtime.ts` mai javítása egy lemezen lévő mockon nem segít).
    ⚠️ A `runtime.ts` `<noscript>` hálója ettől függetlenül is javítva lett: JS nélkül a
    két intro **teljes képernyős üres panelt** adott (mérve, 390 px) — az élő tenant-lapon
    is. Ez hibajavítás, nem tervezői döntés.

---

## Az ŐR, ami ezt kikényszeríti

`scripts/prospect-framing-check.mts` — a **RENDERELT** lapon mér (renderSite → injectRuntime →
injectConfigurator → a keretezés), **több sablonon**, **mindkét szélességen**, a nyitó-animáció
lefutása után:

- a sáv létezik, **látszik**, teljes szélességű, és a **teteje y=0**;
- **semmi nem fest rá**: a sáv rácspontjain az `elementFromPoint` a sávot (vagy a gyerekét)
  adja vissza — geometria, nem a sáv saját véleménye a helyéről;
- a lap **minden** más eleme a sáv alatt kezdődik;
- a `<details>` **JS nélkül** nyílik, és a kinyitott rész viszi a két linket;
- a linkek kontrasztja **mérve** ≥ 4,5:1;
- **a követett ág kapja a sávot**, a leiratkozott a **sajátját** — és soha nem mind a kettőt;
- **álpozitív kontroll:** a követett sáv nem állíthatja azt, amit a leiratkozotté, és fordítva;
- **piros önteszt** minden ágra (a sáv kivágva · a `<details>` `<div>`-re cserélve · a sáv a
  lap ALJÁRA téve · a linkek alap-kékkel).

---

## Kiegészítés — 2026-09-26: tömör első képernyő telefonon (B változat)

A fenti 1–10. pont VÁLTOZATLANUL köt. Ami rájuk épült (tulajdonosi mandátum, Elek FK-009 után —
a részletek és a képek: `../first-screen-compact/README.md`):

- a sáv telefonon (≤ 560 px) **legfeljebb 90 px** (mérve 77): a KITŐL-mondat rövidebb — „Készítette:
  X. Ez még nem élő oldal." —, az „ingyen, az Ön nyilvánosan elérhető adataiból" tagmondat a
  „Miért kaptam?" részleteibe kerül (ott ugyanez áll); asztalon **egy sor**;
- a „Miért kaptam?" saját ▸/▾ jelölőt visel (az érintési célhoz kellő `inline-block` a natív
  jelölőt eltünteti), érintési célja ≥ 24 px;
- a süti-kérdés a követett és a leiratkozott ágon az első görgetésig/érintésig vár
  (`data-cit-consent-defer`) — a 9. pont („a vásárlási belépőt nem takarja") ezért kapott mérést a
  sáv KÉSŐBBI megjelenésére is: a pirula alapja a sáv nélkül mérődik, a sáv élő magasságát
  hozzáadja.

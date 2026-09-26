# Név-masthead TELEFONON — a kontraktus kiegészítése (2026-09-26, „C” változat)

*Tulajdonosi mandátum (a szülő sessionen át, 2026-09-26): „Javaslat szerint hajtsák végre a saját
belátásuk szerint legjobb ergonómiai szempontból a talált tételek javítását … majd utólag ellenőrzök.”
A §2b „megállsz és vársz” lépés erre a körre feloldva: a változatot a fejlesztő-session választotta
ergonómiai alapon, a tulaj a KÉSZ felületen ítél. Ez a megvalósítás KONTRAKTUSA — a 2026-08-30-i
név-masthead kontraktus (`../README.md`) 1–4. pontja VÁLTOZATLANUL él, ez az 5. (mobil) pont
kifejtése és pontosítása.*

**Mit old meg:** Elek FK-009 (a kiküldött terv első megnyitása telefonon, 19 stílus × 2 lead) V2 lelete:
a masthead 390 px-en mind a 14 sablonban ugyanaz a ~150–200 px-es blokk (név → vonal–helység–vonal →
vonal–FOGLALÁS–vonal), ettől a 19 stílus „ugyanannak a lapnak” tűnik, a főcím és a fotó lejjebb csúszik;
ugyanazon a képernyőn a „Foglalás” háromszor szerepelt (masthead-sáv, hero-gomb, rögzített alsó sáv).
Plusz: a rögzített Foglalás-sáv felirata („4,3 · Google-értékelés · 30 vélemény”) 2–3 sorra tört
(transit: 99 px-es sáv).

**Három változat készült a VALÓDI motorból** (`build.mts` → `_drafts/masthead-phone/plan.html`, 5 sablon:
fullbleed, dark-luxury (overlay), transit, artdeco, brutalism (flow), Laguna Panzió persistált
inputjaiból; iframe-cellák, hogy a sablon saját `@media` szabályai a cella szélességére süljenek el):

| 390 px, masthead magassága | A · mai | B · pirula-csík | **C · sáv nélkül + levegő** |
|---|---|---|---|
| fullbleed (overlay) | 148 | 125 | **69** |
| dark-luxury (overlay) | 148 | 126 | **70** |
| transit (flow) | 171 | 148 | **96** |
| brutalism (flow) | 155 | 136 | **84** |
| artdeco (flow, akkor még sáv nélkül) | 155 | 140 | 140 → a végleges motorban **88–117** (saját sávot kapott) |
| asztalon (1280) | azonos | azonos | **azonos** (pixelre: artdeco 0 eltérő px; geometria 6/6 sablonon egyező) |

Kattintható terv: `plan.html` (A/B/C + méret-váltó; a cellákat a `build.mts` állítja elő a `_drafts/masthead-phone/` alá —
futtasd, ha a vázlat-mappa már törlődött). Képek: `shots/390-<sablon>-A.jpg` (mai) és `-C.jpg` (választott), `shots/1280-*-C.jpg` (asztal, változatlan),
`shots/motor-390-tihany-*.jpg` (a VÉGLEGES motor a valódi Tihany-mockokon, fotóval).

**Választás: C.** Indok: a telefonon a CTA a rögzített alsó sávban ÉL (minden masthead-es sablonban), a
masthead-sáv ugyanazt a gombot ismételte; a léniák a fotós fejlécben két vonalat húztak a képre, ahol a
névnek és a fotónak kellene lélegeznie; a nyert 70–100 px a hajtás fölé hozza a főcímet (transit 256 →
181 px, brutalism 276 → 205, watercolor 305 → 220) vagy a fotót (overlay). A B a tartalék: ha egy sablon
telefonon NEM visel rögzített sávot, a link-sáv a sablon alakját viselő pirulává csuklik (`--mast-chip`).

---

## Amit a terv KÖT (elvárt viselkedés, nem stílus-javaslat)

1. **A szerkezet közös marad** (2026-08-30 kontraktus 1. pont): név → helység-alsor → link-sáv; a
   telefonos alak ugyanabból a markupból, CSS-sel áll elő (`mastheadCss()`, `@media (max-width:720px),
   (max-height:500px)` — a **tartás nem szélesség**: fekvő telefonon (844×390) is a tömör alak él).
2. **Telefonon a masthead ≤ 150 px** (mérve 62–128 px a 14 sablonon, 390-en és fekvőn). Őr:
   `guest-mobile-check` ②fejléc-blokk (HIBA), negatív kontroll: 200 px-es padding → piros.
3. **Ahol a sablon telefonon rögzített Foglalás-sávot visel** (`mastheadHtml(..., { phoneBar: true })` →
   `data-cit-mast-bar`), **a link-sáv nem jelenik meg** — a CTA a sávban él, az első képernyőn egy
   „Foglalás” gomb van a sávban + a hero saját gombja. Ma mind a 14 masthead-es sablon ilyen (artdeco
   és claymorphism 2026-09-26-tól kapott sávot: `.ad-mobcta`, `.cl-mobcta`).
4. **Ahol nincs sáv:** a link-sávból CSAK a „Foglalás” marad, pirulaként (≥ 44 px, `--mast-chip` a
   sablon alakja: 999px / 0 / 2px), vonalak nélkül, 8 px-re a helység-sor alatt.
5. **Overlay (fotós) fejléc telefonon:** a helység-sor léniái eltűnnek, a felső levegő 18 px; **flow
   (szolid) fejléc:** a léniák maradnak (ez a dialektus), a felső levegő 22 px (`--mast-pad-m`-mel
   felülírható). A név 26 px, a helység 10 px / 3 px ritkítás.
6. **A rögzített Foglalás-sáv szövege EGY szerkezet minden sablonban** (`mobCtaStat()` +
   `MOBCTA_CSS`, templateKit): az érték nagyban (17 px, csillag-ikon), a felirat alatta kicsiben
   (12 px) EGY sorban, ellipszissel — soha nem törik 2–3 sorra. Őr: ⑤sáv-felirat (HIBA), negatív
   kontroll: `white-space:normal` → piros. A sáv 64–75 px (volt 64–99).
7. **Asztalon (> 720 px, > 500 px magas) semmi nem változik** — a 2026-08-30 lockup pixelre az.
8. Feliratok `T()`-vel, színek csak `--cit-*` / `--mast-*` tokenből.

Landolt: `src/engine/templateKit.ts` (`mastheadHtml` `phoneBar`, `mastheadCss` telefonos blokk,
`mobCtaStat`, `MOBCTA_CSS`), a 14 masthead-es sablon (`phoneBar: true`, közös sáv-felirat; artdeco +
claymorphism új sáv), `scripts/guest-mobile-check.mts` (②fejléc-blokk, ⑤sáv-felirat + 2 negatív
kontroll). ADR: `ADR-0237` (a telefonos fejléc és a Foglalás-sáv a mock-motorban).

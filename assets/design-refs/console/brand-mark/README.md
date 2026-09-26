# Citoviso márkajel — jóváhagyott terv (E4)

**Jóváhagyva:** 2026-09-21, tulajdonosi döntés (§2b terv-kapu).
**Assetek:** `assets/brand/mark-e4-dark.svg` (sötét háttér) · `assets/brand/mark-e4-light.svg` (világos háttér).

## Mit KÖT ez a terv (nem stílus-javaslat)

1. **A sötét fejlécben a márkajel van, nem helyettesítő.** ⛔ A `/pay/done` lap 2026-09-21-ig egy
   CSS-ből rajzolt karikát mutatott (`views.ts` `.pd-brand__mark`: 22 px kör,
   `border-right-color:transparent`), amiből **hiányzott a szem és a play-háromszög**. A jel közepe
   mérve **1,06 kontraszt** — vagyis üres. Ez volt a bejelentett „nem látszik jól".
2. **Sötét háttéren a szem VILÁGOS.** A navy pupilla (`#16283f`) a navy fejlécen mérve **1,44**
   kontraszt. A jóváhagyott E4 szem-kontrasztja **5,85**. ⛔ Fehér halo NEM megoldás: mérve
   utána is 1,44 — a glória a kontúrt emeli, a jel közepét nem.
3. **A play-háromszög a C SZÁJÁNÁL áll, nem a szemhez tapadva.** Rés a szem szélétől **21,5**
   rajz-egység; a play bal széle a C nyílásához képest **−2,6** (a korábbi rajzban −14,6 volt, és
   a tulaj ezt kifogásolta: „a play beljebb került a szemben, mint az eredeti logóban").
4. **A C-ív CIÁN** (`#1fb6d6`) mindkét háttéren — tulajdonosi döntés („a C körvonala is kék").
   A 2026-07-07-es `mark-gradient.svg` navy íve ezzel felülírva.
5. **Egy identitás.** Ugyanez a jel megy a számlára (Számlázz.hu), a fejlécbe és a favikonra.
   ⚠️ Az elrendezés 2026-09-23 óta „jel = C + itoviso” (nem „jel + Citoviso”) — lásd a lenti kiegészítést.
   A világos és a sötét változat geometriája bitre azonos; csak a szem gradiense és a play
   színe tér el.

## Geometria (viewBox 120×120) — ez a kontraktus

| elem | érték |
|---|---|
| C-ív | `M84.6 29.3 A42 42 0 1 0 84.6 90.7`, `stroke-width:12`, `linecap:round` |
| a C szája | x = 84,6 |
| szem | `cx=48 cy=60 r=12.5` |
| csillanás | `cx=42.5 cy=54 r=3.5` |
| play | `M82 49 L82 71 L102 60 Z` |

## Mihez mértük

Vázlat: `assets/design-refs/_drafts/brand-mark-variants.html` (A–G) és `brand-e-play.html`
(E1–E4). A kontrasztok a VALÓDI renderből mérve, 22 px-es jelen, a `/pay/done` gradiensén —
nem tokenből számolva.

---

# Kiegészítés 2026-09-26 — a „B” lockup mindenhol (ADR-XXXX)

**Jóváhagyva:** 2026-09-26, tulaj: *„B, admin ikon marad, szállás-honlapoknál maradjon így”*.
**Terv (befagyott):** `lockup-b-helyszinek.html` (önhordó, A/B + Mobil/Asztali váltó — a jóváhagyott a **B**),
`lockup-b-desktop.png`, `lockup-b-mobile-1.png`, `lockup-b-mobile-2.png`.

## Mit KÖT (elvárt viselkedés)

1. **A jel MAGA a C betű**, utána „itoviso” (nem „Citoviso”). Akadálymentes név: „Citoviso”.
2. **Arány „B”:** a jel magassága 1,6× a betűméret, a szó függőlegesen középre áll (a `/pay/*` 34/21 px-e).
3. **Változat a háttér szerint:** sötét → `mark-e4-dark` + fehér szó; világos → `mark-e4-light` + navy szó;
   témás keret → a `data-citui-theme` szerint. A szó színe akkor is ez, ha a lockup link (a felület link-szabálya NEM festheti át).
4. **Helyszínek:** konzol oldalsáv + telefonos menü + belépő + sima lapok · ügyfél-belépő lapok · citoviso.com fejléc
   és lábléc · `/pay/*` · levelek (PNG) · számla (PNG, a tulaj tölti fel).
5. **Tulaj-admin keret:** a jel önálló IKON (a szállás neve mellett nem lehet C betű).
6. **Favikon:** csak a jel, a VILÁGOS változat, mindenhol (konzol, admin, citoviso.com, és a szállás-honlapok, ha nincs saját).
7. **Egy forrás:** `src/ui/brand.ts` a két asset-fájlból; őr: `scripts/brand-mark-check.mts`.
8. **Az inline kivágás** `7.5 12 95 96` — a C-ív középpontja x≈55,94, a bal széle 7,94-nél van (a 12-es kivágás levágta).

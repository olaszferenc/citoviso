# 2026-11-26 éjjel — Első szabály-kör ADR-0495 után (tulaj + mintavételes kolléga jelzéseiből)

Session `cit96bd8170`. Kolléga: `CIT ➕ 🔴 SUB Minőségi kolléga (minta)` (`cit4155cc10`).

## Jelzések → szabály (ADR-XXXX)
- Tulaj: „szinte minden parallax default színkombináció / mind ugyanaz” → mérve: 734 aktuális mock, 0 saját akcent, 3 skin egyenletesen; ok: a sablon-recept út nem ad `palette.accent`-et → helyi fotó-akcent (`photoAccent.ts`, a Telefon fa vázlata átvéve), generálásban és frissítésben.
- Tulaj: Lila Central — 2 kártyás MINTA „Amit kínálunk” + 190 px lyuk → ≥4 tétel szabály; render-kapu `gap` (260 px).
- Tulaj: Monos — H1/Nálunk/sáv háromszor ugyanaz → `textOverlap`, renderkor a későbbi kiesik; kapu `repeat` szövegre.
- Kolléga ⚑: településkép a galéria élén „Fotók az apartmanról” címmel → semleges „Galéria” saját fotó nélkül.
- Kolléga ⚑: „2021. aug. 13.” sávképen → DATE_RE hónapnevekkel.
- Kolléga: f8412d4e sáv = galéria 1. (booked.hu OriginalPhoto vs Big, más aldomain) → `sizelessPhotoKey` regisztrálható domain + több méretszó; kapu is.
- Render-kapu v14, pecsét qafix7; a frissítő a településképes mockokat is viszi.

## Mérés (dev, kalibráció)
- `textOverlap`: Monos 1,00; „Légkondicionált szobák ↔ Légkondicionálás minden szobában” 1,00; „Csendes kert… ↔ …kertben” 0,33 (nem ismétlés); „Nézzen körül ↔ Egy pillantásra” 0.
- Akcent: Villa Dalmatino #0b7b8a, Tonkita #486283, Palma #5daeda (tengerparti kék), 0,4–0,6 s / mock.

## Nyitott
- Vak minta élesen a deploy után (`gate-blind-sample.mts --n 20`), arány ide.
- A kolléga következő ⚑-jai → következő csomag.

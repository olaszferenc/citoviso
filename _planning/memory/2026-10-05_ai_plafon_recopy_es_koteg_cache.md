# 2026-10-05 — AI-plafon utómunka: a recopy hozzáad + lépcsőzött sablon-köteg (SUB)

Koordinátor: 37505a1d (Neo-koordinálás). Brief: `~/rc-briefs/ai-plafon-recopy-cache-20261005.md`.
Előzmény: `2026-10-04_ai_koltsegplafon_es_prompt_cache.md` „Nyitott / következő” (a) és (b) pontja.

## Elvégezve
- **(a) A recopy HOZZÁADJA a költségét** (`edd2fa22`): `addRunToArtifactUsage()` (`src/ai/usage.ts`)
  — a totálok összeadódnak, a recopy lépései `recopy:<lépés>` kulcson külön látszanak (konzol-hover),
  és minden futás dátummal az `aiUsage.runs` listába kerül (`generate` | `recopy`). A napi összeg
  (`mockSpendToday` → `rowSpendTodaySql`; a konzol `aiSpend` ugyanezt olvassa) a MAI futásokat
  összegzi: tegnapi mock mai recopy-ja mai költés, a mai generálás a recopy után is megmarad.
  Régi sor (runs nélkül) = generálás a `generated_at` napján; mérő előtti sor = 0.
  Őr: `ai-daily-cap-check` ④ (összeadás, lépésbontás, a VALÓDI SQL fixture-sorokon DB-írás nélkül,
  recopy-bekötés; mutációval igazolva).
- **(b) Lépcsőzött köteg** (`02ba4ad6`): `src/console/staggeredBatch.ts` `runStaggered()` — az
  1. sablon egyedül fut a „copy” szakasz végéig (brief + őrök = a cache-író hívások), a többi a
  „render”-nél indul. Sosem akaszt: a vezető bukása / 180 s időkorlát is elengedi a követőket.
  Őr: `scripts/batch-stagger-check.mts` (pre-commitba kötve, mutációval igazolva). Az
  `ai-daily-cap-check` útvonal-ablaka 2000 → 4000 karakter (a hívás a komment mögé csúszott).
- **(c)** változatlan (tulaj elfogadta): párhuzamos köteg átlépheti a plafont.

## Mérés (dev, lead 1ceb02b5, fullbleed + parallax, a két futás között 6,5 perc a cache-TTL miatt)
| | 1. tag | 2. tag | köteg | $/mock | falióra |
|---|---|---|---|---|---|
| előtte (párhuzamos) | $0.4234 (cw 25 182) | $0.4562 (cr 42 873 · cw 17 932, 11 hívás) | $0.880 | $0.440 | 149 s |
| utána (lépcsőzött) | $0.4140 (cw 25 139) | $0.2650 (cr 42 735 · cw 1 385, 9 hívás) | $0.679 | $0.340 | 208 s |

- A 2. tag −42% (ennek egy része a hívásszám-különbség — előtte egy marketing-újragenerálás, 11 vs 9
  hívás —; a tiszta hatás a cache-írás 17,9k → 1,4k token). Köteg: −23% ($/mock 0.44 → 0.34);
  3+ sablonnál a megtakarítás arányosan nő. Ára: kb. +60 s falióra (a követők az 1. „copy” után indulnak).
- A mérés költsége: ~$1.56 (2 köteg), a dev napi plafon alatt.

## Nyitott
- Élesre csak a nagy deployjal (tulaj).
- A dev konzol-szervert nem indítottam újra — a lépcső a fő fa következő frissítésével él.

## Fájlok
`src/ai/usage.ts` · `src/ai/dailyCap.ts` · `src/generator/recopy.ts` · `src/console/staggeredBatch.ts` (új) ·
`src/console/server.ts` · `scripts/ai-daily-cap-check.mts` · `scripts/batch-stagger-check.mts` (új) · `hooks/pre-commit`

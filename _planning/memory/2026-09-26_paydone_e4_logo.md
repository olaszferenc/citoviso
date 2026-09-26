# 2026-09-26 — E4 logó a fizetési lapok (/pay/*) sötét fejlécében

**Kiváltó (tulaj, képernyőkép a /pay/done-ról):** „itt még mindig a rossz logo van!”

## Mi volt a baj
A 2026-09-21-es E4 jóváhagyás (`assets/design-refs/console/brand-mark/README.md` 1. pont)
kifejezetten ezt a helyet nevezte meg, de kódsor nem változott: a `.pd-brand__mark` továbbra is
a CSS-ből rajzolt 22 px-es karika volt (se szem, se play) + „Citoviso”.

## Elvégezve
- `src/console/views.ts` `payBrand()`: a jel a jóváhagyott `assets/brand/mark-e4-dark.svg`
  MAGA (nem újrarajzolva), data: URI-ként — a lap szándékosan nem függ második kéréstől.
- Lockup a levelekével azonos (ADR-0225): a jel a „C”, utána fehér „itoviso”. Asset-hiány
  esetén a szöveges „Citoviso” a tartalék.
- ui-shot 390 px + asztali, megnézve; a tulaj a képeken jóváhagyta (surface-gate approve).

## Módosított fájlok
`src/console/views.ts` · `MEMORY.md` · ez a jegyzet

## Nyitott
- A konzol fejléce (`BRAND`, `LOGO_MARK`), a tulaj-admin fejléce és a favikon
  (`mark-gradient.svg`) még a régi jel — `~/rc-briefs/logo-c-lockup-brief.md`; a C-méret
  (A: betűméret / B: ikonméret) tulaj-döntése nyitott.
- Nincs élesítve (a nagy deployjal megy).

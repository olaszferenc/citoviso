# 2026-11-23 — HR jogi csomag: horvát jogra honosított tervezet (kikapcsolva)

**Session:** `cit2efb4736` (SUB), koordinátor `cit9b4690e3`, brief `~/rc-briefs/hr-jogi-csomag-tervezet-20261123.md`.
**ADR:** ADR-XXXX „HR jogi variáns tervezet” (JAVASLAT). **Élesen:** semmi.

## Elvégzett munka
- Leltár: a mai HR csomag 227 forrás-egységéből 53 tartalmaz magyar-specifikus jogi elemet; ebből 18 cserére javasolt,
  a többi magyar marad (Citoviso saját könyvelése/megőrzése, Barion-adatok, saját adatai) vagy áfa-kérdés.
  Csomagon kívül 6 hely nevez magyar jogot (lásd ADR „Nyitott”).
- Megfeleltetési tábla + egységenkénti ma/javaslat összevetés: `assets/design-refs/_drafts/hr-jogi/index.html`
  (tartós másolat és generátor: `~/rc-briefs/hr-jogi-csomag-20261123/`).
- `src/legalVariantHR.ts` — forrás-variáns (hu → variant, magyarul), források URL+dátummal, 8 ügyvédi kérdés,
  `keepsHu` (5) és `prerequisite` (1: ZZP 81.a elállási funkció). Senki nem importálja.
- `scripts/legal-variant-hr-check.mts` — őr ①–⑥ + `--export` Bábel-munkalap.
- Bábel-jegy: `~/rc-briefs/babel-hr-jogi-variant-20261123.md` + `.json` (18 egység).

## Módosított / létrehozott fájlok
- `src/legalVariantHR.ts`, `scripts/legal-variant-hr-check.mts`, `_planning/decisions/XXXX-hr-jogi-variant-tervezet.md`,
  `MEMORY.md`, ez a jegyzet.

## Nyitott
- 8 ügyvédi kérdés (elállás előfizetésnél, elállás-gomb, hideg megkeresés magánszemélynek, fogyasztói minőség,
  irányadó jog/nyelv, vitarendező testület, áfa, szállás-impresszum kötelező mezői).
- Bekapcsolás jóváhagyás után külön landban (ADR ④).

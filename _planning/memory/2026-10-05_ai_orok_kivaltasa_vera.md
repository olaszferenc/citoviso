# 2026-10-05 — A 3 AI-őr kiváltása Vera-ítélettel (kurátori + kézi szöveg)

**Szál:** SUB-lánc `wt/cit357d058b` (két átadással), koordinátor `cita768df48-4b`. Döntés: ADR-0329 (módosítja ADR-0323 D2).
Jóváhagyott terv (B változat): `assets/design-refs/console/vera-review/`.

## Elvégezve
- Kurátori generálás: piac-, tény-őr és vendég-kritikus NEM fut; `reviewVerdict: "pending"`. Nem-kurátori út változatlan.
- Kézi átírás (`copyManual.ts`): nincs AI-őr; régi verdiktek + ítélet + nyugtázás törölve; „Vera ítélete kell a küldéshez”.
- Recopy (AI): az őrök futnak, a Vera-ítélet törlődik.
- Küldés-kapu (`mockVerdictGate.ts`): `pending` blokkol, NEM ackolható (e-mail felugró: csak „Bezárás”; köteg; SMS); FLAG ackolható; copyHash-eltérés → pending.
- Konzol: Vera-jelvény + rögzítő a kártyán (`mockReviewBlock`), `POST /artifact/:id/review`, `pending`/`error` jelvény sárga.
- Lelet a kész felület lövésénél: egy általános konzol-szabály a `form`-ot inline-ná tette → a rögzítő kerete szétesett; javítás `.con-vr__box { display: block }`.
- tudasbazis-or leletei nyomán: a piszkozat „Mehet ki most?” sávja hiányzó ítéletnél „ismeretlen ok”-ot írt → a `describeMailSendability` a kiút-mondatot adja okként; a felugró saját címet kap („Erre a szövegre még nincs Vera-ítélet — így nem küldhető ki”).
- KB: `console-lead` (kurátori generálás, kézi mentés, jelvénytábla, szín, új „Vera-ellenőrzés a kurátori mockon” szakasz), `console-outreach-draft` (hiányzó ítélet nem vállalható).
- Mérés: kurátori úton az AI-őr költség $0.12 → $0.00/mock (62 éles mock, `aiUsage.byStep` csak a 3 őr).

## Módosított fájlok
`src/outreach/mockVerdictGate.ts`, `src/outreach/sendBatch.ts`, `src/outreach/sendOutreachSms.ts`, `src/generator/generateEngine.ts`,
`src/generator/copyManual.ts`, `src/generator/recopy.ts`, `src/console/server.ts`, `src/console/views.ts`, `src/console/copyEditViews.ts`,
`public/assets/ui/citui-console.css`, `src/i18n/catalog.json`, `scripts/verdict-gate-check.mts`, `scripts/copy-curator-check.mts`,
`kb/entries/console-lead/entry.hu.md`, `kb/entries/console-outreach-draft/entry.hu.md`, `assets/design-refs/console/vera-review/*`,
`_planning/decisions/XXXX-vera-review-replaces-ai-guards.md`.

## Nyitott
- NEM élesítve (a nagy deployjal megy). Élesítés után Vera teendője: mockonként a lead-lap mock-kártyáján ítélet rögzítése.
- A dev-DB-ben nincs kurátori mock; a felület egy memóriában kurátorivá tett mockon lett lőve (DB-írás nélkül).

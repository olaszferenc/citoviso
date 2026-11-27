# 2026-11-27 — Javító levél a hibás nyitóképpel kiküldött 7 leadnek + kurált településtár (SUB `cit8acda5c6`)

Koordinátor `cit96bd8170-a1`, brief `~/rc-briefs/javito-level-20261127.md`, döntés: ADR-0508 (javító levél). Élesen NINCS — a koordinátor élesít a land után.

## Elvégezve
- Kijelölő szabály + `fix_letter` napló (0161), leadenként egyszer; a lépés a lánc-utánpótlás időzítőjében (5 perc): kijelöl, két tervet készít, a jóváhagyottakat a kiküldési ablakban küldi.
- Kurált településtár (`src/media/townCurated.json`, 6 település, Commons szerzővel/licenccel), a render-kapu szabályával előre mérve (`scripts/town-photo-curated-add.mts`). Más hely képe csak tájkép-nyitókép lehet.
- Az író ismétlés-köre (`scripts/text-repeat.mts` + lánc-kiegészítés `~/rc-briefs/uj-lanc-javito/javito-lanc.sh` check|go|rollback — a go a koordinátoré, a land után).
- A jóváhagyó lap „Javító levél” füle (terv: `assets/design-refs/console/javito-level/`, tulaj „ok” 11-27), `sendOutreachMail` javító levél mód, `bodyStyle: "fix"` levél.
- Végpróba: `EMAIL_PROVIDER=mock PGDATABASE=<scratch> npx tsx scripts/fix-letter-e2e.mts` — zöld (a levél betű szerint a brief szövege, második küldés 0).

## Módosított fájlok
migrations/0161_fix_letter.sql · src/db/schema.ts · src/outreach/{fixLetter,fixLetterCopy,sendBatch}.ts · src/email/outreachEmail.ts · src/console/{approvalQueue,server}.ts · src/media/{townCurated.ts,townCurated.json,townPhotoSet.ts} · src/generator/chainSupply.ts · scripts/{chain-supply,town-photo-gather,town-photo-curated-add,text-repeat,fix-letter-e2e}.mts · kb/entries/console-approval/entry.hu.md · assets/design-refs/console/javito-level/* · src/i18n/catalog.json

## Nyitott
- Kamilla és Bagoly új szövegén nincs Vera-ítélet → a „Mehet” után is vár (a lap sárgán jelzi); Vera ítéletét a koordinátor kéri a kollégától.
- ⚠️ A dev `.env`-ben `EMAIL_PROVIDER=smtp` — tesztlevelet csak `EMAIL_PROVIDER=mock` mellett (a végpróba ezt kényszeríti).
- A lánc fő terv jelöltszűrője (`fo-cand.sql`) a kurált tárat nem látja (csak a `town_photo_set`-et) — más leadeknek külön lépés kellene.

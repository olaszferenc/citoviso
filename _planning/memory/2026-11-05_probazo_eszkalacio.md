# 2026-11-05 — Próbázó eszkaláció (nem lép be): piros jelzés, élő-oldal MMS, személyes levél helyi névvel, „elakadt”

**Session:** `cit2dea6649` · brief `~/rc-briefs/pr-ba-eszkal-ci-s-folyamat-20261105-085445.md` (a „CIT ➕ Hiba” session javaslata, tulaj: „ok, elfogadom”)
**ADR:** ADR-XXXX · **Terv:** `assets/design-refs/console/proba-eszkalacio/` (A + P2 + helyi név)

## Mi történt
- Élesen mérve: Sáma (9. nap) és Marilyn (4. nap) egyetlen ADR-0417 emlékeztetőt kapott (11-04), jelszót egyikük sem állított.
- §2b terv-kör: 5 fül, mobil + asztali; a mockba a tulaj 11-05-i „nulla humán” szabálya miatt P2 került (minta egyszer jóváhagyva) és kikerült a telefonos ajánlat. Tulaj: „Elfogadom… de ne Poe legyen a kimenő név, mindig valami helyi név”.
- Megvalósítva: `src/trial/escalation.ts` (e4/m5/h7/s10, óránkénti tick), `liveShot.ts` (élő oldal képe sávval), `helperPersona.ts` (nyelvenkénti helyi név), levél/SMS-szöveg (`loginEmail.ts`), MMS-sor `free_trial_id` + nyugta-horog, konzol (lista jelvény, lead-lap lépcső „A”, Irányítópult sor), riport (stalled ítélet, „Hol szakad meg a próba?” + `?v=`), migráció 0125, őr `trial-escalation-check` (+ self-test), `trial-report-check` frissítve (13. napos be nem lépett = stalled).

## Élesítés után várható (ha a tulaj élesít)
- Az első hétköznapi tick-ben Sáma: e4 + s10 jel, MMS + kísérő SMS, személyes levél; Marilyn: e4 jel, 5. napján MMS, 7. napja vasárnap → hétfőn levél.

## Nyitott
- Koordinátor-jegy a 4. napi jelzéshez (VPS → dev gép híd) — külön lépés.
- SMS-kézbesítés nem mérhető (ADR-0417 nyitott pontja).

## Fájlok
migrations/0125_trial_escalation.sql · src/trial/{escalation,liveShot,helperPersona,loginReminders}.ts · src/email/loginEmail.ts · src/mms/{sender,relayQueue}.ts · src/db/schema.ts · src/console/{leadClient,data,views,server,trialReport,trialReportViews}.ts · public/assets/ui/citui-console.css · scripts/{offer-followup,trial-escalation-check,trial-report-check,mms-relay-check}.mts · hooks/pre-commit · src/i18n/catalog.json · assets/design-refs/console/proba-eszkalacio/* · _planning/decisions/XXXX-probazo-eszkalacio-*.md

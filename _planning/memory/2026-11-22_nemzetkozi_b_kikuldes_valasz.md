# 2026-11-22 — Nemzetközi B: kiküldés, utánkövetés, válasz, elutasító országfüggően (`cit4ddfda9e`)

Koordinátor: `cit9b4690e3`. Brief: `~/rc-briefs/nemzetkozi-B-kikuldes-valasz-20261122.md`. ADR-0466
(`_planning/decisions/XXXX-nemzetkozi-b-kikuldes-valasz-orszagfuggo.md`). Élesen NINCS.

## Elvégzett munka
- **Lead-óra** (`src/outreach/leadClock.ts`): az eszkalációs emlékeztető (8–20, nem ünnepnap), a viselkedés-üzenet
  (munkanap 8–20), a nem-nyitó levél és a próba-üzenetek (hideg ablak) a lead zónájával és ünnepnapjaival; a próbanap
  a lead naptárán (`trialDayOf(now, start, tz)`); ország nélkül zárva. HU-sor = a régi mondat bájtra.
- **Védőháló:** `lead.contact_block_at` minden küldőben (sendBatch, sendOutreachSms + isPhoneSuppressed,
  escalationFollowup, nonOpenerFollowup, behaviorMessage, trialCampaign; a próba-eszkaláció már nézte).
- **Telefon:** a lead száma a saját országában (`leadPhoneE164` → A SUB `normalizePhoneIn`).
- **Kiküldési sor:** ország nélküli sor nem számít HU-nak (`sentTodayIn`).
- **Pénz/tartalom:** „Ft” csak forint-összeg mellett (viselkedés-SMS/-levél); Szállás.hu csak ahol az ország-sor listázza
  (hideg levél p4, próba-kampány); a próba-kampány domain-pontja a régió csomag-végződése.
- **Kísérlet:** idegen nyelven a változat csak teljes Bábel-fordítással, különben kontroll.
- **§C-kapu:** a nem-magyar eszkalációs emlékeztető keretezés-jelölője (eddig minden idegen nyelvű emlékeztető FLAG-et kapott).
- **Válasz:** pt/nl idézet-jelölők; nemzetközi irányítószám a válasz-listán; Poe-jegy: lead nyelvén zárás, helyi idő,
  elutasítás bármely nyelven (jelölés: „elutasító/nem érintett”, RUNBOOK §6b); `~/rc-briefs/watch/valasz-watch.py`
  üzenete bővítve (mentés a session scratchpadjében).
- **Lánc (élő cron) MÁSOLATBAN:** `~/rc-briefs/uj-lanc/fo-terv/fo-cand.sql.nemzetkozi`, `write.py.nemzetkozi`,
  `rules-nyelv.md`; `~/rc-briefs/egylepes-elo/cand.sql.nemzetkozi`, `run2.py.nemzetkozi`, `rules-v2-nyelv.md`.
  Éles, csak olvasó futtatás: fo-cand 166 = 166 sor, bájtra azonos; cand 5851 = 5851, azonos halmaz (holtversenyes
  sorrend), 91 mp vs 110 mp. A konzol forrás-csomagja nem-magyar leadnél `lang` mezőt kap.
- **Őr:** `country-layer-check` ⑬; e2e `scripts/nemzetkozi-b-e2e.mts` (28/28).

## Módosított fájlok
src/outreach/{leadClock (új),escalationFollowup,nonOpenerFollowup,behaviorMessage,behaviorMessageCopy,sendOutreachSms,
sendBatch,autoDispatch,experiment,experimentCopy,draft,trialCampaign,outreachCheck}.ts · src/trial/escalation.ts ·
src/email/trialCampaignEmail.ts · src/replies/{quoteMarkers,store}.ts · src/console/server.ts · src/i18n/catalog.json ·
scripts/{replies-collect,trial-campaign,country-layer-check,country-hr-e2e,country-outreach-e2e,nemzetkozi-b-e2e (új)}.mts · scripts/lib/babel-pending-nemzb.mts (új) · src/outreach/portalSentence.ts (új) · poe/charter/RUNBOOK.md ·
(a levél-kritikus ujjlenyomata változatlan: az új naptár-mondat a draft.ts-en kívül él, `portalSentence.ts`).

## Nyitott
- Bábel (jegy: `~/rc-briefs/babel-nemzetkozi-b-20261122.md`): 7 új forrásszöveg (a naptár-mondat Szállás.hu nélküli két változata, a próba-kampány 3 mondata, a
  viselkedés-üzenet 2 nem-forint ármondata) — amíg nincs fordítás, a HR hideg levél TARTVA („Bábelre vár”).
- A kísérlet katalógus-sablonjai (DB-sorok) nincsenek a fordítási katalógusban → idegen nyelven ma mindig kontroll.
- A lánc-másolatok átállítása a koordinátor „mehet”-jére.
- Riport ország-bontása (kísérlet-riport) felület-munka → §2b terv kell.
- A dev DB `country` táblájából hiányzik a HR sor (a 0142 migráció lefutott, a sor nincs) — scratch DB-ben megvan.
- `country-crm-e2e` 2 hibája („a válasz nyelve tárolva: cs/bg/hu” → mind hu) az origin/mainen is bukik — nem e kör hibája,
  a koordinátornak jelezve.

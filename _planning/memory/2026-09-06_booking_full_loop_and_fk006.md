# 2026-09-06 — Booking teljes kör (Foglalások fül + 5 vendég-levél + ár-befagyasztás) + FK-006 időutazó

## Mi történt

A tulaj állandó booking-figyelmeztetése („vannak benne lukak") EGY session alatt zárult:
kód-átvilágítás → tulaj-spec (4 pont) → terv-kör (B-fül 3 iterációban: collapsable naptár,
kattintható csempék, fedés-popup; C-levelek) → jóváhagyás („mehet fasza így") → implementáció
→ FK-007 Elek-kör (7 futás) → tulaj ár-rendelete → ár-réteg → FK-006 időutazó (dunning). A
pilot-előtti teszt-térkép ezzel TELJES. Landolva: f92b621…7399df2.

## A gyanú JOGOS volt — igazolt lukák (mind javítva)

booking-maintenance sehol nem futott (ütemezés: óránkénti systemd timer, deploy/systemd/ +
README) · lejáratás nem értesítette a vendéget · lemondás-út (cancelled) nem létezett ·
Reply-To hiányzott · vendég-ack levél hiányzott · ⛔ DATE-oszlop TZ-luka (pg typeParser
gyökér-fix: minden DATE -1 napot csúszott, a levelekben is) · /t/ dev-úton az élő widget
API-ja halott (API_BASE a runtime-ban + snapshot-rerender) · lemondás-confirm inline JS
némán tört (idézőjel-ütközés) · „Idén visszaigazolt" lemondáskor csökkent · SMTP 553
(teljes-mailbox OUTREACH_FROM × From-név → bare()) · levél-hiba megszakította a döntést
(mailSafe) · vendég >10 mp „Küldés…" (fire-and-forget) · T0-levél elhallgatta a bukott
kártya-terhelést · számla-levél tegeződött.

## Új képességek

- **Foglalások fül** (`src/server/bookingViews.ts`, kontraktus:
  `assets/design-refs/tenant-admin/foglalasok-README.md`): badge (seen_at), collapsable
  naptár nap-műveletekkel, csempék, időrend, verdikt kommenttel, fedés-popup → automata
  elutasítás. A modul-képernyő kérés-doboza kivezetve (egy hely dönt).
- **5 vendég-levél** + vendég-lemondó képernyő (GET megerősít, POST mond le) + .ics
  (buildStayIcs/buildStayCancelIcs, közös UID). Feladó-név=szállás, Reply-To=notify[0],
  BOOKING_FROM env (alias a tulajnál folyamatban).
- **Ár-befagyasztás** (0052 + `quoteStayFrom`): szezon-győz éjszakánként; hiányos árlista →
  nincs szám sehol; widget élő bontás (API-ból), levelek + admin a TÁROLTBÓL.
- **FK-006 időutazó** (`scripts/elek-timetravel-fk006.mts`): tenant-szűrős billing-tick
  (`runBillingCycle(now,{tenantId})` + `--tenant`), stage-dátumok a period_end-ből.
  Bejárva: T−3→T+10 freeze→thaw→booking-expire. T+30 kihagyva (fixture-ölő).
- FK-007 (booking regressziós kör) + `scripts/seed-elek-booking.sql`.

## Elek-verdiktek

FK-007 ár-kör: 0 HIBA, 0 REGRESSZIÓ (a 3 előző lelet igazoltan eltűnt); ár-egyezés
widget↔admin↔9 levél. FK-006a/b: gépi zöld; 2 HIBA (levél-őszinteség + hangnem) javítva.
GYANÚK feljegyezve: ELEK-galéria halott klón-portál-képei (kapu-előtti seed-műtermék) ·
„döntés:" dátum lemondás után az utolsó állapot-váltást mutatja · vendég-nyelv → ADR-0099
(backlog: böngésző-nyelv + megvett nyelvi csomag = azon a nyelven megy a kommunikáció).

## ⏭️ KÖVETKEZŐ NAGY FELADAT (tulaj-utasítás)

**PILOT-ÉLES LELTÁR a következő sessionben**: tételes lista a hiányzó tulaj-external +
deploy-előfeltételekről az éles pilot-induláshoz — Számlázz.hu éles kulcs, INWX éles
API-kulcs, foglalas@ alias + BOOKING_FROM, Barion éles bolt, éles deploy (booking-köteg +
booking-maintenance timer élesre), jogi entitás-mezők/ÁSZF, GBP/láthatóság, env-átvilágítás
(config.ts tulaj-external tételei), DEPLOY-READY.md kapuk.

## Módosított/új fájlok (fő tételek)

migrations/0051+0052 · src/db/client(DATE-parser)+schema · src/booking/requests+ical ·
src/email/sender+billingEmail+invoiceEmail · src/payment/billing(+tenant-szűrő) ·
src/server/bookingViews(ÚJ)+public+adminViews+moduleConfigViews · src/moduleConfig ·
src/tenant/prices(quoteStayFrom) · src/ui/icons · assets/runtime/cit-runtime.js+css ·
deploy/systemd/citoviso-booking-maintenance.* · kb/entries/admin-bookings(ÚJ)+admin-modules-booking ·
elek/scenarios/FK-006a,FK-006b,FK-007 · scripts/{seed-elek-booking.sql,elek-timetravel-fk006.mts,
billing-cycle,kb-check,kb-scan,i18n-scope} · assets/design-refs/tenant-admin/foglalasok-* ·
_planning/DECISIONS.md (ADR-0099).

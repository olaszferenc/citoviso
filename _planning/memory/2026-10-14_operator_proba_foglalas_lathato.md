# Az operátor látja a próbát és a foglalást, és értesítést kap (ADR-0386) — 2026-10-14

**Szál:** SUB a deploy-koordinátornak (`citfb4ed7ab`), Elek 10-13 O-2 lelet. §2b terv-kör 10-13-án,
tulaj-jóváhagyás 10-14-én („mehet”): lead-lap **B** (ügyfél-kártya), lista **C** jelvény + **B** szűrő-sor,
értesítés **E2** + a válasz nélküli foglalás levele.

## Elvégzett munka
- Terv befagyasztva: `assets/design-refs/console/proba-foglalas-lathato/` (`plan.html`, README a kötő feliratokkal, terv-képek, előtte/utána képek ugyanazon a leaden).
- Egy szabály az ügyfél-állapotra: `src/console/leadClient.ts`.
  - `clientKind`: próba > előfizetés > lejárt próba.
  - `loadLeadClients`: free_trial + tenant/site/subscription + booking_request.
- Lista: jelvény a név alatt, és szűrő-sor: Mind / Próbázik / Foglalás érkezett / Előfizető / Próba lejárt. A darabszám az egész aktív listán értendő. A `?client=` kikapcsolja az alapszűrést.
- Lead-lap: ügyfél-kártya a sáv alatt.
  - Napok és csík, élő oldal, kapcsolattartó, kedvezmény.
  - Foglalás-táblázat; mobilon kártyák.
  - „Érdemes felhívni.” sor 24 óra csend után.
  - A Rendelés-állomás: „próba fut — lent”.
- Értesítés: `src/console/clientNotify.ts`.
  - Új próba: levél + saját szövegű SMS (`HouseAlert.smsText`, új mező a `houseAlert.ts`-ben). Azonnal megy a `startTrial` után, és az óránkénti tick (`runClientNotices` az `offer-followup.mts`-ben) pótolja.
  - Válasz nélküli foglalás: csak levél.
  - Mindkettő egyszer megy (`house_alert_once`).
  - Az éjjeli csendes óra és az éles-host-szabály a meglévő.
- Őr: `scripts/client-visibility-check.mts` (scratch-DB), bekötve a pre-commitba. KB: `console-lead`, `console-leads`.

## Mérve
- Dev DB: 0 `free_trial` sor.
  - A képekhez egy rövid életű `[TESZT] shot` próba és foglalás került az Ifjúsági Szállás Tihany leadre. A képek után törölve: `free_trial` = 0, a fixture-foglalás = 0.
  - Az „előtte” kép egy ideiglenes `origin/main` munkafából készült; a munkafa törölve.
- Az új-próba SMS a Keresztes-mintán GSM-7, 127 karakter, 1 szelet.

## Döntések
- A levél tárgya „Citoviso: új ingyenes próba — …” (a mockban „Citoviso —” állt): az éjszakai összesítő a „Citoviso:” előtagot veszi le.
- A kártya mondata „hideg megkeresés neki már nem megy” (a mockban „ne küldj”): az ADR-0384 a küldést már tiltja.
- Migráció nincs.

## Nyitott
- Élesen az SMS-hez riasztási telefonszám kell a `/settings`-ben (ADR-0374).
- Az Irányítópultra (C változat „Élő ügyfelek”) nem került semmi; a tulaj ezt nem választotta.

## Fájlok
- Kód és stílus:
  - `src/console/leadClient.ts` (új), `src/console/clientNotify.ts` (új)
  - `src/console/houseAlert.ts`, `src/console/views.ts`, `src/console/data.ts`, `src/console/leadFilters.ts`, `src/console/server.ts`
  - `src/booking/requests.ts` (a `bookingRules` export), `src/trial/start.ts`
  - `public/assets/ui/citui-console.css`
- Szkriptek és hook: `scripts/offer-followup.mts`, `scripts/client-visibility-check.mts` (új), `hooks/pre-commit`
- Súgó: `kb/entries/console-lead/entry.hu.md`, `kb/entries/console-leads/entry.hu.md`
- Terv, döntés, memória:
  - `assets/design-refs/console/proba-foglalas-lathato/**`
  - `_planning/decisions/XXXX-az-operator-latja-a-probat-es-a-foglalast.md`
  - ez a jegyzet, `MEMORY.md`

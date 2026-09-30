# 2026-09-30 — Lead-ajánlatok: érvényesség, emlékeztető és bemutatkozó % állítható; a levél %-a köt (ADR-0286)

**Szál:** SUB `cit782078ba` (koordinátor: CIT fő session). Briefek: `~/rc-briefs/eszkalacio-idozites-bemutatkozo-allithato-sub.md`,
`~/rc-briefs/eszkalacio-idozites-sub-dontes.md`.

## Elvégzett munka
1. **§2b, 1. kör:** három működő mock (A egy rács · B két kártya · C idővonal), 390 + 1280 képek, Playwright-kattintás
   (változatonként 24 lépés, JS-hiba 0). A tulaj: **A**; a határok és kulcsnevek jóváhagyva.
2. **Lelet (a mock-körben):** a bemutatkozó `offer` sor NEM a kiküldéskor, hanem az első megnyitáskor (lustán,
   `bestActiveOfferForProspect → ensureOutreachOffer`) született, a mindenkori %-kal. Egy %-állítás után a már kiküldött,
   még meg nem nyitott levél leadje mást kapott volna, mint amit a levél ígért (dev: 12-ből 1 ilyen).
   **Tulaj-döntés: „a levél %-a köt”.**
3. **Kód:**
   - `offers.ts`: az `EscalationConfig` + `offerHours` / `followupHours` / `outreachPercent`; `escalationConfigErrors`
     mező-közi szabályokkal (mindkét mezőt jelöli); `parseEscalationSetting` (hiányzó kulcs → default, hibás sor → null);
     `stampOutreachOffer`, `outreachPercentForProspect`, `legacyOutreachPercent`; a mintázás a config órájával; a
     follow-up esedékesség a config késleltetésével.
   - `draft.ts`: `DraftInput.offerPercent` + `draftOfferPercent`; a `buildDraftForProspect` a prospect %-át tölti.
   - Rögzítés a sikeres küldés után: `sendBatch.ts`, `sendOutreachSms.ts`, `sendOutreachPair.ts`, `console/data.ts markProspectSent`.
   - `views.ts` `escalationSection` (A változat) + lap-szkript, `server.ts` hibaüzenet, `citui-console.css` (`.pr-esc__gated`, `.pr-hint`, `.pr-esc__sub`).
   - `escalationFollowup.ts`: napló a config késleltetésével.
4. **Őr:** `escalation-config-check` ⑥ (konfigurált lejárat / esedékesség / régi sor / hibás sor), ⑦ (a levél %-a köt:
   a még meg nem nyitott levél 30%-ot tart 20%-ra állítás után; régi kiküldés → 25; új → 20), ⑧ (szerkezeti: minden
   `sent_at`-pecsételő út rögzít). Mutációval mérve (3 / 2 / 1 piros). A pre-commit trigger bővítve.
5. **Doksi:** kontraktus (`escalation-offer-admin/README.md` + `plan.html` + képek, 2. kör), KB `console-pricing` (a kódból),
   GLOSSARY, `outreach-mail/README.md`.

## Módosított fájlok
`src/payment/offers.ts` · `src/outreach/draft.ts` · `src/outreach/sendBatch.ts` · `src/outreach/sendOutreachSms.ts` ·
`src/outreach/sendOutreachPair.ts` · `src/outreach/escalationFollowup.ts` · `src/console/data.ts` · `src/console/views.ts` ·
`src/console/server.ts` · `public/assets/ui/citui-console.css` · `src/i18n/catalog.json` · `scripts/escalation-config-check.mts` ·
`hooks/pre-commit` · `assets/design-refs/console/escalation-offer-admin/{README.md,plan.html,plan-desktop.png,plan-mobile.png}` ·
`kb/entries/console-pricing/entry.hu.md` · `_planning/DOMAIN/00-GLOSSARY.md` · `assets/design-refs/console/outreach-mail/README.md` ·
`_planning/decisions/XXXX-lead-ajanlatok-idozites-es-bemutatkozo-allithato.md` · `MEMORY.md`

## Nyitott kérdések
- Az emlékeztetőt a **napi 07:00-s** billing-futás küldi: a beállított óra a legkorábbi időpont, 24 óránál rövidebb
  maradék-ablaknál nem mindenki kapja meg. A felület kimondja. Óránkéntire tenni = külön infra-döntés (tulaj).
- Élesítés: a koordinátor viszi (a nagy deploy utáni kör, külön engedéllyel). Migráció nincs.

## 2. kör (2026-09-30 este) — az emlékeztető óránként (ADR-0287)
Tulaj-döntés 17:45 után (élesen `e263b580`). Új időzítő `citoviso-offer-followup.{timer,service}` (prod, GATE 6),
`scripts/offer-followup.mts`; a `billing-cycle.ts`-ből kivéve (a többi lépés napi marad). Ablak 8–20 Europe/Budapest a
KÓDBAN (`followupWindowBlocks`), mert az éles VPS UTC. Idempotencia: `claimFollowup` (atomi, küldés előtt) +
`releaseFollowup`. Őr ⑨ (mutációval 3/1/1 piros). Szövegek: felület, KB, kontraktus, GLOSSARY, outreach-mail README,
ADR-0286 §5 mutató. Mellék-lelet: az SMS-kapu helyi órát olvas (élesen UTC lenne) — nem javítva, jelezve.
Fájlok: `src/outreach/escalationFollowup.ts`, `src/payment/offers.ts`, `scripts/offer-followup.mts`, `scripts/billing-cycle.ts`,
`deploy/systemd/citoviso-offer-followup.{timer,service}`, `deploy/systemd/targets.json`, `deploy/systemd/README.md`,
`src/console/views.ts`, `src/i18n/catalog.json`, `scripts/escalation-config-check.mts`, `hooks/pre-commit`, KB/README/GLOSSARY/ADR/MEMORY.

## 3. kör (2026-09-30 este) — kimenő ablakok Budapest-idő szerint (ADR-XXXX)
A 2. kör mellék-lelete (az SMS-kapu a szerver helyi óráját olvasta; élesen UTC → 10–22 Budapest) a tulaj döntésére javítva.
Egy függvény (`sendWindowOpen` / `minutesUntilWindowCloses` / `budapestHhmm`, `SEND_WINDOW_TZ`) a `sendWindow.ts`-ben: SMS-kapu,
mobil-pár határ, MMS-relé, emlékeztető-ablak. + Az emlékeztető levél határideje Budapest szerint (eddig szerver-zóna → a lap
kártyájától 1–2 órával eltért). A `mms-relay-check` ⑫ a HIBÁT rögzítette — javítva. Új őr `send-window-tz-check` (mutációval
10/6/5 piros). KB nem változott. Nem kimenő helyi-órás helyek (felsorolva, nem javítva): `multilangCard.ts fmtStamp`,
`moduleConfigViews.ts` „Utoljára frissült”, `trafficReport.ts since()`, `trafficMail.ts monthLabel`.
Fájlok: `src/sms/sendWindow.ts`, `src/outreach/sendOutreachSms.ts`, `src/outreach/escalationFollowup.ts`,
`scripts/send-window-tz-check.mts` (új), `scripts/mms-relay-check.mts`, `hooks/pre-commit`, ADR, MEMORY.

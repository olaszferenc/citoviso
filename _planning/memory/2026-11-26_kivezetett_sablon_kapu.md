# 2026-11-26 — Kivezetett sablon: kiküldési és próba-kapu (+ Freedom 50 új tervek)

**Session:** `citb1fcb19c` · **Élesen:** a kód NINCS élesítve; élesen csak a Freedom 50 adat-lépések (tulaj „Mehet”, 11-25).

## Elvégzett munka
- Brief („melyik magtípust kapta a legújabb próbázó?”): Freedom 50 Apartman → a kivezetett horizontal (októberi link 1. terve).
- Freedom 50: két új mock (parallax d93ed47a, wordmark-grow ba7687df) a próbázó adataiból; levél a tulaj jóváhagyásával, online `/configure/<id>` linkekkel; élesen új prospect 977fb38f (1/2/3 terv), a levél mindkét címére kiment (11-25).
- Kód: `src/outreach/templateGate.ts` + bekötés (`trialCampaign.ts` artifactBlocks, `sendOutreachSms.ts` mobileOutreachGates, `autoDispatch.ts` enqueue + küldés, `src/trial/start.ts` currentTemplatePlanOf). ADR-XXXX.
- Őr: `scripts/retired-template-send-check.mts` (pre-commit); `trial-plan-binding-check` ④; tesztadatok a tulaj sablonjaira (nonopener, behavior, trial-campaign, plan-switch, free-trial-check/e2e, trial-promise, plan-link-owned-content, proba-c-checkout).

## Módosított fájlok
src/outreach/templateGate.ts (új), src/outreach/trialCampaign.ts, src/outreach/sendOutreachSms.ts, src/outreach/autoDispatch.ts, src/trial/start.ts, scripts/retired-template-send-check.mts (új), hooks/pre-commit, scripts/{nonopener-followup,behavior-message,trial-campaign,plan-switch,trial-plan-binding,free-trial,free-trial-expiry,free-trial-retention,trial-escalation,trial-login-reminder,slug-rename,trial-promise,plan-link-owned-content,proba-c-checkout}-check.mts, scripts/free-trial-e2e.mts, _planning/decisions/XXXX-kivezetett-sablon-nem-megy-ki-es-nem-lesz-proba.md, MEMORY.md.

## Nyitott kérdések
1. A 211 régi horizontal link sorsa (tulaj-döntés).
2. Névelő-hiba a Kinézet fülön („a 1.” / „az 3.” tervre) — javítás dev-en, ha a tulaj kéri.
3. A `/configure/<id>` tervlinken a megrendelő sáv a próbázónak furcsa lehet — tulaj-döntés.
4. Élesítés: külön tulaj-utasítás (§0).

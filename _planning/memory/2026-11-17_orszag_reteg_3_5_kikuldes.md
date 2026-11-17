# 2026-11-17 — Ország-réteg 3/5: kiküldés a lead országában (cit c737a035)

Brief: `~/rc-briefs/orszag-reteg-3e-kikuldes-20261117.md` · koordinátor `cit9b4690e3` · ADR-XXXX (a land számozza).

## Elvégezve
- Új modul `src/outreach/countryOutreach.ts`: csatorna (`modemPairBlocks`, `messengerBlocks`), mobil (`leadMobileIn`),
  ablak (`outreachWindowBlocksIn`), kvóta (`dailyCapFor`), Bábel-ok, GSM-7-hajlíthatóság.
- Átkötve: `sendBatch.ts`, `sendOutreachSms.ts`, `sendOutreachPair.ts`, `autoDispatch.ts` (országonkénti ablak + kvóta,
  `outreach_dispatch.country`, 0140), `approvalQueue.ts` (mobil + számláló), `approvalCopy.ts`, `trialCampaign.ts`,
  `console/data.ts`, `mms/messenger.ts`, `scripts/s10-a11y/s10_send.py`, `draft.ts` (ország-nyelv, pénznem, cirill SMS,
  fallback-gyűjtés), `messengerCaption.ts`, `foreignPrice.ts`, `outreachCheck.ts` (NYELV-okok, fordított jelölők),
  `prospectNotice.ts`, `i18n/packs.ts` (`collectFallbacks`), `country.ts` (`countryOfLeads`), `send-window-tz-check` ⑨ (az ország-ablakot is elfogadja).
- Őr ⑨ a `country-layer-check`-ben; e2e `scripts/country-outreach-e2e.mts` 42/42.

## Nyitva / megfigyelés
- Süti-sáv felirata (`cit-consent.js` + `server/consent.ts`): kész patch `~/rc-briefs/orszag-reteg-3e-suti-sav-i18n.patch`, a
  felület-kapu tulaj-jóváhagyást kér (magyar lapon azonos) — koordinátori döntés.
- A követő üzenetek (viselkedés, nem-nyitó, eszkaláció, próbaidő-kampány) nem magyar leadnél ZÁRTAN állnak
  (NYELV: nem mért), amíg a renderük nincs a fallback-mérésre kötve — a következő kör.
- Külföldi mobil-csatorna: a helyi modem magyar SIM; más piac mobilja szolgáltató-döntés (koordinátor).
- A levél-kritikus egy próba-futása (változott ujjlenyomaton) meglévő, nem érintett tulaj-mondatokat FLAG-elt
  („Átnéztük a nyilvánosan elérhető adatait.”, SMS „honlap-látványtervet … megnézhet”, emlékeztető „Szeretnénk segíteni
  a döntésben”) — LLM-ítélet, a rögzített PASS ugyanerre a szövegre szól; a szöveg a tulajé, nem írtam át.

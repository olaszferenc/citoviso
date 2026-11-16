# 2026-11-16 — Ország-réteg 3/4: CRM és kommunikáció (ADR-0455)

Brief: `~/rc-briefs/orszag-reteg-3d-crm-20261116.md` · session `cit00db194a` · koordinátor `cit9b4690e3` · élesen NINCS.

## Elvégezve
- Ikerszűrő Unicode-névkulccsal (`src/scraper/dedupe.ts`), latin/cirill pár jelölése (`scriptTwinOf`, `src/scraper/types.ts`); a dev DB-n mérve: 7393 lead, 0 csoport-változás.
- Válasz-párosítás a lead országában + `outreach_reply.lang` (`src/replies/store.ts`), a Poe-jegy nyelve és aláírása (`scripts/replies-collect.mts`).
- Válasz-ablak a lead zónájában + ünnepnapjain (`src/replies/answer.ts`, új `src/crm/countryClock.ts`).
- Idézet-jelölők adatból (`src/replies/quoteMarkers.ts`, `src/replies/mime.ts`).
- Partner-szál: telefon a partner/lead országában, csendes óra a partner zónájában (`src/console/partnerMessages.ts`).
- Telefon-ikerkapu (`src/outreach/autoDispatch.ts`, `src/outreach/sharedContactGate.ts`).
- Jóváhagyási sor ország-oszlop + chip (`src/console/approvalQueue.ts`), csak többországos sornál.
- Visszajelzés-nyelv a lead országából (`src/console/prospectFeedback.ts`, a konzol-szerver három hívása).
- 0139 migráció: `country.public_holidays`, `outreach_reply.lang` (additív, a dev DB-n lefutott).
- Charterek: `poe/charter/RUNBOOK.md`, `vera/charter/CHARTER.md`, `vera/charter/ONTOLOGIA.md`, `neo/charter/CHARTER.md`, `neo/charter/ONTOLOGIA.md`; eszköz `scripts/lead-country.mts`, ítélet `src/crm/leadContact.ts`.
- Őr ⑧ (`scripts/country-layer-check.mts`), e2e `scripts/country-crm-e2e.mts` (HU+BG+CZ, 40/40).

## Nyitva
- Kiküldés-kör (3/5): a jóváhagyási sor mobil-csatornája és az SMS/MMS/messenger külföldi számra (ALLOW az őrben).
- A konzol „Országok” lapján a `public_holidays` mező kitöltése (ma csak SQL).
- Az aláírás és a jegy-szövegek cs/bg stb. fordítása Bábelre vár (addig magyar forrás).

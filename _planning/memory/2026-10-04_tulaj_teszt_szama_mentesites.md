# 2026-10-04 — SMS/MMS nem küldhető: a tulaj teszt-száma csak [TESZT] leaden mentes

**Szál:** SUB (brief `~/rc-briefs/sms-mms-nem-kuldheto.md`), koordinátor: „mock-összehasonlító / Kapunyitás”. Döntés: ADR-0319.

## Diagnózis (mindkét kapu helyesen tiltott)
- **Éles:** [TESZT] Lovász ↔ [TESZT] Muschel ugyanazon a számon (+36305161631), nincs `lead_link`; élesen nincs
  `OUTREACH_SMS_ALLOWLIST`, tehát a teszt-szám semmilyen kivételt nem kapott. Kézi kiút: Duplikátumok → „Egy tulaj több egysége”.
- **Dev:** az Éden üdülőház prospectje 2026-09-25 18:14-kor leiratkozott (levél-teszt, `actor=lead`) → a szám-szintű
  suppression minden leaden tiltja a számot. Kézi kiút: lead lap → „Leiratkozás visszavonása ▸” → „Visszavonás”.
- A dev figyelmeztetés („linkek: mineral.tail3a89f.ts.net”) csak dev konfig (`PUBLIC_BASE_URL`).

## Elvégezve
- `OUTREACH_TEST_PHONES` env (`src/config.ts`), `src/outreach/ownerTestPhone.ts` (szám listázott ÉS a név `[TESZT]`-tel kezdődik).
- `phoneContactBlocks()` (`src/outreach/sendOutreachSms.ts`): közös-elérhetőség kapu kivétele mindenütt, leiratkozásé csak
  az éles hoston kívül. Valódi lead változatlan.
- Őr: `scripts/owner-test-phone-check.mts` (+ `hooks/pre-commit`), negatív kontrollal; mutációs próbán 5 piros.
  `scripts/shared-contact-gate-check.mts` ⑪ huzalozás-regexe az új hívási alakra igazítva.
- Dev `.env`: `OUTREACH_TEST_PHONES=06305161631`.

## Nyitott
- **Éles env** (külön élesi művelet, engedéllyel): `/opt/citoviso/app/.env` → `OUTREACH_TEST_PHONES=06305161631`,
  a kód a nagy deployjal; utána a console és a public újraindítása.
- **Dev:** a tulaj számát viselő 20 dev lead közül EGY SEM `[TESZT]` nevű → dev-ben a kivétel ma nem hat. Döntés: vagy
  egyszeri leiratkozás-visszavonás az Éden üdülőházon, vagy `[TESZT]` előtag a dev teszt-leadeken.

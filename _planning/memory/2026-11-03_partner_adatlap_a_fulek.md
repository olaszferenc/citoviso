# Partner-adatlap A — Fülek: szerkeszthető partner, előfizetés, domain, Figyelendő (SUB-C, 2026-11-03)

**Session:** SUB-C (`cit393c725f`), koordinátor: a Fizetés-szál (`cit7e001214`). **Élesen: nincs.**

## Kiváltó
A tulaj: „a CRM partner oldalak is semmitmondóak … partnert nem is tudom szerkeszteni, pl. kapcsolat.
Nem látom a saját domainnevüket, ha megrendelték, annak lejáratát, semmit.” Az első fizető vevő
(Duna Vibe House) adatai a konzolon nem látszottak.

## Terv-kapu
1. kör: A (fülek) / B (hosszú lap) / C (CRM-rekord), működő szerkesztővel → a tulaj az **A**-t
   választotta, plusz egy új **Üzenetváltások** fület kér (írni is: e-mail + SMS).
2. kör (csak az Üzenetváltások): M1 csevegő-szál / M2 postafiók — **döntésre vár**
   (`assets/design-refs/_drafts/partner-adatlap/M1-szal.html`, `M2-postafiok.html`), két nyitott
   kérdéssel: nincs strukturált „elutasító / nem érintett” jelölés a leaden; a vevő nem-megkeresési
   leveleit ma senki nem gyűjti.

## Elkészült (landolva)
- Új lap: fejléc + KPI, Figyelendő, fülek (Áttekintés · Adatok és kapcsolattartók · Előfizetés ·
  Domain · Számlák/Bizonylatok · Aktivitás · Előzmények). A régi „Kontaktok” fül az Adatok fülbe
  olvadt (`?tab=contacts` oda visz).
- Szerkesztés: `POST /partner/:id/edit` (`updatePartner`, tranzakció, audit = operátor-id),
  kliens-tükör ugyanazokkal a szabályokkal. Forrás-szabály: ADR-XXXX.
- Következő terhelés = `getSubscriptionAdmin().nextChargeTotal` (a vevő saját számával egyezik).
- Domain: átmeneti `partnerDomains()` a SUB-E `getDomainsForTenant`-jéig.
- Aktivitás-slot a SUB-D-nek: `src/console/partnerActivity.ts`.
- Őr: `scripts/partner-edit-check.mts` (bekötve); `partner-ui-check` az új markuphoz igazítva.
- Súgó: `kb/entries/console-partner-page` átírva, a kép a valós profillal, determinisztikusan.

## Mért tények
- `site.custom_domain` szándékosan csak élesedéskor íródik; a friss domain lejárata a szinkron
  előtt becsült (vétel + 1 év).
- `tenant_user.last_login_at` csak a jelszavas belépést bélyegzi (a linkes nem) — a lap ezért
  „utolsó jelszavas belépés”-t ír.

## Módosított fájlok
`src/console/partnerProfile.ts` (új), `src/console/partnerProfileViews.ts` (új),
`src/console/partnerActivity.ts` (új), `src/console/partnerViews.ts`, `src/console/partnerData.ts`,
`src/console/server.ts`, `public/assets/ui/citui-console.css`, `scripts/partner-edit-check.mts` (új),
`scripts/partner-ui-check.mts`, `scripts/partner-kb-shot.mts`, `scripts/kb-check.mts`,
`hooks/pre-commit`, `kb/entries/console-partner-page/*`, `kb/entries/console-documents/assets/hu/screen.png`,
`assets/design-refs/console/partner-adatlap/*`, `_planning/decisions/XXXX-partner-adatlap-szerkesztheto-forras-szabaly.md`,
`src/i18n/catalog*.json`.

## Nyitva
- Az Üzenetváltások fül (2. kör döntése után).
- SUB-E landolása után: `partnerDomains()` → `getDomainsForTenant()`.
- SUB-D landolása után: `partnerActivityHtml()` törzse.

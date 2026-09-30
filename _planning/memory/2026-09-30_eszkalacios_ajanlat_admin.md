# 2026-09-30 — Eszkalációs ajánlat: küszöb és kedvezmény a /pricing-on (ADR-XXXX)

SUB session (`cit7785fd02`), koordinátor: CIT fő session. Brief: `~/rc-briefs/eszkalacios-ajanlat-admin.md`.

## Mi történt
- **Felderítés:** a futó felületek (konfigurátor ár-kártya és döntés-kártya, follow-up levél, napló) már az
  `offer.percent`-ből beszéltek. Beégetett szám csak az `offers.ts`-ben volt (3 / 50); ezen kívül dokumentumok
  idézték (az offer-ui és az outreach-mail README, a GLOSSARY, az FK-011, kód-kommentek).
- **§2b:** két működő mock (A: saját szekció minden régió-oldalon · B: kompakt sorok, csak HU), 58/58 Playwright.
  A tulaj döntése: **A**; küszöb 2–10, % 26–90, külön kapcsoló, globális `app_setting` sor.
- **Megvalósítás:**
  - `offers.ts`: `getEscalationConfig`, `setEscalationConfig`, `escalationConfigErrors`, `escalationFromForm`,
    `overrideEscalationConfigInProcess`, `liveEscalationOffers`. Az `ensureEscalationOffer` innen olvas, a
    konstansok csak default/seed értékek.
  - `/pricing`: „Lead-ajánlatok” szekció élő validációval, előnézettel és az élő ajánlatokra vonatkozó
    figyelmeztetéssel.
  - A POST hibás értéknél semmit nem ment. A szekció nélküli űrlap (nincs `esc_present`) nem nulláz. Kikapcsolt
    állapotban a tiltott mezők nem jönnek, ekkor a tárolt számok maradnak.
- **Ellenőrzés:**
  - `escalation-config-check` 26/26; a konstansokra visszarontva 3 piros.
  - Élő /pricing Playwright 28/28: a POST-ot elfogtam, a közös DB-be nem írt.
  - ui-shot 390 px + asztali.
  - A KB-kép újragyártva; a többi súgó-kép pixelre azonos maradt.

## Módosított fájlok
`src/payment/offers.ts`, `src/console/views.ts`, `src/console/server.ts`, `public/assets/ui/citui-console.css`,
`src/i18n/catalog.json`, `hooks/pre-commit`, `scripts/escalation-config-check.mts` (új),
`assets/design-refs/console/escalation-offer-admin/` (új kontraktus), `assets/design-refs/console/offer-ui/README.md`,
`assets/design-refs/console/outreach-mail/README.md`, `kb/entries/console-pricing/` (szakasz + kép),
`_planning/DOMAIN/00-GLOSSARY.md`, `elek/scenarios/FK-011-owner-buy-mobile.md`, `_planning/DEPLOY-READY.md`,
`_planning/decisions/XXXX-…` (új ADR), `MEMORY.md`.

## Tanulság
- A `<form>` BELSEJÉBEN, a submit-gomb előtt álló `<script>` akkor fut le, amikor a gomb még nem létezik. A
  `form.querySelector("button[type=submit]")` null volt, a mentés-gomb tiltása csendben elmaradt. Csak az élő
  Playwright-próba fogta meg (a statikus render-őr nem). Javítás: az indulás `DOMContentLoaded`-re halasztva.
- Az élő felület-próba úgy is végigmérhető, hogy a POST-ot `page.route`-tal elfogjuk. Így a közös dev-DB
  `app_setting` sorát nem írja, mégis látszik, hogy a POST viszi a mezőket.

## Nyitott / következő
- Élesítés: a nagy deploy utáni első kör, külön engedéllyel (DEPLOY-READY §4b.4).
- Javaslat (hatókörön kívül): a 72 órás határidő és a −25% bemutatkozó kedvezmény ugyanebbe a szekcióba
  kívánkozik. Ha a −25% állítható lesz, az eszkaláció alsó határa abból származik (a kód már így számol).

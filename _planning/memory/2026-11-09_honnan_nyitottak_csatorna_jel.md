# 2026-11-09 — Honnan nyitották: csatorna-jel a linkben + panel a Tölcsérben

**Kérés** (brief `report-20261109-092503.md`, tulaj): a Megkeresés-riport Tölcsér lapján látni,
honnan (e-mail / SMS / Viber / WhatsApp) nyitotta meg a lead a linket.

**Mérés előtte (élesen, olvasás):** a link minden csatornán ugyanaz volt; `referrer_host` csak ~15%-nál
(Gmail-app). 272 megnyitó lead: SMS 119 · e-mail 80 · nem eldönthető 87 (időrend + referrer). Viber/WhatsApp: 0.

**Terv-kapu:** mock A/B (asztali + mobil, élő adat) → tulaj: „B”. Befagyasztva
`assets/design-refs/console/honnan-nyitottak/` (README köt).

**Megvalósítás (ADR-XXXX):**
- `src/outreach/openVia.ts` — `tagLink`/`tagLinkInText`/`retagMessengerAsWhatsapp`/`openViaFromTag`.
  A jel a KÜLDÉS utolsó lépésében kerül a szövegbe: `sendBatch` + `escalationFollowup` (levél, `openVia: "e"`),
  `sendOutreachSms` + `sendOutreachPair` (SMS `s`, messenger-képaláírás `m`), `mms/messenger.ts` (WhatsApp-utánküldés `w`).
- `migrations/0132_mock_view_open_via.sql` — `mock_view.open_via`; `recordView` + `POST /p/:token/view` (`via`, fehérlista).
- `assets/runtime/cit-configurator.js` — `OPEN_VIA`: kiolvas, elküld, a címsorból levesz.
- `src/console/reportData.ts` — `attributeOpen` (jel → levelező-referrer → egyetlen csatorna → unknown),
  `touchesOf` (⛔ messenger-küldésnél az `sms_sent_at` NEM SMS), `foldOpenSources`; `reportViews.ts` `openSourcePanel`.
- CSS `rp-os-*` (citui-console.css), súgó `kb/entries/console-report/entry.hu.md`, őr `scripts/open-via-check.mts` (pre-commit).

**Ellenőrizve:** open-via-check + önteszt, beacon e2e (`/p/<t>?e` → `open_via=email`, címsor tisztul, 0 JS-hiba,
a próba sorai törölve), Tölcsér ui-shot 390px + asztali, sor-lenyitás Playwrighttal.

**Nyitott:** élesítés külön engedéllyel (0132 migráció). A próba-kampány linkjei jel nélkül maradnak (szándékos).

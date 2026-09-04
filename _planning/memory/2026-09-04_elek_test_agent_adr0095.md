# 2026-09-04 — „Elek" gépi kézi-tesztelő bevezetése (ADR-0095) — a rend ÉL

## Mi történt

**A MineREAL-ben aznap üzembe állt Elek-rend teljes Citoviso-adaptációja, tulaj-megbízásból,
egy nap alatt a működő teljes körig.** F0 (terv-kapu) → jóváhagyás („B változat") → F1
(runner + napló + két lefutott kör leletekkel) → tulaj-pontosítások (ALL IN scope; kiküldés
a saját címére; gépi garancia) → postafiók + lead-seed. Öt landolt commit, ADR-0095.

### A rend elemei (hol mi van)

- **`elek/charter/`** — CHARTER (diéta, két-út, tiltások) · SCENARIO-FORMAT (FK-kontraktus) ·
  RUN-PROMPT (kiértékelő feladatlista) · BRIEF-TEMPLATE (a szó szerinti agent-prompt).
- **`elek/bin/runner.mts`** — 1. réteg, determinisztikus: in-process szerver efemer porton
  (ui-shot minta), mintelt HMAC-session (`elek` operator_user), tedd/várd lépések, minden
  lépésről shot, console+HTTP≥400+dialog rögzítve; Előkészítés-bukás = teljes stop.
- **`elek/bin/mailbox.mts`** — Elek SAJÁT postafiókjának (elek@citoviso.com, külön Zoho-user)
  csak-olvasó nézőkéje: protokoll-szinten EXAMINE+PEEK, más fiókot megtagad. IMAP-adatok a
  lokál `.env`-ben (`ELEK_IMAP_*`).
- **`/test-log` a konzolon** — jóváhagyott B kontraktus (`design-refs/console/elek-test-log/`);
  fájl-tárolás (`data/test-log/`, a dev-DB-purge ellen); az `elek` sor a közös listából REJTVE,
  csak `?user=elek` linkkel nézhető (két-út doktrína). KB-entry: `console-test-log`.
- **`elek/scenarios/`** — SCOPE.md (ALL-IN térkép + bukás-mátrix + határok), FK-000 (füst),
  FK-003 (lead-lista). `elek/memory/runs.jsonl` verziózott futás-történet.
- **`scripts/seed-elek-lead.mts`** — ELEK-TESZT Vendégház lead (a3a8a680): a legerősebb
  no_site lead klónja, név/email átírva (kontakt: elek@citoviso.com).

### Kulcs-döntések (ADR-0095)

④ **Kiküldés-szabály tulaj-felülírása:** Elek NYOMHAT Küldés-gombot, de csak elek@citoviso.com
címzettre — és ez GÉPI: `ElekRecipientGuard` a levél-transzport legkülső rétegén (ELEK_RUN=1
alatt minden más címzett hangos hibával eldobva; vegyes lista is), sendSms/sendMms zárva.
RED/GREEN mérve mindhárom csatornán. ⚠️ **SMS-self-loopback MÉRTEN nem megy** (a hálózat
kétszer eldobta, status=10) — az SMS/MMS-ág „KÉZI KELL" marad; az `ELEK_SMS_SELF=1` opt-in a
kódban, ha egy MMS-mérés vagy más SIM később megnyitná.

### Elek első leletei (2 kör, triázsra a tulajnál)

ORSZÁG-oszlop kevert formátum (MAGYARORSZÁG/HU + `Balaton` régió-outlier) · angol `none` a
magyar KONTAKT oszlopban · kézikönyv↔UI drift (diszkvalifikáltak-link helye) · néma
favicon-404 a konzolon (zöld lépés alatt — a „nulla néma zöld" elv fogta).

### Tanulságok

- A `getByText().first()` rejtett `<option>`-t fog a látható badge előtt → a „látható" check
  BÁRMELY látható találatra igaz (runner-fix). Full-page shot 590 soros listán ítélhetetlen →
  12000px felett viewport-shot.
- A „100%-os" garancia kérdésére (tulaj) az őszinte válasz „nem" volt → a szabályból AZNAP
  gépi kapu lett. A guard-teszt mellékhatása: 1 valódi loopback-SMS (a lokál SMS_PROVIDER
  gammu, nem mock — a mock-feltételezés hibás volt; sor kitakarítva).
- Zoho: új user IMAP-ja alapból KI (admin: Postafiók-műveletek → IMAP-hozzáférés); az alias
  NEM külön fiók (a tulaj jól váltott külön userre).

## Nyitott / következő

1. **FK-003b:** mock-generálás az ELEK-TESZT leaden (valós AI-hívás ~$0.2) → lead-lap állapotok.
2. **FK-004 kiküldés-kör:** draft → §C-kapuk → Küldés → mailbox.mts-sel elolvassa → link → funnel.
3. **ELEK-TESZT tenant seed** (vevő-email: elek@) → FK-001/002/005 (vásárlás/bővítés/lemondás
   a mock-gateway-en, bukás-mátrixszal) → FK-006 időutazó-setup a dunning-állapotokhoz.
4. Lelet-triázs a tulajjal (a 4 lelet fenti listája).

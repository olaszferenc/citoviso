# 2026-10-12 — „Mi tartotta vissza?” kis alsó sáv + önálló hideg SMS GSM-7 + kérdés-verseny (Elek lead-kör)

SUB az Elek-teszt koordinátor alatt (fa `~/wt/cit20065f9d`). Döntés: ADR-XXXX.

## Elvégezve
- **K-új-1 (tulaj „ok rendben”):** a kérdés-kártya (mobilon 366×353 px, mindkét pirula alatta) helyett
  egysoros alsó sáv (~44 px), a pirulák fölött; a válaszok koppintásra nyílnak; asztalon bal alsó sarok.
  Terv + képek: `assets/design-refs/prospect-page/survey-bar/`; a felső sáv README 4. pontja erre mutat.
- **A-új-1:** gyors × a `/view` válasza előtt → a kérdés a viewId megérkezésekor jön (`fbWanted`).
- **A-új-2:** `renderSmsDraft` GSM-7, ≤ 2 szelet (közös `foldedSms` a kísérővel); régen UCS-2 / 4 szelet.
- Őrök: `mock-trial-overlay-check` ⑦⑧ (+ önteszt), `pair-sms-gsm7-check` az önálló SMS-re is.
- Elek `05s3`/`05c` szkriptjei scratch-DB-n újrafuttatva (scratch `citoviso_kerdsav_10122058`, eldobva):
  a sáv zárva 44/48 px, 0 átfedés a pirulákkal, gyors × után is jön. Két új leletet javítottam:
  a nyitott rendelés-panel fölött maradt (mobil), asztalon hős-gombokat takart → `placeFb` + panel-őr.
- N5 (a koordinátor kérése, Elek tenant-köre): a felső ajánlat-sáv és a szerkeszthetőség-sáv egymás alá kerül.

## Módosított fájlok
`assets/runtime/cit-configurator.js`, `assets/runtime/cit-configurator.css`, `src/outreach/draft.ts`,
`src/i18n/catalog.json`, `scripts/mock-trial-overlay-check.mts`, `scripts/pair-sms-gsm7-check.mts`,
`assets/design-refs/prospect-page/survey-bar/*`, `assets/design-refs/console/escalation-topbar/README.md`.

## Nyitott
- Élesre a nagy deployjal.
- Tanulság: a `pkill -f "<minta>"` a saját parancssort is megölte (exit 144); PID szerint ölj.

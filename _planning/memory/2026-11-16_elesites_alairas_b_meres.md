# 2026-11-16 — Élesítés 068073d0: e-mail aláírás, ?b mérés, fejléc/előnézet (cit383fe8b6)

## Elvégezve
- Tulaj „menjen élesre” → `deploy-prod.sh 068073d0… --go`, tag `prod/20261116-1105`; előtte a viselkedés-üzenet időzítője leállítva, a deploy GATE 6b visszakapcsolta.
- A deploy GATE 1c (tudásbázis) megállt: a Riport súgója nem ismerte a „Viselkedés-üzenet” sort és a `/?b` jelet, a viselkedés-üzenet súgója még 4 napot írt. Javítva (`068073d0`), tudasbazis-or PASS.
- Migráció `0136_behavior_open_via.sql` lefutott (pg_dump: `/opt/citoviso/backups/db-pre-20261116-110356.sql.gz`).
- Ellenőrizve élesen: tiszta fa, CHECK-megkötés tartalmazza a `behavior`-t, `anchoredLink` → `/?b#kerdes`, `/?b&k=ar#ar`, `/?b#inditas`; egy élő mock beágyazott konfigurátora olvassa a `b` jelet; a fejlécben nincs „Még nem nyilvános”, a preheader benne van; az időzítő fut.

## Fájlok
- `kb/entries/console-report/entry.hu.md`, `kb/entries/console-behavior-message/entry.hu.md`, `MEMORY.md`

## Nyitott (tulaj)
- Aláírás: titulus (`OUTREACH_SENDER_TITLE` élesen nincs beállítva), telefon, a csapat-aláírás E-sora (info@ vagy a feladó címe).
- A Zoho postafiók-aláírás beállítása a `assets/design-refs/console/email-alairas/mailbox-signature-*.html` alapján.

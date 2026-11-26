# 2026-11-25 — A modem-SIM a MineREAL-é: Citoviso SMS/MMS ki, MineREAL-konzol szűrése

Brief: `~/rc-briefs/sms-ek-inaktiv-l-sa-20261125-143241.md` · session `cit18bb6a8f`.

## Mi történt
- **Leállítás (helyi, visszafordítható):** 14:39:54 — `citoviso-sms-relay.timer`, `citoviso-mms-relay.timer`,
  `citoviso-pair-repair.timer` disabled + stopped; fő fa `.env`: `SMS_PROVIDER=mock`, `MMS_PROVIDER=mock`
  (mentés `~/.config/citoviso/env-before-sms-off-20261125.bak`); a dev konzol/public `tsx watch` újraindult.
- **Szűrés:** `scripts/mineral-sms-hide.mts` — a MineREAL-konzol (`routing/modules/sms`) a
  `minereal_dev.sms_msg_meta.is_deleted=1` sorokat eleve rejti; a szkript ezt írja a Citoviso-üzenetekre
  (`updated_by='citoviso-szuro'`, `--undo`, `--dry`). Cron 5 percenként a fő fából.
  Első futás: 1019 Citoviso-szám, 1328 elküldött + 36 beérkezett rejtve; látható maradt 25 elküldött + 14 beérkezett.

## Mért tények
- gammu `sentitems.CreatorID` mindenkinél „Gammu 1.42.0”, `SenderID` „minereal-gsm” → nincs feladó-jel.
- `minereal_sms` collation `utf8mb4_uca1400_ai_ci`, `minereal_dev` `utf8mb4_unicode_ci` (ERROR 1267, ha nem nevezed meg).
- Éles `mms_outbox`: 1036 `queued` (utolsó `sent` 11-13), `sms_outbox` napi 1–3 sor.

## Éles és a többi SIM-használó (tulaj „mehet” 11-25, „jöjjön le az is” 11-26)
- **Élesen 11-25 14:54:** `/opt/citoviso/app/.env` `SMS_PROVIDER=mock`, `MMS_PROVIDER=mock` (mentés
  `.env.bak-sms-off-20261125-145402`), console → public újraindítva. A sorban állt 1036 MMS (11-09…11-20)
  `status='failed'` + `last_error='félretéve 2026-11-25 …'`; id-lista `/opt/citoviso/backups/mms-hold-20261125-145402/queued-ids.txt`.
  A mock élesen nem tesz sorba, de a prospectet ugyanúgy `sent`-nek bélyegzi.
- **Helyben 11-26 07:05:** `disable --now` a `citoviso-callbot.service`, `citoviso-messenger-watch.timer`,
  `citoviso-replies-sms.timer`. ⛔ Marad: `gammu-smsd` (drop-in → `scripts/callbot/s10_smsd.py`) és `adb` —
  ezen megy a MineREAL SMS-e is.

## Fájlok
- `scripts/mineral-sms-hide.mts` (új), `MEMORY.md`, ez a jegyzet; repón kívül: fő fa és éles `.env`, crontab-sor,
  systemd unitok, MR-tájékoztató `~/rc-briefs/mineral-sms-szuro-mr-tajekoztato-20261125.md`.

## Nyitott
- A MineREAL-tájékoztatót a tulajnak kell továbbítania az MR-sessionnek (innen nem érhető el).

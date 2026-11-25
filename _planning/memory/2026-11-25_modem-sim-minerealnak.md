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

## Nyitott
- Éles `SMS_PROVIDER`/`MMS_PROVIDER` még `queue` → a sor gyűlik; kikapcsolása prod-írás, tulaj-engedély kell.
- Az 1036 sorban álló MMS sorsa (törlés / `held`), hogy egy véletlen relay-visszakapcsolás se küldje ki.
- Hívás-bot (`citoviso-callbot`) ugyanazon a SIM-en fogad/hív — a brief nem érintette.
- A Poe SMS-válaszai és az operátori riasztó SMS-ek megszűntek (e-mail marad).
